"use client";

import { HeroClock } from "./HeroClock";
import { usePhase } from "./usePhase";

// The closing block exists to sell the date. Once the race is on, the hero
// carries the player and the broadcast block carries every link.
export function ClosingCall() {
  const phase = usePhase();
  if (phase !== "pre") return null;

  return (
    <section className="mx-auto max-w-4xl border-t border-[#00FBFF]/15 px-4 py-16 text-center">
      <h2 className="font-dotGothic text-3xl tracking-widest arena-glow md:text-4xl">BE THERE.</h2>
      <div className="mt-8">
        <HeroClock />
      </div>
    </section>
  );
}
