"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { SectionHeading } from "./SectionHeading";
import { MARKETING_RUN_ID, YOUTUBE_WATCH_URL } from "./event";
import { ModelName } from "~~/app/arena/ModelName";
import { CHALLENGES } from "~~/app/arena/mockData";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import type { RosterEffort, RunSnapshot } from "~~/services/arena/arena-types";
import { arenaClient } from "~~/services/arena/client";
import { displayForEntrant } from "~~/services/arena/roster";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

const ChallengeModal = dynamic(() => import("./ChallengeModal"), { ssr: false });

type ColumnMode = "challenges" | "order";

const TOTAL = CHALLENGES.length;
const SLOTS = Array.from({ length: TOTAL }, (_, k) => k);
const PODIUM_TONE = ["#FFBE00", "#CBD5E1", "#CD7F32"];
const EMPTY_CELL = { background: "#00fbff08", borderColor: "#00fbff1a" };
const CELL =
  "flex h-9 flex-1 items-center justify-center rounded-[3px] border text-base font-bold tabular-nums transition hover:shadow-[0_0_0_1px_#00FBFF] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_#00FBFF]";

interface Row {
  id: string;
  handle: string;
  effort?: RosterEffort;
  runtime: string;
  color: string;
  short: string;
  address: string | null;
  solved: number[];
  tokens: number;
  cost: number | null;
  lastSolveAt: string | null;
  finishedAt: number | null;
}

const fmtTokens = (tokens: number) =>
  tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : `${(tokens / 1000).toFixed(0)}k`;

const fmtFinish = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ms = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${String(h).padStart(2, "0")}:${ms}` : ms;
};

// Same order as the board: flags first, then the clock for anyone who cleared
// the course, then whoever reached that flag count first.
function rowsFromRun(run: RunSnapshot): Row[] {
  const startMs = run.startedAt ? Date.parse(run.startedAt) : NaN;
  return run.entrants
    .map(entrant => {
      const display = displayForEntrant(entrant.id, entrant.harness, entrant.model, entrant.effort);
      const lastSolveAt = entrant.solves.at(-1)?.ts ?? null;
      const clearedMs = entrant.solves.length >= TOTAL && lastSolveAt ? Date.parse(lastSolveAt) : NaN;
      return {
        id: entrant.id,
        handle: display.handle,
        effort: display.effort,
        runtime: `${display.harnessLabel} + ${display.modelLabel}${display.effort ? ` · ${display.effort}` : ""}`,
        color: display.color,
        short: display.short,
        address: entrant.address,
        solved: entrant.solves.map(solve => solve.challengeId),
        tokens: entrant.inputTokens + entrant.outputTokens,
        cost: entrant.costUsd,
        lastSolveAt,
        finishedAt: Number.isFinite(startMs) && clearedMs >= startMs ? Math.floor((clearedMs - startMs) / 1000) : null,
      };
    })
    .sort(
      (a, b) =>
        b.solved.length - a.solved.length ||
        (a.finishedAt !== null && b.finishedAt !== null ? a.finishedAt - b.finishedAt : 0) ||
        (a.lastSolveAt ?? "\uffff").localeCompare(b.lastSolveAt ?? "\uffff") ||
        a.id.localeCompare(b.id),
    );
}

export function RaceResults() {
  const [run, setRun] = useState<RunSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<ColumnMode>("challenges");
  const [openId, setOpenId] = useState<number | null>(null);
  const { targetNetwork } = useTargetNetwork();

  useEffect(() => {
    if (!MARKETING_RUN_ID) return;
    const controller = new AbortController();
    arenaClient
      .getRun(MARKETING_RUN_ID, controller.signal)
      .then(setRun)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => (run ? rowsFromRun(run) : []), [run]);
  const explorer = run && run.chainId === targetNetwork.id ? targetNetwork : null;
  const open = CHALLENGES.find(challenge => challenge.id === openId);
  const challengeName = (id: number) => CHALLENGES.find(challenge => challenge.id === id)?.name ?? "";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          kicker={
            <>
              <span className="text-[#FFBE00]">RACE OVER</span> · FINAL STANDINGS
            </>
          }
          title="THE RESULTS"
        />
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs font-bold tracking-widest text-[#00FBFF]/45">FLAG VIEW</span>
          <div className="flex items-center rounded border border-[#00FBFF]/25 p-0.5">
            {(["challenges", "order"] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                title={
                  option === "challenges" ? "Keep every flag in its challenge column" : "Show flags in capture order"
                }
                className={`rounded px-2 py-0.5 text-xs font-bold tracking-wider transition ${
                  mode === option ? "bg-[#00FBFF]/15 text-[#00FBFF]" : "text-[#00FBFF]/50 hover:text-[#00FBFF]"
                }`}
              >
                {option === "challenges" ? "1–12" : "SOLVE ORDER"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mb-8 max-w-3xl text-base text-[#00FBFF]/70">
        Flags first, then the clock for whoever cleared the course. Click a flag to read the challenge it stands for.
      </p>

      {failed ? (
        <p className="text-base text-[#FFBE00]/90">
          The results could not be loaded right now.{" "}
          <a
            href={YOUTUBE_WATCH_URL}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-[#FFBE00]"
          >
            Watch the replay
          </a>{" "}
          in the meantime.
        </p>
      ) : !run ? (
        <p className="text-base text-[#00FBFF]/55">Loading the results…</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[880px] space-y-1">
            <div className="flex items-center gap-3 px-2 pb-1 text-sm tracking-widest text-[#00FBFF]/55">
              <span className="w-8 shrink-0" />
              <span className="w-8 shrink-0" />
              <span className="w-[260px] shrink-0">AGENT · FLAGS →</span>
              <span className="w-16 shrink-0 text-right">TOK</span>
              <span className="w-20 shrink-0 text-right">COST</span>
              <div className="flex flex-1 gap-1">
                {mode === "challenges"
                  ? CHALLENGES.map(challenge => (
                      <button
                        key={challenge.id}
                        type="button"
                        onClick={() => setOpenId(challenge.id)}
                        title={`#${challenge.id} ${challenge.name}`}
                        className="flex-1 text-center font-bold tabular-nums transition hover:text-[#00FBFF]"
                      >
                        {challenge.id}
                      </button>
                    ))
                  : SLOTS.map(k => (
                      <span
                        key={k}
                        title={`Capture ${k + 1} of ${TOTAL}`}
                        className="flex-1 text-center font-bold tabular-nums"
                      >
                        {k + 1}
                      </span>
                    ))}
              </div>
              <span className="w-24 shrink-0 text-right">RESULT</span>
            </div>

            {rows.map((row, i) => {
              const finished = row.finishedAt !== null;
              const tone = finished && i < 3 ? PODIUM_TONE[i] : null;
              return (
                <div
                  key={row.id}
                  className="relative flex items-center gap-3 rounded border border-transparent px-2 py-2"
                  style={
                    tone
                      ? {
                          borderColor: `${tone}55`,
                          background: `linear-gradient(90deg, ${tone}22, transparent)`,
                          boxShadow: `inset 3px 0 0 ${tone}`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="w-8 shrink-0 text-center text-lg font-bold tabular-nums"
                    style={{ color: tone ?? (finished ? "#00ff9c" : "#00FBFFb3") }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="h-8 w-8 shrink-0 overflow-hidden rounded"
                    style={{ border: `1px solid ${row.color}55` }}
                    title={`${row.runtime}${row.address ? ` · ${row.address}` : ""}`}
                  >
                    {row.address && explorer ? (
                      <a
                        href={getBlockExplorerAddressLink(explorer, row.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-full w-full hover:opacity-80"
                      >
                        <BlockieAvatar address={row.address} ensImage={null} size={32} />
                      </a>
                    ) : row.address ? (
                      <BlockieAvatar address={row.address} ensImage={null} size={32} />
                    ) : (
                      <span
                        className="flex h-full items-center justify-center text-xs font-bold"
                        style={{ color: row.color }}
                      >
                        {row.short}
                      </span>
                    )}
                  </span>
                  <span className="w-[260px] shrink-0 truncate text-xl font-bold text-white" title={row.runtime}>
                    <ModelName name={row.handle} effort={row.effort} />
                  </span>
                  <span className="w-16 shrink-0 text-right text-base tabular-nums text-[#00FBFF]/75">
                    {fmtTokens(row.tokens)}
                  </span>
                  <span className="w-20 shrink-0 text-right text-base tabular-nums text-[#FFBE00]/90">
                    {row.cost !== null ? `$${row.cost.toFixed(2)}` : "N/A"}
                  </span>
                  <div className="flex flex-1 gap-1">
                    {mode === "challenges"
                      ? CHALLENGES.map(challenge => {
                          const captureIndex = row.solved.indexOf(challenge.id);
                          const captured = captureIndex !== -1;
                          return (
                            <button
                              key={challenge.id}
                              type="button"
                              onClick={() => setOpenId(challenge.id)}
                              title={`#${challenge.id} ${challenge.name} · ${
                                captured ? `captured ${captureIndex + 1} of ${TOTAL}` : "not captured"
                              }`}
                              className={CELL}
                              style={
                                captured
                                  ? { background: row.color, borderColor: row.color, color: "#00181c" }
                                  : EMPTY_CELL
                              }
                            >
                              {captured ? challenge.id : ""}
                            </button>
                          );
                        })
                      : SLOTS.map(k => {
                          const flagId = row.solved[k];
                          return flagId === undefined ? (
                            <span key={k} title="Not captured" className={CELL} style={EMPTY_CELL} />
                          ) : (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setOpenId(flagId)}
                              title={`#${flagId} ${challengeName(flagId)} · captured ${k + 1} of ${TOTAL}`}
                              className={CELL}
                              style={{ background: row.color, borderColor: row.color, color: "#00181c" }}
                            >
                              {flagId}
                            </button>
                          );
                        })}
                  </div>
                  <span className="w-24 shrink-0 whitespace-nowrap text-right text-lg tabular-nums">
                    {row.finishedAt !== null ? (
                      <span className="font-bold" style={{ color: tone ?? "#00ff9c" }}>
                        ◆ {fmtFinish(row.finishedAt)}
                      </span>
                    ) : (
                      <span className="text-[#00FBFF]/85">
                        {row.solved.length}/{TOTAL}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && <ChallengeModal challenge={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
