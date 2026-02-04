"use client";

import { ReactNode, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";

/**
 */
export const HeaderClient = ({ menuLinks }: { menuLinks: ReactNode }) => {
  const currentChain = scaffoldConfig.targetNetworks[0];

  const searchParams = useSearchParams();
  const isBigScreen = searchParams.has("bigscreen");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const burgerMenuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(
    burgerMenuRef,
    useCallback(() => setIsDrawerOpen(false), []),
  );

  if (isBigScreen) {
    return null;
  }

  return (
    <div className="sticky lg:static top-0 bg-black border-b border-green-600 min-h-0 flex-shrink-0 z-20 px-4 py-2">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        {/* Logo / Title */}
        <div className="flex items-center gap-4">
          <div className="lg:hidden" ref={burgerMenuRef}>
            <button
              className="text-green-400 hover:text-green-300 p-2"
              onClick={() => setIsDrawerOpen(prevIsOpenState => !prevIsOpenState)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            {isDrawerOpen && (
              <ul
                className="absolute mt-2 p-2 bg-black border border-green-600 w-52 font-mono text-sm"
                onClick={() => setIsDrawerOpen(false)}
              >
                {menuLinks}
              </ul>
            )}
          </div>
          <Link href="/" className="flex items-center gap-2 text-green-400 hover:text-green-300 font-mono">
            <span className="text-yellow-400">&gt;</span>
            <span className="hidden sm:inline">AI_CTF</span>
            <span className="sm:hidden">CTF</span>
            <span className="animate-pulse">_</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <ul className="hidden lg:flex items-center gap-6 font-mono text-sm text-green-400">{menuLinks}</ul>

        {/* Connect Button */}
        <div className="flex items-center gap-2">
          <RainbowKitCustomConnectButton />
          {(currentChain?.id as number) === hardhat.id && <FaucetButton />}
        </div>
      </div>
    </div>
  );
};
