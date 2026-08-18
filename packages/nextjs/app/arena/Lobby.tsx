"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ModelName } from "./ModelName";
import {
  FundingMode,
  MULTICALL3_ABI,
  MULTICALL3_ADDRESS,
  fundingMode,
  fundingThresholdEth,
  localTestClient,
} from "./funding";
import { Agent, CHALLENGES } from "./mockData";
import { type FundingStatus, fundingStatus, useAgentBalances } from "./useAgentBalances";
import { useArenaRoute } from "./useArenaRoute";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { encodeFunctionData, formatEther, parseEther } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { Address, BlockieAvatar, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import type { RunState } from "~~/services/arena/arena-types";
import { ArenaApiError, arenaClient } from "~~/services/arena/client";
import type { FundingProjection } from "~~/services/arena/projection";
import { ROSTER } from "~~/services/arena/roster";
import { selectFunding, selectRun, selectRunError, useArenaStore } from "~~/services/arena/store";
import { useOperatorSession, useSeedSigner } from "~~/services/arena/useOperatorSession";

type Phase =
  | "idle"
  | "connecting"
  | "created"
  | "signature"
  | "preparing"
  | "funding"
  | "ready"
  | "launching"
  | "failed";
type SlotState = "waiting" | "joining" | "ready";
type ActiveRunConflict = { id: string; state: string };

const CY = "#00FBFF";
const GREEN = "#00ff9c";
const YELLOW = "#FFBE00";
const RED = "#FF5861";
const STOP_ARM_MS = 6000;
const STOP_CONFIRM_DWELL_MS = 400;

const SETUP_STATE_COPY: Record<RunState, string> = {
  created: "Run created",
  awaiting_signature: "Waiting for signature",
  preparing: "Assigning agent wallets",
  awaiting_funding: "Waiting for agent funding",
  ready: "All agents ready",
  running: "The run is live",
  stopping: "Stopping the run",
  finished: "Run finished",
  failed: "Run setup failed",
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function activeRunConflict(cause: unknown): ActiveRunConflict | null {
  if (!(cause instanceof ArenaApiError) || cause.status !== 409 || !cause.body || typeof cause.body !== "object") {
    return null;
  }
  const { activeRunId, activeRunState } = cause.body as Record<string, unknown>;
  return typeof activeRunId === "string" && typeof activeRunState === "string"
    ? { id: activeRunId, state: activeRunState }
    : null;
}

function tone(ctx: AudioContext, freq: number, dur = 0.09, type: OscillatorType = "square", gain = 0.05) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur);
}

export function ArenaLobby({
  agents,
  onLaunch,
  onStartOver,
}: {
  agents: Agent[];
  onLaunch: () => void;
  onStartOver: () => void;
}) {
  const [log, setLog] = useState<{ id: number; text: string; color: string }[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [funding, setFunding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [signingSeed, setSigningSeed] = useState(false);
  const [signingInOperator, setSigningInOperator] = useState(false);
  const [stoppingRun, setStoppingRun] = useState(false);
  const [stopArmed, setStopArmed] = useState(false);
  const [stopConfirmDisabled, setStopConfirmDisabled] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [blockingRun, setBlockingRun] = useState<ActiveRunConflict | null>(null);

  const run = useArenaStore(selectRun);
  const fundingProjection = useArenaStore(selectFunding);
  const runError = useArenaStore(selectRunError);

  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const logId = useRef(0);
  // The run this lobby started, if any — the only one the 3-2-1 belongs to.
  const launchedHere = useRef<string | null>(null);
  const lastRunState = useRef<string | null>(null);
  const stopArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const operator = useOperatorSession();
  const needsWallet = !operator.authenticated && !operator.address;
  const signSeed = useSeedSigner();
  const route = useArenaRoute();
  const canStopRun =
    run?.state === "awaiting_signature" ||
    run?.state === "preparing" ||
    run?.state === "awaiting_funding" ||
    run?.state === "ready";
  const stoppedBeforeStart = run?.startedAt == null && (run?.state === "stopping" || run?.state === "finished");

  useEffect(
    () => () => {
      clearTimeout(stopArmTimer.current ?? undefined);
      clearTimeout(stopConfirmTimer.current ?? undefined);
    },
    [],
  );

  useEffect(() => {
    if (canStopRun) return;
    setStopArmed(false);
    setStopConfirmDisabled(false);
    clearTimeout(stopArmTimer.current ?? undefined);
    clearTimeout(stopConfirmTimer.current ?? undefined);
    stopArmTimer.current = null;
    stopConfirmTimer.current = null;
  }, [canStopRun]);

  // Every run state has a view. `created` is the one nothing used to reach on its
  // own — a start that never landed parks a run there, and the URL can be reloaded
  // or shared straight into it, so it needs its own screen rather than a spinner.
  const phase: Phase = !run
    ? starting
      ? "connecting"
      : "idle"
    : run.state === "created"
    ? "created"
    : run.state === "awaiting_signature"
    ? "signature"
    : run.state === "preparing"
    ? "preparing"
    : run.state === "awaiting_funding"
    ? "funding"
    : run.state === "ready"
    ? "ready"
    : stoppedBeforeStart
    ? "failed"
    : run.state === "running" || run.state === "stopping" || run.state === "finished"
    ? "launching"
    : "failed";

  const beep = useCallback((freq: number, dur?: number, type?: OscillatorType, gain?: number) => {
    const ctx = audioRef.current;
    if (!ctx || mutedRef.current) return;
    tone(ctx, freq, dur, type, gain);
  }, []);

  const pushLog = useCallback((text: string, color: string) => {
    setLog(prev => [{ id: ++logId.current, text, color }, ...prev].slice(0, 60));
  }, []);

  useEffect(() => {
    if (!run) {
      lastRunState.current = null;
      return;
    }
    if (lastRunState.current === run.state) return;
    lastRunState.current = run.state;
    pushLog(
      SETUP_STATE_COPY[run.state] ?? "Run status updated",
      run.state === "failed" ? RED : run.state === "running" ? GREEN : CY,
    );
  }, [pushLog, run]);

  const readyCount = run?.entrants.length ?? 0;

  // ---- funding -------------------------------------------------------------
  // Only the networks listed in funding.ts can be funded: these wallets are
  // generated per run and their keys are thrown away, so anything sent on a
  // network where the funds matter would be unrecoverable.
  const { chain, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain } = useSwitchChain();
  const fundingChainId = run?.chainId ?? targetNetwork.id;
  const fundingThreshold = fundingThresholdEth(fundingChainId);
  const [amount, setAmount] = useState(fundingThreshold);
  const amountEdited = useRef(false);
  const mode = fundingMode(fundingChainId);
  const wrongNetwork = mode === "batch" && isConnected && chain?.id !== fundingChainId;
  const walletReady = mode === "local" || (isConnected && !wrongNetwork);
  const canFund = mode !== "none" && walletReady;
  const transactor = useTransactor();

  useEffect(() => {
    if (!amountEdited.current) setAmount(fundingThreshold);
  }, [fundingThreshold]);

  const handleAmountChange = useCallback((value: string) => {
    amountEdited.current = true;
    setAmount(value);
  }, []);

  const addresses = useMemo(() => agents.flatMap(agent => (agent.address ? [agent.address] : [])), [agents]);
  const fundingActive = phase === "preparing" || phase === "funding" || phase === "ready" || phase === "launching";
  const {
    balances,
    isError: balancesUnreachable,
    refetch: refetchBalances,
  } = useAgentBalances(addresses, fundingActive, fundingChainId);

  const required = useMemo(() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  }, [amount]);

  const requiredRef = useRef(required);
  requiredRef.current = required;

  const fundedCount = agents.filter(agent => fundingProjection[agent.id]?.funded).length;
  const progressCount = fundingActive ? fundedCount : readyCount;
  const progressDone = agents.length > 0 && progressCount === agents.length;

  const fundAll = useCallback(async () => {
    const target = requiredRef.current;
    if (!target || mode === "none") return;
    setFunding(true);
    try {
      // Read balances before deciding what to send. The poll only refreshes every
      // 2s and the button re-enables the moment a run ends, so resuming inside
      // that window would see stale zeroes and double-send to funded agents.
      const fresh = await refetchBalances();
      if (fresh.isError || !fresh.data) {
        pushLog(`cannot read agent balances — is ${targetNetwork.name} reachable?`, RED);
        return;
      }
      const current = fresh.data;
      // Top up the shortfall rather than the full amount, so resuming after a
      // failure — or raising the target mid-run — never overshoots.
      const pending = agents
        .flatMap(agent =>
          agent.address ? [{ agent, address: agent.address, shortfall: target - (current[agent.address] ?? 0n) }] : [],
        )
        .filter(pendingAgent => pendingAgent.shortfall > 0n);

      if (pending.length === 0) {
        pushLog("every agent already holds the target amount", GREEN);
        return;
      }

      try {
        if (mode === "local") {
          // No transaction and no gas on a local node: set the balances outright.
          for (const { agent, address } of pending) {
            await localTestClient.setBalance({ address, value: target });
            pushLog(
              `${agent.model}${agent.effort ? ` · ${agent.effort}` : ""} · ${shortAddress(
                address,
              )} set to ${amount} ETH ✓`,
              GREEN,
            );
          }
          // setBalance mines nothing, and the backend reads balances one block behind
          // the head. Without a block of its own the run waits at awaiting_funding
          // until the phase times out.
          await localTestClient.mine({ blocks: 1 });
        } else {
          // One Multicall3 call forwards value to every agent — a single
          // confirmation for the director instead of one per agent. The contract
          // reverts unless msg.value matches the sum exactly.
          const total = pending.reduce((sum, p) => sum + p.shortfall, 0n);
          pushLog(`funding ${pending.length} agents in one transaction…`, YELLOW);
          // useTransactor resolves undefined (without throwing) when it has no
          // wallet client — reporting that as funded would log a green tick for
          // zero ETH moved.
          const hash = await transactor({
            to: MULTICALL3_ADDRESS[fundingChainId],
            value: total,
            data: encodeFunctionData({
              abi: MULTICALL3_ABI,
              functionName: "aggregate3Value",
              args: [
                pending.map(p => ({
                  target: p.address,
                  allowFailure: false,
                  value: p.shortfall,
                  callData: "0x" as const,
                })),
              ],
            }),
          });
          if (!hash) throw new Error("no transaction hash");
          pushLog(`${pending.length} agents funded ✓ · ${formatEther(total)} ETH`, GREEN);
        }
      } catch {
        pushLog("funding failed — press FUND ALL AGENTS to retry", RED);
      }
      await refetchBalances();
    } finally {
      setFunding(false);
    }
  }, [agents, amount, fundingChainId, mode, targetNetwork, transactor, pushLog, refetchBalances]);

  const openLobby = useCallback(async () => {
    if (!audioRef.current) {
      try {
        audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        audioRef.current = null;
      }
    }
    audioRef.current?.resume();
    setStarting(true);
    setError(null);
    setBlockingRun(null);
    let createdRunId: string | null = null;
    try {
      if (!operator.authenticated) await operator.signIn();
      const minutes = Number(durationMinutes);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
        throw new Error("Race duration must be between 1 and 1440 minutes");
      }
      const created = await arenaClient.createRun({
        preset: "docker-arena",
        roster: [...ROSTER],
        durationMs: Math.round(minutes * 60_000),
      });
      createdRunId = created.id;
      launchedHere.current = created.id;
      // The URL is what connects the page to a run, so naming it here is the
      // whole handover. Entering a run is a navigation and takes a history
      // entry: back returns to the lobby.
      route.go({ run: created.id });
      pushLog(`created run ${created.id}`, GREEN);
      const started = await arenaClient.startRun(created.id);
      useArenaStore.getState().syncSnapshot(started);
      pushLog(`started run ${created.id}`, GREEN);
    } catch (cause) {
      const conflict = activeRunConflict(cause);
      if (conflict) {
        // Only the run this call put in the URL: a conflict raised by `createRun`
        // never named one, and the address bar may still hold a run the operator
        // was watching. Replaces, since the entry it drops leads nowhere.
        if (createdRunId) route.go({ run: null }, { replace: true });
        setBlockingRun(conflict);
        pushLog(`start blocked by run ${conflict.id}`, RED);
        return;
      }
      const message = cause instanceof Error ? cause.message : "Could not start the arena";
      setError(message);
      pushLog(message, RED);
    } finally {
      setStarting(false);
    }
  }, [durationMinutes, operator, pushLog, route]);

  // A start that never landed — a lost race for the single active run, a dropped
  // connection — leaves the run sitting in `created`. Retrying it is the whole
  // repair; nothing was prepared yet, so there is nothing to unwind.
  const startCreatedRun = useCallback(async () => {
    if (!run || run.state !== "created") return;
    setStarting(true);
    setError(null);
    setBlockingRun(null);
    try {
      if (!operator.authenticated) await operator.signIn();
      launchedHere.current = run.id;
      const started = await arenaClient.startRun(run.id);
      useArenaStore.getState().syncSnapshot(started);
    } catch (cause) {
      // Losing the race for the active slot is how a run ends up here in the
      // first place, so the retry can lose it again — and needs the same box
      // naming the blocker. The run stays in the URL: it is still `created`,
      // and this screen is still its screen.
      const conflict = activeRunConflict(cause);
      if (conflict) {
        setBlockingRun(conflict);
        pushLog(`start blocked by run ${conflict.id}`, RED);
        return;
      }
      const message = cause instanceof Error ? cause.message : "Could not start the run";
      setError(message);
      pushLog(message, RED);
    } finally {
      setStarting(false);
    }
  }, [operator, pushLog, run]);

  const submitSeed = useCallback(async () => {
    if (!run || run.state !== "awaiting_signature") return;
    setSigningSeed(true);
    setError(null);
    setBlockingRun(null);
    try {
      const signature = await signSeed(run.id, run.chainId);
      const updated = await arenaClient.seedRun(run.id, { signature });
      useArenaStore.getState().syncSnapshot(updated);
      pushLog("Signature accepted", GREEN);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not confirm the signature";
      setError(message);
      pushLog(message, RED);
    } finally {
      setSigningSeed(false);
    }
  }, [pushLog, run, signSeed]);

  const signInOperator = useCallback(async () => {
    try {
      await operator.signIn();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not sign in to manage this run";
      setError(message);
      pushLog(message, RED);
      return false;
    }
  }, [operator, pushLog]);

  const signInToManageRun = useCallback(async () => {
    if (operator.authenticated || signingInOperator) return;
    setSigningInOperator(true);
    setError(null);
    setBlockingRun(null);
    try {
      await signInOperator();
    } finally {
      setSigningInOperator(false);
    }
  }, [operator.authenticated, signInOperator, signingInOperator]);

  const stopLoadedRun = useCallback(async () => {
    if (!run || !canStopRun || stoppingRun) return;
    if (!stopArmed) {
      setStopArmed(true);
      setStopConfirmDisabled(true);
      stopConfirmTimer.current = setTimeout(() => {
        setStopConfirmDisabled(false);
        stopConfirmTimer.current = null;
      }, STOP_CONFIRM_DWELL_MS);
      stopArmTimer.current = setTimeout(() => setStopArmed(false), STOP_ARM_MS);
      return;
    }
    setStoppingRun(true);
    setError(null);
    setBlockingRun(null);
    // Sign in before disarming: a transient auth failure keeps the confirm
    // armed instead of restarting the two-click dance.
    if (!operator.authenticated && !(await signInOperator())) {
      setStoppingRun(false);
      return;
    }
    clearTimeout(stopArmTimer.current ?? undefined);
    setStopArmed(false);
    try {
      const stopped = await arenaClient.stopRun(run.id);
      useArenaStore.getState().syncSnapshot(stopped);
      pushLog(`stopped run ${run.id}`, GREEN);
    } catch (cause) {
      if (cause instanceof ArenaApiError && cause.status === 401) {
        operator.invalidate();
        setError("operator session expired — sign in again");
        pushLog("operator session expired — sign in again", RED);
      } else {
        const message = cause instanceof Error ? cause.message : "Could not stop the arena run";
        setError(message);
        pushLog(message, RED);
      }
    } finally {
      setStoppingRun(false);
    }
  }, [canStopRun, operator, pushLog, run, signInOperator, stopArmed, stoppingRun]);

  const runId = run?.id ?? null;
  useEffect(() => {
    if (phase !== "launching") return;
    // Only a race this lobby just started gets counted in. One opened from a
    // link — or reopened from the lobby after the podium — is already under way
    // or already over, so it goes straight through to the arena.
    if (launchedHere.current !== runId) {
      onLaunch();
      return;
    }
    let n = 3;
    setCountdown(n);
    beep(440, 0.12, "square", 0.06);
    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        beep(440, 0.12, "square", 0.06);
      } else if (n === 0) {
        setCountdown(0);
        beep(880, 0.3, "sawtooth", 0.07);
      } else {
        clearInterval(tick);
        onLaunch();
      }
    }, 900);
    return () => clearInterval(tick);
  }, [beep, onLaunch, phase, runId]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-[#00FBFF] font-mono overflow-hidden lobby-root">
      <div className="pointer-events-none absolute inset-0 z-[70] lobby-scanlines" />

      {/* header */}
      <div className="lobby-header flex items-center gap-4 px-5 h-16 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] shrink-0">
        <span className="lobby-phase flex items-center gap-2 text-[#00FBFF]/80 font-bold tracking-widest text-base">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: phase === "idle" ? "#3a4a4d" : phase === "ready" ? GREEN : YELLOW }}
          />
          {phase === "idle"
            ? "STANDBY"
            : phase === "created"
            ? "NOT STARTED"
            : phase === "ready"
            ? "READY"
            : phase === "launching"
            ? "LAUNCHING"
            : phase === "funding"
            ? "FUNDING"
            : phase === "signature"
            ? "SIGNATURE"
            : phase === "preparing"
            ? "PREPARING"
            : phase === "failed"
            ? "FAILED"
            : "LOBBY"}
        </span>
        <Link
          href="/arena"
          className="lobby-header-title font-dotGothic text-xl md:text-2xl tracking-wide lobby-title-glow transition-opacity hover:opacity-80"
        >
          BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENT ARENA
        </Link>
        <div className="lobby-header-badges hidden lg:flex items-center gap-1 text-sm text-[#00FBFF]/70">
          <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{agents.length} AGENTS</span>
          <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{CHALLENGES.length} CHALLENGES</span>
        </div>
        <button
          onClick={() => setMuted(m => !m)}
          className="lobby-sfx ml-auto text-sm px-2 py-1 rounded border border-[#00FBFF]/25 text-[#00FBFF]/75 hover:text-[#00FBFF] hover:border-[#00FBFF]/60 transition"
          title={muted ? "unmute lobby SFX" : "mute lobby SFX"}
        >
          {muted ? "🔇 SFX OFF" : "🔊 SFX ON"}
        </button>
        <RainbowKitCustomConnectButton />
      </div>

      {/* stage */}
      <div className="lobby-stage flex-1 min-h-0 flex">
        <div className="lobby-main flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-8 relative">
          <div className="lobby-hero text-center mb-6">
            <div className="lobby-hero-title font-dotGothic text-3xl md:text-4xl tracking-widest lobby-title-glow">
              {phase === "idle"
                ? "READY FOR A NEW RUN"
                : phase === "created"
                ? "RUN NOT STARTED"
                : phase === "signature"
                ? "AUTHORIZE AGENT WALLETS"
                : phase === "preparing"
                ? "PREPARING AGENTS"
                : phase === "funding"
                ? "FUNDING AGENTS"
                : phase === "ready"
                ? "ALL AGENTS READY"
                : phase === "launching"
                ? run?.state === "stopping"
                  ? "RUN STOPPING"
                  : run?.state === "finished"
                  ? "RUN FINISHED"
                  : "RUN IN PROGRESS"
                : phase === "failed"
                ? "RUN FAILED"
                : "AGENTS JOINING"}
            </div>
            <div className="lobby-hero-subtitle mt-2 text-sm text-[#00FBFF]/55 tracking-wide">
              {phase === "idle" ? null : phase === "created" ? (
                <span className="text-[#FFBE00]">This run was created but never started.</span>
              ) : phase === "launching" ? (
                <span className="text-[#00ff9c] animate-pulse">
                  {run?.state === "stopping"
                    ? "Stopping the run…"
                    : run?.state === "finished"
                    ? "The run is complete."
                    : "The run is live."}
                </span>
              ) : phase === "signature" ? (
                <span className="text-[#FFBE00]">Sign once to create this run&apos;s agent wallets.</span>
              ) : phase === "failed" ? (
                <span className="text-[#FF5861]">
                  {runError ?? error ?? "Something went wrong — try starting over"}
                </span>
              ) : fundingActive ? (
                <span>
                  <span className="text-[#00FBFF] font-bold tabular-nums">{fundedCount}</span>
                  <span className="text-[#00FBFF]/40"> / {agents.length}</span> agents funded
                  {phase === "funding" && <span className="lobby-blink"> · waiting…</span>}
                </span>
              ) : (
                <span>
                  <span className="text-[#00FBFF] font-bold tabular-nums">{readyCount}</span>
                  <span className="text-[#00FBFF]/40"> / {agents.length}</span> agents connected
                  {phase === "connecting" && <span className="lobby-blink"> · waiting…</span>}
                </span>
              )}
            </div>
          </div>

          {phase === "idle" && (
            <div className="lobby-idle-controls mb-8 flex flex-col items-center gap-3">
              <label className="flex items-center gap-2 text-base tracking-widest text-[#00FBFF]/75">
                RACE DURATION
                <input
                  value={durationMinutes}
                  onChange={event => setDurationMinutes(event.target.value)}
                  inputMode="numeric"
                  className="w-20 rounded border border-[#00FBFF]/30 bg-black/60 px-2 py-1 text-right text-[#00FBFF] focus:border-[#00FBFF] focus:outline-none"
                />
                MIN
              </label>
              {needsWallet ? (
                // Without the dev signer there is nothing to sign with, and the arena
                // covers the site header, so this is the only way in.
                <button
                  onClick={openConnectModal}
                  disabled={!openConnectModal || !operator.sessionLoaded}
                  className="lobby-cta group px-10 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#00FBFF] text-[#00FBFF] hover:bg-[#00FBFF] hover:text-black transition disabled:opacity-40"
                >
                  ▶ CONNECT WALLET
                </button>
              ) : (
                <button
                  onClick={() => void openLobby()}
                  disabled={!agents.length || !operator.sessionLoaded || !operator.configured || starting}
                  className="lobby-cta group px-10 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#00FBFF] text-[#00FBFF] hover:bg-[#00FBFF] hover:text-black transition disabled:opacity-40"
                >
                  {starting ? "CREATING RUN…" : operator.authenticated ? "▶ CREATE RUN" : "▶ SIGN IN & CREATE RUN"}
                </button>
              )}
              {!operator.sessionLoaded ? (
                <span className="text-base text-[#FFBE00]/90">Connecting…</span>
              ) : !operator.configured ? (
                <span className="text-base text-[#FFBE00]/90">Operator login is unavailable</span>
              ) : null}
              {/* The runs left behind. Without this the arena is only ever a new
                  race: a finished run walks out of reach the moment its URL goes. */}
              <Link
                href="/arena/runs"
                className="mt-2 text-xs font-bold tracking-widest text-[#00FBFF]/50 transition hover:text-[#00FBFF]"
              >
                PREVIOUS RUNS ▸
              </Link>
            </div>
          )}

          {(blockingRun || error) && phase !== "failed" && (
            <div className="mb-4 max-w-3xl rounded border border-[#FF5861]/40 bg-[#FF5861]/10 px-3 py-2 text-base text-[#FF5861]">
              {blockingRun ? (
                <>
                  <div>run is already {blockingRun.state.replaceAll("_", " ")}</div>
                  <code className="mt-1 block break-words text-[#FFBE00]">{blockingRun.id}</code>
                  <div className="mt-1">
                    <a
                      href={`/arena?run=${encodeURIComponent(blockingRun.id)}`}
                      onClick={event => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        setBlockingRun(null);
                        // A push, not a replace: this is the operator navigating
                        // into another run, and back has to come home to the
                        // lobby. The URL connects the page — nothing else to do.
                        route.go({ run: blockingRun.id });
                      }}
                      className="font-bold underline underline-offset-2 hover:text-white"
                    >
                      open that run
                    </a>
                    {blockingRun.state === "stopping" ? " and wait for it to finish" : " and stop it, then start yours"}
                  </div>
                </>
              ) : (
                error
              )}
            </div>
          )}

          {/* progress bar — connections while agents join, funding once they have */}
          <div className="lobby-progress w-full max-w-3xl h-1.5 rounded-full bg-[#00FBFF]/10 overflow-hidden mb-8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${agents.length ? (progressCount / agents.length) * 100 : 0}%`,
                background: progressDone ? GREEN : CY,
                boxShadow: `0 0 12px ${progressDone ? GREEN : CY}`,
              }}
            />
          </div>

          {phase === "preparing" || phase === "funding" || phase === "ready" ? (
            <FundingBoard
              agents={agents}
              balances={balances}
              fundingProjection={fundingProjection}
              required={required}
              amount={amount}
              fundingThreshold={fundingThreshold}
              onAmountChange={handleAmountChange}
              onFund={fundAll}
              onConnect={openConnectModal}
              onSwitchNetwork={() => switchChain({ chainId: targetNetwork.id })}
              funding={funding}
              isConnected={isConnected}
              mode={mode}
              canFund={canFund}
              wrongNetwork={wrongNetwork}
              networkName={fundingChainId === 31337 ? "Localhost" : targetNetwork.name}
              balancesUnreachable={balancesUnreachable}
              locked={phase !== "funding"}
            />
          ) : (
            <div className="lobby-slot-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl">
              {agents.map((a, i) => {
                const st: SlotState = run?.entrants.some(entrant => entrant.id === a.id) ? "ready" : "waiting";
                return <Slot key={a.id} agent={a} state={st} idle={phase === "idle"} index={i} />;
              })}
            </div>
          )}

          {/* primary action */}
          <div className="lobby-primary-action mt-10 h-16 flex items-center justify-center gap-3">
            {phase === "connecting" && (
              <div className="text-[#00FBFF]/50 text-sm tracking-widest font-dotGothic lobby-blink">
                ● ● ● AGENTS JOINING ● ● ●
              </div>
            )}
            {phase === "created" && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void startCreatedRun()}
                  disabled={starting || !operator.sessionLoaded || !operator.configured}
                  className="lobby-cta px-8 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#00FBFF] text-[#00FBFF] hover:bg-[#00FBFF] hover:text-black transition disabled:opacity-40"
                >
                  {starting ? "STARTING…" : operator.authenticated ? "▶ START RUN" : "▶ SIGN IN & START RUN"}
                </button>
                <button
                  onClick={onStartOver}
                  className="px-6 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#00FBFF]/40 text-[#00FBFF]/70 hover:border-[#00FBFF] hover:text-[#00FBFF] transition"
                >
                  ◀ START OVER
                </button>
              </div>
            )}
            {phase === "signature" && (
              <button
                onClick={() => void submitSeed()}
                disabled={signingSeed}
                className="lobby-cta-go px-10 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#FFBE00] text-[#FFBE00] transition disabled:opacity-40"
              >
                {signingSeed ? "SIGNING…" : "▶ SIGN TO CONTINUE"}
              </button>
            )}
            {phase === "preparing" && (
              <div className="text-[#00FBFF]/50 text-sm tracking-widest font-dotGothic lobby-blink">
                ● ● ● ASSIGNING WALLETS ● ● ●
              </div>
            )}
            {phase === "funding" && (
              <div className="text-[#FFBE00]/70 text-sm tracking-widest font-dotGothic lobby-blink">
                ● ● ● FUNDING AGENTS ● ● ●
              </div>
            )}
            {phase === "ready" && (
              <div className="text-[#00ff9c] text-sm tracking-widest font-dotGothic lobby-blink">
                ● ● ● STARTING RACE ● ● ●
              </div>
            )}
            {phase === "launching" && countdown !== null && (
              <div
                className="font-dotGothic text-6xl tracking-widest lobby-count"
                style={{ color: countdown === 0 ? GREEN : YELLOW }}
              >
                {countdown === 0 ? "GO!" : countdown}
              </div>
            )}
            {phase === "failed" && (
              <button
                onClick={onStartOver}
                className="lobby-cta px-10 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#FF5861] text-[#FF5861] hover:bg-[#FF5861] hover:text-black transition"
              >
                ◀ START OVER
              </button>
            )}
          </div>

          {phase === "created" && (
            <div className="mt-3 text-[11px] text-[#00FBFF]/40 tracking-wide">
              Nothing was prepared. Start this run again or return to the arena.
            </div>
          )}
          {phase === "ready" && (
            <div className="lobby-phase-note mt-3 text-base text-[#00FBFF]/70 tracking-wide">
              All agents ready — starting the run…
            </div>
          )}
          {phase === "funding" && (
            <div className="lobby-phase-note mt-3 text-base text-[#00FBFF]/70 tracking-wide">
              The run starts when every agent wallet is funded.
            </div>
          )}
          {canStopRun && (operator.authenticated || operator.hadSession) && (
            <div className="mt-6 flex justify-center">
              {operator.authenticated || (operator.hadSession && operator.address) ? (
                <button
                  onClick={() => void stopLoadedRun()}
                  disabled={stoppingRun || stopConfirmDisabled}
                  className={`px-4 py-1.5 rounded font-dotGothic text-sm tracking-widest border border-[#FF5861]/60 hover:bg-[#FF5861] hover:text-black transition disabled:opacity-40 ${
                    stopArmed ? "animate-pulse bg-[#FF5861] text-black border-[#FF5861]" : "text-[#FF5861]/80"
                  }`}
                >
                  {stoppingRun ? "STOPPING…" : stopArmed ? "CONFIRM STOP" : "■ STOP RUN"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (needsWallet) openConnectModal?.();
                    else void signInToManageRun();
                  }}
                  disabled={
                    !operator.sessionLoaded ||
                    (needsWallet ? !openConnectModal : !operator.configured || signingInOperator)
                  }
                  className="rounded border border-[#FFBE00]/50 px-3 py-1.5 font-dotGothic text-sm tracking-widest text-[#FFBE00] transition hover:bg-[#FFBE00] hover:text-black disabled:opacity-40"
                >
                  {needsWallet
                    ? "connect wallet to manage this run"
                    : signingInOperator
                    ? "signing in…"
                    : "sign in to manage this run"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* setup activity log */}
        <div className="lobby-log hidden md:flex w-[400px] shrink-0 flex-col border-l border-[#00FBFF]/20 bg-[#00090b]/70">
          <div className="lobby-log-header px-4 h-11 flex items-center text-base font-bold tracking-widest text-[#00FBFF]/75 border-b border-[#00FBFF]/15 bg-[#001417]">
            ▤ ARENA STATUS
          </div>
          <div className="lobby-log-lines flex-1 min-h-0 overflow-y-auto px-3 py-2 text-sm leading-snug space-y-1">
            {log.length === 0 && <div className="text-[#00FBFF]/55 italic">Waiting for setup activity…</div>}
            {log.map(l => (
              <div key={l.id} className="lobby-log-in flex gap-2">
                <span className="text-[#00FBFF]/55 shrink-0">›</span>
                <span style={{ color: l.color }}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LobbyStyles />
    </div>
  );
}

function FundingBoard({
  agents,
  balances,
  fundingProjection,
  required,
  amount,
  fundingThreshold,
  onAmountChange,
  onFund,
  onConnect,
  onSwitchNetwork,
  funding,
  isConnected,
  mode,
  canFund,
  wrongNetwork,
  networkName,
  balancesUnreachable,
  locked,
}: {
  agents: Agent[];
  balances: Record<string, bigint>;
  fundingProjection: Record<string, FundingProjection>;
  required: bigint;
  amount: string;
  fundingThreshold: string;
  onAmountChange: (v: string) => void;
  onFund: () => void;
  onConnect?: () => void;
  onSwitchNetwork: () => void;
  funding: boolean;
  isConnected: boolean;
  mode: FundingMode;
  canFund: boolean;
  wrongNetwork: boolean;
  networkName: string;
  balancesUnreachable: boolean;
  locked: boolean;
}) {
  // The local shortcut needs no wallet, so the connect button only stands in for
  // the batch path — and only until a wallet is actually connected.
  const needsConnect = mode === "batch" && !isConnected;
  return (
    <div className="lobby-funding-board w-full max-w-4xl">
      <div className="lobby-funding-controls flex flex-wrap items-center gap-3 mb-1">
        <span className="text-base font-bold tracking-widest text-[#00FBFF]/75">▤ AGENT FUNDING</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-base text-[#00FBFF]/70">
            <span className="tracking-widest">EACH</span>
            <input
              value={amount}
              onChange={e => onAmountChange(e.target.value)}
              disabled={funding || locked}
              className="w-24 px-2 py-1 bg-black/60 border border-[#00FBFF]/30 rounded text-right text-[#00FBFF] tabular-nums focus:outline-none focus:border-[#00FBFF]/70 disabled:opacity-40"
            />
            <span className="text-[#00FBFF]/70">ETH</span>
          </label>
          {wrongNetwork ? (
            // The arena covers the site header, so its network switcher is out of
            // reach — without this the board would just sit there disabled.
            <button
              onClick={onSwitchNetwork}
              disabled={locked}
              className="px-4 py-1.5 rounded border-2 font-dotGothic text-sm tracking-widest transition disabled:opacity-30"
              style={{ borderColor: YELLOW, color: YELLOW }}
            >
              ▶ SWITCH TO {networkName.toUpperCase()}
            </button>
          ) : !needsConnect ? (
            <button
              onClick={onFund}
              disabled={funding || locked || !canFund || required === 0n}
              className="px-4 py-1.5 rounded border-2 font-dotGothic text-sm tracking-widest transition disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: YELLOW, color: YELLOW }}
            >
              {funding ? "FUNDING…" : "▶ FUND ALL AGENTS"}
            </button>
          ) : (
            // The arena covers the site header, so this is the only way in.
            <button
              onClick={onConnect}
              disabled={locked}
              className="px-4 py-1.5 rounded border-2 font-dotGothic text-sm tracking-widest transition disabled:opacity-30"
              style={{ borderColor: CY, color: CY }}
            >
              ▶ CONNECT WALLET
            </button>
          )}
        </div>
      </div>
      <p className="mb-3 text-sm uppercase text-[#00FBFF]/60">Run starts when every agent has {fundingThreshold} ETH</p>

      {balancesUnreachable && (
        <div className="mb-3 px-3 py-2 rounded border border-[#FF5861]/40 bg-[#FF5861]/10 text-base text-[#FF5861]">
          {mode === "local"
            ? "Local chain unavailable — balances read as 0 until you start a node with `yarn chain`"
            : `${networkName} is unavailable — balances read as 0 until the RPC connection recovers`}
        </div>
      )}

      {(!canFund || balancesUnreachable) && (
        <div className="mb-3 flex flex-wrap items-center gap-3 px-3 py-2 rounded border border-[#00FBFF]/25 bg-[#00FBFF]/5 text-base text-[#00FBFF]/75">
          <span>
            {mode === "none"
              ? `Funding is unavailable on ${networkName}. Agent wallets are generated per run and their keys are discarded when it ends, so anything sent to them would be unrecoverable.`
              : !canFund && isConnected
              ? `Switch your wallet to ${networkName} to fund the agent wallets.`
              : !canFund
              ? `Connect a wallet on ${networkName} to fund the agent wallets.`
              : mode === "local"
              ? "The local chain is unavailable — start a node with `yarn chain` to continue."
              : `${networkName} is unreachable — funding will resume when the RPC connection recovers.`}
          </span>
        </div>
      )}

      <div className="lobby-funding-list rounded-lg border border-[#00FBFF]/20 bg-[#00090b]/60 divide-y divide-[#00FBFF]/10 max-h-[46vh] overflow-y-auto">
        {agents.map((a, i) => (
          <FundingRow
            key={a.id}
            agent={a}
            index={i}
            balance={a.address ? balances[a.address] : undefined}
            required={required}
            backendFunded={fundingProjection[a.id]?.funded === true}
          />
        ))}
      </div>
    </div>
  );
}

function FundingRow({
  agent,
  index,
  balance,
  required,
  backendFunded,
}: {
  agent: Agent;
  index: number;
  balance: bigint | undefined;
  required: bigint;
  backendFunded: boolean;
}) {
  const balanceStatus = fundingStatus(balance, required);
  const status: FundingStatus = backendFunded ? "funded" : balanceStatus === "funded" ? "partial" : balanceStatus;

  return (
    <div className="lobby-funding-row flex items-center gap-3 px-3 py-2 text-base">
      <span className="w-8 shrink-0 text-sm text-[#00FBFF]/55 tabular-nums">P{index + 1}</span>

      <span
        className="lobby-funding-avatar w-8 h-8 shrink-0 rounded-full overflow-hidden"
        style={{ border: `1px solid ${agent.color}` }}
      >
        {agent.address ? (
          <BlockieAvatar address={agent.address} ensImage={null} size={32} />
        ) : (
          <span className="flex h-full items-center justify-center text-xs" style={{ color: agent.color }}>
            {agent.short}
          </span>
        )}
      </span>

      <span className="lobby-funding-agent w-56 shrink-0 truncate font-bold" style={{ color: agent.color }}>
        <ModelName name={agent.model} effort={agent.effort} />
      </span>

      <span className="lobby-funding-address hidden sm:flex items-center text-[#00FBFF]/70">
        {agent.address ? (
          <Address address={agent.address} hideBlockie openLinkInNewTab size="base" />
        ) : (
          "Assigning address…"
        )}
      </span>

      <span className="lobby-funding-balance ml-auto tabular-nums text-[#00FBFF]/70">
        {formatEther(balance ?? 0n)} ETH
      </span>

      <span className="lobby-funding-status w-52 shrink-0 whitespace-nowrap text-right text-sm font-bold tracking-widest">
        {status === "funded" ? (
          <span style={{ color: GREEN }}>READY ✓</span>
        ) : status === "partial" ? (
          <span style={{ color: YELLOW }}>NEEDS FUNDS</span>
        ) : (
          <span className="lobby-blink" style={{ color: YELLOW }}>
            WAITING FOR FUNDING
          </span>
        )}
      </span>
    </div>
  );
}

function Slot({ agent, state, idle, index }: { agent: Agent; state: SlotState; idle: boolean; index: number }) {
  const ready = state === "ready";
  const joining = state === "joining";
  const active = ready || joining;

  return (
    <div
      className={`lobby-slot relative flex flex-col items-center gap-2 px-3 py-4 rounded-lg border transition-all duration-300 ${
        ready ? "lobby-slot-in" : ""
      }`}
      style={{
        borderColor: active ? `${agent.color}` : "rgba(0,251,255,0.26)",
        background: active ? `${agent.color}14` : "rgba(0,251,255,0.06)",
        boxShadow: ready ? `0 0 22px -6px ${agent.color}` : "none",
        opacity: idle ? 0.82 : active ? 1 : 0.84,
      }}
    >
      {/* slot number */}
      <span className="absolute top-1.5 left-2 text-sm text-[#00FBFF]/55 tabular-nums">P{index + 1}</span>

      {/* avatar — blockie of the agent wallet, ringed in the agent color */}
      <div
        className={`lobby-slot-avatar relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold text-2xl ${
          joining ? "lobby-pulse" : ""
        }`}
        style={{
          border: `2px solid ${active ? agent.color : "#4e6a69"}`,
          background: active ? `${agent.color}22` : "transparent",
          color: active ? agent.color : "#4e6a69",
        }}
      >
        {active ? (
          agent.address ? (
            <BlockieAvatar address={agent.address} ensImage={null} size={52} />
          ) : (
            agent.short
          )
        ) : (
          "?"
        )}
      </div>

      {/* identity — the block reaches into the card's padding so the longest model
          name plus its effort tail still holds one line on a 140px slot. */}
      <div className="lobby-slot-identity text-center min-h-[48px] flex flex-col justify-center -mx-1.5">
        {active ? (
          <>
            <div className="lobby-slot-name text-base font-bold leading-tight" style={{ color: agent.color }}>
              <ModelName name={agent.model} effort={agent.effort} />
            </div>
            <div className="lobby-slot-harness text-base text-[#00FBFF]/75 leading-tight">{agent.harness}</div>
          </>
        ) : (
          <div className="text-base text-[#00FBFF]/55 tracking-widest">{idle ? "NOT ASSIGNED" : "———"}</div>
        )}
      </div>

      {/* status pill */}
      <div className="lobby-slot-status text-sm font-bold tracking-widest">
        {ready ? (
          <span style={{ color: GREEN }}>READY ✓</span>
        ) : joining ? (
          <span className="lobby-blink" style={{ color: YELLOW }}>
            CONNECTING…
          </span>
        ) : (
          <span className="text-[#00FBFF]/25">{idle ? "NOT CONNECTED" : "WAITING"}</span>
        )}
      </div>
    </div>
  );
}

function LobbyStyles() {
  return (
    <style jsx global>{`
      .lobby-root {
        background-image: radial-gradient(circle at 50% 0%, #001a1f 0%, #000 60%);
      }
      .lobby-scanlines {
        background: repeating-linear-gradient(
          to bottom,
          rgba(0, 251, 255, 0.03) 0px,
          rgba(0, 251, 255, 0.03) 1px,
          transparent 1px,
          transparent 3px
        );
        mix-blend-mode: overlay;
      }
      .lobby-title-glow {
        text-shadow: 0 0 14px rgba(0, 251, 255, 0.5);
      }
      /* Keep the phase indicator compact while leaving a full 24px visual
         break before the event title, matching the live arena header. */
      .lobby-phase {
        margin-right: 0.5rem;
      }
      @media (max-width: 1400px), (max-height: 820px) {
        .lobby-header {
          height: 3.25rem;
          gap: 0.5rem;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }
        .lobby-phase {
          gap: 0.375rem;
          margin-right: 1rem;
          font-size: 0.875rem;
        }
        .lobby-header-title {
          font-size: 1.25rem;
          line-height: 1;
          white-space: nowrap;
        }
        .lobby-header-badges {
          display: none;
        }
        .lobby-sfx {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }
        .lobby-main {
          justify-content: flex-start;
          overflow-y: auto;
          padding: 0.75rem;
        }
        .lobby-hero {
          margin-bottom: 0.75rem;
        }
        .lobby-hero-title {
          font-size: 1.5rem;
          line-height: 1.1;
        }
        .lobby-hero-subtitle {
          margin-top: 0.25rem;
          font-size: 0.75rem;
        }
        .lobby-idle-controls {
          margin-bottom: 1rem;
          gap: 0.5rem;
        }
        .lobby-idle-controls label,
        .lobby-idle-controls > span {
          font-size: 0.875rem;
        }
        .lobby-idle-controls .lobby-cta,
        .lobby-primary-action .lobby-cta,
        .lobby-primary-action .lobby-cta-go {
          padding: 0.5rem 1.5rem;
          font-size: 0.875rem;
        }
        .lobby-progress {
          margin-bottom: 0.75rem;
          max-width: none;
        }
        .lobby-slot-grid {
          max-width: none;
          gap: 0.5rem;
        }
        .lobby-slot {
          gap: 0.375rem;
          padding: 0.625rem 0.5rem;
        }
        .lobby-slot-avatar {
          width: 2.75rem;
          height: 2.75rem;
          font-size: 1.25rem;
        }
        .lobby-slot-avatar > img {
          width: 100%;
          height: 100%;
        }
        .lobby-slot-identity {
          min-height: 2.25rem;
        }
        .lobby-slot-name,
        .lobby-slot-harness {
          font-size: 0.875rem;
        }
        .lobby-slot-status {
          font-size: 0.75rem;
        }
        .lobby-primary-action {
          margin-top: 0.75rem;
          height: 2.5rem;
        }
        .lobby-phase-note {
          margin-top: 0.5rem;
          font-size: 0.75rem;
        }
        .lobby-log {
          width: 20rem;
        }
        .lobby-log-header {
          height: 2.25rem;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
          font-size: 0.875rem;
        }
        .lobby-log-lines {
          padding: 0.5rem;
          font-size: 0.75rem;
        }
        .lobby-funding-board {
          max-width: none;
        }
        .lobby-funding-controls {
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .lobby-funding-controls > span,
        .lobby-funding-controls label {
          font-size: 0.875rem;
        }
        .lobby-funding-controls button {
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
        }
        .lobby-funding-list {
          max-height: 50vh;
        }
        .lobby-funding-row {
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }
        .lobby-funding-row > span:first-child {
          width: 1.75rem;
          font-size: 0.75rem;
        }
        .lobby-funding-avatar {
          width: 1.75rem;
          height: 1.75rem;
        }
        .lobby-funding-avatar > img {
          width: 100%;
          height: 100%;
        }
        .lobby-funding-agent {
          width: 10rem;
        }
        .lobby-funding-address {
          display: none;
        }
        .lobby-funding-balance {
          font-size: 0.75rem;
        }
        .lobby-funding-status {
          width: 12rem;
          font-size: 0.75rem;
        }
      }
      .lobby-blink {
        animation: lobbyBlink 1s steps(2, start) infinite;
      }
      @keyframes lobbyBlink {
        50% {
          opacity: 0.3;
        }
      }
      .lobby-slot-in {
        animation: lobbySlotIn 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4);
      }
      @keyframes lobbySlotIn {
        0% {
          transform: scale(0.82) translateY(8px);
          opacity: 0;
          filter: brightness(2.4);
        }
        60% {
          transform: scale(1.06);
        }
        100% {
          transform: scale(1);
          opacity: 1;
          filter: brightness(1);
        }
      }
      .lobby-pulse {
        animation: lobbyPulse 0.7s ease-in-out infinite;
      }
      @keyframes lobbyPulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(255, 190, 0, 0.5);
        }
        50% {
          box-shadow: 0 0 0 6px rgba(255, 190, 0, 0);
        }
      }
      .lobby-cta {
        box-shadow: 0 0 22px -6px rgba(0, 251, 255, 0.7);
        animation: lobbyCta 2s ease-in-out infinite;
      }
      @keyframes lobbyCta {
        0%,
        100% {
          box-shadow: 0 0 22px -6px rgba(0, 251, 255, 0.7);
        }
        50% {
          box-shadow: 0 0 30px -2px rgba(0, 251, 255, 0.9);
        }
      }
      .lobby-cta-go {
        box-shadow: 0 0 26px -4px rgba(0, 255, 156, 0.8);
        animation: lobbyCtaGo 1.3s ease-in-out infinite;
      }
      @keyframes lobbyCtaGo {
        0%,
        100% {
          transform: scale(1);
          box-shadow: 0 0 26px -4px rgba(0, 255, 156, 0.7);
        }
        50% {
          transform: scale(1.04);
          box-shadow: 0 0 38px 0px rgba(0, 255, 156, 0.95);
        }
      }
      .lobby-count {
        animation: lobbyCount 0.9s ease-out;
        text-shadow: 0 0 24px currentColor;
      }
      @keyframes lobbyCount {
        0% {
          transform: scale(2.2);
          opacity: 0;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
      .lobby-log-in {
        animation: lobbyLogIn 0.3s ease-out;
      }
      @keyframes lobbyLogIn {
        from {
          transform: translateX(-8px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `}</style>
  );
}
