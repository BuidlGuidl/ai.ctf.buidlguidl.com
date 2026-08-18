import { arenaTheme } from "../theme";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const STARTER_DURATION_IN_FRAMES = 180;

export type AgentArenaStarterProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  status: string;
};

export const AgentArenaStarter = ({ eyebrow, title, subtitle, status }: AgentArenaStarterProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, height, width } = useVideoConfig();
  const portrait = height > width;

  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.75, stiffness: 120 },
    durationInFrames: Math.round(1.1 * fps),
  });
  const opacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [durationInFrames - 0.6 * fps, durationInFrames - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanlineY = interpolate(frame, [0, durationInFrames], [-height * 0.15, height * 1.15]);
  const progress = interpolate(frame, [0.6 * fps, 2.1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const edge = portrait ? 76 : 112;
  const titleSize = portrait ? 116 : 142;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: arenaTheme.background,
        color: arenaTheme.cyan,
        fontFamily: '"Courier New", ui-monospace, monospace',
        opacity: Math.min(opacity, exitOpacity),
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,251,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,251,255,0.06) 1px, transparent 1px)",
          backgroundSize: portrait ? "72px 72px" : "88px 88px",
          maskImage: "radial-gradient(circle at center, black 20%, transparent 78%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(0,251,255,0.13) 0%, rgba(0,20,24,0.04) 36%, transparent 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanlineY,
          height: portrait ? 5 : 4,
          background: `linear-gradient(90deg, transparent 4%, ${arenaTheme.cyan} 50%, transparent 96%)`,
          boxShadow: `0 0 34px ${arenaTheme.cyan}`,
          opacity: 0.28,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: edge,
          border: `2px solid rgba(0, 251, 255, 0.26)`,
          borderRadius: 28,
          boxShadow: "inset 0 0 70px rgba(0,251,255,0.04)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: edge + (portrait ? 58 : 82),
          right: edge + (portrait ? 58 : 82),
          top: "50%",
          transform: `translateY(calc(-50% + ${(1 - entrance) * 48}px))`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 18,
            color: arenaTheme.yellow,
            fontSize: portrait ? 27 : 30,
            fontWeight: 700,
            letterSpacing: "0.2em",
            opacity: entrance,
          }}
        >
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              backgroundColor: arenaTheme.green,
              boxShadow: `0 0 22px ${arenaTheme.green}`,
            }}
          />
          {eyebrow}
        </div>

        <h1
          style={{
            margin: portrait ? "56px 0 34px" : "48px 0 28px",
            color: arenaTheme.white,
            fontSize: titleSize,
            lineHeight: 0.94,
            letterSpacing: portrait ? "0.035em" : "0.055em",
            textShadow: "0 0 34px rgba(0,251,255,0.28)",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: portrait ? 760 : 1120,
            color: "rgba(0,251,255,0.68)",
            fontSize: portrait ? 36 : 39,
            lineHeight: 1.38,
          }}
        >
          {subtitle}
        </p>

        <div
          style={{
            width: portrait ? "100%" : 880,
            height: 5,
            marginTop: portrait ? 76 : 62,
            overflow: "hidden",
            borderRadius: 999,
            backgroundColor: "rgba(0,251,255,0.12)",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${arenaTheme.green}, ${arenaTheme.cyan})`,
              boxShadow: `0 0 20px ${arenaTheme.cyan}`,
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: edge + 40,
          right: edge + 40,
          bottom: edge + 36,
          display: "flex",
          justifyContent: "space-between",
          color: "rgba(0,251,255,0.5)",
          fontSize: portrait ? 23 : 25,
          fontWeight: 700,
          letterSpacing: "0.14em",
        }}
      >
        <span>{status}</span>
        <span>
          {portrait ? "9:16" : "16:9"} · {fps} FPS
        </span>
      </div>
    </AbsoluteFill>
  );
};
