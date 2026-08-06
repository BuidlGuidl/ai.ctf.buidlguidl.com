import type { RosterEffort } from "~~/services/arena/arena-types";

// Effort is a footnote to the model name, so the chip carries no color of its own:
// it borrows currentColor from whatever label it trails — the lane accent in the
// lobby, the dim cyan on the result cards — and sits back at half opacity.
export function EffortBadge({ effort, className = "" }: { effort?: RosterEffort; className?: string }) {
  if (!effort) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[3px] border border-current px-1 py-px align-middle text-[9px] font-bold leading-none tracking-[0.06em] opacity-45 ${className}`}
    >
      {effort}
    </span>
  );
}
