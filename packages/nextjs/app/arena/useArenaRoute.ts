"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";

// Every arena view is a URL: `run` names the run, `view` picks the stage and
// `agent` opens an agent's observer. Written through the History API rather than
// the router because a stage change must not refetch the page — the race board
// keeps its FLIP positions, its finish sting and its scroll across a navigation.
//
// One rule for the history stack: anything the operator navigates to — entering a
// run, observing an agent, switching the stage — takes an entry, so back returns
// where they were. Only leaving a run for the lobby and transitions the page makes
// on its own (the podium taking over at the finish) replace.
export type ArenaView = "race" | "grid" | "results";

const ARENA_VIEWS: readonly string[] = ["race", "grid", "results"];

interface ArenaRouteUpdate {
  run?: string | null;
  view?: ArenaView | null;
  agent?: string | null;
}

export interface ArenaRoute {
  runId: string | null;
  // Null when the URL names no view, which is the caller's cue to pick the
  // default for the run's state — the board while it races, the podium once it
  // is locked. A view the user chose is always spelled out.
  view: ArenaView | null;
  agentId: string | null;
  go: (update: ArenaRouteUpdate, options?: { replace?: boolean }) => void;
}

export function useArenaRoute(): ArenaRoute {
  const params = useSearchParams();
  const runId = params.get("run");
  const agentId = params.get("agent");
  const viewParam = params.get("view");
  const view = viewParam !== null && ARENA_VIEWS.includes(viewParam) ? (viewParam as ArenaView) : null;

  const go = useCallback(
    (update: ArenaRouteUpdate, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(update)) {
        if (value === null) next.delete(key);
        else if (value !== undefined) next.set(key, value);
      }
      const search = next.toString();
      const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
      if (options?.replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [params],
  );

  return useMemo(() => ({ runId, view, agentId, go }), [agentId, go, runId, view]);
}
