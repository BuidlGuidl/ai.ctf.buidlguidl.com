import type { RosterEntry } from "./arena-types";

export const ROSTER = [
  { id: "gpt-56-sol", harness: "codex", model: "gpt-5.6-sol", effort: "xhigh" },
  { id: "opus-5", harness: "claude", model: "claude-opus-5" },
  { id: "glm-52", harness: "opencode", model: "openrouter/z-ai/glm-5.2" },
  { id: "gpt-55", harness: "codex", model: "gpt-5.5", effort: "high" },
  { id: "sonnet-5", harness: "claude", model: "claude-sonnet-5" },
  { id: "kimi-k3", harness: "opencode", model: "openrouter/moonshotai/kimi-k3" },
  { id: "opus-48", harness: "claude", model: "claude-opus-4-8" },
  { id: "deepseek-v4", harness: "opencode", model: "openrouter/deepseek/deepseek-v4-flash-0731" },
  { id: "gpt-56-high", harness: "codex", model: "gpt-5.6-sol", effort: "high" },
  { id: "gpt-55-xhigh", harness: "codex", model: "gpt-5.5", effort: "xhigh" },
] as const satisfies readonly RosterEntry[];

export interface RosterDisplay {
  handle: string;
  color: string;
  short: string;
  vendor: string;
  harnessLabel: string;
  modelLabel: string;
}

export const ROSTER_DISPLAY: Readonly<Record<string, RosterDisplay>> = {
  "gpt-56-sol": {
    handle: "codex-gpt-56-sol",
    color: "#FF5C5C",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.6 Sol",
  },
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
  "deepseek-v4": {
    handle: "opencode-deepseek-v4",
    color: "#EC4899",
    short: "DS",
    vendor: "DeepSeek",
    harnessLabel: "OpenCode",
    modelLabel: "DeepSeek V4 Flash",
  },
  "gpt-56-high": {
    handle: "codex-gpt-56-high",
    color: "#A3E635",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.6 Sol · high",
  },
  "gpt-55-xhigh": {
    handle: "codex-gpt-55-xhigh",
    color: "#E2E8F0",
    short: "OA",
    vendor: "OpenAI",
    harnessLabel: "Codex CLI",
    modelLabel: "GPT-5.5 · xhigh",
  },
};

export function displayForEntrant(id: string, harness: string, model: string): RosterDisplay {
  return (
    ROSTER_DISPLAY[id] ?? {
      handle: id,
      color: "#00FBFF",
      short: harness.slice(0, 2).toUpperCase(),
      vendor: harness,
      harnessLabel: harness,
      modelLabel: model,
    }
  );
}
