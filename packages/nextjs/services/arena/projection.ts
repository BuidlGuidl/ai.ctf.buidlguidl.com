import type { ArenaEvent, EntrantStatus, RunSnapshot } from "./arena-types";
import { displayForEntrant } from "./roster";

export interface ConsoleEntry {
  id: number;
  source: string;
  kind: "think" | "message" | "flag" | "error" | "tool" | "tool-result";
  text: string;
  tool?: string;
  toolCallId?: string;
  truncated?: ArenaEvent["truncated"];
  result?: { ok: boolean; detail: string; truncated?: ArenaEvent["truncated"] };
}

export interface FeedItem {
  id: number;
  type: "flag" | "blocked" | "resumed" | "done";
  agentId: string;
  color: string;
  text: string;
}

export interface ChatItem {
  id: number;
  fromId: string;
  fromHandle: string;
  color: string;
  text: string;
  director?: boolean;
}

export interface FundingProjection {
  address: string | null;
  wei: string | null;
  funded: boolean;
}

export interface FirstBlood {
  entrantId: string;
  challengeId: number;
  ts: string;
}

export interface ProjectionState {
  run: RunSnapshot;
  lastEventId: number;
  consoleByEntrant: Record<string, ConsoleEntry[]>;
  previewsByEntrant: Record<string, string[]>;
  fundingByEntrant: Record<string, FundingProjection>;
  feed: FeedItem[];
  chat: ChatItem[];
  firstBlood: FirstBlood | null;
  lastFlagEvent: Extract<ArenaEvent, { type: "score.flag" }> | null;
  runFinishedAt: string | null;
  runError: string | null;
  // A broadcast reaches each entrant as its own steer turn. The chat shows the
  // message once, so the steers it caused are matched here and skipped.
  pendingBroadcast: { text: string; entrantIds: string[] } | null;
}

const CONSOLE_LIMIT = 70;
const PREVIEW_LIMIT = 10;
const FEED_LIMIT = 40;
const CHAT_LIMIT = 60;

export function initialProjection(run: RunSnapshot): ProjectionState {
  const consoleByEntrant: Record<string, ConsoleEntry[]> = {};
  const previewsByEntrant: Record<string, string[]> = {};
  const fundingByEntrant: Record<string, FundingProjection> = {};

  for (const entrant of run.entrants) {
    consoleByEntrant[entrant.id] = [];
    previewsByEntrant[entrant.id] = [];
    fundingByEntrant[entrant.id] = { address: entrant.address, wei: null, funded: false };
  }

  const firstSolve = run.entrants
    .flatMap(entrant => entrant.solves.map(solve => ({ entrantId: entrant.id, ...solve })))
    .sort((a, b) => a.ts.localeCompare(b.ts))[0];

  return {
    run,
    lastEventId: run.lastEventId,
    consoleByEntrant,
    previewsByEntrant,
    fundingByEntrant,
    feed: [],
    chat: [],
    firstBlood: firstSolve
      ? { entrantId: firstSolve.entrantId, challengeId: firstSolve.challengeId, ts: firstSolve.ts }
      : null,
    lastFlagEvent: null,
    runFinishedAt: null,
    runError: null,
    pendingBroadcast: null,
  };
}

export function applyEvent(state: ProjectionState, event: ArenaEvent): ProjectionState {
  // Events arrive in ascending id order (SSE replay + live), so the cursor
  // alone dedupes reconnect overlap.
  if (event.runId !== state.run.id || event.id <= state.lastEventId) return state;

  let next: ProjectionState = {
    ...state,
    lastEventId: event.id,
    run: { ...state.run, lastEventId: event.id },
  };

  switch (event.type) {
    case "run.state":
      return {
        ...next,
        run: { ...next.run, state: event.payload.state },
        runFinishedAt: event.payload.state === "finished" ? event.ts : next.runFinishedAt,
        runError: event.payload.reason ?? next.runError,
      };
    case "entrant.status": {
      const previous = state.run.entrants.find(entrant => entrant.id === event.payload.entrantId)?.status;
      next = updateEntrant(next, event.payload.entrantId, entrant => ({ ...entrant, status: event.payload.status }));
      const item = statusFeedItem(event, previous);
      return item ? appendFeed(next, item) : next;
    }
    case "agent.message":
      next = appendConsole(next, event.payload.entrantId, {
        id: event.id,
        source: event.source,
        kind: "message",
        text: event.payload.text,
      });
      next = appendPreview(next, event.payload.entrantId, `› ${singleLine(event.payload.text)}`);
      return appendChat(next, entrantChat(event));
    case "agent.reasoning":
      next = appendConsole(next, event.payload.entrantId, {
        id: event.id,
        source: event.source,
        kind: "think",
        text: event.payload.text,
      });
      return appendPreview(next, event.payload.entrantId, `· ${singleLine(event.payload.text)}`);
    case "tool.call":
      next = appendConsole(next, event.payload.entrantId, {
        id: event.id,
        source: event.source,
        kind: "tool",
        tool: event.payload.tool,
        toolCallId: event.payload.toolCallId,
        text: event.payload.detail,
        truncated: event.truncated,
      });
      return appendPreview(
        next,
        event.payload.entrantId,
        `⟳ $ ${event.payload.tool} ${singleLine(event.payload.detail)}`,
      );
    case "tool.result":
      next = attachToolResult(next, event);
      return appendPreview(
        next,
        event.payload.entrantId,
        `${event.payload.ok ? "✓" : "✗"} ${event.payload.tool} ${singleLine(event.payload.detail)}`,
      );
    case "entrant.steered": {
      const pending = next.pendingBroadcast;
      if (
        pending !== null &&
        pending.text === event.payload.text &&
        pending.entrantIds.includes(event.payload.entrantId)
      ) {
        const entrantIds = pending.entrantIds.filter(id => id !== event.payload.entrantId);
        return { ...next, pendingBroadcast: entrantIds.length === 0 ? null : { ...pending, entrantIds } };
      }
      return appendChat(next, {
        id: event.id,
        fromId: "director",
        fromHandle: `OPERATOR INJECTION → ${displayFor(event.payload.entrantId).handle}`,
        color: "#FFBE00",
        text: event.payload.text,
        director: true,
      });
    }
    case "entrant.prompt":
      return appendConsole(next, event.payload.entrantId, {
        id: event.id,
        source: event.source,
        kind: "message",
        text: `Task: ${event.payload.text}`,
      });
    case "entrant.nudged":
      return appendConsole(next, event.payload.entrantId, {
        id: event.id,
        source: event.source,
        kind: "message",
        text: `Nudge: ${event.payload.text}`,
      });
    case "director.broadcast":
      return appendChat(
        {
          ...next,
          pendingBroadcast: { text: event.payload.text, entrantIds: [...event.payload.targetEntrantIds] },
        },
        {
          id: event.id,
          fromId: "director",
          fromHandle: "OPERATOR INJECTION",
          color: "#FFBE00",
          text: event.payload.text,
          director: true,
        },
      );
    case "wallet.assigned":
      next = updateEntrant(next, event.payload.entrantId, entrant => ({ ...entrant, address: event.payload.address }));
      return updateFunding(next, event.payload.entrantId, current => ({ ...current, address: event.payload.address }));
    case "funding.balance":
      return updateFunding(next, event.payload.entrantId, () => ({
        address: event.payload.address,
        wei: event.payload.wei,
        funded: event.payload.funded,
      }));
    case "score.flag": {
      const existing = next.run.entrants
        .find(entrant => entrant.id === event.payload.entrantId)
        ?.solves.some(solve => solve.challengeId === event.payload.challengeId);
      if (!existing) {
        next = updateEntrant(next, event.payload.entrantId, entrant => ({
          ...entrant,
          flags: entrant.flags + 1,
          solves: [
            ...entrant.solves,
            { challengeId: event.payload.challengeId, ts: event.ts, txHash: event.payload.txHash },
          ],
        }));
      }
      next = appendConsole(next, event.payload.entrantId, {
        id: event.id,
        source: event.source,
        kind: "flag",
        text: `Captured Challenge ${event.payload.challengeId}`,
      });
      const display = displayFor(event.payload.entrantId);
      next = appendFeed(next, {
        id: event.id,
        type: "flag",
        agentId: event.payload.entrantId,
        color: display.color,
        text: `${display.handle} captured Challenge ${event.payload.challengeId}`,
      });
      return {
        ...next,
        firstBlood: next.firstBlood ?? {
          entrantId: event.payload.entrantId,
          challengeId: event.payload.challengeId,
          ts: event.ts,
        },
        lastFlagEvent: event,
      };
    }
    case "entrant.error":
      return appendConsole(next, event.payload.entrantId, {
        id: event.id,
        source: event.source,
        kind: "error",
        text: event.payload.message,
      });
    case "run.error":
      return { ...next, runError: event.payload.message };
    case "usage":
      return updateEntrant(next, event.payload.entrantId, entrant => ({
        ...entrant,
        inputTokens: entrant.inputTokens + event.payload.inputTokens,
        outputTokens: entrant.outputTokens + event.payload.outputTokens,
        costUsd: event.payload.costUsd === null ? entrant.costUsd : (entrant.costUsd ?? 0) + event.payload.costUsd,
      }));
    default:
      return assertNever(event);
  }
}

function updateEntrant(
  state: ProjectionState,
  entrantId: string,
  update: (entrant: RunSnapshot["entrants"][number]) => RunSnapshot["entrants"][number],
): ProjectionState {
  return {
    ...state,
    run: {
      ...state.run,
      entrants: state.run.entrants.map(entrant => (entrant.id === entrantId ? update(entrant) : entrant)),
    },
  };
}

function appendConsole(state: ProjectionState, entrantId: string, entry: ConsoleEntry): ProjectionState {
  const entries = [...(state.consoleByEntrant[entrantId] ?? []), entry].slice(-CONSOLE_LIMIT);
  return { ...state, consoleByEntrant: { ...state.consoleByEntrant, [entrantId]: entries } };
}

function attachToolResult(
  state: ProjectionState,
  event: Extract<ArenaEvent, { type: "tool.result" }>,
): ProjectionState {
  const entries = state.consoleByEntrant[event.payload.entrantId] ?? [];

  // Harness call IDs can repeat after a process restart, so the result belongs to the latest unresolved call.
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (
      entry.source === event.source &&
      entry.kind === "tool" &&
      entry.toolCallId === event.payload.toolCallId &&
      entry.result === undefined
    ) {
      const updated = [...entries];
      updated[index] = {
        ...entry,
        result: { ok: event.payload.ok, detail: event.payload.detail, truncated: event.truncated },
      };
      return {
        ...state,
        consoleByEntrant: { ...state.consoleByEntrant, [event.payload.entrantId]: updated },
      };
    }
  }

  return appendConsole(state, event.payload.entrantId, {
    id: event.id,
    source: event.source,
    kind: "tool-result",
    toolCallId: event.payload.toolCallId,
    text: event.payload.detail,
    truncated: event.truncated,
  });
}

function appendPreview(state: ProjectionState, entrantId: string, line: string): ProjectionState {
  const preview = [...(state.previewsByEntrant[entrantId] ?? []), line].slice(-PREVIEW_LIMIT);
  return { ...state, previewsByEntrant: { ...state.previewsByEntrant, [entrantId]: preview } };
}

function updateFunding(
  state: ProjectionState,
  entrantId: string,
  update: (current: FundingProjection) => FundingProjection,
): ProjectionState {
  const current = state.fundingByEntrant[entrantId] ?? { address: null, wei: null, funded: false };
  return {
    ...state,
    fundingByEntrant: { ...state.fundingByEntrant, [entrantId]: update(current) },
  };
}

function appendFeed(state: ProjectionState, item: FeedItem): ProjectionState {
  return { ...state, feed: [...state.feed, item].slice(-FEED_LIMIT) };
}

function appendChat(state: ProjectionState, item: ChatItem): ProjectionState {
  return { ...state, chat: [...state.chat, item].slice(-CHAT_LIMIT) };
}

function statusFeedItem(
  event: Extract<ArenaEvent, { type: "entrant.status" }>,
  previous: EntrantStatus | undefined,
): FeedItem | null {
  const display = displayFor(event.payload.entrantId);
  if (event.payload.status === "blocked") {
    return {
      id: event.id,
      type: "blocked",
      agentId: event.payload.entrantId,
      color: display.color,
      text: `${display.handle} is blocked`,
    };
  }
  if (previous === "blocked" && event.payload.status === "working") {
    return {
      id: event.id,
      type: "resumed",
      agentId: event.payload.entrantId,
      color: display.color,
      text: `${display.handle} resumed work`,
    };
  }
  if (event.payload.status === "done") {
    return {
      id: event.id,
      type: "done",
      agentId: event.payload.entrantId,
      color: display.color,
      text: `${display.handle} exited and recorded its result`,
    };
  }
  return null;
}

function entrantChat(event: Extract<ArenaEvent, { type: "agent.message" }>): ChatItem {
  const display = displayFor(event.payload.entrantId);
  return {
    id: event.id,
    fromId: event.payload.entrantId,
    fromHandle: display.handle,
    color: display.color,
    text: event.payload.text,
  };
}

function displayFor(entrantId: string) {
  return displayForEntrant(entrantId, "agent", entrantId);
}

function singleLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function assertNever(event: never): never {
  throw new Error(`Unhandled arena event: ${JSON.stringify(event)}`);
}
