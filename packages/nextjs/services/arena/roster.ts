import type { RosterEffort, RosterEntry } from "./arena-types";

// Every preset pins an explicit effort so the label states what the entrant runs and
// vendor-default drift can't change a race. Claude's "high" is its documented default;
// opencode levels are an explicit override (openrouter caps that harness at high).
export const ROSTER = [
  { id: "opus-5", harness: "claude", model: "claude-opus-5", effort: "high" },
  { id: "glm-52", harness: "opencode", model: "openrouter/z-ai/glm-5.2", effort: "high" },
  { id: "gpt-55", harness: "codex", model: "gpt-5.5", effort: "high" },
  { id: "sonnet-5", harness: "claude", model: "claude-sonnet-5", effort: "high" },
  { id: "kimi-k3", harness: "opencode", model: "openrouter/moonshotai/kimi-k3", effort: "high" },
  { id: "opus-48", harness: "claude", model: "claude-opus-4-8", effort: "high" },
  { id: "deepseek-v4-pro", harness: "opencode", model: "openrouter/deepseek/deepseek-v4-pro-0813", effort: "high" },
  { id: "qwen38-27b", harness: "opencode", model: "openrouter/qwen/qwen3.8-27b", effort: "high" },
  { id: "gpt-55-xhigh", harness: "codex", model: "gpt-5.5", effort: "xhigh" },
  { id: "gpt-55-medium", harness: "codex", model: "gpt-5.5", effort: "medium" },
] as const satisfies readonly RosterEntry[];

export interface RosterDisplay {
  handle: string;
  color: string;
  short: string;
  vendor: string;
  harnessLabel: string;
  modelLabel: string;
  // Absent for harnesses that expose no effort setting — the UI then shows no badge.
  effort?: RosterEffort;
}

export const ROSTER_DISPLAY: Readonly<Record<string, RosterDisplay>> = {
  "opus-5": {
    handle: "claude-opus-5",
    color: "#2DD4BF",
    short: "AN",
    vendor: "Anthropic",
    harnessLabel: "Claude Code",
    modelLabel: "Opus 5",
  },
  "glm-52": {
    handle: "opencode-glm-52",
    color: "#FFE14D",
    short: "GL",
    vendor: "Zhipu",
    harnessLabel: "OpenCode",
    modelLabel: "GLM-5.2",
  },
  "gpt-55": {
    handle: "codex-gpt-55",
    color: "#A855F7",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.5",
  },
  "sonnet-5": {
    handle: "claude-sonnet-5",
    color: "#22C55E",
    short: "AN",
    vendor: "Anthropic",
    harnessLabel: "Claude Code",
    modelLabel: "Sonnet 5",
  },
  "kimi-k3": {
    handle: "opencode-kimi-k3",
    color: "#FF9F1C",
    short: "KI",
    vendor: "Moonshot",
    harnessLabel: "OpenCode",
    modelLabel: "Kimi K3",
  },
  "opus-48": {
    handle: "claude-opus-48",
    color: "#60A5FA",
    short: "AN",
    vendor: "Anthropic",
    harnessLabel: "Claude Code",
    modelLabel: "Opus 4.8",
  },
  "deepseek-v4-pro": {
    handle: "opencode-deepseek-v4-pro",
    color: "#EC4899",
    short: "DS",
    vendor: "DeepSeek",
    harnessLabel: "OpenCode",
    modelLabel: "DeepSeek V4 Pro",
  },
  "qwen38-27b": {
    handle: "opencode-qwen38-27b",
    color: "#A3E635",
    short: "QW",
    vendor: "Alibaba",
    harnessLabel: "OpenCode",
    modelLabel: "Qwen3.8 27B",
  },
  // Off the active lineup; kept so finished runs that included them still render.
  "deepseek-v4": {
    handle: "opencode-deepseek-v4",
    color: "#EC4899",
    short: "DS",
    vendor: "DeepSeek",
    harnessLabel: "OpenCode",
    modelLabel: "DeepSeek V4 Flash",
  },
  "opus-5-medium": {
    handle: "claude-opus-5",
    color: "#FF5C5C",
    short: "AN",
    vendor: "Anthropic",
    harnessLabel: "Claude Code",
    modelLabel: "Opus 5",
  },
  "gpt-55-xhigh": {
    handle: "codex-gpt-55",
    color: "#E2E8F0",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.5",
  },
  "gpt-55-medium": {
    handle: "codex-gpt-55",
    color: "#C5A5D7",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.5",
  },
};

const ROSTER_EFFORT_BY_ID: Readonly<Record<string, RosterEffort | undefined>> = Object.fromEntries(
  ROSTER.map(entry => [entry.id, "effort" in entry ? entry.effort : undefined]),
);

// The run reports what actually ran, so its effort wins when present; the preset
// pin covers runs that predate the backend carrying effort for this harness.
export function displayForEntrant(id: string, harness: string, model: string, effort?: RosterEffort): RosterDisplay {
  const preset = ROSTER_DISPLAY[id];
  if (preset) return { ...preset, effort: effort ?? ROSTER_EFFORT_BY_ID[id] };
  return {
    handle: id,
    color: "#00FBFF",
    short: harness.slice(0, 2).toUpperCase(),
    vendor: harness,
    harnessLabel: harness,
    modelLabel: model,
    effort,
  };
}
