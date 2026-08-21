import type { ArenaEvent } from "./arena-types";
import { ArenaApiError, arenaClient, arenaEventsUrl } from "./client";
import { useArenaStore } from "./store";

let activeConnection = 0;
const INITIAL_RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_DELAY_MS = 15_000;
const BACKFILL_PAGE_SIZE = 200;
const BACKFILL_PAGES = 2;

// Console, chat, and feed live only in the projection, so a reload starts them
// empty. These types rebuild them. `usage` is excluded on purpose: it carries
// deltas the snapshot totals already include, so replaying it would double-count.
const BACKFILL_TYPES = [
  "entrant.status",
  "agent.message",
  "agent.reasoning",
  "tool.call",
  "tool.result",
  "entrant.steered",
  "entrant.prompt",
  // Both prompts replay, so without the cut between them the abandoned session
  // and its replacement rebuild as one continuous console.
  "entrant.restarted",
  "entrant.nudged",
  "entrant.narration",
  "director.broadcast",
  "score.flag",
  "entrant.error",
];

async function loadBackfill(runId: string): Promise<ArenaEvent[]> {
  const pages: ArenaEvent[][] = [];
  let before: number | undefined;

  try {
    for (let page = 0; page < BACKFILL_PAGES; page += 1) {
      const result = await arenaClient.getHistory(runId, {
        limit: BACKFILL_PAGE_SIZE,
        types: BACKFILL_TYPES,
        ...(before === undefined ? {} : { before }),
      });
      if (result.events.length === 0) break;
      pages.unshift(result.events);
      if (!result.hasMore) break;
      before = result.events[0].id;
    }
  } catch {
    // A run still repaints from its snapshot without the replayed views.
    return pages.flat();
  }

  return pages.flat();
}

export function connectRun(runId: string): () => void {
  const connectionId = ++activeConnection;
  const controller = new AbortController();
  let eventSource: EventSource | null = null;
  let reopenTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  let queuedEvents: ArenaEvent[] = [];
  let flushScheduled = false;
  let runNotFound = false;
  let stopped = false;

  const isActive = () => !stopped && !runNotFound && activeConnection === connectionId;

  const markNotFound = (error: ArenaApiError) => {
    runNotFound = true;
    eventSource?.close();
    eventSource = null;
    if (reopenTimer) clearTimeout(reopenTimer);
    reopenTimer = null;
    useArenaStore.getState().setConnection("not-found", error.message);
  };

  const refreshSnapshot = async (): Promise<"synced" | "not-found" | "failed"> => {
    try {
      const snapshot = await arenaClient.getRun(runId, controller.signal);
      if (isActive()) useArenaStore.getState().syncSnapshot(snapshot);
      return "synced";
    } catch (error) {
      if (!isActive() || controller.signal.aborted) return "failed";
      if (error instanceof ArenaApiError && error.status === 404) {
        markNotFound(error);
        return "not-found";
      }
      return "failed";
    }
  };

  const flushEvents = () => {
    flushScheduled = false;
    const events = queuedEvents;
    queuedEvents = [];
    if (!isActive() || events.length === 0) return;
    useArenaStore.getState().dispatchEvents(events);
    if (events.some(event => event.type === "run.state")) void refreshSnapshot();
  };

  const queueEvent = (event: ArenaEvent) => {
    queuedEvents.push(event);
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(flushEvents);
  };

  const scheduleReopen = () => {
    if (!isActive() || reopenTimer) return;
    const delay = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    reopenTimer = setTimeout(() => {
      reopenTimer = null;
      void reopenStream();
    }, delay);
  };

  const reopenStream = async () => {
    if (!isActive()) return;
    const result = await refreshSnapshot();
    if (!isActive() || result === "not-found") return;
    if (result === "failed") {
      scheduleReopen();
      return;
    }
    openStream();
  };

  function openStream() {
    if (!isActive()) return;
    const after = useArenaStore.getState().projection?.lastEventId ?? 0;
    eventSource = new EventSource(arenaEventsUrl(runId, after), { withCredentials: true });

    eventSource.onopen = () => {
      if (!isActive()) return;
      reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      useArenaStore.getState().setConnection("open");
    };
    eventSource.onmessage = message => {
      if (!isActive()) return;
      try {
        const event = JSON.parse(message.data) as ArenaEvent;
        queueEvent(event);
      } catch (error) {
        useArenaStore
          .getState()
          .setConnection("error", error instanceof Error ? error.message : "The arena sent an invalid event");
      }
    };
    eventSource.onerror = () => {
      if (!isActive()) return;
      eventSource?.close();
      eventSource = null;
      useArenaStore.getState().setConnection("reconnecting");
      // A fresh URL carries our reducer cursor because EventSource hides its internal retry state.
      scheduleReopen();
    };
  }

  useArenaStore.getState().setConnection("connecting");
  void arenaClient
    .getRun(runId, controller.signal)
    .then(async snapshot => {
      if (!isActive()) return;
      const history = await loadBackfill(runId);
      if (!isActive()) return;
      useArenaStore.getState().seedSnapshot(snapshot, history);
      openStream();
    })
    .catch(error => {
      if (!isActive() || controller.signal.aborted) return;
      if (error instanceof ArenaApiError && error.status === 404) {
        markNotFound(error);
        return;
      }
      useArenaStore
        .getState()
        .setConnection("error", error instanceof Error ? error.message : "Could not load the arena run");
    });

  return () => {
    stopped = true;
    controller.abort();
    eventSource?.close();
    if (reopenTimer) clearTimeout(reopenTimer);
    if (activeConnection === connectionId) useArenaStore.getState().setConnection("idle");
  };
}
