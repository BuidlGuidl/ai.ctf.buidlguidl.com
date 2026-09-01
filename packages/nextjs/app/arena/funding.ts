import { Address, createTestClient, http, publicActions } from "viem";
import { base, baseSepolia, hardhat } from "viem/chains";

// How the lobby tops up the ten per-run agent wallets, one action per network:
//
//   local  — hardhat_setBalance, no wallet and no gas involved
//   batch  — a single Multicall3.aggregate3Value transaction from the director
//   none   — funding is unavailable and the controls stay disabled
export type FundingMode = "local" | "batch" | "none";

// Mirrors the backend's chains.json fundingThresholdEth; keep in sync.
const FUNDING_THRESHOLD_ETH: Record<number, string> = {
  [hardhat.id]: "0.05",
  [base.id]: "0.001",
  [baseSepolia.id]: "0.005",
};

export function fundingThresholdEth(chainId?: number): string {
  return (chainId === undefined ? undefined : FUNDING_THRESHOLD_ETH[chainId]) ?? "0.05";
}

// Multicall3 is deployed at the same canonical address on both Base networks.
export const MULTICALL3_ADDRESS: Record<number, Address> = {
  [base.id]: "0xcA11bde05977b3631167028862bE2a173976CA11",
  [baseSepolia.id]: "0xcA11bde05977b3631167028862bE2a173976CA11",
};

// Base mainnet used to be deliberately absent because per-run agent keys were
// discarded, making funds unrecoverable. The operator sweep
// (agents-arena-backend#75 + the /arena/sweep page) recovers leftovers now.
const BATCH_FUNDING_CHAINS: number[] = [base.id, baseSepolia.id];

export function fundingMode(chainId?: number): FundingMode {
  if (chainId === undefined) return "none";
  if (chainId === hardhat.id) return "local";
  if (BATCH_FUNDING_CHAINS.includes(chainId) && MULTICALL3_ADDRESS[chainId]) return "batch";
  return "none";
}

export const MULTICALL3_ABI = [
  {
    type: "function",
    name: "aggregate3Value",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

// Anvil answers the hardhat_ namespace too, so this covers both local nodes.
export const localTestClient = createTestClient({ chain: hardhat, mode: "hardhat", transport: http() }).extend(
  publicActions,
);
