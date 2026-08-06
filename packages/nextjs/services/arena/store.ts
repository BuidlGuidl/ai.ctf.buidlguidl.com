import type { ArenaEvent, RunSnapshot } from "./arena-types";
import { type ProjectionState, applyEvent, initialProjection } from "./projection";
import create from "zustand";

export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "not-found" | "error";

interface ArenaStore {
  currentRunId: string | null;
  projection: ProjectionState | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  // Client-local: a steer the backend accepted but has not injected yet. The
  // projection stays a pure function of journal events, and nothing was
  // journalled until the agent's turn ends.
  pendingSteers: Record<string, string[]>;
  setCurrentRunId: (runId: string | null) => void;
  seedSnapshot: (run: RunSnapshot, history?: ArenaEvent[]) => void;
  syncSnapshot: (run: RunSnapshot) => void;
  dispatchEvent: (event: ArenaEvent) => void;
  dispatchEvents: (events: ArenaEvent[]) => void;
  addPendingSteer: (entrantId: string, text: string, sinceEventId: number) => void;
  setConnection: (status: ConnectionStatus, error?: string | null) => void;
  clear: () => void;
}

export const useArenaStore = create<ArenaStore>(set => ({
  currentRunId: null,
  projection: null,
  connectionStatus: "idle",
  connectionError: null,
  pendingSteers: {},
  setCurrentRunId: currentRunId => set({ currentRunId }),
  seedSnapshot: (run, history = []) =>
    set({
      currentRunId: run.id,
      projection: seedProjection(run, history),
      connectionError: null,
      pendingSteers: {},
    }),
  syncSnapshot: run =>
    set(current => {
      if (current.projection === null || current.projection.run.id !== run.id) {
        return { currentRunId: run.id, projection: initialProjection(run), connectionError: null, pendingSteers: {} };
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
        pendingSteers: {},
      };
    }),
  dispatchEvent: event =>
    set(current => {
      if (current.projection === null) return current;
      const projection = applyEvent(current.projection, event);
      if (projection === current.projection) return current;
      return { projection, pendingSteers: resolvePendingSteers(current.pendingSteers, event) };
    }),
  dispatchEvents: events =>
    set(current => {
      if (current.projection === null) return current;
      const projection = events.reduce(applyEvent, current.projection);
      if (projection === current.projection) return current;
      return { projection, pendingSteers: events.reduce(resolvePendingSteers, current.pendingSteers) };
    }),
  addPendingSteer: (entrantId, text, sinceEventId) =>
    set(current => {
      // The queued response can lose the race against the steer's own injection
      // event. A hint for a steer the console already shows would never resolve.
      if (current.projection === null || current.projection.runFinishedAt !== null) return current;
      const injected = (current.projection.consoleByEntrant[entrantId] ?? []).some(
        entry => entry.kind === "steer" && entry.text === text && entry.id > sinceEventId,
      );
      if (injected) return current;
      return {
        pendingSteers: { ...current.pendingSteers, [entrantId]: [...(current.pendingSteers[entrantId] ?? []), text] },
      };
    }),
  setConnection: (connectionStatus, connectionError = null) => set({ connectionStatus, connectionError }),
  clear: () =>
    set({ currentRunId: null, projection: null, connectionStatus: "idle", connectionError: null, pendingSteers: {} }),
}));

// A queued steer is settled by the `entrant.steered` event it eventually
// produces. Matching on text, not id, because the hint is written before the
// backend journals anything — and a broadcast the projection dedupes for chat
// still clears the entrant's hint here.
function resolvePendingSteers(pending: Record<string, string[]>, event: ArenaEvent): Record<string, string[]> {
  if (event.type === "run.state" && event.payload.state === "finished") return {};
  // A done entrant takes no more turns, so its queue can only have been dropped.
  if (event.type === "entrant.status" && event.payload.status === "done" && pending[event.payload.entrantId]) {
    return { ...pending, [event.payload.entrantId]: [] };
  }
  if (event.type !== "entrant.steered") return pending;

  const queue = pending[event.payload.entrantId] ?? [];
  const index = queue.indexOf(event.payload.text);
  if (index === -1) return pending;

  return { ...pending, [event.payload.entrantId]: [...queue.slice(0, index), ...queue.slice(index + 1)] };
}

// The snapshot already carries the run head, so replaying older events needs the
// cursor wound back first. It is restored afterwards to whichever is newer, the
// head or the last backfilled event: history is fetched after the snapshot, so an
// event landing in that gap is already applied and must not replay off the stream.
function seedProjection(run: RunSnapshot, history: ArenaEvent[]): ProjectionState {
  const base = initialProjection(run);
  const oldest = history[0];
  if (oldest === undefined) return base;

  const replayed = history.reduce(applyEvent, { ...base, lastEventId: oldest.id - 1 });
  const cursor = Math.max(run.lastEventId, replayed.lastEventId);
  return { ...replayed, lastEventId: cursor, run: { ...replayed.run, lastEventId: cursor } };
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
export const selectPendingSteersFor = (entrantId: string) => (state: ArenaStore) =>
  state.pendingSteers[entrantId] ?? EMPTY_PENDING_STEERS;

const EMPTY_FEED: NonNullable<ProjectionState["feed"]> = [];
const EMPTY_CHAT: NonNullable<ProjectionState["chat"]> = [];
const EMPTY_FUNDING: NonNullable<ProjectionState["fundingByEntrant"]> = {};
const EMPTY_CONSOLE: NonNullable<ProjectionState["consoleByEntrant"][string]> = [];
const EMPTY_PREVIEW: NonNullable<ProjectionState["previewsByEntrant"][string]> = [];
const EMPTY_PENDING_STEERS: string[] = [];
