"use client";

import { type SelectHTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ModelName } from "./ModelName";
import { SfxToggle } from "./SfxToggle";
import {
  FundingMode,
  MULTICALL3_ABI,
  MULTICALL3_ADDRESS,
  fundingMode,
  fundingThresholdEth,
  localTestClient,
} from "./funding";
import { Agent, CHALLENGES } from "./mockData";
import { fundingStatus, useAgentBalances } from "./useAgentBalances";
import { useArenaRoute } from "./useArenaRoute";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { encodeFunctionData, formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { ChevronDownIcon, PencilSquareIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Address, BlockieAvatar, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import type {
  AgentOption,
  AgentsResponse,
  HarnessId,
  RosterEffort,
  RosterEntry,
  RunState,
} from "~~/services/arena/arena-types";
import { ArenaApiError, arenaClient } from "~~/services/arena/client";
import type { FundingProjection } from "~~/services/arena/projection";
import { type DisplayContext, displayContextFrom, displayForEntrant } from "~~/services/arena/roster";
import {
  type AgentKey,
  MAX_ROSTER,
  type RosterPick,
  type RosterProblem,
  agentKey,
  agentsByKey,
  buildRoster,
  issuesToProblems,
  validateRoster,
} from "~~/services/arena/rosterBuilder";
import { playSfx, unlockSfx } from "~~/services/arena/sfx";
import { selectFunding, selectRun, selectRunError, useArenaStore } from "~~/services/arena/store";
import { useAgentSearch, useAgents, useDebouncedValue } from "~~/services/arena/useAgents";
import { useEnsureChain, useOperatorSession, useSeedSigner } from "~~/services/arena/useOperatorSession";
import { useRosterPicks } from "~~/services/arena/useRosterPicks";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

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
type RowStatus = "waiting" | "partial" | "ready";
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
  ready: "All agents funded — waiting for the go",
  running: "The run is live",
  stopping: "Stopping the run",
  finished: "Run finished",
  failed: "Run setup failed",
};

// The row tracks the money, not who noticed it first: nothing sent, something
// sent but under the target, or enough — and enough is what starts the run. The
// chain and the backend both answer that last one, a block or two apart, so
// whichever sees it first turns the row green.
function rowStatus(balance: bigint | undefined, required: bigint, backendFunded: boolean): RowStatus {
  if (backendFunded) return "ready";
  const status = fundingStatus(balance, required);
  return status === "funded" ? "ready" : status;
}

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

function idleAgents(roster: readonly RosterEntry[], context: DisplayContext): Agent[] {
  return roster.map((entrant, index) => {
    const display = displayForEntrant(entrant, { ...context, laneIndex: index });
    return {
      id: entrant.id,
      handle: display.handle,
      harness: display.harnessLabel,
      model: display.modelLabel,
      effort: display.effort,
      vendor: display.vendor,
      color: display.color,
      short: display.short,
      address: null,
      solved: [],
      status: "idle",
      statusChangedAt: null,
      tokens: 0,
      cost: null,
      usagePending: true,
      lastSolveAt: null,
      finishedAt: null,
      currentChallengeId: null,
    };
  });
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
  const agentsQuery = useAgents();
  const { picks, setPicks, extras, noteAgent, reset } = useRosterPicks();
  const roster = useMemo(() => buildRoster(picks), [picks]);
  const displayContext = useMemo(() => displayContextFrom(agentsQuery.data, extras), [agentsQuery.data, extras]);
  const [editing, setEditing] = useState<number | null>(null);
  const [serverProblems, setServerProblems] = useState<RosterProblem[]>([]);
  const localProblems = useMemo(
    () =>
      agentsQuery.data
        ? validateRoster(
            picks,
            agentsQuery.data.harnesses,
            agentsByKey(agentsQuery.data.agents),
            displayContext.known ?? {},
          )
        : [],
    [picks, displayContext, agentsQuery.data],
  );
  const problems = [...localProblems, ...serverProblems];
  const [log, setLog] = useState<{ id: number; text: string; color: string }[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [funding, setFunding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [signingSeed, setSigningSeed] = useState(false);
  const [signingInOperator, setSigningInOperator] = useState(false);
  const [stoppingRun, setStoppingRun] = useState(false);
  const [stopArmed, setStopArmed] = useState(false);
  const [stopConfirmDisabled, setStopConfirmDisabled] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("60");
  useEffect(() => setServerProblems([]), [picks, durationMinutes]);
  const [error, setError] = useState<string | null>(null);
  const [blockingRun, setBlockingRun] = useState<ActiveRunConflict | null>(null);

  const run = useArenaStore(selectRun);
  const fundingProjection = useArenaStore(selectFunding);
  const runError = useArenaStore(selectRunError);

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

  // Keep the roster visible while run creation has not yet returned any agents.
  const cards = phase === "idle" || phase === "connecting" ? idleAgents(roster, displayContext) : agents;

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
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { targetNetwork } = useTargetNetwork();
  const ensureChain = useEnsureChain();
  const fundingChainId = run?.chainId ?? targetNetwork.id;
  const fundingThreshold = fundingThresholdEth(fundingChainId);
  // What the race actually waits for. The amount below is only how much the
  // operator chooses to send — a wallet stops blocking the run when it clears
  // this bar, so this is the one the board reports against.
  const thresholdWei = useMemo(() => parseEther(fundingThreshold), [fundingThreshold]);
  const [amount, setAmount] = useState(fundingThreshold);
  const amountEdited = useRef(false);
  const mode = fundingMode(fundingChainId);
  const walletReady = mode === "local" || isConnected;
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

  // Counted off the chain as well as the backend: the operator sends one
  // transaction and then watches this number, so it has to move when the money
  // lands, not when the backend gets around to saying so.
  const fundedCount = cards.filter(
    agent =>
      rowStatus(
        agent.address ? balances[agent.address] : undefined,
        thresholdWei,
        fundingProjection[agent.id]?.funded === true,
      ) === "ready",
  ).length;
  const progressCount = fundingActive ? fundedCount : readyCount;
  const progressDone = cards.length > 0 && progressCount === cards.length;

  const fundAll = useCallback(async () => {
    const target = requiredRef.current;
    if (!target || mode === "none") return;
    setFunding(true);
    try {
      // Local funding goes through the test client, never the wallet.
      if (mode === "batch") {
        try {
          await ensureChain(fundingChainId);
        } catch (cause) {
          pushLog(cause instanceof Error ? cause.message : "Could not switch network", RED);
          return;
        }
      }
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
          // The wallet client this render captured still points at the chain
          // the wallet was on before ensureChain switched it, and viem refuses
          // to send from a client whose chain disagrees with the wallet's.
          const walletClient = await getWalletClient(wagmiConfig, { chainId: fundingChainId });
          // useTransactor resolves undefined (without throwing) when it has no
          // wallet client — reporting that as funded would log a green tick for
          // zero ETH moved.
          const hash = await transactor(() =>
            walletClient.sendTransaction({
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
            }),
          );
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
  }, [agents, amount, ensureChain, fundingChainId, mode, targetNetwork, transactor, pushLog, refetchBalances]);

  const openLobby = useCallback(async () => {
    setServerProblems([]);
    setEditing(null);
    if (agentsQuery.isPending || agentsQuery.isError || localProblems.length || !roster.length) return;
    unlockSfx();
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
        roster: [...roster],
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
      if (!createdRunId && cause instanceof ArenaApiError && cause.issues.length) {
        setServerProblems(issuesToProblems(cause.issues));
        return;
      }
      const message = cause instanceof Error ? cause.message : "Could not start the arena";
      setError(message);
      pushLog(message, RED);
    } finally {
      setStarting(false);
    }
  }, [durationMinutes, operator, pushLog, route, agentsQuery.isPending, agentsQuery.isError, localProblems, roster]);

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

  // The race starts when the director says so, not when the last wallet lands.
  // The backend parks a funded run at `ready` for exactly this call.
  const startRace = useCallback(async () => {
    if (!run || run.state !== "ready" || launching) return;
    setLaunching(true);
    setError(null);
    setBlockingRun(null);
    const hadAuth = operator.authenticated;
    try {
      if (!hadAuth) await operator.signIn();
      // Claiming the run here is what earns the 3-2-1: a lobby reopened on a
      // parked run never went through openLobby, and this is still its start.
      launchedHere.current = run.id;
      const started = await arenaClient.startRun(run.id);
      useArenaStore.getState().syncSnapshot(started);
    } catch (cause) {
      // A start that failed is not ours to count down if another lobby lands it.
      launchedHere.current = null;
      // A 401 out of signIn means the wallet isn't allowed in — only a session
      // that was authenticated going in gets the expiry copy.
      if (hadAuth && cause instanceof ArenaApiError && cause.status === 401) {
        operator.invalidate();
        setError("operator session expired — sign in again");
        pushLog("operator session expired — sign in again", RED);
      } else {
        const message = cause instanceof Error ? cause.message : "Could not start the race";
        setError(message);
        pushLog(message, RED);
      }
    } finally {
      setLaunching(false);
    }
  }, [launching, operator, pushLog, run]);

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
    playSfx("countdown");
    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        playSfx("countdown");
      } else if (n === 0) {
        setCountdown(0);
        playSfx("launch");
      } else {
        clearInterval(tick);
        onLaunch();
      }
    }, 900);
    return () => clearInterval(tick);
  }, [onLaunch, phase, runId]);

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
          <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{cards.length} AGENTS</span>
          <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{CHALLENGES.length} CHALLENGES</span>
        </div>
        <SfxToggle className="lobby-sfx ml-auto" />
        <RainbowKitCustomConnectButton />
      </div>

      {/* stage */}
      <div className="lobby-stage flex-1 min-h-0 flex">
        <div className="lobby-main flex-1 min-h-0 flex flex-col items-center justify-start overflow-y-auto px-6 py-8 relative">
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
                  <span className="text-[#00FBFF]/40"> / {cards.length}</span> agents funded
                  {phase === "funding" && <span className="lobby-blink"> · waiting…</span>}
                </span>
              ) : (
                <span>
                  <span className="text-[#00FBFF] font-bold tabular-nums">{readyCount}</span>
                  <span className="text-[#00FBFF]/40"> / {cards.length}</span> agents connected
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
                  disabled={
                    !roster.length ||
                    agentsQuery.isPending ||
                    agentsQuery.isError ||
                    localProblems.length > 0 ||
                    !operator.sessionLoaded ||
                    !operator.configured ||
                    starting
                  }
                  className="lobby-cta group px-10 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#00FBFF] text-[#00FBFF] hover:bg-[#00FBFF] hover:text-black transition disabled:opacity-40"
                >
                  {starting ? "CREATING RUN…" : operator.authenticated ? "▶ CREATE RUN" : "▶ SIGN IN & CREATE RUN"}
                </button>
              )}
              {agentsQuery.isPending && <span role="status">Loading agents…</span>}
              {agentsQuery.isError && (
                <div role="alert">
                  Could not load agents{" "}
                  <button className={PICKER_BUTTON} onClick={() => agentsQuery.refetch()}>
                    RETRY
                  </button>
                </div>
              )}
              {!operator.sessionLoaded ? (
                <span className="text-base text-[#FFBE00]/90">Connecting…</span>
              ) : !operator.configured ? (
                <span className="text-base text-[#FFBE00]/90">Operator login is unavailable</span>
              ) : null}
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

          {phase === "idle" && problems.length > 0 && (
            <div
              role="alert"
              className="mb-4 w-full max-w-4xl rounded border border-[#FF5861]/40 bg-[#FF5861]/10 px-3 py-2 text-base text-[#FF5861]"
            >
              {problems.map((problem, index) => (
                <div key={index}>
                  {serverProblems.includes(problem) && problem.index !== null ? `Slot ${problem.index + 1}: ` : ""}
                  {problem.message}
                </div>
              ))}
            </div>
          )}
          {phase === "idle" && (
            <div className="mb-3 w-full max-w-4xl flex justify-end">
              <button
                className={PICKER_BUTTON}
                onClick={() => {
                  setEditing(null);
                  reset();
                }}
              >
                RESET TO DEFAULT
              </button>
            </div>
          )}

          {/* progress bar — connections while agents join, funding once they have */}
          <div className="lobby-progress w-full max-w-3xl h-1.5 rounded-full bg-[#00FBFF]/10 overflow-hidden mb-8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${cards.length ? (progressCount / cards.length) * 100 : 0}%`,
                background: progressDone ? GREEN : CY,
                boxShadow: `0 0 12px ${progressDone ? GREEN : CY}`,
              }}
            />
          </div>

          {phase === "preparing" || phase === "funding" || phase === "ready" ? (
            <FundingBoard
              agents={cards}
              balances={balances}
              fundingProjection={fundingProjection}
              required={required}
              amount={amount}
              thresholdWei={thresholdWei}
              onAmountChange={handleAmountChange}
              onFund={fundAll}
              onConnect={openConnectModal}
              funding={funding}
              isConnected={isConnected}
              mode={mode}
              canFund={canFund}
              networkName={fundingChainId === 31337 ? "Localhost" : targetNetwork.name}
              balancesUnreachable={balancesUnreachable}
              locked={phase !== "funding"}
            />
          ) : (
            <div className="lobby-slot-grid grid auto-rows-fr grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl">
              {cards.map((a, i) => {
                const st: SlotState = run?.entrants.some(entrant => entrant.id === a.id) ? "ready" : "waiting";
                return phase === "idle" ? (
                  <div
                    key={a.id}
                    className={`relative h-full min-w-0 rounded-lg ${
                      problems.some(problem => problem.index === i) ? "outline outline-2 outline-[#FF5861]" : ""
                    }`}
                  >
                    <Slot agent={a} state={st} idle index={i} />
                    <button
                      type="button"
                      className="absolute top-1.5 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#00FBFF]/40 bg-black/70 text-[#00FBFF] transition hover:border-[#00FBFF] hover:bg-[#00FBFF]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FBFF] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40"
                      disabled={!agentsQuery.data}
                      aria-label={`Edit agent in slot ${i + 1}`}
                      title="Edit agent"
                      onClick={event => {
                        event.currentTarget.focus();
                        setEditing(i);
                      }}
                    >
                      <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <Slot key={a.id} agent={a} state={st} idle={false} index={i} />
                );
              })}
              {phase === "idle" && picks.length < MAX_ROSTER && (
                <button
                  className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#00FBFF]/40 font-dotGothic tracking-widest text-[#00FBFF] hover:border-[#00FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FBFF] disabled:opacity-40"
                  aria-label="Add agent"
                  disabled={!agentsQuery.data}
                  onClick={event => {
                    event.currentTarget.focus();
                    setEditing(picks.length);
                  }}
                >
                  <PlusIcon className="h-6 w-6" aria-hidden="true" />
                  ADD AGENT
                </button>
              )}
            </div>
          )}
          {phase === "idle" && editing !== null && agentsQuery.data && (
            <AgentEditor
              key={editing}
              index={editing}
              pick={picks[editing]}
              data={agentsQuery.data}
              known={displayContext.known ?? {}}
              onCancel={() => setEditing(null)}
              onRemove={
                editing < picks.length && picks.length > 1
                  ? () => {
                      setPicks(picks.filter((_, index) => index !== editing));
                      setEditing(null);
                    }
                  : undefined
              }
              onConfirm={(pick, option) => {
                noteAgent(option);
                setPicks(
                  editing === picks.length
                    ? [...picks, pick]
                    : picks.map((previous, index) => (index === editing ? pick : previous)),
                );
                setEditing(null);
              }}
            />
          )}

          {/* The runs left behind, right under the agent slots. Without this the
              arena is only ever a new race: a finished run walks out of reach the
              moment its URL goes. */}
          {phase === "idle" && (
            <Link
              href="/arena/runs"
              className="mt-6 text-xs font-bold tracking-widest text-[#00FBFF]/50 transition hover:text-[#00FBFF]"
            >
              PREVIOUS RUNS ▸
            </Link>
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
              <button
                onClick={() => {
                  if (needsWallet) openConnectModal?.();
                  else void startRace();
                }}
                disabled={
                  launching || !operator.sessionLoaded || (needsWallet ? !openConnectModal : !operator.configured)
                }
                className="lobby-cta px-10 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#00ff9c] text-[#00ff9c] hover:bg-[#00ff9c] hover:text-black transition disabled:opacity-40"
              >
                {launching
                  ? "STARTING…"
                  : operator.authenticated
                  ? "▶ START RACE"
                  : needsWallet
                  ? "▶ CONNECT & START RACE"
                  : "▶ SIGN IN & START RACE"}
              </button>
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
              Every agent wallet is funded. The race starts when you say go.
            </div>
          )}
          {phase === "funding" && (
            <div className="lobby-phase-note mt-3 text-base text-[#00FBFF]/70 tracking-wide">
              The start button unlocks when every agent wallet is funded.
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
  thresholdWei,
  onAmountChange,
  onFund,
  onConnect,
  funding,
  isConnected,
  mode,
  canFund,
  networkName,
  balancesUnreachable,
  locked,
}: {
  agents: Agent[];
  balances: Record<string, bigint>;
  fundingProjection: Record<string, FundingProjection>;
  required: bigint;
  amount: string;
  thresholdWei: bigint;
  onAmountChange: (v: string) => void;
  onFund: () => void;
  onConnect?: () => void;
  funding: boolean;
  isConnected: boolean;
  mode: FundingMode;
  canFund: boolean;
  networkName: string;
  balancesUnreachable: boolean;
  locked: boolean;
}) {
  // The local shortcut needs no wallet, so the connect button only stands in for
  // the batch path — and only until a wallet is actually connected.
  const needsConnect = mode === "batch" && !isConnected;
  // Funding under the threshold is legal and does nothing: the wallets fill up,
  // the rows stay yellow, and the race never leaves the gate. The line that
  // names the threshold turns yellow too rather than let that read as a bug.
  const belowThreshold = required < thresholdWei;
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
          {!needsConnect ? (
            <button
              onClick={onFund}
              disabled={funding || locked || !canFund || required <= 0n}
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
      <p
        className="mb-3 text-sm uppercase transition-colors"
        style={{ color: belowThreshold ? YELLOW : "rgba(0, 251, 255, 0.6)" }}
      >
        Start unlocks when every agent has {formatEther(thresholdWei)} ETH
      </p>

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
            thresholdWei={thresholdWei}
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
  thresholdWei,
  backendFunded,
}: {
  agent: Agent;
  index: number;
  balance: bigint | undefined;
  thresholdWei: bigint;
  backendFunded: boolean;
}) {
  const status = rowStatus(balance, thresholdWei, backendFunded);

  return (
    <div
      className="lobby-funding-row flex items-center gap-3 px-3 py-2 text-base transition-colors"
      style={status === "ready" ? { background: `${GREEN}12`, boxShadow: `inset 3px 0 0 ${GREEN}` } : undefined}
    >
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

      <span className="lobby-funding-status min-w-52 shrink-0 whitespace-nowrap text-right text-sm font-bold tracking-widest">
        {status === "ready" ? (
          <span style={{ color: GREEN }}>READY ✓</span>
        ) : status === "partial" ? (
          <span style={{ color: YELLOW }}>NEEDS {formatEther(thresholdWei - (balance ?? 0n))} MORE</span>
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
  const active = idle || ready || joining;

  return (
    <div
      className={`lobby-slot relative flex h-full flex-col items-center justify-between gap-2 px-3 py-4 rounded-lg border transition-all duration-300 ${
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

      {/* Reserve space for two model lines and the harness in every phase. */}
      <div className="lobby-slot-identity text-center h-[64px] shrink-0 flex flex-col justify-center -mx-1.5">
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
      .lobby-slot-name {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
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

const PICKER_BUTTON =
  "rounded border border-[#00FBFF]/30 px-3 py-1 font-dotGothic text-sm tracking-widest hover:border-[#00FBFF] hover:bg-[#00FBFF] hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00FBFF] disabled:opacity-40";
const PICKER_INPUT =
  "w-full rounded border border-[#00FBFF]/30 bg-black/60 px-2 py-1 text-[#00FBFF] focus:border-[#00FBFF] focus:outline-none";
// One line under the modal heading. Kept here so the wording is a one-line change.
const EDITOR_HINT = "Effort levels depend on the harness and model.";

function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...props} className={`${PICKER_INPUT} appearance-none pr-9`} />
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00FBFF]"
      />
    </span>
  );
}

function AgentEditor({
  index,
  pick,
  data,
  known,
  onCancel,
  onRemove,
  onConfirm,
}: {
  index: number;
  pick?: RosterPick;
  data: AgentsResponse;
  known: Record<AgentKey, AgentOption>;
  onCancel: () => void;
  onRemove?: () => void;
  onConfirm: (pick: RosterPick, agent: AgentOption) => void;
}) {
  const [harness, setHarness] = useState<HarnessId>(pick?.harness ?? data.harnesses[0]?.id ?? "codex");
  const [selected, setSelected] = useState<AgentOption | undefined>(() =>
    pick ? known[agentKey(pick.harness, pick.model)] : undefined,
  );
  const [effort, setEffort] = useState<RosterEffort | "">(pick?.effort ?? "");
  const [query, setQuery] = useState(selected?.label ?? "");
  const filtering = query.trim().length >= 2 && query.trim() !== selected?.label.trim();
  const debouncedQuery = useDebouncedValue(filtering ? query.trim() : "", 250);
  const search = useAgentSearch(harness, filtering ? debouncedQuery : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const customModels = data.harnesses.find(item => item.id === harness)?.customModels;
  const curated = data.agents.filter(agent => agent.harness === harness);
  const waiting = filtering && (debouncedQuery !== query.trim() || search.isFetching || search.isPlaceholderData);
  const unavailable = filtering && search.isError;
  const options = (filtering && !unavailable ? (waiting ? [] : search.data ?? []) : curated).filter(
    agent =>
      agent.harness === harness &&
      (customModels || curated.some(item => item.model === agent.model)) &&
      (!unavailable ||
        [agent.label, agent.vendor, agent.model].some(value =>
          value.toLowerCase().includes(query.trim().toLowerCase()),
        )),
  );
  const selectedIndex = options.findIndex(option => option.model === selected?.model);
  const choose = (option: AgentOption) => {
    setSelected(option);
    setEffort(option.efforts.includes("high") ? "high" : option.efforts[option.efforts.length - 1]);
    setQuery(option.label);
    setOpen(false);
  };
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const openerLabel = opener?.getAttribute("aria-label");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the panel itself, not the model field: focusing the field would select
    // its text and the modal would open with a highlighted model name.
    panel.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      // Roster changes can replace the card that opened the dialog.
      const target = opener?.isConnected
        ? opener
        : document.querySelector<HTMLElement>(`button[aria-label="${openerLabel}"]`) ??
          document.querySelector<HTMLElement>(`button[aria-label="Edit agent in slot ${index + 1}"]`) ??
          document.querySelector<HTMLElement>('button[aria-label="Add agent"]');
      target?.focus();
    };
  }, [index]);
  useEffect(() => {
    setActive(open && !filtering ? Math.max(0, selectedIndex) : 0);
  }, [query, harness, search.data, open, filtering, selectedIndex]);
  useEffect(() => {
    if (open) document.getElementById(`agent-model-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  return (
    <div
      className="fixed inset-0 z-[100] flex overflow-y-auto bg-black/70 p-4 text-[#00FBFF] backdrop-blur-sm"
      onClick={event => {
        if (event.target === event.currentTarget) onCancel();
      }}
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
        if (event.key === "Tab") {
          const focusable = panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
          );
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-editor-heading"
        className="relative m-auto w-full max-w-[40rem] shrink-0 overflow-visible rounded-lg border border-[#00FBFF]/40 bg-[#001014] p-5 outline-none sm:p-6"
      >
        <button
          type="button"
          className={`${PICKER_BUTTON} absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full p-0`}
          aria-label="Close"
          title="Close"
          onClick={onCancel}
        >
          <XMarkIcon className="h-4 w-4 shrink-0" />
        </button>
        <h2 id="agent-editor-heading" className="pr-10 font-dotGothic text-lg tracking-widest">
          {pick ? `EDIT SLOT ${index + 1}` : "ADD AGENT"}
        </h2>
        <p className="mt-2 mb-5 pr-10 text-sm text-[#00FBFF]/60">{EDITOR_HINT}</p>
        <div className="grid gap-4">
          <label className="min-w-0">
            Harness
            <SelectField
              value={harness}
              onChange={event => {
                setHarness(event.target.value as HarnessId);
                setSelected(undefined);
                setEffort("");
                setQuery("");
                setOpen(false);
              }}
            >
              {data.harnesses.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </SelectField>
          </label>
          <div className="min-w-0">
            <label htmlFor="agent-model-input">Model</label>
            <div className="relative">
              <input
                ref={input}
                id="agent-model-input"
                className={`${PICKER_INPUT} pr-9`}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls="agent-model-options"
                aria-activedescendant={open && options[active] ? `agent-model-option-${active}` : undefined}
                value={query}
                placeholder="Choose a model"
                onFocus={event => {
                  if (selected) event.currentTarget.select();
                }}
                onClick={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onChange={event => {
                  setQuery(event.target.value);
                  if (event.target.value !== selected?.label) {
                    setSelected(undefined);
                    setEffort("");
                  }
                  setOpen(true);
                }}
                onKeyDown={event => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setOpen(true);
                    setActive(previous =>
                      options.length
                        ? (previous + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length
                        : 0,
                    );
                  }
                  if (event.key === "Enter" && open) {
                    event.preventDefault();
                    if (options[active]) choose(options[active]);
                  }
                  if (event.key === "Escape" && open) {
                    event.preventDefault();
                    setOpen(false);
                    event.stopPropagation();
                  }
                }}
              />
              <button
                type="button"
                className="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[#00FBFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00FBFF]"
                aria-label="Show models"
                tabIndex={-1}
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  setOpen(previous => !previous);
                  // Focus the field for keyboard use, but put the caret at the end instead
                  // of selecting the name: the chevron opens the list, it does not start a search.
                  const field = input.current;
                  field?.focus();
                  field?.setSelectionRange(field.value.length, field.value.length);
                }}
              >
                <ChevronDownIcon className="h-4 w-4 shrink-0" />
              </button>
              {/* The list floats so closing it on blur cannot move the clicked control. */}
              {open && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 border border-[#00FBFF]/30 bg-black">
                  {waiting && (
                    <div role="status" className="p-2 text-sm">
                      Searching agents…
                    </div>
                  )}
                  {unavailable && (
                    <div role="alert" className="p-2 text-sm text-[#FFBE00]">
                      {customModels
                        ? "OpenRouter search is unavailable, pick a listed model"
                        : "Search is unavailable, showing listed models"}
                    </div>
                  )}
                  {!waiting && !options.length && <div className="p-2 text-sm">No matching agents</div>}
                  <ul id="agent-model-options" role="listbox" aria-label="Models" className="max-h-64 overflow-y-auto">
                    {options.map((option, optionIndex) => (
                      <li
                        key={agentKey(option.harness, option.model)}
                        id={`agent-model-option-${optionIndex}`}
                        role="option"
                        aria-selected={active === optionIndex}
                        onMouseDown={event => event.preventDefault()}
                        onMouseEnter={() => setActive(optionIndex)}
                        onClick={() => choose(option)}
                        className={`cursor-pointer break-words px-3 py-2 ${
                          active === optionIndex ? "bg-[#00FBFF]/15" : ""
                        }`}
                      >
                        <span>{option.label}</span> <span className="text-sm text-[#00FBFF]/70">{option.vendor}</span>
                        <span className="block text-xs text-[#00FBFF]/70">{option.model}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {customModels && <p className="my-1 text-xs text-[#00FBFF]/70">type to search OpenRouter models</p>}
          </div>
          <label className="min-w-0">
            Effort
            <SelectField
              value={effort}
              disabled={!selected}
              onChange={event => setEffort(event.target.value as RosterEffort)}
            >
              <option value="" disabled>
                Choose effort
              </option>
              {selected?.efforts.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectField>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {onRemove && (
            <button className={`${PICKER_BUTTON} mr-auto`} onClick={onRemove}>
              REMOVE FROM ROSTER
            </button>
          )}
          <button className={PICKER_BUTTON} onClick={onCancel}>
            CANCEL
          </button>
          <button
            className={PICKER_BUTTON}
            disabled={!selected || !effort || !selected.efforts.includes(effort)}
            onClick={() => {
              if (selected && effort) onConfirm({ harness, model: selected.model, effort }, selected);
            }}
          >
            {pick ? "CONFIRM" : "ADD TO ROSTER"}
          </button>
        </div>
      </div>
    </div>
  );
}
