import {
  EVENT_SUMMARY,
  EVENT_TITLE,
  ICS_END,
  ICS_START,
  LINKS,
  SITE_URL,
  WATCH_LINES,
} from "~~/app/_components/landing/event";

// Served from a route rather than public/ so the file can never drift from the date
// the page renders, and so the CRLF line endings iCalendar asks for survive.
const DESCRIPTION = `${EVENT_SUMMARY} Every valid capture leaves a public onchain receipt on Base.\n\n${WATCH_LINES.join(
  "\n",
)}`;

const escapeText = (value: string) => value.replace(/[\\;,]/g, match => `\\${match}`).replace(/\n/g, "\\n");

// RFC 5545 caps a content line at 75 octets; anything longer continues on the next
// line behind a single space. Calendar clients that enforce it drop the tail otherwise.
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    const limit = chunks.length === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte character: back off until the next byte starts one.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return chunks.join("\r\n ");
}

export function GET() {
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BuidlGuidl//Agents Arena//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:ai-ctf-arena-pilot-race-01@ctf.buidlguidl.com",
    `DTSTAMP:${ICS_START}`,
    `DTSTART:${ICS_START}`,
    `DTEND:${ICS_END}`,
    `SUMMARY:${escapeText(EVENT_TITLE)}`,
    `DESCRIPTION:${escapeText(DESCRIPTION)}`,
    `URL:${SITE_URL}`,
    `LOCATION:${escapeText(LINKS.austin)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ai-ctf-arena.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
