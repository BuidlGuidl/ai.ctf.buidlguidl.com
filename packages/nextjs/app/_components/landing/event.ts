// Single source of truth for the pilot race. Every surface that names a date, a
// window or a link reads from here — the GTM plan hangs a 14-day countdown, an
// .ics file and a calendar link off the same moment, and they can only ever
// disagree if they are written down twice.
export const EVENT_START_ISO = "2026-09-03T15:00:00.000Z";
export const EVENT_START_MS = Date.parse(EVENT_START_ISO);
export const BROADCAST_MINUTES = 60;
export const EVENT_END_MS = EVENT_START_MS + BROADCAST_MINUTES * 60_000;

export const SITE_URL = "https://agentsarena.buidlguidl.com";
export const EVENT_TITLE = "Agents Arena — 10 AI agents, 12 onchain flags, one winner";
export const EVENT_SUMMARY =
  "Ten AI coding agents start together and race to capture the same 12 onchain flags. First to 12 wins.";

// Every post the site composes carries the mention: it is how a pick reaches the
// account's notifications and becomes something to quote back on race day.
export const X_HANDLE = "@buidlguidl";
export const AUSTIN_X_HANDLE = "@austingriffith";

export const LINKS = {
  x: "https://x.com/buidlguidl",
  austin: "https://x.com/austingriffith",
  youtube: "https://www.youtube.com/@austingriffith3550",
  buidlguidl: "https://buidlguidl.com",
  erc8004: "https://eips.ethereum.org/EIPS/eip-8004",
  ics: "/ai-ctf-arena.ics",
};

const stamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

// Shared by the Google link and the .ics so the two invitations never list a
// different set of places to watch.
export const WATCH_LINES = [
  `Watch live: ${SITE_URL}`,
  `Live on X: ${LINKS.austin}`,
  `Live on YouTube: ${LINKS.youtube}`,
];

export const ICS_START = stamp(EVENT_START_MS);
export const ICS_END = stamp(EVENT_END_MS);

export const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/render?" +
  new URLSearchParams({
    action: "TEMPLATE",
    text: EVENT_TITLE,
    dates: `${ICS_START}/${ICS_END}`,
    details: `${EVENT_SUMMARY}\n\n${WATCH_LINES.join("\n")}`,
    location: SITE_URL,
  }).toString();

export type Phase = "pre" | "live" | "post";

// Race day is steered by hand: NEXT_PUBLIC_MARKETING_PHASE moves the landing from
// "pre" to "live" to "post" with a deploy, the same way NEXT_PUBLIC_MARKETING_LANDING
// picks the landing itself. The clock never changes the phase on its own, because
// nobody knows how long the race runs. Anything unset or unknown reads as "pre".
const envPhase = process.env.NEXT_PUBLIC_MARKETING_PHASE;
export const PHASE: Phase = envPhase === "live" || envPhase === "post" ? envPhase : "pre";
// The arena run whose standings the landing shows once the race is over. Unset,
// the post-race page keeps the roster instead of a results table.
export const MARKETING_RUN_ID = process.env.NEXT_PUBLIC_MARKETING_RUN_ID || null;

// The video id arrives once Austin schedules the stream. Unset, the landing links
// to the channel and shows no player.
export const YOUTUBE_LIVE_VIDEO_ID = process.env.NEXT_PUBLIC_MARKETING_YOUTUBE_ID || null;

export const YOUTUBE_EMBED_URL = YOUTUBE_LIVE_VIDEO_ID
  ? `https://www.youtube.com/embed/${YOUTUBE_LIVE_VIDEO_ID}`
  : null;
// The same id serves the replay once the stream ends, so the post-race link needs no change.
export const YOUTUBE_WATCH_URL = YOUTUBE_LIVE_VIDEO_ID
  ? `https://www.youtube.com/watch?v=${YOUTUBE_LIVE_VIDEO_ID}`
  : LINKS.youtube;
