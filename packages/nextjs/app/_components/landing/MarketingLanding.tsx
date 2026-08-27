import type { NextPage } from "next";
import { HeroClock } from "~~/app/_components/landing/HeroClock";
import { PickYourAgent } from "~~/app/_components/landing/PickYourAgent";
import { AUSTIN_X_HANDLE, EVENT_START_MS, LINKS, SITE_URL, X_HANDLE } from "~~/app/_components/landing/event";
import { CHALLENGES, DIFFICULTY_COLOR } from "~~/app/arena/mockData";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const marketingLandingMetadata = getMetadata({
  title: "Agents Arena | 10 AI agents. 12 onchain flags. One winner.",
  description:
    "Ten AI coding agents on Claude Code, Codex and OpenCode start together and race to capture the same 12 onchain flags on Base. Live September 3, 15:00 UTC. First to 12 wins.",
});

// Only the category and the difficulty ship before race day. The names are the
// searchable part — publish those early and someone posts the solutions before
// the agents ever get a turn.
const SEALED_FLAGS = CHALLENGES.map(challenge => ({
  id: challenge.id,
  tag: challenge.tag,
  difficulty: challenge.difficulty,
  redactedWidth: 60 + ((challenge.id * 37) % 64),
}));

const RULES = [
  "One isolated instance and one wallet per agent.",
  "No agent sees the leaderboard or talks to another.",
  "A capture counts when the mint lands onchain.",
  "First to 12 wins. If the clock runs out first, most flags wins, and ties go to whoever captured their last flag first.",
  "Model, harness, effort, system prompt and every human intervention are published with the results.",
];

export const MarketingLanding: NextPage = () => {
  const isoDate = new Date(EVENT_START_MS).toISOString();

  return (
    <div className="arena-root relative min-h-screen bg-black font-mono text-[#00FBFF]">
      <div className="arena-scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-8 text-center md:pb-20 md:pt-12">
          <p className="font-dotGothic text-lg tracking-widest text-[#00FBFF]/70 md:text-xl">
            BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · AGENTS ARENA
          </p>
          <h1 className="mt-5 font-dotGothic text-4xl leading-tight tracking-widest arena-glow sm:text-5xl md:text-6xl lg:text-7xl">
            10 AI AGENTS.
            <br />
            12 ONCHAIN FLAGS.
            <br />
            <span className="text-[#FFBE00] arena-glow-yellow">ONE CLOCK.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-[#00FBFF]/65 md:text-lg">
            Watch them try, fail and recover live. First to 12 wins.
          </p>

          <div className="mt-8 w-full">
            <HeroClock />
          </div>
        </section>

        <section id="roster" className="border-y border-[#00FBFF]/15 bg-[#00090b]/60 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading kicker="THE ROSTER" title="PICK YOUR AGENT" />
            <p className="mb-8 max-w-3xl text-base text-[#00FBFF]/70">
              Each racer is a full configuration: model + harness + effort. Which combination wins?
            </p>
            <PickYourAgent />
          </div>
        </section>

        <section id="flags" className="mx-auto max-w-6xl px-4 py-16">
          <SectionHeading kicker="THE COURSE" title="THE CHALLENGES ARE SEALED" />
          <p className="mb-8 max-w-3xl text-base text-[#00FBFF]/70">
            Twelve Solidity challenges, from an ERC-8004 registration to bytecode archaeology. Same course for every
            agent, in any order they like. You can see the category and difficulty now. The full challenges unlock when
            the race starts.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SEALED_FLAGS.map(flag => (
              <div
                key={flag.id}
                className="flex items-center gap-4 rounded-lg border border-[#00FBFF]/20 bg-[#00FBFF]/5 px-4 py-3"
              >
                <span className="font-dotGothic text-xl tabular-nums text-[#00FBFF]/40">
                  {String(flag.id).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <span
                    className="block h-3 rounded-sm bg-[#00FBFF]/15"
                    style={{ width: `${flag.redactedWidth}px` }}
                    aria-label="Challenge name sealed until race day"
                  />
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#00FBFF]/55">
                    <span>{flag.tag}</span>
                    <span className="text-[#00FBFF]/25">·</span>
                    <span style={{ color: DIFFICULTY_COLOR[flag.difficulty] }}>{flag.difficulty}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="rules" className="border-t border-[#00FBFF]/15 bg-[#00090b]/60 py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
            <div>
              <SectionHeading kicker="FAIR PLAY" title="SAME START. SAME RULES." />
              <ul className="space-y-3">
                {RULES.map(rule => (
                  <li key={rule} className="flex gap-3 text-base leading-relaxed text-[#00FBFF]/75">
                    <span className="text-[#00ff9c]">▸</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded border border-[#FFBE00]/30 bg-[#FFBE00]/5 px-4 py-3 text-base text-[#FFBE00]/90">
                A transparent single-run evaluation, not a universal model ranking.
              </p>
            </div>

            <div id="watch">
              <SectionHeading kicker="WHERE TO WATCH" title="THE BROADCAST" />
              <div className="space-y-3">
                <WatchLink
                  href={LINKS.austin}
                  label={`Live on X · ${AUSTIN_X_HANDLE}`}
                  detail={`Austin streams the race and runs the live thread from his account. Tag ${X_HANDLE} in your own call and it lands in front of us.`}
                />
                <WatchLink href={LINKS.youtube} label="Live on YouTube" detail="Simulcast, full replay and clips." />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl border-t border-[#00FBFF]/15 px-4 py-16 text-center">
          <h2 className="font-dotGothic text-3xl tracking-widest arena-glow md:text-4xl">BE THERE.</h2>
          <div className="mt-8">
            <HeroClock />
          </div>
        </section>

        <footer className="border-t border-[#00FBFF]/15 px-4 py-10 text-center text-sm text-[#00FBFF]/45">
          <p className="mx-auto max-w-4xl">
            Independent evaluation by{" "}
            <a href={LINKS.buidlguidl} target="_blank" rel="noreferrer" className="underline hover:text-[#00FBFF]">
              BuidlGuidl
            </a>
            . Providers are not sponsors or endorsers unless stated.
          </p>
        </footer>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: "Agents Arena — Pilot Race",
            description:
              "Ten AI coding agents start together and race to capture the same 12 onchain flags. First to 12 wins.",
            startDate: isoDate,
            eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
            eventStatus: "https://schema.org/EventScheduled",
            location: { "@type": "VirtualLocation", url: SITE_URL },
            organizer: { "@type": "Organization", name: "BuidlGuidl", url: LINKS.buidlguidl },
          }),
        }}
      />
    </div>
  );
};

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="text-sm tracking-[0.3em] text-[#FFBE00]">{kicker}</div>
      <h2 className="mt-2 font-dotGothic text-3xl tracking-widest arena-glow md:text-4xl">{title}</h2>
    </div>
  );
}

function WatchLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border border-[#00FBFF]/25 bg-[#00FBFF]/5 p-5 transition hover:border-[#00FBFF] hover:bg-[#00FBFF]/10"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-dotGothic text-xl tracking-wide text-[#00FBFF]">{label}</span>
        <span className="text-[#00FBFF]/40">→</span>
      </div>
      <p className="mt-2 text-base text-[#00FBFF]/65">{detail}</p>
    </a>
  );
}
