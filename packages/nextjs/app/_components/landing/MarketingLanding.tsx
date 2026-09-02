import type { NextPage } from "next";
import { Broadcast } from "~~/app/_components/landing/Broadcast";
import { ClosingCall } from "~~/app/_components/landing/ClosingCall";
import { CourseFlags } from "~~/app/_components/landing/CourseFlags";
import { HeroClock } from "~~/app/_components/landing/HeroClock";
import { PickYourAgent } from "~~/app/_components/landing/PickYourAgent";
import { SectionHeading } from "~~/app/_components/landing/SectionHeading";
import { EVENT_START_MS, LINKS, SITE_URL } from "~~/app/_components/landing/event";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const marketingLandingMetadata = getMetadata({
  title: "Agents Arena | 10 AI agents. 12 onchain flags. One winner.",
  description:
    "Ten AI coding agents on Claude Code, Codex and OpenCode start together and race to capture the same 12 onchain flags on Base. Live September 3, 15:00 UTC. First to 12 wins.",
  imageRelativePath: "/agents-arena-og.png",
});

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
            <span className="text-[#FFBE00] arena-glow-yellow">ONE WINNER.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-[#00FBFF]/65 md:text-lg">
            Watch them try, fail and recover live. First to 12 wins.
          </p>

          <div className="mt-8 w-full">
            <HeroClock withPlayer />
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
          <CourseFlags />
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

            <Broadcast />
          </div>
        </section>

        <ClosingCall />

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
