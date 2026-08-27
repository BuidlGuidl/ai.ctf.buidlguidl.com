"use client";

import { useEffect, useMemo, useState } from "react";
import { LINKS, type Phase, SITE_URL, X_HANDLE, phaseAt } from "./event";
import { ModelName } from "~~/app/arena/ModelName";
import { ROSTER, displayForEntrant } from "~~/services/arena/roster";

const STORAGE_KEY = "ai-ctf-arena:pick";
const MAX_REASON = 90;

const RACERS = ROSTER.map((entry, index) => ({
  ...displayForEntrant(entry.id, entry.harness, entry.model, entry.effort),
  id: entry.id,
  slot: index + 1,
}));

export function PickYourAgent() {
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<Phase>("pre");

  useEffect(() => {
    setPhase(phaseAt(Date.now()));
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && RACERS.some(racer => racer.id === stored)) setPicked(stored);
  }, []);

  const choose = (id: string) => {
    // Picks lock the moment the clock starts, so a stale tab can't keep taking them.
    if (phase !== "pre") return;
    const next = picked === id ? null : id;
    setPicked(next);
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const pickedRacer = RACERS.find(racer => racer.id === picked) ?? null;

  const shareUrl = useMemo(() => {
    if (!pickedRacer) return null;
    const label = `${pickedRacer.modelLabel}${pickedRacer.effort ? ` (${pickedRacer.effort})` : ""} on ${
      pickedRacer.harnessLabel
    }`;
    const trimmed = reason.trim();
    // Worst case — longest racer label, a full 90-char reason and the 23 chars X
    // bills every URL at — lands around 265 of the 280 available.
    const text = [
      `I am backing ${label} in the ${X_HANDLE} Agents Arena${trimmed ? ` because ${trimmed}` : ""}.`,
      "",
      "10 AI agents. 12 onchain flags. One clock.",
    ].join("\n");
    return `https://x.com/intent/post?${new URLSearchParams({
      text,
      url: SITE_URL,
    }).toString()}`;
  }, [pickedRacer, reason]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {RACERS.map(racer => {
          const active = racer.id === picked;
          return (
            <button
              key={racer.id}
              onClick={() => choose(racer.id)}
              disabled={phase !== "pre"}
              aria-pressed={active}
              className={`relative flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center transition-all duration-300 disabled:cursor-default ${
                active ? "arena-slot-in" : ""
              }`}
              style={{
                borderColor: active ? racer.color : "rgba(0,251,255,0.26)",
                background: active ? `${racer.color}14` : "rgba(0,251,255,0.06)",
                boxShadow: active ? `0 0 22px -6px ${racer.color}` : "none",
                opacity: phase !== "pre" && !active ? 0.55 : 1,
              }}
            >
              <span className="absolute left-2 top-1.5 text-sm tabular-nums text-[#00FBFF]/55">P{racer.slot}</span>
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold"
                style={{
                  border: `2px solid ${racer.color}`,
                  background: `${racer.color}22`,
                  color: racer.color,
                }}
              >
                {racer.short}
              </span>
              <span className="-mx-1.5 flex min-h-[48px] flex-col justify-center">
                <span className="text-base font-bold leading-tight" style={{ color: racer.color }}>
                  <ModelName name={racer.modelLabel} effort={racer.effort} />
                </span>
                <span className="text-base leading-tight text-[#00FBFF]/75">{racer.harnessLabel}</span>
              </span>
              <span className="text-sm font-bold tracking-widest">
                {active ? (
                  <span style={{ color: "#00ff9c" }}>YOUR PICK ✓</span>
                ) : (
                  <span className="text-[#00FBFF]/25">{racer.vendor.toUpperCase()}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {phase !== "pre" ? (
        <p className="text-center text-base text-[#FFBE00]/90">Picks are locked — the clock is running.</p>
      ) : pickedRacer ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-[#00FBFF]/25 bg-[#00FBFF]/5 px-4 py-5">
          <label className="flex w-full max-w-2xl flex-col gap-2 text-sm tracking-widest text-[#00FBFF]/70">
            WHY THIS ONE? <span className="text-[#00FBFF]/40">(optional, goes into your post)</span>
            <input
              value={reason}
              maxLength={MAX_REASON}
              onChange={event => setReason(event.target.value)}
              placeholder="the harness recovers faster after a revert"
              className="rounded border border-[#00FBFF]/30 bg-black/60 px-3 py-2 text-base text-[#00FBFF] placeholder:text-[#00FBFF]/25 focus:border-[#00FBFF] focus:outline-none"
            />
          </label>
          <a
            href={shareUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="arena-cta rounded-md border-2 border-[#00FBFF] px-8 py-3 font-dotGothic text-lg tracking-widest text-[#00FBFF] transition hover:bg-[#00FBFF] hover:text-black"
          >
            ▶ POST MY PICK
          </a>
          <p className="max-w-xl text-center text-sm text-[#00FBFF]/45">
            Your pick stays in this browser. The post tags{" "}
            <a href={LINKS.x} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {X_HANDLE}
            </a>{" "}
            (that is how we find the calls worth reading back on race day)
          </p>
        </div>
      ) : (
        <p className="text-center text-base text-[#00FBFF]/55">
          Pick the configuration you think reaches 12 first. Picks lock when the clock starts.
        </p>
      )}
    </div>
  );
}
