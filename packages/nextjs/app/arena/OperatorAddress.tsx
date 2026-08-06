"use client";

import { BlockieAvatar } from "~~/components/scaffold-eth";

export function OperatorAddress({ address, className = "" }: { address: string | null; className?: string }) {
  if (!address) return null;

  return (
    <span
      title={address}
      className={`flex shrink-0 items-center gap-1 font-mono text-sm font-normal text-[#00FBFF]/60 ${className}`}
    >
      <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-[#00FBFF]/25">
        <BlockieAvatar address={address} ensImage={null} size={16} />
      </span>
      <span>{`${address.slice(0, 6)}…${address.slice(-4)}`}</span>
    </span>
  );
}
