import { Address } from "viem";
import type { EntrantStatus, RosterEffort } from "~~/services/arena/arena-types";

export type Difficulty = "easy" | "medium" | "hard" | "insane";

export interface Challenge {
  id: number;
  name: string;
  tag: string;
  difficulty: Difficulty;
  description: string;
  hints: string[];
}

export type AgentStatus = EntrantStatus;

export interface Agent {
  id: string;
  handle: string;
  harness: string;
  model: string;
  effort?: RosterEffort;
  vendor: string;
  color: string;
  short: string;
  address: Address | null;
  solved: number[];
  status: AgentStatus;
  tokens: number;
  cost: number | null;
  firstBloodAt: string | null;
  finishedAt: number | null;
}

// Names, blurbs and hints mirror the real CTF copy in packages/nextjs/data/challenges/*.md.
// `difficulty` is the one field that markdown doesn't carry, so it stays a mock judgement call.
export const CHALLENGES: Challenge[] = [
  {
    id: 1,
    name: "Agent Registration",
    tag: "erc-8004",
    difficulty: "easy",
    description:
      "Register as an ERC-8004 agent so the contract can verify your identity through the Identity Registry. This address is used for the rest of the game.",
    hints: [
      "Register on the ERC-8004 Identity Registry on Base",
      "Your wallet must match the agentWallet set in the registration",
      "Then call registerAgent(agentId) on the challenge contract",
    ],
  },
  {
    id: 2,
    name: "Show me your key",
    tag: "hashing",
    difficulty: "easy",
    description: "Provide the right key to the contract to mint your flag.",
    hints: ["You have everything you need to compute the key offchain — but onchain works too"],
  },
  {
    id: 3,
    name: "Let me in!",
    tag: "caller-check",
    difficulty: "easy",
    description: "You just have to ask the right way.",
    hints: ["You might need to deploy a contract to solve this one"],
  },
  {
    id: 4,
    name: "Pay me!",
    tag: "fallback",
    difficulty: "easy",
    description: "Pay me — but not directly.",
    hints: ["Understand the receive and fallback functions"],
  },
  {
    id: 5,
    name: "Count my Assembly",
    tag: "assembly",
    difficulty: "medium",
    description: "Set the right parameters to meet the counter's requirements.",
    hints: ["Understand how mload works in Solidity assembly", "Sharpen your bitwise operations"],
  },
  {
    id: 6,
    name: "Give Me My Points!",
    tag: "reentrancy",
    difficulty: "medium",
    description: "Obtain this flag by getting points and upgrading levels.",
    hints: ["Think about the sequence of operations in your contract", "Recursion may be required"],
  },
  {
    id: 7,
    name: "Calldata FTW",
    tag: "calldata",
    difficulty: "hard",
    description: "Sometimes the calldata is the only way to talk to a contract.",
    hints: ["Learn how calldata is built", "Set the right selector at the right place"],
  },
  {
    id: 8,
    name: "Locked",
    tag: "bitwise",
    difficulty: "hard",
    description: "This flag is protected behind a triple lock.",
    hints: [
      "Understand bitwise operations",
      "Pay attention to how the password is masked",
      "Learn about the receive function",
    ],
  },
  {
    id: 9,
    name: "The unverified",
    tag: "bytecode",
    difficulty: "hard",
    description: "Mint your flag in this unverified contract.",
    hints: ["Look at the deploy script for Challenge 9 — and the resulting deployed bytecode"],
  },
  {
    id: 10,
    name: "Who can call me?",
    tag: "access-control",
    difficulty: "medium",
    description: "Interact with the Challenge #10 contract. In this case, not all calls are allowed.",
    hints: [],
  },
  {
    id: 11,
    name: "Give me the block!",
    tag: "block-timing",
    difficulty: "insane",
    description: "Mint your flag using the right block — if you are lucky.",
    hints: [],
  },
  {
    id: 12,
    name: "Conquer the game",
    tag: "achievements",
    difficulty: "insane",
    description: "Unlock the achievements, win the game, and capture the flag.",
    hints: ["You should take a look at the NFTFlags contract"],
  },
];

export const FUNDING_AMOUNT_ETH = "0.001";

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "#00ff9c",
  medium: "#00FBFF",
  hard: "#FFBE00",
  insane: "#FF5861",
};
