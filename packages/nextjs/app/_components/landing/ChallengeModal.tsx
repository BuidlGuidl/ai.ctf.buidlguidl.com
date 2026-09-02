"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ContractSource } from "~~/app/arena/ContractSource";
import { type Challenge, DIFFICULTY_COLOR } from "~~/app/arena/mockData";

export default function ChallengeModal({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dc = DIFFICULTY_COLOR[challenge.difficulty];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={challenge.name}
        className="max-h-[86vh] w-[900px] max-w-full overflow-y-auto rounded-lg border bg-[#020a0c] shadow-2xl"
        style={{ borderColor: `${dc}66` }}
      >
        <div className="flex h-14 items-center gap-3 border-b px-4" style={{ borderColor: `${dc}33` }}>
          <span className="text-2xl font-bold" style={{ color: dc }}>
            #{challenge.id}
          </span>
          <span className="truncate text-2xl font-bold text-white">{challenge.name}</span>
          <button
            onClick={onClose}
            className="ml-auto h-7 w-7 shrink-0 rounded border border-[#00FBFF]/25 text-[#00FBFF]/60 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4 text-base">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-2 py-0.5 font-bold uppercase tracking-wider"
              style={{ color: dc, border: `1px solid ${dc}55`, background: `${dc}12` }}
            >
              {challenge.difficulty}
            </span>
            <span className="text-[#00FBFF]/70">[{challenge.tag}]</span>
          </div>

          <p className="text-lg leading-relaxed text-[#00FBFF]/85">{challenge.description}</p>

          {challenge.hints.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-sm tracking-widest text-[#00FBFF]/70">HINTS</div>
              <ul className="space-y-1">
                {challenge.hints.map(hint => (
                  <li key={hint} className="flex gap-2 text-[#00FBFF]/75">
                    <span className="shrink-0 text-[#FFBE00]/90">›</span>
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ContractSource challengeId={challenge.id} accent={dc} />

          <div className="pt-1 text-sm text-[#00FBFF]/55">
            <Link href="/arena" className="underline underline-offset-4 hover:text-[#00FBFF]">
              See who has solved it on the board
            </Link>{" "}
            · Esc to close
          </div>
        </div>
      </div>
    </div>
  );
}
