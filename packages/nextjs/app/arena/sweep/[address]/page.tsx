"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Address as EvmAddress } from "viem";
import { formatEther, getAddress, isAddress } from "viem";
import { useAccount } from "wagmi";
import { useAgentBalances } from "~~/app/arena/useAgentBalances";
import { Address, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import type { RunListItem, RunState, SweepResponse, SweepResultStatus } from "~~/services/arena/arena-types";
import { ArenaApiError, arenaClient } from "~~/services/arena/client";
import { useOperatorSession, useSeedSigner } from "~~/services/arena/useOperatorSession";
import { useGlobalState } from "~~/services/store/store";
import { getBlockExplorerTxLink } from "~~/utils/scaffold-eth";

export const dynamic = "force-dynamic";

type SweepState =
  | { phase: "signing" }
  | { phase: "sweeping" }
  | { phase: "done"; response: SweepResponse }
  | { phase: "error"; message: string };

type RunSweepMeta = { chainId: number; state: RunState; total: bigint };
type BalanceRefetcher = () => Promise<unknown>;
type SweepOutcome = "swept" | "failed" | "unauthorized";
type SweepAllProgress =
  | { phase: "running"; index: number; total: number; runId: string }
  | { phase: "done"; swept: number; total: number };
type AmountUnit = "eth" | "usd";
type AmountContextValue = { unit: AmountUnit; toggleUnit: () => void };
type ArenaSweepPageProps = { params: { address: string } };

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const SWEEP_ARM_MS = 6000;
const SWEEP_CONFIRM_DWELL_MS = 400;
const DUST_WEI = 500_000_000_000_000n; // 0.0005 ETH — below this the page shows 0.000 and treats the run as swept
const AmountContext = createContext<AmountContextValue | null>(null);
const STATE_TONE: Partial<Record<RunState, string>> = {
  running: "border-[#00FBFF]/60 text-[#00FBFF] animate-pulse",
  finished: "border-[#00ff9c]/50 text-[#00ff9c]",
  failed: "border-[#FF5861]/50 text-[#FF5861]",
};

const RESULT_TONE: Record<SweepResultStatus, string> = {
  swept: "border-[#00ff9c]/50 text-[#00ff9c]",
  skipped_low_balance: "border-[#00FBFF]/20 text-[#00FBFF]/45",
  failed: "border-[#FF5861]/50 text-[#FF5861]",
};

function fmtStamp(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const clock = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return `${String(at.getDate()).padStart(2, "0")} ${MONTHS[at.getMonth()]} · ${clock}`;
}

function shortValue(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function resultLabel(status: SweepResultStatus) {
  return status === "skipped_low_balance" ? "SKIPPED · LOW BALANCE" : status.toUpperCase();
}

function EthAmount({ wei, className = "" }: { wei: bigint | undefined; className?: string }) {
  const amountContext = useContext(AmountContext);
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);

  if (!amountContext) throw new Error("EthAmount must be rendered inside AmountContext");

  const eth = wei === undefined ? undefined : Number(formatEther(wei));
  const label =
    eth === undefined
      ? "…"
      : amountContext.unit === "usd"
      ? nativeCurrencyPrice > 0
        ? `$${(eth * nativeCurrencyPrice).toFixed(2)}`
        : "$ —"
      : `${eth.toFixed(3)} ETH`;

  return (
    <button
      type="button"
      onClick={amountContext.toggleUnit}
      title={`Show amounts in ${amountContext.unit === "eth" ? "USD" : "ETH"}`}
      className={`cursor-pointer tabular-nums ${className}`}
    >
      {label}
    </button>
  );
}

function SweepSummary({ response }: { response: SweepResponse }) {
  return (
    <div className="border-t border-[#00FBFF]/15 px-3 py-3 text-xs tracking-wide text-[#00ff9c] sm:px-4">
      swept {response.results.filter(result => result.status === "swept").length} of {response.results.length} wallets
      to {shortValue(response.to)}
    </div>
  );
}

export default function ArenaSweepPage({ params }: ArenaSweepPageProps) {
  if (!isAddress(params.address, { strict: false })) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black font-mono text-[#00FBFF]">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[#00FBFF]/25 bg-gradient-to-r from-[#020808] to-[#001014] px-5">
          <div className="font-dotGothic text-xl tracking-wide md:text-2xl">
            BUIDLGUIDL <span className="text-[#FFBE00]">AI CTF</span> · SWEEP FUNDS
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl rounded border border-[#FF5861]/40 bg-[#FF5861]/10 px-4 py-3 text-sm text-[#FF5861]">
            <div>not a valid address</div>
            <Link
              href="/arena"
              className="mt-3 inline-block rounded border border-[#FF5861]/60 px-3 py-1 font-dotGothic text-sm tracking-widest transition hover:bg-[#FF5861] hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5861]"
            >
              ◂ BACK TO LOBBY
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <ArenaSweepPageContent urlAddress={getAddress(params.address.toLowerCase())} />;
}

function ArenaSweepPageContent({ urlAddress }: { urlAddress: EvmAddress }) {
  const { address: connectedAddress } = useAccount();
  const operator = useOperatorSession();
  const signSeed = useSeedSigner();
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("eth");
  const [pageError, setPageError] = useState<string | null>(null);
  const [sweeps, setSweeps] = useState<Record<string, SweepState>>({});
  const [runMeta, setRunMeta] = useState<Record<string, RunSweepMeta | undefined>>({});
  const [sweepAllArmed, setSweepAllArmed] = useState(false);
  const [sweepAllConfirmDisabled, setSweepAllConfirmDisabled] = useState(false);
  const [sweepAllProgress, setSweepAllProgress] = useState<SweepAllProgress | null>(null);
  const balanceRefetchers = useRef<Record<string, BalanceRefetcher>>({});
  const inFlight = useRef<Set<string>>(new Set());
  const sweepAllQueue = useRef<{ id: string; chainId: number }[]>([]);
  const sweepAllArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sweepAllConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authenticatedRef = useRef(operator.authenticated);

  authenticatedRef.current = operator.authenticated;

  const toggleAmountUnit = useCallback(() => {
    setAmountUnit(current => (current === "eth" ? "usd" : "eth"));
  }, []);
  const amountContextValue = useMemo(
    () => ({ unit: amountUnit, toggleUnit: toggleAmountUnit }),
    [amountUnit, toggleAmountUnit],
  );
  const canSweep = Boolean(
    connectedAddress && urlAddress && connectedAddress.toLowerCase() === urlAddress.toLowerCase(),
  );

  const {
    data: runs,
    error: runsError,
    isFetching: runsFetching,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ["arenaRuns"],
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => arenaClient.listRuns(undefined, signal),
  });

  useEffect(
    () => () => {
      clearTimeout(sweepAllArmTimer.current ?? undefined);
      clearTimeout(sweepAllConfirmTimer.current ?? undefined);
    },
    [],
  );

  const ownedRuns = useMemo(
    () =>
      runs?.filter(run => run.seededBy && urlAddress && run.seededBy.toLowerCase() === urlAddress.toLowerCase()) ?? [],
    [runs, urlAddress],
  );

  const sortedOwnedRuns = useMemo(
    () =>
      [...ownedRuns].sort((a, b) => {
        const rank = (run: RunListItem) => {
          const total = runMeta[run.id]?.total;
          if (total === undefined) return 1;
          return total >= DUST_WEI ? 0 : 2;
        };
        return rank(a) - rank(b);
      }),
    [ownedRuns, runMeta],
  );

  const sweepableRuns = useMemo(
    () =>
      sortedOwnedRuns.flatMap(run => {
        const meta = runMeta[run.id];
        const state = meta?.state ?? run.state;
        const hasBalance = (meta?.total ?? 0n) >= DUST_WEI;
        if (!meta || !hasBalance || (state !== "finished" && state !== "failed")) return [];
        return [{ id: run.id, chainId: meta.chainId }];
      }),
    [runMeta, sortedOwnedRuns],
  );

  const sweepingAll = sweepAllProgress?.phase === "running";
  const anyBusy = Object.values(sweeps).some(sweep => sweep.phase === "signing" || sweep.phase === "sweeping");

  const setMeta = useCallback((runId: string, meta: RunSweepMeta) => {
    setRunMeta(current => {
      const previous = current[runId];
      if (previous?.chainId === meta.chainId && previous.state === meta.state && previous.total === meta.total) {
        return current;
      }
      return { ...current, [runId]: meta };
    });
  }, []);

  const registerBalanceRefetch = useCallback((runId: string, refetch: BalanceRefetcher | null) => {
    if (refetch) balanceRefetchers.current[runId] = refetch;
    else delete balanceRefetchers.current[runId];
  }, []);

  const sweepOne = useCallback(
    async (run: { id: string; chainId: number }): Promise<SweepOutcome> => {
      if (inFlight.current.has(run.id)) return "failed";
      inFlight.current.add(run.id);
      const hadAuth = authenticatedRef.current;
      try {
        if (!hadAuth) {
          await operator.signIn();
          authenticatedRef.current = true;
        }
        setSweeps(current => ({ ...current, [run.id]: { phase: "signing" } }));
        const signature = await signSeed(run.id, run.chainId);
        setSweeps(current => ({ ...current, [run.id]: { phase: "sweeping" } }));
        const response = await arenaClient.sweepRun(run.id, { signature });
        setSweeps(current => ({ ...current, [run.id]: { phase: "done", response } }));
        await balanceRefetchers.current[run.id]?.();
        return "swept";
      } catch (cause) {
        let message: string;
        let outcome: SweepOutcome = "failed";
        if (hadAuth && cause instanceof ArenaApiError && cause.status === 401) {
          operator.invalidate();
          authenticatedRef.current = false;
          message = "operator session expired — sign in again";
          setPageError(message);
          outcome = "unauthorized";
        } else {
          message = errorMessage(cause, "Could not sweep the run");
        }
        setSweeps(current => ({ ...current, [run.id]: { phase: "error", message } }));
        return outcome;
      } finally {
        inFlight.current.delete(run.id);
      }
    },
    [operator, signSeed],
  );

  const sweepAll = useCallback(async () => {
    if (!sweepAllArmed) {
      sweepAllQueue.current = sweepableRuns;
      setSweepAllArmed(true);
      setSweepAllConfirmDisabled(true);
      setSweepAllProgress(null);
      sweepAllConfirmTimer.current = setTimeout(() => {
        setSweepAllConfirmDisabled(false);
        sweepAllConfirmTimer.current = null;
      }, SWEEP_CONFIRM_DWELL_MS);
      sweepAllArmTimer.current = setTimeout(() => {
        sweepAllQueue.current = [];
        setSweepAllArmed(false);
        setSweepAllConfirmDisabled(false);
        sweepAllArmTimer.current = null;
      }, SWEEP_ARM_MS);
      return;
    }

    clearTimeout(sweepAllArmTimer.current ?? undefined);
    clearTimeout(sweepAllConfirmTimer.current ?? undefined);
    sweepAllArmTimer.current = null;
    sweepAllConfirmTimer.current = null;
    setSweepAllArmed(false);
    setSweepAllConfirmDisabled(false);

    const queue = sweepAllQueue.current;
    sweepAllQueue.current = [];
    let swept = 0;
    for (let index = 0; index < queue.length; index += 1) {
      const run = queue[index];
      setSweepAllProgress({ phase: "running", index: index + 1, total: queue.length, runId: run.id });
      const outcome = await sweepOne(run);
      if (outcome === "swept") swept += 1;
      if (outcome === "unauthorized") {
        setSweepAllProgress({ phase: "done", swept, total: queue.length });
        return;
      }
    }
    setSweepAllProgress({ phase: "done", swept, total: queue.length });
  }, [sweepAllArmed, sweepOne, sweepableRuns]);

  const currentAllSweep = sweepAllProgress?.phase === "running" ? sweeps[sweepAllProgress.runId]?.phase : undefined;

  return (
    <AmountContext.Provider value={amountContextValue}>
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
            <div className="mb-4 truncate text-xs tracking-wide text-[#00FBFF]/40" title={urlAddress}>
              runs seeded by {urlAddress}
            </div>

            {pageError && (
              <div className="mb-4 rounded border border-[#FF5861]/40 bg-[#FF5861]/10 px-3 py-2 text-sm text-[#FF5861]">
                {pageError}
              </div>
            )}

            {runsError && !runs ? (
              <div className="rounded border border-[#FF5861]/40 bg-[#FF5861]/10 px-4 py-3 text-sm text-[#FF5861]">
                <div>Could not load the run list</div>
                <button
                  type="button"
                  onClick={() => void refetchRuns()}
                  disabled={runsFetching}
                  className="mt-3 rounded border border-[#FF5861]/60 px-3 py-1 font-dotGothic text-sm tracking-widest transition hover:bg-[#FF5861] hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5861] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {runsFetching ? "RETRYING…" : "RETRY"}
                </button>
              </div>
            ) : runs === undefined ? (
              <div className="animate-pulse font-dotGothic text-lg tracking-widest text-[#00FBFF]/60">
                ◆ LOADING RUNS…
              </div>
            ) : ownedRuns.length === 0 ? (
              <div className="text-sm tracking-wide text-[#00FBFF]/40">no runs to sweep</div>
            ) : (
              <>
                {sweepableRuns.length > 0 && !canSweep && (
                  <div className="mb-3 text-sm tracking-wide text-[#00FBFF]/40">
                    connect the wallet that seeded these runs to sweep
                  </div>
                )}

                {(sweepableRuns.length >= 2 || sweepAllProgress) && (
                  <div className="mb-5 flex min-h-16 flex-col items-end justify-center">
                    {sweepableRuns.length >= 2 && !sweepingAll && (
                      <button
                        type="button"
                        onClick={() => void sweepAll()}
                        disabled={!canSweep || sweepAllConfirmDisabled || anyBusy}
                        title={!canSweep ? "Not the operator of this run" : undefined}
                        className={`rounded border px-4 py-2 font-dotGothic text-sm tracking-widest transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5861] disabled:cursor-not-allowed disabled:opacity-40 ${
                          sweepAllArmed
                            ? "animate-pulse border-[#FF5861] bg-[#FF5861] text-black hover:bg-[#FF5861]/80"
                            : "border-[#FFBE00]/60 text-[#FFBE00] hover:bg-[#FFBE00] hover:text-black"
                        }`}
                      >
                        {sweepAllArmed ? "CONFIRM SWEEP ALL" : "SWEEP ALL RUNS"}
                      </button>
                    )}
                    {sweepableRuns.length >= 2 && !sweepingAll && sweepAllArmed && (
                      <div className="mt-2 text-xs tracking-wide text-[#00FBFF]/50">
                        signs one wallet signature per run
                      </div>
                    )}
                    {sweepAllProgress?.phase === "running" && (
                      <div className="font-dotGothic text-sm tracking-widest text-[#FFBE00]">
                        SWEEPING RUN {sweepAllProgress.index} OF {sweepAllProgress.total}
                        {currentAllSweep === "signing" ? " · SIGN IN YOUR WALLET" : ""}
                      </div>
                    )}
                    {sweepAllProgress?.phase === "done" && (
                      <div className="text-sm tracking-wide text-[#00ff9c]">
                        swept {sweepAllProgress.swept} of {sweepAllProgress.total} runs
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {sortedOwnedRuns.map(run => (
                    <SweepRunCard
                      key={run.id}
                      runItem={run}
                      sweep={sweeps[run.id]}
                      total={runMeta[run.id]?.total}
                      canSweep={canSweep}
                      sweepingAll={sweepingAll}
                      onMeta={setMeta}
                      onRegisterBalanceRefetch={registerBalanceRefetch}
                      onSweep={sweepOne}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </AmountContext.Provider>
  );
}

function SweepRunCard({
  runItem,
  sweep,
  total,
  canSweep,
  sweepingAll,
  onMeta,
  onRegisterBalanceRefetch,
  onSweep,
}: {
  runItem: RunListItem;
  sweep: SweepState | undefined;
  total: bigint | undefined;
  canSweep: boolean;
  sweepingAll: boolean;
  onMeta: (runId: string, meta: RunSweepMeta) => void;
  onRegisterBalanceRefetch: (runId: string, refetch: BalanceRefetcher | null) => void;
  onSweep: (run: { id: string; chainId: number }) => Promise<SweepOutcome>;
}) {
  const { targetNetwork } = useTargetNetwork();
  const {
    data: run,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["arenaSweepRun", runItem.id],
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => arenaClient.getRun(runItem.id, signal),
  });

  const addresses = useMemo(
    () => run?.entrants.flatMap(entrant => (entrant.address ? [entrant.address as EvmAddress] : [])) ?? [],
    [run?.entrants],
  );
  const {
    balances,
    isError: balancesError,
    refetch: refetchBalances,
  } = useAgentBalances(addresses, Boolean(run), run?.chainId);
  const balancesLoaded = addresses.length === 0 || addresses.every(address => balances[address] !== undefined);
  const currentTotal = useMemo(
    () => addresses.reduce((sum, address) => sum + (balances[address] ?? 0n), 0n),
    [addresses, balances],
  );

  useEffect(() => {
    if (run && balancesLoaded && !balancesError) {
      onMeta(runItem.id, { chainId: run.chainId, state: run.state, total: currentTotal });
    }
  }, [balancesError, balancesLoaded, currentTotal, onMeta, run, runItem.id]);

  useEffect(() => {
    if (!run) return;
    onRegisterBalanceRefetch(runItem.id, refetchBalances);
    return () => onRegisterBalanceRefetch(runItem.id, null);
  }, [onRegisterBalanceRefetch, refetchBalances, run, runItem.id]);

  const state = run?.state ?? runItem.state;
  const busy = sweep?.phase === "signing" || sweep?.phase === "sweeping";
  const inactive = state !== "finished" && state !== "failed";
  const empty = total !== undefined && total < DUST_WEI;

  return (
    <section
      className={`rounded-md border border-[#00FBFF]/20 bg-[#00090b]/60 transition-opacity ${
        empty ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#00FBFF]/15 px-3 py-3 sm:px-4">
        <span className="w-20 shrink-0 text-xs tracking-wider text-[#00FBFF]/40">#{runItem.id.slice(0, 8)}</span>
        <span
          className={`w-28 shrink-0 rounded border px-2 py-0.5 text-center text-xs font-bold tracking-widest ${
            STATE_TONE[state] ?? "border-[#00FBFF]/20 text-[#00FBFF]/45"
          }`}
        >
          {state.replaceAll("_", " ").toUpperCase()}
        </span>
        <span className="min-w-36 flex-1 tabular-nums text-sm text-[#00FBFF]/80">
          {fmtStamp(runItem.startedAt ?? runItem.createdAt)}
        </span>
        <EthAmount wei={total} className="shrink-0 text-sm tracking-wide text-[#FFBE00]" />
      </div>

      {empty ? (
        sweep?.phase === "done" ? (
          <SweepSummary response={sweep.response} />
        ) : null
      ) : !run && !error ? (
        <div className="animate-pulse px-4 py-4 text-sm tracking-wide text-[#00FBFF]/40">loading wallet balances…</div>
      ) : error && !run ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-[#FF5861]">
          <span>Could not load run details</span>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="rounded border border-[#FF5861]/60 px-3 py-1 font-dotGothic text-xs tracking-widest transition hover:bg-[#FF5861] hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5861] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isFetching ? "RETRYING…" : "RETRY"}
          </button>
        </div>
      ) : run ? (
        <>
          {balancesError && (
            <div className="rounded border border-[#FF5861]/40 bg-[#FF5861]/10 px-3 py-2 text-sm text-[#FF5861]">
              balances unavailable — retrying until the RPC connection recovers
            </div>
          )}
          <div className="divide-y divide-[#00FBFF]/10">
            {run.entrants.map(entrant => {
              const balance = entrant.address ? balances[entrant.address] : 0n;
              const result =
                sweep?.phase === "done"
                  ? sweep.response.results.find(candidate => candidate.entrantId === entrant.id) ??
                    (entrant.address
                      ? sweep.response.results.find(
                          candidate => candidate.address.toLowerCase() === entrant.address?.toLowerCase(),
                        )
                      : undefined)
                  : undefined;
              const txHref =
                result?.txHash && run.chainId === targetNetwork.id
                  ? getBlockExplorerTxLink(targetNetwork.id, result.txHash)
                  : "";

              return (
                <div
                  key={entrant.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs sm:grid-cols-[7rem_minmax(0,1fr)_8.5rem_7rem_minmax(0,10rem)] sm:px-4"
                >
                  <span className="truncate font-bold tracking-wider text-[#00FBFF]/80">{entrant.id}</span>
                  <span className="truncate text-[#00FBFF]/55" title={entrant.model}>
                    {entrant.model}
                  </span>
                  <span className="text-right sm:text-left">
                    {entrant.address ? (
                      <Address address={entrant.address} hideBlockie openLinkInNewTab size="xs" />
                    ) : (
                      <span className="text-[#00FBFF]/40">no address</span>
                    )}
                  </span>
                  <EthAmount wei={balance} className="justify-self-end text-right text-[#FFBE00]/85" />
                  {result && (
                    <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 pt-1 sm:col-span-1 sm:pt-0">
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 font-bold tracking-widest ${
                          RESULT_TONE[result.status]
                        }`}
                      >
                        {resultLabel(result.status)}
                      </span>
                      {result.txHash &&
                        (txHref ? (
                          <a
                            href={txHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={result.txHash}
                            className="text-[#00FBFF]/65 transition hover:text-[#00FBFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FBFF]"
                          >
                            {shortValue(result.txHash)}
                          </a>
                        ) : (
                          <span title={result.txHash} className="text-[#00FBFF]/65">
                            {shortValue(result.txHash)}
                          </span>
                        ))}
                      {result.error && <span className="min-w-0 break-words text-[#FF5861]">{result.error}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sweep?.phase === "error" && (
            <div className="border-t border-[#FF5861]/20 px-3 py-2 text-sm text-[#FF5861] sm:px-4">{sweep.message}</div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#00FBFF]/15 px-3 py-3 sm:px-4">
            {inactive && <span className="text-xs tracking-wide text-[#00FBFF]/40">run still active</span>}
            <button
              type="button"
              onClick={() => void onSweep({ id: run.id, chainId: run.chainId })}
              disabled={!canSweep || busy || sweepingAll || inactive || total === undefined}
              title={!canSweep ? "Not the operator of this run" : undefined}
              className="rounded border border-[#FFBE00]/60 px-4 py-1.5 font-dotGothic text-sm tracking-widest text-[#FFBE00] transition hover:bg-[#FFBE00] hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBE00] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sweep?.phase === "signing" ? "SIGNING…" : sweep?.phase === "sweeping" ? "SWEEPING…" : "SWEEP RUN"}
            </button>
          </div>

          {sweep?.phase === "done" && <SweepSummary response={sweep.response} />}
        </>
      ) : null}
    </section>
  );
}
