// Dev-only shortcuts into the late game. A full match takes minutes to simulate,
// which makes the finish sequence and the result card painful to iterate on, so
// `?preview=` seeds the roster mid-race instead. Stripped in production builds.
import { Agent, CHALLENGES } from "./mockData";

export type ArenaPhase = "lobby" | "live" | "finished";

export type PreviewState = {
  agents: Agent[];
  clock: number;
  phase: ArenaPhase;
  // Flips one more agent to finished shortly after mount, so the podium sting
  // and the row lock-in actually play instead of being already on screen.
  finisher?: { index: number; at: number };
};

const fmt = (s: number) => {
  const m = Math.floor((s % 3600) / 60);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(
    2,
    "0",
  )}`;
};

const ALL_FLAGS = CHALLENGES.map(c => c.id);
const finishTime = (index: number) => 284 + index * 17;

// Everything an agent needs to look like it has been racing for a few minutes.
const raced = (agent: Agent, index: number, solved: number[], finishedAt: number | null): Agent => ({
  ...agent,
  solved,
  current: finishedAt === null ? Math.min(CHALLENGES.length, solved.length + 1) : agent.current,
  status: finishedAt === null ? "working" : "done",
  tokens: 580_000 + index * 43_000,
  cost: 2.48 + index * 0.37,
  firstBlood: fmt(18 + index * 3),
  finishedAt,
});

/**
 * `?preview=podium&place=1|2|3` — everyone above `place` has finished and that
 * agent takes the spot a beat after mount.
 * `?preview=finish&remaining=N` — the field is done bar N agents on their last flag.
 * `?preview=final` — the locked result card.
 */
export function readPreviewState(agents: Agent[], search: string): PreviewState | null {
  if (process.env.NODE_ENV !== "development") return null;

  const params = new URLSearchParams(search);
  const preview = params.get("preview");

  if (preview === "podium") {
    const requested = Number(params.get("place") ?? 3);
    const place = requested === 1 || requested === 2 ? requested : 3;
    const index = place - 1;
    return {
      agents: agents.map((agent, i) => {
        if (i < index) return raced(agent, i, ALL_FLAGS, finishTime(i));
        // The agent about to finish sits one flag short; everyone else trails.
        const solved = i === index ? ALL_FLAGS.slice(0, -1) : ALL_FLAGS.slice(0, Math.max(5, 9 - (i % 3)));
        return raced(agent, i, solved, null);
      }),
      clock: finishTime(index) - 1,
      phase: "live",
      finisher: { index, at: finishTime(index) },
    };
  }

  if (preview === "finish" || preview === "final") {
    const requested = Math.floor(Number(params.get("remaining") ?? 1));
    const remaining =
      preview === "finish" && Number.isFinite(requested) ? Math.min(agents.length, Math.max(1, requested)) : 0;
    return {
      agents: agents.map((agent, i) => {
        const racing = i >= agents.length - remaining;
        return raced(agent, i, racing ? ALL_FLAGS.slice(0, -1) : ALL_FLAGS, racing ? null : finishTime(i));
      }),
      clock: 437,
      phase: preview === "final" ? "finished" : "live",
    };
  }

  return null;
}
