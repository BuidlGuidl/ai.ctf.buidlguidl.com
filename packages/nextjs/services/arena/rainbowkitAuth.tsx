"use client";

import { operatorSiweMessage } from "./auth";
import { ArenaApiError, arenaClient } from "./client";
import {
  applySession,
  endOperatorSession,
  useAuthenticationStatus,
  useWalletSessionWatcher,
} from "./useOperatorSession";
import { RainbowKitAuthenticationProvider, createAuthenticationAdapter } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";
import { notification } from "~~/utils/scaffold-eth";

const arenaAuthenticationAdapter = createAuthenticationAdapter({
  getNonce: async () => (await arenaClient.getNonce()).nonce,
  createMessage: ({ nonce, address, chainId }) => operatorSiweMessage(address as Address, nonce, chainId),
  getMessageBody: ({ message }) => message,
  verify: async ({ message, signature }) => {
    try {
      const verified = await arenaClient.verify({ message, signature });
      applySession({ authenticated: true, ...verified });
      return true;
    } catch (cause) {
      // RainbowKit's modal only says "please retry", which reads as transient; a
      // refusal like "not an arena operator" is permanent and must reach the user.
      notification.error(cause instanceof ArenaApiError ? cause.message : "The arena backend rejected the sign-in");
      return false;
    }
  },
  signOut: async () => {
    endOperatorSession();
  },
});

// Always mounted so client-side nav across the /arena boundary never swaps the
// provider tree (a swap would remount the whole app); `enabled` does the scoping.
export function ArenaAuthProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const status = useAuthenticationStatus();
  useWalletSessionWatcher();

  return (
    <RainbowKitAuthenticationProvider adapter={arenaAuthenticationAdapter} status={status} enabled={enabled}>
      {children}
    </RainbowKitAuthenticationProvider>
  );
}
