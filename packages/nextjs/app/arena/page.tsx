"use client";

import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArenaLobby } from "./Lobby";
import {
  AGENT_COUNT,
  Agent,
  AgentStatus,
  CHALLENGES,
  CHAT_LINES,
  CHAT_OPENERS_DIRECTED,
  CHAT_REPLIES,
  Challenge,
  ConsoleEntry,
  ConsoleEvent,
  DIFFICULTY_COLOR,
  DIRECTOR_REACTIONS,
  SKILLS,
  buildAgents,
  makeEvent,
  makeToolResult,
  rollPreview,
  seedConsole,
} from "./mockData";
import { type ArenaPhase, readPreviewState } from "./previewState";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

export const dynamic = "force-dynamic";

type FeedItem = {
  id: number;
  type: "flag" | "skill" | "blocked" | "resumed" | "done";
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
// Once the board is locked the operator can still flip back to the live arena
// layout to read the final numbers, so the result card is a view, not a phase.
type FinalView = "results" | "data";
type PodiumPlace = 1 | 2 | 3;

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

// Fold one console event into the observed agent's log. A tool result attaches
// to the LATEST unresolved call with the same id rather than the first, because
// harness call ids reset per process — first-match pairing could hand a dangling
// call from a crashed turn someone else's result. An unmatched or duplicate
// result stays a standalone row instead of being dropped.
function ingestConsole(entries: ConsoleEntry[], event: ConsoleEvent, id: number): ConsoleEntry[] {
  if (event.kind === "tool-result") {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.kind === "tool" && entry.toolCallId === event.toolCallId && !entry.result) {
        const next = [...entries];
        next[i] = { ...entry, result: { ok: event.ok, detail: event.text } };
        return next;
      }
    }
    const orphan: ConsoleEntry = { id, kind: "tool-result", text: event.text, toolCallId: event.toolCallId };
    return [...entries, orphan].slice(-70);
  }
  return [...entries, { ...event, id }].slice(-70);
}

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// `soft` is the translucent wash behind a podium row, `shadow`/`highlight` the
// two ends of the medal's metal gradient.
const PODIUM = {
  1: { tone: "#FFBE00", highlight: "#FFF1A6", shadow: "#8A5700", soft: "rgba(255,190,0,.16)", label: "GOLD" },
  2: { tone: "#CBD5E1", highlight: "#FFFFFF", shadow: "#64748B", soft: "rgba(203,213,225,.14)", label: "SILVER" },
  3: { tone: "#CD7F32", highlight: "#F5C28F", shadow: "#6B351C", soft: "rgba(205,127,50,.16)", label: "BRONZE" },
} as const;

// How long a podium finish stays on screen. Kept in step with the
// `podiumBroadcast` keyframes so the banner is never cut off mid-animation.
const FINISH_STING_MS = 4600;

const PODIUM_RESULT: Record<PodiumPlace, string> = {
  1: "ARENA CHAMPION",
  2: "SECOND PLACE SECURED",
  3: "THIRD PLACE SECURED",
};

// Flags first, then the clock for anyone who cleared the board, then who drew
// first blood soonest, then a stable id tiebreak. Cost is deliberately kept out
// of the tiebreak — it changes every tick, which would make the race rows swap
// (and animate) constantly for no real reason.
const rankAgents = (agents: Agent[]) =>
  [...agents].sort(
    (a, b) =>
      b.solved.length - a.solved.length ||
      (a.finishedAt !== null && b.finishedAt !== null ? a.finishedAt - b.finishedAt : 0) ||
      a.firstBlood.localeCompare(b.firstBlood) ||
      a.id.localeCompare(b.id),
  );

// Challenge #1 must be minted first; after that any remaining flag is fair game.
const nextTarget = (solved: number[]): number => {
  if (!solved.includes(1)) return 1;
  const remaining = CHALLENGES.filter(c => !solved.includes(c.id)).map(c => c.id);
  return remaining.length ? pick(remaining) : 1;
};

export default function ArenaPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [focusedId, setFocusedId] = useState<string>("agent-0");
  const [lines, setLines] = useState<ConsoleEntry[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [flashes, setFlashes] = useState<string[]>([]);
  const [openChallenge, setOpenChallenge] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [stageMode, setStageMode] = useState<"overview" | "focus">("overview");
  const [overviewTab, setOverviewTab] = useState<"race" | "grid">("race");
  // "lobby" = pre-game roster / connection screen, "live" = the running arena,
  // "finished" = every result locked and the board frozen.
  const [phase, setPhase] = useState<ArenaPhase>("lobby");
  const [finalView, setFinalView] = useState<FinalView>("results");
  // Seed on the client only — buildAgents() uses Math.random(), so running it
  // during SSR would hand the client a different roster than the server rendered.
  useEffect(() => {
    const roster = buildAgents();
    const preview = readPreviewState(roster, window.location.search);
    setMounted(true);
    if (!preview) {
      setAgents(roster);
      return;
    }
    setAgents(preview.agents);
    setClock(preview.clock);
    setPhase(preview.phase);
    if (!preview.finisher) return;
    const { index, at } = preview.finisher;
    const t = setTimeout(() => {
      setClock(at);
      setAgents(prev =>
        prev.map((a, i) =>
          i === index ? { ...a, solved: CHALLENGES.map(c => c.id), status: "done", finishedAt: at } : a,
        ),
      );
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  const agentsRef = useRef(agents);
  const focusRef = useRef(focusedId);
  const clockRef = useRef(clock);
  const lastSpeakerRef = useRef<Agent | null>(null);
  // Tool calls the observed agent is still waiting on, oldest first.
  const pendingCallsRef = useRef<string[]>([]);
  agentsRef.current = agents;
  focusRef.current = focusedId;
  clockRef.current = clock;

  // START MATCH — the agents come off the line and the clock starts only now.
  const startMatch = useCallback(() => {
    setAgents(prev => prev.map(a => ({ ...a, status: "working" })));
    setPhase("live");
  }, []);

  // Observe an agent's live log in the right column — the wide shot stays put.
  const goFocus = useCallback((id: string) => {
    setFocusedId(id);
    setStageMode("focus");
  }, []);
  const closeLog = useCallback(() => setStageMode("overview"), []);

  const focused = useMemo(() => agents.find(a => a.id === focusedId), [agents, focusedId]);
  const ranked = useMemo(() => rankAgents(agents), [agents]);
  const totalSolved = useMemo(() => agents.reduce((n, a) => n + a.solved.length, 0), [agents]);
  const finishedCount = useMemo(() => agents.filter(a => a.finishedAt !== null).length, [agents]);
  const allFinished = agents.length > 0 && finishedCount === agents.length;
  // The running clock can be a tick past the last finish; the board should show
  // the winning time, not whenever the interval happened to be torn down.
  const lastFinishAt = useMemo(() => agents.reduce((n, a) => Math.max(n, a.finishedAt ?? 0), 0), [agents]);

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
    pendingCallsRef.current = [];
    setLines(seedConsole(a).map(l => ({ ...l, id: nid() })));
  }, [focusedId]);

  // LIVE clock — runs between the start of the match and the last flag.
  useEffect(() => {
    if (phase !== "live" || allFinished) return;
    const t = setInterval(() => setClock(c => c + 1), 1000);
    return () => clearInterval(t);
  }, [phase, allFinished]);

  // Master simulation loop — dormant until the match starts, stopped for good
  // once the last agent is home.
  useEffect(() => {
    if (phase !== "live" || allFinished) return;

    // Mint one flag for an agent and announce it across the arena.
    const mint = (a: Agent, flagId: number) => {
      const ch = CHALLENGES[flagId - 1];
      if (!ch) return;
      setAgents(prev =>
        prev.map(x => {
          if (x.id !== a.id || x.solved.includes(flagId)) return x;
          const solved = [...x.solved, flagId];
          const finished = solved.length >= CHALLENGES.length;
          return {
            ...x,
            solved,
            current: finished ? x.current : nextTarget(solved),
            // Callers pick from the tick's opening snapshot, so an agent blocked
            // earlier in the same tick can still land here — clearing it would
            // leave a blocked row in the feed that never resolves.
            status: finished ? "done" : x.status === "blocked" ? "blocked" : "working",
            firstBlood: x.solved.length === 0 ? fmtClock(clockRef.current) : x.firstBlood,
            finishedAt: finished ? clockRef.current : x.finishedAt,
          };
        }),
      );
      pushFlash(`${a.id}:${flagId}`);
      pushFeed({
        type: "flag",
        agentId: a.id,
        color: a.color,
        text: `${a.handle} captured Challenge ${flagId} · ${ch.name}`,
      });
      if (a.solved.length + 1 >= CHALLENGES.length) {
        pushFeed({
          type: "done",
          agentId: a.id,
          color: a.color,
          text: `${a.handle} cleared the board in ${fmtClock(clockRef.current)} and exited`,
        });
      }
    };

    const setStatus = (id: string, status: AgentStatus) =>
      setAgents(prev => prev.map(x => (x.id === id ? { ...x, status } : x)));

    let tick = 0;
    const t = setInterval(() => {
      tick++;
      const list = agentsRef.current;

      // WARM-UP — flag #1 is the gate, so clear it for everyone in a quick burst
      // before the any-order race really gets going.
      const needFirst = list.filter(a => a.status === "working" && !a.solved.includes(1));
      if (needFirst.length) {
        needFirst.slice(0, 4).forEach(a => mint(a, 1));
      }

      // BLOCKED — the agent is sitting on a permission prompt. The arena runs a
      // dontAsk policy, so this should never fire: when it does, something broke
      // on the harness side and the board has to say so.
      if (tick % 17 === 0 && Math.random() < 0.3) {
        const stuck = pick(list.filter(a => a.status === "working"));
        if (stuck) {
          setStatus(stuck.id, "blocked");
          pushFeed({
            type: "blocked",
            agentId: stuck.id,
            color: stuck.color,
            text: `${stuck.handle} is blocked on a permission prompt`,
          });
        }
      }
      list
        .filter(a => a.status === "blocked" && Math.random() < 0.25)
        .forEach(a => {
          setStatus(a.id, "working");
          pushFeed({ type: "resumed", agentId: a.id, color: a.color, text: `${a.handle} unblocked, back to work` });
        });

      // stream console events for the focused agent, pairing tool results back
      // onto their call. Ids are minted out here so a StrictMode double-invoke of
      // the updater can't consume a pending call twice.
      const foc = list.find(a => a.id === focusRef.current);
      if (foc && foc.status === "working") {
        const tag = CHALLENGES[foc.current - 1]?.tag || "default";
        const event = makeEvent(foc, tag);
        const batch: { event: ConsoleEvent; id: number }[] = [{ event, id: nid() }];
        if (event.kind === "tool") pendingCallsRef.current.push(event.toolCallId);

        // Settle an outstanding call — but not always, so some rows sit on ⟳ for
        // a beat the way a real tool does.
        const pending = pendingCallsRef.current;
        if (pending.length && (pending.length >= 3 || Math.random() < 0.6)) {
          const result = makeToolResult(pending.shift() as string);
          if (result) batch.push({ event: result, id: nid() });
        }

        setLines(prev => batch.reduce((acc, b) => ingestConsole(acc, b.event, b.id), prev));
        if (event.kind === "skill") {
          pushFeed({ type: "skill", agentId: foc.id, color: foc.color, text: `${foc.handle} ${event.text}` });
        }
      }

      // token / cost burn + rolling mini-terminal preview for working agents
      setAgents(prev =>
        prev.map(a =>
          a.status !== "working"
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
          pushFeed({ type: "skill", agentId: a.id, color: a.color, text: `${a.handle} loaded skill » ${skill}` });
        }
      }

      // agent-to-agent chat — conversational, lands in the dedicated chat panel
      if (tick % 3 === 0) {
        const { msg, speaker } = genAgentChat(list, lastSpeakerRef.current);
        pushChat(msg);
        lastSpeakerRef.current = speaker;
      }

      // FLAG CAPTURE — a busy agent mints the flag it's currently working on.
      // Agents past the flag-#1 gate work a random remaining challenge, so
      // whatever they're on is what gets captured.
      if (tick % 6 === 0) {
        const candidates = list.filter(
          a => a.solved.includes(1) && a.solved.length < CHALLENGES.length && a.status === "working",
        );
        const a = candidates[Math.floor(Math.random() * candidates.length)];
        if (a) mint(a, a.current);
      }
    }, 950);
    return () => clearInterval(t);
  }, [phase, allFinished, pushFeed, pushChat, pushFlash]);

  // Hold on the frozen board long enough for the last flag pop and the podium
  // sting to finish playing, then cut to the result card.
  useEffect(() => {
    if (phase !== "live" || !allFinished) return;
    const t = setTimeout(() => setPhase("finished"), FINISH_STING_MS + 200);
    return () => clearTimeout(t);
  }, [phase, allFinished]);

  if (!mounted || !focused) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-[#00FBFF] font-dotGothic text-2xl tracking-widest">
        <span className="animate-pulse">◆ LOADING AGENT ARENA…</span>
      </div>
    );
  }

  if (phase === "lobby") {
    return <ArenaLobby agents={agents} onLaunch={startMatch} />;
  }

  if (phase === "finished" && finalView === "results") {
    return <FinalCeremony ranked={ranked} onViewData={() => setFinalView("data")} />;
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-[#00FBFF] font-mono overflow-hidden arena-root">
      <Scanlines />
      <TopBar
        clock={allFinished ? lastFinishAt : clock}
        totalSolved={totalSolved}
        finishedCount={finishedCount}
        allFinished={allFinished}
        onViewResults={phase === "finished" ? () => setFinalView("results") : undefined}
      />

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-1 min-h-0">
          {/* MAIN STAGE — always the wide shot, so observing an agent never hides the race */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-[#00FBFF]/20">
            <div className="flex-1 min-h-0 relative p-4">
              <div className="h-full flex flex-col border border-[#00FBFF]/25 rounded-lg bg-[#020a0c]/80 overflow-hidden shadow-[0_0_40px_-12px_rgba(0,251,255,0.4)]">
                <StageTabs tab={overviewTab} onTab={setOverviewTab} />
                <OverviewStage ranked={ranked} tab={overviewTab} onPick={goFocus} flashes={flashes} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — the unified arena stream; the observed agent's log takes over here */}
          <div className="w-[400px] flex flex-col min-h-0 min-w-0">
            {stageMode === "focus" ? (
              <AgentLog focused={focused} lines={lines} onClose={closeLog} />
            ) : (
              <ArenaStream feed={feed} chat={chat} onSend={sendDirector} archived={phase === "finished"} />
            )}
          </div>
        </div>

        {/* BOTTOM — full-width strip under both columns. Multiview fills its cards
            with terminals and no standings, so the race track runs along the bottom
            there; the race stage keeps the challenge board instead. */}
        {overviewTab === "grid" ? (
          <div className="shrink-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#010607]">
            <SectionHead label="RACE" hint="click to observe" />
            <div className="max-h-[42vh] overflow-y-auto console-scroll">
              <RaceView ranked={ranked} onPick={goFocus} flashes={flashes} compact />
            </div>
          </div>
        ) : (
          <ChallengeBoard agents={agents} focused={focused} onOpen={setOpenChallenge} />
        )}
      </div>

      {openChallenge !== null && (
        <ChallengeDetails
          challenge={CHALLENGES[openChallenge - 1]}
          agents={agents}
          onClose={() => setOpenChallenge(null)}
          onPickAgent={goFocus}
        />
      )}

      <ArenaStyles />
    </div>
  );
}

/* ---------------------------------------------------------- FinalCeremony */

// The end card: podium for the top three, then everyone else in finish order.
function FinalCeremony({ ranked, onViewData }: { ranked: Agent[]; onViewData: () => void }) {
  if (!ranked.length) return null;

  const rest = ranked.slice(3);
  const columnBreak = Math.ceil(rest.length / 2);
  const columns = [rest.slice(0, columnBreak), rest.slice(columnBreak)];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black text-[#00FBFF] font-mono final-root">
      <Scanlines />
      <div className="pointer-events-none absolute inset-0 z-10 final-victory-sweep" />

      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[#FFBE00]/25 bg-black/65 px-4 sm:px-5">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#00ff9c] sm:text-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ff9c] shadow-[0_0_10px_#00ff9c]" />
          MATCH COMPLETE
        </span>
        <div className="hidden font-dotGothic text-lg tracking-wide text-[#00FBFF] lg:block lg:text-xl">
          BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · FINAL TRANSMISSION
        </div>
        <button
          onClick={onViewData}
          className="ml-auto shrink-0 rounded border border-[#00FBFF]/30 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-[#00FBFF]/60 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
        >
          ARENA DATA ▸
        </button>
      </header>

      <main className="console-scroll relative z-20 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-8">
        <section className="final-lock-in mx-auto max-w-5xl text-center">
          <div className="text-[10px] font-bold tracking-[0.35em] text-[#00ff9c] sm:text-xs">
            ALL AGENT RESULTS COMMITTED
          </div>
          <h1 className="final-title mt-2 font-dotGothic text-3xl tracking-[0.12em] text-white sm:text-5xl">
            RESULTS LOCKED
          </h1>
        </section>

        <section className="mx-auto mt-10 grid max-w-4xl grid-cols-1 items-end gap-3 md:mt-14 md:grid-cols-3 md:gap-4">
          {ranked.slice(0, 3).map((agent, i) => (
            <FinalistCard key={agent.id} agent={agent} place={(i + 1) as PodiumPlace} />
          ))}
        </section>

        {rest.length > 0 && (
          <section className="mx-auto mt-8 max-w-5xl pb-5 md:mt-10">
            <div className="mb-3 flex items-center gap-3 text-[11px] font-bold tracking-[0.24em] text-[#00FBFF]/45 sm:text-xs">
              <span>FINAL STANDINGS</span>
              <span className="h-px flex-1 bg-[#00FBFF]/15" />
              <span>{ranked.length} RESULTS</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {columns.map((column, columnIndex) => (
                <div key={columnIndex} className="flex flex-col gap-2">
                  {column.map((agent, i) => {
                    const place = (columnIndex === 0 ? i : columnBreak + i) + 4;
                    return (
                      <div
                        key={agent.id}
                        className="final-result-in flex min-h-16 items-center gap-2 rounded-md border border-[#00FBFF]/15 bg-[#001014]/60 px-3 sm:gap-3 sm:px-4"
                        style={{ animationDelay: `${1.15 + (place - 4) * 0.08}s` }}
                      >
                        <span className="race-final-position w-7 text-center font-dotGothic text-base text-[#00ff9c] sm:text-lg">
                          {place}
                        </span>
                        <AgentBlockieLink agent={agent} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-white">{agent.handle}</div>
                          <div className="mt-0.5 truncate text-[11px] text-[#00FBFF]/40 sm:text-xs">
                            {agent.harness} · {agent.model}
                          </div>
                        </div>
                        <span className="hidden shrink-0 text-xs text-[#00FBFF]/40 min-[430px]:inline">
                          {agent.solved.length} FLAGS
                        </span>
                        <span className="w-[78px] shrink-0 text-right text-sm font-bold tabular-nums text-[#00ff9c] sm:text-base">
                          {fmtClock(agent.finishedAt ?? 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <ArenaStyles />
    </div>
  );
}

function FinalistCard({ agent, place }: { agent: Agent; place: PodiumPlace }) {
  const winner = place === 1;
  const podium = PODIUM[place];
  // The champion sits centre and raised, silver left, bronze right — but only
  // once the three cards are actually side by side.
  const layout = place === 1 ? "md:order-2 md:-translate-y-5" : place === 2 ? "md:order-1" : "md:order-3";
  const delay = place === 2 ? 0.35 : place === 1 ? 0.65 : 0.95;

  return (
    <div className={layout}>
      <article
        className={`final-card-in relative overflow-hidden rounded-xl border bg-[#020a0c]/95 px-4 py-4 text-center ${
          winner ? "final-winner-card min-h-[224px] sm:px-6 sm:py-5" : "min-h-[184px]"
        }`}
        style={{
          borderColor: podium.tone,
          boxShadow: winner ? "0 0 44px -10px rgba(255,190,0,.6)" : `0 0 30px -14px ${podium.tone}`,
          animationDelay: `${delay}s`,
        }}
      >
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: podium.tone }} />
        <div className="flex min-h-10 items-start justify-between gap-3 text-left">
          <div className="text-[9px] font-bold tracking-[0.28em]" style={{ color: podium.tone }}>
            {winner ? PODIUM_RESULT[1] : `FINAL PLACE ${place}`}
          </div>
          <PodiumMedal place={place} size={winner ? "lg" : "md"} animate />
        </div>
        {/* The orbit ring sits outside the avatar's box, so it needs its own
            wrapper — clipping the blockie into a circle would clip the ring too. */}
        <div className={`relative mx-auto mt-1 ${winner ? "h-20 w-20 final-winner-orbit" : "h-14 w-14"}`}>
          <div
            className="h-full w-full overflow-hidden rounded-full border-2"
            style={{ borderColor: agent.color, background: `${agent.color}14` }}
          >
            <BlockieAvatar address={agent.address} ensImage={null} size={winner ? 76 : 52} />
          </div>
        </div>
        <div className={`mt-3 truncate font-bold text-white ${winner ? "text-base sm:text-lg" : "text-sm"}`}>
          {agent.handle}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-[#00FBFF]/40">
          {agent.harness} · {agent.model}
        </div>
        <div
          className={`mt-3 font-dotGothic tabular-nums ${
            winner ? "text-xl text-[#FFBE00]" : "text-base text-[#00ff9c]"
          }`}
        >
          {fmtClock(agent.finishedAt ?? 0)}
        </div>
        <div className="mt-1 text-[9px] tracking-[0.16em] text-[#00FBFF]/30">
          {agent.solved.length}/{CHALLENGES.length} FLAGS · ${agent.cost.toFixed(2)}
        </div>
      </article>
    </div>
  );
}

// Gradient ids have to be unique per instance — several medals share a page and
// `url(#id)` resolves against the first match, so a fixed id would repaint every
// medal in gold. useId keeps that stable across SSR and hydration.
function PodiumMedal({
  place,
  size = "md",
  animate = false,
  className = "",
}: {
  place: PodiumPlace;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}) {
  const podium = PODIUM[place];
  const base = useId().replace(/:/g, "");
  const metalId = `${base}-metal`;
  const ribbonId = `${base}-ribbon`;
  const sizeClass = size === "lg" ? "h-16 w-14" : size === "sm" ? "h-8 w-7" : "h-12 w-10";

  return (
    <svg
      className={`podium-medal-svg ${sizeClass} ${animate ? "podium-medal-pop" : ""} ${className}`}
      style={{ "--podium-tone": podium.tone, "--podium-soft": podium.soft } as CSSProperties}
      viewBox="0 0 64 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>
        {podium.label} medal, place {place}
      </title>
      <defs>
        <linearGradient id={ribbonId} x1="10" y1="2" x2="50" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B353A" />
          <stop offset="0.46" stopColor="#031B1F" />
          <stop offset="1" stopColor={podium.shadow} />
        </linearGradient>
        <linearGradient id={metalId} x1="17" y1="29" x2="48" y2="69" gradientUnits="userSpaceOnUse">
          <stop stopColor={podium.highlight} />
          <stop offset="0.38" stopColor={podium.tone} />
          <stop offset="1" stopColor={podium.shadow} />
        </linearGradient>
      </defs>

      <path d="M12 2H29L36 31L21 38L12 2Z" fill={`url(#${ribbonId})`} stroke={podium.tone} strokeWidth="1.5" />
      <path d="M35 2H52L43 38L28 31L35 2Z" fill={`url(#${ribbonId})`} stroke={podium.tone} strokeWidth="1.5" />
      <path d="M18 3H23L29 31L24 33L18 3Z" fill={podium.highlight} opacity="0.2" />
      <path d="M41 3H47L40 33L35 31L41 3Z" fill={podium.highlight} opacity="0.16" />

      <circle cx="32" cy="50" r="23" fill="#020708" stroke={podium.shadow} strokeWidth="2" />
      <circle cx="32" cy="50" r="20" fill={`url(#${metalId})`} stroke={podium.highlight} strokeWidth="1.5" />
      <circle cx="32" cy="50" r="15.5" fill="#051013" fillOpacity="0.92" stroke={podium.shadow} strokeWidth="1.25" />
      <path
        d="M19.8 43.5C22.3 37.2 28.7 33.2 35.5 34"
        stroke={podium.highlight}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M45.5 57.5C42.8 63.1 37.1 66.5 30.9 66"
        stroke={podium.shadow}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <text x="32" y="57" fill={podium.tone} textAnchor="middle" fontFamily="monospace" fontSize="22" fontWeight="900">
        {place}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ TopBar */

// `onViewResults` is only handed over once the match is locked — it doubles as
// the signal that the board is an archive and needs a way back to the podium.
function TopBar({
  clock,
  totalSolved,
  finishedCount,
  allFinished,
  onViewResults,
}: {
  clock: number;
  totalSolved: number;
  finishedCount: number;
  allFinished: boolean;
  onViewResults?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 h-14 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] shrink-0">
      <span
        className={`flex items-center gap-2 font-bold tracking-widest ${
          allFinished ? "text-[#00ff9c]" : "text-[#FF5861]"
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${allFinished ? "bg-[#00ff9c]" : "bg-[#FF5861] live-dot"}`} />
        {allFinished ? "LOCKED" : "LIVE"}
      </span>
      <div className="hidden sm:block font-dotGothic text-xl md:text-2xl text-[#00FBFF] tracking-wide title-glow">
        BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENT ARENA
      </div>
      <div className="hidden 2xl:flex items-center gap-1 text-xs text-[#00FBFF]/50">
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{AGENT_COUNT} AGENTS</span>
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{CHALLENGES.length} CHALLENGES</span>
      </div>
      <div className="ml-auto flex items-center gap-4 text-sm">
        {onViewResults && (
          <button
            onClick={onViewResults}
            className="px-2.5 py-1 rounded border border-[#FFBE00]/50 text-[#FFBE00] text-[10px] font-bold tracking-[0.12em] hover:bg-[#FFBE00]/10 transition"
          >
            ◆ RESULTS
          </button>
        )}
        <span className="hidden md:inline text-[#00FBFF]/60">
          🏁 <span className="text-[#00ff9c] font-bold">{totalSolved}</span> flags
        </span>
        <span className={finishedCount ? "text-[#00ff9c] font-bold" : "text-[#00FBFF]/45"}>
          ◆ {finishedCount}/{AGENT_COUNT}
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
];

function StageTabs({ tab, onTab }: { tab: OverviewTab; onTab: (t: OverviewTab) => void }) {
  return (
    <div className="flex items-center gap-2 px-4 h-11 border-b border-[#00FBFF]/20 bg-[#001417] shrink-0">
      <span className="font-dotGothic text-[#00FBFF]/70 mr-2">WIDE SHOT</span>
      {STAGE_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          title={t.label}
          className={`px-3 py-1 rounded text-xs font-bold tracking-wider transition ${
            tab === t.id
              ? "bg-[#00FBFF]/15 text-[#00FBFF] border border-[#00FBFF]/50"
              : "text-[#00FBFF]/45 border border-transparent hover:text-[#00FBFF]"
          }`}
        >
          {t.label}
        </button>
      ))}
      <span className="ml-auto text-[10px] text-[#00FBFF]/35">click any agent → observe its log ▸</span>
    </div>
  );
}

/* ---------------------------------------------------------------- AgentLog */

// The observer console for one agent — lives in the right column so the wide
// shot behind it keeps running.
function AgentLog({ focused, lines, onClose }: { focused: Agent; lines: ConsoleEntry[]; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const ch = CHALLENGES[focused.current - 1];
  const finished = focused.finishedAt !== null;

  return (
    <div className="flex-1 min-h-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#020a0c]">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0 text-xs">
        <AgentBlockieLink agent={focused} />
        <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{focused.handle}</span>
        <StatusChip status={focused.status} />
        {finished ? (
          <span className="px-1.5 py-0.5 rounded font-bold shrink-0 text-[10px] text-[#00ff9c] border border-[#00ff9c]/40">
            LOCKED · {fmtClock(focused.finishedAt ?? 0)}
          </span>
        ) : (
          <span
            className="px-1.5 py-0.5 rounded font-bold shrink-0 text-[10px] max-w-[110px] truncate"
            title={`#${ch.id} ${ch.name}`}
            style={{ color: DIFFICULTY_COLOR[ch.difficulty], border: `1px solid ${DIFFICULTY_COLOR[ch.difficulty]}55` }}
          >
            #{ch.id} {ch.name}
          </span>
        )}
        <span className="ml-auto text-[#00ff9c] font-bold shrink-0">
          {focused.solved.length}/{CHALLENGES.length}
        </span>
        <button
          onClick={onClose}
          title="back to arena feed"
          className="w-6 h-6 shrink-0 rounded border border-[#00FBFF]/25 text-[#00FBFF]/60 hover:text-[#00FBFF] hover:border-[#00FBFF] transition"
        >
          ✕
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-[12px] leading-relaxed console-scroll"
      >
        {lines.map(l => (
          <ConsoleRow key={l.id} line={l} />
        ))}
        {finished ? (
          <div className="mt-2 border-t border-[#00ff9c]/20 pt-2 text-[#00ff9c] font-bold">
            ◆ SESSION COMPLETE · RESULT COMMITTED
          </div>
        ) : (
          <div className="text-[#00ff9c] animate-pulse">▋</div>
        )}
      </div>
    </div>
  );
}

// A tool is one row that starts running and settles to ok/fail, keeping both the
// command and its output — the call and the result are separate events upstream,
// paired here by `toolCallId`.
function ConsoleRow({ line }: { line: ConsoleEntry }) {
  if (line.kind === "think") return <div className="text-[#7fd8dd] italic">· {line.text}</div>;
  if (line.kind === "skill") return <div className="text-[#c084fc] font-bold">⚡ {line.text}</div>;
  if (line.kind === "flag") return <div className="text-[#00ff9c] font-bold">🏁 {line.text}</div>;
  if (line.kind === "tool") {
    const state = !line.result ? "running" : line.result.ok ? "ok" : "fail";
    const color = state === "running" ? "#FFBE00" : state === "ok" ? "#00ff9c" : "#FF5861";
    return (
      <div>
        <div className="text-[#00FBFF]">
          <span
            className={state === "running" ? "animate-pulse" : ""}
            style={{ color }}
            title={`${line.tool} ${state}`}
          >
            {state === "running" ? "⟳" : state === "ok" ? "✓" : "✗"}
          </span>{" "}
          <span className="text-[#00ff9c]">$</span> {line.text}
        </div>
        {line.result && (
          <div className={`pl-4 break-all ${state === "fail" ? "text-[#FF5861]/70" : "text-[#00FBFF]/55"}`}>
            → {line.result.detail}
          </div>
        )}
      </div>
    );
  }
  // A result with no matching call — kept rather than dropped, same as upstream.
  return <div className="text-[#00FBFF]/55 pl-4 break-all">→ {line.text}</div>;
}

/* ------------------------------------------------------------ OverviewStage */

type OverviewTab = "race" | "grid";

function OverviewStage({
  ranked,
  tab,
  onPick,
  flashes,
}: {
  ranked: Agent[];
  tab: OverviewTab;
  onPick: (id: string) => void;
  flashes: string[];
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto console-scroll">
      {tab === "race" && <RaceView ranked={ranked} onPick={onPick} flashes={flashes} />}
      {tab === "grid" && <GridView ranked={ranked} onPick={onPick} />}
    </div>
  );
}

// `compact` is the bottom-strip variant used under multiview: same track, tighter
// rows and no harness badge so all ten agents fit without scrolling.
function RaceView({
  ranked,
  onPick,
  flashes,
  compact,
}: {
  ranked: Agent[];
  onPick: (id: string) => void;
  flashes: string[];
  compact?: boolean;
}) {
  const total = CHALLENGES.length;
  const rowGap = compact ? "gap-2" : "gap-3";
  const cellH = compact ? "h-4" : "h-5";
  const done = (a: Agent) => a.solved.length >= total;
  // Columns are mint-order slots, not fixed challenges — slot k holds the k-th
  // flag an agent minted, so a row reads left-to-right as its capture history.
  const slots = Array.from({ length: total }, (_, k) => k);

  // FLIP: when the ranking changes, slide each row from where it was to where it
  // now sits so a rank change reads as a physical move up (or down) the board.
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const prevTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    rowRefs.current.forEach((el, id) => {
      const newTop = el.offsetTop; // offsetTop ignores transforms → safe mid-animation
      const oldTop = prevTops.current.get(id);
      prevTops.current.set(id, newTop);
      if (oldTop === undefined || oldTop === newTop) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${oldTop - newTop}px)`;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.transition = "transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)";
          el.style.transform = "";
        }),
      );
    });
  });

  // Grabbing the #1 spot gets its own celebratory glow — a normal row move up
  // shouldn't feel the same as taking the lead.
  const [leadTaker, setLeadTaker] = useState<string | null>(null);
  const prevLeader = useRef<string | undefined>(undefined);
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const leader = ranked[0]?.id;
    if (leader && prevLeader.current !== undefined && leader !== prevLeader.current) {
      setLeadTaker(leader);
      if (leadTimer.current) clearTimeout(leadTimer.current);
      leadTimer.current = setTimeout(() => setLeadTaker(null), 1800);
    }
    prevLeader.current = leader;
  }, [ranked]);
  useEffect(() => () => void (leadTimer.current && clearTimeout(leadTimer.current)), []);

  // A podium finish gets a broadcast sting. Whoever has already finished when
  // this view mounts is recorded silently, so switching tabs (or landing on a
  // frozen board) never replays a celebration that already aired.
  const [sting, setSting] = useState<{ key: string; agent: Agent; place: PodiumPlace } | null>(null);
  const seenFinishers = useRef<Set<string> | null>(null);
  const stingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const finishers = ranked.filter(a => a.solved.length >= total);
    if (seenFinishers.current === null) {
      seenFinishers.current = new Set(finishers.map(a => a.id));
      return;
    }
    const seen = seenFinishers.current;
    // Take the best-placed newcomer: two agents can land in the same tick and
    // only one banner fits, so the higher step of the podium wins it.
    const newcomer = finishers.find(a => !seen.has(a.id));
    finishers.forEach(a => seen.add(a.id));
    if (!newcomer) return;

    const place = ranked.indexOf(newcomer) + 1;
    if (place > 3) return;
    if (stingTimer.current) clearTimeout(stingTimer.current);
    setSting({ key: `${newcomer.id}:${newcomer.finishedAt ?? 0}`, agent: newcomer, place: place as PodiumPlace });
    stingTimer.current = setTimeout(() => setSting(null), FINISH_STING_MS);
  }, [ranked, total]);
  useEffect(() => () => void (stingTimer.current && clearTimeout(stingTimer.current)), []);

  return (
    <div className={`relative ${compact ? "p-2 space-y-[2px]" : "p-3 space-y-1"}`}>
      {sting && <RaceFinishSting key={sting.key} agent={sting.agent} place={sting.place} />}

      {/* ruler — one column per flag minted, in capture order */}
      <div className={`flex items-center ${rowGap} px-2 pb-1`}>
        <span className="w-8 shrink-0" />
        <span className="w-3 shrink-0" />
        <span className={`${compact ? "w-5" : "w-6"} shrink-0`} />
        <span className={`${compact ? "w-40" : "w-44"} shrink-0 text-[9px] tracking-widest text-[#00FBFF]/25`}>
          AGENT · MINTS →
        </span>
        <span className="w-12 shrink-0 text-right text-[9px] tracking-widest text-[#00FBFF]/25">TOK</span>
        <span className="w-14 shrink-0 text-right text-[9px] tracking-widest text-[#00FBFF]/25">COST</span>
        <div className="flex-1 flex gap-[3px]">
          {slots.map(k => (
            <span
              key={k}
              title={`${k + 1}. flag minted`}
              className="flex-1 text-center text-[9px] font-bold tabular-nums text-[#00FBFF]/25"
            >
              {k + 1}
            </span>
          ))}
        </div>
        <span className="w-20 shrink-0 text-right text-[9px] tracking-widest text-[#00FBFF]/25">RESULT</span>
      </div>

      {ranked.map((a, i) => {
        // Podium dressing is only earned by finishing — leading on flags alone
        // keeps the plain crown, because the order can still change.
        const place = done(a) && i < 3 ? ((i + 1) as PodiumPlace) : null;
        const podium = place ? PODIUM[place] : null;
        const celebrating = sting?.agent.id === a.id;
        return (
          // A div, not a button: the row holds the explorer link on the blockie and
          // an anchor inside a button is invalid markup.
          <div
            key={a.id}
            ref={el => {
              if (el) rowRefs.current.set(a.id, el);
              else rowRefs.current.delete(a.id);
            }}
            role="button"
            tabIndex={0}
            onClick={() => onPick(a.id)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(a.id);
              }
            }}
            className={`relative w-full flex items-center ${rowGap} px-2 ${
              compact ? "py-[2px]" : "py-1.5"
            } rounded hover:bg-[#00FBFF]/5 will-change-transform text-left group cursor-pointer ${
              leadTaker === a.id ? "lead-take" : ""
            } ${done(a) ? "agent-finish-row" : ""} ${place ? `race-podium-row race-podium-${place}` : ""} ${
              celebrating ? "race-podium-celebrate" : ""
            }`}
            style={
              podium ? ({ "--podium-tone": podium.tone, "--podium-soft": podium.soft } as CSSProperties) : undefined
            }
          >
            {done(a) && !place && (
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-[#00ff9c] shadow-[0_0_10px_rgba(0,255,156,0.9)]"
              />
            )}
            <span
              className={`flex w-8 shrink-0 items-center justify-center text-center text-xs font-bold tabular-nums ${
                place
                  ? ""
                  : done(a)
                  ? "race-final-position text-[#00ff9c]"
                  : i === 0
                  ? "text-[#FFBE00]"
                  : i < 3
                  ? "text-[#00ff9c]"
                  : "text-[#00FBFF]/40"
              }`}
            >
              {place ? (
                // The sting shows a big medal of its own; hiding the row's copy
                // keeps the two from reading as two different awards.
                <PodiumMedal place={place} size="sm" animate={celebrating} className={celebrating ? "invisible" : ""} />
              ) : i === 0 ? (
                <span className={`inline-block ${leadTaker === a.id ? "crown-pop" : ""}`}>👑</span>
              ) : (
                i + 1
              )}
            </span>
            <StatusDot status={a.status} />
            <AgentBlockieLink agent={a} compact={compact} />
            <span
              className={`${compact ? "w-40 text-xs" : "w-44 text-sm"} truncate font-bold text-white shrink-0`}
              title={`${a.harness} + ${a.model}`}
            >
              {a.handle}
            </span>
            <span className="w-12 text-right text-[11px] tabular-nums shrink-0 text-[#00FBFF]/55">
              {(a.tokens / 1000).toFixed(0)}k
            </span>
            <span className="w-14 text-right text-[11px] tabular-nums shrink-0 text-[#FFBE00]/70">
              ${a.cost.toFixed(2)}
            </span>

            {/* each square shows the flag number minted at that step; the next
                square is the challenge being worked, the rest are flags left */}
            <div className="flex-1 flex gap-[3px]">
              {slots.map(k => {
                const flagId = a.solved[k];
                if (flagId !== undefined) {
                  const ch = CHALLENGES[flagId - 1];
                  const flashing = flashes.includes(`${a.id}:${flagId}`);
                  return (
                    <span
                      key={k}
                      title={`#${flagId} ${ch?.name ?? ""} · minted ${k + 1} of ${total}`}
                      className={`relative flex-1 ${cellH} rounded-[3px] border flex items-center justify-center text-[9px] font-bold tabular-nums transition-colors ${
                        flashing ? "flag-pop" : ""
                      }`}
                      style={{ background: a.color, borderColor: a.color, color: "#00181c" }}
                    >
                      {flagId}
                    </span>
                  );
                }
                if (k === a.solved.length && !done(a)) {
                  const ch = CHALLENGES[a.current - 1];
                  const dc = ch ? DIFFICULTY_COLOR[ch.difficulty] : "#00FBFF";
                  return (
                    <span
                      key={k}
                      title={
                        a.status === "working"
                          ? `working on #${a.current} ${ch?.name ?? ""}`
                          : `#${a.current} ${ch?.name ?? ""} — ${STATUS_STYLE[a.status].label}`
                      }
                      className={`relative flex-1 ${cellH} rounded-[3px] border flex items-center justify-center text-[9px] font-bold tabular-nums ${
                        a.status === "working" ? "cell-working" : "opacity-40"
                      }`}
                      style={{ background: `${dc}1f`, borderColor: dc, color: dc }}
                    >
                      {a.current}
                    </span>
                  );
                }
                return (
                  <span
                    key={k}
                    title="flag not minted yet"
                    className={`relative flex-1 ${cellH} rounded-[3px] border`}
                    style={{ background: "#00fbff08", borderColor: "#00fbff1a" }}
                  />
                );
              })}
            </div>

            <span className="w-20 text-right text-xs tabular-nums shrink-0 text-[#00FBFF]/70">
              {done(a) ? (
                <span className="agent-finish-time font-bold" style={{ color: podium?.tone ?? "#00ff9c" }}>
                  ◆ {fmtClock(a.finishedAt ?? 0)}
                </span>
              ) : (
                `${a.solved.length}/${total}`
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// The broadcast overlay for a podium finish — sits over the top of the track for
// a few seconds, the way a race feed cuts to a result graphic.
function RaceFinishSting({ agent, place }: { agent: Agent; place: PodiumPlace }) {
  const podium = PODIUM[place];
  return (
    <div
      className="podium-broadcast pointer-events-none absolute inset-x-0 top-0 z-30 w-full overflow-hidden rounded-lg border bg-[#020708] shadow-2xl"
      style={{ "--podium-tone": podium.tone, "--podium-soft": podium.soft } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <span className="podium-broadcast-sweep absolute inset-0" />
      <span className="podium-broadcast-line absolute inset-x-0 top-0 h-1" />
      <div className="relative flex items-center gap-4 px-5 py-4 sm:px-7 sm:py-5">
        <PodiumMedal place={place} size="lg" animate className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold tracking-[0.32em] sm:text-[10px]" style={{ color: podium.tone }}>
            {podium.label} FINISH · RESULT LOCKED
          </div>
          <div className="mt-1 truncate font-dotGothic text-xl tracking-wide text-white sm:text-2xl">
            {PODIUM_RESULT[place]}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm">
            <span className="truncate font-bold text-white">{agent.handle}</span>
            <span className="text-[#00FBFF]/30">/</span>
            <span className="shrink-0 font-dotGothic tabular-nums" style={{ color: podium.tone }}>
              {fmtClock(agent.finishedAt ?? 0)}
            </span>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="font-dotGothic text-4xl leading-none" style={{ color: podium.tone }}>
            0{place}
          </div>
          <div className="mt-1 text-[8px] font-bold tracking-[0.24em] text-[#00FBFF]/35">PODIUM</div>
        </div>
      </div>
    </div>
  );
}

function GridView({ ranked, onPick }: { ranked: Agent[]; onPick: (id: string) => void }) {
  return (
    <div className="h-full p-2 grid grid-cols-5 auto-rows-fr gap-2">
      {ranked.map(a => {
        const ch = CHALLENGES[a.current - 1];
        const finished = a.finishedAt !== null;
        return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => onPick(a.id)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(a.id);
              }
            }}
            className={`min-h-0 flex flex-col text-left rounded border bg-[#00090b] hover:border-[#00FBFF]/50 transition overflow-hidden group cursor-pointer ${
              a.status === "blocked" ? "border-[#FFBE00]/60" : "border-[#00FBFF]/15"
            }`}
          >
            <div className="flex items-center gap-1.5 px-2 h-8 shrink-0 border-b border-[#00FBFF]/10 bg-[#001417]">
              <AgentBlockieLink agent={a} />
              <span className="text-[13px] font-bold text-white truncate flex-1">{a.handle}</span>
              <StatusDot status={a.status} />
            </div>
            <div className="flex items-center gap-2 px-2 h-6 shrink-0 text-[11px] border-b border-[#00FBFF]/[0.07] bg-[#000d0f]">
              <span className="truncate" style={{ color: finished ? "#00ff9c" : DIFFICULTY_COLOR[ch.difficulty] }}>
                {finished ? `◆ FINISHED · ${fmtClock(a.finishedAt ?? 0)}` : `C${ch.id} ${ch.name}`}
              </span>
              <span className="ml-auto shrink-0 text-[#00FBFF]/45 tabular-nums">
                {a.solved.length}/{CHALLENGES.length}
              </span>
            </div>
            {/* rolling console — newest line sits at the bottom, or the exit
                notice once the agent has cleared the board */}
            <div
              className={`flex-1 min-h-0 flex flex-col justify-end overflow-hidden px-2 py-1 text-[11px] leading-[1.5] ${
                finished ? "agent-terminal-locked" : ""
              }`}
            >
              {finished ? (
                <>
                  <div className="text-[#00FBFF]/35">all challenge processes exited</div>
                  <div className="text-[#00ff9c] font-bold">result committed ✓</div>
                </>
              ) : (
                <>
                  {a.preview.map((line, k) => (
                    <div key={k} className="truncate text-[#7fd8dd]/80">
                      {line}
                    </div>
                  ))}
                  <div className="text-[#00ff9c] animate-pulse shrink-0">▋</div>
                </>
              )}
            </div>
            <div className="h-1 shrink-0 bg-[#00FBFF]/10">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${(a.solved.length / CHALLENGES.length) * 100}%`, background: a.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------- ChallengeBoard */

function ChallengeBoard({
  agents,
  focused,
  onOpen,
}: {
  agents: Agent[];
  focused: Agent;
  onOpen: (id: number) => void;
}) {
  const solvedCount = (id: number) => agents.filter(a => a.solved.includes(id)).length;
  return (
    <div className="h-48 shrink-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#010607]">
      <SectionHead label="CHALLENGE BOARD" hint="click for details" />
      <div className="flex-1 min-h-0 overflow-y-auto console-scroll p-2 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 content-start">
        {CHALLENGES.map(c => {
          const mine = focused.solved.includes(c.id);
          const isCurrent = focused.finishedAt === null && focused.current === c.id;
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
  const onIt = agents.filter(
    a => !a.solved.includes(challenge.id) && a.current === challenge.id && a.status === "working",
  );
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

/* -------------------------------------------------------------- ArenaStream */

type StreamFilter = "all" | "chat" | "flags" | "events";
type StreamRow =
  | { id: number; group: "chat"; msg: ChatMsg }
  | { id: number; group: "flags" | "events"; item: FeedItem };

const STREAM_FILTERS: { id: StreamFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "chat", label: "CHAT" },
  { id: "flags", label: "FLAGS" },
  { id: "events", label: "EVENTS" },
];

// Feed events and agent/director chat merged into one chronological stream, so
// the whole arena reads back like a single timeline with a large history.
function ArenaStream({
  feed,
  chat,
  onSend,
  archived = false,
}: {
  feed: FeedItem[];
  chat: ChatMsg[];
  onSend: (t: string) => void;
  archived?: boolean;
}) {
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // ids come from a single monotonic counter, so sorting by id restores order.
  const merged = useMemo<StreamRow[]>(() => {
    const chatRows: StreamRow[] = chat.map(m => ({ id: m.id, group: "chat", msg: m }));
    const feedRows: StreamRow[] = feed.map(item => ({
      id: item.id,
      group: item.type === "flag" ? "flags" : "events",
      item,
    }));
    return [...chatRows, ...feedRows].sort((a, b) => a.id - b.id);
  }, [feed, chat]);

  const rows = merged.filter(r => filter === "all" || r.group === filter);

  // Follow on the newest row's id, not the row count: feed and chat are capped
  // (40 / 60), so once both saturate the count stops changing while rows keep
  // arriving — keying on length would strand the viewport for the rest of the run.
  const newestRowId = rows.length ? rows[rows.length - 1].id : 0;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [newestRowId]);

  const submit = () => {
    onSend(draft);
    setDraft("");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#010607]">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0">
        <span className="text-xs font-bold text-[#00FBFF] tracking-widest">ARENA</span>
        <div className="ml-auto flex items-center gap-1">
          {STREAM_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition ${
                filter === f.id
                  ? "bg-[#00FBFF]/15 text-[#00FBFF] border border-[#00FBFF]/40"
                  : "text-[#00FBFF]/40 border border-transparent hover:text-[#00FBFF]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto console-scroll px-3 py-1.5 text-xs space-y-1">
        {rows.length === 0 && <div className="text-[#00FBFF]/30 italic">waiting for the arena to heat up…</div>}
        {rows.map(r =>
          r.group === "chat" ? <ChatRow key={r.id} msg={r.msg} /> : <FeedRow key={r.id} item={r.item} />,
        )}
      </div>

      <div className="flex items-center gap-2 px-2 py-2 border-t border-[#00FBFF]/15 shrink-0">
        <span className="text-[10px] text-[#FFBE00] font-bold shrink-0">🎬 DIRECTOR</span>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") submit();
          }}
          disabled={archived}
          placeholder={archived ? "match complete · stream archived" : "broadcast a message to all agents…"}
          className="flex-1 min-w-0 bg-[#00181c] border border-[#00FBFF]/20 rounded px-2 py-1 text-xs text-white placeholder-[#00FBFF]/25 focus:outline-none focus:border-[#FFBE00]/60 disabled:cursor-not-allowed disabled:opacity-55"
        />
        <button
          onClick={submit}
          disabled={archived}
          className="px-2.5 py-1 rounded border border-[#FFBE00]/50 text-[#FFBE00] text-xs font-bold hover:bg-[#FFBE00]/10 transition shrink-0 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {archived ? "ARCHIVED" : "SEND"}
        </button>
      </div>
    </div>
  );
}

const FEED_STYLE: Record<FeedItem["type"], { icon: string; cls: string }> = {
  flag: { icon: "🏁", cls: "text-[#00ff9c] font-bold" },
  skill: { icon: "⚡", cls: "text-[#c084fc]" },
  blocked: { icon: "⚠", cls: "text-[#FFBE00] font-bold" },
  resumed: { icon: "▶", cls: "text-[#00FBFF]/70" },
  // Clearing the board is the loudest thing an agent can do, so it outranks a
  // single flag capture in the stream.
  done: { icon: "◆", cls: "text-[#FFBE00] font-bold" },
};

function FeedRow({ item }: { item: FeedItem }) {
  const { icon, cls } = FEED_STYLE[item.type] ?? { icon: "💬", cls: "text-[#00FBFF]/70" };
  return (
    <div className="flex items-start gap-2 feed-in">
      <span className="w-2 h-2 mt-1 rounded-sm shrink-0" style={{ background: item.color }} />
      <span className={cls}>
        {icon} {item.text}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- ChatRow */

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

/* ----------------------------------------------------------------- Shared */

// `blocked` and `done` are the two the director has to be able to spot without
// opening a close-up, so both get a glyph and a colour of their own.
const STATUS_STYLE: Record<AgentStatus, { glyph: string; color: string; label: string }> = {
  working: { glyph: "▶", color: "#00ff9c", label: "working" },
  idle: { glyph: "•", color: "#3d7c80", label: "idle — alive, nothing in flight" },
  blocked: { glyph: "⚠", color: "#FFBE00", label: "blocked — waiting on a permission prompt" },
  done: { glyph: "◆", color: "#7fd8dd", label: "done — the arena consumed its exit" },
};

function StatusDot({ status }: { status: AgentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      title={s.label}
      className={`w-3 shrink-0 text-center text-[10px] leading-none ${status === "blocked" ? "blocked-pulse" : ""}`}
      style={{ color: s.color }}
    >
      {s.glyph}
    </span>
  );
}

// `working` and `idle` are the ambient states, so the glyph carries them and the
// header keeps its width for the handle. The two that mean something happened
// get the word spelled out.
function StatusChip({ status }: { status: AgentStatus }) {
  const s = STATUS_STYLE[status];
  const loud = status === "blocked" || status === "done";
  return (
    <span
      title={s.label}
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 ${
        status === "blocked" ? "blocked-pulse" : ""
      }`}
      style={{ color: s.color, border: `1px solid ${s.color}55`, background: `${s.color}12` }}
    >
      {s.glyph}
      {loud && ` ${status}`}
    </span>
  );
}

// Agent badge: the agent wallet's blockie, linking out to the explorer.
// It lives inside a clickable row/card, so the click must not also focus the agent.
function AgentBlockieLink({ agent, compact }: { agent: Agent; compact?: boolean }) {
  const { targetNetwork } = useTargetNetwork();
  return (
    <a
      href={getBlockExplorerAddressLink(targetNetwork, agent.address)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`${agent.harness} + ${agent.model} · ${agent.address}`}
      className={`${compact ? "w-5 h-5" : "w-6 h-6"} shrink-0 rounded overflow-hidden hover:opacity-80 transition`}
      style={{ border: `1px solid ${agent.color}55` }}
    >
      <BlockieAvatar address={agent.address} ensImage={null} size={compact ? 20 : 24} />
    </a>
  );
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
      .final-root {
        background-image: radial-gradient(circle at 50% 18%, rgba(255, 190, 0, 0.13) 0%, transparent 34%),
          radial-gradient(circle at 18% 0%, #001a1f 0%, #000 58%);
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
      .lead-take {
        z-index: 2;
        animation: leadTake 1.8s cubic-bezier(0.2, 0.9, 0.3, 1.2);
      }
      @keyframes leadTake {
        0% {
          background: rgba(255, 190, 0, 0);
          box-shadow: 0 0 0 0 rgba(255, 190, 0, 0);
        }
        12% {
          background: rgba(255, 190, 0, 0.22);
          box-shadow: 0 0 26px 5px rgba(255, 190, 0, 0.55), inset 0 0 0 1px rgba(255, 190, 0, 0.7);
        }
        55% {
          background: rgba(255, 190, 0, 0.1);
          box-shadow: 0 0 16px 3px rgba(255, 190, 0, 0.3), inset 0 0 0 1px rgba(255, 190, 0, 0.35);
        }
        100% {
          background: rgba(255, 190, 0, 0);
          box-shadow: 0 0 0 0 rgba(255, 190, 0, 0);
        }
      }
      .crown-pop {
        animation: crownPop 1.4s cubic-bezier(0.2, 0.9, 0.3, 1.4);
      }
      @keyframes crownPop {
        0% {
          transform: scale(0.2) rotate(-25deg);
          opacity: 0;
        }
        45% {
          transform: scale(1.6) rotate(10deg);
          opacity: 1;
        }
        70% {
          transform: scale(0.92) rotate(-4deg);
        }
        100% {
          transform: scale(1) rotate(0);
          opacity: 1;
        }
      }
      .blocked-pulse {
        animation: blockedPulse 1.4s ease-in-out infinite;
      }
      @keyframes blockedPulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.35;
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
      /* --- podium + finish --- */
      .podium-medal-svg {
        display: block;
        flex: none;
        overflow: visible;
        filter: drop-shadow(0 0 7px var(--podium-soft));
      }
      .podium-medal-pop {
        transform-origin: 50% 45%;
        animation: podiumMedalReveal 0.9s cubic-bezier(0.18, 0.92, 0.28, 1.28) both;
      }
      .race-podium-row {
        border: 1px solid color-mix(in srgb, var(--podium-tone) 34%, transparent);
        background: linear-gradient(90deg, var(--podium-soft), rgba(0, 251, 255, 0.015));
        box-shadow: inset 3px 0 0 var(--podium-tone);
      }
      .race-podium-row::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at 12% 50%, var(--podium-soft), transparent 36%);
      }
      .race-podium-celebrate {
        z-index: 4;
        animation: podiumRowFinish 4.4s cubic-bezier(0.2, 0.82, 0.2, 1) both;
      }
      .podium-broadcast {
        border-color: color-mix(in srgb, var(--podium-tone) 72%, transparent);
        box-shadow: 0 0 42px -8px var(--podium-tone), inset 0 0 30px var(--podium-soft);
        animation: podiumBroadcast 4.6s cubic-bezier(0.2, 0.82, 0.2, 1) both;
      }
      .podium-broadcast-line {
        background: var(--podium-tone);
        box-shadow: 0 0 18px 2px var(--podium-tone);
      }
      .podium-broadcast-sweep {
        background: linear-gradient(
          105deg,
          transparent 25%,
          var(--podium-soft) 46%,
          rgba(255, 255, 255, 0.18) 50%,
          transparent 70%
        );
        transform: translateX(-115%);
        animation: podiumBroadcastSweep 1.4s ease-out 0.18s both;
      }
      @keyframes podiumMedalReveal {
        0% {
          transform: translateY(-9px) scale(0.55) rotate(-7deg);
          opacity: 0;
          filter: brightness(2.5) drop-shadow(0 0 14px var(--podium-tone));
        }
        58% {
          transform: translateY(2px) scale(1.12) rotate(2deg);
          opacity: 1;
          filter: brightness(1.75) drop-shadow(0 0 10px var(--podium-tone));
        }
        100% {
          transform: translateY(0) scale(1) rotate(0);
          opacity: 1;
          filter: brightness(1) drop-shadow(0 0 7px var(--podium-soft));
        }
      }
      @keyframes podiumRowFinish {
        0% {
          filter: brightness(1);
          box-shadow: inset 3px 0 0 var(--podium-tone), 0 0 0 0 transparent;
        }
        14% {
          filter: brightness(1.65);
          box-shadow: inset 4px 0 0 var(--podium-tone), 0 0 34px 6px var(--podium-tone);
        }
        48% {
          filter: brightness(1.15);
          box-shadow: inset 4px 0 0 var(--podium-tone), 0 0 20px 3px var(--podium-soft);
        }
        100% {
          filter: brightness(1);
          box-shadow: inset 3px 0 0 var(--podium-tone), 0 0 0 0 transparent;
        }
      }
      @keyframes podiumBroadcast {
        0% {
          transform: translateY(-22px) scale(0.96);
          opacity: 0;
          filter: brightness(1.8);
        }
        8% {
          transform: translateY(0) scale(1.01);
          opacity: 1;
        }
        14%,
        82% {
          transform: translateY(0) scale(1);
          opacity: 1;
          filter: brightness(1);
        }
        100% {
          transform: translateY(-10px) scale(0.99);
          opacity: 0;
        }
      }
      @keyframes podiumBroadcastSweep {
        to {
          transform: translateX(115%);
        }
      }
      .agent-finish-row {
        overflow: hidden;
        background: linear-gradient(90deg, rgba(0, 255, 156, 0.08), rgba(0, 251, 255, 0.015));
        animation: agentFinishLock 2.8s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .agent-finish-row::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
        transform: translateX(-120%);
        animation: agentFinishSweep 1s ease-out 0.12s both;
      }
      .agent-finish-time {
        animation: agentFinishText 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.25) 0.3s both;
      }
      .race-final-position {
        text-shadow: 0 0 8px rgba(0, 255, 156, 0.9);
      }
      .agent-terminal-locked {
        animation: terminalLock 0.7s ease-out both;
        background: linear-gradient(180deg, transparent, rgba(0, 255, 156, 0.05));
      }
      @keyframes agentFinishLock {
        0% {
          background-color: transparent;
          box-shadow: inset 0 0 0 0 rgba(0, 255, 156, 0);
        }
        18% {
          background-color: rgba(0, 255, 156, 0.2);
          box-shadow: inset 0 0 0 1px rgba(0, 255, 156, 0.8), 0 0 28px 2px rgba(0, 255, 156, 0.35);
        }
        100% {
          background-color: transparent;
          box-shadow: inset 0 0 0 0 rgba(0, 255, 156, 0);
        }
      }
      @keyframes agentFinishSweep {
        to {
          transform: translateX(120%);
        }
      }
      @keyframes agentFinishText {
        from {
          transform: translateY(5px);
          opacity: 0;
          filter: brightness(2.5);
        }
        to {
          transform: translateY(0);
          opacity: 1;
          filter: brightness(1);
        }
      }
      @keyframes terminalLock {
        from {
          filter: brightness(2);
          opacity: 0.3;
        }
        to {
          filter: brightness(1);
          opacity: 1;
        }
      }
      /* --- result card --- */
      .final-victory-sweep {
        background: linear-gradient(105deg, transparent 35%, rgba(255, 190, 0, 0.13) 49%, transparent 63%);
        transform: translateX(-100%);
        animation: finalVictorySweep 1.25s ease-out 0.15s both;
      }
      .final-lock-in {
        opacity: 0;
        animation: finalLockIn 0.7s ease-out 0.12s forwards;
      }
      .final-title {
        text-shadow: 0 0 18px rgba(255, 190, 0, 0.38), 0 0 38px rgba(0, 251, 255, 0.18);
      }
      .final-card-in {
        opacity: 0;
        animation: finalCardIn 0.7s cubic-bezier(0.2, 0.86, 0.25, 1.18) forwards;
      }
      .final-result-in {
        opacity: 0;
        animation: finalResultIn 0.42s ease-out forwards;
      }
      .final-winner-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at 50% 25%, rgba(255, 190, 0, 0.14), transparent 46%);
      }
      .final-winner-orbit::before {
        content: "";
        position: absolute;
        inset: -9px;
        border: 1px solid rgba(255, 190, 0, 0.55);
        border-radius: 999px;
        animation: finalOrbit 1.1s cubic-bezier(0.2, 0.86, 0.25, 1.18) 1.05s both;
      }
      @keyframes finalVictorySweep {
        to {
          transform: translateX(100%);
        }
      }
      @keyframes finalLockIn {
        from {
          transform: translateY(10px);
          opacity: 0;
          filter: brightness(1.8);
        }
        to {
          transform: translateY(0);
          opacity: 1;
          filter: brightness(1);
        }
      }
      @keyframes finalCardIn {
        from {
          transform: translateY(26px) scale(0.94);
          opacity: 0;
          filter: brightness(1.7);
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
          filter: brightness(1);
        }
      }
      @keyframes finalResultIn {
        from {
          transform: translateX(-10px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes finalOrbit {
        from {
          transform: scale(0.6);
          opacity: 0;
          box-shadow: 0 0 0 0 rgba(255, 190, 0, 0.7);
        }
        60% {
          opacity: 1;
          box-shadow: 0 0 26px 5px rgba(255, 190, 0, 0.35);
        }
        to {
          transform: scale(1);
          opacity: 0.65;
          box-shadow: 0 0 8px 1px rgba(255, 190, 0, 0.18);
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
      /* Several of the entrances start at opacity 0 and animate in, so killing
         the animation alone would leave them invisible — reset the end state too. */
      @media (prefers-reduced-motion: reduce) {
        .live-dot,
        .toast-in,
        .feed-in,
        .current-pulse,
        .lead-take,
        .crown-pop,
        .blocked-pulse,
        .cell-working,
        .flag-pop,
        .podium-medal-pop,
        .race-podium-celebrate,
        .podium-broadcast,
        .podium-broadcast-sweep,
        .agent-finish-row,
        .agent-finish-row::after,
        .agent-finish-time,
        .agent-terminal-locked,
        .final-victory-sweep,
        .final-lock-in,
        .final-card-in,
        .final-result-in,
        .final-winner-orbit::before {
          animation: none !important;
          opacity: 1;
          transform: none;
        }
      }
    `}</style>
  );
}
