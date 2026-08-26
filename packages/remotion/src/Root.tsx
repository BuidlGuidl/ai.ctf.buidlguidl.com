import {
  AgentArenaStarter,
  type AgentArenaStarterProps,
  STARTER_DURATION_IN_FRAMES,
} from "./compositions/AgentArenaStarter";
import { TheReveal, THE_REVEAL_DURATION_IN_FRAMES } from "./compositions/TheReveal";
import { AgentLoadout, AGENT_LOADOUT_DURATION_IN_FRAMES } from "./compositions/AgentLoadout";
import {
  AgentLoadoutTour,
  AGENT_LOADOUT_TOUR_DURATION_IN_FRAMES,
} from "./compositions/AgentLoadoutTour";
import {
  AgentLoadoutStory,
  AGENT_LOADOUT_STORY_DURATION_IN_FRAMES,
} from "./compositions/AgentLoadoutStory";
import {
  AgentLoadoutGuided,
  AGENT_LOADOUT_GUIDED_DURATION_IN_FRAMES,
} from "./compositions/AgentLoadoutGuided";
import {InsideAgent, INSIDE_AGENT_DURATION_IN_FRAMES} from "./compositions/InsideAgent";
import { Composition, Folder } from "remotion";

const defaultProps = {
  eyebrow: "BUIDLGUIDL AI CTF",
  title: "AGENT ARENA",
  subtitle: "Programmatic marketing video starter",
  status: "REMOTION READY",
} satisfies AgentArenaStarterProps;

export const RemotionRoot = () => {
  return (
    <>
      <Folder name="Campaign">
        <Composition
          id="Inside-Agent-Landscape"
          component={InsideAgent}
          durationInFrames={INSIDE_AGENT_DURATION_IN_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Agent-Loadout-Guided-Landscape"
          component={AgentLoadoutGuided}
          durationInFrames={AGENT_LOADOUT_GUIDED_DURATION_IN_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Agent-Loadout-Story-Landscape"
          component={AgentLoadoutStory}
          durationInFrames={AGENT_LOADOUT_STORY_DURATION_IN_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Agent-Loadout-Tour-Landscape"
          component={AgentLoadoutTour}
          durationInFrames={AGENT_LOADOUT_TOUR_DURATION_IN_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Agent-Loadout-Landscape"
          component={AgentLoadout}
          durationInFrames={AGENT_LOADOUT_DURATION_IN_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="The-Reveal-Landscape"
          component={TheReveal}
          durationInFrames={THE_REVEAL_DURATION_IN_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
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
    </>
  );
};
