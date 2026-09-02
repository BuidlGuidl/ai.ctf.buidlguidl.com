import { SectionHeading } from "./SectionHeading";
import { AUSTIN_X_HANDLE, PHASE, X_HANDLE, X_LIVE_URL, YOUTUBE_WATCH_URL } from "./event";

const X_LIVE = {
  href: X_LIVE_URL,
  label: `Live on X · ${AUSTIN_X_HANDLE}`,
  detail: `Austin streams the race and runs the live thread from his account. Tag ${X_HANDLE} in your own call and it lands in front of us.`,
};
const YOUTUBE_LIVE = {
  href: YOUTUBE_WATCH_URL,
  label: "Live on YouTube",
  detail: "Simulcast, full replay and clips.",
};

const CARD_CLASS =
  "block rounded-lg border border-[#00FBFF]/25 bg-[#00FBFF]/5 p-5 transition hover:border-[#00FBFF] hover:bg-[#00FBFF]/10";

export function Broadcast() {
  const phase = PHASE;

  const cards =
    phase === "post"
      ? [
          { href: YOUTUBE_WATCH_URL, label: "Watch the replay", detail: "The full broadcast on YouTube." },
          {
            href: X_LIVE_URL,
            label: `The race thread · ${AUSTIN_X_HANDLE}`,
            detail: "Highlights and the call-by-call on X.",
          },
        ]
      : [X_LIVE, YOUTUBE_LIVE];

  const kicker =
    phase === "live" ? (
      <>
        WHERE TO WATCH · <span className="text-[#00ff9c]">● LIVE</span>
      </>
    ) : phase === "post" ? (
      <>
        <span className="text-[#FFBE00]">RACE OVER</span> · WHERE TO CATCH UP
      </>
    ) : (
      "WHERE TO WATCH"
    );

  return (
    <div id="watch">
      <SectionHeading kicker={kicker} title="THE BROADCAST" />
      <div className="space-y-3">
        {cards.map(card => (
          <a key={card.label} href={card.href} target="_blank" rel="noreferrer" className={CARD_CLASS}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-dotGothic text-xl tracking-wide text-[#00FBFF]">{card.label}</span>
              <span className="text-[#00FBFF]/40">→</span>
            </div>
            <p className="mt-2 text-base text-[#00FBFF]/65">{card.detail}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
