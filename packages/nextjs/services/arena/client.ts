import type {
  BroadcastRequest,
  BroadcastResponse,
  CreateRunRequest,
  HistoryPage,
  NonceResponse,
  RestartResponse,
  RunListItem,
  RunListResponse,
  RunResponse,
  RunSnapshot,
  SessionResponse,
  SteerRequest,
  SteerResponse,
  VerifyRequest,
  VerifyResponse,
} from "./arena-types";

export const ARENA_BACKEND_URL = (process.env.NEXT_PUBLIC_ARENA_BACKEND_URL || "http://localhost:4177").replace(
  /\/$/,
  "",
);

export class ArenaApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly body: unknown = null) {
    super(message);
    this.name = "ArenaApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function arenaFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${ARENA_BACKEND_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message =
      typeof body?.error === "string" ? body.error : `Arena request failed with status ${response.status}`;
    throw new ArenaApiError(response.status, message, body);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function runFetch(path: string, options: RequestOptions = {}): Promise<RunSnapshot> {
  const response = await arenaFetch<RunResponse>(path, options);
  return response.run;
}

export const arenaClient = {
  getNonce: () => arenaFetch<NonceResponse>("/auth/nonce"),
  verify: (body: VerifyRequest) => arenaFetch<VerifyResponse>("/auth/verify", { method: "POST", body }),
  getSession: () => arenaFetch<SessionResponse>("/auth/session"),
  logout: () => arenaFetch<void>("/auth/logout", { method: "POST" }),
  createRun: (body: CreateRunRequest) => runFetch("/runs", { method: "POST", body }),
  listRuns: async (limit?: number, signal?: AbortSignal): Promise<RunListItem[]> => {
    const suffix = limit === undefined ? "" : `?limit=${limit}`;
    const response = await arenaFetch<RunListResponse>(`/runs${suffix}`, { signal });
    return response.runs;
  },
  getRun: (runId: string, signal?: AbortSignal) => runFetch(`/runs/${encodeURIComponent(runId)}`, { signal }),
  startRun: (runId: string) => runFetch(`/runs/${encodeURIComponent(runId)}/start`, { method: "POST" }),
  seedRun: (runId: string, body: { signature: string }) =>
    runFetch(`/runs/${encodeURIComponent(runId)}/seed`, { method: "POST", body }),
  stopRun: (runId: string) => runFetch(`/runs/${encodeURIComponent(runId)}/stop`, { method: "POST" }),
  steerEntrant: (runId: string, entrantId: string, body: SteerRequest) =>
    arenaFetch<SteerResponse>(`/runs/${encodeURIComponent(runId)}/entrants/${encodeURIComponent(entrantId)}/steer`, {
      method: "POST",
      body,
    }),
  restartEntrant: (runId: string, entrantId: string) =>
    arenaFetch<RestartResponse>(
      `/runs/${encodeURIComponent(runId)}/entrants/${encodeURIComponent(entrantId)}/restart`,
      {
        method: "POST",
      },
    ),
  broadcast: (runId: string, body: BroadcastRequest) =>
    arenaFetch<BroadcastResponse>(`/runs/${encodeURIComponent(runId)}/broadcast`, { method: "POST", body }),
  getHistory: (runId: string, query: { limit?: number; before?: number; types?: string[]; source?: string[] } = {}) => {
    const params = new URLSearchParams();
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    if (query.before !== undefined) params.set("before", String(query.before));
    if (query.types?.length) params.set("types", query.types.join(","));
    if (query.source?.length) params.set("source", query.source.join(","));
    const suffix = params.size ? `?${params}` : "";
    return arenaFetch<HistoryPage>(`/runs/${encodeURIComponent(runId)}/events/history${suffix}`);
  },
};

export function arenaEventsUrl(runId: string, after: number): string {
  const params = new URLSearchParams({ after: String(after) });
  return `${ARENA_BACKEND_URL}/runs/${encodeURIComponent(runId)}/events?${params}`;
}
