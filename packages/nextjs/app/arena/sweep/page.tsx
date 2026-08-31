"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

export const dynamic = "force-dynamic";

export default function ArenaSweepRedirectPage() {
  const router = useRouter();
  const { address, status } = useAccount();
  const { openConnectModal } = useConnectModal();

  useEffect(() => {
    if (address) router.replace(`/arena/sweep/${address}`);
  }, [address, router]);

  const walletLoading = status === "connecting" || status === "reconnecting" || Boolean(address);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black font-mono text-[#00FBFF]">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] px-5">
        <div className="font-dotGothic text-xl tracking-wide md:text-2xl">
          BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · SWEEP FUNDS
        </div>
        <div className="ml-auto flex items-center gap-3">
          <RainbowKitCustomConnectButton />
          <Link
            href="/arena"
            className="rounded border border-[#00FBFF]/30 px-3 py-1 font-dotGothic text-sm tracking-widest text-[#00FBFF]/75 transition hover:border-[#00FBFF] hover:text-[#00FBFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FBFF]"
          >
            ◂ BACK TO LOBBY
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {walletLoading ? (
            <div className="animate-pulse font-dotGothic text-lg tracking-widest text-[#00FBFF]/60">◆ LOADING…</div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded border border-[#00FBFF]/20 bg-[#00090b]/60 px-5 text-center">
              <div className="text-sm tracking-wide text-[#00FBFF]/50">
                connect a wallet to find the runs you seeded
              </div>
              <button
                type="button"
                onClick={openConnectModal}
                disabled={!openConnectModal}
                className="mt-5 rounded border border-[#00FBFF]/60 px-4 py-1.5 font-dotGothic text-sm tracking-widest text-[#00FBFF] transition hover:bg-[#00FBFF] hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FBFF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                CONNECT WALLET
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
