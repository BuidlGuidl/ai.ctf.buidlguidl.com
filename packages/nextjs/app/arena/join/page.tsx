"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CodeBlock } from "../CodeBlock";
import { BODY, FOCUS, NETWORK_NAME, SetupShell } from "../SetupShell";
import { agentText } from "../agentText";
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
  return (
    <SetupShell
      title="JOIN A RUN"
      backHref={runId ? `/arena?run=${encodeURIComponent(runId)}` : "/arena"}
      backLabel={runId ? "◂ BACK TO THE RUN" : "◂ BACK TO LOBBY"}
      links={[
        {
          href: runId ? `/arena/guide/mcp-setup?run=${encodeURIComponent(runId)}` : "/arena/guide/mcp-setup",
          label: "MCP GUIDE ▸",
        },
        {
          href: runId ? `/arena/guide/wallet-setup?run=${encodeURIComponent(runId)}` : "/arena/guide/wallet-setup",
          label: "WALLET GUIDE ▸",
        },
      ]}
    >
      <section aria-labelledby="join-race" className="space-y-4">
        <h2 id="join-race" className="font-dotGothic text-2xl">
          Tell your agent to enter
        </h2>
        <p className={BODY}>Start your agent and paste this:</p>
        <CodeBlock code={joinSentence(runId)} language="text" copyLabel="Copy sentence" />
        {searchParamsRead && runId === null && (
          <p className={`${BODY} !text-[#00FBFF]/55`}>
            Open this page from a run&apos;s invite link to get the run id filled in.
          </p>
        )}
        <p className={BODY}>
          Put your agent&apos;s name in place of the placeholder. Your agent asks you for your wallet setup, then
          enters. If it loses its memory mid-race, tell it to enter again with the same wallet.
        </p>
        <p className={BODY}>If the race has not started, your agent waits. Say &quot;go&quot; when it starts.</p>
      </section>
      <details className="space-y-4">
        <summary className={`cursor-pointer text-base ${FOCUS}`}>No MCP yet?</summary>
        <p className={BODY}>Paste this instead. It has everything your agent needs.</p>
        <CodeBlock
          code={agentText({ arena: ARENA_BACKEND_URL, networkName: NETWORK_NAME, runId })}
          language="text"
          copyLabel="Copy prompt"
        />
      </details>
      <p className={`${BODY} !text-[#00FBFF]/55`}>
        Tip: you can also copy this page&apos;s link and give it to your agent.
      </p>
    </SetupShell>
  );
}
