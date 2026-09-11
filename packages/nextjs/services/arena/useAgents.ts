import { useEffect, useState } from "react";
import type { HarnessId } from "./arena-types";
import { arenaClient } from "./client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useAgents() {
  return useQuery({
    queryKey: ["arenaAgents"],
    staleTime: 5 * 60_000,
    // One quick retry lets brief outages recover without delaying the error state.
    retry: 1,
    retryDelay: 1000,
    queryFn: ({ signal }) => arenaClient.getAgents(signal),
  });
}

export function useAgentSearch(harness: HarnessId, q: string) {
  return useQuery({
    queryKey: ["arenaAgentSearch", harness, q],
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    // The backend already backs off from OpenRouter for 30 seconds after a failure,
    // so retrying here only delays the "search is unavailable" message.
    retry: false,
    queryFn: ({ signal }) => arenaClient.searchAgents(harness, q, signal),
  });
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debouncedValue;
}
