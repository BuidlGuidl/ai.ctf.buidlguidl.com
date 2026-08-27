import { AgentHome, agentHomeMetadata } from "~~/app/_components/home/AgentHome";
import { MarketingLanding, marketingLandingMetadata } from "~~/app/_components/landing/MarketingLanding";
import { MARKETING_LANDING } from "~~/utils/landing";

export const metadata = MARKETING_LANDING ? marketingLandingMetadata : agentHomeMetadata;

export default MARKETING_LANDING ? MarketingLanding : AgentHome;
