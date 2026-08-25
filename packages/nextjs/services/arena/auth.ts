import type { Address, Hex, LocalAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

// Local dev signs operator actions without a wallet prompt. Production leaves this
// unset and every signature goes through the connected wallet instead.
// Use Hardhat account 0: the local chain profile registers it as the seed funder,
// so the same key can both sign in and seed a run.
export const devSigner: LocalAccount | null = (() => {
  const key = process.env.NEXT_PUBLIC_ARENA_DEV_SIGNER_KEY;
  if (!key || process.env.NODE_ENV === "production") return null;
  try {
    return privateKeyToAccount(key as Hex);
  } catch {
    return null;
  }
})();

export function operatorSiweMessage(address: Address, nonce: string, chainId: number): string {
  return createSiweMessage({
    address,
    chainId,
    domain: window.location.host,
    nonce,
    statement: "Sign in as an Agents Arena operator.",
    uri: window.location.origin,
    version: "1",
  });
}

export function seedTypedData(runId: string, chainId: number) {
  return {
    domain: { name: "agents-arena", version: "1", chainId: BigInt(chainId) },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      Seed: [{ name: "runId", type: "string" }],
    },
    primaryType: "Seed" as const,
    message: { runId },
  } as const;
}
