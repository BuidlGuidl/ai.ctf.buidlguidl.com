import { useQuery } from "@tanstack/react-query";
import { Address, createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";

// Funding health check for the arena lobby. Balances are read straight from the
// chain rather than inferred from our own transactions, so an agent funded by
// any other means still shows up as funded.
//
// The client is pinned to hardhat instead of coming from wagmi: wagmiConfig only
// holds scaffoldConfig.targetNetworks plus mainnet, so usePublicClient would not
// resolve a local chain while the app targets Base. Funding is local-only anyway.
const localPublicClient = createPublicClient({ chain: hardhat, transport: http() });

export type FundingStatus = "waiting" | "partial" | "funded";

export function useAgentBalances(addresses: Address[], enabled = true) {
  // Errors are not swallowed into a 0n balance: an unreachable node would then be
  // indistinguishable from ten genuinely empty wallets, leaving the director
  // staring at a board that never moves.
  const { data, isError } = useQuery({
    queryKey: ["arenaAgentBalances", addresses],
    enabled: enabled && addresses.length > 0,
    refetchInterval: 2000,
    placeholderData: prev => prev,
    queryFn: async () => {
      const balances = await Promise.all(addresses.map(address => localPublicClient.getBalance({ address })));
      return Object.fromEntries(addresses.map((address, i) => [address, balances[i]])) as Record<string, bigint>;
    },
  });

  return { balances: data ?? {}, isError };
}

export function fundingStatus(balance: bigint | undefined, required: bigint): FundingStatus {
  // No target means nothing can be satisfied yet — without this, clearing the
  // amount field would paint every funded row green while the match stayed locked.
  if (required === 0n || !balance) return "waiting";
  return balance >= required ? "funded" : "partial";
}
