// Copied from agents-arena-backend contract/arena-types.ts (master as of 2026-08-07:
// currentChallengeId + entrant.challenge from #40, parentToolCallId from #37) plus
// the steer-delivery delta from agents-arena-backend#52 (SteerDelivery, SteerResponse,
// BroadcastResponse.queued) and the entrant-restart delta from agents-arena-backend#49
// (entrant.restarted, RestartResponse). Do not edit here — sync from the backend repo.
// Endpoint docs live there in contract/API.md.

export type RunState =
  | "created"
  | "awaiting_signature"
  | "preparing"
  | "awaiting_funding"
  | "ready"
  | "running"
  | "stopping"
  | "finished"
  | "failed";

export type EntrantStatus = "working" | "idle" | "blocked" | "done";

export const HARNESS_IDS = ["codex", "opencode", "claude"] as const;
export type HarnessId = (typeof HARNESS_IDS)[number];

export const ROSTER_MODELS: Readonly<Record<HarnessId, readonly string[]>> = {
  codex: ["gpt-5.5", "gpt-5.6-sol"],
  claude: ["claude-opus-5", "claude-opus-4-8", "claude-sonnet-5"],
  opencode: ["openrouter/z-ai/glm-5.2", "openrouter/moonshotai/kimi-k3", "openrouter/deepseek/deepseek-v4-flash-0731"],
};

export const ROSTER_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type RosterEffort = (typeof ROSTER_EFFORTS)[number];
export const OPENCODE_EFFORTS = ["low", "medium", "high"] as const satisfies readonly RosterEffort[];

export interface EntrantSolve {
  challengeId: number;
  ts: string;
  txHash: string;
}

export interface EntrantSummary {
  id: string;
  harness: HarnessId;
  model: string;
  effort?: RosterEffort;
  address: string | null;
  status: EntrantStatus;
  flags: number;
  solves: EntrantSolve[];
  inputTokens: number;
  outputTokens: number;
  // USD across the turns that carried a cost; null when none did. Display only —
  // harnesses on a subscription login report tokens without a price.
  costUsd: number | null;
  // The latest of the agent's own announcement (POST /agent/progress) and the
  // backend's guess from its commands — see entrant.challenge. Null until
  // either source names one.
  currentChallengeId: number | null;
}

export interface RunSnapshot {
  id: string;
  state: RunState;
  preset: string;
  // Chain the run's wallets and flag mints live on. Clients must read it from
  // here — not hardcode 31337 — for the seed signature and explorer links.
  chainId: number;
  entrants: EntrantSummary[];
  startedAt: string | null;
  // Display only. The backend never stops a run at the deadline; the operator
  // stops the race. Set from durationMs when the run enters `running`.
  deadlineAt: string | null;
  lastEventId: number;
}

export interface ArenaEventBase {
  id: number;
  runId: string;
  source: string;
  seq: number;
  ts: string;
  truncated?: Record<string, { fullLength: number; lines: number }>;
}

export type ArenaEvent =
  | (ArenaEventBase & { type: "run.state"; payload: { state: RunState; reason?: string } })
  | (ArenaEventBase & { type: "entrant.status"; payload: { entrantId: string; status: EntrantStatus } })
  | (ArenaEventBase & { type: "agent.message"; payload: { entrantId: string; text: string } })
  | (ArenaEventBase & { type: "agent.reasoning"; payload: { entrantId: string; text: string } })
  // `parentToolCallId` is set when the call came from a subagent the entrant
  // delegated to: it holds the `toolCallId` of the outer call that spawned it
  // (claude's Task). Absent on the entrant's own calls. Nested calls arrive in
  // the same lane, in order — a client may badge or nest them, or ignore it (#37).
  | (ArenaEventBase & {
      type: "tool.call";
      payload: { entrantId: string; tool: string; toolCallId: string; detail: string; parentToolCallId?: string };
    })
  | (ArenaEventBase & {
      type: "tool.result";
      payload: {
        entrantId: string;
        tool: string;
        toolCallId: string;
        ok: boolean;
        detail: string;
        parentToolCallId?: string;
      };
    })
  | (ArenaEventBase & { type: "entrant.steered"; payload: { entrantId: string; text: string } })
  | (ArenaEventBase & { type: "entrant.prompt"; payload: { entrantId: string; text: string } })
  // The operator abandoned this lane's session and opened a fresh one. The
  // opening prompt that follows arrives as the usual `entrant.prompt`.
  | (ArenaEventBase & { type: "entrant.restarted"; payload: { entrantId: string } })
  | (ArenaEventBase & { type: "entrant.nudged"; payload: { entrantId: string; text: string; flags: number } })
  | (ArenaEventBase & { type: "director.broadcast"; payload: { text: string; targetEntrantIds: string[] } })
  | (ArenaEventBase & { type: "wallet.assigned"; payload: { entrantId: string; address: string } })
  | (ArenaEventBase & {
      type: "funding.balance";
      payload: { entrantId: string; address: string; wei: string; funded: boolean };
    })
  | (ArenaEventBase & {
      type: "score.flag";
      payload: { entrantId: string; challengeId: number; txHash: string; tokenId: string };
    })
  // Optional because rows journalled before the guesser existed carry neither;
  // every one of those was an announcement, so readers treat absence as "self".
  | (ArenaEventBase & {
      type: "entrant.challenge";
      payload: { entrantId: string; challengeId: number; via?: "self" | "command"; evidence?: string };
    })
  | (ArenaEventBase & { type: "entrant.error"; payload: { entrantId: string; message: string } })
  | (ArenaEventBase & { type: "run.error"; payload: { message: string } })
  // Tokens count only what this event covers — codex emits one per turn, opencode
  // one per step, so events are not turns. inputTokens is the whole prompt, with
  // cachedInputTokens, the part served from cache, counted inside it. Harnesses
  // disagree on both points upstream (codex reports a running session total,
  // opencode reports its input net of cache), so the adapters normalize to this
  // shape. Cached tokens bill cheaper, which is why cost needs them broken out.
  | (ArenaEventBase & {
      type: "usage";
      payload: {
        entrantId: string;
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
        costUsd: number | null;
      };
    });

export interface HistoryPage {
  events: ArenaEvent[];
  hasMore: boolean;
  // Absent on immutable pages, whose bodies must never change. Read the SSE
  // resume cursor from a page without `before`.
  lastEventId?: number;
}

export interface RosterEntry {
  id: string;
  harness: HarnessId;
  model: string;
  effort?: RosterEffort;
}

export interface CreateRunRequest {
  preset: string;
  autoStart?: boolean;
  idempotencyKey?: string;
  roster?: RosterEntry[];
  // Race length; resolves to RunSnapshot.deadlineAt when the run enters
  // `running`. Display only — see the note there.
  durationMs?: number;
}

// Every run endpoint — create, get, start, seed, stop — wraps the snapshot in
// this same envelope.
export interface RunResponse {
  run: RunSnapshot;
}

export type CreateRunResponse = RunResponse;

export interface SteerRequest {
  text: string;
}

// An agent mid-turn cannot be interrupted, so its steer waits for the turn to end.
export type SteerDelivery = "queued" | "injected";

export interface SteerResponse {
  accepted: boolean;
  status: SteerDelivery;
}

// Restart takes no body: the opening prompt is rebuilt by the backend, not sent.
export interface RestartResponse {
  accepted: boolean;
}

export interface BroadcastRequest {
  text: string;
}

// One entrant failing to take the message does not fail the broadcast, so the
// response names both sides: who received the turn and who could not.
export interface BroadcastResponse {
  accepted: boolean;
  delivered: string[];
  failed: { entrantId: string; message: string }[];
  // The subset of `delivered` still waiting behind a running turn. Their
  // `entrant.steered` events land later — the journal records injection, not intent.
  queued: string[];
}

export interface NonceResponse {
  nonce: string;
}

// The EIP-4361 message the operator's wallet signed, verbatim, plus its signature.
export interface VerifyRequest {
  message: string;
  signature: string;
}

export interface VerifyResponse {
  address: string;
  expiresAt: string;
}

// `configured` is false when the backend has no operator allowlist, so a page can
// hide its sign-in control instead of offering one that can only answer 503.
export type SessionResponse =
  | { authenticated: false; configured: boolean }
  | { authenticated: true; address: string; expiresAt: string };
