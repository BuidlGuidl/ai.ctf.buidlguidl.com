"use client";

import {
  type CSSProperties,
  type MouseEvent,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ContractSource } from "./ContractSource";
import { ArenaLobby } from "./Lobby";
import { ModelName } from "./ModelName";
import { OperatorAddress } from "./OperatorAddress";
import { SfxToggle } from "./SfxToggle";
import { Agent, AgentStatus, CHALLENGES, Challenge, DIFFICULTY_COLOR } from "./mockData";
import { type ArenaView, useArenaRoute } from "./useArenaRoute";
import type { Address } from "viem";
import { BlockieAvatar, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import type { EntrantSummary, RunState } from "~~/services/arena/arena-types";
import { ArenaApiError, arenaClient } from "~~/services/arena/client";
import { connectRun } from "~~/services/arena/connect";
import type { ChatItem, ConsoleEntry, FeedItem } from "~~/services/arena/projection";
import { ROSTER, displayForEntrant } from "~~/services/arena/roster";
import { playSfx, useArenaSfx } from "~~/services/arena/sfx";
import {
  type ConnectionStatus,
  selectChat,
  selectConnectionError,
  selectConnectionStatus,
  selectConsoleFor,
  selectEmptyConsole,
  selectEmptyNarration,
  selectFeed,
  selectLastFlagEvent,
  selectNarrationByEntrant,
  selectNarrationFor,
  selectPendingSteersFor,
  selectPreviewFor,
  selectRunChainId,
  selectRunDeadlineAt,
  selectRunEntrants,
  selectRunError,
  selectRunFinishedAt,
  selectRunId,
  selectRunStartedAt,
  selectRunState,
  selectServerOffsetMs,
  selectStatusChangedAt,
  selectStatusSeededAt,
  useArenaStore,
} from "~~/services/arena/store";
import { useOperatorSession } from "~~/services/arena/useOperatorSession";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

export const dynamic = "force-dynamic";

type PodiumPlace = 1 | 2 | 3;
type OverviewTab = "race" | "grid";
type RaceColumnMode = "challenges" | "order";

const fmtTokens = (tokens: number) => `${(tokens / 1000).toFixed(0)}k`;
const USAGE_PENDING_TOOLTIP = "Filled in at the end of the run, live usage is unavailable";
// A flag cell opens the challenge (and its contract) instead of focusing the
// agent, so the ring is the hint that the cell is its own target.
const CELL_LINK =
  "cursor-pointer hover:shadow-[0_0_0_1px_#00FBFF] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_#00FBFF]";
const ARENA_TIP_BASE =
  "tooltip [--tooltip-color:#0a1e23] [--tooltip-text-color:#00FBFFcc] before:border before:border-[#00FBFF]/40 before:text-[10px] before:shadow-[0_0_14px_rgba(0,251,255,0.25)]";
const ARENA_TIP = `${ARENA_TIP_BASE} tooltip-bottom after:border-b-[#00FBFF]/60`;
// The narration is 2-3 sentences, so it wraps; to the right of the handle it
// stays inside the row instead of covering the flags below.
const ARENA_TIP_RIGHT_WRAP = `${ARENA_TIP_BASE} tooltip-right after:border-r-[#00FBFF]/60 before:max-w-xs before:whitespace-pre-line before:text-left before:leading-snug`;
const NARRATION_ONLY_STORAGE_KEY = "arena.log.narrationOnly";

function PendingUsage() {
  return (
    <span
      className={`${ARENA_TIP} cursor-help underline decoration-dotted underline-offset-2`}
      data-tip={USAGE_PENDING_TOOLTIP}
      aria-label={USAGE_PENDING_TOOLTIP}
    >
      ?
    </span>
  );
}

const WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  numberingSystem: "latn",
});

const fmtWallClock = (ts: string) => {
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? "--:--:--" : WALL_CLOCK_FORMATTER.format(date);
};

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function elapsedSeconds(start: string | number, end: string | number): number | null {
  const startMs = typeof start === "number" ? start : Date.parse(start);
  const endMs = typeof end === "number" ? end : Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.floor((endMs - startMs) / 1000);
}

function useNow(enabled: boolean, resetKey: object) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled, resetKey]);

  return now;
}

const fmtAge = (ts: string, now: number) => {
  const seconds = elapsedSeconds(ts, now);
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

function NarrationAge({ ts, now }: { ts: string; now: number }) {
  return <span className="shrink-0 text-xs tabular-nums text-[#00FBFF]/50">{fmtAge(ts, now)}</span>;
}

const fmtFinishTime = (s: number) => {
  if (s >= 3600) return fmtClock(s);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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
const IDLE_FADE_MS = 20_000;
// The backend flips a run to `running` before the containers preflight, and the
// entrants sit `idle` until their first turn. No fading while the race boots.
const FADE_START_GRACE_MS = 60_000;
// The confirm stays disabled for a beat after arming, so the second half of a
// double-click cannot reach it.
const STOP_CONFIRM_DWELL_MS = 400;

const PODIUM_RESULT: Record<PodiumPlace, string> = {
  1: "ARENA CHAMPION",
  2: "SECOND PLACE SECURED",
  3: "THIRD PLACE SECURED",
};

// Flags first, then the clock for anyone who cleared the board, then whoever
// reached that flag count soonest, then a stable id tiebreak. Cost is kept out
// of the tiebreak — it changes every tick, which would make the race rows swap
// (and animate) constantly for no real reason.
const rankAgents = (agents: Agent[]) =>
  [...agents].sort(
    (a, b) =>
      b.solved.length - a.solved.length ||
      (a.finishedAt !== null && b.finishedAt !== null ? a.finishedAt - b.finishedAt : 0) ||
      (a.lastSolveAt ?? "\uffff").localeCompare(b.lastSolveAt ?? "\uffff") ||
      a.id.localeCompare(b.id),
  );

// The announced target only means something while the agent is still chasing it:
// `done` keeps the last announce forever, `score.flag` never clears it, and the id
// is self-reported so it can land off the board. Every surface reads it through here.
const activeTarget = (a: Agent): number | null => {
  const id = a.currentChallengeId;
  if (id === null || a.status === "done" || a.solved.includes(id)) return null;
  return CHALLENGES.some(c => c.id === id) ? id : null;
};

const agentRuntimeLabel = (agent: Agent) =>
  `${agent.harness} + ${agent.model}${agent.effort ? ` · ${agent.effort}` : ""}`;

function statusHeldForMs(agent: Agent, now: number | null): number {
  if (now === null || agent.statusChangedAt === null) return 0;
  const changedAt = Date.parse(agent.statusChangedAt);
  return Number.isFinite(changedAt) ? now - changedAt : 0;
}

// `now` is null while the run is not live, so a locked board never fades. A
// finisher that cleared every flag is done, not dead, so it keeps full colour.
function isAgentFaded(agent: Agent, now: number | null): boolean {
  if (now === null || agent.finishedAt !== null) return false;
  if (agent.status === "done") return true;
  if (agent.status !== "idle") return false;
  return statusHeldForMs(agent, now) >= IDLE_FADE_MS;
}

// What the nudge sound is for: an agent that has stopped moving on its own. The
// faded ones, and on top of them one stuck on a permission prompt — that one
// keeps its colour and its warning pulse, because it wants the director's
// attention rather than less of it.
function isAgentStalled(agent: Agent, now: number | null): boolean {
  if (isAgentFaded(agent, now)) return true;
  if (now === null || agent.finishedAt !== null || agent.status !== "blocked") return false;
  return statusHeldForMs(agent, now) >= IDLE_FADE_MS;
}

function secondsFrom(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return elapsedSeconds(start, end);
}

function agentsFromRun(
  entrants: EntrantSummary[] | null,
  statusChangedAt: Record<string, string> | null,
  startedAt: string | null,
  runState: RunState | null,
): Agent[] {
  const usagePending = runState !== "finished" && runState !== "failed";
  if (!entrants) {
    return ROSTER.map(entrant => {
      const display = displayForEntrant(entrant.id, entrant.harness, entrant.model);
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
        usagePending,
        lastSolveAt: null,
        finishedAt: null,
        currentChallengeId: null,
      };
    });
  }

  return entrants.map(entrant => {
    const display = displayForEntrant(entrant.id, entrant.harness, entrant.model, entrant.effort);
    const lastSolve = entrant.solves.at(-1)?.ts ?? null;
    const clearedAt = entrant.solves.length >= CHALLENGES.length ? lastSolve : null;
    return {
      id: entrant.id,
      handle: display.handle,
      harness: display.harnessLabel,
      model: display.modelLabel,
      effort: display.effort,
      vendor: display.vendor,
      color: display.color,
      short: display.short,
      address: entrant.address as Address | null,
      solved: entrant.solves.map(solve => solve.challengeId),
      status: entrant.status,
      statusChangedAt: statusChangedAt?.[entrant.id] ?? null,
      tokens: entrant.inputTokens + entrant.outputTokens,
      cost: entrant.costUsd,
      usagePending,
      lastSolveAt: lastSolve,
      finishedAt: secondsFrom(startedAt, clearedAt),
      currentChallengeId: entrant.currentChallengeId,
    };
  });
}

function arenaClock(
  startedAt: string | null,
  deadlineAt: string | null,
  runState: RunState | null,
  runFinishedAt: string | null,
  now: number,
) {
  const end = runFinishedAt ? Date.parse(runFinishedAt) : now;
  const elapsed = startedAt ? elapsedSeconds(startedAt, end) ?? 0 : 0;
  const timeUp = deadlineAt ? end >= Date.parse(deadlineAt) && runState === "running" : false;
  return { now, seconds: elapsed, timeUp };
}

// The page is one client component reading `useSearchParams`, so it needs a
// boundary of its own to suspend behind.
export default function ArenaPage() {
  return (
    <Suspense fallback={<ArenaBoot />}>
      <ArenaScreen />
    </Suspense>
  );
}

function ArenaScreen() {
  const [flashes, setFlashes] = useState<string[]>([]);
  const flashTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [openChallenge, setOpenChallenge] = useState<number | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [raceColumnMode, setRaceColumnMode] = useState<RaceColumnMode>("challenges");
  const [liveStarted, setLiveStarted] = useState(false);
  const [ceremonyReady, setCeremonyReady] = useState(false);
  // Whoever watches the match lock gets the finish sting before the podium takes
  // over; a link opened on an already-locked run has no sting to wait for.
  const sawLiveRun = useRef(false);
  const podiumShown = useRef(false);
  // Connecting replays the run's history, so whatever the store is already
  // holding has happened without us — it lights the board, but announcing it
  // would fire a burst of captures at whoever just opened the link. Events at
  // or below this cursor are that history; only what lands past it gets a sound.
  const heardEventId = useRef<number | null>(null);
  const heardRunState = useRef<RunState | null>(null);
  const idleNudged = useRef(new Set<string>());
  const idleSoundRunId = useRef<string | null>(null);
  const route = useArenaRoute();
  const runId = useArenaStore(selectRunId);
  const runState = useArenaStore(selectRunState);
  const runEntrants = useArenaStore(selectRunEntrants);
  const statusChangedAt = useArenaStore(selectStatusChangedAt);
  const statusSeededAt = useArenaStore(selectStatusSeededAt);
  const serverOffsetMs = useArenaStore(selectServerOffsetMs);
  const runStartedAt = useArenaStore(selectRunStartedAt);
  const runDeadlineAt = useArenaStore(selectRunDeadlineAt);
  const connectionStatus = useArenaStore(selectConnectionStatus);
  const connectionError = useArenaStore(selectConnectionError);
  const lastFlagEvent = useArenaStore(selectLastFlagEvent);
  const runFinishedAt = useArenaStore(selectRunFinishedAt);
  const runError = useArenaStore(selectRunError);
  const narrationClockKey = useArenaStore(selectNarrationByEntrant);
  const operator = useOperatorSession();
  useArenaSfx();

  // The run in the URL is the connection: landing on one, leaving it, or walking
  // back to it with the browser has to move the page with it. Every reset for a
  // change of run lives here, so there is one path in and out of a run.
  const routeRunId = route.runId;
  // `undefined`, not `null`: the store outlives the page, so a mount that names
  // no run still has to run and drop whatever the last one left behind.
  const connectedRunId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (routeRunId === connectedRunId.current) return;
    connectedRunId.current = routeRunId;
    // The old run goes before the new one is named. Keeping it until the next
    // snapshot lands would leave the page showing — and the operator steering —
    // a run the URL has already left, and would hide a 404 on the new one behind
    // the old one's id.
    const store = useArenaStore.getState();
    store.clear();
    if (routeRunId) store.setCurrentRunId(routeRunId);
    setLiveStarted(false);
    setCeremonyReady(false);
    podiumShown.current = false;
    sawLiveRun.current = false;
    heardEventId.current = null;
    heardRunState.current = null;
    idleNudged.current.clear();
    idleSoundRunId.current = null;
  }, [routeRunId]);

  const currentRunId = useArenaStore(state => state.currentRunId);
  useEffect(() => {
    if (!currentRunId) return;
    return connectRun(currentRunId);
  }, [currentRunId]);

  const agents = useMemo(
    () => agentsFromRun(runEntrants, statusChangedAt, runStartedAt, runState),
    [runEntrants, runStartedAt, runState, statusChangedAt],
  );
  const startMatch = useCallback(() => setLiveStarted(true), []);

  const goFocus = useCallback((id: string) => route.go({ agent: id }), [route]);
  const closeLog = useCallback(() => route.go({ agent: null }), [route]);
  // Lives here, not in AgentLog: the panel remounts per agent, and the viewer
  // comparing narration across lanes should not re-press the toggle each time.
  const [narrationOnly, setNarrationOnly] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NARRATION_ONLY_STORAGE_KEY);
      if (stored !== null) setNarrationOnly(stored === "1");
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, []);
  const toggleNarration = useCallback(() => {
    const next = !narrationOnly;
    setNarrationOnly(next);
    try {
      window.localStorage.setItem(NARRATION_ONLY_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // The preference still applies for this tab.
    }
  }, [narrationOnly]);

  // Null on the overview: nobody is being observed, so no lane is named — the
  // composer speaks to everyone and the challenge board shows the whole field.
  const focused = useMemo(() => agents.find(a => a.id === route.agentId) ?? null, [agents, route.agentId]);
  const ranked = useMemo(() => rankAgents(agents), [agents]);
  const totalSolved = useMemo(() => agents.reduce((n, a) => n + a.solved.length, 0), [agents]);
  const allFinished = runState === "finished";
  const runFailed = runState === "failed";
  const runTerminal = allFinished || runFailed;
  const clockRunning = runStartedAt !== null && !runTerminal;
  const narrationNow = useNow(clockRunning, narrationClockKey);
  // Only while the race is actually running: a run already stopping takes no
  // second stop, and the backend answers the retry with an error.
  const canStopRace = (operator.authenticated || operator.hadSession) && runState === "running";
  const clock = arenaClock(runStartedAt, runDeadlineAt, runState, runFinishedAt, narrationNow);

  useEffect(() => {
    if (runState && runState !== "finished" && runState !== "failed") sawLiveRun.current = true;
  }, [runState]);

  // A run that was already over when the page attached gets no verdict sound.
  useEffect(() => {
    if (!runState) return;
    const previous = heardRunState.current;
    heardRunState.current = runState;
    if (previous === null || previous === runState) return;
    if (runState === "failed") playSfx("fail");
  }, [runState]);

  // Not while `stopping`: every entrant goes `done` as the run winds down, and a
  // board dimming all at once there reads as a field that died rather than as a
  // race the operator ended. The stamps being compared come from the backend, so
  // the browser clock is carried onto its clock first.
  const raceLive = runState === "running";
  const serverNow = clock.now + serverOffsetMs;
  const pastGrace = runStartedAt !== null && serverNow - Date.parse(runStartedAt) >= FADE_START_GRACE_MS;
  const fadeNow = raceLive && pastGrace ? serverNow : null;

  useEffect(() => {
    if (!runEntrants || !runId) return;
    const nudged = idleNudged.current;
    if (idleSoundRunId.current !== runId) {
      nudged.clear();
      agents.filter(agent => isAgentStalled(agent, fadeNow)).forEach(agent => nudged.add(agent.id));
      idleSoundRunId.current = runId;
      return;
    }
    // Keyed on the stall, not on `idle`: an agent whose process exited and one
    // sitting on a permission prompt are both worth hearing about, and neither
    // passes through `idle`.
    agents.forEach(agent => {
      if (!isAgentStalled(agent, fadeNow)) {
        nudged.delete(agent.id);
      } else if (!nudged.has(agent.id)) {
        nudged.add(agent.id);
        // A seed stamp means we never saw this agent stop, only that it already
        // had when the page loaded: show it on the board, but don't announce it.
        if (agent.statusChangedAt !== statusSeededAt) playSfx("idle");
      }
    });
  }, [agents, fadeNow, runEntrants, runId, statusSeededAt]);

  // A link with no view lands on the board while the race is live and on the
  // podium once it is locked; anything the operator picked is spelled out in the
  // URL and wins over both.
  const view: ArenaView = route.view ?? (allFinished && !sawLiveRun.current ? "results" : "race");
  const overviewTab: OverviewTab = view === "grid" ? "grid" : "race";
  const gridUsesFullWidth = overviewTab === "grid" && !focused && !operator.authenticated;
  const setView = useCallback((next: ArenaView) => route.go({ view: next }), [route]);

  // Where ARENA DATA goes back to, so leaving the podium returns to the stage the
  // operator was watching rather than always to the race track.
  const stageBeforePodium = useRef<OverviewTab>("race");
  useEffect(() => {
    if (view !== "results") stageBeforePodium.current = overviewTab;
  }, [overviewTab, view]);

  // Dropping the run from the URL is the whole exit — the effect above sees it
  // leave and tears down the connection and the view state with it.
  const backToLobby = useCallback(() => route.go({ run: null, view: null, agent: null }, { replace: true }), [route]);

  useEffect(() => {
    if (!lastFlagEvent) return;
    const key = `${lastFlagEvent.payload.entrantId}:${lastFlagEvent.payload.challengeId}`;
    if (heardEventId.current !== null && lastFlagEvent.id > heardEventId.current) {
      const blood = useArenaStore.getState().projection?.firstBlood ?? null;
      const opener =
        blood !== null &&
        blood.entrantId === lastFlagEvent.payload.entrantId &&
        blood.challengeId === lastFlagEvent.payload.challengeId;
      playSfx(opener ? "firstBlood" : "flag");
    }
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

  // The seeded projection arrives with its replay already applied, so its
  // cursor at that moment is the line between history and live. Reading it
  // here (not effect order) keeps the replay silent, and dropping the cursor
  // whenever the run leaves the store means a re-entered run re-draws the line.
  useEffect(() => {
    if (!runId) {
      heardEventId.current = null;
      return;
    }
    if (heardEventId.current === null) {
      heardEventId.current = useArenaStore.getState().projection?.lastEventId ?? 0;
    }
  }, [runId]);

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

  // Once the sting has aired the podium takes the stage, whichever one was up.
  // It happens once: from there the URL rules, so ARENA DATA — or a reload of a
  // run that locked long ago — is not overruled a few seconds later.
  useEffect(() => {
    if (!ceremonyReady || podiumShown.current || !sawLiveRun.current) return;
    podiumShown.current = true;
    playSfx("podium");
    route.go({ view: "results" }, { replace: true });
  }, [ceremonyReady, route]);

  // Ending the race is a run-level act, so it answers in the run header rather
  // than in the observed lane's strip — and its failures need a place of their
  // own now that there is no composer underneath to print them.
  const stopRace = useCallback(async () => {
    if (!runId) return;
    setStopError(null);
    try {
      const snapshot = await arenaClient.stopRun(runId);
      useArenaStore.getState().syncSnapshot(snapshot);
    } catch (cause) {
      if (cause instanceof ArenaApiError && cause.status === 401) {
        operator.invalidate();
        setStopError("operator session expired — sign in again");
      } else {
        setStopError(cause instanceof Error ? cause.message : "The stop request failed");
      }
    }
  }, [operator, runId]);

  const steer = useCallback(
    async (text: string) => {
      if (!runId || !focused) return;
      const sinceEventId = useArenaStore.getState().projection?.lastEventId ?? 0;
      const { status } = await arenaClient.steerEntrant(runId, focused.id, { text });
      // An injected steer is already on its way back as an event; only a queued
      // one needs the hint to stand in until the agent's turn ends.
      if (status === "queued") useArenaStore.getState().addPendingSteer(focused.id, text, sinceEventId);
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

  // Recovery for the observed lane only. The backend rebuilds the opening prompt
  // and the events come back over SSE, so there is nothing to sync here.
  const restart = useCallback(async () => {
    if (!runId || !focused) return;
    await arenaClient.restartEntrant(runId, focused.id);
  }, [focused, runId]);

  if (route.runId && !runId && (connectionStatus === "not-found" || connectionStatus === "error")) {
    return (
      <RunExitPanel
        title="RUN NOT FOUND"
        message={
          connectionStatus === "not-found"
            ? "This arena run no longer exists. The backend may have restarted."
            : connectionError ?? "Could not load the arena run."
        }
        onBack={backToLobby}
      />
    );
  }

  if (!agents.length || (route.runId && !runId)) return <ArenaBoot />;

  if (!liveStarted) {
    return <ArenaLobby agents={agents} onLaunch={startMatch} onStartOver={backToLobby} />;
  }

  if (view === "results" && allFinished) {
    return (
      <FinalCeremony
        ranked={ranked}
        stage={stageBeforePodium.current}
        onViewData={() => setView(stageBeforePodium.current)}
        onExit={backToLobby}
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col bg-black text-[#00FBFF] font-mono overflow-hidden arena-root ${
        overviewTab === "grid" ? "arena-grid-mode" : ""
      }`}
    >
      <Scanlines />
      <TopBar
        clock={clock.seconds}
        timeUp={clock.timeUp}
        totalSolved={totalSolved}
        allFinished={allFinished}
        runFailed={runFailed}
        runStopping={runState === "stopping"}
        agentCount={agents.length}
        connectionStatus={connectionStatus}
        onViewResults={allFinished ? () => setView("results") : undefined}
        onStop={canStopRace ? stopRace : undefined}
      />

      {stopError && (
        <div className="flex shrink-0 items-center gap-4 border-b border-[#FF5861]/50 bg-[#FF5861]/10 px-5 py-2 text-[#FF5861]">
          <span className="font-dotGothic tracking-widest">STOP FAILED</span>
          <span className="min-w-0 flex-1 text-sm text-[#FF5861]/80">{stopError}</span>
          <button
            onClick={() => setStopError(null)}
            title="dismiss"
            className="h-6 w-6 shrink-0 rounded border border-[#FF5861]/60 text-xs transition hover:bg-[#FF5861] hover:text-black"
          >
            ✕
          </button>
        </div>
      )}

      {runFailed && (
        <div className="flex shrink-0 items-center gap-4 border-b border-[#FF5861]/50 bg-[#FF5861]/10 px-5 py-3 text-[#FF5861]">
          <span className="font-dotGothic text-xl tracking-widest">RUN ENDED WITH AN ERROR</span>
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

      <div className="arena-content flex flex-col flex-1 min-h-0">
        <div className="arena-stage-row flex flex-1 min-h-0">
          {/* MAIN STAGE — always the wide shot, so observing an agent never hides the race */}
          <div
            className={`flex flex-col flex-1 min-w-0 ${
              gridUsesFullWidth ? "2xl:border-r 2xl:border-[#00FBFF]/20" : "border-r border-[#00FBFF]/20"
            }`}
          >
            <div className="arena-main-stage-padding flex-1 min-h-0 relative p-4">
              <div className="h-full flex flex-col border border-[#00FBFF]/25 rounded-lg bg-[#020a0c]/80 overflow-hidden shadow-[0_0_40px_-12px_rgba(0,251,255,0.4)]">
                <StageTabs
                  tab={overviewTab}
                  onTab={setView}
                  raceColumnMode={raceColumnMode}
                  onRaceColumnMode={setRaceColumnMode}
                />
                <OverviewStage
                  ranked={ranked}
                  now={fadeNow}
                  tab={overviewTab}
                  onPick={goFocus}
                  onOpenChallenge={setOpenChallenge}
                  flashes={flashes}
                  raceColumnMode={raceColumnMode}
                  narrationNow={narrationNow}
                  selectedId={focused?.id ?? null}
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — the unified arena stream; the observed agent's log takes over here */}
          <div
            className={`arena-right-rail w-[520px] flex-col min-h-0 min-w-0 ${
              gridUsesFullWidth ? "hidden 2xl:flex" : "flex"
            }`}
          >
            {focused ? (
              <AgentLog
                key={focused.id}
                focused={focused}
                onClose={closeLog}
                narrationOnly={narrationOnly}
                narrationNow={narrationNow}
                runTerminal={runTerminal}
                onToggleNarration={toggleNarration}
              />
            ) : (
              <ArenaStream />
            )}
            {/* Run URLs are spectator-shareable, so the strip only shows for someone
                who is (or was, mid-race) the operator — never as a sign-in invitation. */}
            {(operator.authenticated || operator.hadSession) && (
              <OperatorStrip
                focused={focused}
                address={operator.address}
                authenticated={operator.authenticated}
                hadSession={operator.hadSession}
                archived={runTerminal}
                restartable={runState === "running"}
                onSteer={steer}
                onBroadcast={broadcast}
                onRestart={restart}
                onInvalidate={operator.invalidate}
                onSignIn={operator.signIn}
              />
            )}
          </div>
        </div>

        {/* BOTTOM — full-width strip under both columns. Multiview fills its cards
            with terminals and no standings, so the race track runs along the bottom
            there; the race stage keeps the challenge board instead. */}
        {overviewTab === "grid" ? (
          <div className="arena-grid-race-strip shrink-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#010607]">
            <SectionHead label="RACE" hint="showing top 5 · scroll for all" />
            <div className="arena-grid-race-scroll h-[190px] overflow-y-auto console-scroll">
              <RaceView
                ranked={ranked}
                now={fadeNow}
                onPick={goFocus}
                onOpenChallenge={setOpenChallenge}
                flashes={flashes}
                columnMode={raceColumnMode}
                compact
                narrationNow={narrationNow}
                selectedId={focused?.id ?? null}
              />
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

function ArenaBoot() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-[#00FBFF] font-dotGothic text-2xl tracking-widest">
      <span className="animate-pulse">◆ LOADING RUN…</span>
    </div>
  );
}

function RunExitPanel({ title, message, onBack }: { title: string; message: string; onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black px-6 text-[#00FBFF] font-mono">
      <div className="absolute right-5 top-4">
        <RainbowKitCustomConnectButton />
      </div>
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
// One exit row, both ways out weighted the same: back to the run's own stage,
// which is still there behind the podium, or out to the lobby for a new race.
// Leaving costs nothing — the run stays reachable from the runs page.
function FinalCeremony({
  ranked,
  stage,
  onViewData,
  onExit,
}: {
  ranked: Agent[];
  stage: OverviewTab;
  onViewData: () => void;
  onExit: () => void;
}) {
  if (!ranked.length) return null;

  const rest = ranked.slice(3);
  const columnBreak = Math.ceil(rest.length / 2);
  const columns = [rest.slice(0, columnBreak), rest.slice(columnBreak)];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black text-[#00FBFF] font-mono final-root">
      <Scanlines />
      <div className="pointer-events-none absolute inset-0 z-10 final-victory-sweep" />

      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[#FFBE00]/25 bg-black/65 px-4 sm:px-5">
        <span className="flex items-center gap-2 text-sm font-bold tracking-[0.18em] text-[#00ff9c] lg:mr-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ff9c] shadow-[0_0_10px_#00ff9c]" />
          FINISHED
        </span>
        <div className="hidden font-dotGothic text-lg tracking-wide text-[#00FBFF] lg:block lg:text-xl">
          BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · RUN SUMMARY
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SfxToggle className="hidden sm:inline-block" />
          <RainbowKitCustomConnectButton />
        </div>
      </header>

      <main className="console-scroll relative z-20 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-8">
        <section className="final-lock-in mx-auto max-w-5xl text-center">
          <div className="text-sm font-bold tracking-[0.35em] text-[#00ff9c]">FINAL</div>
          <h1 className="final-title mt-2 font-dotGothic text-3xl tracking-[0.12em] text-white sm:text-5xl">
            RUN SUMMARY
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
              <span>FINAL RESULTS</span>
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
                            {agent.harness} · <ModelName name={agent.model} effort={agent.effort} />
                          </div>
                        </div>
                        {agent.finishedAt !== null && (
                          <span className="hidden shrink-0 text-base text-[#00FBFF]/70 min-[430px]:inline">
                            {agent.solved.length} FLAGS
                          </span>
                        )}
                        <div className="min-w-[104px] shrink-0 text-right">
                          <div className="text-lg font-bold tabular-nums text-[#00ff9c]">
                            {agent.finishedAt === null
                              ? `${agent.solved.length}/${CHALLENGES.length}`
                              : fmtClock(agent.finishedAt)}
                          </div>
                          <div className="mt-0.5 whitespace-nowrap text-xs tracking-[0.12em] tabular-nums">
                            <span className="text-[#00FBFF]/50">{fmtTokens(agent.tokens)} TOK · </span>
                            <span className={agent.cost === null ? "text-[#00FBFF]/50" : "text-[#FFBE00]/70"}>
                              {agent.cost === null ? "N/A" : `$${agent.cost.toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        <div
          className="final-result-in mx-auto mt-8 flex w-fit flex-wrap items-center justify-center gap-3 text-center"
          style={{ animationDelay: `${1.25 + rest.length * 0.08}s` }}
        >
          <button
            onClick={onViewData}
            className="inline-flex h-11 min-w-[15rem] items-center justify-center rounded border border-[#00FBFF]/40 px-4 font-dotGothic text-sm leading-none tracking-widest text-[#00FBFF]/80 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
          >
            ◂ SEE THE {stage === "grid" ? "MULTIVIEW" : "RACE BOARD"}
          </button>
          {/* Amber because this one leaves the run — the only button here that does.
              Both boxes are pinned to the same size: the ◂ glyph comes from a
              fallback font whose taller metrics would otherwise grow one button. */}
          <button
            onClick={onExit}
            className="inline-flex h-11 min-w-[15rem] items-center justify-center rounded border border-[#FFBE00]/40 px-4 font-dotGothic text-sm leading-none tracking-widest text-[#FFBE00]/80 transition hover:border-[#FFBE00] hover:text-[#FFBE00]"
          >
            START A NEW RACE ▸
          </button>
        </div>
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
          {agent.harness} · <ModelName name={agent.model} effort={agent.effort} />
        </div>
        <div
          className={`mt-3 font-dotGothic tabular-nums ${
            winner ? "text-3xl text-[#FFBE00]" : "text-xl text-[#00ff9c]"
          }`}
        >
          {agent.finishedAt === null ? `${agent.solved.length}/${CHALLENGES.length} FLAGS` : fmtClock(agent.finishedAt)}
        </div>
        {/* When the hero slot carries the flags, the footer only needs tokens.
            When it carries the clock, the footer keeps flags ahead of tokens. */}
        <div className="mt-1 text-sm tracking-[0.16em] text-[#00FBFF]/60">
          {agent.finishedAt === null
            ? `${fmtTokens(agent.tokens)} TOK`
            : `${agent.solved.length}/${CHALLENGES.length} FLAGS · ${fmtTokens(agent.tokens)} TOK`}{" "}
          · {agent.cost === null ? "COST N/A" : `$${agent.cost.toFixed(2)}`}
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
// `onStop` is handed over only to an operator of a run that is still live.
function TopBar({
  clock,
  timeUp,
  totalSolved,
  allFinished,
  runFailed,
  runStopping,
  agentCount,
  connectionStatus,
  onViewResults,
  onStop,
}: {
  clock: number;
  timeUp: boolean;
  totalSolved: number;
  allFinished: boolean;
  runFailed: boolean;
  runStopping: boolean;
  agentCount: number;
  connectionStatus: ConnectionStatus;
  onViewResults?: () => void;
  onStop?: () => Promise<void>;
}) {
  return (
    <div className="arena-top-bar flex items-center gap-4 px-5 h-16 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] shrink-0">
      <span
        className={`arena-live-status flex items-center gap-2 font-bold tracking-widest ${
          allFinished ? "text-[#00ff9c]" : runStopping ? "text-[#FFBE00]" : "text-[#FF5861]"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            allFinished
              ? "bg-[#00ff9c]"
              : runStopping
              ? "bg-[#FFBE00] live-dot"
              : runFailed
              ? "bg-[#FF5861]"
              : "bg-[#FF5861] live-dot"
          }`}
        />
        {allFinished ? "FINISHED" : runFailed ? "FAILED" : runStopping ? "STOPPING" : "RUNNING"}
      </span>
      <Link
        href="/arena"
        title="leave this run for the lobby — find it again under previous runs"
        className="arena-topbar-title hidden sm:block font-dotGothic text-xl md:text-2xl text-[#00FBFF] tracking-wide title-glow transition-opacity hover:opacity-80"
      >
        BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENT ARENA
      </Link>
      <div className="hidden 2xl:flex items-center gap-1 text-sm text-[#00FBFF]/70">
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{agentCount} AGENTS</span>
        <span className="px-2 py-0.5 border border-[#00FBFF]/20 rounded">{CHALLENGES.length} CHALLENGES</span>
      </div>
      {timeUp && (
        <span className="animate-pulse rounded border border-[#FF5861] bg-[#FF5861]/15 px-3 py-1 text-sm font-bold tracking-widest text-[#FF5861]">
          DEADLINE REACHED · OPERATOR: STOP THE RUN
        </span>
      )}
      <div className="arena-topbar-metrics ml-auto flex items-center gap-4 text-lg">
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
        <span className="arena-topbar-connection hidden xl:inline text-sm uppercase tracking-wider text-[#00FBFF]/55">
          {connectionStatus}
        </span>
        {/* The race clock is the one number the stream never stops reading. */}
        <span className={`arena-clock text-3xl tabular-nums font-bold ${timeUp ? "text-[#FF5861]" : "text-[#FFBE00]"}`}>
          ⏱ {fmtClock(clock)}
        </span>
        {onStop && <RunStopControl timeUp={timeUp} onStop={onStop} />}
        <SfxToggle className="arena-topbar-sfx hidden sm:inline-block" />
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
}

// Stopping ends the race for every agent, so it belongs to the run header and
// not beside the observed lane's RESTART, where it read as one more thing done
// to that agent. Two clicks, and the arm lapses on its own — a native confirm
// would cover the board.
function RunStopControl({ timeUp, onStop }: { timeUp: boolean; onStop: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [confirmDisabled, setConfirmDisabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      clearTimeout(armTimer.current ?? undefined);
      clearTimeout(confirmTimer.current ?? undefined);
    },
    [],
  );

  const click = async () => {
    if (busy) return;
    clearTimeout(armTimer.current ?? undefined);
    clearTimeout(confirmTimer.current ?? undefined);
    if (!armed) {
      setArmed(true);
      setConfirmDisabled(true);
      confirmTimer.current = setTimeout(() => {
        setConfirmDisabled(false);
        confirmTimer.current = null;
      }, STOP_CONFIRM_DWELL_MS);
      armTimer.current = setTimeout(() => setArmed(false), STOP_ARM_MS);
      return;
    }
    if (confirmDisabled) return;
    setArmed(false);
    setConfirmDisabled(false);
    setBusy(true);
    try {
      await onStop();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={() => void click()}
      disabled={busy || (armed && confirmDisabled)}
      title="end the race for every agent"
      className={`shrink-0 whitespace-nowrap rounded border px-2 py-1 text-[10px] font-bold tracking-widest transition disabled:opacity-40 ${
        armed || timeUp
          ? "animate-pulse border-[#FF5861] bg-[#FF5861] text-black"
          : "border-[#FF5861]/60 text-[#FF5861] hover:bg-[#FF5861]/10"
      }`}
    >
      {busy ? "STOPPING…" : armed ? "CONFIRM STOP" : "■ STOP RUN"}
    </button>
  );
}

/* --------------------------------------------------------------- StageTabs */

const STAGE_TABS: { id: OverviewTab; label: string }[] = [
  { id: "race", label: "🏁 RACE" },
  { id: "grid", label: "▦ MULTIVIEW" },
];

function StageTabs({
  tab,
  onTab,
  raceColumnMode,
  onRaceColumnMode,
}: {
  tab: OverviewTab;
  onTab: (tab: OverviewTab) => void;
  raceColumnMode: RaceColumnMode;
  onRaceColumnMode: (mode: RaceColumnMode) => void;
}) {
  return (
    <div className="arena-stage-tabs flex items-center gap-2 px-4 h-12 border-b border-[#00FBFF]/20 bg-[#001417] shrink-0">
      <span className="arena-stage-label font-dotGothic text-lg text-[#00FBFF]/70 mr-2">OVERVIEW</span>
      {STAGE_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          title={t.label}
          className={`arena-stage-tab px-3 py-1 rounded text-sm font-bold tracking-wider transition ${
            tab === t.id
              ? "bg-[#00FBFF]/15 text-[#00FBFF] border border-[#00FBFF]/50"
              : "text-[#00FBFF]/60 border border-transparent hover:text-[#00FBFF]"
          }`}
        >
          {t.label}
        </button>
      ))}
      <div className="arena-race-mode ml-auto flex items-center gap-2">
        <span className="arena-race-mode-label text-xs font-bold tracking-widest text-[#00FBFF]/45">FLAG VIEW</span>
        <div className="flex items-center rounded border border-[#00FBFF]/25 p-0.5">
          {(["challenges", "order"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => onRaceColumnMode(mode)}
              aria-pressed={raceColumnMode === mode}
              title={mode === "challenges" ? "Keep every flag in its challenge column" : "Show flags in capture order"}
              className={`arena-race-mode-tab rounded px-2 py-0.5 text-xs font-bold tracking-wider transition ${
                raceColumnMode === mode ? "bg-[#00FBFF]/15 text-[#00FBFF]" : "text-[#00FBFF]/50 hover:text-[#00FBFF]"
              }`}
            >
              {mode === "challenges" ? "1–12" : "SOLVE ORDER"}
            </button>
          ))}
        </div>
      </div>
      <span className="arena-stage-hint ml-2 text-sm text-[#00FBFF]/55">select an agent to follow its log ▸</span>
    </div>
  );
}

/* ---------------------------------------------------------------- AgentLog */

// The observer console for one agent — lives in the right column so the wide
// shot behind it keeps running.
function AgentLog({
  focused,
  onClose,
  narrationOnly,
  narrationNow,
  runTerminal,
  onToggleNarration,
}: {
  focused: Agent;
  onClose: () => void;
  narrationOnly: boolean;
  narrationNow: number;
  runTerminal: boolean;
  onToggleNarration: () => void;
}) {
  const lines = useArenaStore(narrationOnly ? selectEmptyConsole : selectConsoleFor(focused.id));
  const narration = useArenaStore(narrationOnly ? selectNarrationFor(focused.id) : selectEmptyNarration);
  const visibleRows = narrationOnly ? narration : lines;
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [visibleRows]);

  const finished = focused.status === "done";
  const target = activeTarget(focused);

  return (
    <div className="arena-agent-log arena-agent-log-in flex-1 min-h-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#020a0c]">
      {/* Two rows, not one: at broadcast sizes the badges crowd the handle off
          the end of a single line, and the observed agent's name is the whole
          point of this panel. */}
      <div className="flex flex-col gap-1 px-3 py-1.5 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0 text-base">
        <div className="flex items-center gap-2">
          <AgentBlockieLink agent={focused} />
          <span className="flex-1 min-w-0 text-lg font-bold text-white truncate">
            <span className="text-[#00FBFF]/70">AGENT LOG · </span>
            <ModelName name={focused.handle} effort={focused.effort} />
          </span>
          <button
            onClick={onClose}
            title="back to race"
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
          ) : target !== null ? (
            <span className="px-1.5 py-0.5 rounded font-bold shrink-0 text-sm text-[#FFBE00] border border-[#FFBE00]/40">
              TARGET #{target}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded font-bold shrink-0 text-sm text-[#00FBFF]/70 border border-[#00FBFF]/20">
              TARGET UNREPORTED
            </span>
          )}
          <button
            type="button"
            onClick={onToggleNarration}
            aria-pressed={narrationOnly}
            title="Show only the narrated summary of what this agent is doing"
            className={`arena-race-mode-tab shrink-0 rounded px-2 py-0.5 text-xs font-bold tracking-wider transition ${
              narrationOnly ? "bg-[#00FBFF]/15 text-[#00FBFF]" : "text-[#00FBFF]/50 hover:text-[#00FBFF]"
            }`}
          >
            NARRATION
          </button>
          <span className="ml-auto text-[#00ff9c] font-bold shrink-0">
            {focused.solved.length}/{CHALLENGES.length}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-base leading-snug console-scroll">
        {narrationOnly ? (
          narration.length === 0 ? (
            <div className="text-[#00FBFF]/40 italic">
              {finished || runTerminal ? "no narration available" : "waiting for narration…"}
            </div>
          ) : (
            narration.map((entry, index) => (
              <div
                key={entry.id ?? `snapshot:${entry.ts}:${entry.basedOnEventId}`}
                className="flex min-w-0 items-start gap-2"
              >
                <span className="shrink-0 text-[#00FBFF]/50 tabular-nums">{fmtWallClock(entry.ts)}</span>
                <span className="min-w-0 flex-1 text-[#7fd8dd]">
                  {entry.text}
                  {index === narration.length - 1 && (
                    <>
                      {" "}
                      <NarrationAge ts={entry.ts} now={narrationNow} />
                    </>
                  )}
                </span>
              </div>
            ))
          )
        ) : (
          lines.map(l => <ConsoleRow key={l.id} line={l} />)
        )}
        {finished ? (
          <div className="mt-2 border-t border-[#00ff9c]/20 pt-2 text-[#00ff9c] font-bold">
            ◆ AGENT FINISHED · FINAL LOG
          </div>
        ) : narrationOnly ? null : (
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
  if (line.kind === "steer") return <div className="text-[#FFBE00] font-bold">◆ DIRECTOR: {line.text}</div>;
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

function OverviewStage({
  ranked,
  now,
  tab,
  onPick,
  onOpenChallenge,
  flashes,
  raceColumnMode,
  narrationNow,
  selectedId,
}: {
  ranked: Agent[];
  now: number | null;
  tab: OverviewTab;
  onPick: (id: string) => void;
  onOpenChallenge: (id: number) => void;
  flashes: string[];
  raceColumnMode: RaceColumnMode;
  narrationNow: number;
  selectedId: string | null;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto console-scroll">
      {tab === "race" && (
        <RaceView
          ranked={ranked}
          now={now}
          onPick={onPick}
          onOpenChallenge={onOpenChallenge}
          flashes={flashes}
          columnMode={raceColumnMode}
          narrationNow={narrationNow}
          selectedId={selectedId}
        />
      )}
      {tab === "grid" && (
        <GridView
          ranked={ranked}
          now={now}
          onPick={onPick}
          narrationNow={narrationNow}
          selectedId={selectedId}
          flashes={flashes}
        />
      )}
    </div>
  );
}

// `compact` is the bottom-strip variant used under multiview: same track, tighter
// rows and no harness badge. Its viewport shows five agents and scrolls to the rest.
function RaceView({
  ranked,
  now,
  onPick,
  onOpenChallenge,
  flashes,
  columnMode,
  compact,
  narrationNow,
  selectedId,
}: {
  ranked: Agent[];
  now: number | null;
  onPick: (id: string) => void;
  onOpenChallenge: (id: number) => void;
  flashes: string[];
  columnMode: RaceColumnMode;
  compact?: boolean;
  narrationNow: number;
  selectedId?: string | null;
}) {
  const narrationByEntrant = useArenaStore(selectNarrationByEntrant);
  const total = CHALLENGES.length;
  const rowGap = compact ? "gap-3" : "gap-4";
  const cellH = compact ? "h-6" : "h-9";
  const dataText = compact ? "text-sm" : "text-base";
  const numText = compact ? "text-base" : "text-lg";
  const done = (a: Agent) => a.solved.length >= total;
  // Columns are capture-order slots, not fixed challenges — slot k holds the k-th
  // flag an agent captured, so a row reads left-to-right as its capture history.
  const slots = Array.from({ length: total }, (_, k) => k);
  // The row behind the cell focuses the agent, so a cell click has to stop there.
  const openCell = (id: number) => (event: MouseEvent) => {
    event.stopPropagation();
    onOpenChallenge(id);
  };

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
      // Before the first capture the "leader" is just the id sort — overtaking
      // them gets the glow but no fanfare, since nobody actually held the lead.
      const displaced = ranked.find(a => a.id === prevLeader.current);
      if (displaced && displaced.solved.length > 0) playSfx("lead");
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
    playSfx("finish");
    setSting({ key: `${newcomer.id}:${newcomer.finishedAt ?? 0}`, agent: newcomer, place: place as PodiumPlace });
    stingTimer.current = setTimeout(() => setSting(null), FINISH_STING_MS);
  }, [ranked, total]);
  useEffect(() => () => void (stingTimer.current && clearTimeout(stingTimer.current)), []);

  return (
    <div
      className={`arena-race-view relative ${compact ? "arena-race-view-compact p-2 space-y-[2px]" : "p-3 space-y-1"}`}
    >
      {sting && <RaceFinishSting key={sting.key} agent={sting.agent} place={sting.place} />}

      {/* The shared ruler is challenge IDs in fixed mode and capture positions in order mode. */}
      <div className={`arena-race-ruler flex items-center ${rowGap} px-2 pb-1`}>
        <span className="arena-race-rank w-10 shrink-0" />
        <span className="w-4 shrink-0" />
        <span className={`${compact ? "w-7" : "w-8"} shrink-0`} />
        <span
          className={`arena-race-agent-column ${
            compact ? "w-56" : "w-[300px]"
          } shrink-0 ${dataText} tracking-widest text-[#00FBFF]/55`}
        >
          AGENT · FLAGS →
        </span>
        <span className={`arena-race-tokens w-16 shrink-0 text-right ${dataText} tracking-widest text-[#00FBFF]/55`}>
          TOK
        </span>
        <span className={`arena-race-cost w-20 shrink-0 text-right ${dataText} tracking-widest text-[#00FBFF]/55`}>
          COST
        </span>
        <div className="arena-race-flags flex-1 flex gap-1">
          {columnMode === "challenges"
            ? CHALLENGES.map(challenge => (
                <button
                  key={challenge.id}
                  type="button"
                  onClick={() => onOpenChallenge(challenge.id)}
                  title={`Challenge #${challenge.id} · ${challenge.name} · open the contract`}
                  className={`flex-1 text-center ${dataText} font-bold tabular-nums text-[#00FBFF]/55 transition hover:text-[#00FBFF]`}
                >
                  {challenge.id}
                </button>
              ))
            : slots.map(k => (
                <span
                  key={k}
                  title={`Capture ${k + 1} of ${total}`}
                  className={`flex-1 text-center ${dataText} font-bold tabular-nums text-[#00FBFF]/55`}
                >
                  {k + 1}
                </span>
              ))}
        </div>
        <span className={`arena-race-result w-28 shrink-0 text-right ${dataText} tracking-widest text-[#00FBFF]/55`}>
          RESULT
        </span>
      </div>

      {ranked.map((a, i) => {
        // Podium dressing is only earned by finishing — leading on flags alone
        // keeps the plain crown, because the order can still change.
        const place = done(a) && i < 3 ? ((i + 1) as PodiumPlace) : null;
        const podium = place ? PODIUM[place] : null;
        const celebrating = sting?.agent.id === a.id;
        const latestNarration = narrationByEntrant[a.id]?.at(-1);
        const runtimeLabel = agentRuntimeLabel(a);
        const narrationTip = latestNarration
          ? `${runtimeLabel}\n${latestNarration.text} · ${fmtAge(latestNarration.ts, narrationNow)}`
          : undefined;
        const faded = isAgentFaded(a, now) && selectedId !== a.id;
        const fadeClass = `transition-opacity duration-300 group-hover:opacity-100 ${
          faded ? "opacity-50" : "opacity-100"
        }`;
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
            aria-label={narrationTip ? `Observe ${a.handle}. ${narrationTip}` : `Observe ${a.handle}. ${runtimeLabel}`}
            aria-pressed={selectedId === a.id}
            tabIndex={0}
            onClick={() => onPick(a.id)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(a.id);
              }
            }}
            className={`arena-race-row relative hover:z-10 w-full flex items-center ${rowGap} px-2 ${
              compact ? "py-0.5" : "py-2"
            } rounded hover:bg-[#00FBFF]/5 will-change-transform text-left group cursor-pointer ${
              leadTaker === a.id ? "lead-take" : ""
            } ${done(a) ? "agent-finish-row" : ""} ${place ? `race-podium-row race-podium-${place}` : ""} ${
              celebrating ? "race-podium-celebrate" : ""
            } ${selectedId === a.id ? "arena-agent-selected" : ""}`}
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
              className={`arena-race-rank flex w-10 shrink-0 items-center justify-center text-center ${numText} font-bold tabular-nums ${fadeClass} ${
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
            <span className={`flex shrink-0 ${fadeClass}`}>
              <StatusDot status={a.status} />
            </span>
            <span className={`flex shrink-0 ${fadeClass}`}>
              <AgentBlockieLink agent={a} compact={compact} />
            </span>
            <span
              className={`arena-race-agent-column relative ${
                compact ? "w-56 text-base" : "w-[300px] text-2xl"
              } shrink-0 text-left ${latestNarration ? `${ARENA_TIP_RIGHT_WRAP} z-20` : ""}`}
              data-tip={narrationTip}
              title={latestNarration ? undefined : runtimeLabel}
            >
              <span className={`block truncate font-bold text-white ${fadeClass}`}>
                <ModelName name={a.handle} effort={a.effort} />
              </span>
            </span>
            <span
              className={`arena-race-tokens w-16 text-right ${dataText} tabular-nums shrink-0 text-[#00FBFF]/75 ${fadeClass}`}
            >
              {a.usagePending && a.tokens === 0 ? <PendingUsage /> : fmtTokens(a.tokens)}
            </span>
            <span
              className={`arena-race-cost w-20 text-right ${dataText} tabular-nums shrink-0 text-[#FFBE00]/90 ${fadeClass}`}
            >
              {a.cost !== null ? `$${a.cost.toFixed(2)}` : a.usagePending ? <PendingUsage /> : "N/A"}
            </span>

            {/* Order mode reads as the route the agent took; challenge mode parks every
                flag under its own number, so a gap in a row is a challenge nobody's row
                can hide. Same cells either way — only what a column means changes. */}
            <div className={`arena-race-flags flex-1 flex gap-1 ${fadeClass}`}>
              {columnMode === "challenges"
                ? CHALLENGES.map(challenge => {
                    const captureIndex = a.solved.indexOf(challenge.id);
                    if (captureIndex !== -1) {
                      const flashing = flashes.includes(`${a.id}:${challenge.id}`);
                      const tip = `#${challenge.id} ${challenge.name} · captured ${
                        captureIndex + 1
                      } of ${total} · click for the contract`;
                      return (
                        <button
                          key={challenge.id}
                          type="button"
                          onClick={openCell(challenge.id)}
                          data-tip={tip}
                          aria-label={tip}
                          className={`arena-race-cell relative ${ARENA_TIP} flex-1 ${cellH} rounded-[3px] border flex items-center justify-center ${numText} font-bold tabular-nums transition-colors ${CELL_LINK} ${
                            flashing ? "flag-pop" : ""
                          }`}
                          style={{ background: a.color, borderColor: a.color, color: "#00181c" }}
                        >
                          {challenge.id}
                        </button>
                      );
                    }
                    // With fixed columns the target belongs under its own number rather
                    // than in the next free slot, so the row shows what is being worked on.
                    if (activeTarget(a) === challenge.id) {
                      const color = STATUS_STYLE[a.status].color;
                      const tip = `${STATUS_STYLE[a.status].label} · target #${challenge.id} ${
                        challenge.name
                      } · click for the contract`;
                      return (
                        <button
                          key={challenge.id}
                          type="button"
                          onClick={openCell(challenge.id)}
                          data-tip={tip}
                          aria-label={tip}
                          className={`arena-race-cell relative ${ARENA_TIP} flex-1 ${cellH} rounded-[3px] ${numText} font-bold tabular-nums ${CELL_LINK}`}
                        >
                          <span
                            className={`absolute inset-0 flex items-center justify-center rounded-[3px] border ${
                              a.status === "working" ? "cell-working" : "opacity-40"
                            }`}
                            style={{ background: `${color}1f`, borderColor: color, color }}
                          >
                            {challenge.id}
                          </span>
                        </button>
                      );
                    }
                    const tip = `#${challenge.id} ${challenge.name} · not captured yet · click for the contract`;
                    return (
                      <button
                        key={challenge.id}
                        type="button"
                        onClick={openCell(challenge.id)}
                        data-tip={tip}
                        aria-label={tip}
                        className={`arena-race-cell relative ${ARENA_TIP} flex-1 ${cellH} rounded-[3px] border ${CELL_LINK}`}
                        style={{ background: "#00fbff08", borderColor: "#00fbff1a" }}
                      />
                    );
                  })
                : slots.map(k => {
                    const flagId = a.solved[k];
                    if (flagId !== undefined) {
                      const ch = CHALLENGES[flagId - 1];
                      const flashing = flashes.includes(`${a.id}:${flagId}`);
                      const tip = `#${flagId} ${ch?.name ?? ""} · captured ${
                        k + 1
                      } of ${total} · click for the contract`;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={openCell(flagId)}
                          data-tip={tip}
                          aria-label={tip}
                          className={`arena-race-cell relative ${ARENA_TIP} flex-1 ${cellH} rounded-[3px] border flex items-center justify-center ${numText} font-bold tabular-nums transition-colors ${CELL_LINK} ${
                            flashing ? "flag-pop" : ""
                          }`}
                          style={{ background: a.color, borderColor: a.color, color: "#00181c" }}
                        >
                          {flagId}
                        </button>
                      );
                    }
                    if (k === a.solved.length && !done(a)) {
                      const color = STATUS_STYLE[a.status].color;
                      const target = activeTarget(a);
                      const tip =
                        target !== null
                          ? `${STATUS_STYLE[a.status].label} · target #${target} ${
                              CHALLENGES[target - 1]?.name ?? ""
                            } · click for the contract`
                          : STATUS_STYLE[a.status].label;
                      // The in-flight slot names the entrant's reported target — an
                      // outlined number, so it can't read as a captured flag.
                      const cellClass = `arena-race-cell relative ${ARENA_TIP} flex-1 ${cellH} rounded-[3px] ${numText} font-bold tabular-nums`;
                      const contentClass = `absolute inset-0 flex items-center justify-center rounded-[3px] border ${
                        a.status === "working" ? "cell-working" : "opacity-40"
                      }`;
                      const cellStyle = { background: `${color}1f`, borderColor: color, color };
                      // Nothing to open while the target is unreported, so that slot
                      // stays a plain cell rather than a button that does nothing.
                      return target !== null ? (
                        <button
                          key={k}
                          type="button"
                          onClick={openCell(target)}
                          data-tip={tip}
                          aria-label={tip}
                          className={`${cellClass} ${CELL_LINK}`}
                        >
                          <span className={contentClass} style={cellStyle}>
                            {target}
                          </span>
                        </button>
                      ) : (
                        <span key={k} data-tip={tip} aria-label={tip} className={cellClass}>
                          <span className={contentClass} style={cellStyle}>
                            …
                          </span>
                        </span>
                      );
                    }
                    return (
                      <span
                        key={k}
                        data-tip="Not captured yet"
                        aria-label="Not captured yet"
                        className={`arena-race-cell relative ${ARENA_TIP} flex-1 ${cellH} rounded-[3px] border`}
                        style={{ background: "#00fbff08", borderColor: "#00fbff1a" }}
                      />
                    );
                  })}
            </div>

            <span
              className={`arena-race-result w-28 text-right ${numText} tabular-nums shrink-0 text-[#00FBFF]/85 ${fadeClass}`}
            >
              {done(a) ? (
                <span
                  className="agent-finish-time whitespace-nowrap font-bold"
                  style={{ color: podium?.tone ?? "#00ff9c" }}
                >
                  ◆ {fmtFinishTime(a.finishedAt ?? 0)}
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
            {podium.label} FINISH · FINAL PLACEMENT
          </div>
          <div className="mt-1 truncate font-dotGothic text-xl tracking-wide text-white sm:text-2xl">
            {PODIUM_RESULT[place]}
          </div>
          <div className="mt-1 flex items-center gap-2 text-base">
            <span className="truncate font-bold text-white">
              <ModelName name={agent.handle} effort={agent.effort} />
            </span>
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

function GridView({
  ranked,
  now,
  onPick,
  narrationNow,
  selectedId,
  flashes,
}: {
  ranked: Agent[];
  now: number | null;
  onPick: (id: string) => void;
  narrationNow: number;
  selectedId: string | null;
  flashes: string[];
}) {
  return (
    <div className="h-full p-2 grid grid-cols-5 auto-rows-fr gap-2">
      {ranked.map(agent => (
        <GridCard
          key={agent.id}
          agent={agent}
          now={now}
          onPick={onPick}
          narrationNow={narrationNow}
          selected={selectedId === agent.id}
          flashes={flashes}
        />
      ))}
    </div>
  );
}

// The preview lines are prefixed by the projection: `⟳` a call, `✓`/`✗` its
// result, `›` a message, `·` reasoning, `⚠` an error. Only the mark is tinted —
// the line itself stays quiet under the narration.
const TICKER_MARK_COLOR: Record<string, string> = {
  "⟳": "#FFBE00",
  "✓": "#00ff9c",
  "✗": "#FF5861",
  "›": "#7fd8dd",
  "·": "#3d7c80",
  "⚠": "#FF5861",
};

function GridTicker({ line, finished }: { line: string | null; finished: boolean }) {
  const mark = line?.slice(0, 1) ?? "";
  const tint = TICKER_MARK_COLOR[mark];
  const rest = (tint ? line?.slice(1).trim() : line) ?? "";
  return (
    <div className="flex items-center gap-1.5 h-6 shrink-0 px-2 border-t border-[#00FBFF]/10 bg-[#000405] text-xs">
      {tint && (
        <span className="shrink-0" style={{ color: tint }}>
          {mark}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[#5fa8ae]">{rest || "waiting for the first turn…"}</span>
      {finished ? (
        <span className="shrink-0 text-[#00ff9c]">✓</span>
      ) : (
        <span className="shrink-0 text-[#00ff9c] animate-pulse">▋</span>
      )}
    </div>
  );
}

// The strip the log used to sit on. Non-interactive on purpose: the whole card is
// a button that opens the agent's log, and a nested one would swallow that click.
function GridFlagStrip({ agent, flashes }: { agent: Agent; flashes: string[] }) {
  const target = activeTarget(agent);
  return (
    <div className="flex items-center gap-[2px] shrink-0 px-1.5 py-1 border-t border-[#00FBFF]/10">
      {CHALLENGES.map(challenge => {
        const captured = agent.solved.includes(challenge.id);
        const cell =
          "flex-1 h-4 rounded-[2px] border flex items-center justify-center text-[9px] font-bold tabular-nums";
        if (captured) {
          return (
            <span
              key={challenge.id}
              title={`#${challenge.id} ${challenge.name} · captured`}
              className={`${cell} ${flashes.includes(`${agent.id}:${challenge.id}`) ? "flag-pop" : ""}`}
              style={{ background: agent.color, borderColor: agent.color, color: "#00181c" }}
            >
              {challenge.id}
            </span>
          );
        }
        if (target === challenge.id) {
          const color = STATUS_STYLE[agent.status].color;
          return (
            <span
              key={challenge.id}
              title={`${STATUS_STYLE[agent.status].label} · target #${challenge.id} ${challenge.name}`}
              className={`${cell} ${agent.status === "working" ? "cell-working" : "opacity-40"}`}
              style={{ background: `${color}1f`, borderColor: color, color }}
            >
              {challenge.id}
            </span>
          );
        }
        return (
          <span
            key={challenge.id}
            title={`#${challenge.id} ${challenge.name} · not captured yet`}
            className={cell}
            style={{ background: "#00fbff08", borderColor: "#00fbff1a" }}
          />
        );
      })}
    </div>
  );
}

function GridCard({
  agent,
  now,
  onPick,
  narrationNow,
  selected,
  flashes,
}: {
  agent: Agent;
  now: number | null;
  onPick: (id: string) => void;
  narrationNow: number;
  selected: boolean;
  flashes: string[];
}) {
  const preview = useArenaStore(selectPreviewFor(agent.id));
  const narration = useArenaStore(selectNarrationFor(agent.id));
  const latestNarration = narration.at(-1);
  const finished = agent.status === "done";
  const faded = isAgentFaded(agent, now) && !selected;
  const fadeClass = `transition-opacity duration-300 group-hover:opacity-100 ${faded ? "opacity-50" : "opacity-100"}`;
  return (
    <div
      role="button"
      aria-pressed={selected}
      tabIndex={0}
      onClick={() => onPick(agent.id)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick(agent.id);
        }
      }}
      title={`open ${agent.handle}'s log`}
      className={`min-h-0 flex flex-col text-left rounded border bg-[#00090b] hover:border-[#00FBFF]/50 transition overflow-hidden group cursor-pointer ${
        agent.status === "blocked" ? "border-[#FFBE00]/60" : "border-[#00FBFF]/15"
      } ${selected ? "arena-agent-selected" : ""}`}
    >
      {/* One identity band: the status row folded into it, because the flag strip
          below now carries the target and the count the row used to spell out. */}
      <div
        className={`flex items-center gap-1.5 px-2 h-10 shrink-0 border-b border-[#00FBFF]/10 bg-[#001417] ${fadeClass}`}
      >
        <AgentBlockieLink agent={agent} />
        <span className="text-base font-bold text-white truncate flex-1">
          <ModelName name={agent.handle} effort={agent.effort} />
        </span>
        {/* No flag count and no chip for the ambient states: the strip below counts
            the flags, and every character saved here is one the handle keeps. */}
        {agent.finishedAt !== null ? (
          <span className="shrink-0 text-sm font-bold tabular-nums text-[#00ff9c]">
            ◆ {fmtFinishTime(agent.finishedAt)}
          </span>
        ) : agent.status === "blocked" ? (
          <StatusChip status={agent.status} />
        ) : (
          <StatusDot status={agent.status} />
        )}
      </div>
      {/* The card's whole body: what this agent is doing, in words. The log is one
          click away in the right rail, so nothing here competes with it. */}
      <div
        className={`arena-grid-narration relative flex-1 min-h-0 px-2 py-1.5 ${fadeClass}`}
        style={{ boxShadow: `inset 2px 0 0 ${agent.color}` }}
      >
        {latestNarration ? (
          <>
            <p className="arena-grid-narration-text h-full overflow-hidden text-sm leading-[1.45] text-[#c6f4f7]">
              {latestNarration.text}
            </p>
            {/* Corner stamp rather than its own row: the paragraph's bottom fade is
                exactly where it sits, so nothing legible ends up behind it. */}
            <span className="absolute bottom-1 right-2">
              <NarrationAge ts={latestNarration.ts} now={narrationNow} />
            </span>
          </>
        ) : (
          <p className="text-sm leading-snug text-[#7fd8dd]/40">waiting for narration…</p>
        )}
      </div>
      <GridTicker line={preview.at(-1) ?? null} finished={finished} />
      <GridFlagStrip agent={agent} flashes={flashes} />
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
  focused: Agent | null;
  onOpen: (id: number) => void;
}) {
  const solvedCount = (id: number) => agents.filter(a => a.solved.includes(id)).length;
  const focusedTarget = focused && activeTarget(focused);
  return (
    <div className="arena-challenge-board h-56 shrink-0 flex flex-col border-t border-[#00FBFF]/20 bg-[#010607]">
      <SectionHead label="CHALLENGES" hint="select for details" />
      <div className="arena-challenge-grid flex-1 min-h-0 overflow-y-auto console-scroll p-2 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 content-start">
        {CHALLENGES.map(c => {
          const mine = focused?.solved.includes(c.id) ?? false;
          const target = focusedTarget === c.id;
          const count = solvedCount(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`arena-challenge-card px-2 py-1.5 rounded border text-base text-left transition hover:border-[#00FBFF] ${
                mine
                  ? "bg-[#00ff9c]/10 border-[#00ff9c]/50"
                  : target
                  ? "bg-[#FFBE00]/10 border-[#FFBE00]/50"
                  : "border-[#00FBFF]/15 bg-[#00FBFF]/[0.02]"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="font-bold" style={{ color: DIFFICULTY_COLOR[c.difficulty] }}>
                  #{c.id}
                </span>
                {mine && <span className="text-[#00ff9c]">✓</span>}
                {target && (
                  <span className="text-xs font-bold tracking-wider text-[#FFBE00]" title="the agent's reported target">
                    ◎ TARGET
                  </span>
                )}
              </div>
              <div className="text-white/80 truncate">{c.name}</div>
              <div className="text-sm text-[#00FBFF]/70">
                {count}/{agents.length} solved
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
            <ModelName name={a.handle} effort={a.effort} />
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
        className="toast-in w-[900px] max-w-[92%] max-h-[86%] overflow-y-auto console-scroll rounded-lg border bg-[#020a0c] shadow-2xl"
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

          <ContractSource challengeId={challenge.id} accent={dc} />

          <div>
            <div className="flex items-center justify-between mb-1.5 text-[#00FBFF]/70">
              <span className="tracking-widest text-sm">AGENT PROGRESS</span>
              <span className="tabular-nums">
                {cleared.length}/{agents.length} solved
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
            <div className="tracking-widest text-sm text-[#00FBFF]/70">SOLVED BY</div>
            <AgentChips list={cleared} empty="No agent has solved this challenge yet." />
          </div>

          <div className="pt-1 text-sm text-[#00FBFF]/55">Select an agent to follow its log · Esc to close</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- ArenaStream */

type StreamFilter = "logs" | "output" | "injections" | "captures" | "status";
type StreamRow =
  | { id: number; group: "output" | "injections"; msg: ChatItem }
  | { id: number; group: "captures" | "status"; item: FeedItem };

const STREAM_FILTERS: { id: StreamFilter; label: string }[] = [
  { id: "logs", label: "LOGS" },
  { id: "output", label: "OUTPUT" },
  { id: "injections", label: "INJECT" },
  { id: "captures", label: "FLAGS" },
  { id: "status", label: "STATUS" },
];

function ArenaStream() {
  const feed = useArenaStore(selectFeed);
  const chat = useArenaStore(selectChat);
  const [filter, setFilter] = useState<StreamFilter>("logs");
  const scrollRef = useRef<HTMLDivElement>(null);

  const merged = useMemo<StreamRow[]>(() => {
    const outputRows: StreamRow[] = chat.map(m => ({
      id: m.id,
      group: m.director ? "injections" : "output",
      msg: m,
    }));
    const feedRows: StreamRow[] = feed.map(item => ({
      id: item.id,
      group: item.type === "flag" ? "captures" : "status",
      item,
    }));
    return [...outputRows, ...feedRows].sort((a, b) => a.id - b.id);
  }, [feed, chat]);

  const rows = merged.filter(r => filter === "logs" || r.group === filter);

  const newestRowId = rows.length ? rows[rows.length - 1].id : 0;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [newestRowId]);

  return (
    <div className="arena-stream flex-1 min-h-0 flex flex-col bg-[#010607]">
      <div className="arena-stream-header flex items-center gap-2 px-3 h-11 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0">
        <span className="shrink-0 text-base font-bold text-[#00FBFF] tracking-widest">LIVE FEED</span>
        <div className="console-scroll ml-auto flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
          {STREAM_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-2 py-0.5 rounded text-sm font-bold tracking-wider transition ${
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

      <div
        ref={scrollRef}
        className="arena-stream-lines flex-1 min-h-0 overflow-y-auto console-scroll px-3 py-1.5 text-base space-y-1"
      >
        {rows.length === 0 && <div className="text-[#00FBFF]/50 italic">waiting for the first event…</div>}
        {rows.map(r => ("msg" in r ? <ChatRow key={r.id} msg={r.msg} /> : <FeedRow key={r.id} item={r.item} />))}
      </div>
    </div>
  );
}

function OperatorStrip({
  focused,
  address,
  authenticated,
  hadSession,
  archived,
  restartable,
  onSteer,
  onBroadcast,
  onRestart,
  onInvalidate,
  onSignIn,
}: {
  // Null on the overview, where no target was chosen, so the composer speaks to
  // everyone; a directed steer only exists once an agent is being observed.
  focused: Agent | null;
  address: string | null;
  authenticated: boolean;
  hadSession: boolean;
  archived: boolean;
  // The backend only replaces a session while the run is running.
  restartable: boolean;
  onSteer: (text: string) => Promise<void>;
  onBroadcast: (text: string) => Promise<void>;
  onRestart: () => Promise<void>;
  onInvalidate: () => void;
  onSignIn: () => Promise<void>;
}) {
  const pendingSteers = useArenaStore(selectPendingSteersFor(focused?.id ?? ""));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [confirmDisabled, setConfirmDisabled] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    clearTimeout(armTimer.current ?? undefined);
    clearTimeout(confirmTimer.current ?? undefined);
    setArmed(false);
    setConfirmDisabled(false);
  }, []);

  const arm = () => {
    clearTimeout(armTimer.current ?? undefined);
    clearTimeout(confirmTimer.current ?? undefined);
    setArmed(true);
    setConfirmDisabled(true);
    confirmTimer.current = setTimeout(() => {
      setConfirmDisabled(false);
      confirmTimer.current = null;
    }, STOP_CONFIRM_DWELL_MS);
    armTimer.current = setTimeout(() => setArmed(false), STOP_ARM_MS);
  };

  useEffect(
    () => () => {
      clearTimeout(armTimer.current ?? undefined);
      clearTimeout(confirmTimer.current ?? undefined);
    },
    [],
  );

  // An arm must not outlive the button that took it: switching lanes would aim
  // it at whoever is observed next, and a run leaving `running` mid-arm would
  // leave a disabled button pulsing CONFIRM for the rest of the window.
  useEffect(() => {
    disarm();
  }, [disarm, focused?.id, restartable, archived]);

  const send = async (action: (text: string) => Promise<void>) => {
    const text = draft.trim();
    if (!text || busy || archived) return;
    setBusy(true);
    setError(null);
    try {
      await action(text);
      setDraft("");
    } catch (cause) {
      if (cause instanceof ArenaApiError && cause.status === 401) {
        onInvalidate();
        setError("operator session expired — sign in again");
      } else {
        setError(cause instanceof Error ? cause.message : "The operator command failed");
      }
    } finally {
      setBusy(false);
    }
  };

  // Throws away everything the agent worked out so far, but only on this lane —
  // which is why it takes two clicks. The arm lapses on its own; a native confirm
  // dialog would cover the broadcast.
  const restart = async () => {
    if (busy || archived || !restartable || !focused) return;
    if (!armed) {
      arm();
      return;
    }
    if (confirmDisabled) return;
    disarm();
    setBusy(true);
    setError(null);
    try {
      await onRestart();
    } catch (cause) {
      if (cause instanceof ArenaApiError && cause.status === 401) {
        onInvalidate();
        setError("operator session expired — sign in again");
      } else {
        setError(cause instanceof Error ? cause.message : "The restart request failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSignIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operator sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="arena-operator-strip shrink-0 border-t border-[#00FBFF]/15 px-2 py-2">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-[#FFBE00]">
        <span>🎬 NEXT-TURN INJECTION</span>
        {focused ? (
          <span className="truncate text-[#00FBFF]/70">to {focused.handle}</span>
        ) : (
          <span className="truncate text-[#FFBE00]/90">broadcast to all agents</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <OperatorAddress address={address} />
        </div>
      </div>
      {authenticated ? (
        <>
          <div className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") void send(focused ? onSteer : onBroadcast);
              }}
              disabled={busy || archived}
              placeholder={archived ? "run finished — controls locked" : "message for the agent's next turn…"}
              className="flex-1 min-w-0 bg-[#00181c] border border-[#00FBFF]/20 rounded px-2 py-1 text-base text-white placeholder-[#00FBFF]/45 focus:outline-none focus:border-[#FFBE00]/60 disabled:cursor-not-allowed disabled:opacity-55"
            />
            {/* One button; the stage picks the target. Cyan when directed at the
                observed agent, gold when the overview broadcasts to everyone. */}
            <button
              onClick={() => void send(focused ? onSteer : onBroadcast)}
              disabled={busy || archived || !draft.trim()}
              className={`px-2 py-1 rounded border text-sm font-bold disabled:opacity-40 ${
                focused ? "border-[#00FBFF]/40 text-[#00FBFF]" : "border-[#FFBE00]/50 text-[#FFBE00]"
              }`}
            >
              SEND
            </button>
            {/* Only in focus mode: a restart names one lane, and the overview
                has no target to name. */}
            {focused && (
              <button
                onClick={() => void restart()}
                disabled={busy || archived || !restartable || (armed && confirmDisabled)}
                title={`drop ${focused.handle}'s session and re-feed its opening prompt`}
                className={`shrink-0 whitespace-nowrap rounded border px-2 py-1 text-sm font-bold disabled:opacity-40 ${
                  armed
                    ? "animate-pulse border-[#FFBE00] bg-[#FFBE00] text-black"
                    : "border-[#FFBE00]/50 text-[#FFBE00]"
                }`}
              >
                {armed ? "CONFIRM RESTART" : "RESTART AGENT"}
              </button>
            )}
          </div>
          {focused && pendingSteers.length > 0 && (
            <div className="mt-1 animate-pulse text-sm text-[#FFBE00]">
              {pendingSteers.length === 1
                ? `◆ queued for ${focused.handle}'s next turn`
                : `◆ ${pendingSteers.length} queued for ${focused.handle}'s next turn`}
            </div>
          )}
        </>
      ) : address ? (
        <div className="flex items-center gap-2">
          {hadSession && <span className="text-sm text-[#FFBE00]/90">OPERATOR SESSION EXPIRED</span>}
          <button
            onClick={() => void signIn()}
            disabled={busy}
            className="px-2 py-1 rounded border border-[#FFBE00]/50 text-[#FFBE00] text-sm font-bold disabled:opacity-40"
          >
            SIGN IN
          </button>
        </div>
      ) : (
        <span className="text-sm text-[#00FBFF]/70">CONNECT A WALLET TO USE OPERATOR CONTROLS</span>
      )}
      {error && <div className="mt-1 text-sm text-[#FF5861]">{error}</div>}
    </div>
  );
}

const FEED_STYLE: Record<FeedItem["type"], { icon: string; cls: string }> = {
  flag: { icon: "🏁", cls: "text-[#00ff9c] font-bold" },
  blocked: { icon: "⚠", cls: "text-[#FFBE00] font-bold" },
  resumed: { icon: "▶", cls: "text-[#00FBFF]/70" },
  restarted: { icon: "↻", cls: "text-[#FFBE00] font-bold" },
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
        <span title={msg.fromHandle} className="max-w-[55%] min-w-0 truncate text-[#FFBE00] font-bold">
          🎬 inject → {msg.fromHandle}
        </span>
        <span className="min-w-0 break-words text-[#ffe9a8]">{msg.text}</span>
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
  done: { glyph: "◆", color: "#7fd8dd", label: "done — agent process exited" },
};

function StatusDot({ status }: { status: AgentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      title={s.label}
      className={`arena-status-dot w-4 shrink-0 text-center text-sm leading-none ${
        status === "blocked" ? "blocked-pulse" : ""
      }`}
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
  const className = `arena-agent-blockie ${
    compact ? "w-6 h-6" : "w-8 h-8"
  } shrink-0 rounded overflow-hidden transition`;
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
        title={`${agentRuntimeLabel(agent)}${agent.address ? ` · ${agent.address}` : " · assigning address"}`}
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
      title={`${agentRuntimeLabel(agent)} · ${agent.address}`}
      className={`${className} hover:opacity-80`}
      style={{ border: `1px solid ${agent.color}55` }}
    >
      {badge}
    </a>
  );
}

function SectionHead({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="arena-section-head flex items-center gap-2 px-3 h-10 border-b border-[#00FBFF]/15 bg-[#00141733] shrink-0">
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
      /* Keep the status dot and label as one tight unit, then use a full 24px
         spacing step before the separate event-title group. */
      .arena-live-status {
        margin-right: 0.5rem;
      }
      .arena-agent-selected {
        background-color: rgba(0, 251, 255, 0.08);
        border-color: rgba(0, 251, 255, 0.8) !important;
        box-shadow: inset 3px 0 0 #00fbff, inset 0 0 0 1px rgba(0, 251, 255, 0.3), 0 0 16px rgba(0, 251, 255, 0.14);
      }
      .arena-agent-log-in {
        animation: arenaAgentLogIn 180ms ease-out;
      }
      @keyframes arenaAgentLogIn {
        from {
          opacity: 0.55;
          transform: translateX(10px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .arena-agent-log-in {
          animation: none;
        }
      }
      /* Windows display scaling and browser zoom reduce the effective CSS
         viewport. Compact the fixed-width chrome in that case, while leaving
         the true 1920x1080 broadcast layout unchanged. */
      @media (max-width: 1700px), (max-height: 1000px) {
        .arena-right-rail {
          width: clamp(400px, 28vw, 460px);
        }
        .arena-main-stage-padding {
          padding: 0.75rem;
        }
        .arena-race-view:not(.arena-race-view-compact) {
          padding: 0.5rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-ruler,
        .arena-race-view:not(.arena-race-view-compact) .arena-race-row {
          gap: 0.5rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-row {
          padding-top: 0.25rem;
          padding-bottom: 0.25rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-agent-column {
          width: 220px;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-row .arena-race-agent-column {
          font-size: 1.25rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-tokens {
          width: 3.5rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-cost {
          width: 4rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-result {
          width: 5.5rem;
          font-size: 1rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-cell {
          height: 2rem;
          font-size: 1rem;
        }
        .arena-challenge-board {
          height: 13rem;
        }
      }
      @media (max-width: 1400px), (max-height: 820px) {
        /* Multiview benefits more from readable terminals than from squeezing the
           complete race below them into one screen. Keep its live area tall and
           let the page reveal the full standings naturally when scrolled. */
        .arena-root.arena-grid-mode {
          overflow-y: auto;
        }
        .arena-grid-mode .arena-content {
          flex: none;
          min-height: auto;
        }
        .arena-grid-mode .arena-stage-row {
          flex: none;
          height: 32rem;
        }
        .arena-grid-mode .arena-grid-race-strip {
          flex: none;
        }
        .arena-grid-mode .arena-grid-race-scroll {
          height: auto;
          overflow: visible;
        }
        .arena-top-bar {
          height: 3.25rem;
          gap: 0.5rem;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }
        .arena-live-status {
          gap: 0.375rem;
          margin-right: 1rem;
          font-size: 0.875rem;
        }
        .arena-topbar-title {
          font-size: 1.25rem;
          white-space: nowrap;
        }
        .arena-topbar-metrics {
          gap: 0.625rem;
          font-size: 1rem;
        }
        .arena-topbar-connection {
          display: none;
        }
        .arena-clock {
          font-size: 1.5rem;
        }
        .arena-right-rail {
          width: clamp(320px, 28vw, 360px);
        }
        .arena-main-stage-padding {
          padding: 0.5rem;
        }
        .arena-stage-tabs {
          height: 2.25rem;
          gap: 0.25rem;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }
        .arena-stage-label {
          margin-right: 0.375rem;
          font-size: 1rem;
        }
        .arena-stage-tab {
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
        }
        .arena-stage-hint {
          display: none;
        }
        .arena-race-view:not(.arena-race-view-compact) {
          padding: 0.375rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-ruler,
        .arena-race-view:not(.arena-race-view-compact) .arena-race-row {
          gap: 0.25rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-row {
          padding-top: 0.125rem;
          padding-bottom: 0.125rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-rank {
          width: 2rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-status-dot {
          width: 0.75rem;
          font-size: 0.75rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-agent-blockie {
          width: 1.75rem;
          height: 1.75rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-agent-blockie > img {
          width: 100%;
          height: 100%;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-agent-column {
          width: 180px;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-row .arena-race-agent-column {
          font-size: 1rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-tokens {
          display: none;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-cost {
          width: 3rem;
          font-size: 0.875rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-result {
          width: 4rem;
          font-size: 0.875rem;
        }
        .arena-race-view:not(.arena-race-view-compact) .arena-race-cell {
          height: 1.75rem;
          font-size: 0.875rem;
        }
        .arena-challenge-board {
          height: 9.5rem;
        }
        .arena-section-head {
          height: 1.875rem;
          padding-left: 0.5rem;
          padding-right: 0.5rem;
        }
        .arena-section-head > span:first-child {
          font-size: 0.875rem;
        }
        .arena-section-head > span:last-child {
          font-size: 0.75rem;
        }
        .arena-challenge-grid {
          gap: 0.1875rem;
          padding: 0.25rem;
        }
        .arena-challenge-card {
          padding: 0.1875rem 0.25rem;
          font-size: 0.8125rem;
          line-height: 1.2;
        }
        .arena-challenge-card .text-sm {
          font-size: 0.75rem;
          line-height: 1.2;
        }
        .arena-stream-header {
          height: 2.25rem;
          padding-left: 0.5rem;
          padding-right: 0.5rem;
        }
        .arena-stream-header > span {
          font-size: 0.875rem;
        }
        .arena-stream-header button {
          padding-left: 0.375rem;
          padding-right: 0.375rem;
          font-size: 0.75rem;
        }
        .arena-stream-lines {
          padding: 0.375rem 0.5rem;
          font-size: 0.875rem;
          line-height: 1.35;
        }
        .arena-agent-log .text-lg {
          font-size: 1rem;
        }
        .arena-agent-log .text-base {
          font-size: 0.875rem;
        }
        .arena-agent-log .text-sm {
          font-size: 0.75rem;
        }
        .arena-operator-strip {
          padding: 0.375rem;
        }
        .arena-operator-strip > div:first-child,
        .arena-operator-strip button {
          font-size: 0.75rem;
        }
        .arena-operator-strip input {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }
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
      .arena-grid-narration {
        background: linear-gradient(180deg, rgba(0, 251, 255, 0.11), rgba(0, 251, 255, 0.05));
      }
      /* Fades only a narration long enough to reach the bottom of its box; a short
         one ends above the gradient and is untouched. */
      .arena-grid-narration-text {
        -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 1.1rem), transparent);
        mask-image: linear-gradient(180deg, #000 calc(100% - 1.1rem), transparent);
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
