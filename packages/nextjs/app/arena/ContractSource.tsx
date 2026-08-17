"use client";

import { Fragment, useMemo, useState } from "react";
import { CHALLENGE_SOURCES, challengeContractName, challengeSourceUrl } from "~~/data/challengeSources";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";
import { contracts } from "~~/utils/scaffold-eth/contract";

const KEYWORDS = new Set([
  "abstract",
  "address",
  "assembly",
  "bool",
  "bytes",
  "bytes32",
  "calldata",
  "constructor",
  "contract",
  "else",
  "emit",
  "event",
  "external",
  "false",
  "for",
  "function",
  "if",
  "immutable",
  "import",
  "interface",
  "internal",
  "library",
  "mapping",
  "memory",
  "modifier",
  "new",
  "override",
  "payable",
  "pragma",
  "private",
  "public",
  "pure",
  "require",
  "return",
  "returns",
  "revert",
  "solidity",
  "storage",
  "string",
  "struct",
  "this",
  "true",
  "uint",
  "uint8",
  "uint16",
  "uint256",
  "using",
  "view",
  "virtual",
  "while",
]);

// Enough colour to read a challenge on stream — comments dim, strings warm,
// keywords cyan. Not a parser: it never needs to survive invalid Solidity.
const TOKENS = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("[^"\n]*"|'[^'\n]*')|\b([A-Za-z_$][\w$]*)\b/g;

function highlight(line: string) {
  const out: { text: string; cls: string }[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKENS)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: line.slice(last, at), cls: "" });
    const [text, comment, str, word] = m;
    if (comment) out.push({ text, cls: "text-[#00FBFF]/35 italic" });
    else if (str) out.push({ text, cls: "text-[#FFBE00]/85" });
    else if (word && KEYWORDS.has(word)) out.push({ text, cls: "text-[#00FBFF] font-bold" });
    else out.push({ text, cls: "" });
    last = at + text.length;
  }
  if (last < line.length) out.push({ text: line.slice(last), cls: "" });
  return out;
}

export function ContractSource({ challengeId, accent }: { challengeId: number; accent: string }) {
  const [open, setOpen] = useState(false);
  const { targetNetwork } = useTargetNetwork();
  const name = challengeContractName(challengeId);
  const source = CHALLENGE_SOURCES[challengeId] ?? "";
  const lines = useMemo(() => source.replace(/\s+$/, "").split("\n"), [source]);

  const deployed = contracts?.[targetNetwork.id] as Record<string, { address?: string }> | undefined;
  const address = deployed?.[name]?.address;

  return (
    <div className="rounded border border-[#00FBFF]/15 bg-[#00090b]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#00FBFF]/10">
        <span className="tracking-widest text-sm text-[#00FBFF]/70">CONTRACT</span>
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
                  {highlight(line).map((part, j) => (
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
