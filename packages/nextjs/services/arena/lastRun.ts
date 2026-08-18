// The URL is the only handle on a run, so leaving one for the lobby used to lose
// it for good — a finished race the operator was reading is one click from being
// unreachable. The last run visited is remembered here, and the lobby offers it
// back: a locked run stays watchable for as long as the backend keeps it.
const LAST_RUN_KEY = "arena:last-run";

export function rememberRun(runId: string): void {
  try {
    window.localStorage.setItem(LAST_RUN_KEY, runId);
  } catch {
    // Private mode, blocked storage — the offer to reopen is a convenience.
  }
}

export function readLastRun(): string | null {
  try {
    return window.localStorage.getItem(LAST_RUN_KEY);
  } catch {
    return null;
  }
}

// Only drops the pointer when it still names this run: a run that 404s is worth
// forgetting, but not at the cost of a newer one opened since.
export function forgetRun(runId: string): void {
  try {
    if (window.localStorage.getItem(LAST_RUN_KEY) === runId) window.localStorage.removeItem(LAST_RUN_KEY);
  } catch {
    // ignored — see rememberRun
  }
}
