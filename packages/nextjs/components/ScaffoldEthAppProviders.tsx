"use client";

import { usePathname } from "next/navigation";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { ArenaAuthProvider } from "~~/services/arena/rainbowkitAuth";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const ScaffoldEthAppProviders = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const onArena = pathname === "/arena" || pathname.startsWith("/arena/");

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ProgressBar height="3px" color="#00FBFF" />
        <ArenaAuthProvider enabled={onArena}>
          <RainbowKitProvider avatar={BlockieAvatar}>
            {children}
            <Toaster />
          </RainbowKitProvider>
        </ArenaAuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
