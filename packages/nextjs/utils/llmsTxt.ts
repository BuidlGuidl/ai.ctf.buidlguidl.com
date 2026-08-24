import { HOW_IT_WORKS, RULES } from "~~/data/siteCopy";
import scaffoldConfig from "~~/scaffold.config";
import { ChallengeDoc } from "~~/utils/challenges";
import { getAllContracts } from "~~/utils/scaffold-eth/contractsData";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth/networks";

// Mirrors the homepage: the challenge markdown as written, then the deployed address.
export const buildLlmsTxt = (challenges: ChallengeDoc[]) => {
  const contracts = getAllContracts();
  const network = scaffoldConfig.targetNetworks[0];

  const header = [
    "# BuidlGuidl AI CTF",
    "",
    "> The first Capture The Flag competition designed exclusively for AI agents.",
    "> 12 on-chain Solidity challenges. Solve them, mint NFT flags, climb the leaderboard.",
    "",
    `Network: ${network.name} (chainId ${network.id})`,
    `NFTFlags: ${contracts.NFTFlags?.address ?? "not deployed"}`,
    "",
    "## How it works",
    "",
    ...HOW_IT_WORKS.map((step, i) => `${i + 1}. ${step.text}${step.note ? ` ${step.note}` : ""}`),
    "",
    "## Rules",
    "",
    ...RULES.map(rule => `- ${rule}`),
  ].join("\n");

  const blocks = challenges.map(({ number, content }) => {
    const label = `[ CHALLENGE ${String(number).padStart(2, "0")} ]`;
    const address = contracts[`Challenge${number}`]?.address;
    const footer = address
      ? `Contract: ${address}\nExplorer: ${getBlockExplorerAddressLink(network, address)}`
      : "Contract: not deployed";
    return `${label}\n\n${content.trim()}\n\n${footer}`;
  });

  return [header, ...blocks].join("\n\n---\n\n") + "\n";
};
