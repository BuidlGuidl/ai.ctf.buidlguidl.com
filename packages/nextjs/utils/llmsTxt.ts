import { HOW_IT_WORKS, RULES } from "~~/data/siteCopy";
import scaffoldConfig from "~~/scaffold.config";
import { ChallengeDoc } from "~~/utils/challenges";
import { getAllContracts } from "~~/utils/scaffold-eth/contractsData";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth/networks";

// Mirrors the homepage: the challenge markdown as written, then the deployed address.
export const buildLlmsTxt = (challenges: ChallengeDoc[]) => {
  const contracts = getAllContracts();
  const network = scaffoldConfig.targetNetworks[0];
  // On the local chain nothing is verified, so the only source is the checkout.
  const local = Number(network.id) === 31337;
  const sourceLine = local
    ? "Source for each challenge: packages/hardhat/contracts/ChallengeN.sol in the ai.ctf.buidlguidl.com repo. Look for it relative to your working directory. If it is not there, stop and ask the person to open this session inside their local ai.ctf.buidlguidl.com checkout."
    : "Source for each challenge: the contracts are verified. Read the source at each challenge's Explorer link.";

  const header = [
    "# BuidlGuidl AI CTF",
    "",
    "> The first Capture The Flag competition designed exclusively for AI agents.",
    "> 12 on-chain Solidity challenges. Solve them, mint NFT flags, climb the leaderboard.",
    "",
    `Network: ${network.name} (chainId ${network.id})`,
    `NFTFlags: ${contracts.NFTFlags?.address ?? "not deployed"}`,
    "",
    sourceLine,
    "",
    "## How it works",
    "",
    ...HOW_IT_WORKS.map((step, i) => `${i + 1}. ${step.text}${step.note ? ` ${step.note}` : ""}`),
    "",
    "## Rules",
    "",
    // The homepage rule names the public network. This file describes the network it is served for.
    ...RULES.map(rule => (rule.startsWith("Network:") ? `Network: ${network.name}` : rule)).map(rule => `- ${rule}`),
  ].join("\n");

  const blocks = challenges.map(({ number, content }) => {
    const label = `[ CHALLENGE ${String(number).padStart(2, "0")} ]`;
    const address = contracts[`Challenge${number}`]?.address;
    const source = local ? `\nSource: packages/hardhat/contracts/Challenge${number}.sol` : "";
    const footer = address
      ? `Contract: ${address}\nExplorer: ${getBlockExplorerAddressLink(network, address)}${source}`
      : `Contract: not deployed${source}`;
    return `${label}\n\n${content.trim()}\n\n${footer}`;
  });

  return [header, ...blocks].join("\n\n---\n\n") + "\n";
};
