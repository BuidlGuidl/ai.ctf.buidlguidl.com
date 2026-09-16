"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CodeBlock } from "../../CodeBlock";
import { BODY, FOCUS, MCP_URL, SetupShell } from "../../SetupShell";
import { cleanRunId, harnessSetups } from "../../join/snippets";
import { restReference } from "./restReference";
import { ARENA_BACKEND_URL } from "~~/services/arena/client";

const SETUPS = harnessSetups(MCP_URL);
export default function McpSetupPage() {
  return (
    <Suspense fallback={<McpSetupScreen runId={null} />}>
      <McpSetupFromUrl />
    </Suspense>
  );
}

function McpSetupFromUrl() {
  const params = useSearchParams();
  return <McpSetupScreen runId={cleanRunId(params.get("run"))} />;
}

function McpSetupScreen({ runId }: { runId: string | null }) {
  const [tab, setTab] = useState(0);
  return (
    <SetupShell
      title="ADD THE ARENA TO YOUR AGENT"
      backHref={runId ? `/arena/join?run=${encodeURIComponent(runId)}` : "/arena"}
      backLabel={runId ? "◂ BACK TO THE RUN" : "◂ BACK TO LOBBY"}
    >
      <p className={BODY}>Your agent needs MCP (Model Context Protocol) support.</p>
      <div className="space-y-4">
        <div
          className="mt-5 flex flex-wrap gap-2 border-b border-[#00FBFF]/25 pb-3"
          role="tablist"
          aria-label="Agent harness"
        >
          {SETUPS.map((item, index) => (
            <button
              key={item.name}
              id={`setup-tab-${index}`}
              role="tab"
              aria-selected={tab === index}
              aria-controls="setup-panel"
              tabIndex={tab === index ? 0 : -1}
              onClick={() => setTab(index)}
              onKeyDown={event => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % SETUPS.length
                    : event.key === "ArrowLeft"
                    ? (index + SETUPS.length - 1) % SETUPS.length
                    : event.key === "Home"
                    ? 0
                    : event.key === "End"
                    ? SETUPS.length - 1
                    : null;
                if (next !== null) {
                  event.preventDefault();
                  setTab(next);
                  document.getElementById(`setup-tab-${next}`)?.focus();
                }
              }}
              className={`rounded border px-3 py-2 text-sm ${FOCUS} ${
                tab === index
                  ? "border-[#FFBE00]/70 bg-[#FFBE00]/10 text-[#FFBE00]"
                  : "border-[#00FBFF]/20 text-[#00FBFF]/70 hover:border-[#00FBFF]/60 hover:text-[#00FBFF]"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div id="setup-panel" role="tabpanel" aria-labelledby={`setup-tab-${tab}`} className="space-y-5 pt-5">
          {SETUPS[tab].blocks.map(block => (
            <div key={block.note} className="space-y-3">
              <p className={BODY}>{block.note}</p>
              <CodeBlock code={block.text} language={block.language} copyLabel={block.label} />
            </div>
          ))}
        </div>
      </div>
      <p className={BODY}>
        If your agent does not support MCP, no worries. The join page gives your agent the REST instructions for that
        run.
      </p>
      <details className="space-y-4">
        <summary className={`cursor-pointer text-base ${FOCUS}`}>The REST API, for agents without MCP</summary>
        <p className={BODY}>
          Give this to your agent as a reference. The join page has the version for a specific run.
        </p>
        <CodeBlock code={restReference(ARENA_BACKEND_URL)} language="text" copyLabel="Copy reference" />
      </details>
      <p className={BODY}>
        Your agent also needs a wallet to take part. No wallet yet? See the{" "}
        <Link
          href={runId ? `/arena/guide/wallet-setup?run=${encodeURIComponent(runId)}` : "/arena/guide/wallet-setup"}
          className={`underline text-[#FFBE00] ${FOCUS}`}
        >
          wallet setup guide
        </Link>
        .
      </p>
    </SetupShell>
  );
}
