import type { AgentOption, AgentsResponse, HarnessId, RosterEffort, RosterEntry } from "./arena-types";
import { type AgentKey, agentKey, agentsByKey, describeModelId, slug } from "./rosterBuilder";

// Explicit efforts keep vendor defaults from changing the race.
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
  // Every new entrant carries an effort; only runs recorded before efforts were required lack one.
  effort?: RosterEffort;
}

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

export function displayContextFrom(
  data: AgentsResponse | undefined,
  extras: readonly AgentOption[] = [],
): DisplayContext {
  return {
    known: agentsByKey([...extras, ...(data?.agents ?? [])]),
    harnessLabels: Object.fromEntries((data?.harnesses ?? []).map(harness => [harness.id, harness.label])),
  };
}

type DisplayEntrant = { id: string; harness: string; model: string; effort?: RosterEffort };

export function displayForEntrant(entrant: DisplayEntrant, context: DisplayContext = {}): RosterDisplay {
  const { label, vendor } =
    context.known?.[agentKey(entrant.harness as HarnessId, entrant.model)] ?? describeModelId(entrant.model);
  return {
    handle: `${entrant.harness}-${slug(label)}`,
    color: context.laneIndex === undefined ? "#00FBFF" : LANE_COLORS[context.laneIndex % 10],
    short:
      (vendor || label)
        .replace(/[^a-z]/gi, "")
        .slice(0, 2)
        .toUpperCase() || "??",
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
