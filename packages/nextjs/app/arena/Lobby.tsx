"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Agent, CHALLENGES, HARNESS_GLYPH, buildAgents } from "./mockData";

// Pre-game lobby for the Agent Arena. Everything the director sees here — the
// roster filling up, the "connecting" blips, the countdown — is a fake
// multiplayer-lobby simulation. The ONLY real side effect is the spin-up order
// fired from START MATCH (see the TODO in launchMatch).

type Phase = "idle" | "connecting" | "ready" | "launching";
type SlotState = "waiting" | "joining" | "ready";

const CY = "#00FBFF";
const GREEN = "#00ff9c";
const YELLOW = "#FFBE00";

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

export function ArenaLobby({ onLaunch }: { onLaunch: () => void }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [log, setLog] = useState<{ id: number; text: string; color: string }[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const logId = useRef(0);

  useEffect(() => setAgents(buildAgents()), []);
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
        setPhase("ready");
        pushLog("all agents connected — awaiting start", GREEN);
        [523, 659, 784, 1046].forEach((f, i) =>
          timers.current.push(setTimeout(() => beep(f, 0.16, "triangle", 0.06), i * 90)),
        );
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
          {phase === "idle" ? "STANDBY" : phase === "ready" ? "READY" : phase === "launching" ? "LAUNCHING" : "LOBBY"}
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
                : phase === "ready"
                ? "ALL AGENTS CONNECTED"
                : phase === "launching"
                ? "SPINNING UP ARENA"
                : "WAITING FOR AGENTS"}
            </div>
            <div className="mt-2 text-sm text-[#00FBFF]/55 tracking-wide">
              {phase === "idle" ? null : phase === "launching" ? (
                <span className="text-[#FFBE00] animate-pulse">provisioning agent environments…</span>
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

          {/* progress bar */}
          <div className="w-full max-w-3xl h-1.5 rounded-full bg-[#00FBFF]/10 overflow-hidden mb-8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${agents.length ? (readyCount / agents.length) * 100 : 0}%`,
                background: readyCount === agents.length && agents.length ? GREEN : CY,
                boxShadow: `0 0 12px ${readyCount === agents.length && agents.length ? GREEN : CY}`,
              }}
            />
          </div>

          {/* roster grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl">
            {agents.map((a, i) => {
              const st: SlotState = slots[a.id] || "waiting";
              return <Slot key={a.id} agent={a} state={st} idle={phase === "idle"} index={i} />;
            })}
          </div>

          {/* primary action */}
          <div className="mt-10 h-16 flex items-center justify-center">
            {phase === "connecting" && (
              <div className="text-[#00FBFF]/50 text-sm tracking-widest font-dotGothic lobby-blink">
                ● ● ● CONNECTING AGENTS ● ● ●
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
