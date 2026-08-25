"use client";

import { Fragment, useMemo, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-solidity";
import { CHALLENGE_SOURCES, challengeContractName, challengeSourceUrl } from "~~/data/challengeSources";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";
import { contracts } from "~~/utils/scaffold-eth/contract";

// Enough colour to read a challenge on stream — comments dim, strings warm,
// keywords cyan.
const TOKEN_CLASSES: Record<string, string> = {
  comment: "text-[#00FBFF]/35 italic",
  string: "text-[#FFBE00]/85",
  number: "text-[#FFBE00]/85",
  keyword: "text-[#00FBFF] font-bold",
  builtin: "text-[#00FBFF] font-bold",
  boolean: "text-[#00FBFF] font-bold",
};

type TokenRun = { text: string; cls: string };

function flattenTokens(token: Prism.TokenStream, cls = ""): TokenRun[] {
  if (typeof token === "string") return [{ text: token, cls }];
  if (Array.isArray(token)) return token.flatMap(part => flattenTokens(part, cls));
  return flattenTokens(token.content, TOKEN_CLASSES[token.type] ?? "");
}

function splitTokenRuns(runs: TokenRun[]) {
  const lines: TokenRun[][] = [[]];

  for (const run of runs) {
    run.text.split("\n").forEach((text, i) => {
      if (i > 0) lines.push([]);
      if (text) lines[lines.length - 1].push({ text, cls: run.cls });
    });
  }

  return lines;
}

export function ContractSource({ challengeId, accent }: { challengeId: number; accent: string }) {
  const [open, setOpen] = useState(false);
  const { targetNetwork } = useTargetNetwork();
  const name = challengeContractName(challengeId);
  const source = CHALLENGE_SOURCES[challengeId] ?? "";
  const lines = useMemo(
    () => splitTokenRuns(flattenTokens(Prism.tokenize(source.replace(/\s+$/, ""), Prism.languages.solidity))),
    [source],
  );

  const deployed = contracts?.[targetNetwork.id] as Record<string, { address?: string }> | undefined;
  const address = deployed?.[name]?.address;

  return (
    <div className="rounded border border-[#00FBFF]/15 bg-[#00090b]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#00FBFF]/10">
        <span className="font-bold text-white">{name}.sol</span>
        <button
          onClick={() => setOpen(o => !o)}
          className="rounded border border-[#00FBFF]/25 px-2 py-0.5 text-sm text-[#00FBFF]/70 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
        >
          {open ? "HIDE CODE" : "SHOW CODE"}
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {address && (
            <a
              href={getBlockExplorerAddressLink(targetNetwork, address)}
              target="_blank"
              rel="noopener noreferrer"
              title={address}
              className="rounded border border-[#00FBFF]/25 px-2 py-0.5 text-[#00FBFF]/80 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
            >
              {address.slice(0, 6)}…{address.slice(-4)} ↗
            </a>
          )}
          <a
            href={challengeSourceUrl(challengeId)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-[#00FBFF]/25 px-2 py-0.5 text-[#00FBFF]/80 transition hover:border-[#00FBFF] hover:text-[#00FBFF]"
          >
            GITHUB ↗
          </a>
        </div>
      </div>

      {open && (
        <pre
          className="max-h-[340px] overflow-auto console-scroll px-3 py-2 text-sm leading-relaxed"
          style={{ borderTop: `1px solid ${accent}22` }}
        >
          <code className="grid grid-cols-[auto_1fr] gap-x-3">
            {lines.map((line, i) => (
              <Fragment key={i}>
                <span className="select-none text-right tabular-nums text-[#00FBFF]/25">{i + 1}</span>
                <span className="whitespace-pre text-[#9fe7ea]">
                  {line.map((part, j) => (
                    <span key={j} className={part.cls}>
                      {part.text}
                    </span>
                  ))}
                </span>
              </Fragment>
            ))}
          </code>
        </pre>
      )}
    </div>
  );
}
