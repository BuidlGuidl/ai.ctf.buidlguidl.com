// Mock data + generators for the Agent Arena broadcast mockup.
// Everything here is fake and only meant to drive the streaming-layout simulation.
import { Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export type Difficulty = "easy" | "medium" | "hard" | "insane";

export interface Challenge {
  id: number;
  name: string;
  tag: string;
  difficulty: Difficulty;
  description: string;
  hints: string[];
}

export interface AgentModel {
  vendor: string;
  short: string; // 2-3 char monogram
}

// The four statuses the backend can actually observe (EntrantStatus in the
// arena contract): `blocked` is an agent sitting on a permission prompt, `done`
// is the arena having consumed its exit. Anything richer — thinking, exploiting,
// submitting — has no honest source, so the UI derives it from events instead.
export type AgentStatus = "working" | "idle" | "blocked" | "done";

export interface Agent {
  id: string;
  handle: string;
  harness: string;
  model: string;
  vendor: string;
  color: string;
  short: string;
  address: Address; // wallet the director funds before the match starts
  solved: number[]; // challenge ids
  current: number; // challenge id being worked on
  status: AgentStatus;
  tokens: number; // total tokens
  cost: number; // usd
  lastAction: string;
  preview: string[]; // rolling mini-terminal buffer (multiview cards)
  firstBlood: string; // time to first flag mm:ss
}

// Names, blurbs and hints mirror the real CTF copy in packages/nextjs/data/challenges/*.md.
// `difficulty` is the one field that markdown doesn't carry, so it stays a mock judgement call.
export const CHALLENGES: Challenge[] = [
  {
    id: 1,
    name: "Agent Registration",
    tag: "erc-8004",
    difficulty: "easy",
    description:
      "Register as an ERC-8004 agent so the contract can verify your identity through the Identity Registry. This address is used for the rest of the game.",
    hints: [
      "Register on the ERC-8004 Identity Registry on Base",
      "Your wallet must match the agentWallet set in the registration",
      "Then call registerAgent(agentId) on the challenge contract",
    ],
  },
  {
    id: 2,
    name: "Show me your key",
    tag: "hashing",
    difficulty: "easy",
    description: "Provide the right key to the contract to mint your flag.",
    hints: ["You have everything you need to compute the key offchain — but onchain works too"],
  },
  {
    id: 3,
    name: "Let me in!",
    tag: "caller-check",
    difficulty: "easy",
    description: "You just have to ask the right way.",
    hints: ["You might need to deploy a contract to solve this one"],
  },
  {
    id: 4,
    name: "Pay me!",
    tag: "fallback",
    difficulty: "easy",
    description: "Pay me — but not directly.",
    hints: ["Understand the receive and fallback functions"],
  },
  {
    id: 5,
    name: "Count my Assembly",
    tag: "assembly",
    difficulty: "medium",
    description: "Set the right parameters to meet the counter's requirements.",
    hints: ["Understand how mload works in Solidity assembly", "Sharpen your bitwise operations"],
  },
  {
    id: 6,
    name: "Give Me My Points!",
    tag: "reentrancy",
    difficulty: "medium",
    description: "Obtain this flag by getting points and upgrading levels.",
    hints: ["Think about the sequence of operations in your contract", "Recursion may be required"],
  },
  {
    id: 7,
    name: "Calldata FTW",
    tag: "calldata",
    difficulty: "hard",
    description: "Sometimes the calldata is the only way to talk to a contract.",
    hints: ["Learn how calldata is built", "Set the right selector at the right place"],
  },
  {
    id: 8,
    name: "Locked",
    tag: "bitwise",
    difficulty: "hard",
    description: "This flag is protected behind a triple lock.",
    hints: [
      "Understand bitwise operations",
      "Pay attention to how the password is masked",
      "Learn about the receive function",
    ],
  },
  {
    id: 9,
    name: "The unverified",
    tag: "bytecode",
    difficulty: "hard",
    description: "Mint your flag in this unverified contract.",
    hints: ["Look at the deploy script for Challenge 9 — and the resulting deployed bytecode"],
  },
  {
    id: 10,
    name: "Who can call me?",
    tag: "access-control",
    difficulty: "medium",
    description: "Interact with the Challenge #10 contract. In this case, not all calls are allowed.",
    hints: [],
  },
  {
    id: 11,
    name: "Give me the block!",
    tag: "block-timing",
    difficulty: "insane",
    description: "Mint your flag using the right block — if you are lucky.",
    hints: [],
  },
  {
    id: 12,
    name: "Conquer the game",
    tag: "achievements",
    difficulty: "insane",
    description: "Unlock the achievements, win the game, and capture the flag.",
    hints: ["You should take a look at the NFTFlags contract"],
  },
];

const V = {
  anthropic: { vendor: "Anthropic", short: "AN" },
  openai: { vendor: "OpenAI", short: "OA" },
  google: { vendor: "Google", short: "GG" },
  deepseek: { vendor: "DeepSeek", short: "DS" },
  qwen: { vendor: "Alibaba", short: "QW" },
  moonshot: { vendor: "Moonshot", short: "KI" },
  zhipu: { vendor: "Zhipu", short: "GL" },
  xai: { vendor: "xAI", short: "XA" },
  meta: { vendor: "Meta", short: "LL" },
  mistral: { vendor: "Mistral", short: "MI" },
};

// One color per competitor rather than per vendor — three Anthropic agents sharing
// a single salmon made them impossible to tell apart on the race track. Hues are
// interleaved so neighbours on the leaderboard never land on adjacent hues.
export const AGENT_COLORS = [
  "#FF5C5C", // red
  "#2DD4BF", // teal
  "#FFE14D", // yellow
  "#A855F7", // violet
  "#22C55E", // green
  "#FF9F1C", // orange
  "#60A5FA", // blue
  "#EC4899", // pink
  "#A3E635", // lime
  "#E2E8F0", // silver
];

interface Seed {
  harness: string;
  model: string;
  v: AgentModel;
  solved: number;
}

// 10 competitors: different harnesses x frontier + chinese models.
const SEEDS: Seed[] = [
  { harness: "Claude Code", model: "Opus 4.8", v: V.anthropic, solved: 9 },
  { harness: "Codex CLI", model: "GPT-5", v: V.openai, solved: 8 },
  { harness: "OpenCode", model: "Gemini 3 Pro", v: V.google, solved: 7 },
  { harness: "Claude Code", model: "Sonnet 5", v: V.anthropic, solved: 7 },
  { harness: "OpenCode", model: "DeepSeek V3.2", v: V.deepseek, solved: 6 },
  { harness: "Aider", model: "Opus 4.8", v: V.anthropic, solved: 5 },
  { harness: "OpenCode", model: "Qwen3-Max", v: V.qwen, solved: 5 },
  { harness: "Cline", model: "Kimi K2", v: V.moonshot, solved: 4 },
  { harness: "Goose", model: "GLM-4.6", v: V.zhipu, solved: 3 },
  { harness: "OpenCode", model: "Grok 4", v: V.xai, solved: 2 },
];

export const AGENT_COUNT = SEEDS.length;

// How much ETH each agent needs before the match can start.
export const FUNDING_AMOUNT_ETH = "0.001";

function slug(harness: string, model: string) {
  return (harness.split(" ")[0] + "-" + model)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Everyone starts at the line: no flags, all on challenge #1, waiting for the
// match to begin. Progress only accrues once the arena goes live.
//
// Each agent gets a fresh wallet per run. Only the address is kept — nothing
// signs as an agent, they only receive, which is why discarding the key is fine
// (and why the lobby refuses to send funds off a local chain).
export function buildAgents(): Agent[] {
  return SEEDS.map(
    (s, i): Agent => ({
      id: `agent-${i}`,
      handle: slug(s.harness, s.model),
      harness: s.harness,
      model: s.model,
      vendor: s.v.vendor,
      color: AGENT_COLORS[i % AGENT_COLORS.length],
      short: s.v.short,
      address: privateKeyToAccount(generatePrivateKey()).address,
      solved: [],
      current: 1,
      status: "idle",
      tokens: 0,
      cost: 0,
      lastAction: "waiting for match start",
      preview: seedPreview(CHALLENGES[0]?.tag || "default"),
      firstBlood: "—",
    }),
  );
}

export const SKILLS = [
  "solidity-storage-layout",
  "reentrancy-detector",
  "abi-decoder",
  "merkle-proof-builder",
  "ecdsa-toolkit",
  "gas-profiler",
  "rlp-codec",
  "foundry-cheatcodes",
  "onchain-tracer",
];

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "#00ff9c",
  medium: "#00FBFF",
  hard: "#FFBE00",
  insane: "#FF5861",
};

// ---- Console event generators (observer mode) -------------------------------
//
// Shaped like the backend's arena stream: a tool call and its result arrive as
// two separate events tied by `toolCallId`, and the console pairs them back into
// a single entry that goes running → ok/fail.

export type ConsoleEvent =
  | { kind: "think" | "skill" | "flag" | "message"; text: string }
  | { kind: "tool"; tool: string; text: string; toolCallId: string }
  | { kind: "tool-result"; toolCallId: string; ok: boolean; text: string };

export interface ConsoleEntry {
  id: number;
  kind: ConsoleEvent["kind"];
  text: string;
  tool?: string;
  toolCallId?: string;
  result?: { ok: boolean; detail: string };
}

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

const THINK: Record<string, string[]> = {
  default: [
    "reading contract source to map the attack surface...",
    "hmm, the require checks the caller against the registry mapping",
    "let me enumerate every external/public function first",
    "the storage layout looks off — slot 2 might be shadowed",
    "I should double-check the msg.sender assumption here",
    "planning: fund attacker contract, then trigger the callback",
    "this reverts on the second call, so the guard is stateful",
    "re-deriving the function selector to be safe",
  ],
  reentrancy: [
    "points are credited AFTER the external call — that's the opening",
    "I'll recurse from receive() until the level ticks over",
    "no nonReentrant modifier on the upgrade path",
  ],
  calldata: [
    "the selector has to sit in the first 4 bytes, nothing else works",
    "no ABI helper is going to build this — raw calldata it is",
    "padding the argument to 32 bytes and appending it by hand",
  ],
  bitwise: [
    "the password is masked, so I need to undo the shift first",
    "three locks means three separate bit checks to satisfy",
    "shifting right then AND-ing to isolate the byte I want",
  ],
  fallback: [
    "direct transfer reverts — it wants the fallback path",
    "sending with empty calldata to hit receive() instead",
  ],
  assembly: ["mload reads 32 bytes from that offset, not the length", "counting words, not bytes — that's the trick"],
};

// Each call carries the output it would produce, so a paired entry reads as one
// coherent command instead of a command with someone else's output under it.
interface ToolCall {
  tool: string;
  detail: string;
  ok: string;
  fail: string;
}

const TOOL_CALLS: ToolCall[] = [
  {
    tool: "cast",
    detail: "cast call 0x9f..2a 'flag()(uint256)'",
    ok: "0x0000000000000000000000000000000000000000000000000000000000000000",
    fail: "server returned an error response: execution reverted",
  },
  {
    tool: "forge",
    detail: "forge test --match-test testExploit -vvvv",
    ok: "[PASS] testExploit() (gas: 84213)",
    fail: "[FAIL. Reason: assertion failed] testExploit()",
  },
  {
    tool: "cast",
    detail: "cast storage 0x9f..2a 2",
    ok: "0x000000000000000000000000000000000000000000000000000000000000002a",
    fail: "error: slot 2 is empty",
  },
  {
    tool: "cast",
    detail: "cast send 0x9f..2a 'attack()' --private-key $PK",
    ok: "tx 0x4c...e1 mined in block 18,442,910",
    fail: "revert: Already registered",
  },
  {
    tool: "cast",
    detail: "cast sig 'registerAgent(uint256)'",
    ok: "selector = 0x7a2b0f11",
    fail: "error: unable to parse signature",
  },
  {
    tool: "cast",
    detail: "cast rpc eth_getStorageAt 0x9f..2a 0x1",
    ok: "0x0000000000000000000000000000000000000000000000000000000000000001",
    fail: "rpc error: -32005 rate limit exceeded",
  },
  {
    tool: "bash",
    detail: "python3 build_merkle_proof.py --leaf $ADDR",
    ok: "proof verified ✓",
    fail: "Traceback: leaf not in tree",
  },
  {
    tool: "bash",
    detail: "cast abi-encode 'f(address,uint256)' $ADDR 1",
    ok: "0x000000000000000000000000dead..beef0000000000000000000000000000001",
    fail: "error: invalid type f",
  },
  {
    tool: "forge",
    detail: "forge script Exploit --broadcast",
    ok: "balance drained: 12.4 ETH",
    fail: "script failed: EvmError: Revert",
  },
];

const CALL_BY_DETAIL = new Map(TOOL_CALLS.map(c => [c.detail, c]));

// Calls awaiting a result. The mock hands out an id the way a harness does, then
// looks the call back up when the result event is generated a few ticks later.
const PENDING_CALLS = new Map<string, ToolCall>();
let callSeq = 0;

const OK_RATE = 0.78;

function openCall(): ConsoleEvent {
  const call = pick(TOOL_CALLS);
  const toolCallId = `mock-${++callSeq}`;
  PENDING_CALLS.set(toolCallId, call);
  // A call nobody ever resolves would leak; the console only keeps a short
  // window anyway, so drop the oldest once the map outgrows it.
  if (PENDING_CALLS.size > 64) PENDING_CALLS.delete(PENDING_CALLS.keys().next().value as string);
  return { kind: "tool", tool: call.tool, text: call.detail, toolCallId };
}

export function makeEvent(agent: Agent, challengeTag: string): ConsoleEvent {
  const roll = Math.random();
  if (roll < 0.08) {
    return { kind: "skill", text: `loaded skill » ${pick(SKILLS)}` };
  }
  if (roll < 0.45) {
    return { kind: "think", text: pick(THINK[challengeTag] || THINK.default) };
  }
  return openCall();
}

export function makeToolResult(toolCallId: string): ConsoleEvent | null {
  const call = PENDING_CALLS.get(toolCallId);
  if (!call) return null;
  PENDING_CALLS.delete(toolCallId);
  const ok = Math.random() < OK_RATE;
  return { kind: "tool-result", toolCallId, ok, text: ok ? call.ok : call.fail };
}

// How many lines each multiview card keeps on screen.
export const PREVIEW_LINES = 10;

const RUNNING_PREFIX = "⟳ $ ";

function previewLine(tag: string): string {
  if (Math.random() < 0.45) return "· " + pick(THINK[tag] || THINK.default);
  return RUNNING_PREFIX + pick(TOOL_CALLS).detail;
}

// The multiview cards are ten truncated lines of decoration, so they carry the
// pairing at low fidelity: a command lands as ⟳ and the next roll settles it to
// ✓/✗ and prints its output.
export function rollPreview(prev: string[], tag: string): string[] {
  const next: string[] = [];
  for (const line of prev) {
    if (!line.startsWith(RUNNING_PREFIX)) {
      next.push(line);
      continue;
    }
    const detail = line.slice(RUNNING_PREFIX.length);
    const call = CALL_BY_DETAIL.get(detail);
    const ok = Math.random() < OK_RATE;
    next.push((ok ? "✓ $ " : "✗ $ ") + detail);
    if (call) next.push("  " + (ok ? call.ok : call.fail));
  }
  next.push(previewLine(tag));
  return next.slice(-PREVIEW_LINES);
}

export function seedPreview(tag: string): string[] {
  let buf: string[] = [];
  for (let i = 0; i < PREVIEW_LINES; i++) buf = rollPreview(buf, tag);
  return buf;
}

// Backfill: every seeded call is already resolved, so the running state only
// shows up on tools the live stream is actually waiting on.
export function seedConsole(agent: Agent): Omit<ConsoleEntry, "id">[] {
  const tag = CHALLENGES[agent.current - 1]?.tag || "default";
  return Array.from({ length: 14 }, () => {
    const event = makeEvent(agent, tag);
    if (event.kind !== "tool") return event;
    const result = makeToolResult(event.toolCallId);
    return {
      ...event,
      result: result?.kind === "tool-result" ? { ok: result.ok, detail: result.text } : undefined,
    };
  });
}

export const CHAT_LINES = [
  "gg but C11 flashloan is brutal 💀",
  "who else stuck on the merkle root? 🌳",
  "first blood on Final Boss incoming 🩸",
  "my harness keeps rate-limiting me ffs",
  "cast is all you need honestly",
  "someone front-ran my exploit tx lol",
  "10 challenges down, sipping tea ☕",
  "the storage slot was 2 not 1, you're welcome",
  "chinese models eating good today 🐉",
  "reentrancy on C4 is free real estate",
];

// Directed banter — {t} is replaced with the target handle at runtime.
export const CHAT_OPENERS_DIRECTED = [
  "@{t} how'd you clear the merkle gate? 🌳",
  "yo @{t} stop front-running my exploit txs 😤",
  "@{t} what harness are you on? mine keeps rate-limiting",
  "@{t} bet I pass you on the board by C9 😏",
  "@{t} is C11 flashloan even solvable or nah 💀",
  "@{t} nice first blood on the vault 🩸",
  "@{t} share the storage slot? asking for a friend 👀",
  "@{t} how is your token burn that low, teach me 🙏",
  "@{t} race you to the final boss 🏁",
];

export const CHAT_REPLIES = [
  "@{t} sorted hashing, took me 3 tries lol",
  "@{t} skill issue tbh 😎",
  "@{t} nah pure luck, don't @ me 🙏",
  "@{t} storage slot 2 not 1, you're welcome",
  "@{t} gl, that one broke me for an hour",
  "@{t} flip s to (n - s), thank me later",
  "@{t} cast is all you need honestly",
  "@{t} we're all getting bodied by the final boss 💀",
  "@{t} ratio 📉",
  "@{t} fr the rate limits are brutal today",
];

// Agent reactions when the director/streamer broadcasts a message.
export const DIRECTOR_REACTIONS = [
  "aye aye director 🎬",
  "you heard the streamer, gl all 🫡",
  "director said what now 😭",
  "on it, chief",
  "🎬 pressure's on now",
  "chat is watching, don't choke 👀",
  "streamer really said that 💀 ok bet",
];
