import { useCallback, useEffect, useMemo, useState } from "react";
import { type AgentOption, HARNESS_IDS, ROSTER_EFFORTS } from "./arena-types";
import { DEFAULT_ROSTER } from "./roster";
import { ENTRANT_ID_MAX, type RosterPick, agentKey, picksFromRoster } from "./rosterBuilder";

const PICKS_STORAGE_KEY = "ai-ctf-arena:roster-picks";

function savedPick(value: unknown): value is RosterPick {
  if (!value || typeof value !== "object") return false;
  const pick = value as RosterPick;
  return (
    HARNESS_IDS.includes(pick.harness) &&
    typeof pick.model === "string" &&
    !!pick.model.trim() &&
    ROSTER_EFFORTS.includes(pick.effort)
  );
}

function savedAgent(value: unknown): value is AgentOption {
  if (!value || typeof value !== "object") return false;
  const agent = value as AgentOption;
  return (
    HARNESS_IDS.includes(agent.harness) &&
    typeof agent.model === "string" &&
    !!agent.model.trim() &&
    typeof agent.label === "string" &&
    typeof agent.vendor === "string" &&
    Array.isArray(agent.efforts) &&
    agent.efforts.length > 0 &&
    agent.efforts.every(effort => ROSTER_EFFORTS.includes(effort))
  );
}

export function useRosterPicks() {
  const [picks, setPicks] = useState<RosterPick[]>(() => picksFromRoster(DEFAULT_ROSTER));
  const [rawExtras, setRawExtras] = useState<AgentOption[]>([]);
  // Keep labels only for current picks without losing agents noted before their picks are set.
  const extras = useMemo(() => {
    const keys = new Set(picks.map(pick => agentKey(pick.harness, pick.model)));
    return rawExtras.filter(agent => keys.has(agentKey(agent.harness, agent.model)));
  }, [rawExtras, picks]);
  const [picksLoaded, setPicksLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PICKS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved &&
          Array.isArray(saved.picks) &&
          saved.picks.length <= 10 &&
          saved.picks.every(savedPick) &&
          Array.isArray(saved.extras) &&
          saved.extras.every(savedAgent)
        ) {
          const ids = new Set<string>();
          setPicks(
            saved.picks.map(({ harness, model, effort, id }: RosterPick) => {
              // Copy only supported fields because the backend rejects unknown keys.
              const pick: RosterPick = { harness, model, effort };
              if (
                typeof id !== "string" ||
                !/^[a-z][a-z0-9-]*$/.test(id) ||
                id.length > ENTRANT_ID_MAX ||
                id === "run" ||
                ids.has(id)
              ) {
                return pick;
              }
              ids.add(id);
              return { ...pick, id };
            }),
          );
          setRawExtras(saved.extras);
        }
      }
    } catch {
      // Storage can be unavailable; the default race remains usable.
    }
    setPicksLoaded(true);
  }, []);
  useEffect(() => {
    if (!picksLoaded) return;
    try {
      localStorage.setItem(PICKS_STORAGE_KEY, JSON.stringify({ picks, extras }));
    } catch {
      // A full or blocked store must not prevent editing.
    }
  }, [picks, extras, picksLoaded]);
  const noteAgent = useCallback(
    (option: AgentOption) =>
      setRawExtras(previous => [
        ...previous.filter(agent => agentKey(agent.harness, agent.model) !== agentKey(option.harness, option.model)),
        option,
      ]),
    [],
  );
  const reset = useCallback(() => setPicks(picksFromRoster(DEFAULT_ROSTER)), []);

  return { picks, setPicks, extras, noteAgent, reset };
}
