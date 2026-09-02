"use client";

import { useEffect, useState } from "react";
import { PHASE_OVERRIDE, type Phase, phaseAt } from "./event";

// Server and first client render agree on the override (or "pre"); the real
// clock is read once mounted, the same way the hero does it.
export function usePhase(): Phase {
  const [phase, setPhase] = useState<Phase>(PHASE_OVERRIDE ?? "pre");

  useEffect(() => {
    setPhase(phaseAt(Date.now()));
  }, []);

  return phase;
}
