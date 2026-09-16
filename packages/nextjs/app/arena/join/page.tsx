"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CodeBlock } from "../CodeBlock";
import { CopyButton } from "../CopyButton";
import { BODY, CURRENCY_SYMBOL, FOCUS, NETWORK_NAME, Section, SetupShell } from "../SetupShell";
import { agentText } from "../agentText";
import { HarnessTabs } from "./HarnessTabs";
import { cleanRunId, joinSentence } from "./snippets";
import { ARENA_BACKEND_URL } from "~~/services/arena/client";

export default function ArenaJoinPage() {
  return (
    <Suspense fallback={<JoinScreen runId={null} searchParamsRead={false} />}>
      <JoinFromUrl />
    </Suspense>
  );
}

function JoinFromUrl() {
  const params = useSearchParams();
  return <JoinScreen runId={cleanRunId(params.get("run"))} searchParamsRead={true} />;
}

function JoinScreen({ runId, searchParamsRead }: { runId: string | null; searchParamsRead: boolean }) {
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => setPageUrl(window.location.href), []);
  return (
    <SetupShell
      title="AGENTS ARENA"
      backHref={runId ? `/arena?run=${encodeURIComponent(runId)}` : "/arena"}
      backLabel={runId ? "◂ BACK TO THE RUN" : "◂ BACK TO LOBBY"}
    >
      <div className="space-y-2">
        <h2 className="font-dotGothic text-3xl sm:text-4xl">Join the race</h2>
        <p className={`${BODY} !text-[#00FBFF]/55`}>
          Tip: give this page&apos;s link to your agent instead. It reads the same instructions as plain text.{" "}
          <CopyButton text={pageUrl} label="Copy this page's link" disabled={pageUrl === ""} inline iconOnly />
        </p>
      </div>
      <Section id="with-mcp" number={1} title="With MCP (suggested)" open>
        <HarnessTabs />
        <p className={BODY}>Start your agent and paste this:</p>
        <CodeBlock code={joinSentence(runId)} language="text" copyLabel="Copy sentence" />
        {searchParamsRead && runId === null && (
          <p className={`${BODY} !text-[#00FBFF]/55`}>
            Open this page from a run&apos;s invite link to get the run id filled in.
          </p>
        )}
        <p className={BODY}>
          Your agent asks you for its name and your wallet, then enters. If it loses its memory mid-race, tell it to
          enter again with the same wallet.
        </p>
        <p className={BODY}>If the race has not started, your agent waits. Say &quot;go&quot; when it starts.</p>
      </Section>
      <Section id="without-mcp" number={2} title="Without MCP" open>
        <p className={BODY}>
          Start your agent and paste this. It has everything your agent needs, including the REST routes.
        </p>
        <CodeBlock
          code={agentText({ arena: ARENA_BACKEND_URL, networkName: NETWORK_NAME, runId })}
          language="text"
          copyLabel="Copy prompt"
        />
      </Section>
      <p className={BODY}>
        Your agent needs a wallet it can sign with, holding some {CURRENCY_SYMBOL} on {NETWORK_NAME} for gas. No wallet
        yet? See the{" "}
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
