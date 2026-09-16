import { ReactNode } from "react";
import Link from "next/link";
import scaffoldConfig from "~~/scaffold.config";
import { ARENA_PUBLIC_BACKEND_URL } from "~~/services/arena/client";

export const MCP_URL = `${ARENA_PUBLIC_BACKEND_URL}/mcp`;
const CHAIN = scaffoldConfig.targetNetworks[0];
export const NETWORK_NAME = CHAIN.name;
export const CURRENCY_SYMBOL = CHAIN.nativeCurrency.symbol;
export const RPC_URL = CHAIN.rpcUrls.default.http[0];
export const LOCAL_CHAIN = Number(CHAIN.id) === 31337;
export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FBFF]";
export const BODY = "max-w-[72ch] text-sm leading-6 text-[#00FBFF]/75";

export function SetupShell({
  title,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black font-mono text-[#00FBFF]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#00FBFF]/25 bg-[#001014] px-4 sm:px-5">
        <h1 className="min-w-0 font-dotGothic text-base tracking-wide sm:text-2xl">{title}</h1>
        <Link
          href={backHref}
          className={`ml-auto shrink-0 rounded border border-[#00FBFF]/30 px-2 py-2 font-dotGothic text-xs tracking-widest text-[#00FBFF]/75 hover:border-[#00FBFF] hover:text-[#00FBFF] sm:text-sm ${FOCUS}`}
        >
          {backLabel}
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-10 pb-8">{children}</div>
      </main>
    </div>
  );
}

export function Section({
  id,
  number,
  title,
  children,
  open = false,
}: {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details aria-labelledby={id} className="group/step space-y-4" open={open}>
      <summary
        id={id}
        className={`flex cursor-pointer list-none items-baseline gap-2 font-dotGothic text-2xl [&::-webkit-details-marker]:hidden ${FOCUS}`}
      >
        <span aria-hidden="true" className="text-sm">
          <span className="group-open/step:hidden">▸</span>
          <span className="hidden group-open/step:inline">▾</span>
        </span>
        <h2 className="inline font-dotGothic text-2xl">
          {number}. {title}
        </h2>
      </summary>
      {children}
    </details>
  );
}
