"use client";

import { useEffect, useState } from "react";
import { LivePlayer } from "./LivePlayer";
import {
  AUSTIN_X_HANDLE,
  EVENT_START_MS,
  GOOGLE_CALENDAR_URL,
  LINKS,
  PHASE,
  X_HANDLE,
  X_LIVE_URL,
  YOUTUBE_EMBED_URL,
  YOUTUBE_WATCH_URL,
} from "./event";

const UNITS = [
  { label: "DAYS", ms: 86_400_000 },
  { label: "HRS", ms: 3_600_000 },
  { label: "MIN", ms: 60_000 },
  { label: "SEC", ms: 1_000 },
];

function split(remaining: number) {
  let rest = Math.max(0, remaining);
  return UNITS.map(unit => {
    const value = Math.floor(rest / unit.ms);
    rest -= value * unit.ms;
    return { label: unit.label, value: String(value).padStart(2, "0") };
  });
}

// The date is the whole ask of the pre-launch page, so it renders on the server in
// UTC and is rewritten in the visitor's own timezone once mounted. A viewer who
// never runs the script still gets a real time instead of a blank slot.
const UTC_TIME = new Date(EVENT_START_MS).toUTCString().replace("GMT", "UTC");

// The player only belongs in the hero: the closing section reuses the clock and
// would otherwise load the stream a second time on the same page.
export function HeroClock({ withPlayer = false }: { withPlayer?: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const phase = PHASE;
  const hasStream = YOUTUBE_EMBED_URL !== null;
  const showPlayer = withPlayer && phase !== "pre" && hasStream;
  const parts = split(now === null ? EVENT_START_MS - Date.now() : EVENT_START_MS - now);
  const localTime =
    now === null
      ? UTC_TIME
      : new Date(EVENT_START_MS).toLocaleString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <div className="text-sm md:text-base tracking-[0.3em] text-[#00FBFF]/55">
          {phase === "pre" ? (
            "RACE STARTS IN"
          ) : phase === "live" ? (
            <>
              THE ARENA IS <span className="text-[#00ff9c]">● LIVE NOW</span>
            </>
          ) : (
            <>
              <span className="text-[#FFBE00]">RACE OVER</span> ·{" "}
              <span className="tracking-normal text-[#00FBFF]/75" suppressHydrationWarning>
                Ran {localTime}
              </span>
            </>
          )}
        </div>
        {phase === "pre" ? (
          <div className="mt-3 flex items-start justify-center gap-2 md:gap-4">
            {parts.map(part => (
              <div
                key={part.label}
                className="w-[68px] md:w-[104px] rounded-lg border border-[#00FBFF]/25 bg-[#00FBFF]/5 px-1 py-2 md:py-3"
              >
                <div className="font-dotGothic text-3xl md:text-5xl tabular-nums text-[#00FBFF] arena-glow">
                  {now === null ? "--" : part.value}
                </div>
                <div className="mt-1 text-[10px] md:text-xs tracking-[0.2em] text-[#00FBFF]/45">{part.label}</div>
              </div>
            ))}
          </div>
        ) : null}
        {phase !== "post" && (
          <div className="mt-3 text-base md:text-lg text-[#00FBFF]/75" suppressHydrationWarning>
            {phase === "pre" ? localTime : `Started ${localTime}`}
          </div>
        )}
      </div>

      {showPlayer && <LivePlayer live={phase === "live"} />}

      <div className="flex flex-col items-center gap-3">
        {phase === "pre" ? (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={GOOGLE_CALENDAR_URL}
                target="_blank"
                rel="noreferrer"
                className="arena-cta rounded-md border-2 border-[#00FBFF] px-8 py-3 font-dotGothic text-lg tracking-widest text-[#00FBFF] transition hover:bg-[#00FBFF] hover:text-black"
              >
                ▶ ADD TO CALENDAR
              </a>
              <a
                href="#roster"
                className="rounded-md border-2 border-[#00FBFF]/40 px-8 py-3 font-dotGothic text-lg tracking-widest text-[#00FBFF]/75 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
              >
                PICK YOUR AGENT
              </a>
            </div>
            <p className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-[#00FBFF]/50">
              <a href={LINKS.ics} className="underline underline-offset-4 hover:text-[#00FBFF]">
                or download the .ics file
              </a>
              <span className="text-[#00FBFF]/25">·</span>
              <span>
                Race updates on X:{" "}
                <a
                  href={LINKS.x}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-[#00FBFF]"
                >
                  {X_HANDLE}
                </a>{" "}
                and{" "}
                <a
                  href={LINKS.austin}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-[#00FBFF]"
                >
                  {AUSTIN_X_HANDLE}
                </a>
              </span>
            </p>
          </>
        ) : phase === "live" ? (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={X_LIVE_URL}
                target="_blank"
                rel="noreferrer"
                className={
                  hasStream
                    ? "rounded-md border-2 border-[#00FBFF]/40 px-8 py-3 font-dotGothic text-lg tracking-widest text-[#00FBFF]/75 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
                    : "arena-cta-go rounded-md border-2 border-[#00ff9c] px-8 py-3 font-dotGothic text-lg tracking-widest text-[#00ff9c] transition hover:bg-[#00ff9c] hover:text-black"
                }
              >
                {hasStream ? "WATCH ON X" : "▶ WATCH LIVE ON X"}
              </a>
              {!showPlayer && (
                <a
                  href={YOUTUBE_WATCH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border-2 border-[#00FBFF]/40 px-8 py-3 font-dotGothic text-lg tracking-widest text-[#00FBFF]/75 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
                >
                  WATCH ON YOUTUBE
                </a>
              )}
            </div>
            {showPlayer && (
              <p className="text-sm text-[#00FBFF]/50">
                Player not loading?{" "}
                <a
                  href={YOUTUBE_WATCH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-[#00FBFF]"
                >
                  Open the stream on YouTube
                </a>
              </p>
            )}
          </>
        ) : showPlayer ? (
          <p className="text-sm text-[#00FBFF]/50">
            Player not loading?{" "}
            <a
              href={YOUTUBE_WATCH_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-[#00FBFF]"
            >
              Open the replay on YouTube
            </a>
          </p>
        ) : (
          <a
            href={YOUTUBE_WATCH_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border-2 border-[#00FBFF]/40 px-8 py-3 font-dotGothic text-lg tracking-widest text-[#00FBFF]/75 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
          >
            WATCH THE REPLAY
          </a>
        )}
      </div>
    </div>
  );
}
