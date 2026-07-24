"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArenaLobby } from "./Lobby";
import {
  AGENT_COUNT,
  Agent,
  CHALLENGES,
  CHAT_LINES,
  CHAT_OPENERS_DIRECTED,
  CHAT_REPLIES,
  Challenge,
  DIFFICULTY_COLOR,
  DIRECTOR_REACTIONS,
  HARNESS_GLYPH,
  SKILLS,
  buildAgents,
  makeLine,
  rollPreview,
  seedConsole,
} from "./mockData";

export const dynamic = "force-dynamic";

type ConsoleLine = { kind: string; text: string; id: number };
type FeedItem = {
  id: number;
  type: "flag" | "skill" | "chat" | "join" | "stuck";
  agentId: string;
  color: string;
  text: string;
};
type ChatMsg = {
  id: number;
  fromId: string;
  fromHandle: string;
  color: string;
  text: string;
  director?: boolean;
};
type Toast = { id: number; type: "flag" | "skill"; title: string; sub: string; color: string };

let uid = 0;
const nid = () => ++uid;
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// Simulate one line of agent-to-agent banter: a threaded reply to the last
// speaker, a directed opener, or a standalone quip.
function genAgentChat(list: Agent[], last: Agent | null): { msg: Omit<ChatMsg, "id">; speaker: Agent } {
  const speaker = pick(list);
  const others = list.filter(a => a.id !== speaker.id);
  const wrap = (text: string) => ({
    msg: { fromId: speaker.id, fromHandle: speaker.handle, color: speaker.color, text },
    speaker,
  });
  if (last && last.id !== speaker.id && Math.random() < 0.5) {
    return wrap(pick(CHAT_REPLIES).replace("{t}", last.handle));
  }
  if (others.length && Math.random() < 0.55) {
    return wrap(pick(CHAT_OPENERS_DIRECTED).replace("{t}", pick(others).handle));
  }
  return wrap(pick(CHAT_LINES));
}

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const rankAgents = (agents: Agent[]) =>
  [...agents].sort((a, b) => b.solved.length - a.solved.length || a.cost - b.cost);

export default function ArenaPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [focusedId, setFocusedId] = useState<string>("agent-0");
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flashes, setFlashes] = useState<string[]>([]);
  const [openChallenge, setOpenChallenge] = useState<number | null>(null);
  const [clock, setClock] = useState(4931);
  const [mounted, setMounted] = useState(false);
  const [stageMode, setStageMode] = useState<"overview" | "focus">("overview");
  const [overviewTab, setOverviewTab] = useState<"race" | "grid" | "stats">("race");
  const [statsSort, setStatsSort] = useState<"solved" | "cost" | "eff">("solved");
  // "lobby" = pre-game roster / connection screen, "live" = the running arena.
  const [phase, setPhase] = useState<"lobby" | "live">("lobby");
  // Seed on the client only — buildAgents() uses Math.random(), so running it
  // during SSR would hand the client a different roster than the server rendered.
  useEffect(() => {
    setAgents(buildAgents());
    setMounted(true);
  }, []);

  const agentsRef = useRef(agents);
  const focusRef = useRef(focusedId);
  const lastSpeakerRef = useRef<Agent | null>(null);
  agentsRef.current = agents;
  focusRef.current = focusedId;

  const goFocus = useCallback((id: string) => {
    setFocusedId(id);
    setStageMode("focus");
  }, []);
  const goWideShot = useCallback((t: OverviewTab) => {
    setOverviewTab(t);
    setStageMode("overview");
  }, []);

  const focused = useMemo(() => agents.find(a => a.id === focusedId)!, [agents, focusedId]);
  const ranked = useMemo(() => rankAgents(agents), [agents]);
  const totalSolved = useMemo(() => agents.reduce((n, a) => n + a.solved.length, 0), [agents]);
  const raceIsStage = stageMode === "overview" && overviewTab === "race";

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = nid();
    setToasts(prev => [...prev, { ...t, id }].slice(-3));
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 5200);
  }, []);

  const pushFeed = useCallback((f: Omit<FeedItem, "id">) => {
    setFeed(prev => [{ ...f, id: nid() }, ...prev].slice(0, 40));
  }, []);

  const pushChat = useCallback((m: Omit<ChatMsg, "id">) => {
    setChat(prev => [...prev, { ...m, id: nid() }].slice(-60));
  }, []);

  // A just-captured flag lights up its cell on the race track for a beat.
  const pushFlash = useCallback((key: string) => {
    setFlashes(prev => [...prev, key]);
    setTimeout(() => setFlashes(prev => prev.filter(k => k !== key)), 3200);
  }, []);

  // Director/streamer broadcasts to the arena; a couple of agents react shortly after.
  const sendDirector = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      pushChat({ fromId: "director", fromHandle: "DIRECTOR", color: "#FFBE00", text: clean, director: true });
      const reactors = [...agentsRef.current]
        .sort(() => Math.random() - 0.5)
        .slice(0, 1 + Math.floor(Math.random() * 2));
      reactors.forEach((a, i) => {
        setTimeout(() => {
          pushChat({ fromId: a.id, fromHandle: a.handle, color: a.color, text: pick(DIRECTOR_REACTIONS) });
        }, 700 + i * 900 + Math.random() * 600);
      });
    },
    [pushChat],
  );

  // Reseed the observer console whenever focus changes.
  useEffect(() => {
    const a = agentsRef.current.find(x => x.id === focusedId);
    if (!a) return;
    setLines(seedConsole(a).map(l => ({ ...l, id: nid() })));
  }, [focusedId]);

  // LIVE clock.
  useEffect(() => {
    const t = setInterval(() => setClock(c => c + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Master simulation loop.
  useEffect(() => {
    let tick = 0;
    const t = setInterval(() => {
      tick++;
      const list = agentsRef.current;

      // stream a console line for the focused agent
      const foc = list.find(a => a.id === focusRef.current);
      if (foc) {
        const tag = CHALLENGES[foc.current - 1]?.tag || "default";
        const line = makeLine(foc, tag);
        setLines(prev => [...prev, { ...line, id: nid() }].slice(-70));
        if (line.kind === "skill") {
          pushFeed({ type: "skill", agentId: foc.id, color: foc.color, text: `${foc.handle} ${line.text}` });
        }
      }

      // token / cost burn + rolling mini-terminal preview for busy agents
      setAgents(prev =>
        prev.map(a =>
          a.status === "idle"
            ? a
            : {
                ...a,
                tokens: a.tokens + Math.floor(Math.random() * 9000),
                cost: a.cost + Math.random() * 0.06,
                preview:
                  Math.random() < 0.55
                    ? rollPreview(a.preview, CHALLENGES[a.current - 1]?.tag || "default")
                    : a.preview,
              },
        ),
      );

      // random skill-load announcement from a non-focused agent
      if (tick % 4 === 0) {
        const a = list[Math.floor(Math.random() * list.length)];
        if (a && a.id !== focusRef.current) {
          const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
          pushToast({ type: "skill", title: `${a.handle}`, sub: `loaded skill » ${skill}`, color: a.color });
          pushFeed({ type: "skill", agentId: a.id, color: a.color, text: `${a.handle} loaded skill » ${skill}` });
        }
      }

      // agent-to-agent chat — conversational, lands in the dedicated chat panel
      if (tick % 3 === 0) {
        const { msg, speaker } = genAgentChat(list, lastSpeakerRef.current);
        pushChat(msg);
        lastSpeakerRef.current = speaker;
      }

      // FLAG CAPTURE — a busy agent solves its current challenge
      if (tick % 6 === 0) {
        const candidates = list.filter(a => a.solved.length < 12 && a.status !== "idle");
        const a = candidates[Math.floor(Math.random() * candidates.length)];
        if (a) {
          const ch = CHALLENGES[a.current - 1];
          setAgents(prev =>
            prev.map(x =>
              x.id === a.id
                ? {
                    ...x,
                    solved: x.solved.includes(a.current) ? x.solved : [...x.solved, a.current],
                    current: Math.min(x.current + 1, 12),
                    status: "exploiting",
                  }
                : x,
            ),
          );
          pushFlash(`${a.id}:${a.current}`);
          pushToast({
            type: "flag",
            title: `🏁 ${a.handle}`,
            sub: `captured flag · #${ch.id} ${ch.name}`,
            color: a.color,
          });
          pushFeed({
            type: "flag",
            agentId: a.id,
            color: a.color,
            text: `${a.handle} captured Challenge ${a.current} · ${ch.name}`,
          });
        }
      }
    }, 950);
    return () => clearInterval(t);
  }, [pushFeed, pushToast, pushChat, pushFlash]);

  if (!mounted || !focused) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-[#00FBFF] font-dotGothic text-2xl tracking-widest">
        <span className="animate-pulse">◆ LOADING AGENT ARENA…</span>
      </div>
    );
  }

  if (phase === "lobby") {
    return <ArenaLobby onLaunch={() => setPhase("live")} />;
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-[#00FBFF] font-mono overflow-hidden arena-root">
      <Scanlines />
      <TopBar clock={clock} totalSolved={totalSolved} />

      <div className="flex flex-1 min-h-0">
        {/* MAIN STAGE */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-[#00FBFF]/20">
          <div className="flex-1 min-h-0 relative p-4">
            <div className="h-full flex flex-col border border-[#00FBFF]/25 rounded-lg bg-[#020a0c]/80 overflow-hidden shadow-[0_0_40px_-12px_rgba(0,251,255,0.4)]">
              <StageTabs tab={overviewTab} onTab={goWideShot} stageMode={stageMode} />
              {stageMode === "focus" ? (
                <FocusStage focused={focused} lines={lines} />
              ) : (
                <OverviewStage
                  ranked={ranked}
                  tab={overviewTab}
                  statsSort={statsSort}
                  setStatsSort={setStatsSort}
                  onPick={goFocus}
                  flashes={flashes}
                />
              )}
            </div>
          </div>
          <div className="h-52 shrink-0 flex border-t border-[#00FBFF]/20">
            <FeedBar feed={feed} />
            <AgentChat chat={chat} onSend={sendDirector} />
          </div>
        </div>

        {/* RIGHT COLUMN — the race track already ranks everyone, so the board stands alone there */}
        <div className="w-[380px] flex flex-col min-h-0">
          {!raceIsStage && <Leaderboard ranked={ranked} focusedId={focusedId} onPick={goFocus} />}
          <ChallengeBoard agents={agents} focused={focused} expanded={raceIsStage} onOpen={setOpenChallenge} />
        </div>
      </div>

      {openChallenge !== null && (
        <ChallengeDetails
          challenge={CHALLENGES[openChallenge - 1]}
          agents={agents}
          onClose={() => setOpenChallenge(null)}
          onPickAgent={goFocus}
        />
      )}

      {/* the race track already flashes every capture, so toasts would only double up there */}
      {!raceIsStage && <Toasts toasts={toasts} />}
      <ArenaStyles />
    </div>
  );
}

/* ------------------------------------------------------------------ TopBar */

function TopBar({ clock, totalSolved }: { clock: number; totalSolved: number }) {
  return (
    <div className="flex items-center gap-4 px-5 h-14 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] shrink-0">
      <span className="flex items-center gap-2 text-[#FF5861] font-bold tracking-widest">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5861] live-dot" /> LIVE
      </span>
      <div className="font-dotGothic text-xl md:text-2xl text-[#00FBFF] tracking-wide title-glow">
        BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENT ARENA
      </div>
      <div className="hidden lg:flex items-center gap-1 text-xs text-[#00FBFF]/50">
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{AGENT_COUNT} AGENTS</span>
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{CHALLENGES.length} CHALLENGES</span>
      </div>
      <div className="ml-auto flex items-center gap-4 text-sm">
        <span className="text-[#00FBFF]/60">
          🏁 <span className="text-[#00ff9c] font-bold">{totalSolved}</span> flags
        </span>
        <span className="tabular-nums text-[#FFBE00] font-bold">⏱ {fmtClock(clock)}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- StageTabs */

const STAGE_TABS: { id: OverviewTab; label: string }[] = [
  { id: "race", label: "🏁 RACE" },
  { id: "grid", label: "▦ MULTIVIEW" },
  { id: "stats", label: "▤ EVAL STATS" },
];

function StageTabs({
  tab,
  onTab,
  stageMode,
}: {
  tab: OverviewTab;
  onTab: (t: OverviewTab) => void;
  stageMode: "overview" | "focus";
}) {
  const wide = stageMode === "overview";
  return (
    <div className="flex items-center gap-2 px-4 h-11 border-b border-[#00FBFF]/20 bg-[#001417] shrink-0">
      <span className="font-dotGothic text-[#00FBFF]/70 mr-2">WIDE SHOT</span>
      {STAGE_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          title={wide ? t.label : `back to ${t.label}`}
          className={`px-3 py-1 rounded text-xs font-bold tracking-wider transition ${
            wide && tab === t.id
              ? "bg-[#00FBFF]/15 text-[#00FBFF] border border-[#00FBFF]/50"
              : "text-[#00FBFF]/45 border border-transparent hover:text-[#00FBFF]"
          }`}
        >
          {t.label}
        </button>
      ))}
      <span className="ml-auto text-[10px] text-[#00FBFF]/35">
        {wide ? "click any agent → close-up" : "◉ close-up — pick a wide shot to go back"}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- FocusStage */

function FocusStage({ focused, lines }: { focused: Agent; lines: ConsoleLine[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const ch = CHALLENGES[focused.current - 1];

  return (
    <>
      {/* who we're watching + what they're on, in one strip */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-[#00FBFF]/10 bg-[#001316] shrink-0 text-xs">
        <span className="text-[#00FBFF]/40">observer://</span>
        <AgentBadge agent={focused} />
        <span className="text-lg font-bold text-white">{focused.handle}</span>

        <span className="ml-3 text-[10px] tracking-widest text-[#00FBFF]/30">NOW SOLVING</span>
        <span
          className="px-2 py-0.5 rounded font-bold shrink-0"
          style={{ color: DIFFICULTY_COLOR[ch.difficulty], border: `1px solid ${DIFFICULTY_COLOR[ch.difficulty]}55` }}
        >
          #{ch.id} {ch.name}
        </span>

        <span className="ml-auto flex items-center gap-3 shrink-0 text-[#00FBFF]/50">
          <span className="text-[#00ff9c] font-bold">
            {focused.solved.length}/{CHALLENGES.length}
          </span>
          <span>
            {(focused.tokens / 1000).toFixed(0)}k tok · ${focused.cost.toFixed(2)}
          </span>
        </span>
      </div>

      {/* console */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed console-scroll"
      >
        {lines.map(l => (
          <ConsoleRow key={l.id} line={l} />
        ))}
        <div className="text-[#00ff9c] animate-pulse">▋</div>
      </div>
    </>
  );
}

function ConsoleRow({ line }: { line: ConsoleLine }) {
  if (line.kind === "think") return <div className="text-[#7fd8dd] italic">· {line.text}</div>;
  if (line.kind === "tool")
    return (
      <div className="text-[#00FBFF]">
        <span className="text-[#00ff9c]">$</span> {line.text}
      </div>
    );
  if (line.kind === "skill") return <div className="text-[#c084fc] font-bold">⚡ {line.text}</div>;
  if (line.kind === "flag") return <div className="text-[#00ff9c] font-bold">🏁 {line.text}</div>;
  return <div className="text-[#00FBFF]/55 pl-3">{line.text}</div>;
}

/* ------------------------------------------------------------ OverviewStage */

type OverviewTab = "race" | "grid" | "stats";
type StatsSort = "solved" | "cost" | "eff";

function OverviewStage({
  ranked,
  tab,
  statsSort,
  setStatsSort,
  onPick,
  flashes,
}: {
  ranked: Agent[];
  tab: OverviewTab;
  statsSort: StatsSort;
  setStatsSort: (s: StatsSort) => void;
  onPick: (id: string) => void;
  flashes: string[];
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto console-scroll">
      {tab === "race" && <RaceView ranked={ranked} onPick={onPick} flashes={flashes} />}
      {tab === "grid" && <GridView ranked={ranked} onPick={onPick} />}
      {tab === "stats" && <StatsView ranked={ranked} sort={statsSort} setSort={setStatsSort} onPick={onPick} />}
    </div>
  );
}

function RaceView({ ranked, onPick, flashes }: { ranked: Agent[]; onPick: (id: string) => void; flashes: string[] }) {
  const done = (a: Agent) => a.solved.length >= CHALLENGES.length;
  return (
    <div className="p-3 space-y-1">
      {/* challenge ruler — position maps to challenge, colored by difficulty */}
      <div className="flex items-center gap-3 px-2 pb-1">
        <span className="w-5 shrink-0" />
        <span className="w-6 shrink-0" />
        <span className="w-44 shrink-0 text-[9px] tracking-widest text-[#00FBFF]/25">AGENT</span>
        <div className="flex-1 flex gap-[3px]">
          {CHALLENGES.map(c => (
            <span
              key={c.id}
              title={`#${c.id} ${c.name} · ${c.difficulty}`}
              className="flex-1 text-center text-[9px] font-bold tabular-nums"
              style={{ color: `${DIFFICULTY_COLOR[c.difficulty]}99` }}
            >
              {c.id}
            </span>
          ))}
        </div>
        <span className="w-10 shrink-0 text-right text-[9px] tracking-widest text-[#00FBFF]/25">FLAGS</span>
      </div>

      {ranked.map((a, i) => (
        <button
          key={a.id}
          onClick={() => onPick(a.id)}
          className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#00FBFF]/5 transition text-left group"
        >
          <span
            className={`w-5 text-right text-xs font-bold tabular-nums shrink-0 ${
              i === 0 ? "text-[#FFBE00]" : i < 3 ? "text-[#00ff9c]" : "text-[#00FBFF]/40"
            }`}
          >
            {i + 1}
          </span>
          <AgentBadge agent={a} />
          <span className="w-44 truncate text-sm font-bold text-white shrink-0">{a.handle}</span>

          {/* one cell per challenge: captured / working / not reached */}
          <div className="flex-1 flex gap-[3px]">
            {CHALLENGES.map(c => {
              const captured = a.solved.includes(c.id);
              const working = !captured && !done(a) && a.current === c.id;
              const flashing = flashes.includes(`${a.id}:${c.id}`);
              return (
                <span
                  key={c.id}
                  title={`#${c.id} ${c.name} · ${c.difficulty}${
                    captured ? " · captured" : working ? " · working on it" : ""
                  }`}
                  className={`relative flex-1 h-5 rounded-[3px] border flex items-center justify-center text-[9px] font-bold tabular-nums transition-colors ${
                    flashing ? "flag-pop" : ""
                  } ${working ? "cell-working" : ""}`}
                  style={
                    captured
                      ? { background: a.color, borderColor: a.color, color: "#00181c" }
                      : working
                      ? {
                          background: `${DIFFICULTY_COLOR[c.difficulty]}1f`,
                          borderColor: DIFFICULTY_COLOR[c.difficulty],
                          color: DIFFICULTY_COLOR[c.difficulty],
                        }
                      : { background: "#00fbff08", borderColor: "#00fbff1a", color: "#00fbff33" }
                  }
                >
                  {captured ? "✓" : c.id}
                </span>
              );
            })}
          </div>

          <span className="w-10 text-right text-xs tabular-nums shrink-0 text-[#00FBFF]/70">
            {done(a) ? <span className="text-[#00ff9c] font-bold">◆ {a.solved.length}</span> : a.solved.length}
          </span>
        </button>
      ))}
    </div>
  );
}

function GridView({ ranked, onPick }: { ranked: Agent[]; onPick: (id: string) => void }) {
  return (
    <div className="h-full p-2 grid grid-cols-5 auto-rows-fr gap-2">
      {ranked.map(a => {
        const ch = CHALLENGES[a.current - 1];
        return (
          <button
            key={a.id}
            onClick={() => onPick(a.id)}
            className="min-h-0 flex flex-col text-left rounded border border-[#00FBFF]/15 bg-[#00090b] hover:border-[#00FBFF]/50 transition overflow-hidden group"
          >
            <div className="flex items-center gap-1.5 px-2 h-8 shrink-0 border-b border-[#00FBFF]/10 bg-[#001417]">
              <AgentBadge agent={a} />
              <span className="text-[13px] font-bold text-white truncate flex-1">{a.handle}</span>
            </div>
            <div className="flex items-center gap-2 px-2 h-6 shrink-0 text-[11px] border-b border-[#00FBFF]/[0.07] bg-[#000d0f]">
              <span className="truncate" style={{ color: DIFFICULTY_COLOR[ch.difficulty] }}>
                C{ch.id} {ch.name}
              </span>
              <span className="ml-auto shrink-0 text-[#00FBFF]/45 tabular-nums">
                {a.solved.length}/{CHALLENGES.length}
              </span>
            </div>
            {/* rolling console — newest line sits at the bottom */}
            <div className="flex-1 min-h-0 flex flex-col justify-end overflow-hidden px-2 py-1 text-[11px] leading-[1.5]">
              {a.preview.map((line, k) => (
                <div key={k} className="truncate text-[#7fd8dd]/80">
                  {line}
                </div>
              ))}
              <div className="text-[#00ff9c] animate-pulse shrink-0">▋</div>
            </div>
            <div className="h-1 shrink-0 bg-[#00FBFF]/10">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${(a.solved.length / CHALLENGES.length) * 100}%`, background: a.color }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StatsView({
  ranked,
  sort,
  setSort,
  onPick,
}: {
  ranked: Agent[];
  sort: StatsSort;
  setSort: (s: StatsSort) => void;
  onPick: (id: string) => void;
}) {
  const eff = (a: Agent) => a.tokens / Math.max(1, a.solved.length);
  const rows = [...ranked].sort((a, b) => {
    if (sort === "cost") return a.cost - b.cost;
    if (sort === "eff") return eff(a) - eff(b);
    return b.solved.length - a.solved.length || a.cost - b.cost;
  });
  const Th = ({ id, label, right }: { id?: StatsSort; label: string; right?: boolean }) => (
    <th
      className={`px-2 py-2 font-bold text-[#00FBFF]/60 ${right ? "text-right" : "text-left"} ${
        id ? "cursor-pointer hover:text-[#00FBFF]" : ""
      }`}
      onClick={id ? () => setSort(id) : undefined}
    >
      {label}
      {id && sort === id ? " ▾" : ""}
    </th>
  );
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 bg-[#001417] z-10">
        <tr className="border-b border-[#00FBFF]/20">
          <Th label="#" />
          <Th label="AGENT" />
          <Th label="PROGRESS" />
          <Th label="NOW" />
          <Th id="solved" label="SOLVED" right />
          <Th label="TOK" right />
          <Th id="cost" label="COST" right />
          <Th id="eff" label="TOK/FLAG" right />
          <Th label="1ST BLOOD" right />
        </tr>
      </thead>
      <tbody>
        {rows.map((a, i) => (
          <tr
            key={a.id}
            onClick={() => onPick(a.id)}
            className="border-b border-[#00FBFF]/5 hover:bg-[#00FBFF]/5 cursor-pointer"
          >
            <td className="px-2 py-1.5 text-[#00FBFF]/40 tabular-nums">{i + 1}</td>
            <td className="px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <AgentBadge agent={a} />
                <span className="text-white font-bold truncate max-w-[130px]">{a.handle}</span>
              </div>
            </td>
            <td className="px-2 py-1.5">
              <div className="flex gap-[2px]">
                {CHALLENGES.map(c => (
                  <span
                    key={c.id}
                    className="w-2 h-2 rounded-sm"
                    style={{ background: a.solved.includes(c.id) ? a.color : "#00FBFF12" }}
                  />
                ))}
              </div>
            </td>
            <td className="px-2 py-1.5 text-[#00FBFF]/60">{a.solved.length >= 12 ? "◆ done" : `C${a.current}`}</td>
            <td className="px-2 py-1.5 text-right tabular-nums font-bold text-[#00ff9c]">{a.solved.length}</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-[#00FBFF]/60">{(a.tokens / 1000).toFixed(0)}k</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-[#00FBFF]/60">${a.cost.toFixed(1)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-[#00FBFF]/60">{(eff(a) / 1000).toFixed(0)}k</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-[#FFBE00]/70">{a.firstBlood}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------- Leaderboard */

function Leaderboard({
  ranked,
  focusedId,
  onPick,
}: {
  ranked: Agent[];
  focusedId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-[#00FBFF]/20">
      <SectionHead label="LEADERBOARD" hint="click to observe" />
      <div className="flex-1 min-h-0 overflow-y-auto console-scroll">
        {ranked.map((a, i) => {
          const active = a.id === focusedId;
          return (
            <button
              key={a.id}
              onClick={() => onPick(a.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#00FBFF]/5 transition ${
                active ? "bg-[#00FBFF]/10" : "hover:bg-[#00FBFF]/5"
              }`}
            >
              <span
                className={`w-6 text-center text-sm font-bold tabular-nums ${
                  i === 0 ? "text-[#FFBE00]" : i < 3 ? "text-[#00ff9c]" : "text-[#00FBFF]/40"
                }`}
              >
                {i + 1}
              </span>
              <AgentBadge agent={a} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{a.handle}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  {/* one square per challenge, same read as the eval-stats progress column */}
                  <div className="flex gap-[2px] flex-1">
                    {CHALLENGES.map(c => {
                      const captured = a.solved.includes(c.id);
                      const working = !captured && a.current === c.id;
                      return (
                        <span
                          key={c.id}
                          title={`#${c.id} ${c.name}${captured ? " · captured" : working ? " · working on it" : ""}`}
                          className="flex-1 h-2 rounded-sm"
                          style={{
                            background: captured
                              ? a.color
                              : working
                              ? `${DIFFICULTY_COLOR[c.difficulty]}66`
                              : "#00FBFF12",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-[#00FBFF]/50 tabular-nums w-8 text-right shrink-0">
                    {a.solved.length}/{CHALLENGES.length}
                  </span>
                </div>
              </div>
              <StatusDot status={a.status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- ChallengeBoard */

function ChallengeBoard({
  agents,
  focused,
  expanded,
  onOpen,
}: {
  agents: Agent[];
  focused: Agent;
  expanded: boolean;
  onOpen: (id: number) => void;
}) {
  const solvedCount = (id: number) => agents.filter(a => a.solved.includes(id)).length;
  return (
    <div className={`${expanded ? "flex-1 min-h-0" : "h-[36%]"} flex flex-col`}>
      <SectionHead label="CHALLENGE BOARD" hint="click for details" />
      <div className="flex-1 min-h-0 overflow-y-auto console-scroll p-2 grid grid-cols-2 gap-1.5 content-start">
        {CHALLENGES.map(c => {
          const mine = focused.solved.includes(c.id);
          const isCurrent = focused.current === c.id;
          const count = solvedCount(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`px-2 py-1.5 rounded border text-[11px] text-left transition hover:border-[#00FBFF] ${
                mine
                  ? "bg-[#00ff9c]/10 border-[#00ff9c]/50"
                  : isCurrent
                  ? "border-[#FFBE00] bg-[#FFBE00]/5 current-pulse"
                  : "border-[#00FBFF]/15 bg-[#00FBFF]/[0.02]"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="font-bold" style={{ color: DIFFICULTY_COLOR[c.difficulty] }}>
                  #{c.id}
                </span>
                {mine && <span className="text-[#00ff9c]">✓</span>}
                {isCurrent && <span className="text-[#FFBE00] animate-pulse">▶</span>}
              </div>
              <div className="text-white/80 truncate">{c.name}</div>
              <div className="text-[#00FBFF]/40">
                {count}/{agents.length} cleared
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- ChallengeDetails */

function ChallengeDetails({
  challenge,
  agents,
  onClose,
  onPickAgent,
}: {
  challenge: Challenge;
  agents: Agent[];
  onClose: () => void;
  onPickAgent: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cleared = agents.filter(a => a.solved.includes(challenge.id));
  const onIt = agents.filter(a => !a.solved.includes(challenge.id) && a.current === challenge.id);
  const dc = DIFFICULTY_COLOR[challenge.difficulty];

  const AgentChips = ({ list, empty }: { list: Agent[]; empty: string }) =>
    list.length === 0 ? (
      <div className="text-[#00FBFF]/30 italic text-xs">{empty}</div>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {list.map(a => (
          <button
            key={a.id}
            onClick={() => {
              onPickAgent(a.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs hover:bg-white/5 transition"
            style={{ borderColor: `${a.color}55`, color: a.color }}
            title={`observe ${a.handle}`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.color }} />
            {a.handle}
          </button>
        ))}
      </div>
    );

  return (
    <div
      className="absolute inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="toast-in w-[520px] max-w-[92%] max-h-[80%] overflow-y-auto console-scroll rounded-lg border bg-[#020a0c] shadow-2xl"
        style={{ borderColor: `${dc}66` }}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b" style={{ borderColor: `${dc}33` }}>
          <span className="text-lg font-bold" style={{ color: dc }}>
            #{challenge.id}
          </span>
          <span className="text-lg font-bold text-white truncate">{challenge.name}</span>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 shrink-0 rounded border border-[#00FBFF]/25 text-[#00FBFF]/60 hover:text-[#00FBFF] hover:border-[#00FBFF] transition"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{ color: dc, border: `1px solid ${dc}55`, background: `${dc}12` }}
            >
              {challenge.difficulty}
            </span>
            <span className="text-[#00FBFF]/45">[{challenge.tag}]</span>
          </div>

          <p className="text-[13px] leading-relaxed text-[#00FBFF]/75">{challenge.description}</p>

          {challenge.hints.length > 0 && (
            <div className="space-y-1.5">
              <div className="tracking-widest text-[10px] text-[#00FBFF]/45">HINTS</div>
              <ul className="space-y-1">
                {challenge.hints.map((hint, i) => (
                  <li key={i} className="flex gap-2 text-[#00FBFF]/55">
                    <span className="shrink-0 text-[#FFBE00]/70">›</span>
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5 text-[#00FBFF]/45">
              <span className="tracking-widest text-[10px]">FIELD PROGRESS</span>
              <span className="tabular-nums">
                {cleared.length}/{agents.length} cleared
              </span>
            </div>
            <div className="h-2 rounded bg-[#00FBFF]/10 overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${(cleared.length / Math.max(1, agents.length)) * 100}%`, background: dc }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="tracking-widest text-[10px] text-[#00FBFF]/45">CAPTURED BY</div>
            <AgentChips list={cleared} empty="nobody has cracked this one yet" />
          </div>

          <div className="space-y-1.5">
            <div className="tracking-widest text-[10px] text-[#00FBFF]/45">WORKING ON IT NOW</div>
            <AgentChips list={onIt} empty="no one is on this right now" />
          </div>

          <div className="pt-1 text-[10px] text-[#00FBFF]/30">
            click an agent to jump to its close-up · Esc to close
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- FeedBar */

function FeedBar({ feed }: { feed: FeedItem[] }) {
  return (
    <div className="w-1/2 min-w-0 bg-[#010607] flex flex-col">
      <div className="flex items-center gap-3 px-4 h-8 border-b border-[#00FBFF]/10 shrink-0">
        <span className="text-xs font-bold text-[#00FBFF]/60 tracking-widest">ARENA FEED</span>
        <span className="text-[10px] text-[#00FBFF]/30">flags · skills · events</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto console-scroll px-4 py-1.5 text-xs space-y-1">
        {feed.length === 0 && <div className="text-[#00FBFF]/30 italic">waiting for the arena to heat up…</div>}
        {feed.map(f => (
          <FeedRow key={f.id} item={f} />
        ))}
      </div>
    </div>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const icon = item.type === "flag" ? "🏁" : item.type === "skill" ? "⚡" : item.type === "stuck" ? "⚠" : "💬";
  const cls =
    item.type === "flag"
      ? "text-[#00ff9c] font-bold"
      : item.type === "skill"
      ? "text-[#c084fc]"
      : item.type === "stuck"
      ? "text-[#FFBE00]"
      : "text-[#00FBFF]/70";
  return (
    <div className="flex items-start gap-2 feed-in">
      <span className="w-2 h-2 mt-1 rounded-sm shrink-0" style={{ background: item.color }} />
      <span className={cls}>
        {icon} {item.text}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- AgentChat */

function AgentChat({ chat, onSend }: { chat: ChatMsg[]; onSend: (t: string) => void }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat]);
  const submit = () => {
    onSend(draft);
    setDraft("");
  };
  return (
    <div className="w-1/2 min-w-0 border-l border-[#00FBFF]/20 bg-[#04080a] flex flex-col">
      <div className="flex items-center gap-2 px-3 h-8 border-b border-[#00FBFF]/10 shrink-0">
        <span className="text-xs font-bold text-[#00FBFF]/60 tracking-widest">AGENT CHAT</span>
        <span className="text-[10px] text-[#00FBFF]/30">agent ↔ agent · director broadcast</span>
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto console-scroll px-3 py-1.5 text-xs space-y-1">
        {chat.length === 0 && <div className="text-[#00FBFF]/30 italic">the agents are quiet… for now.</div>}
        {chat.map(m => (
          <ChatRow key={m.id} msg={m} />
        ))}
      </div>
      <div className="flex items-center gap-2 px-2 py-2 border-t border-[#00FBFF]/15 shrink-0">
        <span className="text-[10px] text-[#FFBE00] font-bold shrink-0">🎬 DIRECTOR</span>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") submit();
          }}
          placeholder="broadcast a message to all agents…"
          className="flex-1 min-w-0 bg-[#00181c] border border-[#00FBFF]/20 rounded px-2 py-1 text-xs text-white placeholder-[#00FBFF]/25 focus:outline-none focus:border-[#FFBE00]/60"
        />
        <button
          onClick={submit}
          className="px-2.5 py-1 rounded border border-[#FFBE00]/50 text-[#FFBE00] text-xs font-bold hover:bg-[#FFBE00]/10 transition shrink-0"
        >
          SEND
        </button>
      </div>
    </div>
  );
}

function ChatRow({ msg }: { msg: ChatMsg }) {
  if (msg.director) {
    return (
      <div className="flex items-start gap-2 feed-in rounded bg-[#FFBE00]/10 border border-[#FFBE00]/30 px-2 py-1">
        <span className="text-[#FFBE00] font-bold shrink-0">🎬 director</span>
        <span className="text-[#ffe9a8]">{msg.text}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 feed-in">
      <span className="w-2 h-2 mt-1 rounded-sm shrink-0" style={{ background: msg.color }} />
      <span className="text-white/85 leading-snug">
        <span className="font-bold" style={{ color: msg.color }}>
          {msg.fromHandle}
        </span>
        <span className="text-[#00FBFF]/40">: </span>
        <MentionText text={msg.text} />
      </span>
    </div>
  );
}

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-z0-9-]+)/gi);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="text-[#00FBFF] font-semibold">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Toasts */

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="toast-in min-w-[280px] px-4 py-3 rounded-lg border bg-[#020a0c]/95 shadow-2xl backdrop-blur"
          style={{ borderColor: t.color }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color: t.type === "flag" ? "#00ff9c" : "#c084fc" }}>
              {t.type === "flag" ? "🏁" : "⚡"}
            </span>
            <span className="font-bold text-white text-sm">{t.title}</span>
          </div>
          <div className="text-xs mt-1" style={{ color: t.color }}>
            {t.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Shared */

function AgentBadge({ agent }: { agent: Agent }) {
  return (
    <span
      className="flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold shrink-0"
      style={{ background: agent.color + "22", color: agent.color, border: `1px solid ${agent.color}55` }}
      title={`${agent.harness} + ${agent.model}`}
    >
      {HARNESS_GLYPH[agent.harness] || "●"}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    working: "#00FBFF",
    thinking: "#c084fc",
    exploiting: "#00ff9c",
    stuck: "#FF5861",
    submitting: "#FFBE00",
    idle: "#666",
  };
  const c = map[status] || "#00FBFF";
  return <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: c }} title={status} />;
}

function SectionHead({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 h-8 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0">
      <span className="text-xs font-bold text-[#00FBFF] tracking-widest">{label}</span>
      {hint && <span className="ml-auto text-[10px] text-[#00FBFF]/35">{hint}</span>}
    </div>
  );
}

function Scanlines() {
  return <div className="pointer-events-none absolute inset-0 z-[70] scanlines" />;
}

/* --------------------------------------------------------------- Styles */

function ArenaStyles() {
  return (
    <style jsx global>{`
      .arena-root {
        background-image: radial-gradient(circle at 20% 0%, #001a1f 0%, #000 55%);
      }
      .scanlines {
        background: repeating-linear-gradient(
          to bottom,
          rgba(0, 251, 255, 0.03) 0px,
          rgba(0, 251, 255, 0.03) 1px,
          transparent 1px,
          transparent 3px
        );
        mix-blend-mode: overlay;
      }
      .title-glow {
        text-shadow: 0 0 12px rgba(0, 251, 255, 0.5);
      }
      .live-dot {
        animation: livePulse 1.1s ease-in-out infinite;
      }
      @keyframes livePulse {
        0%,
        100% {
          opacity: 1;
          box-shadow: 0 0 0 0 rgba(255, 88, 97, 0.7);
        }
        50% {
          opacity: 0.5;
          box-shadow: 0 0 0 6px rgba(255, 88, 97, 0);
        }
      }
      .toast-in {
        animation: toastIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.4);
      }
      @keyframes toastIn {
        from {
          transform: translateX(120%) scale(0.9);
          opacity: 0;
        }
        to {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
      }
      .feed-in {
        animation: feedIn 0.3s ease-out;
      }
      @keyframes feedIn {
        from {
          transform: translateX(-8px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      .current-pulse {
        animation: currentPulse 1.8s ease-in-out infinite;
      }
      @keyframes currentPulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(255, 190, 0, 0.4);
        }
        50% {
          box-shadow: 0 0 0 3px rgba(255, 190, 0, 0);
        }
      }
      .cell-working {
        animation: cellWorking 2.8s ease-in-out infinite;
      }
      @keyframes cellWorking {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.86;
        }
      }
      .flag-pop {
        animation: flagPop 3s cubic-bezier(0.2, 0.9, 0.3, 1.2);
        z-index: 1;
      }
      @keyframes flagPop {
        0% {
          transform: scale(1);
          filter: brightness(3.2);
          box-shadow: 0 0 0 0 rgba(0, 255, 156, 0.9);
        }
        12% {
          transform: scale(1.4);
          filter: brightness(2.6);
          box-shadow: 0 0 16px 5px rgba(0, 255, 156, 0.6);
        }
        45% {
          transform: scale(1.18);
          filter: brightness(1.9);
          box-shadow: 0 0 12px 3px rgba(0, 255, 156, 0.4);
        }
        100% {
          transform: scale(1);
          filter: brightness(1);
          box-shadow: 0 0 0 0 rgba(0, 255, 156, 0);
        }
      }
      .console-scroll::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .console-scroll::-webkit-scrollbar-thumb {
        background: rgba(0, 251, 255, 0.25);
        border-radius: 3px;
      }
      .console-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
    `}</style>
  );
}
