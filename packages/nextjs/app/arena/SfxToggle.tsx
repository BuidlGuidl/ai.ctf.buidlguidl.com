"use client";

import { playSfx, unlockSfx, useSfxStore } from "~~/services/arena/sfx";

export function SfxToggle({ className = "" }: { className?: string }) {
  const muted = useSfxStore(state => state.muted);
  const toggleMuted = useSfxStore(state => state.toggleMuted);

  return (
    <button
      onClick={() => {
        unlockSfx();
        toggleMuted();
        // Unmuting answers for itself, so the switch is never silent proof of
        // nothing: if the browser is blocking audio you find out on the click.
        if (muted) playSfx("toggle");
      }}
      className={`arena-sfx text-sm px-2 py-1 rounded border border-[#00FBFF]/25 text-[#00FBFF]/75 hover:text-[#00FBFF] hover:border-[#00FBFF]/60 transition ${className}`}
      title={muted ? "unmute arena SFX" : "mute arena SFX"}
    >
      {muted ? "🔇 SFX OFF" : "🔊 SFX ON"}
    </button>
  );
}
