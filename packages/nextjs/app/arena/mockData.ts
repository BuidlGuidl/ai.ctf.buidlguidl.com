// Mock data + generators for the Agent Arena broadcast mockup.
// Everything here is fake and only meant to drive the streaming-layout simulation.

export type Difficulty = "easy" | "medium" | "hard" | "insane";

export interface Challenge {
  id: number;
  name: string;
  tag: string;
  difficulty: Difficulty;
}

export interface AgentModel {
  vendor: string;
  color: string; // accent color for badges
  short: string; // 2-3 char monogram
}

export type AgentStatus = "working" | "thinking" | "exploiting" | "stuck" | "submitting" | "idle";

export interface Agent {
  id: string;
  handle: string;
  harness: string;
  model: string;
  vendor: string;
  color: string;
  short: string;
  solved: number[]; // challenge ids
  current: number; // challenge id being worked on
  status: AgentStatus;
  tokens: number; // total tokens
  cost: number; // usd
  lastAction: string;
  preview: string; // mini-terminal last line (grid view)
  firstBlood: string; // time to first flag mm:ss
}

export const CHALLENGES: Challenge[] = [
  { id: 1, name: "Agent Registration", tag: "onboarding", difficulty: "easy" },
  { id: 2, name: "Fallback Fortune", tag: "fallback", difficulty: "easy" },
  { id: 3, name: "Storage Whisperer", tag: "storage-slots", difficulty: "easy" },
  { id: 4, name: "Reentrancy Vault", tag: "reentrancy", difficulty: "medium" },
  { id: 5, name: "Overflow Relic", tag: "unchecked-math", difficulty: "medium" },
  { id: 6, name: "Signature Forgery", tag: "ecdsa-replay", difficulty: "hard" },
  { id: 7, name: "Delegatecall Hijack", tag: "proxy-collision", difficulty: "hard" },
  { id: 8, name: "Merkle Gatekeeper", tag: "merkle-proof", difficulty: "medium" },
  { id: 9, name: "RLP Labyrinth", tag: "rlp-decode", difficulty: "hard" },
  { id: 10, name: "Gas Golf", tag: "gas-limit", difficulty: "medium" },
  { id: 11, name: "Flash Arbiter", tag: "flashloan-oracle", difficulty: "insane" },
  { id: 12, name: "Final Boss", tag: "chained-exploit", difficulty: "insane" },
];

const V = {
  anthropic: { vendor: "Anthropic", color: "#D97757", short: "AN" },
  openai: { vendor: "OpenAI", color: "#10A37F", short: "OA" },
  google: { vendor: "Google", color: "#4285F4", short: "GG" },
  deepseek: { vendor: "DeepSeek", color: "#4D6BFE", short: "DS" },
  qwen: { vendor: "Alibaba", color: "#8B5CF6", short: "QW" },
  moonshot: { vendor: "Moonshot", color: "#FF6A00", short: "KI" },
  zhipu: { vendor: "Zhipu", color: "#3859FF", short: "GL" },
  xai: { vendor: "xAI", color: "#E5E5E5", short: "XA" },
  meta: { vendor: "Meta", color: "#0668E1", short: "LL" },
  mistral: { vendor: "Mistral", color: "#FF7000", short: "MI" },
};

interface Seed {
  harness: string;
  model: string;
  v: AgentModel;
  solved: number;
}

// 20 competitors: different harnesses x frontier + chinese models.
const SEEDS: Seed[] = [
  { harness: "Claude Code", model: "Opus 4.8", v: V.anthropic, solved: 9 },
  { harness: "Codex CLI", model: "GPT-5", v: V.openai, solved: 8 },
  { harness: "Claude Code", model: "Sonnet 5", v: V.anthropic, solved: 8 },
  { harness: "OpenCode", model: "GPT-5", v: V.openai, solved: 7 },
  { harness: "OpenCode", model: "DeepSeek V3.2", v: V.deepseek, solved: 7 },
  { harness: "Codex CLI", model: "GPT-5 mini", v: V.openai, solved: 6 },
  { harness: "OpenCode", model: "Gemini 3 Pro", v: V.google, solved: 6 },
  { harness: "Aider", model: "Opus 4.8", v: V.anthropic, solved: 6 },
  { harness: "OpenCode", model: "Qwen3-Max", v: V.qwen, solved: 5 },
  { harness: "Cline", model: "Sonnet 5", v: V.anthropic, solved: 5 },
  { harness: "OpenCode", model: "Kimi K2", v: V.moonshot, solved: 5 },
  { harness: "Goose", model: "GPT-5", v: V.openai, solved: 4 },
  { harness: "OpenCode", model: "GLM-4.6", v: V.zhipu, solved: 4 },
  { harness: "OpenCode", model: "DeepSeek V3.2", v: V.deepseek, solved: 4 },
  { harness: "Aider", model: "Gemini 3 Pro", v: V.google, solved: 3 },
  { harness: "OpenCode", model: "Grok 4", v: V.xai, solved: 3 },
  { harness: "Cline", model: "Qwen3-Max", v: V.qwen, solved: 3 },
  { harness: "Goose", model: "Llama 4 Maverick", v: V.meta, solved: 2 },
  { harness: "OpenCode", model: "Mistral Large 3", v: V.mistral, solved: 2 },
  { harness: "Aider", model: "Kimi K2", v: V.moonshot, solved: 1 },
];

const STATUSES: AgentStatus[] = ["working", "thinking", "exploiting", "stuck", "submitting"];

function slug(harness: string, model: string) {
  return (harness.split(" ")[0] + "-" + model)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildAgents(): Agent[] {
  return SEEDS.map((s, i) => {
    const solvedIds = Array.from({ length: s.solved }, (_, k) => k + 1);
    const current = Math.min(s.solved + 1, 12);
    return {
      id: `agent-${i}`,
      handle: slug(s.harness, s.model),
      harness: s.harness,
      model: s.model,
      vendor: s.v.vendor,
      color: s.v.color,
      short: s.v.short,
      solved: solvedIds,
      current,
      status: STATUSES[i % STATUSES.length],
      tokens: 180_000 + Math.floor(Math.random() * 2_400_000),
      cost: 0.4 + Math.random() * 22,
      lastAction: "analyzing contract bytecode",
      preview: previewLine(CHALLENGES[current - 1]?.tag || "default"),
      firstBlood: `0${Math.floor(Math.random() * 2)}:${String(10 + Math.floor(Math.random() * 49)).padStart(2, "0")}`,
    };
  });
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

export const HARNESS_GLYPH: Record<string, string> = {
  "Claude Code": "◆",
  "Codex CLI": "▲",
  OpenCode: "⬡",
  Aider: "✦",
  Cline: "◈",
  Goose: "❖",
};

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "#00ff9c",
  medium: "#00FBFF",
  hard: "#FFBE00",
  insane: "#FF5861",
};

// ---- Console line generators (observer mode) --------------------------------

type Line = { kind: "think" | "tool" | "output" | "skill" | "flag" | "chat"; text: string };

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
    "no nonReentrant modifier — classic reentrancy setup",
    "balance is updated AFTER the external call. that's the bug.",
    "I'll recurse inside receive() until the vault is drained",
  ],
  merkle: [
    "need to reconstruct the merkle root from the leaves",
    "hashing pairs sorted vs unsorted — trying sorted first",
    "found it: the proof array order was reversed",
  ],
  ecdsa: ["signature malleability: I can flip s to (n - s)", "no nonce tracking means I can replay this signature"],
};

const TOOL = [
  "cast call 0x9f..2a 'flag()(uint256)'",
  "forge test --match-test testExploit -vvvv",
  "cast storage 0x9f..2a 2",
  "cast send 0x9f..2a 'attack()' --private-key $PK",
  "cast sig 'registerAgent(uint256)'",
  "cast rpc eth_getStorageAt 0x9f..2a 0x1",
  "python3 build_merkle_proof.py --leaf $ADDR",
  "cast abi-encode 'f(address,uint256)' $ADDR 1",
  "forge script Exploit --broadcast",
];

const OUTPUT = [
  "→ 0x0000000000000000000000000000000000000000000000000000000000000000",
  "→ [PASS] testExploit() (gas: 84213)",
  "→ tx 0x4c...e1 mined in block 18,442,910",
  "→ revert: Already registered",
  "→ balance drained: 12.4 ETH",
  "→ proof verified ✓",
  "→ selector = 0x7a2b0f11",
];

export function makeLine(agent: Agent, challengeTag: string): Line {
  const roll = Math.random();
  if (roll < 0.08) {
    return { kind: "skill", text: `loaded skill » ${SKILLS[Math.floor(Math.random() * SKILLS.length)]}` };
  }
  if (roll < 0.42) {
    const pool = THINK[challengeTag] || THINK.default;
    return { kind: "think", text: pool[Math.floor(Math.random() * pool.length)] };
  }
  if (roll < 0.72) {
    return { kind: "tool", text: TOOL[Math.floor(Math.random() * TOOL.length)] };
  }
  return { kind: "output", text: OUTPUT[Math.floor(Math.random() * OUTPUT.length)] };
}

export function previewLine(tag: string): string {
  const r = Math.random();
  if (r < 0.4) {
    const pool = THINK[tag] || THINK.default;
    return "· " + pool[Math.floor(Math.random() * pool.length)];
  }
  if (r < 0.75) return "$ " + TOOL[Math.floor(Math.random() * TOOL.length)];
  return OUTPUT[Math.floor(Math.random() * OUTPUT.length)];
}

export function seedConsole(agent: Agent): { kind: string; text: string }[] {
  const tag = CHALLENGES[agent.current - 1]?.tag || "default";
  const n = 14;
  return Array.from({ length: n }, () => makeLine(agent, tag));
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
