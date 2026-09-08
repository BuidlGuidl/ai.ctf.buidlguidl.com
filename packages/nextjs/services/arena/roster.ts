import type { AgentOption, HarnessId, RosterEffort, RosterEntry } from "./arena-types";
import { type AgentKey, agentKey, describeModelId, slug } from "./rosterBuilder";

// Every preset pins an explicit effort so the label states what the entrant runs and
// vendor-default drift can't change a race. Claude's "high" is its documented default;
// opencode levels are an explicit override (openrouter caps that harness at high).
export const DEFAULT_ROSTER: readonly RosterEntry[] = [
  { id: "opus-5", harness: "claude", model: "claude-opus-5", effort: "high" },
  { id: "glm-53", harness: "opencode", model: "openrouter/z-ai/glm-5.3", effort: "high" },
  { id: "gpt-55", harness: "codex", model: "gpt-5.5", effort: "high" },
  { id: "sonnet-5", harness: "claude", model: "claude-sonnet-5", effort: "high" },
  { id: "kimi-k3", harness: "opencode", model: "openrouter/moonshotai/kimi-k3", effort: "high" },
  { id: "opus-48", harness: "claude", model: "claude-opus-4-8", effort: "high" },
  { id: "deepseek-v4-pro", harness: "opencode", model: "openrouter/deepseek/deepseek-v4-pro-0813", effort: "high" },
  { id: "qwen38-24t", harness: "opencode", model: "openrouter/qwen/qwen3.8-2.4t-a95b", effort: "high" },
  { id: "gpt-55-xhigh", harness: "codex", model: "gpt-5.5", effort: "xhigh" },
  { id: "gpt-55-medium", harness: "codex", model: "gpt-5.5", effort: "medium" },
];

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

export const LEGACY_DISPLAY: Readonly<Record<string, RosterDisplay>> = {
  "opus-5": {
    effort: "high",
    handle: "claude-opus-5",
    color: "#2DD4BF",
    short: "AN",
    vendor: "Anthropic",
    harnessLabel: "Claude Code",
    modelLabel: "Opus 5",
  },
  "glm-53": {
    effort: "high",
    handle: "opencode-glm-53",
    color: "#FFE14D",
    short: "GL",
    vendor: "Z.ai",
    harnessLabel: "OpenCode",
    modelLabel: "GLM-5.3",
  },
  "gpt-55": {
    effort: "high",
    handle: "codex-gpt-55",
    color: "#A855F7",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.5",
  },
  "sonnet-5": {
    effort: "high",
    handle: "claude-sonnet-5",
    color: "#22C55E",
    short: "AN",
    vendor: "Anthropic",
    harnessLabel: "Claude Code",
    modelLabel: "Sonnet 5",
  },
  "kimi-k3": {
    effort: "high",
    handle: "opencode-kimi-k3",
    color: "#FF9F1C",
    short: "KI",
    vendor: "Moonshot",
    harnessLabel: "OpenCode",
    modelLabel: "Kimi K3",
  },
  "opus-48": {
    effort: "high",
    handle: "claude-opus-48",
    color: "#60A5FA",
    short: "AN",
    vendor: "Anthropic",
    harnessLabel: "Claude Code",
    modelLabel: "Opus 4.8",
  },
  "deepseek-v4-pro": {
    effort: "high",
    handle: "opencode-deepseek-v4-pro",
    color: "#EC4899",
    short: "DS",
    vendor: "DeepSeek",
    harnessLabel: "OpenCode",
    modelLabel: "DeepSeek V4 Pro",
  },
  "qwen38-24t": {
    effort: "high",
    handle: "opencode-qwen38-24t",
    color: "#A3E635",
    short: "QW",
    vendor: "Alibaba",
    harnessLabel: "OpenCode",
    modelLabel: "Qwen3.8 2.4T",
  },
  // Outside the default race; kept so finished runs that included them still render.
  "glm-52": {
    handle: "opencode-glm-52",
    color: "#FFE14D",
    short: "GL",
    vendor: "Z.ai",
    harnessLabel: "OpenCode",
    modelLabel: "GLM-5.2",
  },
  "qwen38-27b": {
    handle: "opencode-qwen38-27b",
    color: "#A3E635",
    short: "QW",
    vendor: "Alibaba",
    harnessLabel: "OpenCode",
    modelLabel: "Qwen3.8 27B",
  },
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
    effort: "xhigh",
    handle: "codex-gpt-55",
    color: "#E2E8F0",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.5",
  },
  "gpt-55-medium": {
    effort: "medium",
    handle: "codex-gpt-55",
    color: "#C5A5D7",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.5",
  },
};

export const LANE_COLORS = [
  "#2DD4BF",
  "#FFE14D",
  "#A855F7",
  "#22C55E",
  "#FF9F1C",
  "#60A5FA",
  "#EC4899",
  "#A3E635",
  "#E2E8F0",
  "#C5A5D7",
];

export interface DisplayContext {
  known?: Record<AgentKey, AgentOption>;
  harnessLabels?: Record<string, string>;
  laneIndex?: number;
}

type DisplayEntrant = { id: string; harness: string; model: string; effort?: RosterEffort };

export function displayForEntrant(entrant: DisplayEntrant, context: DisplayContext = {}): RosterDisplay {
  const legacy = LEGACY_DISPLAY[entrant.id];
  if (legacy) return { ...legacy, effort: entrant.effort ?? legacy.effort };
  const { label, vendor } =
    context.known?.[agentKey(entrant.harness as HarnessId, entrant.model)] ?? describeModelId(entrant.model);
  return {
    handle: `${entrant.harness}-${slug(label)}`,
    color: context.laneIndex === undefined ? "#00FBFF" : LANE_COLORS[context.laneIndex % 10],
    short: (vendor || label).slice(0, 2).toUpperCase(),
    vendor,
    harnessLabel: context.harnessLabels?.[entrant.harness] ?? entrant.harness,
    modelLabel: label,
    effort: entrant.effort,
  };
}

export function displayMapForEntrants(
  entrants: readonly DisplayEntrant[],
  context?: Omit<DisplayContext, "laneIndex">,
): Record<string, RosterDisplay> {
  return Object.fromEntries(
    entrants.map((entrant, laneIndex) => [entrant.id, displayForEntrant(entrant, { ...context, laneIndex })]),
  );
}
