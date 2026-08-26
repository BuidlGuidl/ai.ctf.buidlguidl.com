import type { CSSProperties } from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { arenaTheme } from "../theme";
import { AgentLoadout } from "./AgentLoadout";

export const AGENT_LOADOUT_TOUR_DURATION_IN_FRAMES = 450;

type MenuKey = "toolchain" | "mcp" | "skills" | "tactics";

type LogoMode = "white" | "remove-white" | "native";

type ArmoryItem = {
  name: string;
  group: string;
  mark: string;
  color: string;
  cost: number;
  latency: number;
  description: string;
  tags: string[];
  stats: [number, number, number, number];
  logo?: string;
  logoMode?: LogoMode;
  logoCrop?: "left-icon";
  logoScale?: number;
};

type MenuDefinition = {
  key: MenuKey;
  number: string;
  label: string;
  status: string;
  subtitle: string;
  color: string;
  statLabels: [string, string, string, string];
  items: ArmoryItem[];
};

const menus: MenuDefinition[] = [
  {
    key: "toolchain",
    number: "01",
    label: "TOOLCHAIN",
    status: "4 EQUIPPED",
    subtitle: "EXECUTE // BUILD // TEST // AUDIT",
    color: arenaTheme.cyan,
    statLabels: ["EXECUTION SPEED", "FINDING COVERAGE", "REASONING LOAD", "DETERMINISM"],
    items: [
      {
        name: "BASH",
        group: "EXECUTION",
        mark: ">_",
        color: arenaTheme.cyan,
        cost: 250,
        latency: 8,
        description: "Run local commands, inspect files, and control challenge processes.",
        tags: ["SHELL", "PIPES", "PROCESS"],
        stats: [98, 72, 58, 96],
        logo: "armory/logos/bash.svg",
        logoMode: "white",
      },
      {
        name: "GIT",
        group: "SOURCE CONTROL",
        mark: "GI",
        color: "#67e8f9",
        cost: 300,
        latency: 11,
        description: "Compare patches, inspect history, and trace the origin of unsafe code.",
        tags: ["DIFF", "BLAME", "HISTORY"],
        stats: [92, 78, 70, 98],
        logo: "armory/logos/git.svg",
        logoMode: "white",
      },
      {
        name: "FOUNDRY",
        group: "BUILD + TEST",
        mark: "FO",
        color: arenaTheme.yellow,
        cost: 1200,
        latency: 38,
        description: "Compile, test, fuzz, trace, and replay Solidity interactions locally.",
        tags: ["FORGE", "CAST", "ANVIL"],
        stats: [94, 91, 88, 93],
        logo: "armory/logos/foundry-avatar.png",
        logoMode: "remove-white",
      },
      {
        name: "SLITHER",
        group: "STATIC ANALYSIS",
        mark: "SL",
        color: arenaTheme.green,
        cost: 1050,
        latency: 31,
        description: "Scan Solidity structure and detector output before manual exploit work.",
        tags: ["DETECT", "PRINT", "DATAFLOW"],
        stats: [90, 96, 76, 88],
        logo: "armory/logos/slither.png",
        logoMode: "remove-white",
        logoScale: 1.08,
      },
      {
        name: "MEDUSA",
        group: "FUZZING",
        mark: "ME",
        color: "#f472b6",
        cost: 1150,
        latency: 54,
        description: "Use coverage-guided fuzzing to test hostile call sequences and properties.",
        tags: ["CORPUS", "COVERAGE", "WORKERS"],
        stats: [72, 98, 95, 84],
        logo: "armory/logos/medusa.png",
        logoMode: "remove-white",
        logoScale: 1.08,
      },
      {
        name: "ECHIDNA",
        group: "PROPERTY FUZZING",
        mark: "EC",
        color: "#c084fc",
        cost: 1120,
        latency: 49,
        description: "Search for invariant failures across generated smart-contract call sequences.",
        tags: ["INVARIANT", "SEQUENCE", "SHRINK"],
        stats: [76, 97, 94, 87],
      },
    ],
  },
  {
    key: "mcp",
    number: "02",
    label: "MCP RELAYS",
    status: "2 LINKED",
    subtitle: "CONTROLLED CONTEXT // SIMULATION // CHAIN INTEL",
    color: "#a78bfa",
    statLabels: ["DATA COVERAGE", "QUERY SPEED", "CONTEXT VALUE", "TRUST BOUNDARY"],
    items: [
      {
        name: "OPENZEPPELIN",
        group: "CONTRACTS MCP",
        mark: "OZ",
        color: "#4f8cff",
        cost: 850,
        latency: 26,
        description: "Retrieve OpenZeppelin contract guidance and secure implementation context.",
        tags: ["CONTRACTS", "STANDARDS", "PATTERNS"],
        stats: [88, 86, 96, 94],
        logo: "armory/logos/openzeppelin.svg",
        logoMode: "white",
        logoCrop: "left-icon",
      },
      {
        name: "TENDERLY",
        group: "SIMULATION MCP",
        mark: "TE",
        color: "#8b5cf6",
        cost: 1100,
        latency: 44,
        description: "Simulate transactions, inspect traces, and debug failed execution paths.",
        tags: ["SIMULATE", "TRACE", "DEBUG"],
        stats: [94, 82, 98, 91],
        logo: "armory/logos/tenderly.svg",
        logoMode: "white",
      },
      {
        name: "ETHERSCAN",
        group: "EXPLORER MCP",
        mark: "ES",
        color: "#38bdf8",
        cost: 700,
        latency: 32,
        description: "Inspect verified source, deployed contracts, transactions, and chain data.",
        tags: ["SOURCE", "TX", "MULTICHAIN"],
        stats: [95, 88, 91, 89],
        logo: "armory/logos/etherscan.svg",
        logoMode: "white",
      },
      {
        name: "GITHUB",
        group: "REPOSITORY MCP",
        mark: "GH",
        color: "#e5e7eb",
        cost: 650,
        latency: 21,
        description: "Read repository history, pull requests, issues, and exact source context.",
        tags: ["CODE", "HISTORY", "ISSUES"],
        stats: [91, 92, 87, 96],
        logo: "armory/logos/github.png",
        logoMode: "remove-white",
      },
      {
        name: "CONTEXT7",
        group: "DOCUMENTATION MCP",
        mark: "C7",
        color: "#a78bfa",
        cost: 480,
        latency: 18,
        description: "Load current library documentation into the active reasoning context.",
        tags: ["DOCS", "VERSION", "API"],
        stats: [82, 96, 88, 93],
        logo: "armory/logos/context7.svg",
        logoMode: "native",
      },
      {
        name: "BLOCKSCOUT",
        group: "CHAIN DATA MCP",
        mark: "BS",
        color: "#5eead4",
        cost: 620,
        latency: 24,
        description: "Query verified contracts, ABIs, transactions, tokens, and read-only calls.",
        tags: ["ABI", "ADDRESS", "CALL"],
        stats: [93, 90, 89, 92],
        logo: "armory/logos/blockscout.svg",
        logoMode: "white",
      },
    ],
  },
  {
    key: "skills",
    number: "03",
    label: "SKILL DECK",
    status: "1 ACTIVE",
    subtitle: "TRAIL OF BITS // ETHSKILLS // SECURITY",
    color: "#f472b6",
    statLabels: ["AUDIT DEPTH", "SIGNAL QUALITY", "REASONING LOAD", "REPEATABILITY"],
    items: [
      {
        name: "SECURE WORKFLOW",
        group: "BUILDING SECURE CONTRACTS",
        mark: "SW",
        color: "#f472b6",
        cost: 900,
        latency: 35,
        description: "Run a structured contract-security workflow from scans to manual review.",
        tags: ["SLITHER", "PROPERTIES", "REVIEW"],
        stats: [96, 94, 88, 98],
        logo: "armory/logos/trailofbits.png",
        logoMode: "native",
      },
      {
        name: "ENTRY POINT ANALYZER",
        group: "ATTACK SURFACE",
        mark: "EP",
        color: "#fb7185",
        cost: 750,
        latency: 28,
        description: "Map state-changing entry points, access controls, and privileged paths.",
        tags: ["EXTERNAL", "STATE", "ACCESS"],
        stats: [92, 96, 82, 97],
      },
      {
        name: "PROPERTY TESTING",
        group: "INVARIANT DESIGN",
        mark: "PT",
        color: "#e879f9",
        cost: 820,
        latency: 42,
        description: "Define strong properties and generate tests across adversarial inputs.",
        tags: ["PROPERTY", "INVARIANT", "FUZZ"],
        stats: [94, 91, 95, 96],
      },
      {
        name: "SPEC COMPLIANCE",
        group: "SPEC TO CODE",
        mark: "SC",
        color: "#c084fc",
        cost: 880,
        latency: 39,
        description: "Compare stated protocol requirements with the implemented contract behavior.",
        tags: ["SPEC", "MAPPING", "GAP"],
        stats: [95, 93, 91, 98],
      },
      {
        name: "TOKEN INTEGRATION",
        group: "TOKEN EDGE CASES",
        mark: "TI",
        color: "#fb923c",
        cost: 760,
        latency: 30,
        description: "Check non-standard token behavior and dangerous integration assumptions.",
        tags: ["ERC20", "CALLBACK", "RETURN"],
        stats: [90, 95, 84, 96],
      },
      {
        name: "VARIANT ANALYSIS",
        group: "PATTERN EXPANSION",
        mark: "VA",
        color: "#60a5fa",
        cost: 790,
        latency: 33,
        description: "Expand one suspicious pattern into related paths and similar defects.",
        tags: ["PATTERN", "SIBLING", "CONFIRM"],
        stats: [93, 92, 89, 95],
      },
      {
        name: "AUDIT CONTEXT",
        group: "SYSTEM MAPPING",
        mark: "AC",
        color: "#34d399",
        cost: 810,
        latency: 34,
        description: "Build a detailed architecture map before searching for high-impact defects.",
        tags: ["ARCHITECTURE", "FLOW", "TRUST"],
        stats: [96, 93, 89, 98],
      },
      {
        name: "ETHSKILLS",
        group: "ETHEREUM KNOWLEDGE",
        mark: "ΞS",
        color: arenaTheme.cyan,
        cost: 840,
        latency: 27,
        description: "Load current Ethereum security, testing, standards, tools, and audit guidance.",
        tags: ["SECURITY", "TESTING", "AUDIT"],
        stats: [94, 95, 87, 96],
        logo: "armory/logos/ethskills.svg",
        logoMode: "native",
      },
    ],
  },
  {
    key: "tactics",
    number: "04",
    label: "TACTICS",
    status: "1 ACTIVE",
    subtitle: "ATTACK ORDER // PROOF STRATEGY // TIME CONTROL",
    color: "#fb923c",
    statLabels: ["EXPLOIT SPEED", "PATH COVERAGE", "PROOF STRENGTH", "DETERMINISM"],
    items: [
      {
        name: "INVARIANT FIRST",
        group: "PROPERTY LED",
        mark: "IF",
        color: "#fb923c",
        cost: 420,
        latency: 16,
        description: "State what must remain true, then search only for sequences that break it.",
        tags: ["PROPERTY", "BREAK", "PROVE"],
        stats: [88, 96, 98, 94],
      },
      {
        name: "ENTRY POINT SWEEP",
        group: "ATTACK SURFACE",
        mark: "ES",
        color: "#fbbf24",
        cost: 360,
        latency: 12,
        description: "Rank every state-changing function by privilege, value flow, and reachability.",
        tags: ["MAP", "RANK", "ATTACK"],
        stats: [96, 92, 86, 97],
      },
      {
        name: "TRACE BACKWARDS",
        group: "FAILURE ANALYSIS",
        mark: "TB",
        color: "#f97316",
        cost: 390,
        latency: 18,
        description: "Start from the winning state and trace the required storage changes backwards.",
        tags: ["GOAL", "TRACE", "CAUSE"],
        stats: [91, 88, 95, 92],
      },
      {
        name: "STATE DIFF",
        group: "STORAGE ANALYSIS",
        mark: "SD",
        color: "#22d3ee",
        cost: 380,
        latency: 14,
        description: "Compare storage before and after each call to isolate hidden side effects.",
        tags: ["STORAGE", "BEFORE", "AFTER"],
        stats: [93, 94, 92, 98],
      },
      {
        name: "FORK + REPLAY",
        group: "EXECUTION PROOF",
        mark: "FR",
        color: "#a78bfa",
        cost: 460,
        latency: 24,
        description: "Reproduce the target state on a fork and replay the full exploit sequence.",
        tags: ["FORK", "REPLAY", "VERIFY"],
        stats: [86, 90, 97, 99],
      },
      {
        name: "MINIMAL EXPLOIT",
        group: "POC REDUCTION",
        mark: "ME",
        color: arenaTheme.red,
        cost: 340,
        latency: 10,
        description: "Remove every unnecessary action until only the shortest valid proof remains.",
        tags: ["REDUCE", "ASSERT", "SUBMIT"],
        stats: [98, 78, 96, 99],
      },
    ],
  },
];

type LoadoutItem = {
  slot: string;
  name: string;
  type: string;
  menu: MenuKey;
  color: string;
  logo?: string;
  logoMode?: LogoMode;
  logoCrop?: "left-icon";
  logoScale?: number;
};

const finalLoadout: LoadoutItem[] = [
  { slot: "CORE", name: "BASH", type: "TOOL", menu: "toolchain", color: arenaTheme.cyan, logo: "armory/logos/bash.svg", logoMode: "white" },
  { slot: "BUILD", name: "FOUNDRY", type: "TOOL", menu: "toolchain" as const, color: arenaTheme.yellow, logo: "armory/logos/foundry-avatar.png", logoMode: "remove-white" },
  { slot: "AUDIT", name: "SLITHER", type: "TOOL", menu: "toolchain", color: arenaTheme.green, logo: "armory/logos/slither.png", logoMode: "remove-white", logoScale: 1.08 },
  { slot: "FUZZ", name: "MEDUSA", type: "TOOL", menu: "toolchain", color: "#f472b6", logo: "armory/logos/medusa.png", logoMode: "remove-white", logoScale: 1.08 },
  { slot: "RELAY 01", name: "OPENZEPPELIN", type: "MCP", menu: "mcp", color: "#4f8cff", logo: "armory/logos/openzeppelin.svg", logoMode: "white", logoCrop: "left-icon" },
  { slot: "RELAY 02", name: "TENDERLY", type: "MCP", menu: "mcp", color: "#8b5cf6", logo: "armory/logos/tenderly.svg", logoMode: "white" },
  { slot: "SKILL", name: "ENTRY POINT ANALYZER", type: "SKILL", menu: "skills", color: "#fb7185" },
  { slot: "TACTIC", name: "INVARIANT FIRST", type: "TACTIC", menu: "tactics", color: "#fb923c" },
];

const panel: CSSProperties = {
  background: "linear-gradient(155deg, rgb(4,20,24), rgb(0,8,11))",
  border: "1px solid rgba(0,251,255,0.2)",
  boxShadow: "inset 0 0 34px rgba(0,251,255,0.025), 0 18px 42px rgba(0,0,0,0.38)",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const phaseStarts = [0, 105, 210, 315];

const BrandLogo = ({
  logo,
  mode = "white",
  crop,
  scale = 1,
  size,
  selected,
}: {
  logo: string;
  mode?: LogoMode;
  crop?: "left-icon";
  scale?: number;
  size: number;
  selected: boolean;
}) => {
  const iconSize = size * 0.68 * scale;
  const filter =
    mode === "remove-white"
      ? "invert(1) grayscale(1) brightness(1.9) contrast(1.25)"
      : mode === "white"
        ? "brightness(0) invert(1)"
        : undefined;

  return (
    <div style={{ position: "relative", width: iconSize, height: iconSize, overflow: "hidden", opacity: selected ? 0.96 : 0.68 }}>
      <Img
        src={staticFile(logo)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: crop === "left-icon" ? iconSize * 10.55 : iconSize,
          height: iconSize,
          objectFit: "contain",
          objectPosition: "left center",
          filter,
          mixBlendMode: mode === "remove-white" ? "screen" : undefined,
        }}
      />
    </div>
  );
};

const MenuMark = ({ item, selected, size = 82 }: { item: ArmoryItem; selected: boolean; size?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: selected ? item.color : "rgba(196,220,223,0.48)",
      border: `2px solid ${selected ? item.color : "rgba(196,220,223,0.26)"}`,
      background: selected ? `${item.color}14` : "rgba(245,255,255,0.015)",
      boxShadow: selected ? `0 0 28px ${item.color}28, inset 0 0 18px ${item.color}12` : "none",
      clipPath: "polygon(18% 0, 82% 0, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0 82%, 0 18%)",
      fontSize: size * 0.28,
      fontWeight: 950,
      letterSpacing: "0.04em",
    }}
  >
    {item.logo ? (
      <BrandLogo
        logo={item.logo}
        mode={item.logoMode}
        crop={item.logoCrop}
        scale={item.logoScale}
        size={size}
        selected={selected}
      />
    ) : item.mark}
  </div>
);

const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div style={{ marginBottom: 15 }}>
    <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(245,255,255,0.62)", fontSize: 11, fontWeight: 900, letterSpacing: "0.11em" }}>
      <span>{label}</span>
      <span style={{ color: arenaTheme.white }}>{value}</span>
    </div>
    <div style={{ height: 5, marginTop: 7, overflow: "hidden", background: "rgba(245,255,255,0.08)" }}>
      <div style={{ width: `${value}%`, height: "100%", background: color, boxShadow: `0 0 12px ${color}` }} />
    </div>
  </div>
);

export const AgentLoadoutTour = ({ quickStart = false }: { quickStart?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeIndex = frame < phaseStarts[1] ? 0 : frame < phaseStarts[2] ? 1 : frame < phaseStarts[3] ? 2 : 3;
  const activeMenu = menus[activeIndex];
  const localFrame = frame - phaseStarts[activeIndex];
  const selectedStep = localFrame < 36 ? 0 : localFrame < 72 ? 1 : 2;
  const selectedIndexes = [
    [0, 2, 3],
    [0, 1, 2],
    [0, 1, 7],
    [0, 2, 4],
  ];
  const selectedIndex = selectedIndexes[activeIndex][selectedStep];
  const selected = activeMenu.items[selectedIndex];
  const sectionIn = spring({ frame: localFrame, fps, config: { damping: 200 }, durationInFrames: 7 });
  const switchFlash = interpolate(localFrame, [0, 2, 7], [0, 0.65, 0], clamp);
  const clickPulse = interpolate(localFrame, [0, 3, 8], [0.2, 1, 0], clamp);
  const lockProgress = interpolate(frame, [13.5 * fps, 14.2 * fps], [0, 1], clamp);
  const pulse = 0.72 + Math.sin(frame / 5) * 0.18;

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: arenaTheme.white, fontFamily: '"Courier New", ui-monospace, monospace' }}>
      <AgentLoadout hideLock />

      <div style={{ ...panel, position: "absolute", left: 328, top: 116, width: 1198, height: 610, overflow: "hidden", padding: "17px 18px 16px" }}>
        <div style={{ opacity: sectionIn, transform: `translateX(${(1 - sectionIn) * 28}px)` }}>
          <div style={{ height: 39, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <span style={{ color: activeMenu.color, fontSize: 12, fontWeight: 950, letterSpacing: "0.17em" }}>{activeMenu.label}</span>
              <span style={{ marginLeft: 14, color: "rgba(245,255,255,0.34)", fontSize: 9, fontWeight: 900, letterSpacing: "0.11em" }}>{activeMenu.subtitle}</span>
            </div>
            <div style={{ color: "rgba(245,255,255,0.38)", fontSize: 9, fontWeight: 900, letterSpacing: "0.1em" }}>SELECT MODULE TO INSPECT</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: activeMenu.items.length > 6 ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 9 }}>
            {activeMenu.items.map((item, index) => {
              const selectedCard = index === selectedIndex;
              const cardIn = spring({ frame: localFrame - index, fps, config: { damping: 200 }, durationInFrames: 9 });
              return (
                <div
                  key={item.name}
                  style={{
                    position: "relative",
                    height: 252,
                    padding: "13px 14px",
                    overflow: "hidden",
                    opacity: cardIn,
                    transform: `scale(${0.97 + cardIn * 0.03})`,
                    background: selectedCard ? `linear-gradient(145deg, ${item.color}2d, rgba(0,25,29,0.97))` : "linear-gradient(145deg, rgba(8,28,32,0.94), rgba(0,12,15,0.98))",
                    border: `1px solid ${selectedCard ? item.color : "rgba(245,255,255,0.1)"}`,
                    boxShadow: selectedCard ? `inset 0 0 34px ${item.color}22, 0 0 17px ${item.color}18` : "none",
                  }}
                >
                  {selectedCard ? <div style={{ position: "absolute", inset: 3, border: `1px solid ${item.color}55` }} /> : null}
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(245,255,255,0.43)", fontSize: 8, fontWeight: 950, letterSpacing: "0.1em" }}>
                    <span>{item.group}</span>
                    <span style={{ color: item.color }}>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div style={{ height: 145, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MenuMark item={item} selected={selectedCard} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                    <div style={{ maxWidth: "76%", color: selectedCard ? arenaTheme.white : "rgba(245,255,255,0.74)", fontSize: item.name.length > 18 ? 12 : 15, lineHeight: 1.08, fontWeight: 950 }}>{item.name}</div>
                    <div style={{ flexShrink: 0, color: item.color, fontSize: 13, fontWeight: 950 }}>{item.cost}<span style={{ marginLeft: 3, fontSize: 8 }}>CU</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, opacity: switchFlash, background: activeMenu.color, boxShadow: `0 0 28px ${activeMenu.color}` }} />
      </div>

      <div style={{ ...panel, position: "absolute", left: 1538, top: 116, width: 358, height: 610, overflow: "hidden", padding: 20 }}>
        <div style={{ opacity: sectionIn, transform: `translateX(${(1 - sectionIn) * 18}px)` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: selected.color, fontSize: 9, fontWeight: 950, letterSpacing: "0.17em" }}>{selected.group}</div>
              <div style={{ maxWidth: 225, marginTop: 8, fontSize: selected.name.length > 18 ? 21 : 27, lineHeight: 0.95, fontWeight: 950 }}>{selected.name}</div>
            </div>
            <div style={{ color: selected.color, textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{selected.cost}</div>
              <div style={{ fontSize: 8, fontWeight: 950, letterSpacing: "0.12em" }}>COMPUTE UNITS</div>
            </div>
          </div>

          <div style={{ height: 122, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${selected.color}1f, transparent 65%)`, borderTop: "1px solid rgba(245,255,255,0.06)", borderBottom: "1px solid rgba(245,255,255,0.06)" }}>
            <MenuMark item={selected} selected size={94} />
          </div>

          <div style={{ minHeight: 57, marginTop: 15, color: "rgba(245,255,255,0.64)", fontSize: 11, lineHeight: 1.5 }}>{selected.description}</div>
          <div style={{ minHeight: 27, marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {selected.tags.map((tag) => <span key={tag} style={{ padding: "5px 7px", color: selected.color, background: `${selected.color}10`, border: `1px solid ${selected.color}38`, fontSize: 8, fontWeight: 950, letterSpacing: "0.1em" }}>{tag}</span>)}
          </div>

          <div style={{ marginTop: 16 }}>
            {activeMenu.statLabels.map((label, index) => <StatBar key={label} label={label} value={selected.stats[index]} color={selected.color} />)}
          </div>
        </div>

        <div style={{ position: "absolute", left: 20, right: 20, bottom: 19, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ padding: "12px 10px", color: "rgba(245,255,255,0.55)", background: "rgba(245,255,255,0.035)", border: "1px solid rgba(245,255,255,0.1)", textAlign: "center", fontSize: 9, fontWeight: 950, letterSpacing: "0.09em" }}>P95 {selected.latency} MS</div>
          <div style={{ padding: "12px 10px", color: arenaTheme.background, background: selected.color, textAlign: "center", fontSize: 9, fontWeight: 950, letterSpacing: "0.09em" }}>AVAILABLE</div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 44, top: 342, width: 252, paddingTop: 1, background: "rgba(0,8,11,0.99)" }}>
        {menus.map((menu, index) => {
          const active = index === activeIndex;
          return (
            <div
              key={menu.key}
              style={{
                position: "relative",
                height: 58,
                marginBottom: index === menus.length - 1 ? 0 : 9,
                padding: "0 13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: active ? arenaTheme.white : "rgba(245,255,255,0.58)",
                background: active ? `${menu.color}18` : "rgba(245,255,255,0.025)",
                border: `1px solid ${active ? `${menu.color}aa` : "rgba(245,255,255,0.08)"}`,
                boxShadow: active ? `inset 0 0 24px ${menu.color}14, 0 0 12px ${menu.color}14` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: menu.color, fontSize: 11, fontWeight: 950 }}>{menu.number}</span>
                <span style={{ fontSize: 14, fontWeight: 950, letterSpacing: "0.06em" }}>{menu.label}</span>
              </div>
              <span style={{ color: menu.color, fontSize: 8, fontWeight: 950, letterSpacing: "0.08em" }}>{menu.status}</span>
              {active ? <div style={{ position: "absolute", right: -7, width: 12, height: 12, borderRadius: 99, opacity: clickPulse, background: menu.color, boxShadow: `0 0 18px ${menu.color}` }} /> : null}
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 44, top: 269, width: 252, height: 62, background: "rgb(0,8,11)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(245,255,255,0.48)", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em" }}><span>UNSPENT</span><span style={{ color: arenaTheme.yellow }}>1,230 CU</span></div>
        <div style={{ height: 6, marginTop: 9, background: "rgba(245,255,255,0.07)" }}><div style={{ width: "85%", height: "100%", background: arenaTheme.cyan }} /></div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", color: "rgba(245,255,255,0.48)", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em" }}><span>LATENCY CAP</span><span style={{ color: arenaTheme.green }}>231 / 300 MS</span></div>
      </div>

      <div style={{ ...panel, position: "absolute", left: 24, right: 24, top: 740, height: 316, padding: "16px 18px" }}>
        <div style={{ height: 35, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ color: arenaTheme.green, fontSize: 12, fontWeight: 950, letterSpacing: "0.18em" }}>ACTIVE LOADOUT</span>
            <span style={{ marginLeft: 14, color: "rgba(245,255,255,0.34)", fontSize: 9, fontWeight: 900, letterSpacing: "0.11em" }}>8 MODULES // 6,770 CU // 231 MS</span>
          </div>
          <div style={{ color: activeMenu.color, fontSize: 9, fontWeight: 950, letterSpacing: "0.12em" }}>{activeMenu.label} // INSPECTION ACTIVE</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 8 }}>
          {finalLoadout.map((item, index) => {
            const highlighted = item.menu === activeMenu.key;
            const slotIn = spring({
              frame: frame - (quickStart ? index : 20 + index * 3),
              fps,
              config: { damping: 200 },
            });
            return (
              <div key={item.slot} style={{ position: "relative", height: 174, padding: "13px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between", color: arenaTheme.white, background: `linear-gradient(155deg, ${item.color}${highlighted ? "24" : "10"}, rgba(0,10,13,0.98))`, border: `1px solid ${item.color}${highlighted ? "bb" : "45"}`, boxShadow: highlighted ? `inset 0 0 28px ${item.color}18, 0 0 16px ${item.color}15` : "none", opacity: slotIn, transform: `translateY(${(1 - slotIn) * 14}px)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(245,255,255,0.4)", fontSize: 8, fontWeight: 950, letterSpacing: "0.1em" }}><span>{item.slot}</span><span style={{ color: item.color }}>{item.type}</span></div>
                <div style={{ width: 48, height: 48, margin: "0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: item.color, border: `1px solid ${item.color}88`, background: `${item.color}12`, fontSize: 18, fontWeight: 950 }}>
                  {item.logo ? (
                    <BrandLogo
                      logo={item.logo}
                      mode={item.logoMode}
                      crop={item.logoCrop}
                      scale={item.logoScale}
                      size={48}
                      selected={highlighted}
                    />
                  ) : item.name.slice(0, 2)}
                </div>
                <div style={{ minHeight: 31, textAlign: "center", fontSize: item.name.length > 16 ? 9 : 13, lineHeight: 1.15, fontWeight: 950 }}>{item.name}</div>
                <div style={{ height: 3, background: "rgba(245,255,255,0.07)" }}><div style={{ width: "100%", height: "100%", background: item.color, opacity: highlighted ? 1 : 0.55 }} /></div>
              </div>
            );
          })}
        </div>

        <div style={{ position: "absolute", left: "50%", bottom: 13, transform: "translateX(-50%)", color: "rgba(245,255,255,0.35)", fontSize: 8, fontWeight: 900, letterSpacing: "0.16em" }}>LOADOUT HASH // 0X4D3A...A91F // READY TO SEAL</div>
      </div>

      {lockProgress > 0 ? (
        <AbsoluteFill style={{ pointerEvents: "none", alignItems: "center", justifyContent: "center", background: `rgba(0,8,11,${lockProgress * 0.62})`, opacity: lockProgress }}>
          <div style={{ width: 820, padding: "31px 38px", color: arenaTheme.green, background: "rgba(0,19,19,0.97)", border: `2px solid ${arenaTheme.green}`, boxShadow: `0 0 ${38 * pulse}px rgba(0,255,156,0.48), inset 0 0 32px rgba(0,255,156,0.08)`, textAlign: "center", clipPath: "polygon(3% 0, 97% 0, 100% 22%, 100% 78%, 97% 100%, 3% 100%, 0 78%, 0 22%)" }}>
            <div style={{ fontSize: 13, fontWeight: 950, letterSpacing: "0.28em" }}>ALL SYSTEMS VERIFIED</div>
            <div style={{ marginTop: 13, color: arenaTheme.white, fontSize: 50, lineHeight: 0.95, fontWeight: 950, letterSpacing: "0.055em" }}>LOADOUT LOCKED</div>
            <div style={{ marginTop: 15, color: arenaTheme.cyan, fontSize: 12, fontWeight: 950, letterSpacing: "0.16em" }}>4 SYSTEMS // 8 MODULES // NEUTRAL SANDBOX</div>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
