import type { ReactNode } from "react";

export function SectionHeading({ kicker, title }: { kicker: ReactNode; title: string }) {
  return (
    <div className="mb-6">
      <div className="text-sm tracking-[0.3em] text-[#FFBE00]">{kicker}</div>
      <h2 className="mt-2 font-dotGothic text-3xl tracking-widest arena-glow md:text-4xl">{title}</h2>
    </div>
  );
}
