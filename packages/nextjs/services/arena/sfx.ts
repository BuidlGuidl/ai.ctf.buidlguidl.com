"use client";

import { useEffect } from "react";
import create from "zustand";

export type SfxCue = "countdown" | "launch" | "flag" | "firstBlood" | "lead" | "finish" | "podium" | "fail" | "toggle";

const STORAGE_KEY = "arena.sfx.muted";

// Everything is mixed through here, so the whole arena gets quieter or louder in
// one place and per-cue gains stay comparable to each other.
const MASTER_GAIN = 0.35;

type Note = {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
};

// Short, quiet chiptune blips. A cue that fires often (a flag capture) stays
// under 0.2s so a burst of them reads as chatter rather than a siren; only the
// launch and the podium are allowed any length.
const CUES: Record<SfxCue, Note[]> = {
  countdown: [{ freq: 440, at: 0, dur: 0.12, type: "square", gain: 0.06 }],
  launch: [{ freq: 880, at: 0, dur: 0.3, type: "sawtooth", gain: 0.07 }],
  flag: [
    { freq: 988, at: 0, dur: 0.06, type: "triangle", gain: 0.05 },
    { freq: 1319, at: 0.055, dur: 0.09, type: "triangle", gain: 0.04 },
  ],
  firstBlood: [
    { freq: 659, at: 0, dur: 0.07, type: "triangle", gain: 0.05 },
    { freq: 988, at: 0.07, dur: 0.07, type: "triangle", gain: 0.05 },
    { freq: 1319, at: 0.14, dur: 0.16, type: "triangle", gain: 0.05 },
  ],
  lead: [
    { freq: 523, at: 0, dur: 0.07, type: "square", gain: 0.035 },
    { freq: 659, at: 0.06, dur: 0.07, type: "square", gain: 0.035 },
    { freq: 784, at: 0.12, dur: 0.14, type: "square", gain: 0.04 },
  ],
  finish: [
    { freq: 784, at: 0, dur: 0.1, type: "square", gain: 0.045 },
    { freq: 1047, at: 0.1, dur: 0.1, type: "square", gain: 0.045 },
    { freq: 1319, at: 0.2, dur: 0.26, type: "square", gain: 0.05 },
  ],
  podium: [
    { freq: 523, at: 0, dur: 0.12, type: "square", gain: 0.05 },
    { freq: 659, at: 0.13, dur: 0.12, type: "square", gain: 0.05 },
    { freq: 784, at: 0.26, dur: 0.12, type: "square", gain: 0.05 },
    { freq: 1047, at: 0.39, dur: 0.45, type: "square", gain: 0.055 },
    { freq: 1319, at: 0.42, dur: 0.45, type: "triangle", gain: 0.035 },
  ],
  fail: [
    { freq: 233, at: 0, dur: 0.14, type: "sawtooth", gain: 0.05 },
    { freq: 165, at: 0.13, dur: 0.26, type: "sawtooth", gain: 0.05 },
  ],
  toggle: [{ freq: 1047, at: 0, dur: 0.05, type: "triangle", gain: 0.04 }],
};

// A run can land several captures in the same tick. Repeats inside the window
// are dropped rather than queued, so the board never falls behind its own audio.
const THROTTLE_MS: Partial<Record<SfxCue, number>> = {
  flag: 90,
  lead: 400,
  finish: 300,
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlockBound = false;
const lastPlayedAt = new Map<SfxCue, number>();

// Browsers hand out a suspended context outside a gesture, so the context is
// built once and only resumed from a real interaction. Every arena screen calls
// this on mount, which is why no single button owns the audio any more.
function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
    }
  }
  return ctx;
}

export function unlockSfx() {
  const audio = context();
  if (audio && audio.state === "suspended") void audio.resume();
}

export function bindSfxUnlock(): () => void {
  if (typeof window === "undefined" || unlockBound) return () => undefined;
  unlockBound = true;
  const handler = () => unlockSfx();
  window.addEventListener("pointerdown", handler, { capture: true });
  window.addEventListener("keydown", handler, { capture: true });
  return () => {
    unlockBound = false;
    window.removeEventListener("pointerdown", handler, { capture: true });
    window.removeEventListener("keydown", handler, { capture: true });
  };
}

export function playSfx(cue: SfxCue) {
  if (useSfxStore.getState().muted) return;
  const audio = context();
  if (!audio || !master) return;
  if (audio.state === "suspended") {
    // Nothing can sound before the page has been touched; asking here means the
    // first cue after a reload lands as soon as the operator clicks anything.
    void audio.resume();
    return;
  }

  const now = Date.now();
  const throttle = THROTTLE_MS[cue];
  if (throttle && now - (lastPlayedAt.get(cue) ?? 0) < throttle) return;
  lastPlayedAt.set(cue, now);

  const start = audio.currentTime;
  CUES[cue].forEach(note => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = note.type ?? "square";
    osc.frequency.value = note.freq;
    osc.connect(gain);
    gain.connect(master as GainNode);
    const at = start + note.at;
    // A tiny ramp in, exponential out: a bare setValueAtTime clicks on every
    // edge, which is loud enough to hear over the note itself.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(note.gain ?? 0.05, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + note.dur);
    osc.start(at);
    osc.stop(at + note.dur + 0.02);
  });
}

interface SfxStore {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
}

// Starts unmuted on both sides of hydration; the stored choice is applied in an
// effect so the toggle's label never disagrees with the server-rendered markup.
export const useSfxStore = create<SfxStore>((set, get) => ({
  muted: false,
  setMuted: muted => {
    set({ muted });
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // private mode, or storage disabled — the choice just won't outlive the tab
    }
  },
  toggleMuted: () => get().setMuted(!get().muted),
}));

export function useArenaSfx() {
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") useSfxStore.setState({ muted: true });
    } catch {
      // ignore
    }
    return bindSfxUnlock();
  }, []);
}
