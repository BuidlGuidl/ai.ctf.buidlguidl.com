import type { RosterEffort } from "~~/services/arena/arena-types";

// Effort annotates an identity — a model name in the lobby, a handle on the race
// board — so the two ship as one component and no surface can park the effort
// somewhere else. The tail borrows currentColor from the name it
// trails (the lane accent in the lobby, the dim cyan on the result cards) and steps
// down in size and weight instead of carrying a separator, which the 142px lobby slot
// has no room for. No whitespace between the name and the tail: without a break
// opportunity the tail can never wrap away from the name it belongs to.
export function ModelName({
  name,
  effort,
  className = "",
}: {
  name: string;
  effort?: RosterEffort;
  className?: string;
}) {
  return (
    <span className={className}>
      {/* The gap is set in em on the name so it tracks the host line's size — the
          model name runs from 10px on a finalist card to 16px in a lobby slot. */}
      <span className={effort ? "mr-[0.34em]" : undefined}>{name}</span>
      {effort ? <span className="text-[9px] font-normal tracking-[0.02em] opacity-65">{effort}</span> : null}
    </span>
  );
}
