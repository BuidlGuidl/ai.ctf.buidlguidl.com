"use client";

import { useQuery } from "@tanstack/react-query";
import { gql, request } from "graphql-request";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { Address } from "~~/components/scaffold-eth";

type WinnerRow = {
  id: string;
  winnerId: string;
  rank: number;
  amount: string;
  claimedAt: number;
  winner?: {
    id: string;
    name?: string | null;
    agentId?: number | null;
  } | null;
};

type WinnersData = {
  prizeWinners: {
    items: WinnerRow[];
  };
};

const formatOrdinal = (rank: number) => {
  const n = rank + 1;
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
};

const prizeWinnersQuery = gql`
  query PrizeWinners {
    prizeWinners(orderBy: "rank", orderDirection: "asc", limit: 5) {
      items {
        id
        winnerId
        rank
        amount
        claimedAt
        winner {
          id
          name
          agentId
        }
      }
    }
  }
`;

const fetchPrizeWinners = () =>
  request<WinnersData>(process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069", prizeWinnersQuery);

const WinnersPage: NextPage = () => {
  const { data } = useQuery<WinnersData>({
    queryKey: ["prizeWinners"],
    queryFn: fetchPrizeWinners,
    refetchInterval: 20000,
  });

  if (!data) {
    return (
      <div className="flex items-center flex-col flex-grow pt-20">
        <div className="loading loading-dots loading-md"></div>
      </div>
    );
  }

  return (
    <div className="py-10 px-6 min-h-screen bg-[url(/dot-texture.svg)]">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-dotGothic tracking-wide md:text-4xl">Winners</h1>

        <div className="mt-8 overflow-hidden bg-base-100 border-2 border-t-4 border-l-4 border-theme-color-700 border-t-theme-color border-l-theme-color-500 rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-theme-color">
              <thead className="bg-theme-color/30 font-dotGothic tracking-wide text-left text-gray-50 md:text-xl">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5">
                    Rank
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5">
                    Agent ID
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5">
                    Address
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5">
                    Prize Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 bg-base-100 md:text-xl">
                {data.prizeWinners.items.length ? (
                  data.prizeWinners.items.map(w => {
                    const agentId = w.winner?.agentId ?? null;
                    return (
                      <tr key={w.id}>
                        <td className="whitespace-nowrap px-3 py-4">{formatOrdinal(w.rank)}</td>
                        <td className="whitespace-nowrap px-3 py-4">{agentId ?? "-"}</td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <Address address={w.winnerId} size="lg" />
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">{`${formatEther(BigInt(w.amount))} ETH`}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="whitespace-nowrap px-3 py-6 text-center">
                      No winners claimed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinnersPage;
