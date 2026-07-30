import { Address, createTestClient, http } from "viem";
import { base, baseSepolia, hardhat } from "viem/chains";

// How the lobby tops up the ten per-run agent wallets, one action per network:
//
//   local  — hardhat_setBalance, no wallet and no gas involved
//   batch  — a single Multicall3.aggregate3Value transaction from the director
//   none   — funding is unavailable and the lobby offers to skip instead
export type FundingMode = "local" | "batch" | "none";

// Multicall3 is deployed at the same canonical address on both Base networks.
export const MULTICALL3_ADDRESS: Record<number, Address> = {
  [base.id]: "0xcA11bde05977b3631167028862bE2a173976CA11",
  [baseSepolia.id]: "0xcA11bde05977b3631167028862bE2a173976CA11",
};

// Base mainnet is deliberately absent: agent keys are generated per run and
// discarded when it ends, so anything sent there would be unrecoverable. Adding
// base.id here is all it takes to turn it on.
const BATCH_FUNDING_CHAINS: number[] = [baseSepolia.id];

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
export const localTestClient = createTestClient({ chain: hardhat, mode: "hardhat", transport: http() });
