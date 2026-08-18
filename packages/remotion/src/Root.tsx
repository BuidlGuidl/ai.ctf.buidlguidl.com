import {
  AgentArenaStarter,
  type AgentArenaStarterProps,
  STARTER_DURATION_IN_FRAMES,
} from "./compositions/AgentArenaStarter";
import { Composition, Folder } from "remotion";

const defaultProps = {
  eyebrow: "BUIDLGUIDL AI CTF",
  title: "AGENT ARENA",
  subtitle: "Programmatic marketing video starter",
  status: "REMOTION READY",
} satisfies AgentArenaStarterProps;

export const RemotionRoot = () => {
  return (
    <Folder name="Starters">
      <Composition
        id="AgentArena-Landscape"
        component={AgentArenaStarter}
        durationInFrames={STARTER_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />
      <Composition
        id="AgentArena-Vertical"
        component={AgentArenaStarter}
        durationInFrames={STARTER_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
    </Folder>
  );
};
