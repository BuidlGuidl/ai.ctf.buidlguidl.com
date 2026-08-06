"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SessionResponse } from "./arena-types";
import { devSigner, operatorSiweMessage, seedTypedData } from "./auth";
import { arenaClient } from "./client";
import { useAccount, useSignMessage, useSignTypedData, useSwitchChain } from "wagmi";
import create from "zustand";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { selectRunChainId, useArenaStore } from "~~/services/arena/store";

export interface OperatorSession {
  authenticated: boolean;
  address: string | null;
  configured: boolean;
  hadSession: boolean;
  sessionLoaded: boolean;
  invalidate: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface OperatorSessionState {
  configured: boolean;
  hadSession: boolean;
  session: SessionResponse | null;
  setSession: (session: SessionResponse | null) => void;
}

const useOperatorSessionStore = create<OperatorSessionState>(set => ({
  configured: false,
  hadSession: false,
  session: null,
  setSession: session =>
    set(state => ({
      configured: session === null ? state.configured : session.authenticated ? true : session.configured,
      hadSession: state.hadSession || session?.authenticated === true,
      session,
    })),
}));

export function applySession(next: SessionResponse | null): void {
  useOperatorSessionStore.getState().setSession(next);
}

export function getStoredSession(): SessionResponse | null {
  return useOperatorSessionStore.getState().session;
}

export function useAuthenticationStatus(): "loading" | "unauthenticated" | "authenticated" {
  return useOperatorSessionStore(state => {
    if (state.session === null) return "loading";
    return state.session.authenticated ? "authenticated" : "unauthenticated";
  });
}

let pendingSession: Promise<SessionResponse> | null = null;

export function useOperatorSession(): OperatorSession {
  const configured = useOperatorSessionStore(state => state.configured);
  const hadSession = useOperatorSessionStore(state => state.hadSession);
  const session = useOperatorSessionStore(state => state.session);
  const setSession = useOperatorSessionStore(state => state.setSession);
  const { address: connectedAddress, chainId: connectedChainId } = useAccount();
  const runChainId = useArenaStore(selectRunChainId);
  const { targetNetwork } = useTargetNetwork();
  const chainId = connectedChainId ?? runChainId ?? targetNetwork.id;
  const { signMessageAsync } = useSignMessage();
  const previousConnectedAddress = useRef<typeof connectedAddress>(undefined);

  const signingAddress = connectedAddress ?? devSigner?.address;

  useEffect(() => {
    if (session !== null) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const loadSession = () => {
      if (!active || useOperatorSessionStore.getState().session !== null) return;
      pendingSession ??= arenaClient.getSession().finally(() => {
        pendingSession = null;
      });
      void pendingSession
        .then(next => {
          if (active && useOperatorSessionStore.getState().session === null) setSession(next);
        })
        .catch(() => {
          if (active && useOperatorSessionStore.getState().session === null) {
            retryTimer = setTimeout(loadSession, 3000);
          }
        });
    };

    loadSession();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [session, setSession]);

  const signIn = useCallback(async () => {
    if (!signingAddress) throw new Error("No wallet is ready to sign in");
    const { nonce } = await arenaClient.getNonce();
    const message = operatorSiweMessage(signingAddress, nonce, chainId);
    const signature = connectedAddress
      ? await signMessageAsync({ message })
      : await devSigner?.signMessage({ message });
    if (!signature) throw new Error("The wallet returned no signature");
    const verified = await arenaClient.verify({ message, signature });
    setSession({ authenticated: true, ...verified });
  }, [chainId, connectedAddress, setSession, signMessageAsync, signingAddress]);

  const signOut = useCallback(async () => {
    try {
      await arenaClient.logout();
    } catch {
      // Local session cleanup must still run when the backend is unavailable.
    } finally {
      setSession(null);
    }
  }, [setSession]);

  const invalidate = useCallback(() => setSession(null), [setSession]);

  useEffect(() => {
    const previousAddress = previousConnectedAddress.current;
    previousConnectedAddress.current = connectedAddress;

    if (
      session?.authenticated &&
      session.address &&
      connectedAddress &&
      session.address.toLowerCase() !== connectedAddress.toLowerCase()
    ) {
      void signOut();
    }

    if (previousAddress && !connectedAddress && session?.authenticated) void signOut();
  }, [connectedAddress, session, signOut]);

  return useMemo(
    () => ({
      authenticated: session?.authenticated === true,
      address: session?.authenticated === true ? session.address : signingAddress ?? null,
      configured,
      hadSession,
      sessionLoaded: session !== null,
      invalidate,
      signIn,
      signOut,
    }),
    [configured, hadSession, invalidate, session, signIn, signOut, signingAddress],
  );
}

export function useSeedSigner() {
  const { address: connectedAddress, chainId: connectedChainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

  return useCallback(
    async (runId: string, chainId: number) => {
      const typedData = seedTypedData(runId, chainId);
      // A wallet refuses typed data whose domain chain is not the one it has
      // selected. The dev signer holds a raw key, so it never checks.
      if (connectedAddress && connectedChainId !== chainId) {
        await switchChainAsync({ chainId }).catch(() => {
          throw new Error(`Switch the wallet to chain ${chainId} to sign the run seed`);
        });
      }
      const signature = connectedAddress
        ? await signTypedDataAsync(typedData)
        : await devSigner?.signTypedData(typedData);
      if (!signature) throw new Error("The wallet returned no seed signature");
      return signature;
    },
    [connectedAddress, connectedChainId, signTypedDataAsync, switchChainAsync],
  );
}
