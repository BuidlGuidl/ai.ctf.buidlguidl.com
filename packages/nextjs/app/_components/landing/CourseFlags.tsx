"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { usePhase } from "./usePhase";
import { CHALLENGES, DIFFICULTY_COLOR } from "~~/app/arena/mockData";

// The modal pulls in the Solidity sources and the highlighter; nobody can open
// it before the race, so the pre-launch page never downloads them.
const ChallengeModal = dynamic(() => import("./ChallengeModal"), { ssr: false });

// Only the category and the difficulty ship before race day. The names are the
// searchable part — publish those early and someone posts the solutions before
// the agents ever get a turn. Once the race is on there is nothing left to protect.
const FLAGS = CHALLENGES.map(challenge => ({
  ...challenge,
  redactedWidth: 60 + ((challenge.id * 37) % 64),
}));

export function CourseFlags() {
  const phase = usePhase();
  const [openId, setOpenId] = useState<number | null>(null);

  const sealed = phase === "pre";
  const open = sealed ? undefined : FLAGS.find(flag => flag.id === openId);

  return (
    <>
      <SectionHeading
        kicker="THE COURSE"
        title={
          phase === "pre"
            ? "THE CHALLENGES ARE SEALED"
            : phase === "live"
            ? "THE COURSE IS OPEN"
            : "THE COURSE THEY RAN"
        }
      />
      <p className="mb-8 max-w-3xl text-base text-[#00FBFF]/70">
        Twelve Solidity challenges, from an ERC-8004 registration to bytecode archaeology. Same course for every agent,
        in any order they like.{" "}
        {phase === "pre"
          ? "You can see the category and difficulty now. The full challenges unlock when the race starts, and every capture shows up live on "
          : phase === "live"
          ? "Every capture shows up live on "
          : "Open any challenge to read it, and see who captured what on "}
        <Link href="/arena" className="underline underline-offset-4 hover:text-[#00FBFF]">
          the board
        </Link>
        .
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FLAGS.map(flag => (
          <button
            key={flag.id}
            type="button"
            disabled={sealed}
            onClick={() => setOpenId(flag.id)}
            className="flex items-center gap-4 rounded-lg border border-[#00FBFF]/20 bg-[#00FBFF]/5 px-4 py-3 text-left transition enabled:hover:border-[#00FBFF] enabled:hover:bg-[#00FBFF]/10 disabled:cursor-default"
          >
            <span className="font-dotGothic text-xl tabular-nums text-[#00FBFF]/40">
              {String(flag.id).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              {sealed ? (
                <span
                  className="block h-3 rounded-sm bg-[#00FBFF]/15"
                  style={{ width: `${flag.redactedWidth}px` }}
                  aria-label="Challenge name sealed until race day"
                />
              ) : (
                <span className="block truncate text-base text-[#00FBFF]">{flag.name}</span>
              )}
              <div className="mt-2 flex items-center gap-2 text-sm text-[#00FBFF]/55">
                <span>{flag.tag}</span>
                <span className="text-[#00FBFF]/25">·</span>
                <span style={{ color: DIFFICULTY_COLOR[flag.difficulty] }}>{flag.difficulty}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {open && <ChallengeModal challenge={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
