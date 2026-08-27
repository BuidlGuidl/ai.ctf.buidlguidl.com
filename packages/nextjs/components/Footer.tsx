"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { hardhat } from "viem/chains";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Faucet } from "~~/components/scaffold-eth";
import { useInitializeNativeCurrencyPrice } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 */
export const Footer = () => {
  const searchParams = useSearchParams();
  const isBigScreen = searchParams.has("bigscreen");

  useInitializeNativeCurrencyPrice();
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  if (isBigScreen) {
    return null;
  }

  return (
    <div className="bg-black border-t border-green-600 py-4 px-4 font-mono text-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Left side - dev tools */}
        <div className="flex gap-4">
          {isLocalNetwork && (
            <>
              <Faucet />
              <Link href="/blockexplorer" className="text-green-400 hover:text-green-300 flex items-center gap-1">
                <MagnifyingGlassIcon className="h-4 w-4" />
                <span>[explorer]</span>
              </Link>
            </>
          )}
        </div>

        {/* Center - branding */}
        <div className="text-gray-500 text-center">
          <span className="text-green-600">{`//`}</span> built by{" "}
          <a
            href="https://buidlguidl.com/"
            target="_blank"
            rel="noreferrer"
            className="text-green-400 hover:text-green-300"
          >
            BuidlGuidl
          </a>
        </div>

        {/* Right side - links */}
        <div className="text-gray-600">
          <Link href="/leaderboard" className="hover:text-green-400">
            /leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
};
