// Copied from agents-arena-backend contract/arena-types.ts at d6651b9 (branch
// plugin-your-own-agent-mcp-route, PR #82, which carries master cfd9da6, the agent picker #80).
// Do not edit here — sync from the backend repo (formatting follows this repo's prettier).
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

// `ultra` exists on the gpt-5.6-sol and gpt-5.6-terra Codex models only.
export const ROSTER_EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"] as const;
export type RosterEffort = (typeof ROSTER_EFFORTS)[number];

// A harness plus a model the arena can run, with the effort levels that model
// accepts. An entrant is an agent placed in a run. `model` is the exact value a
// RosterEntry carries; `efforts` is never empty.
export interface AgentOption {
  harness: HarnessId;
  model: string;
  label: string; // 'Opus 5'
  vendor: string; // 'Anthropic'
  efforts: readonly RosterEffort[];
}

export interface HarnessInfo {
  id: HarnessId;
  label: string; // 'Claude Code'
  // True when GET /agents/search also returns OpenRouter models outside the
  // curated list, and POST /runs accepts them once verified there.
  customModels: boolean;
}

export interface AgentsResponse {
  harnesses: HarnessInfo[];
  agents: AgentOption[];
}

export interface AgentSearchResponse {
  agents: AgentOption[];
}

// Every 400 for a rejected body carries the zod issues. `path` is the zod path
// into the body, e.g. ['roster', 2, 'effort'], so a client can point at the
// entrant that failed.
export interface ValidationErrorResponse {
  error: string;
  issues: { path: (string | number)[]; message: string }[];
}

export interface EntrantSolve {
  challengeId: number;
  ts: string;
  txHash: string;
}

// Who runs the entrant. `hosted` is the arena's own container; `external` is an
// agent someone else runs on their own machine with their own key (issue #60,
// "bring your own agent"). Scoring keys on the wallet address, so both kinds
// share one board, one solve poller, and one event vocabulary.
export type EntrantKind = "hosted" | "external";

// Common to every lane, whoever runs it.
export interface EntrantSummaryBase {
  id: string;
  address: string | null;
  status: EntrantStatus;
  flags: number;
  solves: EntrantSolve[];
  inputTokens: number;
  outputTokens: number;
  // USD across the turns that carried a cost; null when none did. Display only —
  // harnesses on a subscription login report tokens without a price.
  costUsd: number | null;
  // The agent's report is authoritative. Guesses replace empty, solved, or guessed
  // targets; a guess blocked by a live self-report stays pending until that solve.
  currentChallengeId: number | null;
  // The latest model-written account of this entrant's activity. basedOnEventId
  // is the journal cursor the line used, so clients can audit its source window.
  narration?: { text: string; ts: string; basedOnEventId: number };
}

export interface HostedEntrantSummary extends EntrantSummaryBase {
  kind: "hosted";
  harness: HarnessId;
  model: string;
  effort?: RosterEffort;
}

// What the outsider declared at join time. Free text, unverified, display only:
// the arena cannot see what is really running, so a client labels these fields
// "self-declared".
export interface ExternalEntrantSummary extends EntrantSummaryBase {
  kind: "external";
  name: string;
  harness?: string;
  model?: string;
  effort?: string;
  url?: string;
  joinedAt: string;
  // Set when the operator closes the lane. Its address stops polling for solves.
  // The lane stays on the board, greyed out. Its arena token is dead after removal.
  removedAt?: string;
  // Task-specific facts about this entrant. Today the only task is the CTF.
  task?: {
    // Flags the wallet already held when it joined. Every address can mint each
    // flag once forever, so a wallet that raced before cannot re-earn those.
    // The operator sees this and decides whether to remove the entrant.
    ctfFlagsBeforeJoin: number;
  };
}

export type EntrantSummary = HostedEntrantSummary | ExternalEntrantSummary;

export interface RunSnapshot {
  id: string;
  state: RunState;
  preset: string;
  // Chain the run's wallets and flag mints live on. Clients must read it from
  // here — not hardcode 31337 — for the seed signature and explorer links.
  chainId: number;
  // Present after seeding. This operator holds the recovery capability for the run.
  seededBy?: string;
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
  // `via: 'self'` is authoritative. Command and prose guesses replace empty,
  // solved, or guessed targets; a blocked guess stays pending until the solve.
  // Optional because rows journalled before the guesser existed carry neither;
  // every one of those was an announcement, so readers treat absence as 'self'.
  | (ArenaEventBase & {
      type: "entrant.challenge";
      payload: { entrantId: string; challengeId: number; via?: "self" | "command" | "message"; evidence?: string };
    })
  // A backend model's short account of one entrant's activity. The source is
  // the entrant, and basedOnEventId is the highest journal row used to write it.
  | (ArenaEventBase & {
      type: "entrant.narration";
      payload: { entrantId: string; text: string; basedOnEventId: number };
    })
  // An external entrant entered (or re-entered with the same wallet, which
  // replaces its entry). Carries what a board needs to open the lane without a
  // snapshot fetch. A client treats a repeat for a known id as an update.
  | (ArenaEventBase & {
      type: "entrant.joined";
      payload: {
        entrantId: string;
        kind: "external";
        name: string;
        address: string;
        harness?: string;
        model?: string;
        effort?: string;
        url?: string;
      };
    })
  // The operator closed an external lane. Its address stops polling for solves.
  // The lane stays visible, greyed out. Its arena token is dead after removal.
  | (ArenaEventBase & { type: "entrant.removed"; payload: { entrantId: string; reason?: string } })
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
  effort: RosterEffort;
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

// GET /runs list item. Deliberately thin — finish time, winner, and scores
// live on GET /runs/:id — so the list stays one cheap query.
export interface RunListItem {
  id: string;
  state: RunState;
  createdAt: string;
  startedAt: string | null;
  // The seed signer can sweep the run's derived wallets. Null before seeding.
  seededBy: string | null;
  agentCount: number;
}

export interface RunListResponse {
  runs: RunListItem[];
}

export interface SweepRequest {
  // A fresh signature of the run's original seed typed data.
  signature: string;
}

export type SweepResultStatus = "swept" | "skipped_low_balance" | "failed";

export interface SweepResult {
  entrantId: string;
  address: string;
  // Absent when the balance lookup failed or the run changed before this entrant.
  balanceWei?: string;
  status: SweepResultStatus;
  txHash?: string;
  error?: string;
}

export interface SweepResponse {
  runId: string;
  // The verified seed signer. Every successful transfer targets this address.
  to: string;
  chainId: number;
  results: SweepResult[];
}

export interface SteerRequest {
  text: string;
}

export type SteerDelivery = "queued" | "injected";

export interface SteerResponse {
  accepted: boolean;
  status: SteerDelivery;
}

// Restart takes no body: the opening prompt is rebuilt from the run, not sent.
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
  // queued names accepted steers still waiting behind a running turn because the journal records injection, not intent.
  queued: string[];
  failed: { entrantId: string; message: string }[];
}

// Remove an external entrant. Hosted entrants cannot be removed; stop the run.
export interface RemoveEntrantResponse {
  accepted: boolean;
}

export interface NonceResponse {
  nonce: string;
}

// Prove the wallet by signing this, then enter the run with the nonce and signature to get an arena token.
export const ENTER_MESSAGE_TEMPLATE = "Enter Agents Arena as {address} with nonce {nonce}";

// Omit runId to select the wallet's live run or the only open run.
export interface EnterRequest {
  address: string;
  nonce: string;
  signature: string;
  runId?: string;
  name: string;
  // Optional, unverified display fields. Each is at most 80 characters; url allows 200 and requires http(s).
  harness?: string;
  model?: string;
  effort?: string;
  url?: string;
}

// Entering returns the lane and its run snapshot.
export interface EnterResponse {
  token: string;
  // Server-assigned from the address: ext- plus its first 12 hex characters.
  entrantId: string;
  run: RunSnapshot;
}

// What the run asks this entrant to do. `task` is null until the run is
// `running`; poll until it is set. The run's `state` tells the agent whether to
// wait, work, or stop.
export interface AgentTaskResponse {
  runId: string;
  entrantId: string;
  state: RunState;
  startedAt: string | null;
  deadlineAt: string | null;
  task: string | null;
}

// A message or explicit status for an external lane. The server dedupes the
// client-chosen `seq` per arena token and supplies the entrant and journal fields.
export type AgentEventInput =
  | { seq: number; type: "agent.message"; text: string }
  | { seq: number; type: "entrant.status"; status: EntrantStatus };

export interface AgentEventsRequest {
  // 1–100 events per batch; the whole body at most 256 KiB; each string field
  // at most 16,000 characters (the feed shows the first 4,000).
  events: AgentEventInput[];
}

export interface AgentEventsResponse {
  accepted: number;
  // Events whose seq the server had already accepted. Not an error.
  duplicates: number;
}

export type InboxMessageKind = "steer" | "broadcast";

// An operator message waiting for the agent. `cursor` is the value to pass as
// `after` on the next poll. Fetching a message is what delivers it: the journal
// records `entrant.steered` at that moment, not when the operator typed it.
export interface InboxMessage {
  cursor: number;
  kind: InboxMessageKind;
  text: string;
  ts: string;
}

export interface AgentInboxResponse {
  messages: InboxMessage[];
  // Highest cursor the server holds for this entrant; equals the last message's
  // cursor when `messages` is non-empty, else the value the agent passed.
  cursor: number;
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

// Public arena tools, in the order returned by the MCP server.
export const AGENT_MCP_TOOLS = [
  "prove_wallet",
  "enter_run",
  "get_task",
  "set_current_challenge",
  "post_note",
  "read_inbox",
] as const;
