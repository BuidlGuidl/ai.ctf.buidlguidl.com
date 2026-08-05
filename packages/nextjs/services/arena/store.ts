import type { ArenaEvent, RunSnapshot } from "./arena-types";
import { type ProjectionState, applyEvent, initialProjection } from "./projection";
import create from "zustand";

export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "not-found" | "error";

interface ArenaStore {
  currentRunId: string | null;
  projection: ProjectionState | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  setCurrentRunId: (runId: string | null) => void;
  seedSnapshot: (run: RunSnapshot, history?: ArenaEvent[]) => void;
  syncSnapshot: (run: RunSnapshot) => void;
  dispatchEvent: (event: ArenaEvent) => void;
  dispatchEvents: (events: ArenaEvent[]) => void;
  setConnection: (status: ConnectionStatus, error?: string | null) => void;
  clear: () => void;
}

export const useArenaStore = create<ArenaStore>(set => ({
  currentRunId: null,
  projection: null,
  connectionStatus: "idle",
  connectionError: null,
  setCurrentRunId: currentRunId => set({ currentRunId }),
  seedSnapshot: (run, history = []) =>
    set({ currentRunId: run.id, projection: seedProjection(run, history), connectionError: null }),
  syncSnapshot: run =>
    set(current => {
      if (current.projection === null || current.projection.run.id !== run.id) {
        return { currentRunId: run.id, projection: initialProjection(run), connectionError: null };
      }
      if (run.lastEventId < current.projection.lastEventId) return current;
      return {
        projection: {
          ...current.projection,
          run: {
            ...current.projection.run,
            state: run.state,
            chainId: run.chainId,
            startedAt: run.startedAt,
            deadlineAt: run.deadlineAt,
          },
        },
      };
    }),
  dispatchEvent: event =>
    set(current => {
      if (current.projection === null) return current;
      const projection = applyEvent(current.projection, event);
      return projection === current.projection ? current : { projection };
    }),
  dispatchEvents: events =>
    set(current => {
      if (current.projection === null) return current;
      const projection = events.reduce(applyEvent, current.projection);
      return projection === current.projection ? current : { projection };
    }),
  setConnection: (connectionStatus, connectionError = null) => set({ connectionStatus, connectionError }),
  clear: () => set({ currentRunId: null, projection: null, connectionStatus: "idle", connectionError: null }),
}));

// The snapshot already carries the run head, so replaying older events needs the
// cursor wound back first. It is restored afterwards: the stream must resume at
// the head, not at the last backfilled event.
function seedProjection(run: RunSnapshot, history: ArenaEvent[]): ProjectionState {
  const base = initialProjection(run);
  const oldest = history[0];
  if (oldest === undefined) return base;

  const replayed = history.reduce(applyEvent, { ...base, lastEventId: oldest.id - 1 });
  return { ...replayed, lastEventId: run.lastEventId, run: { ...replayed.run, lastEventId: run.lastEventId } };
}

export const selectRun = (state: ArenaStore) => state.projection?.run ?? null;
export const selectRunId = (state: ArenaStore) => state.projection?.run.id ?? null;
export const selectRunState = (state: ArenaStore) => state.projection?.run.state ?? null;
export const selectRunChainId = (state: ArenaStore) => state.projection?.run.chainId ?? null;
export const selectRunEntrants = (state: ArenaStore) => state.projection?.run.entrants ?? null;
export const selectRunStartedAt = (state: ArenaStore) => state.projection?.run.startedAt ?? null;
export const selectRunDeadlineAt = (state: ArenaStore) => state.projection?.run.deadlineAt ?? null;
export const selectConnectionStatus = (state: ArenaStore) => state.connectionStatus;
export const selectConnectionError = (state: ArenaStore) => state.connectionError;
export const selectFeed = (state: ArenaStore) => state.projection?.feed ?? EMPTY_FEED;
export const selectChat = (state: ArenaStore) => state.projection?.chat ?? EMPTY_CHAT;
export const selectFunding = (state: ArenaStore) => state.projection?.fundingByEntrant ?? EMPTY_FUNDING;
export const selectLastFlagEvent = (state: ArenaStore) => state.projection?.lastFlagEvent ?? null;
export const selectFirstBlood = (state: ArenaStore) => state.projection?.firstBlood ?? null;
export const selectRunFinishedAt = (state: ArenaStore) => state.projection?.runFinishedAt ?? null;
export const selectRunError = (state: ArenaStore) => state.projection?.runError ?? null;
export const selectConsoleFor = (entrantId: string) => (state: ArenaStore) =>
  state.projection?.consoleByEntrant[entrantId] ?? EMPTY_CONSOLE;
export const selectPreviewFor = (entrantId: string) => (state: ArenaStore) =>
  state.projection?.previewsByEntrant[entrantId] ?? EMPTY_PREVIEW;

const EMPTY_FEED: NonNullable<ProjectionState["feed"]> = [];
const EMPTY_CHAT: NonNullable<ProjectionState["chat"]> = [];
const EMPTY_FUNDING: NonNullable<ProjectionState["fundingByEntrant"]> = {};
const EMPTY_CONSOLE: NonNullable<ProjectionState["consoleByEntrant"][string]> = [];
const EMPTY_PREVIEW: NonNullable<ProjectionState["previewsByEntrant"][string]> = [];
