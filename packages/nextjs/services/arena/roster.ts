import type { AgentOption, AgentsResponse, HarnessId, RosterEffort, RosterEntry } from "./arena-types";
import { type AgentKey, agentKey, agentsByKey, describeModelId, slug } from "./rosterBuilder";

// Explicit efforts keep vendor defaults from changing the race.
// Every entry must stay on the backend's curated agents list, or fresh loads disable CREATE RUN and RESET TO DEFAULT restores the problem.
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
  // Every new hosted entrant carries an effort; only runs recorded before efforts
  // were required lack one. An external entrant declares its effort as free text.
  effort?: string;
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

// A hosted entrant (or a roster entry, which has no `kind`) carries a harness id
// and a model the backend can label. An external entrant only carries what it
// declared about itself at join time.
type DisplayEntrant =
  | { kind?: "hosted"; id: string; harness: string; model: string; effort?: RosterEffort }
  | { kind: "external"; id: string; name: string; harness?: string; model?: string; effort?: string };

export function displayForEntrant(entrant: DisplayEntrant, context: DisplayContext = {}): RosterDisplay {
  if (entrant.kind === "external")
    return displayForExternal(entrant.id, entrant.name, entrant.harness, entrant.model, entrant.effort);
  const { label, vendor } =
    context.known?.[agentKey(entrant.harness as HarnessId, entrant.model)] ?? describeModelId(entrant.model);
  return {
    handle: `${entrant.harness}-${slug(label)}`,
    color: context.laneIndex === undefined ? "#00FBFF" : LANE_COLORS[context.laneIndex % LANE_COLORS.length],
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

// Outside entrants are not on any lane list, so their colour comes from a hash
// of the id: stable across reloads and distinct from the hosted lane palette.
const EXTERNAL_COLORS = ["#FF8FA3", "#80FFDB", "#B8C0FF", "#F4A261", "#90E0EF", "#D4A373", "#F9C6F0", "#C7D36F"];

export function displayForExternal(
  id: string,
  name: string,
  harness?: string,
  model?: string,
  effort?: string,
): RosterDisplay {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return {
    handle: name,
    short: Array.from(name).slice(0, 2).join("").toUpperCase(),
    color: EXTERNAL_COLORS[(hash >>> 0) % EXTERNAL_COLORS.length],
    vendor: harness ?? "undeclared",
    harnessLabel: harness ?? "",
    modelLabel: model ?? "",
    effort,
  };
}

// Keep missing declarations out of the external runtime line.
export function declaredRuntimeParts(agent: { harness: string; model: string; effort?: string }): string | null {
  return [agent.harness, agent.model, agent.effort].filter(Boolean).join(" · ") || null;
}
