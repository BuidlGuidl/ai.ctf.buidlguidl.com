import { useEffect, useState } from "react";
import type { HarnessId } from "./arena-types";
import { arenaClient } from "./client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useAgents() {
  return useQuery({
    queryKey: ["arenaAgents"],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => arenaClient.getAgents(signal),
  });
}

export function useAgentSearch(harness: HarnessId, q: string) {
  return useQuery({
    queryKey: ["arenaAgentSearch", harness, q],
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
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
