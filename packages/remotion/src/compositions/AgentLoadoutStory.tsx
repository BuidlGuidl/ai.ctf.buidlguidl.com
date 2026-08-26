import type { CSSProperties } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { arenaTheme } from "../theme";
import { AgentLoadoutTour, AGENT_LOADOUT_TOUR_DURATION_IN_FRAMES } from "./AgentLoadoutTour";

const TOUR_START_IN_FRAMES = 135;
const INTRO_END_IN_FRAMES = 150;

export const AGENT_LOADOUT_STORY_DURATION_IN_FRAMES =
  TOUR_START_IN_FRAMES + AGENT_LOADOUT_TOUR_DURATION_IN_FRAMES;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const storyPanel: CSSProperties = {
  background: "linear-gradient(155deg, rgba(4,20,24,0.98), rgba(0,8,11,0.96))",
  border: "1px solid rgba(0,251,255,0.24)",
  boxShadow: "inset 0 0 42px rgba(0,251,255,0.035), 0 24px 60px rgba(0,0,0,0.5)",
};

const CornerMarks = ({ color }: { color: string }) => (
  <>
    {[
      ["top", "left"],
      ["top", "right"],
      ["bottom", "left"],
      ["bottom", "right"],
    ].map(([vertical, horizontal]) => (
      <div
        key={`${vertical}-${horizontal}`}
        style={{
          position: "absolute",
          width: 22,
          height: 22,
          top: vertical === "top" ? 12 : undefined,
          bottom: vertical === "bottom" ? 12 : undefined,
          left: horizontal === "left" ? 12 : undefined,
          right: horizontal === "right" ? 12 : undefined,
          borderTop: vertical === "top" ? `2px solid ${color}` : undefined,
          borderBottom: vertical === "bottom" ? `2px solid ${color}` : undefined,
          borderLeft: horizontal === "left" ? `2px solid ${color}` : undefined,
          borderRight: horizontal === "right" ? `2px solid ${color}` : undefined,
          opacity: 0.65,
        }}
      />
    ))}
  </>
);

const AgentProfileCard = ({ morph, enter }: { morph: number; enter: number }) => {
  const left = interpolate(morph, [0, 1], [110, 44]);
  const top = interpolate(morph, [0, 1], [250, 136]);
  const width = interpolate(morph, [0, 1], [440, 252]);
  const height = interpolate(morph, [0, 1], [560, 168]);
  const detailOpacity = interpolate(morph, [0, 0.25, 0.48], [1, 0.55, 0], clamp);
  const compactOpacity = interpolate(morph, [0.48, 0.82], [0, 1], clamp);

  return (
    <div
      style={{
        ...storyPanel,
        position: "absolute",
        left,
        top,
        width,
        height,
        overflow: "hidden",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 35}px)`,
        borderColor: "rgba(168,85,247,0.66)",
        boxShadow: "inset 0 0 44px rgba(168,85,247,0.08), 0 0 46px rgba(168,85,247,0.16)",
      }}
    >
      <CornerMarks color="#A855F7" />

      <div style={{ position: "absolute", inset: 28, opacity: detailOpacity }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#A855F7", fontSize: 12, fontWeight: 950, letterSpacing: "0.18em" }}>
          <span>P3 // AGENT PROFILE</span>
          <span style={{ color: arenaTheme.green }}>READY ✓</span>
        </div>

        <div style={{ width: 132, height: 132, margin: "42px auto 0", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", color: "#A855F7", border: "3px solid #A855F7", background: "radial-gradient(circle, rgba(168,85,247,0.24), rgba(0,8,11,0.9) 68%)", boxShadow: "0 0 38px rgba(168,85,247,0.34)", fontSize: 44, fontWeight: 950 }}>
          OA
        </div>

        <div style={{ marginTop: 25, textAlign: "center" }}>
          <div style={{ color: "rgba(245,255,255,0.48)", fontSize: 11, fontWeight: 950, letterSpacing: "0.2em" }}>OPENAI</div>
          <div style={{ marginTop: 10, fontSize: 34, lineHeight: 1, fontWeight: 950 }}>GPT-5.5</div>
          <div style={{ marginTop: 13, color: arenaTheme.cyan, fontSize: 16, fontWeight: 950, letterSpacing: "0.08em" }}>CODEX // EFFORT HIGH</div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "17px 18px", color: "rgba(245,255,255,0.68)", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.28)", textAlign: "center", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em" }}>
          AGENT ID // CODEX-GPT-55
        </div>
      </div>

      <div style={{ position: "absolute", inset: 18, display: "flex", alignItems: "center", gap: 15, opacity: compactOpacity }}>
        <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", color: arenaTheme.cyan, border: `2px solid ${arenaTheme.cyan}`, background: "rgba(0,251,255,0.08)", fontSize: 24, fontWeight: 950 }}>OA</div>
        <div>
          <div style={{ color: arenaTheme.red, fontSize: 9, fontWeight: 950, letterSpacing: "0.15em" }}>P3 // ATTACKER</div>
          <div style={{ marginTop: 6, fontSize: 19, lineHeight: 1, fontWeight: 950 }}>GPT-5.5</div>
          <div style={{ marginTop: 7, color: arenaTheme.cyan, fontSize: 10, fontWeight: 900 }}>CODEX // HIGH</div>
        </div>
      </div>
    </div>
  );
};

const ChallengeBrief = ({ enter, morph }: { enter: number; morph: number }) => (
  <div
    style={{
      ...storyPanel,
      position: "absolute",
      left: 1400 + morph * 90,
      top: 292,
      width: 410,
      height: 455,
      padding: "26px 28px",
      opacity: enter * (1 - morph),
      transform: `translateX(${(1 - enter) * 36}px)`,
      borderColor: "rgba(255,225,77,0.5)",
    }}
  >
    <CornerMarks color={arenaTheme.yellow} />
    <div style={{ display: "flex", justifyContent: "space-between", color: arenaTheme.yellow, fontSize: 11, fontWeight: 950, letterSpacing: "0.17em" }}>
      <span>NEXT FLAG</span>
      <span>06 / 12</span>
    </div>
    <div style={{ marginTop: 35, color: "rgba(245,255,255,0.45)", fontSize: 11, fontWeight: 950, letterSpacing: "0.15em" }}>CHALLENGE BRIEF</div>
    <div style={{ marginTop: 11, fontSize: 38, lineHeight: 1.03, fontWeight: 950, letterSpacing: "0.01em" }}>GIVE ME MY<br />POINTS!</div>

    <div style={{ marginTop: 28, display: "flex", gap: 8 }}>
      <span style={{ padding: "8px 10px", color: arenaTheme.red, background: "rgba(255,88,97,0.08)", border: "1px solid rgba(255,88,97,0.42)", fontSize: 10, fontWeight: 950, letterSpacing: "0.11em" }}>REENTRANCY</span>
      <span style={{ padding: "8px 10px", color: arenaTheme.yellow, background: "rgba(255,225,77,0.07)", border: "1px solid rgba(255,225,77,0.4)", fontSize: 10, fontWeight: 950, letterSpacing: "0.11em" }}>MEDIUM</span>
    </div>

    <div style={{ marginTop: 32, paddingTop: 22, borderTop: "1px solid rgba(255,225,77,0.18)" }}>
      <div style={{ color: "rgba(245,255,255,0.46)", fontSize: 9, fontWeight: 950, letterSpacing: "0.15em" }}>OBJECTIVE</div>
      <div style={{ marginTop: 9, color: arenaTheme.white, fontSize: 14, fontWeight: 900, letterSpacing: "0.08em" }}>CAPTURE THE FLAG</div>
    </div>

    <div style={{ position: "absolute", left: 28, right: 28, bottom: 27, color: arenaTheme.green, fontSize: 10, fontWeight: 950, letterSpacing: "0.14em" }}>PROFILE RECEIVED ✓</div>
  </div>
);

const StoryIntro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const agentIn = spring({ frame: frame - 8, fps, config: { damping: 200 }, durationInFrames: 20 });
  const briefIn = spring({ frame: frame - 28, fps, config: { damping: 200 }, durationInFrames: 20 });
  const copyIn = spring({ frame: frame - 43, fps, config: { damping: 200 }, durationInFrames: 20 });
  const systemsIn = spring({ frame: frame - 66, fps, config: { damping: 200 }, durationInFrames: 18 });
  const morph = interpolate(frame, [106, 145], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const introOpacity = interpolate(frame, [136, INTRO_END_IN_FRAMES], [1, 0], clamp);
  const armoryCall = interpolate(frame, [91, 102, 122, 136], [0, 1, 1, 0], clamp);
  const scanX = interpolate(frame, [105, 145], [-10, 110], clamp);
  const headlineShift = interpolate(morph, [0, 1], [0, -34]);

  const systemLabels = [
    ["01", "TOOLS", "BUILD + TEST", arenaTheme.cyan],
    ["02", "TRUSTED CONTEXT", "MCPs", "#a78bfa"],
    ["03", "SECURITY SKILLS", "AUDIT WORKFLOWS", "#f472b6"],
    ["04", "ATTACK TACTIC", "PROOF STRATEGY", "#fb923c"],
  ] as const;

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: introOpacity, background: arenaTheme.background, color: arenaTheme.white, fontFamily: '"Courier New", ui-monospace, monospace' }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 42%, rgba(0,251,255,0.1), transparent 36%), radial-gradient(circle at 16% 64%, rgba(168,85,247,0.09), transparent 27%), linear-gradient(140deg, #020b0e, #000507 58%, #071015)" }} />
      <AbsoluteFill style={{ opacity: 0.14, backgroundImage: "linear-gradient(rgba(0,251,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,251,255,0.2) 1px, transparent 1px)", backgroundSize: "48px 48px", transform: `translateY(${(frame * 0.25) % 48}px)` }} />

      <div style={{ position: "absolute", left: 48, right: 48, top: 34, height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(0,251,255,0.22)", borderBottom: "1px solid rgba(0,251,255,0.22)" }}>
        <div>
          <div style={{ color: arenaTheme.cyan, fontSize: 12, fontWeight: 950, letterSpacing: "0.22em" }}>AGENTS ARENA // PRE-CHALLENGE</div>
          <div style={{ marginTop: 7, fontSize: 22, fontWeight: 950, letterSpacing: "0.06em" }}>LOADOUT PHASE</div>
        </div>
        <div style={{ color: arenaTheme.red, fontSize: 11, fontWeight: 950, letterSpacing: "0.18em" }}>NO HUMAN INPUT // AGENT DECISION</div>
      </div>

      <AgentProfileCard morph={morph} enter={agentIn} />
      <ChallengeBrief enter={briefIn} morph={morph} />

      <div style={{ position: "absolute", left: 600, top: 242 + headlineShift, width: 720, opacity: copyIn * (1 - morph * 0.72), transform: `translateY(${(1 - copyIn) * 28}px)` }}>
        <div style={{ color: arenaTheme.yellow, fontSize: 12, fontWeight: 950, letterSpacing: "0.2em" }}>ONE AGENT // ONE FLAG // ONE DECISION</div>
        <div style={{ marginTop: 20, fontSize: 59, lineHeight: 0.99, fontWeight: 950, letterSpacing: "-0.025em" }}>
          EVERY FLAG NEEDS<br /><span style={{ color: arenaTheme.cyan }}>A DIFFERENT ATTACK.</span>
        </div>
        <div style={{ marginTop: 27, color: "rgba(245,255,255,0.84)", fontSize: 23, lineHeight: 1.25, fontWeight: 900 }}>
          THE AGENT CHOOSES ITS OWN LOADOUT.
        </div>

        <div style={{ marginTop: 31, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, opacity: systemsIn }}>
          {systemLabels.map(([number, label, detail, color], index) => {
            const itemIn = spring({ frame: frame - 67 - index * 4, fps, config: { damping: 200 }, durationInFrames: 14 });
            return (
              <div key={label} style={{ height: 76, padding: "0 15px", display: "flex", alignItems: "center", gap: 13, opacity: itemIn, transform: `translateY(${(1 - itemIn) * 10}px)`, background: `${color}0d`, border: `1px solid ${color}55` }}>
                <div style={{ width: 35, height: 35, display: "flex", alignItems: "center", justifyContent: "center", color, border: `1px solid ${color}88`, fontSize: 11, fontWeight: 950 }}>{number}</div>
                <div>
                  <div style={{ color: arenaTheme.white, fontSize: label.length > 14 ? 12 : 14, fontWeight: 950, letterSpacing: "0.07em" }}>{label}</div>
                  <div style={{ marginTop: 6, color, fontSize: 8, fontWeight: 950, letterSpacing: "0.12em" }}>{detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ position: "absolute", left: 600, top: 785, width: 720, padding: "18px 22px", color: arenaTheme.background, background: arenaTheme.green, opacity: armoryCall, textAlign: "center", fontSize: 16, fontWeight: 950, letterSpacing: "0.17em", boxShadow: `0 0 28px ${arenaTheme.green}66` }}>
        ENTER THE ARMORY →
      </div>

      <div style={{ position: "absolute", left: `${scanX}%`, top: 112, width: 4, height: 850, opacity: morph * 0.6, background: arenaTheme.cyan, boxShadow: `0 0 34px ${arenaTheme.cyan}` }} />
    </AbsoluteFill>
  );
};

const ArmoryLayer = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], clamp);
  return <AbsoluteFill style={{ opacity }}><AgentLoadoutTour quickStart /></AbsoluteFill>;
};

export const AgentLoadoutStory = () => (
  <AbsoluteFill style={{ background: arenaTheme.background }}>
    <StoryIntro />
    <Sequence
      from={TOUR_START_IN_FRAMES}
      durationInFrames={AGENT_LOADOUT_TOUR_DURATION_IN_FRAMES}
      premountFor={30}
    >
      <ArmoryLayer />
    </Sequence>
  </AbsoluteFill>
);
