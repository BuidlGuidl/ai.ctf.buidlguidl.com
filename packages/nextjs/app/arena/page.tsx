"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Agent,
  CHALLENGES,
  CHAT_LINES,
  CHAT_OPENERS_DIRECTED,
  CHAT_REPLIES,
  DIFFICULTY_COLOR,
  DIRECTOR_REACTIONS,
  HARNESS_GLYPH,
  SKILLS,
  buildAgents,
  makeLine,
  previewLine,
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
  const [agents, setAgents] = useState<Agent[]>(() => buildAgents());
  const [focusedId, setFocusedId] = useState<string>("agent-0");
  const [auto, setAuto] = useState(true);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clock, setClock] = useState(4931);
  const [viewers, setViewers] = useState(4218);
  const [mounted, setMounted] = useState(false);
  const [stageMode, setStageMode] = useState<"overview" | "focus">("overview");
  const [overviewTab, setOverviewTab] = useState<"race" | "grid" | "stats">("race");
  const [statsSort, setStatsSort] = useState<"solved" | "cost" | "eff">("solved");
  useEffect(() => setMounted(true), []);

  const agentsRef = useRef(agents);
  const focusRef = useRef(focusedId);
  const autoRef = useRef(auto);
  const stageModeRef = useRef(stageMode);
  const returnAtRef = useRef(0);
  const lastSpeakerRef = useRef<Agent | null>(null);
  agentsRef.current = agents;
  focusRef.current = focusedId;
  autoRef.current = auto;
  stageModeRef.current = stageMode;

  const goFocus = useCallback((id: string) => {
    setFocusedId(id);
    setStageMode("focus");
    setAuto(false);
  }, []);
  const goOverview = useCallback(() => {
    setStageMode("overview");
    setAuto(false);
  }, []);

  const focused = useMemo(() => agents.find(a => a.id === focusedId)!, [agents, focusedId]);
  const ranked = useMemo(() => rankAgents(agents), [agents]);
  const totalSolved = useMemo(() => agents.reduce((n, a) => n + a.solved.length, 0), [agents]);

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

  // LIVE clock + viewer jitter.
  useEffect(() => {
    const t = setInterval(() => {
      setClock(c => c + 1);
      setViewers(v => Math.max(3600, v + Math.floor((Math.random() - 0.45) * 40)));
    }, 1000);
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
                preview: Math.random() < 0.3 ? previewLine(CHALLENGES[a.current - 1]?.tag || "default") : a.preview,
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
          pushToast({ type: "flag", title: `🏁 ${a.handle}`, sub: `captured flag · ${ch.name}`, color: a.color });
          pushFeed({
            type: "flag",
            agentId: a.id,
            color: a.color,
            text: `${a.handle} captured Challenge ${a.current} · ${ch.name}`,
          });
          // director reflex: cut to a close-up of whoever just scored
          if (autoRef.current) {
            setFocusedId(a.id);
            setStageMode("focus");
            returnAtRef.current = tick + 7;
          }
        }
      }

      // AUTO-DIRECTOR — the wide shot is home; cut to a random feed now and then, then return
      if (autoRef.current) {
        if (stageModeRef.current === "focus" && tick >= returnAtRef.current) {
          setStageMode("overview");
        } else if (stageModeRef.current === "overview" && tick % 16 === 0) {
          const others = list.filter(a => a.id !== focusRef.current && a.status !== "idle");
          const next = others[Math.floor(Math.random() * others.length)];
          if (next) {
            setFocusedId(next.id);
            setStageMode("focus");
            returnAtRef.current = tick + 6;
          }
        }
      }
    }, 950);
    return () => clearInterval(t);
  }, [pushFeed, pushToast, pushChat]);

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-[#00FBFF] font-dotGothic text-2xl tracking-widest">
        <span className="animate-pulse">◆ LOADING AGENT ARENA…</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-[#00FBFF] font-mono overflow-hidden arena-root">
      <Scanlines />
      <TopBar
        clock={clock}
        viewers={viewers}
        totalSolved={totalSolved}
        auto={auto}
        setAuto={setAuto}
        stageMode={stageMode}
        onOverview={goOverview}
      />

      <div className="flex flex-1 min-h-0">
        {/* MAIN STAGE */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-[#00FBFF]/20">
          {stageMode === "focus" ? (
            <FocusStage focused={focused} lines={lines} auto={auto} onOverview={goOverview} />
          ) : (
            <OverviewStage
              ranked={ranked}
              tab={overviewTab}
              setTab={setOverviewTab}
              statsSort={statsSort}
              setStatsSort={setStatsSort}
              onPick={goFocus}
            />
          )}
          <div className="h-52 shrink-0 flex border-t border-[#00FBFF]/20">
            <FeedBar feed={feed} />
            <AgentChat chat={chat} onSend={sendDirector} />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="w-[380px] flex flex-col min-h-0">
          <Leaderboard ranked={ranked} focusedId={focusedId} onPick={goFocus} />
          <ChallengeBoard agents={agents} focused={focused} />
        </div>
      </div>

      <Toasts toasts={toasts} />
      <ArenaStyles />
    </div>
  );
}

/* ------------------------------------------------------------------ TopBar */

function TopBar({
  clock,
  viewers,
  totalSolved,
  auto,
  setAuto,
  stageMode,
  onOverview,
}: {
  clock: number;
  viewers: number;
  totalSolved: number;
  auto: boolean;
  setAuto: (v: boolean) => void;
  stageMode: "overview" | "focus";
  onOverview: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 h-14 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] shrink-0">
      <span className="flex items-center gap-2 text-[#FF5861] font-bold tracking-widest">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5861] live-dot" /> LIVE
      </span>
      <div className="font-dotGothic text-xl md:text-2xl text-[#00FBFF] tracking-wide title-glow">
        BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENT ARENA
      </div>
      <div className="hidden lg:flex items-center gap-1 text-xs text-[#00FBFF]/50">
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">20 AGENTS</span>
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">12 CHALLENGES</span>
      </div>
      <div className="ml-auto flex items-center gap-4 text-sm">
        <button
          onClick={onOverview}
          className={`px-3 py-1 rounded border text-xs font-bold tracking-wider transition ${
            stageMode === "overview"
              ? "border-[#00FBFF] text-[#00FBFF] bg-[#00FBFF]/10"
              : "border-[#00FBFF]/30 text-[#00FBFF]/60 hover:text-[#00FBFF]"
          }`}
          title="Wide shot — whole arena"
        >
          {stageMode === "overview" ? "▣ WIDE SHOT" : "▢ OVERVIEW"}
        </button>
        <button
          onClick={() => setAuto(!auto)}
          className={`px-3 py-1 rounded border text-xs font-bold tracking-wider transition ${
            auto
              ? "border-[#00ff9c] text-[#00ff9c] bg-[#00ff9c]/10"
              : "border-[#00FBFF]/30 text-[#00FBFF]/60 hover:text-[#00FBFF]"
          }`}
        >
          {auto ? "◉ AUTO-DIRECTOR" : "○ MANUAL"}
        </button>
        <span className="text-[#00FBFF]/60">
          🏁 <span className="text-[#00ff9c] font-bold">{totalSolved}</span> flags
        </span>
        <span className="text-[#00FBFF]/60">
          👁 <span className="text-white font-bold">{viewers.toLocaleString()}</span>
        </span>
        <span className="tabular-nums text-[#FFBE00] font-bold">⏱ {fmtClock(clock)}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- FocusStage */

function FocusStage({
  focused,
  lines,
  auto,
  onOverview,
}: {
  focused: Agent;
  lines: ConsoleLine[];
  auto: boolean;
  onOverview: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const ch = CHALLENGES[focused.current - 1];

  return (
    <div className="flex-1 min-h-0 relative p-4">
      <div className="h-full flex flex-col border border-[#00FBFF]/25 rounded-lg bg-[#020a0c]/80 overflow-hidden shadow-[0_0_40px_-12px_rgba(0,251,255,0.4)]">
        {/* window title bar */}
        <div className="flex items-center gap-3 px-4 h-11 border-b border-[#00FBFF]/20 bg-[#001417] shrink-0">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5861]" />
            <span className="w-3 h-3 rounded-full bg-[#FFBE00]" />
            <span className="w-3 h-3 rounded-full bg-[#00ff9c]" />
          </div>
          <span className="text-xs text-[#00FBFF]/40">observer://</span>
          <AgentBadge agent={focused} />
          <span className="text-sm font-bold text-white">{focused.handle}</span>
          <span className="ml-auto flex items-center gap-3 text-xs">
            <StatusPill status={focused.status} />
            <span className="text-[#00FBFF]/50">
              {(focused.tokens / 1000).toFixed(0)}k tok · ${focused.cost.toFixed(2)}
            </span>
            <button
              onClick={onOverview}
              className="px-2 py-0.5 rounded border border-[#00FBFF]/30 text-[#00FBFF]/70 hover:text-[#00FBFF] hover:border-[#00FBFF] transition"
              title="Back to the wide shot"
            >
              ▢ overview
            </button>
          </span>
        </div>

        {/* current-task strip */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#00FBFF]/10 bg-[#00191d]/60 text-xs shrink-0">
          <span className="text-[#00FBFF]/40">NOW SOLVING</span>
          <span
            className="px-2 py-0.5 rounded font-bold"
            style={{ color: DIFFICULTY_COLOR[ch.difficulty], border: `1px solid ${DIFFICULTY_COLOR[ch.difficulty]}55` }}
          >
            #{ch.id} {ch.name}
          </span>
          <span className="text-[#00FBFF]/40">[{ch.tag}]</span>
          <span className="ml-auto text-[#00FBFF]/40">
            {focused.solved.length}/12 solved · {focused.harness} + {focused.model}
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
      </div>

      {/* AUSTIN webcam PiP */}
      <AustinCam auto={auto} />
    </div>
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

function AustinCam({ auto }: { auto: boolean }) {
  return (
    <div className="absolute bottom-8 left-8 w-64 rounded-lg overflow-hidden border-2 border-[#FFBE00] shadow-[0_0_30px_-4px_rgba(255,190,0,0.6)] bg-black">
      <div className="flex items-center gap-2 px-3 h-7 bg-[#FFBE00] text-black text-xs font-bold">
        <span className="w-2 h-2 rounded-full bg-[#FF5861] live-dot" />
        AUSTIN GRIFFITH · HOST
      </div>
      <div className="relative aspect-video bg-[radial-gradient(circle_at_50%_40%,#123,#000)] flex items-center justify-center">
        <div className="text-6xl austin-bob">🧑‍🚀</div>
        <div className="absolute bottom-1 left-2 text-[10px] text-[#00FBFF]/60">🎙 casting the arena…</div>
        <div className="absolute bottom-1 right-2 text-[10px] text-[#00ff9c]">{auto ? "AUTO" : "MANUAL"}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ OverviewStage */

type OverviewTab = "race" | "grid" | "stats";
type StatsSort = "solved" | "cost" | "eff";

function OverviewStage({
  ranked,
  tab,
  setTab,
  statsSort,
  setStatsSort,
  onPick,
}: {
  ranked: Agent[];
  tab: OverviewTab;
  setTab: (t: OverviewTab) => void;
  statsSort: StatsSort;
  setStatsSort: (s: StatsSort) => void;
  onPick: (id: string) => void;
}) {
  const tabs: { id: OverviewTab; label: string }[] = [
    { id: "race", label: "🏁 RACE" },
    { id: "grid", label: "▦ MULTIVIEW" },
    { id: "stats", label: "▤ EVAL STATS" },
  ];
  return (
    <div className="flex-1 min-h-0 relative p-4">
      <div className="h-full flex flex-col border border-[#00FBFF]/25 rounded-lg bg-[#020a0c]/80 overflow-hidden shadow-[0_0_40px_-12px_rgba(0,251,255,0.4)]">
        {/* tab bar */}
        <div className="flex items-center gap-2 px-4 h-11 border-b border-[#00FBFF]/20 bg-[#001417] shrink-0">
          <span className="font-dotGothic text-[#00FBFF]/70 mr-2">WIDE SHOT</span>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded text-xs font-bold tracking-wider transition ${
                tab === t.id
                  ? "bg-[#00FBFF]/15 text-[#00FBFF] border border-[#00FBFF]/50"
                  : "text-[#00FBFF]/45 border border-transparent hover:text-[#00FBFF]"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-[#00FBFF]/35">click any agent → close-up</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto console-scroll">
          {tab === "race" && <RaceView ranked={ranked} onPick={onPick} />}
          {tab === "grid" && <GridView ranked={ranked} onPick={onPick} />}
          {tab === "stats" && <StatsView ranked={ranked} sort={statsSort} setSort={setStatsSort} onPick={onPick} />}
        </div>
      </div>

      <AustinCam auto={false} />
    </div>
  );
}

function RaceView({ ranked, onPick }: { ranked: Agent[]; onPick: (id: string) => void }) {
  const leader = ranked[0];
  return (
    <div className="p-3 space-y-1">
      {ranked.map((a, i) => {
        const pct = (a.solved.length / 12) * 100;
        const ch = CHALLENGES[a.current - 1];
        return (
          <button
            key={a.id}
            onClick={() => onPick(a.id)}
            className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#00FBFF]/5 transition text-left group"
          >
            <span
              className={`w-5 text-right text-xs font-bold tabular-nums ${
                i === 0 ? "text-[#FFBE00]" : i < 3 ? "text-[#00ff9c]" : "text-[#00FBFF]/40"
              }`}
            >
              {i + 1}
            </span>
            <AgentBadge agent={a} />
            <span className="w-40 truncate text-xs font-bold text-white shrink-0">{a.handle}</span>
            {/* race track */}
            <div className="relative flex-1 h-5 rounded bg-[#00FBFF]/[0.06] overflow-hidden">
              <div className="absolute inset-0 flex justify-between px-[2px]">
                {Array.from({ length: 12 }).map((_, k) => (
                  <span key={k} className="w-px h-full bg-[#00FBFF]/10" />
                ))}
              </div>
              <div
                className="h-full rounded-r transition-all duration-700"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${a.color}44, ${a.color})` }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-xs transition-all duration-700"
                style={{ left: `${pct}%` }}
              >
                {HARNESS_GLYPH[a.harness] || "●"}
              </span>
            </div>
            <span className="w-10 text-right text-xs tabular-nums text-[#00FBFF]/70 shrink-0">
              {a.solved.length}/12
            </span>
            <span
              className="w-24 text-[10px] truncate shrink-0"
              style={{ color: a.solved.length >= 12 ? "#00ff9c" : DIFFICULTY_COLOR[ch.difficulty] }}
            >
              {a.solved.length >= 12 ? "◆ FINISHED" : `▶ C${ch.id}`}
            </span>
            <span className="w-14 text-right text-[10px] tabular-nums text-[#00FBFF]/40 shrink-0">
              ${a.cost.toFixed(0)}
            </span>
          </button>
        );
      })}
      <div className="mt-2 pt-2 border-t border-[#00FBFF]/10 text-[10px] text-[#00FBFF]/40 px-2">
        🩸 leader: <span className="text-[#FFBE00]">{leader.handle}</span> · {leader.solved.length}/12 · first blood at{" "}
        {leader.firstBlood}
      </div>
    </div>
  );
}

function GridView({ ranked, onPick }: { ranked: Agent[]; onPick: (id: string) => void }) {
  return (
    <div className="p-2 grid grid-cols-4 gap-2 content-start">
      {ranked.map(a => (
        <button
          key={a.id}
          onClick={() => onPick(a.id)}
          className="text-left rounded border border-[#00FBFF]/15 bg-[#00090b] hover:border-[#00FBFF]/50 transition overflow-hidden group"
        >
          <div className="flex items-center gap-1.5 px-2 h-6 border-b border-[#00FBFF]/10 bg-[#001417]">
            <AgentBadge agent={a} />
            <span className="text-[10px] font-bold text-white truncate flex-1">{a.handle}</span>
            <StatusDot status={a.status} />
          </div>
          <div className="px-2 py-1.5 h-16 text-[9px] leading-tight text-[#00FBFF]/55 overflow-hidden">
            <div className="text-[#00FBFF]/30">
              C{a.current} · {a.solved.length}/12
            </div>
            <div className="truncate text-[#7fd8dd]">{a.preview}</div>
            <div className="text-[#00ff9c] animate-pulse">▋</div>
          </div>
          <div className="h-1 bg-[#00FBFF]/10">
            <div className="h-full" style={{ width: `${(a.solved.length / 12) * 100}%`, background: a.color }} />
          </div>
        </button>
      ))}
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
                <div className="flex items-center gap-1 mt-1">
                  <div className="h-1.5 flex-1 bg-[#00FBFF]/10 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(a.solved.length / 12) * 100}%`, background: a.color }}
                    />
                  </div>
                  <span className="text-[10px] text-[#00FBFF]/50 tabular-nums w-8 text-right">
                    {a.solved.length}/12
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

function ChallengeBoard({ agents, focused }: { agents: Agent[]; focused: Agent }) {
  const solvedCount = (id: number) => agents.filter(a => a.solved.includes(id)).length;
  return (
    <div className="h-[36%] flex flex-col">
      <SectionHead label="CHALLENGE BOARD" hint={`${focused.handle} highlighted`} />
      <div className="flex-1 min-h-0 overflow-y-auto console-scroll p-2 grid grid-cols-2 gap-1.5 content-start">
        {CHALLENGES.map(c => {
          const mine = focused.solved.includes(c.id);
          const isCurrent = focused.current === c.id;
          const count = solvedCount(c.id);
          return (
            <div
              key={c.id}
              className={`px-2 py-1.5 rounded border text-[11px] ${
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
              <div className="text-[#00FBFF]/40">{count}/20 cleared</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- FeedBar */

function FeedBar({ feed }: { feed: FeedItem[] }) {
  const latestFlag = feed.find(f => f.type === "flag");
  return (
    <div className="flex-1 min-w-0 bg-[#010607] flex flex-col">
      <div className="flex items-center gap-3 px-4 h-8 border-b border-[#00FBFF]/10 shrink-0">
        <span className="text-xs font-bold text-[#00FBFF]/60 tracking-widest">ARENA FEED</span>
        <span className="text-[10px] text-[#00FBFF]/30">flags · skills · events</span>
        {latestFlag && (
          <span className="ml-auto text-xs text-[#00ff9c] font-bold flag-flash truncate max-w-[50%]">
            LAST FLAG › {latestFlag.text}
          </span>
        )}
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
    <div className="w-[420px] shrink-0 border-l border-[#00FBFF]/20 bg-[#04080a] flex flex-col">
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
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 items-center pointer-events-none">
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    working: "#00FBFF",
    thinking: "#c084fc",
    exploiting: "#00ff9c",
    stuck: "#FF5861",
    submitting: "#FFBE00",
    idle: "#666",
  };
  const c = map[status] || "#00FBFF";
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ color: c, border: `1px solid ${c}55`, background: c + "12" }}
    >
      {status}
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
      .austin-bob {
        animation: bob 3s ease-in-out infinite;
      }
      @keyframes bob {
        0%,
        100% {
          transform: translateY(0) rotate(-2deg);
        }
        50% {
          transform: translateY(-6px) rotate(2deg);
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
      .flag-flash {
        animation: flagFlash 1.4s ease-in-out infinite;
      }
      @keyframes flagFlash {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.55;
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
