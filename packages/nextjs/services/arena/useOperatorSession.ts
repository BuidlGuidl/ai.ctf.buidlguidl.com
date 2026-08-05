"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { SessionResponse } from "./arena-types";
import { devSigner, operatorSiweMessage, seedTypedData } from "./auth";
import { arenaClient } from "./client";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import create from "zustand";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { selectRunChainId, useArenaStore } from "~~/services/arena/store";

export interface OperatorSession {
  authenticated: boolean;
  address: string | null;
  configured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface OperatorSessionState {
  session: SessionResponse | null;
  setSession: (session: SessionResponse) => void;
}

const useOperatorSessionStore = create<OperatorSessionState>(set => ({
  session: null,
  setSession: session => set({ session }),
}));

let pendingSession: Promise<SessionResponse> | null = null;

export function useOperatorSession(): OperatorSession {
  const session = useOperatorSessionStore(state => state.session);
  const setSession = useOperatorSessionStore(state => state.setSession);
  const { address: connectedAddress, chainId: connectedChainId } = useAccount();
  const runChainId = useArenaStore(selectRunChainId);
  const { targetNetwork } = useTargetNetwork();
  const chainId = connectedChainId ?? runChainId ?? targetNetwork.id;
  const { signMessageAsync } = useSignMessage();

  const signingAddress = connectedAddress ?? devSigner?.address;

  useEffect(() => {
    if (session !== null) return;
    let active = true;
    pendingSession ??= arenaClient
      .getSession()
      .catch((): SessionResponse => ({ authenticated: false, configured: false }))
      .finally(() => {
        pendingSession = null;
      });
    void pendingSession.then(next => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
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
    await arenaClient.logout();
    const next = await arenaClient.getSession();
    setSession(next);
  }, [setSession]);

  return useMemo(
    () => ({
      authenticated: session?.authenticated === true,
      address: session?.authenticated === true ? session.address : signingAddress ?? null,
      configured: session === null ? false : session.authenticated ? true : session.configured,
      signIn,
      signOut,
    }),
    [session, signIn, signOut, signingAddress],
  );
}

export function useSeedSigner() {
  const { address: connectedAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  return useCallback(
    async (runId: string, chainId: number) => {
      const typedData = seedTypedData(runId, chainId);
      const signature = connectedAddress
        ? await signTypedDataAsync(typedData)
        : await devSigner?.signTypedData(typedData);
      if (!signature) throw new Error("The wallet returned no seed signature");
      return signature;
    },
    [connectedAddress, signTypedDataAsync],
  );
}
