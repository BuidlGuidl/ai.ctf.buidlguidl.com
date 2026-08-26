import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { arenaTheme } from "../theme";

const UI_START = 135;
const PHASE_DURATIONS = [90, 120, 180, 180] as const;
const PHASE_STARTS = [0, 90, 210, 390] as const;
const LOCK_START = UI_START + 570;

export const AGENT_LOADOUT_GUIDED_DURATION_IN_FRAMES = LOCK_START + 90;
const fontFamily = '"Courier New", ui-monospace, monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type LogoMode = "white" | "remove-white" | "native";

type ArmoryOption = {
  name: string;
  description: string;
  availability?: "core";
  logo?: string;
  logoMode?: LogoMode;
  logoCrop?: "left-icon";
  mark?: string;
};

type GuidedMenu = {
  label: string;
  shortLabel: string;
  descriptor: string;
  color: string;
  selectedIndex: number;
  options: ArmoryOption[];
};

const menus: GuidedMenu[] = [
  {
    label: "TOOLS",
    shortLabel: "TOOL",
    descriptor: "CORE TOOLSET",
    color: arenaTheme.cyan,
    selectedIndex: 0,
    options: [
      {
        name: "BASH",
        description: "SHELL + SYSTEM CONTROL",
        mark: ">_",
        availability: "core",
      },
      {
        name: "GIT",
        description: "VERSION + DIFF + HISTORY",
        mark: "GIT",
        availability: "core",
      },
      {
        name: "WEB SEARCH",
        description: "LIVE WEB RESEARCH",
        mark: "WWW",
        availability: "core",
      },
    ],
  },
  {
    label: "MCPs",
    shortLabel: "MCP",
    descriptor: "EXTERNAL CONTEXT",
    color: "#5b8cff",
    selectedIndex: 0,
    options: [
      {
        name: "OPENZEPPELIN",
        description: "CONTRACT PATTERNS",
        logo: "armory/logos/openzeppelin.svg",
        logoMode: "white",
        logoCrop: "left-icon",
      },
      {
        name: "TENDERLY",
        description: "SIMULATION CONTEXT",
        logo: "armory/logos/tenderly.svg",
        logoMode: "white",
      },
      {
        name: "CONTEXT7",
        description: "LIVE DOCUMENTATION",
        logo: "armory/logos/context7.svg",
        logoMode: "native",
      },
    ],
  },
  {
    label: "SKILLS",
    shortLabel: "SKILL",
    descriptor: "SECURITY KNOWLEDGE",
    color: "#fb7185",
    selectedIndex: 1,
    options: [
      {
        name: "ETHSKILLS",
        description: "ETHEREUM KNOWLEDGE",
        logo: "armory/logos/ethskills.svg",
        logoMode: "native",
      },
      {
        name: "PASHOV SKILLS",
        description: "AUDIT + FUZZ + X-RAY",
        logo: "armory/logos/pashov.png",
        logoMode: "native",
      },
      {
        name: "ENTRY POINT ANALYZER",
        description: "MAP THE ATTACK SURFACE",
        mark: "EP",
      },
    ],
  },
  {
    label: "TACTICS",
    shortLabel: "TACTIC",
    descriptor: "ATTACK PLAN",
    color: "#fb923c",
    selectedIndex: 1,
    options: [
      {
        name: "INVARIANT FIRST",
        description: "DEFINE THE WINNING STATE",
        mark: "IF",
      },
      {
        name: "TRACE BACKWARDS",
        description: "FROM FLAG TO EXPLOIT",
        mark: "TB",
      },
      {
        name: "ENTRY POINT SWEEP",
        description: "MAP EXTERNAL CALLS",
        mark: "ES",
      },
    ],
  },
];

const toolkitSlots = [
  { menuIndex: 1, optionIndex: 0, flyStart: 162, equipAt: 188 },
  { menuIndex: 2, optionIndex: 0, flyStart: 282, equipAt: 308 },
  { menuIndex: 2, optionIndex: 1, flyStart: 342, equipAt: 368 },
  { menuIndex: 3, optionIndex: 1, flyStart: 462, equipAt: 488 },
] as const;

const panel: CSSProperties = {
  background: "linear-gradient(155deg, rgba(4,20,24,0.98), rgba(0,8,11,0.97))",
  border: "1px solid rgba(0,251,255,0.2)",
  boxShadow: "inset 0 0 36px rgba(0,251,255,0.025), 0 22px 60px rgba(0,0,0,0.42)",
};

const CornerMarks = ({ color = arenaTheme.cyan }: { color?: string }) => (
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
          width: 19,
          height: 19,
          top: vertical === "top" ? 10 : undefined,
          bottom: vertical === "bottom" ? 10 : undefined,
          left: horizontal === "left" ? 10 : undefined,
          right: horizontal === "right" ? 10 : undefined,
          borderTop: vertical === "top" ? `2px solid ${color}` : undefined,
          borderBottom: vertical === "bottom" ? `2px solid ${color}` : undefined,
          borderLeft: horizontal === "left" ? `2px solid ${color}` : undefined,
          borderRight: horizontal === "right" ? `2px solid ${color}` : undefined,
          opacity: 0.58,
        }}
      />
    ))}
  </>
);

const BrandLogo = ({
  item,
  size,
  color,
}: {
  item: ArmoryOption;
  size: number;
  color: string;
}) => {
  if (!item.logo) {
    return (
      <div style={{ color, fontSize: size * 0.42, fontWeight: 950, letterSpacing: "0.03em" }}>
        {item.mark ?? item.name.slice(0, 2)}
      </div>
    );
  }

  const filter =
    item.logoMode === "white"
      ? "brightness(0) invert(1)"
      : item.logoMode === "remove-white"
        ? "invert(1) grayscale(1) brightness(1.85) contrast(1.25)"
        : item.name === "PASHOV SKILLS"
          ? "grayscale(1) brightness(1.25) contrast(1.15)"
          : undefined;

  const logoSize = size * 0.7;

  return (
    <div style={{ position: "relative", width: logoSize, height: logoSize, overflow: "hidden" }}>
      <Img
        src={staticFile(item.logo)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: item.logoCrop === "left-icon" ? logoSize * 10.55 : logoSize,
          height: logoSize,
          objectFit: "contain",
          objectPosition: "left center",
          filter,
          mixBlendMode: item.logoMode === "remove-white" ? "screen" : undefined,
        }}
      />
    </div>
  );
};

const LogoFrame = ({ item, color, size = 74 }: { item: ArmoryOption; color: string; size?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      color,
      background: `${color}12`,
      border: `1px solid ${color}88`,
      boxShadow: `inset 0 0 20px ${color}12`,
      clipPath: "polygon(14% 0, 86% 0, 100% 14%, 100% 86%, 86% 100%, 14% 100%, 0 86%, 0 14%)",
    }}
  >
    <BrandLogo item={item} size={size} color={color} />
  </div>
);

const AgentProfile = ({ morph, enter }: { morph: number; enter: number }) => {
  const left = interpolate(morph, [0, 1], [84, 28]);
  const top = interpolate(morph, [0, 1], [216, 134]);
  const width = interpolate(morph, [0, 1], [450, 290]);
  const height = interpolate(morph, [0, 1], [590, 590]);
  const detailOpacity = interpolate(morph, [0, 0.38, 0.62], [1, 0.45, 0], clamp);
  const compactOpacity = interpolate(morph, [0.44, 0.82], [0, 1], clamp);

  return (
    <div
      style={{
        ...panel,
        position: "absolute",
        left,
        top,
        width,
        height,
        overflow: "hidden",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 28}px)`,
        borderColor: "rgba(168,85,247,0.62)",
        boxShadow: "inset 0 0 42px rgba(168,85,247,0.07), 0 0 42px rgba(168,85,247,0.13)",
        zIndex: 4,
      }}
    >
      <CornerMarks color="#a855f7" />

      <div style={{ position: "absolute", inset: 30, opacity: detailOpacity }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#a855f7", fontSize: 12, fontWeight: 950, letterSpacing: "0.18em" }}>
          <span>P3 // AGENT PROFILE</span>
          <span style={{ color: arenaTheme.green }}>READY ✓</span>
        </div>
        <div style={{ width: 138, height: 138, margin: "48px auto 0", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7", border: "3px solid #a855f7", background: "radial-gradient(circle, rgba(168,85,247,0.24), rgba(0,8,11,0.92) 68%)", boxShadow: "0 0 38px rgba(168,85,247,0.32)", fontSize: 44, fontWeight: 950 }}>
          OA
        </div>
        <div style={{ marginTop: 28, textAlign: "center" }}>
          <div style={{ color: "rgba(245,255,255,0.45)", fontSize: 11, fontWeight: 950, letterSpacing: "0.2em" }}>OPENAI</div>
          <div style={{ marginTop: 11, fontSize: 36, lineHeight: 1, fontWeight: 950 }}>GPT-5.5</div>
          <div style={{ marginTop: 14, color: arenaTheme.cyan, fontSize: 16, fontWeight: 950 }}>CODEX // EFFORT HIGH</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px", color: "rgba(245,255,255,0.68)", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.28)", textAlign: "center", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em" }}>
          AGENT ID // CODEX-GPT-55
        </div>
      </div>

      <div style={{ position: "absolute", inset: 22, opacity: compactOpacity }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div style={{ width: 78, height: 78, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", color: arenaTheme.cyan, border: `2px solid ${arenaTheme.cyan}`, background: "rgba(0,251,255,0.08)", fontSize: 25, fontWeight: 950 }}>
            OA
          </div>
          <div>
            <div style={{ color: arenaTheme.red, fontSize: 9, fontWeight: 950, letterSpacing: "0.16em" }}>P3 // ATTACKER</div>
            <div style={{ marginTop: 7, fontSize: 23, lineHeight: 1, fontWeight: 950 }}>GPT-5.5</div>
            <div style={{ marginTop: 8, color: arenaTheme.cyan, fontSize: 11, fontWeight: 950 }}>CODEX // HIGH</div>
          </div>
        </div>

        <div style={{ marginTop: 26, paddingTop: 23, borderTop: "1px solid rgba(168,85,247,0.24)" }}>
          <div style={{ color: "rgba(245,255,255,0.38)", fontSize: 9, fontWeight: 950, letterSpacing: "0.17em" }}>NEXT FLAG</div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ color: arenaTheme.yellow, fontSize: 13, fontWeight: 950 }}>06 / 12</span>
          </div>
          <div style={{ marginTop: 24, color: arenaTheme.white, fontSize: 27, lineHeight: 1.05, fontWeight: 950 }}>GIVE ME MY<br />POINTS!</div>
          <div style={{ marginTop: 20, display: "inline-block", padding: "8px 10px", color: arenaTheme.red, background: "rgba(255,88,97,0.08)", border: "1px solid rgba(255,88,97,0.4)", fontSize: 10, fontWeight: 950, letterSpacing: "0.1em" }}>
            REENTRANCY
          </div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 4, padding: "14px 13px", color: "rgba(245,255,255,0.58)", background: "rgba(255,88,97,0.06)", border: "1px solid rgba(255,88,97,0.22)", fontSize: 9, lineHeight: 1.55, fontWeight: 900, letterSpacing: "0.09em" }}>
          OBJECTIVE<br /><span style={{ color: arenaTheme.white, fontSize: 11 }}>CAPTURE THE FLAG</span>
        </div>
      </div>
    </div>
  );
};

const ChallengeBrief = ({ opacity }: { opacity: number }) => (
  <div
    style={{
      ...panel,
      position: "absolute",
      right: 86,
      top: 276,
      width: 370,
      height: 420,
      padding: "28px 30px",
      opacity,
      transform: `translateX(${(1 - opacity) * 30}px)`,
      borderColor: "rgba(255,190,0,0.48)",
    }}
  >
    <CornerMarks color={arenaTheme.yellow} />
    <div style={{ color: arenaTheme.yellow, fontSize: 12, fontWeight: 950, letterSpacing: "0.18em" }}>CHALLENGE PROFILE</div>
    <div style={{ marginTop: 36, color: "rgba(245,255,255,0.42)", fontSize: 10, fontWeight: 950, letterSpacing: "0.17em" }}>TARGET</div>
    <div style={{ marginTop: 10, fontSize: 36, lineHeight: 1.04, fontWeight: 950 }}>CAPTURE<br />THE FLAG</div>
    <div style={{ marginTop: 30, display: "flex", gap: 8 }}>
      <span style={{ padding: "8px 9px", color: arenaTheme.red, border: "1px solid rgba(255,88,97,0.4)", background: "rgba(255,88,97,0.08)", fontSize: 9, fontWeight: 950 }}>REENTRANCY</span>
      <span style={{ padding: "8px 9px", color: arenaTheme.yellow, border: "1px solid rgba(255,190,0,0.4)", background: "rgba(255,190,0,0.07)", fontSize: 9, fontWeight: 950 }}>MEDIUM</span>
    </div>
  </div>
);

const Cursor = ({ x, y, opacity, clickProgress }: { x: number; y: number; opacity: number; clickProgress: number }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 46, height: 58, opacity, filter: "drop-shadow(0 0 9px rgba(0,251,255,0.85))", zIndex: 20 }}>
    <svg width="46" height="58" viewBox="0 0 46 58">
      <path d="M4 3L40 33L24 35L32 52L22 57L14 39L4 49Z" fill="#f5ffff" stroke="#001417" strokeWidth="3" strokeLinejoin="round" />
    </svg>
    <div
      style={{
        position: "absolute",
        left: -12,
        top: -12,
        width: 58,
        height: 58,
        borderRadius: 999,
        border: `2px solid ${arenaTheme.cyan}`,
        opacity: clickProgress > 0 ? 1 - clickProgress : 0,
        transform: `scale(${0.45 + clickProgress * 1.5})`,
      }}
    />
  </div>
);

export const AgentLoadoutGuided = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const introEnter = spring({ frame: frame - 7, fps, durationInFrames: 22, config: { damping: 200 } });
  const introCopy = spring({ frame: frame - 27, fps, durationInFrames: 22, config: { damping: 200 } });
  const morph = interpolate(frame, [104, 136], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const introOpacity = interpolate(frame, [104, 134], [1, 0], clamp);
  const briefOpacity = spring({ frame: frame - 34, fps, durationInFrames: 20, config: { damping: 200 } }) * introOpacity;
  const uiFrame = frame - UI_START;
  const uiIn = spring({ frame: uiFrame, fps, durationInFrames: 22, config: { damping: 200 } });
  const safeUiFrame = Math.max(0, uiFrame);
  const phaseIndex = PHASE_STARTS.findIndex(
    (phaseStart, index) => safeUiFrame < phaseStart + PHASE_DURATIONS[index],
  );
  const activeIndex = phaseIndex === -1 ? 3 : phaseIndex;
  const localFrame = Math.max(0, uiFrame - PHASE_STARTS[activeIndex]);
  const activePhaseDuration = PHASE_DURATIONS[activeIndex];
  const activeMenu = menus[activeIndex];
  const passiveToolsPhase = activeIndex === 0;
  const compactOptions = activeMenu.options.length > 3;
  const optionRowHeight = compactOptions ? 105 : 132;
  const optionGap = compactOptions ? 10 : 14;
  const optionCenterStart = compactOptions ? 270 : 290;
  const optionStep = optionRowHeight + optionGap;
  const activeOptionIndex = activeIndex === 2 && localFrame >= 112 ? 1 : activeIndex === 2 ? 0 : activeMenu.selectedIndex;
  const lockProgress = spring({ frame: frame - LOCK_START, fps, durationInFrames: 24, config: { damping: 200 } });
  const scanY = (frame * 2.2) % 1080;

  const categoryCenterY = 258 + activeIndex * 119;
  const firstOptionIndex = activeIndex === 2 ? 0 : activeMenu.selectedIndex;
  const firstOptionCenterY = optionCenterStart + firstOptionIndex * optionStep;
  const activeOptionCenterY = optionCenterStart + activeOptionIndex * optionStep;
  const cursorOnMenu = interpolate(localFrame, [0, 20], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const cursorToOption = interpolate(localFrame, [38, 62], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const cursorX = interpolate(cursorToOption, [0, 1], [760, 1044]);
  const cursorAtFirstOptionY = interpolate(cursorToOption, [0, 1], [categoryCenterY - 24, firstOptionCenterY - 25]);
  const cursorY = activeIndex === 2
    ? interpolate(localFrame, [108, 132], [cursorAtFirstOptionY, activeOptionCenterY - 25], clamp)
    : cursorAtFirstOptionY;
  const cursorOpacity = interpolate(localFrame, [0, 6, activePhaseDuration - 12, activePhaseDuration - 1], [0, 1, 1, 0], clamp) * cursorOnMenu;
  const categoryClick = localFrame >= 24 && localFrame <= 34 ? (localFrame - 24) / 10 : 0;
  const firstOptionClick = !passiveToolsPhase && localFrame >= 67 && localFrame <= 77 ? (localFrame - 67) / 10 : 0;
  const secondSkillClick = activeIndex === 2 && localFrame >= 132 && localFrame <= 142 ? (localFrame - 132) / 10 : 0;
  const clickProgress = Math.max(categoryClick, firstOptionClick, secondSkillClick);
  const rightContentOpacity = interpolate(localFrame, [28, 42, activePhaseDuration - 14, activePhaseDuration - 1], [0, 1, 1, 0], clamp);
  const slotCenters = [267, 729, 1191, 1653];
  const pulse = 0.8 + Math.sin(frame / 5) * 0.12;

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: arenaTheme.white, background: arenaTheme.background, fontFamily }}>
      <Audio src={staticFile("armory/audio/agent-arsenal-daniel-v1.mp3")} volume={0.98} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 38%, rgba(0,251,255,0.09), transparent 35%), radial-gradient(circle at 14% 72%, rgba(168,85,247,0.08), transparent 25%), linear-gradient(140deg, #020b0e, #000507 58%, #071015)" }} />
      <AbsoluteFill style={{ opacity: 0.13, backgroundImage: "linear-gradient(rgba(0,251,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,251,255,0.2) 1px, transparent 1px)", backgroundSize: "48px 48px", transform: `translateY(${(frame * 0.3) % 48}px)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 2, opacity: 0.08, background: arenaTheme.cyan, boxShadow: `0 0 18px ${arenaTheme.cyan}` }} />

      <AgentProfile morph={morph} enter={introEnter} />

      <div style={{ position: "absolute", left: 630, top: 260, width: 700, opacity: introCopy * introOpacity, transform: `translateY(${(1 - introCopy) * 26}px)` }}>
        <div style={{ fontSize: 64, lineHeight: 0.98, fontWeight: 950, letterSpacing: "-0.025em" }}>
          EVERY AGENT CHOOSES<br /><span style={{ color: arenaTheme.cyan }}>ITS OWN APPROACH.</span>
        </div>
        <div style={{ marginTop: 30, color: "rgba(245,255,255,0.7)", fontSize: 20, fontWeight: 900, letterSpacing: "0.07em" }}>FREE TO CHOOSE. FREE TO ADAPT.</div>
        <div style={{ marginTop: 35, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {menus.map((menu) => (
            <div key={menu.label} style={{ padding: "14px 10px", color: menu.color, background: `${menu.color}0d`, border: `1px solid ${menu.color}55`, textAlign: "center", fontSize: 12, fontWeight: 950, letterSpacing: "0.12em" }}>
              {menu.label}
            </div>
          ))}
        </div>
      </div>

      <ChallengeBrief opacity={briefOpacity} />

      <div style={{ position: "absolute", inset: 24, opacity: uiIn, transform: `translateY(${(1 - uiIn) * 20}px)`, zIndex: 2 }}>
        <div style={{ ...panel, position: "absolute", left: 0, right: 0, top: 0, height: 88, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", padding: "0 26px", clipPath: "polygon(0 0, 100% 0, 98.8% 100%, 1.2% 100%)" }}>
          <div>
            <div style={{ color: arenaTheme.cyan, fontSize: 11, fontWeight: 950, letterSpacing: "0.22em" }}>AGENTS ARENA</div>
            <div style={{ marginTop: 7, fontSize: 25, fontWeight: 950, letterSpacing: "0.05em" }}>AGENT ARSENAL</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: arenaTheme.yellow, fontSize: 10, fontWeight: 950, letterSpacing: "0.2em" }}>ONE POSSIBLE APPROACH</div>
            <div style={{ marginTop: 7, fontSize: 21, fontWeight: 950 }}>THE AGENT CHOOSES WHAT IT NEEDS</div>
          </div>
          <div />
        </div>

        <div style={{ ...panel, position: "absolute", left: 314, top: 110, width: 500, height: 590, padding: "22px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px 16px" }}>
            <div style={{ color: arenaTheme.cyan, fontSize: 13, fontWeight: 950, letterSpacing: "0.18em" }}>EXPLORE CATEGORY</div>
          </div>
          {menus.map((menu, index) => {
            const active = index === activeIndex;
              const complete = uiFrame >= PHASE_STARTS[index] + PHASE_DURATIONS[index] - 18;
            const hover = active ? interpolate(localFrame, [8, 20], [0, 1], clamp) : 0;
            return (
              <div
                key={menu.label}
                style={{
                  height: 107,
                  marginBottom: 12,
                  padding: "0 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: active ? arenaTheme.white : complete ? "rgba(245,255,255,0.62)" : "rgba(245,255,255,0.4)",
                  background: active ? `linear-gradient(90deg, ${menu.color}${hover > 0.4 ? "24" : "12"}, rgba(0,13,16,0.96))` : "rgba(245,255,255,0.018)",
                  border: `1px solid ${active ? menu.color : complete ? "rgba(0,255,156,0.3)" : "rgba(245,255,255,0.08)"}`,
                  boxShadow: active ? `inset 0 0 28px ${menu.color}14, 0 0 18px ${menu.color}10` : "none",
                  transform: `translateX(${active ? hover * 5 : 0}px)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 17 }}>
                  <span style={{ color: menu.color, fontSize: 12, fontWeight: 950 }}>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 950, letterSpacing: "0.04em" }}>{menu.label}</div>
                    <div style={{ marginTop: 7, color: "rgba(245,255,255,0.34)", fontSize: 9, fontWeight: 900, letterSpacing: "0.12em" }}>{menu.descriptor}</div>
                  </div>
                </div>
                <div style={{ color: complete ? arenaTheme.green : active ? menu.color : "rgba(245,255,255,0.2)", fontSize: complete ? 23 : 18, fontWeight: 950 }}>
                  {complete ? "✓" : active ? "›" : "·"}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...panel, position: "absolute", left: 832, right: 0, top: 110, height: 590, padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px 18px", opacity: rightContentOpacity }}>
            <span style={{ color: activeMenu.color, fontSize: 13, fontWeight: 950, letterSpacing: "0.18em" }}>{activeMenu.label}</span>
          </div>

          <div style={{ display: "grid", gap: optionGap }}>
            {activeMenu.options.map((item, index) => {
              const selected = !passiveToolsPhase && index === activeOptionIndex;
              const coreAvailable = item.availability === "core";
              const selectedHoverStart = activeIndex === 2 && index === 1 ? 112 : 48;
              const selectedHoverEnd = activeIndex === 2 && index === 1 ? 130 : 64;
              const selectedHover = selected ? interpolate(localFrame, [selectedHoverStart, selectedHoverEnd], [0, 1], clamp) : 0;
              const rowIn = spring({ frame: localFrame - 29 - index * 3, fps, durationInFrames: 16, config: { damping: 200 } });
              const slot = toolkitSlots.find((candidate) => candidate.menuIndex === activeIndex && candidate.optionIndex === index);
              const equipped = slot ? uiFrame >= slot.equipAt : false;
              return (
                <div
                  key={item.name}
                  style={{
                    height: optionRowHeight,
                    padding: "0 22px",
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    color: selected ? arenaTheme.white : coreAvailable || equipped ? "rgba(245,255,255,0.8)" : "rgba(245,255,255,0.62)",
                    background: selected ? `linear-gradient(90deg, ${activeMenu.color}${selectedHover > 0.4 ? "25" : "12"}, rgba(0,13,16,0.97))` : coreAvailable ? "linear-gradient(90deg, rgba(0,255,156,0.07), rgba(0,13,16,0.97))" : equipped ? `linear-gradient(90deg, ${activeMenu.color}0d, rgba(0,13,16,0.97))` : "rgba(245,255,255,0.018)",
                    border: `1px solid ${selected ? activeMenu.color : coreAvailable ? "rgba(0,255,156,0.3)" : equipped ? `${activeMenu.color}66` : "rgba(245,255,255,0.08)"}`,
                    boxShadow: selected ? `inset 0 0 28px ${activeMenu.color}14, 0 0 16px ${activeMenu.color}0d` : "none",
                    opacity: rightContentOpacity * rowIn,
                    transform: `translateX(${(1 - rowIn) * 18 + selectedHover * 4}px)`,
                  }}
                >
                  <LogoFrame item={item} color={coreAvailable ? arenaTheme.green : selected || equipped ? activeMenu.color : "#8ca3a7"} size={compactOptions ? 62 : 76} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: compactOptions ? 22 : item.name.length > 18 ? 22 : 27, lineHeight: 1, fontWeight: 950, letterSpacing: "0.025em" }}>{item.name}</div>
                    <div style={{ marginTop: compactOptions ? 8 : 11, color: coreAvailable ? arenaTheme.green : selected || equipped ? activeMenu.color : "rgba(245,255,255,0.35)", fontSize: 10, fontWeight: 950, letterSpacing: "0.13em" }}>{item.description}</div>
                  </div>
                  <div style={{ minWidth: 105, color: coreAvailable || equipped ? arenaTheme.green : selected ? activeMenu.color : "rgba(245,255,255,0.2)", textAlign: "right", fontSize: 10, fontWeight: 950, letterSpacing: "0.12em" }}>
                    {coreAvailable ? "EQUIPPED ✓" : equipped ? "IN USE NOW ✓" : selected ? "ADD FOR NOW" : "OPTION"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...panel, position: "absolute", left: 0, right: 0, top: 716, height: 316, padding: "18px" }}>
          <div style={{ height: 38, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ color: arenaTheme.green, fontSize: 12, fontWeight: 950, letterSpacing: "0.18em" }}>CURRENT TOOLKIT</span>
              <span style={{ marginLeft: 14, color: "rgba(245,255,255,0.34)", fontSize: 9, fontWeight: 950, letterSpacing: "0.11em" }}>TOOLS CAN CHANGE AT ANY TIME</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {toolkitSlots.map((slot) => {
              const menu = menus[slot.menuIndex];
              const item = menu.options[slot.optionIndex];
              const slotProgress = spring({ frame: uiFrame - slot.equipAt, fps, durationInFrames: 18, config: { damping: 18, stiffness: 190 } });
              const filled = slotProgress > 0.01;
              return (
                <div key={`${menu.label}-${item.name}`} style={{ position: "relative", height: 190, padding: "15px 15px", overflow: "hidden", background: filled ? `linear-gradient(145deg, ${menu.color}1c, rgba(0,11,14,0.98))` : "rgba(245,255,255,0.016)", border: `1px solid ${filled ? `${menu.color}88` : "rgba(245,255,255,0.08)"}`, boxShadow: filled ? `inset 0 0 28px ${menu.color}10` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(245,255,255,0.38)", fontSize: 9, fontWeight: 950, letterSpacing: "0.12em" }}>
                    <span>{menu.shortLabel}</span>
                    {filled ? <span style={{ color: arenaTheme.green }}>IN USE NOW ✓</span> : null}
                  </div>
                  {filled ? (
                    <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 13, opacity: slotProgress, transform: `translateY(${(1 - slotProgress) * 18}px)` }}>
                      <LogoFrame item={item} color={menu.color} size={62} />
                      <div>
                        <div style={{ color: arenaTheme.white, fontSize: item.name.length > 17 ? 16 : 19, lineHeight: 1.05, fontWeight: 950 }}>{item.name}</div>
                        <div style={{ marginTop: 9, color: menu.color, fontSize: 8, fontWeight: 950, letterSpacing: "0.1em" }}>{item.description}</div>
                      </div>
                    </div>
                  ) : null}
                  <div style={{ position: "absolute", left: 15, right: 15, bottom: 15, height: 3, background: "rgba(245,255,255,0.05)" }}>
                    <div style={{ width: `${slotProgress * 100}%`, height: "100%", background: menu.color, boxShadow: `0 0 10px ${menu.color}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {uiFrame >= 0 && frame < LOCK_START + 8 ? <Cursor x={cursorX} y={cursorY} opacity={cursorOpacity * uiIn} clickProgress={clickProgress} /> : null}

      {toolkitSlots.map((slot, slotIndex) => {
        const flyProgress = interpolate(uiFrame, [slot.flyStart, slot.equipAt], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
        const flyVisible = uiFrame >= slot.flyStart && uiFrame <= slot.equipAt + 6;
        if (!flyVisible) return null;
        const menu = menus[slot.menuIndex];
        const item = menu.options[slot.optionIndex];
        const sourceMenu = menus[slot.menuIndex];
        const sourceCompact = sourceMenu.options.length > 3;
        const sourceRowHeight = sourceCompact ? 105 : 132;
        const sourceGap = sourceCompact ? 10 : 14;
        const sourceCenterStart = sourceCompact ? 270 : 290;
        const optionCenterY = sourceCenterStart + slot.optionIndex * (sourceRowHeight + sourceGap);
        const flyingX = interpolate(flyProgress, [0, 1], [1160, slotCenters[slotIndex] - 112]);
        const flyingY = interpolate(flyProgress, [0, 1], [optionCenterY - 35, 836]);
        const flyingOpacity = interpolate(uiFrame, [slot.flyStart, slot.flyStart + 4, slot.equipAt - 4, slot.equipAt + 6], [0, 1, 1, 0], clamp);
        return (
          <div key={`fly-${item.name}`} style={{ position: "absolute", left: flyingX, top: flyingY, width: 224, height: 72, padding: "0 13px", display: "flex", alignItems: "center", gap: 11, color: arenaTheme.white, background: "rgba(0,16,19,0.98)", border: `1px solid ${menu.color}`, boxShadow: `0 0 22px ${menu.color}30`, opacity: flyingOpacity, transform: `scale(${interpolate(flyProgress, [0, 1], [1, 0.82])})`, zIndex: 22 }}>
            <LogoFrame item={item} color={menu.color} size={48} />
            <div style={{ fontSize: item.name.length > 14 ? 12 : 15, lineHeight: 1.05, fontWeight: 950 }}>{item.name}</div>
          </div>
        );
      })}

      {lockProgress > 0 ? (
        <AbsoluteFill style={{ zIndex: 30, alignItems: "center", justifyContent: "center", background: `rgba(0,8,11,${lockProgress * 0.62})`, opacity: lockProgress }}>
          <div style={{ width: 860, padding: "34px 42px", color: arenaTheme.green, background: "rgba(0,19,19,0.97)", border: `2px solid ${arenaTheme.green}`, boxShadow: `0 0 ${42 * pulse}px rgba(0,255,156,0.44), inset 0 0 34px rgba(0,255,156,0.08)`, textAlign: "center", clipPath: "polygon(3% 0, 97% 0, 100% 22%, 100% 78%, 97% 100%, 3% 100%, 0 78%, 0 22%)" }}>
            <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.28em" }}>TOOLKIT SELECTED</div>
            <div style={{ marginTop: 14, color: arenaTheme.white, fontSize: 54, lineHeight: 0.95, fontWeight: 950, letterSpacing: "0.055em" }}>READY TO HACK</div>
            <div style={{ marginTop: 17, color: arenaTheme.cyan, fontSize: 14, fontWeight: 950, letterSpacing: "0.13em" }}>FREE TO CHOOSE. FREE TO CHANGE.</div>
            <div style={{ marginTop: 14, color: arenaTheme.yellow, fontSize: 10, fontWeight: 950, letterSpacing: "0.18em" }}>SAME NEUTRAL ENVIRONMENT</div>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
