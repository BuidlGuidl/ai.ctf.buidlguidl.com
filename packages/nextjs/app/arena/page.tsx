"use client";

import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArenaLobby } from "./Lobby";
import { OperatorAddress } from "./OperatorAddress";
import { Agent, AgentStatus, CHALLENGES, Challenge, DIFFICULTY_COLOR } from "./mockData";
import type { Address } from "viem";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import type { EntrantSummary, RunState } from "~~/services/arena/arena-types";
import { arenaClient } from "~~/services/arena/client";
import { connectRun } from "~~/services/arena/connect";
import type { ChatItem, ConsoleEntry, FeedItem } from "~~/services/arena/projection";
import { ROSTER, displayForEntrant } from "~~/services/arena/roster";
import {
  type ConnectionStatus,
  selectChat,
  selectConnectionError,
  selectConnectionStatus,
  selectConsoleFor,
  selectFeed,
  selectLastFlagEvent,
  selectPreviewFor,
  selectRunChainId,
  selectRunDeadlineAt,
  selectRunEntrants,
  selectRunError,
  selectRunFinishedAt,
  selectRunId,
  selectRunStartedAt,
  selectRunState,
  useArenaStore,
} from "~~/services/arena/store";
import { useOperatorSession } from "~~/services/arena/useOperatorSession";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

export const dynamic = "force-dynamic";

type FinalView = "results" | "data";
type PodiumPlace = 1 | 2 | 3;

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
const STOP_ARM_MS = 6000;

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
      (a.firstBloodAt ?? "\uffff").localeCompare(b.firstBloodAt ?? "\uffff") ||
      a.id.localeCompare(b.id),
  );

function secondsFrom(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.floor((Date.parse(end) - Date.parse(start)) / 1000));
}

function agentsFromRun(entrants: EntrantSummary[] | null, startedAt: string | null): Agent[] {
  if (!entrants) {
    return ROSTER.map(entrant => {
      const display = displayForEntrant(entrant.id, entrant.harness, entrant.model);
      return {
        id: entrant.id,
        handle: display.handle,
        harness: display.harnessLabel,
        model: display.modelLabel,
        vendor: display.vendor,
        color: display.color,
        short: display.short,
        address: null,
        solved: [],
        status: "idle",
        tokens: 0,
        cost: null,
        firstBloodAt: null,
        finishedAt: null,
      };
    });
  }

  return entrants.map(entrant => {
    const display = displayForEntrant(entrant.id, entrant.harness, entrant.model);
    const firstSolve = entrant.solves[0]?.ts ?? null;
    const clearedAt = entrant.solves.length >= CHALLENGES.length ? entrant.solves.at(-1)?.ts ?? null : null;
    return {
      id: entrant.id,
      handle: display.handle,
      harness: display.harnessLabel,
      model: display.modelLabel,
      vendor: display.vendor,
      color: display.color,
      short: display.short,
      address: entrant.address as Address | null,
      solved: entrant.solves.map(solve => solve.challengeId),
      status: entrant.status,
      tokens: entrant.inputTokens + entrant.outputTokens,
      cost: entrant.costUsd,
      firstBloodAt: firstSolve,
      finishedAt: secondsFrom(startedAt, clearedAt),
    };
  });
}

function useArenaClock(
  startedAt: string | null,
  deadlineAt: string | null,
  runState: RunState | null,
  runFinishedAt: string | null,
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || runState === "finished" || runState === "failed") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [runState, startedAt]);

  const end = runFinishedAt ? Date.parse(runFinishedAt) : now;
  const elapsed = startedAt ? Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000)) : 0;
  if (!deadlineAt) return { seconds: elapsed, countdown: false, timeUp: false };
  const remaining = Math.max(0, Math.ceil((Date.parse(deadlineAt) - end) / 1000));
  return { seconds: remaining, countdown: true, timeUp: remaining === 0 && runState === "running" };
}

export default function ArenaPage() {
  const [focusedId, setFocusedId] = useState<string>(ROSTER[0].id);
  const [flashes, setFlashes] = useState<string[]>([]);
  const flashTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [openChallenge, setOpenChallenge] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [stageMode, setStageMode] = useState<"overview" | "focus">("overview");
  const [overviewTab, setOverviewTab] = useState<"race" | "grid">("race");
  const [liveStarted, setLiveStarted] = useState(false);
  const [ceremonyReady, setCeremonyReady] = useState(false);
  const [finalView, setFinalView] = useState<FinalView>("results");
  const runId = useArenaStore(selectRunId);
  const runState = useArenaStore(selectRunState);
  const runEntrants = useArenaStore(selectRunEntrants);
  const runStartedAt = useArenaStore(selectRunStartedAt);
  const runDeadlineAt = useArenaStore(selectRunDeadlineAt);
  const currentRunId = useArenaStore(state => state.currentRunId);
  const connectionStatus = useArenaStore(selectConnectionStatus);
  const connectionError = useArenaStore(selectConnectionError);
  const lastFlagEvent = useArenaStore(selectLastFlagEvent);
  const runFinishedAt = useArenaStore(selectRunFinishedAt);
  const runError = useArenaStore(selectRunError);
  const operator = useOperatorSession();

  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("run");
    if (runId) useArenaStore.getState().setCurrentRunId(runId);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!currentRunId) return;
    return connectRun(currentRunId);
  }, [currentRunId]);

  const agents = useMemo(() => agentsFromRun(runEntrants, runStartedAt), [runEntrants, runStartedAt]);
  const startMatch = useCallback(() => setLiveStarted(true), []);

  const goFocus = useCallback((id: string) => {
    setFocusedId(id);
    setStageMode("focus");
  }, []);
  const closeLog = useCallback(() => setStageMode("overview"), []);

  useEffect(() => {
    if (agents.some(agent => agent.id === focusedId)) return;
    if (agents[0]) setFocusedId(agents[0].id);
  }, [agents, focusedId]);

  const focused = useMemo(() => agents.find(a => a.id === focusedId) ?? agents[0], [agents, focusedId]);
  const ranked = useMemo(() => rankAgents(agents), [agents]);
  const totalSolved = useMemo(() => agents.reduce((n, a) => n + a.solved.length, 0), [agents]);
  const finishedCount = useMemo(() => agents.filter(agent => agent.status === "done").length, [agents]);
  const allFinished = runState === "finished";
  const runFailed = runState === "failed";
  const runTerminal = allFinished || runFailed;
  const clock = useArenaClock(runStartedAt, runDeadlineAt, runState, runFinishedAt);
  const gridUsesFullWidth = overviewTab === "grid" && stageMode === "overview" && !operator.authenticated;

  const backToLobby = useCallback(() => {
    useArenaStore.getState().clear();
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState(null, "", url);
    setLiveStarted(false);
    setCeremonyReady(false);
    setFinalView("results");
  }, []);

  useEffect(() => {
    if (!lastFlagEvent) return;
    const key = `${lastFlagEvent.payload.entrantId}:${lastFlagEvent.payload.challengeId}`;
    setFlashes(previous => [...previous, key]);
    const priorTimer = flashTimers.current.get(key);
    if (priorTimer) clearTimeout(priorTimer);
    flashTimers.current.set(
      key,
      setTimeout(() => {
        setFlashes(previous => previous.filter(value => value !== key));
        flashTimers.current.delete(key);
      }, 3200),
    );
  }, [lastFlagEvent]);

  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!liveStarted || !allFinished) return;
    const timer = setTimeout(() => setCeremonyReady(true), FINISH_STING_MS + 200);
    return () => clearTimeout(timer);
  }, [allFinished, liveStarted]);

  const stopRace = useCallback(async () => {
    if (!runId) return;
    const snapshot = await arenaClient.stopRun(runId);
    useArenaStore.getState().syncSnapshot(snapshot);
  }, [runId]);

  const steer = useCallback(
    async (text: string) => {
      if (!runId || !focused) return;
      await arenaClient.steerEntrant(runId, focused.id, { text });
    },
    [focused, runId],
  );

  const broadcast = useCallback(
    async (text: string) => {
      if (!runId) return;
      await arenaClient.broadcast(runId, { text });
    },
    [runId],
  );

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-[#00FBFF] font-dotGothic text-2xl tracking-widest">
        <span className="animate-pulse">◆ LOADING AGENT ARENA…</span>
      </div>
    );
  }

  if (currentRunId && !runId && (connectionStatus === "not-found" || connectionStatus === "error")) {
    return (
      <RunExitPanel
        title="RUN UNAVAILABLE"
        message={
          connectionStatus === "not-found"
            ? "This arena run no longer exists. The backend may have restarted."
            : connectionError ?? "Could not load the arena run."
        }
        onBack={backToLobby}
      />
    );
  }

  if (!focused || (currentRunId && !runId)) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-[#00FBFF] font-dotGothic text-2xl tracking-widest">
        <span className="animate-pulse">◆ LOADING AGENT ARENA…</span>
      </div>
    );
  }

  if (!liveStarted) {
    return <ArenaLobby agents={agents} onLaunch={startMatch} onStartOver={backToLobby} />;
  }

  if (ceremonyReady && finalView === "results") {
    return <FinalCeremony ranked={ranked} onViewData={() => setFinalView("data")} />;
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-[#00FBFF] font-mono overflow-hidden arena-root">
      <Scanlines />
      <TopBar
        clock={clock.seconds}
        countdown={clock.countdown}
        timeUp={clock.timeUp}
        totalSolved={totalSolved}
        finishedCount={finishedCount}
        allFinished={allFinished}
        runFailed={runFailed}
        agentCount={agents.length}
        connectionStatus={connectionStatus}
        onViewResults={ceremonyReady ? () => setFinalView("results") : undefined}
      />

      {runFailed && (
        <div className="flex shrink-0 items-center gap-4 border-b border-[#FF5861]/50 bg-[#FF5861]/10 px-5 py-3 text-[#FF5861]">
          <span className="font-dotGothic text-xl tracking-widest">RUN FAILED</span>
          <span className="min-w-0 flex-1 text-sm text-[#FF5861]/80">
            {runError ?? "The backend ended the run without a reason."}
          </span>
          <button
            onClick={backToLobby}
            className="shrink-0 rounded border border-[#FF5861] px-3 py-1.5 text-sm font-bold tracking-widest transition hover:bg-[#FF5861] hover:text-black"
          >
            BACK TO LOBBY
          </button>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-1 min-h-0">
          {/* MAIN STAGE — always the wide shot, so observing an agent never hides the race */}
          <div
            className={`flex flex-col flex-1 min-w-0 ${
              gridUsesFullWidth ? "2xl:border-r 2xl:border-[#00FBFF]/20" : "border-r border-[#00FBFF]/20"
            }`}
          >
            <div className="flex-1 min-h-0 relative p-4">
              <div className="h-full flex flex-col border border-[#00FBFF]/25 rounded-lg bg-[#020a0c]/80 overflow-hidden shadow-[0_0_40px_-12px_rgba(0,251,255,0.4)]">
                <StageTabs tab={overviewTab} onTab={setOverviewTab} />
                <OverviewStage ranked={ranked} tab={overviewTab} onPick={goFocus} flashes={flashes} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — the unified arena stream; the observed agent's log takes over here */}
          <div className={`w-[520px] flex-col min-h-0 min-w-0 ${gridUsesFullWidth ? "hidden 2xl:flex" : "flex"}`}>
            {stageMode === "focus" ? <AgentLog focused={focused} onClose={closeLog} /> : <ArenaStream />}
            {operator.authenticated && (
              <OperatorStrip
                focused={focused}
                address={operator.address}
                archived={runTerminal}
                timeUp={clock.timeUp}
                onSteer={steer}
                onBroadcast={broadcast}
                onStop={stopRace}
                onSignOut={operator.signOut}
              />
            )}
          </div>
        </div>

        {/* BOTTOM — full-width strip under both columns. Multiview fills its cards
            with terminals and no standings, so the race track runs along the bottom
            there; the race stage keeps the challenge board instead. */}
        {overviewTab === "grid" ? (
          <div className="shrink-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#010607]">
            <SectionHead label="RACE" hint="showing top 5 · scroll for all" />
            <div className="h-[190px] overflow-y-auto console-scroll">
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

function RunExitPanel({ title, message, onBack }: { title: string; message: string; onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black px-6 text-[#00FBFF] font-mono">
      <div className="w-full max-w-xl rounded-lg border border-[#FF5861]/50 bg-[#FF5861]/10 p-6 text-center">
        <h1 className="font-dotGothic text-3xl tracking-widest text-[#FF5861]">{title}</h1>
        <p className="mt-3 text-sm text-[#FF5861]/80">{message}</p>
        <button
          onClick={onBack}
          className="mt-6 rounded border border-[#00FBFF] px-4 py-2 font-dotGothic text-sm tracking-widest text-[#00FBFF] transition hover:bg-[#00FBFF] hover:text-black"
        >
          BACK TO LOBBY
        </button>
      </div>
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
        <span className="flex items-center gap-2 text-sm font-bold tracking-[0.18em] text-[#00ff9c]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ff9c] shadow-[0_0_10px_#00ff9c]" />
          MATCH COMPLETE
        </span>
        <div className="hidden font-dotGothic text-lg tracking-wide text-[#00FBFF] lg:block lg:text-xl">
          BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · FINAL TRANSMISSION
        </div>
        <button
          onClick={onViewData}
          className="ml-auto shrink-0 rounded border border-[#00FBFF]/30 px-2.5 py-1 text-sm font-bold tracking-[0.12em] text-[#00FBFF]/75 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
        >
          ARENA DATA ▸
        </button>
      </header>

      <main className="console-scroll relative z-20 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-8">
        <section className="final-lock-in mx-auto max-w-5xl text-center">
          <div className="text-sm font-bold tracking-[0.35em] text-[#00ff9c]">ALL AGENT RESULTS COMMITTED</div>
          <h1 className="final-title mt-2 font-dotGothic text-3xl tracking-[0.12em] text-white sm:text-5xl">
            RESULTS LOCKED
          </h1>
        </section>

        <section className="mx-auto mt-10 grid max-w-5xl grid-cols-1 items-end gap-3 md:mt-14 md:grid-cols-3 md:gap-4">
          {ranked.slice(0, 3).map((agent, i) => (
            <FinalistCard key={agent.id} agent={agent} place={(i + 1) as PodiumPlace} />
          ))}
        </section>

        {rest.length > 0 && (
          <section className="mx-auto mt-8 max-w-6xl pb-5 md:mt-10">
            <div className="mb-3 flex items-center gap-3 text-sm font-bold tracking-[0.24em] text-[#00FBFF]/70">
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
                        <span className="race-final-position w-8 text-center font-dotGothic text-xl text-[#00ff9c]">
                          {place}
                        </span>
                        <AgentBlockieLink agent={agent} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-lg font-bold text-white">{agent.handle}</div>
                          <div className="mt-0.5 truncate text-sm text-[#00FBFF]/70">
                            {agent.harness} · {agent.model}
                          </div>
                        </div>
                        <span className="hidden shrink-0 text-base text-[#00FBFF]/70 min-[430px]:inline">
                          {agent.solved.length} FLAGS
                        </span>
                        <span className="w-[104px] shrink-0 text-right text-lg font-bold tabular-nums text-[#00ff9c]">
                          {agent.finishedAt === null ? "—" : fmtClock(agent.finishedAt)}
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
          <div className="text-xs font-bold tracking-[0.28em]" style={{ color: podium.tone }}>
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
            {agent.address ? (
              <BlockieAvatar address={agent.address} ensImage={null} size={winner ? 76 : 52} />
            ) : (
              <span
                className="flex h-full items-center justify-center font-dotGothic text-xl"
                style={{ color: agent.color }}
              >
                {agent.short}
              </span>
            )}
          </div>
        </div>
        <div className={`mt-3 truncate font-bold text-white ${winner ? "text-2xl" : "text-lg"}`}>{agent.handle}</div>
        <div className="mt-0.5 truncate text-sm text-[#00FBFF]/70">
          {agent.harness} · {agent.model}
        </div>
        <div
          className={`mt-3 font-dotGothic tabular-nums ${
            winner ? "text-3xl text-[#FFBE00]" : "text-xl text-[#00ff9c]"
          }`}
        >
          {agent.finishedAt === null ? "—" : fmtClock(agent.finishedAt)}
        </div>
        <div className="mt-1 text-sm tracking-[0.16em] text-[#00FBFF]/60">
          {agent.solved.length}/{CHALLENGES.length} FLAGS ·{" "}
          {agent.cost === null ? "COST N/A" : `$${agent.cost.toFixed(2)}`}
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
  size?: "xs" | "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}) {
  const podium = PODIUM[place];
  const base = useId().replace(/:/g, "");
  const metalId = `${base}-metal`;
  const ribbonId = `${base}-ribbon`;
  const sizeClass = size === "lg" ? "h-16 w-14" : size === "xs" ? "h-6 w-5" : size === "sm" ? "h-8 w-7" : "h-12 w-10";

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
  countdown,
  timeUp,
  totalSolved,
  finishedCount,
  allFinished,
  runFailed,
  agentCount,
  connectionStatus,
  onViewResults,
}: {
  clock: number;
  countdown: boolean;
  timeUp: boolean;
  totalSolved: number;
  finishedCount: number;
  allFinished: boolean;
  runFailed: boolean;
  agentCount: number;
  connectionStatus: ConnectionStatus;
  onViewResults?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 h-16 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] shrink-0">
      <span
        className={`flex items-center gap-2 font-bold tracking-widest ${
          allFinished ? "text-[#00ff9c]" : "text-[#FF5861]"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            allFinished ? "bg-[#00ff9c]" : runFailed ? "bg-[#FF5861]" : "bg-[#FF5861] live-dot"
          }`}
        />
        {allFinished ? "LOCKED" : runFailed ? "FAILED" : "LIVE"}
      </span>
      <div className="hidden sm:block font-dotGothic text-xl md:text-2xl text-[#00FBFF] tracking-wide title-glow">
        BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENT ARENA
      </div>
      <div className="hidden 2xl:flex items-center gap-1 text-sm text-[#00FBFF]/70">
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{agentCount} AGENTS</span>
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{CHALLENGES.length} CHALLENGES</span>
      </div>
      {timeUp && (
        <span className="animate-pulse rounded border border-[#FF5861] bg-[#FF5861]/15 px-3 py-1 text-sm font-bold tracking-widest text-[#FF5861]">
          TIME&apos;S UP · OPERATOR: STOP THE RACE
        </span>
      )}
      <div className="ml-auto flex items-center gap-4 text-lg">
        {onViewResults && (
          <button
            onClick={onViewResults}
            className="px-2.5 py-1 rounded border border-[#FFBE00]/50 text-[#FFBE00] text-sm font-bold tracking-[0.12em] hover:bg-[#FFBE00]/10 transition"
          >
            ◆ RESULTS
          </button>
        )}
        <span className="hidden md:inline text-[#00FBFF]/75">
          🏁 <span className="text-[#00ff9c] font-bold">{totalSolved}</span> flags
        </span>
        <span className={finishedCount ? "text-[#00ff9c] font-bold" : "text-[#00FBFF]/70"}>
          ◆ {finishedCount}/{agentCount}
        </span>
        <span className="hidden xl:inline text-sm uppercase tracking-wider text-[#00FBFF]/55">{connectionStatus}</span>
        {/* The race clock is the one number the stream never stops reading. */}
        <span className={`text-3xl tabular-nums font-bold ${timeUp ? "text-[#FF5861]" : "text-[#FFBE00]"}`}>
          {countdown ? "⏳" : "⏱"} {fmtClock(clock)}
        </span>
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
    <div className="flex items-center gap-2 px-4 h-12 border-b border-[#00FBFF]/20 bg-[#001417] shrink-0">
      <span className="font-dotGothic text-lg text-[#00FBFF]/70 mr-2">WIDE SHOT</span>
      {STAGE_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          title={t.label}
          className={`px-3 py-1 rounded text-sm font-bold tracking-wider transition ${
            tab === t.id
              ? "bg-[#00FBFF]/15 text-[#00FBFF] border border-[#00FBFF]/50"
              : "text-[#00FBFF]/60 border border-transparent hover:text-[#00FBFF]"
          }`}
        >
          {t.label}
        </button>
      ))}
      <span className="ml-auto text-sm text-[#00FBFF]/55">click any agent → observe its log ▸</span>
    </div>
  );
}

/* ---------------------------------------------------------------- AgentLog */

// The observer console for one agent — lives in the right column so the wide
// shot behind it keeps running.
function AgentLog({ focused, onClose }: { focused: Agent; onClose: () => void }) {
  const lines = useArenaStore(selectConsoleFor(focused.id));
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const finished = focused.status === "done";

  return (
    <div className="flex-1 min-h-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#020a0c]">
      {/* Two rows, not one: at broadcast sizes the badges crowd the handle off
          the end of a single line, and the observed agent's name is the whole
          point of this panel. */}
      <div className="flex flex-col gap-1 px-3 py-1.5 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0 text-base">
        <div className="flex items-center gap-2">
          <AgentBlockieLink agent={focused} />
          <span className="flex-1 min-w-0 text-lg font-bold text-white truncate">{focused.handle}</span>
          <button
            onClick={onClose}
            title="back to arena feed"
            className="w-7 h-7 shrink-0 rounded border border-[#00FBFF]/25 text-[#00FBFF]/60 hover:text-[#00FBFF] hover:border-[#00FBFF] transition"
          >
            ✕
          </button>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={focused.status} />
          {focused.finishedAt !== null ? (
            <span className="px-1.5 py-0.5 rounded font-bold shrink-0 text-sm text-[#00ff9c] border border-[#00ff9c]/40">
              CLEARED · {fmtClock(focused.finishedAt)}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded font-bold shrink-0 text-sm text-[#00FBFF]/70 border border-[#00FBFF]/20">
              TARGET UNREPORTED
            </span>
          )}
          <span className="ml-auto text-[#00ff9c] font-bold shrink-0">
            {focused.solved.length}/{CHALLENGES.length}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-base leading-snug console-scroll">
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
  const [expanded, setExpanded] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  if (line.kind === "think") return <div className="text-[#7fd8dd] italic">· {line.text}</div>;
  if (line.kind === "message") return <div className="text-white/85">› {line.text}</div>;
  if (line.kind === "error") return <div className="text-[#FF5861] font-bold">⚠ {line.text}</div>;
  if (line.kind === "flag") return <div className="text-[#00ff9c] font-bold">🏁 {line.text}</div>;
  if (line.kind === "tool") {
    const state = !line.result ? "running" : line.result.ok ? "ok" : "fail";
    const color = state === "running" ? "#FFBE00" : state === "ok" ? "#00ff9c" : "#FF5861";

    if (!line.result) {
      return (
        <div className="text-[#00FBFF]">
          <span className="inline-block w-3" />
          <span className="animate-pulse" style={{ color }} title={`${line.tool} ${state}`}>
            ⟳
          </span>{" "}
          <span className="text-[#00ff9c]">$</span> {line.text}
        </div>
      );
    }

    const truncation = line.result.truncated?.["detail"];
    const trimmedChars = truncation ? truncation.fullLength - line.result.detail.length : 0;
    const originalLines = Number(truncation?.lines);
    const hasOriginalLines = Number.isFinite(originalLines) && originalLines > 0;

    return (
      <div ref={rowRef}>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            const expanding = !expanded;
            setExpanded(expanding);
            if (expanding) {
              requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: "nearest" }));
            }
          }}
          title={expanded ? undefined : line.text}
          className="flex w-full min-w-0 items-baseline text-left text-[#00FBFF] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FBFF]/70"
        >
          <span className="w-3 shrink-0">{expanded ? "▾" : "▸"}</span>
          <span style={{ color }} title={`${line.tool} ${state}`}>
            {state === "ok" ? "✓" : "✗"}
          </span>
          <span className="ml-1 text-[#00ff9c]">$</span>
          <span className={`ml-1 min-w-0 flex-1 ${expanded ? "whitespace-pre-wrap break-all" : "truncate"}`}>
            {line.text}
          </span>
        </button>
        {expanded && (
          <div className={`pl-4 break-all ${state === "fail" ? "text-[#FF5861]/85" : "text-[#00FBFF]/75"}`}>
            {line.truncated?.["detail"] && <div className="text-[#00FBFF]/55">command trimmed by backend</div>}
            <div className="whitespace-pre-wrap">→ {line.result.detail}</div>
            {truncation && trimmedChars > 0 && (
              <div className="text-[#00FBFF]/55">
                output trimmed by backend ({trimmedChars.toLocaleString()} chars cut
                {hasOriginalLines && ` · ${originalLines.toLocaleString()} original lines`})
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  // A result with no matching call — kept rather than dropped, same as upstream.
  return (
    <div className="text-[#00FBFF]/75 pl-4 break-all">
      → {line.text}
      {line.truncated?.["detail"] && <span className="text-[#00FBFF]/55"> · trimmed</span>}
    </div>
  );
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
// rows and no harness badge. Its viewport shows five agents and scrolls to the rest.
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
  const rowGap = compact ? "gap-3" : "gap-4";
  const cellH = compact ? "h-6" : "h-9";
  const dataText = compact ? "text-sm" : "text-base";
  const numText = compact ? "text-base" : "text-lg";
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
        <span className="w-10 shrink-0" />
        <span className="w-4 shrink-0" />
        <span className={`${compact ? "w-7" : "w-8"} shrink-0`} />
        <span className={`${compact ? "w-56" : "w-[300px]"} shrink-0 ${dataText} tracking-widest text-[#00FBFF]/55`}>
          AGENT · MINTS →
        </span>
        <span className={`w-16 shrink-0 text-right ${dataText} tracking-widest text-[#00FBFF]/55`}>TOK</span>
        <span className={`w-20 shrink-0 text-right ${dataText} tracking-widest text-[#00FBFF]/55`}>COST</span>
        <div className="flex-1 flex gap-1">
          {slots.map(k => (
            <span
              key={k}
              title={`${k + 1}. flag minted`}
              className={`flex-1 text-center ${dataText} font-bold tabular-nums text-[#00FBFF]/55`}
            >
              {k + 1}
            </span>
          ))}
        </div>
        <span className={`w-28 shrink-0 text-right ${dataText} tracking-widest text-[#00FBFF]/55`}>RESULT</span>
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
              compact ? "py-0.5" : "py-2"
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
              className={`flex w-10 shrink-0 items-center justify-center text-center ${numText} font-bold tabular-nums ${
                place
                  ? ""
                  : done(a)
                  ? "race-final-position text-[#00ff9c]"
                  : i === 0
                  ? "text-[#FFBE00]"
                  : i < 3
                  ? "text-[#00ff9c]"
                  : "text-[#00FBFF]/70"
              }`}
            >
              {place ? (
                // The sting shows a big medal of its own; hiding the row's copy
                // keeps the two from reading as two different awards.
                <PodiumMedal
                  place={place}
                  size={compact ? "xs" : "sm"}
                  animate={celebrating}
                  className={celebrating ? "invisible" : ""}
                />
              ) : i === 0 ? (
                <span className={`inline-block ${leadTaker === a.id ? "crown-pop" : ""}`}>👑</span>
              ) : (
                i + 1
              )}
            </span>
            <StatusDot status={a.status} />
            <AgentBlockieLink agent={a} compact={compact} />
            <span
              className={`${compact ? "w-56 text-base" : "w-[300px] text-2xl"} truncate font-bold text-white shrink-0`}
              title={`${a.harness} + ${a.model}`}
            >
              {a.handle}
            </span>
            <span className={`w-16 text-right ${dataText} tabular-nums shrink-0 text-[#00FBFF]/75`}>
              {(a.tokens / 1000).toFixed(0)}k
            </span>
            <span className={`w-20 text-right ${dataText} tabular-nums shrink-0 text-[#FFBE00]/90`}>
              {a.cost === null ? "—" : `$${a.cost.toFixed(2)}`}
            </span>

            {/* The backend reports captures but not each entrant's active challenge. */}
            <div className="flex-1 flex gap-1">
              {slots.map(k => {
                const flagId = a.solved[k];
                if (flagId !== undefined) {
                  const ch = CHALLENGES[flagId - 1];
                  const flashing = flashes.includes(`${a.id}:${flagId}`);
                  return (
                    <span
                      key={k}
                      title={`#${flagId} ${ch?.name ?? ""} · minted ${k + 1} of ${total}`}
                      className={`relative flex-1 ${cellH} rounded-[3px] border flex items-center justify-center ${numText} font-bold tabular-nums transition-colors ${
                        flashing ? "flag-pop" : ""
                      }`}
                      style={{ background: a.color, borderColor: a.color, color: "#00181c" }}
                    >
                      {flagId}
                    </span>
                  );
                }
                if (k === a.solved.length && !done(a)) {
                  const color = STATUS_STYLE[a.status].color;
                  return (
                    <span
                      key={k}
                      title={STATUS_STYLE[a.status].label}
                      className={`relative flex-1 ${cellH} rounded-[3px] border flex items-center justify-center ${numText} font-bold tabular-nums ${
                        a.status === "working" ? "cell-working" : "opacity-40"
                      }`}
                      style={{ background: `${color}1f`, borderColor: color, color }}
                    >
                      …
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

            <span className={`w-28 text-right ${numText} tabular-nums shrink-0 text-[#00FBFF]/85`}>
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
          <div className="text-xs font-bold tracking-[0.32em]" style={{ color: podium.tone }}>
            {podium.label} FINISH · RESULT LOCKED
          </div>
          <div className="mt-1 truncate font-dotGothic text-xl tracking-wide text-white sm:text-2xl">
            {PODIUM_RESULT[place]}
          </div>
          <div className="mt-1 flex items-center gap-2 text-base">
            <span className="truncate font-bold text-white">{agent.handle}</span>
            <span className="text-[#00FBFF]/50">/</span>
            <span className="shrink-0 font-dotGothic tabular-nums" style={{ color: podium.tone }}>
              {fmtClock(agent.finishedAt ?? 0)}
            </span>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="font-dotGothic text-4xl leading-none" style={{ color: podium.tone }}>
            0{place}
          </div>
          <div className="mt-1 text-[11px] font-bold tracking-[0.24em] text-[#00FBFF]/55">PODIUM</div>
        </div>
      </div>
    </div>
  );
}

function GridView({ ranked, onPick }: { ranked: Agent[]; onPick: (id: string) => void }) {
  return (
    <div className="h-full p-2 grid grid-cols-5 auto-rows-fr gap-2">
      {ranked.map(agent => (
        <GridCard key={agent.id} agent={agent} onPick={onPick} />
      ))}
    </div>
  );
}

function GridCard({ agent, onPick }: { agent: Agent; onPick: (id: string) => void }) {
  const preview = useArenaStore(selectPreviewFor(agent.id));
  const finished = agent.status === "done";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPick(agent.id)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick(agent.id);
        }
      }}
      className={`min-h-0 flex flex-col text-left rounded border bg-[#00090b] hover:border-[#00FBFF]/50 transition overflow-hidden group cursor-pointer ${
        agent.status === "blocked" ? "border-[#FFBE00]/60" : "border-[#00FBFF]/15"
      }`}
    >
      <div className="flex items-center gap-1.5 px-2 h-10 shrink-0 border-b border-[#00FBFF]/10 bg-[#001417]">
        <AgentBlockieLink agent={agent} />
        <span className="text-base font-bold text-white truncate flex-1">{agent.handle}</span>
        <StatusDot status={agent.status} />
      </div>
      <div className="flex items-center gap-2 px-2 h-8 shrink-0 text-sm border-b border-[#00FBFF]/[0.07] bg-[#000d0f]">
        <span className="truncate" style={{ color: finished ? "#00ff9c" : STATUS_STYLE[agent.status].color }}>
          {agent.finishedAt !== null ? `◆ CLEARED · ${fmtClock(agent.finishedAt)}` : STATUS_STYLE[agent.status].label}
        </span>
        <span className="ml-auto shrink-0 text-[#00FBFF]/70 tabular-nums">
          {agent.solved.length}/{CHALLENGES.length}
        </span>
      </div>
      <div
        className={`flex-1 min-h-0 flex flex-col justify-end overflow-hidden px-2 py-1 text-sm leading-[1.45] ${
          finished ? "agent-terminal-locked" : ""
        }`}
      >
        {finished ? (
          <>
            <div className="shrink-0 text-[#00FBFF]/55">agent process exited</div>
            <div className="shrink-0 text-[#00ff9c] font-bold">result committed ✓</div>
          </>
        ) : (
          <>
            {preview.map((line, index) => (
              <div key={`${index}:${line}`} className="shrink-0 truncate text-[#7fd8dd]/90">
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
          style={{ width: `${(agent.solved.length / CHALLENGES.length) * 100}%`, background: agent.color }}
        />
      </div>
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
    <div className="h-56 shrink-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#010607]">
      <SectionHead label="CHALLENGE BOARD" hint="click for details" />
      <div className="flex-1 min-h-0 overflow-y-auto console-scroll p-2 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 content-start">
        {CHALLENGES.map(c => {
          const mine = focused.solved.includes(c.id);
          const count = solvedCount(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`px-2 py-1.5 rounded border text-base text-left transition hover:border-[#00FBFF] ${
                mine ? "bg-[#00ff9c]/10 border-[#00ff9c]/50" : "border-[#00FBFF]/15 bg-[#00FBFF]/[0.02]"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="font-bold" style={{ color: DIFFICULTY_COLOR[c.difficulty] }}>
                  #{c.id}
                </span>
                {mine && <span className="text-[#00ff9c]">✓</span>}
              </div>
              <div className="text-white/80 truncate">{c.name}</div>
              <div className="text-sm text-[#00FBFF]/70">
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
  const dc = DIFFICULTY_COLOR[challenge.difficulty];

  const AgentChips = ({ list, empty }: { list: Agent[]; empty: string }) =>
    list.length === 0 ? (
      <div className="text-[#00FBFF]/50 italic text-base">{empty}</div>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {list.map(a => (
          <button
            key={a.id}
            onClick={() => {
              onPickAgent(a.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded border text-base hover:bg-white/5 transition"
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
        className="toast-in w-[720px] max-w-[92%] max-h-[80%] overflow-y-auto console-scroll rounded-lg border bg-[#020a0c] shadow-2xl"
        style={{ borderColor: `${dc}66` }}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b" style={{ borderColor: `${dc}33` }}>
          <span className="text-2xl font-bold" style={{ color: dc }}>
            #{challenge.id}
          </span>
          <span className="text-2xl font-bold text-white truncate">{challenge.name}</span>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 shrink-0 rounded border border-[#00FBFF]/25 text-[#00FBFF]/60 hover:text-[#00FBFF] hover:border-[#00FBFF] transition"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 text-base">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{ color: dc, border: `1px solid ${dc}55`, background: `${dc}12` }}
            >
              {challenge.difficulty}
            </span>
            <span className="text-[#00FBFF]/70">[{challenge.tag}]</span>
          </div>

          <p className="text-lg leading-relaxed text-[#00FBFF]/85">{challenge.description}</p>

          {challenge.hints.length > 0 && (
            <div className="space-y-1.5">
              <div className="tracking-widest text-sm text-[#00FBFF]/70">HINTS</div>
              <ul className="space-y-1">
                {challenge.hints.map((hint, i) => (
                  <li key={i} className="flex gap-2 text-[#00FBFF]/75">
                    <span className="shrink-0 text-[#FFBE00]/90">›</span>
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5 text-[#00FBFF]/70">
              <span className="tracking-widest text-sm">FIELD PROGRESS</span>
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
            <div className="tracking-widest text-sm text-[#00FBFF]/70">CAPTURED BY</div>
            <AgentChips list={cleared} empty="nobody has cracked this one yet" />
          </div>

          <div className="pt-1 text-sm text-[#00FBFF]/55">click an agent to jump to its close-up · Esc to close</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- ArenaStream */

type StreamFilter = "all" | "chat" | "flags" | "events";
type StreamRow =
  | { id: number; group: "chat"; msg: ChatItem }
  | { id: number; group: "flags" | "events"; item: FeedItem };

const STREAM_FILTERS: { id: StreamFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "chat", label: "CHAT" },
  { id: "flags", label: "FLAGS" },
  { id: "events", label: "EVENTS" },
];

function ArenaStream() {
  const feed = useArenaStore(selectFeed);
  const chat = useArenaStore(selectChat);
  const [filter, setFilter] = useState<StreamFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const newestRowId = rows.length ? rows[rows.length - 1].id : 0;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [newestRowId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#010607]">
      <div className="flex items-center gap-2 px-3 h-11 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0">
        <span className="text-base font-bold text-[#00FBFF] tracking-widest">ARENA</span>
        <div className="ml-auto flex items-center gap-1">
          {STREAM_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2 py-0.5 rounded text-sm font-bold tracking-wider transition ${
                filter === f.id
                  ? "bg-[#00FBFF]/15 text-[#00FBFF] border border-[#00FBFF]/40"
                  : "text-[#00FBFF]/60 border border-transparent hover:text-[#00FBFF]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto console-scroll px-3 py-1.5 text-base space-y-1">
        {rows.length === 0 && <div className="text-[#00FBFF]/50 italic">waiting for real arena events…</div>}
        {rows.map(r =>
          r.group === "chat" ? <ChatRow key={r.id} msg={r.msg} /> : <FeedRow key={r.id} item={r.item} />,
        )}
      </div>
    </div>
  );
}

function OperatorStrip({
  focused,
  address,
  archived,
  timeUp,
  onSteer,
  onBroadcast,
  onStop,
  onSignOut,
}: {
  focused: Agent;
  address: string | null;
  archived: boolean;
  timeUp: boolean;
  onSteer: (text: string) => Promise<void>;
  onBroadcast: (text: string) => Promise<void>;
  onStop: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopArmed, setStopArmed] = useState(false);
  const stopArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(stopArmTimer.current ?? undefined), []);

  const send = async (action: (text: string) => Promise<void>) => {
    const text = draft.trim();
    if (!text || busy || archived) return;
    setBusy(true);
    setError(null);
    try {
      await action(text);
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operator command failed");
    } finally {
      setBusy(false);
    }
  };

  // Stopping ends the race for everyone, so it takes two clicks. The arm state
  // lapses on its own; a native confirm dialog would cover the broadcast.
  const stop = async () => {
    if (busy || archived) return;
    if (!stopArmed) {
      setStopArmed(true);
      stopArmTimer.current = setTimeout(() => setStopArmed(false), STOP_ARM_MS);
      return;
    }
    clearTimeout(stopArmTimer.current ?? undefined);
    setStopArmed(false);
    setBusy(true);
    setError(null);
    try {
      await onStop();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The stop request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`shrink-0 border-t px-2 py-2 ${timeUp ? "border-[#FF5861] bg-[#FF5861]/10" : "border-[#00FBFF]/15"}`}
    >
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-[#FFBE00]">
        <span>🎬 OPERATOR</span>
        <span className="truncate text-[#00FBFF]/70">focused: {focused.handle}</span>
        <div className="ml-auto flex items-center gap-2">
          <OperatorAddress address={address} />
          <button onClick={() => void onSignOut()} className="text-[#00FBFF]/55 hover:text-[#00FBFF]">
            SIGN OUT
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") void send(onSteer);
          }}
          disabled={busy || archived}
          placeholder={archived ? "run ended · controls locked" : "send an operator message…"}
          className="flex-1 min-w-0 bg-[#00181c] border border-[#00FBFF]/20 rounded px-2 py-1 text-base text-white placeholder-[#00FBFF]/45 focus:outline-none focus:border-[#FFBE00]/60 disabled:cursor-not-allowed disabled:opacity-55"
        />
        <button
          onClick={() => void send(onSteer)}
          disabled={busy || archived || !draft.trim()}
          className="px-2 py-1 rounded border border-[#00FBFF]/40 text-[#00FBFF] text-sm font-bold disabled:opacity-40"
        >
          STEER
        </button>
        <button
          onClick={() => void send(onBroadcast)}
          disabled={busy || archived || !draft.trim()}
          className="px-2 py-1 rounded border border-[#FFBE00]/50 text-[#FFBE00] text-sm font-bold disabled:opacity-40"
        >
          ALL
        </button>
        <button
          onClick={() => void stop()}
          disabled={busy || archived}
          className={`px-2 py-1 rounded border text-sm font-bold disabled:opacity-40 ${
            stopArmed || timeUp
              ? "animate-pulse border-[#FF5861] bg-[#FF5861] text-black"
              : "border-[#FF5861]/60 text-[#FF5861]"
          }`}
        >
          {stopArmed ? "CONFIRM STOP" : "STOP"}
        </button>
      </div>
      {error && <div className="mt-1 text-sm text-[#FF5861]">{error}</div>}
    </div>
  );
}

const FEED_STYLE: Record<FeedItem["type"], { icon: string; cls: string }> = {
  flag: { icon: "🏁", cls: "text-[#00ff9c] font-bold" },
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
      <span className="w-2.5 h-2.5 mt-1.5 rounded-sm shrink-0" style={{ background: item.color }} />
      <span className={cls}>
        {icon} {item.text}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- ChatRow */

function ChatRow({ msg }: { msg: ChatItem }) {
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
      <span className="w-2.5 h-2.5 mt-1.5 rounded-sm shrink-0" style={{ background: msg.color }} />
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
      className={`w-4 shrink-0 text-center text-sm leading-none ${status === "blocked" ? "blocked-pulse" : ""}`}
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
      className={`px-1.5 py-0.5 rounded text-sm font-bold tracking-wider shrink-0 ${
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
  const runChainId = useArenaStore(selectRunChainId);
  const className = `${compact ? "w-6 h-6" : "w-8 h-8"} shrink-0 rounded overflow-hidden transition`;
  const badge = agent.address ? (
    <BlockieAvatar address={agent.address} ensImage={null} size={compact ? 24 : 32} />
  ) : (
    <span className="flex h-full items-center justify-center text-xs font-bold" style={{ color: agent.color }}>
      {agent.short}
    </span>
  );

  if (!agent.address || runChainId !== targetNetwork.id) {
    return (
      <span
        title={`${agent.harness} + ${agent.model}${agent.address ? ` · ${agent.address}` : " · address pending"}`}
        className={className}
        style={{ border: `1px solid ${agent.color}55` }}
      >
        {badge}
      </span>
    );
  }

  return (
    <a
      href={getBlockExplorerAddressLink(targetNetwork, agent.address)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`${agent.harness} + ${agent.model} · ${agent.address}`}
      className={`${className} hover:opacity-80`}
      style={{ border: `1px solid ${agent.color}55` }}
    >
      {badge}
    </a>
  );
}

function SectionHead({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 h-10 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0">
      <span className="text-base font-bold text-[#00FBFF] tracking-widest">{label}</span>
      {hint && <span className="ml-auto text-sm text-[#00FBFF]/55">{hint}</span>}
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
      /* A tight scanline period is close to the worst case for a video encoder:
         a full-screen high-frequency pattern that burns bitrate away from the
         text. Widened and faded so the texture survives the stream cheaply. */
      .scanlines {
        background: repeating-linear-gradient(
          to bottom,
          rgba(0, 251, 255, 0.015) 0px,
          rgba(0, 251, 255, 0.015) 2px,
          transparent 2px,
          transparent 5px
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
