import { localTestClient } from "./funding";
import { useQuery } from "@tanstack/react-query";
import { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

// Funding health check for the arena lobby. Balances are read straight from the
// chain rather than inferred from our own transactions, so an agent funded by
// any other means still shows up as funded.

export type FundingStatus = "waiting" | "partial" | "funded";

export function useAgentBalances(addresses: Address[], enabled = true, chainId?: number) {
  const { targetNetwork } = useTargetNetwork();
  const publicClient = usePublicClient({ chainId: targetNetwork.id });
  const activeChainId = chainId ?? targetNetwork.id;
  const balanceClient = activeChainId === 31337 ? localTestClient : publicClient;

  // Errors are not swallowed into a 0n balance: an unreachable node would then be
  // indistinguishable from ten genuinely empty wallets, leaving the director
  // staring at a board that never moves.
  const { data, isError, refetch } = useQuery({
    queryKey: ["arenaAgentBalances", activeChainId, addresses],
    enabled: enabled && addresses.length > 0 && !!balanceClient,
    refetchInterval: 2000,
    placeholderData: prev => prev,
    queryFn: async () => {
      if (!balanceClient) throw new Error("no public client for the arena network");
      const balances = await Promise.all(addresses.map(address => balanceClient.getBalance({ address })));
      return Object.fromEntries(addresses.map((address, i) => [address, balances[i]])) as Record<string, bigint>;
    },
  });

  // `refetch` is exposed so a sender can read balances on demand rather than
  // trusting whatever the 2s poll last wrote — see fundAll in Lobby.tsx.
  return { balances: data ?? {}, isError, refetch };
}

export function fundingStatus(balance: bigint | undefined, required: bigint): FundingStatus {
  // No target means nothing can be satisfied yet — without this, clearing the
  // amount field would paint every funded row green while the match stayed locked.
  if (required === 0n || !balance) return "waiting";
  return balance >= required ? "funded" : "partial";
}
