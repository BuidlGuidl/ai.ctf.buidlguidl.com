import type {
  AgentOption,
  HarnessId,
  HarnessInfo,
  RosterEffort,
  RosterEntry,
  ValidationErrorResponse,
} from "./arena-types";

export interface RosterPick {
  id?: string;
  harness: HarnessId;
  model: string;
  effort: RosterEffort;
}
export type AgentKey = string;
export interface RosterProblem {
  index: number | null;
  message: string;
}
export const MAX_ROSTER = 10;
export const ENTRANT_ID_MAX = 20;

export function agentKey(harness: HarnessId, model: string): AgentKey {
  return `${harness}:${model}`;
}
export function agentsByKey(agents: readonly AgentOption[]): Record<AgentKey, AgentOption> {
  return Object.fromEntries(agents.map(agent => [agentKey(agent.harness, agent.model), agent]));
}
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
export function picksFromRoster(entries: readonly RosterEntry[]): RosterPick[] {
  return entries.map(entry => ({ ...entry }));
}
export function buildRoster(picks: readonly RosterPick[]): RosterEntry[] {
  // Reserve saved ids before generating others so an edit cannot rename an untouched slot.
  const used = new Set(picks.flatMap(pick => (pick.id === undefined ? [] : [pick.id])));
  const counts = new Map<AgentKey, number>();
  picks.forEach(pick => {
    const key = agentKey(pick.harness, pick.model);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return picks.map(pick => {
    if (pick.id !== undefined) return { ...pick, id: pick.id };
    let base = slug(pick.model.split("/").at(-1) ?? "");
    if (!/^[a-z]/.test(base)) base = `${pick.harness}-${base}`;
    const effortSuffix = (counts.get(agentKey(pick.harness, pick.model)) ?? 0) > 1 ? `-${pick.effort}` : "";
    const candidate = (suffix: string) => base.slice(0, ENTRANT_ID_MAX - suffix.length).replace(/-+$/, "") + suffix;
    let id = candidate(effortSuffix);
    if (id === "run") id = "run-1";
    let counter = 2;
    while (used.has(id)) id = candidate(`${effortSuffix}-${counter++}`);
    used.add(id);
    return { ...pick, id };
  });
}
export function validateRoster(
  picks: readonly RosterPick[],
  harnesses: readonly HarnessInfo[],
  curated: Record<AgentKey, AgentOption>,
  known: Record<AgentKey, AgentOption>,
): RosterProblem[] {
  const problems: RosterProblem[] = [];
  if (!picks.length) problems.push({ index: null, message: "Add at least one agent" });
  if (picks.length > MAX_ROSTER) problems.push({ index: null, message: "At most 10 agents" });
  picks.forEach((pick, index) => {
    const add = (message: string) => problems.push({ index, message });
    if (!pick.model.trim()) add(`Choose a model for slot ${index + 1}`);
    if (!pick.effort) add(`Choose an effort for slot ${index + 1}`);
    if (!pick.model.trim()) return;
    const harness = harnesses.find(item => item.id === pick.harness);
    const key = agentKey(pick.harness, pick.model);
    const curatedAgent = curated[key];
    const agent = curatedAgent ?? known[key];
    if (!curatedAgent) {
      if (pick.harness === "opencode" && harness?.customModels) {
        if (!pick.model.startsWith("openrouter/")) add("OpenCode custom models must start with openrouter/");
      } else add(`${harness?.label ?? pick.harness} does not run ${pick.model}`);
    }
    if (agent && pick.effort && !agent.efforts.includes(pick.effort))
      add(`Effort ${pick.effort} is not available for ${pick.model}`);
  });
  const ids = new Set<string>();
  buildRoster(picks).forEach((entry, index) => {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id) || entry.id.length > ENTRANT_ID_MAX || entry.id === "run")
      problems.push({ index, message: `Choose a valid entrant id for slot ${index + 1}` });
    if (ids.has(entry.id)) problems.push({ index, message: `Choose a unique entrant id for slot ${index + 1}` });
    ids.add(entry.id);
  });
  return problems;
}
export function describeModelId(model: string): { label: string; vendor: string } {
  const parts = model.split("/");
  return parts[0] === "openrouter" && parts.length >= 3
    ? { vendor: parts[1], label: parts.slice(2).join("/") }
    : { vendor: "", label: model };
}
export function issuesToProblems(issues: ValidationErrorResponse["issues"]): RosterProblem[] {
  return issues.map(({ path, message }) => ({
    index: path[0] === "roster" && typeof path[1] === "number" ? path[1] : null,
    message,
  }));
}
