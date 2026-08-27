// Single source of truth for the pilot race. Every surface that names a date, a
// window or a link reads from here — the GTM plan hangs a 14-day countdown, an
// .ics file and a calendar link off the same moment, and they can only ever
// disagree if they are written down twice.
export const EVENT_START_ISO = "2026-09-03T15:00:00.000Z";
export const EVENT_START_MS = Date.parse(EVENT_START_ISO);
export const BROADCAST_MINUTES = 60;
export const EVENT_END_MS = EVENT_START_MS + BROADCAST_MINUTES * 60_000;

export const SITE_URL = "https://agentsarena.buidlguidl.com";
export const EVENT_TITLE = "AI CTF Arena — 10 agents, 12 onchain flags, one clock";
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

export function phaseAt(now: number): Phase {
  if (now < EVENT_START_MS) return "pre";
  if (now < EVENT_END_MS) return "live";
  return "post";
}
