"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Agent, CHALLENGES, FUNDING_AMOUNT_ETH, HARNESS_GLYPH } from "./mockData";
import { fundingStatus, useAgentBalances } from "./useAgentBalances";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { useTransactor } from "~~/hooks/scaffold-eth";

// Pre-game lobby for the Agent Arena. The roster filling up, the "connecting"
// blips and the countdown are a fake multiplayer-lobby simulation, but the
// funding stage is real: every agent carries a freshly generated wallet and the
// match cannot start until all of them hold enough ETH.

type Phase = "idle" | "connecting" | "funding" | "ready" | "launching";
type SlotState = "waiting" | "joining" | "ready";

const CY = "#00FBFF";
const GREEN = "#00ff9c";
const YELLOW = "#FFBE00";
const RED = "#FF5861";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
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

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function ArenaLobby({ agents, onLaunch }: { agents: Agent[]; onLaunch: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [log, setLog] = useState<{ id: number; text: string; color: string }[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [amount, setAmount] = useState(FUNDING_AMOUNT_ETH);
  const [funding, setFunding] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const logId = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const beep = useCallback((freq: number, dur?: number, type?: OscillatorType, gain?: number) => {
    const ctx = audioRef.current;
    if (!ctx || mutedRef.current) return;
    tone(ctx, freq, dur, type, gain);
  }, []);

  const pushLog = useCallback((text: string, color: string) => {
    setLog(prev => [{ id: ++logId.current, text, color }, ...prev].slice(0, 60));
  }, []);

  const readyCount = Object.values(slots).filter(s => s === "ready").length;

  // ---- funding -------------------------------------------------------------
  // Sending is deliberately restricted to a local chain: these wallets are
  // generated per run and their keys are thrown away, so anything sent on a real
  // network would be unrecoverable.
  const { chain, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  // `chain` (not `chainId`) on purpose: wagmi only resolves it for chains present
  // in wagmiConfig, so this is false unless scaffold.config targets a local chain.
  // That is the gate we want — useTransactor would throw ChainNotConfiguredError
  // on an unregistered chain, so failing closed here keeps funding unreachable
  // exactly when it could not work anyway.
  const isLocalChain = chain?.id === hardhat.id;
  const transactor = useTransactor();

  const addresses = useMemo(() => agents.map(a => a.address), [agents]);
  const fundingActive = phase === "funding" || phase === "ready" || phase === "launching";
  const {
    balances,
    isError: balancesUnreachable,
    refetch: refetchBalances,
  } = useAgentBalances(addresses, fundingActive);

  const required = useMemo(() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  }, [amount]);

  const requiredRef = useRef(required);
  requiredRef.current = required;

  const fundedCount = agents.filter(a => required > 0n && (balances[a.address] ?? 0n) >= required).length;
  const allFunded = agents.length > 0 && fundedCount === agents.length;

  const progressCount = fundingActive ? fundedCount : readyCount;
  const progressDone = agents.length > 0 && progressCount === agents.length;

  const fundAll = useCallback(async () => {
    const target = requiredRef.current;
    if (!target) return;
    setFunding(true);
    try {
      // Read balances before deciding what to send. The poll only refreshes every
      // 2s and the button re-enables the moment a run ends, so resuming inside
      // that window would see stale zeroes and double-send to funded agents.
      const fresh = await refetchBalances();
      if (fresh.isError || !fresh.data) {
        pushLog("cannot read agent balances — is the local chain up?", RED);
        return;
      }
      const current = fresh.data;
      for (const a of agents) {
        // Top up the shortfall rather than the full amount, so resuming after a
        // failure — or raising the target mid-run — never overshoots.
        const shortfall = target - (current[a.address] ?? 0n);
        if (shortfall <= 0n) continue;
        pushLog(`funding ${a.model} · ${shortAddress(a.address)}…`, YELLOW);
        try {
          // useTransactor resolves undefined (without throwing) when it has no
          // wallet client — reporting that as funded would log ten green ticks
          // for zero ETH moved.
          const hash = await transactor({ to: a.address, value: shortfall });
          if (!hash) throw new Error("no transaction hash");
          pushLog(`${a.model} funded ✓`, GREEN);
        } catch {
          // A rejection means the director stepped away from the wallet — stop
          // rather than firing the remaining confirmations at them.
          pushLog(`funding ${a.model} failed — press FUND AGENTS to resume`, RED);
          break;
        }
      }
    } finally {
      setFunding(false);
    }
  }, [agents, transactor, pushLog, refetchBalances]);

  const skipFunding = useCallback(() => {
    setPhase("ready");
    pushLog("funding skipped — demo mode, agents are unfunded", YELLOW);
  }, [pushLog]);

  // All wallets topped up: the match unlocks.
  useEffect(() => {
    if (phase !== "funding" || !allFunded) return;
    setPhase("ready");
    pushLog("all agents funded — ready to start", GREEN);
    [523, 659, 784, 1046].forEach((f, i) =>
      timers.current.push(setTimeout(() => beep(f, 0.16, "triangle", 0.06), i * 90)),
    );
  }, [phase, allFunded, beep, pushLog]);

  // First button. Resumes/creates the AudioContext (needs a user gesture) and
  // kicks off the fake connection sequence — agents trickle in one by one.
  const openLobby = useCallback(() => {
    if (!audioRef.current) {
      try {
        audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        audioRef.current = null;
      }
    }
    audioRef.current?.resume();
    setPhase("connecting");
    pushLog("director opened the arena lobby", YELLOW);

    const order = shuffle(agents);
    let t = 800;
    order.forEach(a => {
      t += 1000 + Math.random() * 1300;
      const at = t;
      timers.current.push(
        setTimeout(() => {
          setSlots(prev => ({ ...prev, [a.id]: "joining" }));
          beep(300, 0.05, "square", 0.035);
        }, at),
      );
      timers.current.push(
        setTimeout(() => {
          setSlots(prev => ({ ...prev, [a.id]: "ready" }));
          beep(660, 0.08, "square", 0.05);
          pushLog(`${a.harness} · ${a.model} joined the arena`, a.color);
        }, at + 550 + Math.random() * 450),
      );
    });

    timers.current.push(
      setTimeout(() => {
        setPhase("funding");
        pushLog("all agents connected — awaiting funding", GREEN);
        beep(784, 0.14, "triangle", 0.06);
      }, t + 1400),
    );
  }, [agents, beep, pushLog]);

  // Second button — the REAL one. Runs the launch countdown, then hands off to
  // the live arena.
  const launchMatch = useCallback(() => {
    setPhase("launching");
    pushLog("SPIN-UP: provisioning 10 agent environments…", YELLOW);

    // TODO(backend): fire the real spin-up here. This is the only non-fake
    // action in the lobby — everything above is presentation. Replace with the
    // call that provisions the 10 agent machines / sandboxes and starts the CTF
    // clock, then advance to the live arena once it acks.
    //   e.g. await fetch("/api/arena/start", { method: "POST", body: JSON.stringify({ agents }) })

    let n = 3;
    setCountdown(n);
    beep(440, 0.12, "square", 0.06);
    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        beep(440, 0.12, "square", 0.06);
      } else {
        setCountdown(0);
        beep(880, 0.3, "sawtooth", 0.07);
        clearInterval(tick);
        timers.current.push(setTimeout(onLaunch, 850));
      }
    }, 900);
    timers.current.push(tick as unknown as ReturnType<typeof setTimeout>);
  }, [beep, onLaunch, pushLog]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-[#00FBFF] font-mono overflow-hidden lobby-root">
      <div className="pointer-events-none absolute inset-0 z-[70] lobby-scanlines" />

      {/* header */}
      <div className="flex items-center gap-4 px-5 h-14 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] shrink-0">
        <span className="flex items-center gap-2 text-[#00FBFF]/70 font-bold tracking-widest text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: phase === "idle" ? "#3a4a4d" : phase === "ready" ? GREEN : YELLOW }}
          />
          {phase === "idle"
            ? "STANDBY"
            : phase === "ready"
            ? "READY"
            : phase === "launching"
            ? "LAUNCHING"
            : phase === "funding"
            ? "FUNDING"
            : "LOBBY"}
        </span>
        <div className="font-dotGothic text-xl md:text-2xl tracking-wide lobby-title-glow">
          BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENT ARENA
        </div>
        <div className="hidden lg:flex items-center gap-1 text-xs text-[#00FBFF]/50">
          <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{agents.length} AGENTS</span>
          <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{CHALLENGES.length} CHALLENGES</span>
        </div>
        <button
          onClick={() => setMuted(m => !m)}
          className="ml-auto text-xs px-2 py-1 rounded border border-[#00FBFF]/25 text-[#00FBFF]/60 hover:text-[#00FBFF] hover:border-[#00FBFF]/60 transition"
          title={muted ? "unmute lobby SFX" : "mute lobby SFX"}
        >
          {muted ? "🔇 SFX OFF" : "🔊 SFX ON"}
        </button>
      </div>

      {/* stage */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-8 relative">
          <div className="text-center mb-6">
            <div className="font-dotGothic text-3xl md:text-4xl tracking-widest lobby-title-glow">
              {phase === "idle"
                ? "GAME NOT STARTED"
                : phase === "funding"
                ? "WAITING FOR FUNDING"
                : phase === "ready"
                ? "ALL AGENTS FUNDED"
                : phase === "launching"
                ? "SPINNING UP ARENA"
                : "WAITING FOR AGENTS"}
            </div>
            <div className="mt-2 text-sm text-[#00FBFF]/55 tracking-wide">
              {phase === "idle" ? null : phase === "launching" ? (
                <span className="text-[#FFBE00] animate-pulse">provisioning agent environments…</span>
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
            <button
              onClick={openLobby}
              disabled={!agents.length}
              className="lobby-cta group mb-8 px-10 py-3 rounded-md font-dotGothic text-lg tracking-widest border-2 border-[#00FBFF] text-[#00FBFF] hover:bg-[#00FBFF] hover:text-black transition disabled:opacity-40"
            >
              ▶ OPEN LOBBY
            </button>
          )}

          {/* progress bar — connections while agents join, funding once they have */}
          <div className="w-full max-w-3xl h-1.5 rounded-full bg-[#00FBFF]/10 overflow-hidden mb-8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${agents.length ? (progressCount / agents.length) * 100 : 0}%`,
                background: progressDone ? GREEN : CY,
                boxShadow: `0 0 12px ${progressDone ? GREEN : CY}`,
              }}
            />
          </div>

          {fundingActive ? (
            <FundingBoard
              agents={agents}
              balances={balances}
              required={required}
              amount={amount}
              onAmountChange={setAmount}
              onFund={fundAll}
              onSkip={skipFunding}
              onConnect={openConnectModal}
              funding={funding}
              isConnected={isConnected}
              isLocalChain={isLocalChain}
              balancesUnreachable={balancesUnreachable}
              locked={phase !== "funding"}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl">
              {agents.map((a, i) => {
                const st: SlotState = slots[a.id] || "waiting";
                return <Slot key={a.id} agent={a} state={st} idle={phase === "idle"} index={i} />;
              })}
            </div>
          )}

          {/* primary action */}
          <div className="mt-10 h-16 flex items-center justify-center">
            {phase === "connecting" && (
              <div className="text-[#00FBFF]/50 text-sm tracking-widest font-dotGothic lobby-blink">
                ● ● ● CONNECTING AGENTS ● ● ●
              </div>
            )}
            {phase === "funding" && (
              <div className="text-[#FFBE00]/70 text-sm tracking-widest font-dotGothic lobby-blink">
                ● ● ● WAITING FOR FUNDING ● ● ●
              </div>
            )}
            {phase === "ready" && (
              <button
                onClick={launchMatch}
                className="lobby-cta-go px-12 py-3.5 rounded-md font-dotGothic text-xl tracking-widest border-2 text-black transition"
                style={{ background: GREEN, borderColor: GREEN }}
              >
                ▶ START MATCH
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
          </div>

          {phase === "ready" && (
            <div className="mt-3 text-[11px] text-[#00FBFF]/40 tracking-wide">
              START MATCH provisions the agent environments and begins the CTF clock
            </div>
          )}
          {phase === "funding" && (
            <div className="mt-3 text-[11px] text-[#00FBFF]/40 tracking-wide">
              every agent wallet must hold {amount || "0"} ETH before the match can start
            </div>
          )}
        </div>

        {/* netcode log */}
        <div className="hidden md:flex w-[320px] shrink-0 flex-col border-l border-[#00FBFF]/20 bg-[#00090b]/70">
          <div className="px-4 h-10 flex items-center text-xs font-bold tracking-widest text-[#00FBFF]/60 border-b border-[#00FBFF]/15 bg-[#001417]">
            ▤ CONNECTION LOG
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-[12px] leading-relaxed space-y-1">
            {log.length === 0 && <div className="text-[#00FBFF]/25 italic">idle · no agents connected</div>}
            {log.map(l => (
              <div key={l.id} className="lobby-log-in flex gap-2">
                <span className="text-[#00FBFF]/25 shrink-0">›</span>
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
  required,
  amount,
  onAmountChange,
  onFund,
  onSkip,
  onConnect,
  funding,
  isConnected,
  isLocalChain,
  balancesUnreachable,
  locked,
}: {
  agents: Agent[];
  balances: Record<string, bigint>;
  required: bigint;
  amount: string;
  onAmountChange: (v: string) => void;
  onFund: () => void;
  onSkip: () => void;
  onConnect?: () => void;
  funding: boolean;
  isConnected: boolean;
  isLocalChain: boolean;
  balancesUnreachable: boolean;
  locked: boolean;
}) {
  return (
    <div className="w-full max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-xs font-bold tracking-widest text-[#00FBFF]/60">▤ AGENT WALLETS</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[#00FBFF]/50">
            <span className="tracking-widest">EACH</span>
            <input
              value={amount}
              onChange={e => onAmountChange(e.target.value)}
              disabled={funding || locked}
              className="w-24 px-2 py-1 bg-black/60 border border-[#00FBFF]/30 rounded text-right text-[#00FBFF] tabular-nums focus:outline-none focus:border-[#00FBFF]/70 disabled:opacity-40"
            />
            <span className="text-[#00FBFF]/40">ETH</span>
          </label>
          {isConnected ? (
            <button
              onClick={onFund}
              disabled={funding || locked || !isLocalChain || required === 0n}
              className="px-4 py-1.5 rounded border-2 font-dotGothic text-sm tracking-widest transition disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: YELLOW, color: YELLOW }}
            >
              {funding ? "SENDING…" : "▶ FUND AGENTS"}
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

      {balancesUnreachable && (
        <div className="mb-3 px-3 py-2 rounded border border-[#FF5861]/40 bg-[#FF5861]/10 text-xs text-[#FF5861]">
          cannot reach the local chain — balances below are stale, start a node with `yarn chain`
        </div>
      )}

      {/* The skip escape has to appear whenever funding cannot complete, whether
          or not a wallet is connected: off a local chain it is impossible by
          design, and with the node unreachable the balances never reach the
          target, so without this the lobby dead-ends and the match never starts. */}
      {(!isLocalChain || balancesUnreachable) && (
        <div className="mb-3 flex flex-wrap items-center gap-3 px-3 py-2 rounded border border-[#00FBFF]/25 bg-[#00FBFF]/5 text-xs text-[#00FBFF]/60">
          <span>
            {!isLocalChain && isConnected
              ? "funding is only available on a local chain — these wallets are generated per run and their keys are discarded, so funds sent on a real network would be unrecoverable"
              : !isLocalChain
              ? "connect a wallet on a local chain to fund the agent wallets"
              : "the local chain is unreachable, so funding cannot complete — start a node with `yarn chain` or skip"}
          </span>
          {!locked && (
            <button
              onClick={onSkip}
              className="ml-auto shrink-0 px-3 py-1 rounded border border-[#00FBFF]/40 tracking-widest hover:bg-[#00FBFF]/15 transition"
            >
              SKIP FUNDING (DEMO)
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[#00FBFF]/20 bg-[#00090b]/60 divide-y divide-[#00FBFF]/10 max-h-[46vh] overflow-y-auto">
        {agents.map((a, i) => (
          <FundingRow key={a.id} agent={a} index={i} balance={balances[a.address]} required={required} />
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
}: {
  agent: Agent;
  index: number;
  balance: bigint | undefined;
  required: bigint;
}) {
  const [copied, setCopied] = useState(false);
  const status = fundingStatus(balance, required);
  const glyph = HARNESS_GLYPH[agent.harness] || "●";

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(agent.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [agent.address]);

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <span className="w-6 shrink-0 text-[10px] text-[#00FBFF]/30 tabular-nums">P{index + 1}</span>

      <span
        className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-sm"
        style={{ border: `1px solid ${agent.color}`, background: `${agent.color}22`, color: agent.color }}
      >
        {glyph}
      </span>

      <span className="w-40 shrink-0 truncate font-bold" style={{ color: agent.color }}>
        {agent.model}
      </span>

      <button
        onClick={copy}
        title="copy address"
        className="hidden sm:flex items-center gap-1.5 text-[#00FBFF]/45 hover:text-[#00FBFF] transition"
      >
        <span className="tabular-nums">{shortAddress(agent.address)}</span>
        <span className="text-[10px]">{copied ? "✓" : "⧉"}</span>
      </button>

      <span className="ml-auto tabular-nums text-[#00FBFF]/70">{formatEther(balance ?? 0n)} ETH</span>

      <span className="w-40 shrink-0 text-right text-[10px] font-bold tracking-widest">
        {status === "funded" ? (
          <span style={{ color: GREEN }}>FUNDED ✓</span>
        ) : status === "partial" ? (
          <span style={{ color: YELLOW }}>PARTIAL</span>
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
  const glyph = HARNESS_GLYPH[agent.harness] || "●";
  const active = ready || joining;

  return (
    <div
      className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-lg border transition-all duration-300 ${
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
      <span className="absolute top-1.5 left-2 text-[10px] text-[#00FBFF]/30 tabular-nums">P{index + 1}</span>

      {/* avatar — harness glyph + agent color, matching AgentBadge in the arena */}
      <div
        className={`relative w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl ${
          joining ? "lobby-pulse" : ""
        }`}
        style={{
          border: `2px solid ${active ? agent.color : "#4e6a69"}`,
          background: active ? `${agent.color}22` : "transparent",
          color: active ? agent.color : "#4e6a69",
        }}
      >
        {active ? glyph : "?"}
      </div>

      {/* identity */}
      <div className="text-center min-h-[48px] flex flex-col justify-center">
        {active ? (
          <>
            <div className="text-base font-bold leading-tight" style={{ color: agent.color }}>
              {agent.model}
            </div>
            <div className="text-sm text-[#00FBFF]/55 leading-tight">{agent.harness}</div>
          </>
        ) : (
          <div className="text-xs text-[#00FBFF]/30 tracking-widest">{idle ? "AWAITING" : "———"}</div>
        )}
      </div>

      {/* status pill */}
      <div className="text-[10px] font-bold tracking-widest">
        {ready ? (
          <span style={{ color: GREEN }}>READY ✓</span>
        ) : joining ? (
          <span className="lobby-blink" style={{ color: YELLOW }}>
            CONNECTING…
          </span>
        ) : (
          <span className="text-[#00FBFF]/25">{idle ? "OFFLINE" : "PENDING"}</span>
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
