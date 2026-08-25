"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { SessionResponse } from "./arena-types";
import { devSigner, operatorSiweMessage, seedTypedData } from "./auth";
import { arenaClient } from "./client";
import { useAccount, useConfig, useSignMessage, useSignTypedData, useSwitchChain } from "wagmi";
import { getAccount } from "wagmi/actions";
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

// null here means a deliberate sign-out (the wallet left), so the sticky
// hadSession clears too — unlike invalidate(), where the session died under a
// still-connected operator and "sign back in" is the right offer.
export function applySession(next: SessionResponse | null): void {
  if (next === null) {
    useOperatorSessionStore.setState({ session: null, hadSession: false });
    return;
  }
  useOperatorSessionStore.getState().setSession(next);
}

// Deliberate exit: local auth dies first so the controls disarm immediately,
// then the backend hears about it best-effort — a hung or failed logout must
// not keep a disconnected operator armed.
export function endOperatorSession(): void {
  applySession(null);
  void arenaClient.logout().catch(() => {
    // The server cookie outlives an unreachable backend; the wallet watcher
    // ends any session the loader restores while the wallet is still gone.
  });
}

// The session follows the wallet. Mounted once in ArenaAuthProvider (which is
// always mounted), so a disconnect on a spectator route ends the operator
// session too. Only settled wagmi states act — 'reconnecting' on a reload must
// not kill a valid session — and dev-signer sessions have no wallet to follow.
export function useWalletSessionWatcher(): void {
  const { address, status } = useAccount();
  const session = useOperatorSessionStore(state => state.session);

  useEffect(() => {
    if (devSigner !== null) return;
    if (session?.authenticated !== true) return;
    if (status === "disconnected") {
      endOperatorSession();
      return;
    }
    if (
      status === "connected" &&
      session.address &&
      address &&
      session.address.toLowerCase() !== address.toLowerCase()
    ) {
      endOperatorSession();
    }
  }, [address, status, session]);
}

export function useAuthenticationStatus(): "loading" | "unauthenticated" | "authenticated" {
  return useOperatorSessionStore(state => {
    if (state.session === null) return "loading";
    return state.session.authenticated ? "authenticated" : "unauthenticated";
  });
}

let pendingSession: Promise<SessionResponse> | null = null;

export function useEnsureChain() {
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();

  return useCallback(
    async (chainId: number) => {
      // Read the wallet's chain at call time: a handler that switches and then
      // signs must not act on the chain this render captured.
      const account = getAccount(config);
      if (!account.address || account.chainId === chainId) return;
      try {
        await switchChainAsync({ chainId });
      } catch (cause) {
        const name = config.chains.find(chain => chain.id === chainId)?.name ?? `chain ${chainId}`;
        throw new Error(`Switch to ${name}`, { cause });
      }
    },
    [config, switchChainAsync],
  );
}

export function useOperatorSession(): OperatorSession {
  const configured = useOperatorSessionStore(state => state.configured);
  const hadSession = useOperatorSessionStore(state => state.hadSession);
  const session = useOperatorSessionStore(state => state.session);
  const setSession = useOperatorSessionStore(state => state.setSession);
  const { address: connectedAddress } = useAccount();
  const runChainId = useArenaStore(selectRunChainId);
  const { targetNetwork } = useTargetNetwork();
  const chainId = runChainId ?? targetNetwork.id;
  const { signMessageAsync } = useSignMessage();
  const ensureChain = useEnsureChain();

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
    await ensureChain(chainId);
    const { nonce } = await arenaClient.getNonce();
    const message = operatorSiweMessage(signingAddress, nonce, chainId);
    const signature = connectedAddress
      ? await signMessageAsync({ message })
      : await devSigner?.signMessage({ message });
    if (!signature) throw new Error("The wallet returned no signature");
    const verified = await arenaClient.verify({ message, signature });
    setSession({ authenticated: true, ...verified });
  }, [chainId, connectedAddress, ensureChain, setSession, signMessageAsync, signingAddress]);

  const signOut = useCallback(async () => {
    endOperatorSession();
  }, []);

  const invalidate = useCallback(() => setSession(null), [setSession]);

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
  const { address: connectedAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const ensureChain = useEnsureChain();

  return useCallback(
    async (runId: string, chainId: number) => {
      const typedData = seedTypedData(runId, chainId);
      // A wallet refuses typed data whose domain chain is not the one it has
      // selected. The dev signer holds a raw key, so it never checks.
      await ensureChain(chainId);
      const signature = connectedAddress
        ? await signTypedDataAsync(typedData)
        : await devSigner?.signTypedData(typedData);
      if (!signature) throw new Error("The wallet returned no seed signature");
      return signature;
    },
    [connectedAddress, ensureChain, signTypedDataAsync],
  );
}
