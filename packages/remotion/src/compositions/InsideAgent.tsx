import type {CSSProperties, ReactNode} from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {arenaTheme} from "../theme";

const FPS = 30;
const W = 1920;
const H = 862;
const fontFamily = '"Courier New", ui-monospace, monospace';
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
export const INSIDE_AGENT_DURATION_IN_FRAMES = 900;

const frames = (seconds: number) => Math.round(seconds * FPS);
const fade = (frame: number, duration: number, edge = 14) =>
  Math.min(
    interpolate(frame, [0, edge], [0, 1], clamp),
    interpolate(frame, [duration - edge, duration], [1, 0], clamp),
  );

const Source = ({
  second,
  focusX = W / 2,
  focusY = H / 2,
  scale = 1,
  brightness = 1.18,
  dim = 0,
}: {
  second: number;
  focusX?: number;
  focusY?: number;
  scale?: number;
  brightness?: number;
  dim?: number;
}) => (
  <AbsoluteFill style={{overflow: "hidden", background: arenaTheme.background}}>
    <OffthreadVideo
      src={staticFile("inside-agent/real-run-thinking.mp4")}
      startFrom={frames(second)}
      muted
      style={{
        position: "absolute",
        left: 960 - focusX * scale,
        top: 540 - focusY * scale,
        width: W * scale,
        height: H * scale,
        maxWidth: "none",
        filter: "brightness(" + brightness + ") contrast(1.055) saturate(1.08)",
      }}
    />
    {dim ? <AbsoluteFill style={{background: "rgba(0,8,11," + dim + ")"}} /> : null}
  </AbsoluteFill>
);

const chromeLine: CSSProperties = {
  position: "absolute",
  left: 38,
  right: 38,
  height: 1,
};

const Chrome = ({label = "LIVE AGENT POV"}: {label?: string}) => (
  <AbsoluteFill style={{pointerEvents: "none"}}>
    <div
      style={{
        ...chromeLine,
        top: 28,
        opacity: 0.45,
        background:
          "linear-gradient(90deg, " +
          arenaTheme.cyan +
          ", transparent 18%, transparent 82%, " +
          arenaTheme.cyan +
          ")",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 52,
        top: 42,
        color: arenaTheme.cyan,
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: "0.16em",
        textShadow: "0 0 16px rgba(0,251,255,0.55)",
      }}
    >
      <span style={{color: arenaTheme.red}}>*</span> {label}
    </div>
    <div
      style={{
        position: "absolute",
        right: 52,
        top: 42,
        color: "rgba(245,255,255,0.62)",
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: "0.14em",
      }}
    >
      AGENTS ARENA // SEPT 3
    </div>
    <div
      style={{
        ...chromeLine,
        bottom: 28,
        opacity: 0.35,
        background:
          "linear-gradient(90deg, " +
          arenaTheme.yellow +
          ", transparent 22%, transparent 78%, " +
          arenaTheme.yellow +
          ")",
      }}
    />
  </AbsoluteFill>
);

const Headline = ({
  children,
  color = arenaTheme.white,
  size = 62,
  top = 890,
  opacity = 1,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  top?: number;
  opacity?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: 70,
      right: 70,
      top,
      color,
      opacity,
      fontSize: size,
      lineHeight: 0.98,
      fontWeight: 950,
      letterSpacing: "0.035em",
      textAlign: "center",
      textShadow: "0 4px 13px rgba(0,0,0,0.98), 0 0 26px rgba(0,251,255,0.28)",
    }}
  >
    {children}
  </div>
);

const Pill = ({children, color}: {children: ReactNode; color: string}) => (
  <div
    style={{
      padding: "12px 22px 10px",
      border: "1px solid " + color + "99",
      background: "rgba(0,9,11,0.88)",
      color,
      fontSize: 26,
      lineHeight: 1,
      fontWeight: 950,
      letterSpacing: "0.1em",
      boxShadow: "inset 0 0 22px " + color + "12, 0 0 22px rgba(0,0,0,0.72)",
      clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)",
    }}
  >
    {children}
  </div>
);

const Vignette = ({strong = false}: {strong?: boolean}) => (
  <AbsoluteFill
    style={{
      background: strong
        ? "linear-gradient(180deg,rgba(0,8,11,.82),transparent 23%,transparent 68%,rgba(0,8,11,.92))"
        : "linear-gradient(180deg,rgba(0,8,11,.7),transparent 22%,transparent 72%,rgba(0,8,11,.82))",
    }}
  />
);

const Hook = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  const easing = {easing: Easing.inOut(Easing.cubic), ...clamp};
  const scale = interpolate(frame, [95, 220], [1, 1.28], easing);
  const focusX = interpolate(frame, [95, 220], [960, 1050], easing);
  const focusY = interpolate(frame, [95, 220], [431, 360], easing);
  const first = Math.min(
    interpolate(frame, [8, 20], [0, 1], clamp),
    interpolate(frame, [86, 105], [1, 0], clamp),
  );
  const second = interpolate(frame, [98, 116], [0, 1], clamp);
  const intro = interpolate(frame, [0, 14], [0, 1], clamp);
  return (
    <AbsoluteFill style={{opacity: intro}}>
      <Source second={286} focusX={focusX} focusY={focusY} scale={scale} />
      <Vignette strong />
      <Chrome label="LIVE RACE // SELECTED AGENT LOG" />
      <Headline top={850} size={59} opacity={first}>
        THE SCOREBOARD SHOWS WHO IS WINNING.
      </Headline>
      <Headline top={850} size={64} opacity={second} color={arenaTheme.yellow}>
        THE AGENT LOG SHOWS WHY.
      </Headline>
    </AbsoluteFill>
  );
};

const ExploreAgent = () => {
  const frame = useCurrentFrame();
  const easing = {easing: Easing.inOut(Easing.cubic), ...clamp};
  const scale =
    frame < 210
      ? interpolate(frame, [0, 75, 170, 210], [1.08, 1.34, 1.34, 1.12], easing)
      : interpolate(frame, [210, 350], [1.12, 1.03], easing);
  const focusX =
    frame < 210
      ? interpolate(frame, [0, 75, 170, 210], [960, 1170, 1170, 960], easing)
      : 960;
  const focusY =
    frame < 210
      ? interpolate(frame, [0, 75, 170, 210], [431, 320, 320, 431], easing)
      : 431;
  const raw = Math.min(
    interpolate(frame, [4, 16], [0, 1], clamp),
    interpolate(frame, [54, 70], [1, 0], clamp),
  );
  const narration = Math.min(
    interpolate(frame, [62, 77], [0, 1], clamp),
    interpolate(frame, [202, 220], [1, 0], clamp),
  );
  const follow = interpolate(frame, [210, 228], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Source
        second={169}
        focusX={focusX}
        focusY={focusY}
        scale={scale}
        brightness={1.22}
      />
      <Vignette />
      <Chrome label="FOLLOWING SELECTED AGENT" />
      <Headline top={905} size={50} opacity={raw}>
        RAW LOGS: THOUGHTS + COMMANDS
      </Headline>
      <Headline top={905} size={54} opacity={narration} color={arenaTheme.yellow}>
        RAW LOGS, EXPLAINED LIVE.
      </Headline>
      <Headline top={905} size={52} opacity={follow} color={arenaTheme.cyan}>
        FOLLOW ANY AGENT. SWITCH AT ANY TIME.
      </Headline>
    </AbsoluteFill>
  );
};

const KimiLog = () => {
  const frame = useCurrentFrame();
  const easing = {easing: Easing.inOut(Easing.cubic), ...clamp};
  const scale = interpolate(frame, [28, 75], [1.06, 1.34], easing);
  const focusX = interpolate(frame, [28, 75], [960, 1170], easing);
  const focusY = interpolate(frame, [28, 75], [431, 320], easing);
  const index = frame < 56 ? 0 : frame < 110 ? 1 : 2;
  const labels = ["WHAT IT THINKS", "WHAT IT TRIES", "EVERY COMMAND"];
  const colors = [arenaTheme.white, arenaTheme.yellow, arenaTheme.cyan];
  const cueStart = [4, 56, 110][index];
  const cue = interpolate(frame - cueStart, [0, 10], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Source
        second={230}
        focusX={focusX}
        focusY={focusY}
        scale={scale}
        brightness={1.22}
      />
      <Vignette />
      <Chrome label="AGENT LOG // OPENCODE-KIMI-K3" />
      <div style={{position: "absolute", left: 72, bottom: 70, opacity: cue}}>
        <Pill color={colors[index]}>{labels[index]}</Pill>
      </div>
    </AbsoluteFill>
  );
};

const SignalCut = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5, 10, 16], [0, 1, 1, 0], clamp);
  const lineY = interpolate(frame, [0, 16], [-80, 1160], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        zIndex: 20,
        opacity,
        pointerEvents: "none",
        background:
          "linear-gradient(180deg,rgba(0,8,11,.96),rgba(0,14,17,.98))",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: lineY,
          height: 4,
          background: arenaTheme.cyan,
          boxShadow: "0 0 28px rgba(0,251,255,.85)",
        }}
      />
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const frame = useCurrentFrame();
  const duration = 135;
  const title = spring({
    frame: frame - 4,
    fps: FPS,
    durationInFrames: 30,
    config: {damping: 18, stiffness: 115},
  });
  const details = interpolate(frame, [28, 44], [0, 1], clamp);
  const url = interpolate(frame, [50, 67], [0, 1], clamp);
  return (
    <AbsoluteFill style={{opacity: fade(frame, duration, 10)}}>
      <Source second={294} scale={1.08} brightness={1.15} dim={0.7} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 47%,rgba(0,251,255,.12),rgba(0,9,11,.44) 40%,rgba(0,6,8,.9) 82%)",
        }}
      />
      <Chrome label="AGENTS ARENA // LIVE" />
      <div
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          top: 270,
          color: arenaTheme.white,
          textAlign: "center",
          opacity: title,
          transform: "translateY(" + (1 - title) * 28 + "px)",
        }}
      >
        <div
          style={{
            fontSize: 94,
            lineHeight: 0.95,
            fontWeight: 950,
            letterSpacing: "0.035em",
            textShadow: "0 0 30px rgba(0,251,255,.58),0 7px 24px rgba(0,0,0,.95)",
          }}
        >
          WATCH THEM THINK.
        </div>
        <div
          style={{
            marginTop: 16,
            color: arenaTheme.cyan,
            fontSize: 78,
            lineHeight: 1,
            fontWeight: 950,
            letterSpacing: "0.09em",
          }}
        >
          LIVE.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 585,
          color: arenaTheme.yellow,
          opacity: details,
          textAlign: "center",
          fontSize: 48,
          fontWeight: 950,
          letterSpacing: "0.12em",
        }}
      >
        SEPT 3
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 698,
          color: arenaTheme.white,
          opacity: url,
          textAlign: "center",
          fontSize: 55,
          fontWeight: 950,
          letterSpacing: "0.035em",
          textShadow: "0 0 24px rgba(0,251,255,.45)",
        }}
      >
        AI.CTF.BUIDLGUIDL.COM
      </div>
    </AbsoluteFill>
  );
};

const Scene = ({
  from,
  duration,
  children,
}: {
  from: number;
  duration: number;
  children: ReactNode;
}) => (
  <Sequence from={from} durationInFrames={duration} premountFor={30}>
    {children}
  </Sequence>
);

export const InsideAgent = () => (
  <AbsoluteFill
    style={{
      overflow: "hidden",
      background: arenaTheme.background,
      color: arenaTheme.white,
      fontFamily,
    }}
  >
    <Scene from={0} duration={240}><Hook /></Scene>
    <Scene from={240} duration={360}><ExploreAgent /></Scene>
    <Scene from={600} duration={165}><KimiLog /></Scene>
    <Scene from={765} duration={135}><EndCard /></Scene>
    <Scene from={232} duration={16}><SignalCut /></Scene>
    <Scene from={592} duration={16}><SignalCut /></Scene>
    <Scene from={757} duration={16}><SignalCut /></Scene>
  </AbsoluteFill>
);
