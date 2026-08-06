"use client";

import { operatorSiweMessage } from "./auth";
import { ArenaApiError, arenaClient } from "./client";
import { applySession, useAuthenticationStatus } from "./useOperatorSession";
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
    try {
      await arenaClient.logout();
    } catch {
      // RainbowKit must clear the local session even if the arena backend is unavailable.
    }
    applySession(null);
  },
});

export function ArenaAuthProvider({ children }: { children: React.ReactNode }) {
  const status = useAuthenticationStatus();

  return (
    <RainbowKitAuthenticationProvider adapter={arenaAuthenticationAdapter} status={status}>
      {children}
    </RainbowKitAuthenticationProvider>
  );
}
