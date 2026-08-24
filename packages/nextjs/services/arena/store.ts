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
  // Backend clock minus browser clock, measured off live events. Null until one
  // lands: nothing to fade yet either, so the UI reads it as zero.
  serverOffsetMs: number | null;
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
  serverOffsetMs: null,
  setCurrentRunId: currentRunId => set({ currentRunId }),
  seedSnapshot: (run, history = []) => {
    const seededAt = new Date().toISOString();
    set(current => {
      const projection = seedProjection(run, history, seededAt);
      return {
        currentRunId: run.id,
        // Same run reseeded (reconnect): a stamp still equal to `seededAt` means no
        // replayed event touched that entrant, so the live value we already held is
        // the tighter bound. Anything history did touch is authoritative. The first
        // seed's stamp stays as `statusSeededAt` so the seeds carried over here are
        // still readable as seeds and not as transitions nobody witnessed.
        projection:
          current.projection?.run.id === run.id
            ? {
                ...projection,
                statusChangedAt: mergeStatusChangedAt(
                  projection.statusChangedAt,
                  current.projection.statusChangedAt,
                  current.projection.statusSeededAt,
                  seededAt,
                ),
                statusSeededAt: current.projection.statusSeededAt,
              }
            : projection,
        connectionError: null,
        pendingSteers: {},
      };
    });
  },
  syncSnapshot: run => {
    const seededAt = new Date().toISOString();
    set(current => {
      if (current.projection === null || current.projection.run.id !== run.id) {
        return {
          currentRunId: run.id,
          projection: initialProjection(run, seededAt),
          connectionError: null,
          pendingSteers: {},
        };
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
    });
  },
  dispatchEvent: event =>
    set(current => {
      if (current.projection === null) return current;
      const serverOffsetMs = mergeServerOffset(current.serverOffsetMs, [event]);
      const projection = applyEvent(current.projection, event);
      if (projection === current.projection) {
        return serverOffsetMs === current.serverOffsetMs ? current : { serverOffsetMs };
      }
      return { projection, serverOffsetMs, pendingSteers: resolvePendingSteers(current.pendingSteers, event) };
    }),
  dispatchEvents: events =>
    set(current => {
      if (current.projection === null) return current;
      const cursor = current.projection.lastEventId;
      const serverOffsetMs = mergeServerOffset(current.serverOffsetMs, events);
      const projection = events.reduce(applyEvent, current.projection);
      if (projection === current.projection) {
        return serverOffsetMs === current.serverOffsetMs ? current : { serverOffsetMs };
      }
      // A reconnect replays events the cursor already dropped; an old steered
      // event with the same text must not settle a currently-queued hint.
      const fresh = events.filter(event => event.id > cursor);
      return { projection, serverOffsetMs, pendingSteers: fresh.reduce(resolvePendingSteers, current.pendingSteers) };
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
  if (event.type === "run.state" && (event.payload.state === "finished" || event.payload.state === "failed")) return {};
  // A done entrant takes no more turns, so its queue can only have been dropped.
  if (event.type === "entrant.status" && event.payload.status === "done" && pending[event.payload.entrantId]) {
    return { ...pending, [event.payload.entrantId]: [] };
  }
  // A restart throws the queue away with the session, so those hints resolve to
  // nothing and would otherwise hang over the lane for the rest of the race.
  if (event.type === "entrant.restarted" && pending[event.payload.entrantId]) {
    return { ...pending, [event.payload.entrantId]: [] };
  }
  if (event.type !== "entrant.steered") return pending;

  const queue = pending[event.payload.entrantId] ?? [];
  const index = queue.indexOf(event.payload.text);
  if (index === -1) return pending;

  return { ...pending, [event.payload.entrantId]: [...queue.slice(0, index), ...queue.slice(index + 1)] };
}

// An entrant history did not touch keeps what the previous seed held: the earlier
// bound, and for one nothing has ever been observed about, the first seed's own
// stamp. An entrant that only shows up in the new snapshot has gone unobserved
// just as long, so it takes that stamp too.
function mergeStatusChangedAt(
  fresh: Record<string, string>,
  held: Record<string, string>,
  heldSeededAt: string,
  seededAt: string,
): Record<string, string> {
  const merged = { ...fresh };
  for (const [id, ts] of Object.entries(fresh)) {
    if (ts === seededAt) merged[id] = held[id] ?? heldSeededAt;
  }
  return merged;
}

// The fade threshold weighs a server event stamp against the browser clock, so a
// viewer whose clock is off by more than it would dim the whole board at once or
// never dim anything. A live event's `ts` is the server saying "now", and latency
// only ever makes that look older, so the widest gap seen is the closest we get.
function mergeServerOffset(current: number | null, events: ArenaEvent[]): number | null {
  const receivedAt = Date.now();
  let offset = current;
  for (const event of events) {
    const ts = Date.parse(event.ts);
    if (!Number.isFinite(ts)) continue;
    const candidate = ts - receivedAt;
    if (offset === null || candidate > offset) offset = candidate;
  }
  return offset;
}

// The snapshot already carries the run head, so replaying older events needs the
// cursor wound back first. It is restored afterwards to whichever is newer, the
// head or the last backfilled event: history is fetched after the snapshot, so an
// event landing in that gap is already applied and must not replay off the stream.
function seedProjection(run: RunSnapshot, history: ArenaEvent[], seededAt: string): ProjectionState {
  const base = initialProjection(run, seededAt);
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
export const selectStatusChangedAt = (state: ArenaStore) => state.projection?.statusChangedAt ?? null;
export const selectStatusSeededAt = (state: ArenaStore) => state.projection?.statusSeededAt ?? null;
export const selectServerOffsetMs = (state: ArenaStore) => state.serverOffsetMs ?? 0;
export const selectRunStartedAt = (state: ArenaStore) => state.projection?.run.startedAt ?? null;
export const selectRunDeadlineAt = (state: ArenaStore) => state.projection?.run.deadlineAt ?? null;
export const selectConnectionStatus = (state: ArenaStore) => state.connectionStatus;
export const selectConnectionError = (state: ArenaStore) => state.connectionError;
export const selectFeed = (state: ArenaStore) => state.projection?.feed ?? EMPTY_FEED;
export const selectChat = (state: ArenaStore) => state.projection?.chat ?? EMPTY_CHAT;
export const selectFunding = (state: ArenaStore) => state.projection?.fundingByEntrant ?? EMPTY_FUNDING;
export const selectNarrationByEntrant = (state: ArenaStore) =>
  state.projection?.narrationByEntrant ?? EMPTY_NARRATION_BY_ENTRANT;
export const selectLastFlagEvent = (state: ArenaStore) => state.projection?.lastFlagEvent ?? null;
export const selectFirstBlood = (state: ArenaStore) => state.projection?.firstBlood ?? null;
export const selectRunFinishedAt = (state: ArenaStore) => state.projection?.runFinishedAt ?? null;
export const selectRunError = (state: ArenaStore) => state.projection?.runError ?? null;
export const selectConsoleFor = (entrantId: string) => (state: ArenaStore) =>
  state.projection?.consoleByEntrant[entrantId] ?? EMPTY_CONSOLE;
export const selectPreviewFor = (entrantId: string) => (state: ArenaStore) =>
  state.projection?.previewsByEntrant[entrantId] ?? EMPTY_PREVIEW;
export const selectNarrationFor = (entrantId: string) => (state: ArenaStore) =>
  state.projection?.narrationByEntrant[entrantId] ?? EMPTY_NARRATION;
export const selectEmptyConsole = () => EMPTY_CONSOLE;
export const selectEmptyNarration = () => EMPTY_NARRATION;
export const selectPendingSteersFor = (entrantId: string) => (state: ArenaStore) =>
  state.pendingSteers[entrantId] ?? EMPTY_PENDING_STEERS;

const EMPTY_FEED: NonNullable<ProjectionState["feed"]> = [];
const EMPTY_CHAT: NonNullable<ProjectionState["chat"]> = [];
const EMPTY_FUNDING: NonNullable<ProjectionState["fundingByEntrant"]> = {};
const EMPTY_NARRATION_BY_ENTRANT: NonNullable<ProjectionState["narrationByEntrant"]> = {};
const EMPTY_CONSOLE: NonNullable<ProjectionState["consoleByEntrant"][string]> = [];
const EMPTY_PREVIEW: NonNullable<ProjectionState["previewsByEntrant"][string]> = [];
const EMPTY_NARRATION: NonNullable<ProjectionState["narrationByEntrant"][string]> = [];
const EMPTY_PENDING_STEERS: string[] = [];
