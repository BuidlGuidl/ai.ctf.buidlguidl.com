import { arenaTheme } from "../theme";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const THE_REVEAL_DURATION_IN_FRAMES = 900;

type Entrant = {
  vendor: string;
  vendorMark: string;
  handle: string;
  model: string;
  harness: string;
  effort: string;
  color: string;
};

const entrants: Entrant[] = [
  { vendor: "ANTHROPIC", vendorMark: "AN", handle: "claude-opus-5", model: "OPUS 5", harness: "CLAUDE CODE", effort: "HIGH", color: "#2DD4BF" },
  { vendor: "ZHIPU", vendorMark: "GL", handle: "opencode-glm-52", model: "GLM-5.2", harness: "OPENCODE", effort: "HIGH", color: "#FFE14D" },
  { vendor: "OPENAI", vendorMark: "OA", handle: "codex-gpt-55", model: "GPT-5.5", harness: "CODEX CLI", effort: "HIGH", color: "#A855F7" },
  { vendor: "ANTHROPIC", vendorMark: "AN", handle: "claude-sonnet-5", model: "SONNET 5", harness: "CLAUDE CODE", effort: "HIGH", color: "#22C55E" },
  { vendor: "MOONSHOT", vendorMark: "KI", handle: "opencode-kimi-k3", model: "KIMI K3", harness: "OPENCODE", effort: "HIGH", color: "#FF9F1C" },
  { vendor: "ANTHROPIC", vendorMark: "AN", handle: "claude-opus-48", model: "OPUS 4.8", harness: "CLAUDE CODE", effort: "HIGH", color: "#60A5FA" },
  { vendor: "DEEPSEEK", vendorMark: "DS", handle: "opencode-deepseek-v4", model: "DEEPSEEK V4 FLASH", harness: "OPENCODE", effort: "HIGH", color: "#EC4899" },
  { vendor: "ANTHROPIC", vendorMark: "AN", handle: "claude-opus-5", model: "OPUS 5", harness: "CLAUDE CODE", effort: "MEDIUM", color: "#FF5C5C" },
  { vendor: "OPENAI", vendorMark: "OA", handle: "codex-gpt-55", model: "GPT-5.5", harness: "CODEX CLI", effort: "XHIGH", color: "#E2E8F0" },
  { vendor: "OPENAI", vendorMark: "OA", handle: "codex-gpt-55", model: "GPT-5.5", harness: "CODEX CLI", effort: "MEDIUM", color: "#C5A5D7" },
];

const challenges = [
  { id: 1, name: "Agent Registration", tag: "erc-8004", difficulty: "EASY" },
  { id: 2, name: "Show me your key", tag: "hashing", difficulty: "EASY" },
  { id: 3, name: "Let me in!", tag: "caller-check", difficulty: "EASY" },
  { id: 4, name: "Pay me!", tag: "fallback", difficulty: "EASY" },
  { id: 5, name: "Count my Assembly", tag: "assembly", difficulty: "MEDIUM" },
  { id: 6, name: "Give Me My Points!", tag: "reentrancy", difficulty: "MEDIUM" },
  { id: 7, name: "Calldata FTW", tag: "calldata", difficulty: "HARD" },
  { id: 8, name: "Locked", tag: "bitwise", difficulty: "HARD" },
  { id: 9, name: "The unverified", tag: "bytecode", difficulty: "HARD" },
  { id: 10, name: "Who can call me?", tag: "access-control", difficulty: "MEDIUM" },
  { id: 11, name: "Give me the block!", tag: "block-timing", difficulty: "INSANE" },
  { id: 12, name: "Conquer the game", tag: "achievements", difficulty: "INSANE" },
];

const solvedRoutes = [
  [1, 2, 4, 5, 6, 7, 8, 9, 11],
  [1, 2, 3, 4, 5, 6, 8, 10],
  [1, 2, 3, 4, 5, 7, 9, 11],
  [1, 2, 3, 4, 6, 8, 10],
  [1, 2, 4, 5, 7, 9],
  [1, 2, 3, 5, 6, 10],
  [1, 2, 4, 7, 8],
  [1, 2, 3, 5],
  [1, 2, 4, 6],
  [1, 3, 5],
];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const fade = (frame: number, duration: number, edge = 12) =>
  Math.min(
    interpolate(frame, [0, edge], [0, 1], clamp),
    interpolate(frame, [duration - edge, duration], [1, 0], clamp),
  );

const FrameChrome = ({ simulated = false }: { simulated?: boolean }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scanline = interpolate(frame % 150, [0, 149], [-40, height + 40]);

  return (
    <>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 42%, transparent 30%, rgba(0, 4, 7, 0.34) 72%, rgba(0, 3, 5, 0.76) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.16,
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,251,255,0.1) 4px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: scanline,
          width,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${arenaTheme.cyan}, transparent)`,
          boxShadow: `0 0 18px ${arenaTheme.cyan}`,
          opacity: 0.2,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 30,
          border: "1px solid rgba(0,251,255,0.22)",
          clipPath: "polygon(0 0, 140px 0, 140px 2px, calc(100% - 140px) 2px, calc(100% - 140px) 0, 100% 0, 100% 100%, 0 100%)",
        }}
      />
      {simulated ? (
        <div
          style={{
            position: "absolute",
            right: 48,
            bottom: 42,
            color: "rgba(245,255,255,0.72)",
            background: "rgba(0,9,11,0.74)",
            border: "1px solid rgba(245,255,255,0.28)",
            padding: "8px 13px",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.16em",
          }}
        >
          SIMULATED RUN
        </div>
      ) : null}
    </>
  );
};

const SignalBug = ({ label = "LIVE" }: { label?: string }) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame % 30, [0, 15, 29], [0.55, 1, 0.55]);

  return (
    <div
      style={{
        position: "absolute",
        left: 54,
        top: 46,
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: arenaTheme.white,
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: "0.18em",
        textShadow: "0 2px 8px #000",
      }}
    >
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 999,
          background: label === "LIVE" ? arenaTheme.red : arenaTheme.cyan,
          boxShadow: `0 0 18px ${label === "LIVE" ? arenaTheme.red : arenaTheme.cyan}`,
          opacity: pulse,
        }}
      />
      {label}
    </div>
  );
};

const RetroBoot = () => {
  const frame = useCurrentFrame();
  const duration = 105;
  const glitch = frame > 18 && frame < 112 && frame % 19 < 3 ? Math.round((random(`tv-${frame}`) - 0.5) * 12) : 0;
  const signal = interpolate(frame, [5, 18], [0, 1], clamp);
  const title = spring({ frame: frame - 9, fps: 30, durationInFrames: 24, config: { damping: 18, stiffness: 120 } });
  const stats = interpolate(frame, [26, 42], [0, 1], clamp);
  const date = interpolate(frame, [48, 66], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration, 10), background: "#000" }}>
      <OffthreadVideo
        src={staticFile("the-reveal/generated/retro-tv.mp4")}
        startFrom={132}
        volume={0.42}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translateX(${glitch}px) scale(1.015)` }}
      />
      <AbsoluteFill style={{ background: `rgba(0,16,19,${0.05 + signal * 0.09})` }} />
      <div
        style={{
          position: "absolute",
          left: 438,
          top: 130,
          width: 972,
          height: 725,
          padding: "62px 72px 54px",
          opacity: signal,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          transform: `translateX(${glitch * 1.8}px)`,
          color: arenaTheme.white,
          textAlign: "center",
          borderRadius: "12%",
          overflow: "hidden",
          background: "radial-gradient(circle at center, rgba(0,251,255,0.09), rgba(0,8,11,0.34) 72%)",
          textShadow: `0 0 14px ${arenaTheme.cyan}, 2px 0 ${arenaTheme.red}, -2px 0 ${arenaTheme.cyan}`,
        }}
      >
        <div style={{ width: "100%", opacity: title }}>
          <div style={{ color: arenaTheme.red, fontSize: 24, fontWeight: 950, letterSpacing: "0.24em" }}>INCOMING LIVE BROADCAST</div>
          <div style={{ marginTop: 23, fontSize: 88, fontWeight: 950, letterSpacing: "0.035em", lineHeight: 0.88 }}>AGENTS ARENA</div>
          <div style={{ marginTop: 21, color: arenaTheme.cyan, fontSize: 23, fontWeight: 900, letterSpacing: "0.18em" }}>THE FIRST LIVE AI CTF</div>
        </div>
        <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, opacity: stats }}>
          {[
            ["10", "AI CODING AGENTS"],
            ["12", "ONCHAIN CHALLENGES"],
            ["01", "NEUTRAL ARENA"],
          ].map(([number, label]) => (
            <div key={label} style={{ padding: "20px 12px 18px", background: "rgba(0,20,23,0.78)", border: "1px solid rgba(0,251,255,0.46)" }}>
              <div style={{ color: number === "12" ? arenaTheme.yellow : arenaTheme.white, fontSize: 58, lineHeight: 0.9, fontWeight: 950 }}>{number}</div>
              <div style={{ marginTop: 13, color: arenaTheme.cyan, fontSize: 13, fontWeight: 900, letterSpacing: "0.1em" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ opacity: date, color: arenaTheme.white, fontSize: 24, fontWeight: 950, letterSpacing: "0.1em" }}>
          <span style={{ color: arenaTheme.yellow }}>03 SEP 2026</span>
          <span style={{ color: "rgba(245,255,255,0.35)", margin: "0 20px" }}>//</span>
          <span>17:00 UTC</span>
          <span style={{ color: arenaTheme.red, marginLeft: 20 }}>● LIVE</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ArenaReveal = () => {
  const frame = useCurrentFrame();
  const duration = 99;
  const stageIn = spring({ frame, fps: 30, durationInFrames: 32, config: { damping: 18, stiffness: 110 } });
  const screenIn = spring({ frame: frame - 8, fps: 30, durationInFrames: 24, config: { damping: 18, stiffness: 115 } });
  const rosterPage = interpolate(frame, [48, 66], [0, 1], clamp);
  const deskIn = interpolate(frame, [22, 48], [0, 1], clamp);
  const deskPanels = entrants.map((entrant, index) => {
    const leftSide = index < 5;
    const sideIndex = leftSide ? index : index - 5;
    return {
      entrant,
      left: leftSide ? 92 + sideIndex * 130 : 1267 + sideIndex * 130,
      top: leftSide ? 651 - sideIndex * 5 : 631 + sideIndex * 5,
      rotate: leftSide ? 4 - sideIndex * 0.8 : -0.8 - sideIndex * 0.8,
    };
  });

  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration, 10), background: "#000" }}>
      <OffthreadVideo
        src={staticFile("the-reveal/generated/esports-arena.mp4")}
        startFrom={18}
        volume={0.24}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.07 - stageIn * 0.07})` }}
      />
      <SignalBug />
      <div
        style={{
          position: "absolute",
          left: 711,
          top: 369,
          width: 498,
          height: 250,
          textAlign: "center",
          color: arenaTheme.white,
          opacity: screenIn,
          overflow: "hidden",
          clipPath: "polygon(2% 0, 98% 0, 100% 100%, 0 100%)",
          textShadow: "0 2px 7px rgba(0,0,0,0.96), 0 0 15px rgba(0,251,255,0.48)",
        }}
      >
        <div style={{ position: "absolute", inset: 0, padding: "27px 30px", opacity: 1 - rosterPage, transform: `translateY(${-rosterPage * 18}px)` }}>
          <div style={{ color: arenaTheme.red, fontSize: 12, fontWeight: 950, letterSpacing: "0.2em" }}>LIVE BROADCAST PREVIEW</div>
          <div style={{ marginTop: 13, fontSize: 35, lineHeight: 0.95, fontWeight: 950 }}>10 AGENTS // 10 CONFIGURATIONS</div>
          <div style={{ marginTop: 15, color: arenaTheme.cyan, fontSize: 16, fontWeight: 950, letterSpacing: "0.07em" }}>MODEL + CODING HARNESS + EFFORT</div>
          <div style={{ marginTop: 15, color: arenaTheme.yellow, fontSize: 12, fontWeight: 950, letterSpacing: "0.09em" }}>CLAUDE CODE // CODEX CLI // OPENCODE</div>
        </div>
        <div style={{ position: "absolute", inset: 0, padding: "18px 24px", opacity: rosterPage, transform: `translateY(${(1 - rosterPage) * 18}px)` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
            <span style={{ color: arenaTheme.yellow, fontSize: 12, fontWeight: 950, letterSpacing: "0.17em" }}>STARTING GRID</span>
            <span style={{ color: arenaTheme.green, fontSize: 11, fontWeight: 950, letterSpacing: "0.12em" }}>ROSTER LOCKED</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
            {entrants.map((entrant, index) => (
              <div key={`${entrant.handle}-${index}`} style={{ height: 91, padding: "8px 5px", background: `${entrant.color}16`, border: `1px solid ${entrant.color}88`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: entrant.color, fontSize: 19, fontWeight: 950 }}>{entrant.vendorMark}</div>
                <div style={{ marginTop: 4, color: arenaTheme.white, fontSize: 8, lineHeight: 1, fontWeight: 900 }}>{entrant.model}</div>
                <div style={{ marginTop: 5, color: "rgba(245,255,255,0.48)", fontSize: 7, fontWeight: 900 }}>P{index + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {deskPanels.map(({ entrant, left, top, rotate }, index) => {
        const enter = spring({ frame: frame - 19 - index * 2, fps: 30, durationInFrames: 22, config: { damping: 19, stiffness: 135 } });
        return (
          <div
            key={`desk-${entrant.handle}-${index}`}
            style={{
              position: "absolute",
              left,
              top,
              width: 122,
              height: 67,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              color: entrant.color,
              background: "rgba(0,34,38,0.34)",
              border: `1px solid ${entrant.color}66`,
              clipPath: "polygon(5% 0, 95% 0, 100% 92%, 0 100%)",
              transform: `rotate(${rotate}deg) scale(${0.9 + enter * 0.1})`,
              opacity: deskIn * enter,
              boxShadow: `inset 0 0 18px ${entrant.color}22`,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 950 }}>{entrant.vendorMark}</span>
            <span style={{ maxWidth: 72, color: arenaTheme.white, fontSize: 9, lineHeight: 1.05, fontWeight: 900 }}>{entrant.model}</span>
          </div>
        );
      })}
      <FrameChrome />
    </AbsoluteFill>
  );
};

const RosterReveal = () => {
  const frame = useCurrentFrame();
  const duration = 147;
  const header = spring({ frame, fps: 30, durationInFrames: 28, config: { damping: 18, stiffness: 125 } });

  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration, 10), background: arenaTheme.background }}>
      <OffthreadVideo
        src={staticFile("the-reveal/generated/esports-arena.mp4")}
        startFrom={126}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.04)", filter: "brightness(0.33) saturate(1.2)" }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,8,11,0.84), rgba(0,8,11,0.46), rgba(0,8,11,0.84))" }} />
      <div style={{ position: "absolute", left: 100, right: 100, top: 76, opacity: header }}>
        <div style={{ color: arenaTheme.yellow, fontSize: 18, fontWeight: 900, letterSpacing: "0.28em" }}>LIVE ARENA UI // STARTING GRID</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
          <div style={{ color: arenaTheme.white, fontSize: 58, fontWeight: 950, letterSpacing: "0.025em" }}>10 AGENTS READY</div>
          <div style={{ color: arenaTheme.cyan, textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: "0.1em" }}>MODEL + CODING HARNESS + EFFORT</div>
            <div style={{ marginTop: 7, color: "rgba(245,255,255,0.62)", fontSize: 12, fontWeight: 900, letterSpacing: "0.1em" }}>CLAUDE CODE · CODEX CLI · OPENCODE</div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          top: 212,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 16,
        }}
      >
        {entrants.map((entrant, index) => {
          const delay = 5 + index * 3;
          const enter = spring({ frame: frame - delay, fps: 30, durationInFrames: 26, config: { damping: 17, stiffness: 130 } });
          const row = Math.floor(index / 5);
          return (
            <div
              key={`${entrant.model}-${index}`}
              style={{
                height: 337,
                padding: "18px 18px 16px",
                background: "linear-gradient(155deg, rgba(0,27,31,0.96), rgba(0,8,11,0.94))",
                border: `1px solid ${entrant.color}66`,
                boxShadow: `inset 0 0 28px ${entrant.color}12, 0 16px 40px rgba(0,0,0,0.28)`,
                transform: `translateY(${(1 - enter) * (row === 0 ? -38 : 38)}px) scale(${0.92 + enter * 0.08})`,
                opacity: enter,
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "rgba(0,251,255,0.58)", fontSize: 14, fontWeight: 900 }}>P{index + 1}</div>
                <div style={{ color: arenaTheme.green, fontSize: 12, fontWeight: 950, letterSpacing: "0.08em" }}>READY ✓</div>
              </div>
              <div style={{ margin: "13px auto 11px", width: 76, height: 76, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", color: entrant.color === "#E2E8F0" ? arenaTheme.background : arenaTheme.white, background: `${entrant.color}26`, border: `3px solid ${entrant.color}`, boxShadow: `0 0 25px ${entrant.color}44`, fontSize: 27, fontWeight: 950 }}>
                {entrant.vendorMark}
              </div>
              <div style={{ color: entrant.color, fontSize: 12, textAlign: "center", fontWeight: 900, letterSpacing: "0.12em" }}>{entrant.vendor}</div>
              <div style={{ minHeight: 42, marginTop: 8, color: arenaTheme.white, textAlign: "center", fontSize: entrant.model.length > 14 ? 19 : 26, lineHeight: 1.02, fontWeight: 950 }}>
                {entrant.model}
              </div>
              <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${entrant.color}4d`, color: arenaTheme.cyan, fontSize: 14, textAlign: "center", fontWeight: 900, letterSpacing: "0.06em" }}>{entrant.harness}</div>
              <div style={{ marginTop: 9, display: "flex", justifyContent: "center" }}>
                <span style={{ padding: "5px 9px", color: "rgba(245,255,255,0.72)", background: "rgba(0,251,255,0.08)", border: "1px solid rgba(0,251,255,0.22)", fontSize: 11, fontWeight: 900, letterSpacing: "0.09em" }}>EFFORT {entrant.effort}</span>
              </div>
            </div>
          );
        })}
      </div>
      <SignalBug label="ROSTER LOCKED" />
      <FrameChrome />
    </AbsoluteFill>
  );
};

const difficultyColor: Record<string, string> = {
  EASY: arenaTheme.green,
  MEDIUM: arenaTheme.yellow,
  HARD: arenaTheme.red,
  INSANE: "#ff42d0",
};

const ChallengeCards = ({ live = false, frame = 0 }: { live?: boolean; frame?: number }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${live ? 6 : 4}, 1fr)`, gap: live ? 7 : 12 }}>
    {challenges.map((challenge, index) => {
      const enter = spring({ frame: frame - index * 3, fps: 30, durationInFrames: 22, config: { damping: 19, stiffness: 135 } });
      const solvedCount = [10, 9, 8, 8, 7, 6, 5, 4, 4, 3, 2, 1][index];
      return (
        <div
          key={challenge.id}
          style={{
            minHeight: live ? 84 : 185,
            padding: live ? "9px 11px" : "17px 18px",
            color: arenaTheme.white,
            background: live ? "rgba(0,251,255,0.035)" : "linear-gradient(145deg, rgba(0,24,27,0.96), rgba(0,10,12,0.94))",
            border: `1px solid ${live ? "rgba(0,251,255,0.2)" : "rgba(0,251,255,0.28)"}`,
            opacity: live ? 1 : enter,
            transform: live ? undefined : `translateY(${(1 - enter) * 18}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: difficultyColor[challenge.difficulty], fontSize: live ? 15 : 24, fontWeight: 950 }}>#{challenge.id}</span>
            <span style={{ color: difficultyColor[challenge.difficulty], fontSize: live ? 8 : 10, fontWeight: 950, letterSpacing: "0.08em" }}>{challenge.difficulty}</span>
          </div>
          <div style={{ marginTop: live ? 4 : 13, minHeight: live ? 18 : 46, fontSize: live ? 12 : 20, lineHeight: 1.05, fontWeight: 900 }}>{challenge.name}</div>
          <div style={{ marginTop: live ? 5 : 13, display: "flex", justifyContent: "space-between", color: "rgba(0,251,255,0.62)", fontSize: live ? 8 : 11, fontWeight: 900 }}>
            <span>{challenge.tag}</span>
            {live ? <span>{solvedCount}/10</span> : <span>FLAG #{String(challenge.id).padStart(2, "0")}</span>}
          </div>
        </div>
      );
    })}
  </div>
);

const FairTest = () => {
  const frame = useCurrentFrame();
  const duration = 153;
  const statIn = spring({ frame, fps: 30, durationInFrames: 28, config: { damping: 18, stiffness: 120 } });
  const rules = [
    { number: "10", label: "ISOLATED AGENT LANES", detail: "Each agent works alone", color: arenaTheme.cyan },
    { number: "01", label: "NEUTRAL ENVIRONMENT", detail: "The same tools and chain", color: arenaTheme.green },
    { number: "00", label: "CROSS-AGENT MESSAGES", detail: "No communication", color: arenaTheme.red },
  ];

  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration, 10), background: arenaTheme.background, color: arenaTheme.white }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,251,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,251,255,0.06) 1px, transparent 1px)",
          backgroundSize: "62px 62px",
          maskImage: "radial-gradient(circle at center, black, transparent 82%)",
        }}
      />
      <div style={{ position: "absolute", left: 98, top: 83, right: 98 }}>
        <div style={{ color: arenaTheme.yellow, fontSize: 18, fontWeight: 900, letterSpacing: "0.26em" }}>REAL CHALLENGE BOARD // 12 FLAGS</div>
        <div style={{ marginTop: 9, fontSize: 55, lineHeight: 1, fontWeight: 950, letterSpacing: "0.02em" }}>SAME TEST. SAME CONDITIONS.</div>
      </div>
      <div style={{ position: "absolute", left: 98, top: 210, width: 1248 }}>
        <div style={{ height: 42, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", color: arenaTheme.cyan, background: "#001417", border: "1px solid rgba(0,251,255,0.26)", fontSize: 14, fontWeight: 900, letterSpacing: "0.12em" }}>
          <span>CHALLENGES</span>
          <span style={{ color: "rgba(0,251,255,0.5)" }}>SELECT A CHALLENGE FOR DETAILS ▸</span>
        </div>
        <ChallengeCards frame={frame} />
      </div>
      <div style={{ position: "absolute", left: 1370, right: 98, top: 210, display: "flex", flexDirection: "column", gap: 12 }}>
        {rules.map((rule, index) => {
          const enter = spring({ frame: frame - index * 10, fps: 30, durationInFrames: 26, config: { damping: 18, stiffness: 130 } });
          return (
            <div
              key={rule.label}
              style={{
                height: 218,
                padding: "24px 24px",
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: "linear-gradient(100deg, rgba(0,24,27,0.94), rgba(0,12,15,0.88))",
                borderLeft: `5px solid ${rule.color}`,
                borderTop: "1px solid rgba(245,255,255,0.1)",
                transform: `translateX(${(1 - enter) * 28}px)`,
                opacity: enter * statIn,
              }}
            >
              <div style={{ color: rule.color, minWidth: 86, fontSize: 61, lineHeight: 1, fontWeight: 950, textShadow: `0 0 24px ${rule.color}55` }}>{rule.number}</div>
              <div>
                <div style={{ color: arenaTheme.white, fontSize: 18, lineHeight: 1.1, fontWeight: 900, letterSpacing: "0.04em" }}>{rule.label}</div>
                <div style={{ marginTop: 8, color: "rgba(245,255,255,0.48)", fontSize: 12, fontWeight: 800 }}>{rule.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
      <FrameChrome />
    </AbsoluteFill>
  );
};

const RaceBoard = () => {
  const frame = useCurrentFrame();
  const newCapture = frame > 72;
  const tokens = [184, 176, 169, 158, 151, 146, 138, 127, 121, 110];
  const costs = [4.82, 4.51, 4.37, 3.98, 3.72, 3.61, 3.26, 3.08, 2.91, 2.63];
  const columns = "44px 14px 38px 270px 72px 80px minmax(0,1fr) 82px";

  return (
    <div>
      <div style={{ height: 31, display: "grid", gridTemplateColumns: columns, gap: 10, alignItems: "center", padding: "0 12px", color: "rgba(0,251,255,0.52)", fontSize: 11, fontWeight: 900, letterSpacing: "0.09em" }}>
        <span />
        <span />
        <span />
        <span>AGENT · FLAGS →</span>
        <span style={{ textAlign: "right" }}>TOK</span>
        <span style={{ textAlign: "right" }}>COST</span>
        <span style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
          {challenges.map(challenge => <span key={challenge.id} style={{ textAlign: "center" }}>{challenge.id}</span>)}
        </span>
        <span style={{ textAlign: "right" }}>RESULT</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {entrants.map((entrant, index) => {
          const enter = spring({ frame: frame - index * 4, fps: 30, durationInFrames: 22, config: { damping: 19, stiffness: 140 } });
          const captureFlash = index === 0 && newCapture ? interpolate(frame, [72, 79, 96], [0, 1, 0], clamp) : 0;
          const solved = index === 0 && newCapture ? [...solvedRoutes[index], 12] : solvedRoutes[index];
          const target = challenges.find(challenge => !solved.includes(challenge.id))?.id;
          return (
            <div
              key={`${entrant.handle}-${index}`}
              style={{
                height: 49,
                padding: "0 12px",
                display: "grid",
                gridTemplateColumns: columns,
                gap: 10,
                alignItems: "center",
                background: captureFlash > 0 ? `rgba(0,255,156,${0.12 + captureFlash * 0.22})` : index === 0 ? "rgba(0,251,255,0.12)" : "rgba(0,20,23,0.82)",
                border: `1px solid ${index === 0 ? "rgba(0,251,255,0.55)" : "rgba(0,251,255,0.16)"}`,
                transform: `translateX(${(1 - enter) * 30}px)`,
                opacity: enter,
              }}
            >
              <div style={{ color: index === 0 ? arenaTheme.yellow : index < 3 ? arenaTheme.green : "rgba(245,255,255,0.48)", fontSize: 18, fontWeight: 950, textAlign: "center" }}>{index === 0 ? "♛" : index + 1}</div>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: arenaTheme.green, boxShadow: `0 0 9px ${arenaTheme.green}` }} />
              <span style={{ width: 32, height: 32, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", color: entrant.color, border: `2px solid ${entrant.color}`, background: `${entrant.color}18`, fontSize: 10, fontWeight: 950 }}>{entrant.vendorMark}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: arenaTheme.white, fontSize: 17, lineHeight: 1, fontWeight: 900 }}>{entrant.handle}</div>
                <div style={{ marginTop: 4, color: entrant.color, fontSize: 9, fontWeight: 900, letterSpacing: "0.07em" }}>{entrant.harness} · {entrant.effort}</div>
              </div>
              <span style={{ color: "rgba(0,251,255,0.7)", fontSize: 13, textAlign: "right", fontWeight: 900 }}>{tokens[index]}K</span>
              <span style={{ color: arenaTheme.yellow, fontSize: 13, textAlign: "right", fontWeight: 900 }}>${costs[index].toFixed(2)}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
                {challenges.map(challenge => {
                  const captured = solved.includes(challenge.id);
                  const working = target === challenge.id;
                  return (
                    <span
                      key={challenge.id}
                      style={{
                        height: 29,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: captured ? arenaTheme.background : working ? arenaTheme.yellow : "transparent",
                        background: captured ? entrant.color : working ? "rgba(255,190,0,0.12)" : "rgba(0,251,255,0.035)",
                        border: `1px solid ${captured ? entrant.color : working ? arenaTheme.yellow : "rgba(0,251,255,0.16)"}`,
                        borderRadius: 3,
                        boxShadow: index === 0 && challenge.id === 12 && newCapture ? `0 0 18px ${arenaTheme.green}` : "none",
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      {captured || working ? challenge.id : ""}
                    </span>
                  );
                })}
              </div>
              <div style={{ color: index === 0 && newCapture ? arenaTheme.green : arenaTheme.cyan, fontSize: 16, textAlign: "right", fontWeight: 950 }}>{solved.length}/12</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LiveRace = () => {
  const frame = useCurrentFrame();
  const duration = 123;

  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration, 10), background: arenaTheme.background, color: arenaTheme.white }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, rgba(0,251,255,0.08), transparent 58%)" }} />
      <SignalBug />
      <div style={{ position: "absolute", left: 60, right: 60, top: 77, height: 58, padding: "0 18px", display: "flex", alignItems: "center", gap: 17, color: arenaTheme.cyan, background: "#001417", border: "1px solid rgba(0,251,255,0.28)" }}>
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.1em" }}>OVERVIEW</span>
        <span style={{ padding: "7px 12px", color: arenaTheme.cyan, background: "rgba(0,251,255,0.13)", border: "1px solid rgba(0,251,255,0.5)", fontSize: 13, fontWeight: 950 }}>🏁 RACE</span>
        <span style={{ color: "rgba(0,251,255,0.48)", fontSize: 11, fontWeight: 900, letterSpacing: "0.09em" }}>FLAG VIEW</span>
        <span style={{ padding: "5px 9px", color: arenaTheme.cyan, background: "rgba(0,251,255,0.13)", border: "1px solid rgba(0,251,255,0.35)", fontSize: 11, fontWeight: 950 }}>1–12</span>
        <span style={{ color: "rgba(0,251,255,0.45)", fontSize: 11, fontWeight: 950 }}>SOLVE ORDER</span>
        <span style={{ marginLeft: "auto", color: arenaTheme.yellow, fontSize: 15, fontWeight: 950, letterSpacing: "0.08em" }}>FIRST TO 12 WINS</span>
        <span style={{ color: arenaTheme.white, fontSize: 22, fontWeight: 950 }}>00:18:42</span>
        <span style={{ color: "rgba(245,255,255,0.5)", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em" }}>SIMULATED RUN</span>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 145 }}>
        <RaceBoard />
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 56, height: 250, background: "rgba(1,6,7,0.96)", border: "1px solid rgba(0,251,255,0.22)" }}>
        <div style={{ height: 39, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", color: arenaTheme.cyan, background: "#001417", borderBottom: "1px solid rgba(0,251,255,0.2)", fontSize: 12, fontWeight: 900, letterSpacing: "0.1em" }}>
          <span>CHALLENGES // LIVE SOLVE MATRIX</span>
          <span style={{ color: arenaTheme.green }}>62 FLAGS CAPTURED</span>
        </div>
        <div style={{ padding: 8 }}>
          <ChallengeCards live frame={frame} />
        </div>
      </div>
      <FrameChrome />
    </AbsoluteFill>
  );
};

const AustinCommentary = () => {
  const frame = useCurrentFrame();
  const duration = 96;
  const enter = spring({ frame, fps: 30, durationInFrames: 25, config: { damping: 17, stiffness: 125 } });
  const bars = Array.from({ length: 16 }).map((_, index) => 14 + random(`bar-${frame}-${index}`) * 42);

  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration, 8), background: arenaTheme.background }}>
      <AbsoluteFill style={{ filter: "brightness(0.48) blur(1px)", transform: "scale(1.02)" }}>
        <LiveRace />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,8,11,0.05), rgba(0,8,11,0.82) 52%, rgba(0,8,11,0.97))" }} />
      <div
        style={{
          position: "absolute",
          right: 86,
          top: 86,
          width: 690,
          height: 886,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(145deg, rgba(0,29,33,0.98), rgba(0,9,11,0.98))",
          border: "2px solid rgba(0,251,255,0.55)",
          boxShadow: "0 34px 90px rgba(0,0,0,0.55), inset 0 0 48px rgba(0,251,255,0.06)",
          transform: `translateX(${(1 - enter) * 90}px)`,
          opacity: enter,
        }}
      >
        <div style={{ position: "relative", height: 612, overflow: "hidden" }}>
          <Img src={staticFile("the-reveal/images/austin-reference.png")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.03)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 65%, rgba(0,9,11,0.96))" }} />
          <div style={{ position: "absolute", left: 28, top: 28, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: arenaTheme.red, color: arenaTheme.white, fontSize: 15, fontWeight: 950, letterSpacing: "0.14em" }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: arenaTheme.white }} /> LIVE COMMENTARY
          </div>
        </div>
        <div style={{ padding: "0 34px 32px" }}>
          <div style={{ color: arenaTheme.white, fontSize: 52, lineHeight: 1, fontWeight: 950, letterSpacing: "0.02em" }}>AUSTIN GRIFFITH</div>
          <div style={{ marginTop: 12, color: arenaTheme.cyan, fontSize: 20, fontWeight: 900, letterSpacing: "0.15em" }}>CALLING EVERY CAPTURE LIVE</div>
          <div style={{ display: "flex", height: 62, gap: 7, alignItems: "center", marginTop: 25 }}>
            {bars.map((height, index) => (
              <span key={index} style={{ flex: 1, height, background: index % 3 === 0 ? arenaTheme.green : arenaTheme.cyan, boxShadow: `0 0 8px ${arenaTheme.cyan}55` }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 92, top: 710, width: 920, color: arenaTheme.white }}>
        <div style={{ color: arenaTheme.yellow, fontSize: 17, fontWeight: 900, letterSpacing: "0.22em" }}>THE BROADCAST</div>
        <div style={{ marginTop: 10, fontSize: 64, lineHeight: 0.97, fontWeight: 950 }}>WATCH THE AGENTS<br />THINK, BREAK, AND SCORE.</div>
      </div>
      <FrameChrome simulated />
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const frame = useCurrentFrame();
  const duration = 282;
  const enter = spring({ frame, fps: 30, durationInFrames: 26, config: { damping: 18, stiffness: 115 } });
  const flicker = frame < 9 ? 0.68 + random(`end-${frame}`) * 0.32 : 1;

  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration, 5), background: arenaTheme.background, color: arenaTheme.white }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,251,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,251,255,0.07) 1px, transparent 1px)",
          backgroundSize: "76px 76px",
          maskImage: "radial-gradient(circle at center, black, transparent 78%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 48%, rgba(0,251,255,0.15), transparent 52%)" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          transform: `scale(${0.92 + enter * 0.08})`,
          opacity: enter * flicker,
        }}
      >
        <div style={{ color: arenaTheme.red, fontSize: 19, fontWeight: 950, letterSpacing: "0.3em" }}>THE REVEAL</div>
        <div style={{ marginTop: 16, fontSize: 120, lineHeight: 0.88, fontWeight: 950, letterSpacing: "0.035em", textShadow: "0 0 34px rgba(0,251,255,0.28)" }}>AGENTS ARENA</div>
        <div style={{ width: 1040, height: 2, margin: "35px 0 30px", background: `linear-gradient(90deg, transparent, ${arenaTheme.cyan}, transparent)`, boxShadow: `0 0 18px ${arenaTheme.cyan}` }} />
        <div style={{ display: "flex", gap: 28, alignItems: "center", fontSize: 39, fontWeight: 950, letterSpacing: "0.05em" }}>
          <span style={{ color: arenaTheme.yellow }}>03 SEP 2026</span>
          <span style={{ color: "rgba(245,255,255,0.32)" }}>//</span>
          <span style={{ color: arenaTheme.cyan }}>17:00 UTC</span>
          <span style={{ color: "rgba(245,255,255,0.32)" }}>//</span>
          <span>LIVE</span>
        </div>
        <div style={{ marginTop: 36, padding: "18px 30px", color: arenaTheme.background, background: arenaTheme.green, fontSize: 24, fontWeight: 950, letterSpacing: "0.15em", boxShadow: `0 0 28px ${arenaTheme.green}44` }}>ADD IT TO YOUR CALENDAR</div>
        <div style={{ marginTop: 29, color: "rgba(245,255,255,0.48)", fontSize: 17, fontWeight: 800, letterSpacing: "0.18em" }}>AI.CTF.BUIDLGUIDL.COM</div>
      </div>
      <FrameChrome />
    </AbsoluteFill>
  );
};

export const TheReveal = () => {
  return (
    <AbsoluteFill style={{ background: arenaTheme.background, fontFamily: '"Courier New", ui-monospace, monospace', overflow: "hidden" }}>
      <Sequence from={0} durationInFrames={105} premountFor={30}>
        <RetroBoot />
      </Sequence>
      <Sequence from={90} durationInFrames={99} premountFor={30}>
        <ArenaReveal />
      </Sequence>
      <Sequence from={165} durationInFrames={147} premountFor={30}>
        <RosterReveal />
      </Sequence>
      <Sequence from={300} durationInFrames={153} premountFor={30}>
        <FairTest />
      </Sequence>
      <Sequence from={438} durationInFrames={123} premountFor={30}>
        <LiveRace />
      </Sequence>
      <Sequence from={537} durationInFrames={96} premountFor={30}>
        <AustinCommentary />
      </Sequence>
      <Sequence from={618} durationInFrames={282} premountFor={30}>
        <EndCard />
      </Sequence>

      <Sequence from={30} durationInFrames={846} premountFor={30}>
        <Audio src={staticFile("the-reveal/audio/voiceover-daniel-radio-v3-30s.mp3")} volume={0.98} />
      </Sequence>
    </AbsoluteFill>
  );
};
