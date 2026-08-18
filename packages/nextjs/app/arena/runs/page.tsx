"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { RunListItem, RunState } from "~~/services/arena/arena-types";
import { arenaClient } from "~~/services/arena/client";

export const dynamic = "force-dynamic";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Local time, day and clock only: the list is read in the same week it is made,
// so the year and the seconds are noise.
function fmtStamp(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const clock = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return `${String(at.getDate()).padStart(2, "0")} ${MONTHS[at.getMonth()]} · ${clock}`;
}

// Only the three states worth picking out of a list carry a color; the setup
// states a run passes through in a minute stay dim.
const STATE_TONE: Partial<Record<RunState, string>> = {
  running: "border-[#00FBFF]/60 text-[#00FBFF] animate-pulse",
  finished: "border-[#00ff9c]/50 text-[#00ff9c]",
  failed: "border-[#FF5861]/50 text-[#FF5861]",
};

export default function ArenaRunsPage() {
  const [runs, setRuns] = useState<RunListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRuns(null);
    setError(null);
    arenaClient
      .listRuns(undefined, controller.signal)
      .then(setRuns)
      .catch(cause => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load the run list");
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black text-[#00FBFF] font-mono">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] px-5">
        <div className="font-dotGothic text-xl tracking-wide md:text-2xl">
          BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · PREVIOUS RUNS
        </div>
        <Link
          href="/arena"
          className="ml-auto rounded border border-[#00FBFF]/30 px-3 py-1 font-dotGothic text-sm tracking-widest text-[#00FBFF]/75 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
        >
          ◂ BACK TO LOBBY
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {error ? (
            <div className="rounded border border-[#FF5861]/40 bg-[#FF5861]/10 px-4 py-3 text-sm text-[#FF5861]">
              <div>{error}</div>
              <button
                onClick={retry}
                className="mt-3 rounded border border-[#FF5861]/60 px-3 py-1 font-dotGothic text-sm tracking-widest transition hover:bg-[#FF5861] hover:text-black"
              >
                RETRY
              </button>
            </div>
          ) : runs === null ? (
            <div className="animate-pulse font-dotGothic text-lg tracking-widest text-[#00FBFF]/60">
              ◆ LOADING RUNS…
            </div>
          ) : runs.length === 0 ? (
            <div className="text-sm tracking-wide text-[#00FBFF]/40">no runs yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {runs.map(run => (
                <Link
                  key={run.id}
                  href={`/arena?run=${encodeURIComponent(run.id)}`}
                  className="flex items-center gap-3 rounded-md border border-[#00FBFF]/20 bg-[#00090b]/60 px-3 py-3 transition hover:border-[#00FBFF]/60 hover:bg-[#001014] sm:gap-4 sm:px-4"
                >
                  <span
                    className={`w-28 shrink-0 rounded border px-2 py-0.5 text-center text-xs font-bold tracking-widest ${
                      STATE_TONE[run.state] ?? "border-[#00FBFF]/20 text-[#00FBFF]/45"
                    }`}
                  >
                    {run.state.replaceAll("_", " ").toUpperCase()}
                  </span>
                  <span className="flex-1 tabular-nums text-[#00FBFF]/80">
                    {fmtStamp(run.startedAt ?? run.createdAt)}
                  </span>
                  <span className="shrink-0 text-sm tracking-widest text-[#FFBE00]/70">{run.agentCount} AGENTS</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
