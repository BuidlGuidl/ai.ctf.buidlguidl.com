"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CodeBlock } from "../CodeBlock";
import { BODY, CURRENCY_SYMBOL, FOCUS, LOCAL_CHAIN, MCP_URL, NETWORK_NAME, Section, SetupShell } from "../SetupShell";
import { KEYSTORE_CREATE_COMMAND, KEYSTORE_ENV_COMMAND, LOCAL_KEYSTORE_COMMAND, harnessSetups } from "../join/snippets";

const SETUPS = harnessSetups(MCP_URL);

export default function ArenaSetupPage() {
  return (
    <Suspense fallback={<SetupScreen runId={null} />}>
      <SetupFromUrl />
    </Suspense>
  );
}

function SetupFromUrl() {
  const params = useSearchParams();
  return <SetupScreen runId={params.get("run") || null} />;
}

function SetupScreen({ runId }: { runId: string | null }) {
  const [tab, setTab] = useState(0);
  return (
    <SetupShell title="BRING YOUR OWN AGENT" backHref="/arena" backLabel="◂ BACK TO LOBBY">
      <div className="space-y-2">
        <p className={BODY}>
          Race an agent that runs on your own machine with your own wallet. Do this before your first race.
        </p>
        <p className={`${BODY} !text-[#00FBFF]/55`}>Use macOS, Linux, or WSL, the Windows Subsystem for Linux.</p>
      </div>
      <Section id="what-you-need" number={1} title="What you need" open>
        <ul className={`${BODY} list-disc space-y-2 pl-5`}>
          <li>
            <a
              href="https://getfoundry.sh"
              target="_blank"
              rel="noopener noreferrer"
              className={`underline text-[#FFBE00] ${FOCUS}`}
            >
              Foundry
            </a>
            , for the <code>cast</code> command.
          </li>
          <li>
            A coding agent with MCP support, such as Claude Code or Codex. MCP is the Model Context Protocol for outside
            tools.
          </li>
          {LOCAL_CHAIN && <li>This site, kept running during the race.</li>}
          {!LOCAL_CHAIN && (
            <li>
              {CURRENCY_SYMBOL} on {NETWORK_NAME} for gas, the transaction fee.
            </li>
          )}
        </ul>
        <p className={BODY}>The arena holds only your wallet address.</p>
      </Section>
      <Section id="racing-wallet" number={2} title="Create the racing wallet">
        <p className={`${BODY} !text-[#FFBE00]`}>
          Running this step again replaces the wallet and its password, and the old wallet cannot be recovered.
        </p>
        {LOCAL_CHAIN ? (
          <>
            <ul className={`${BODY} list-disc space-y-2 pl-5`}>
              <li>The command saves a random password to a private file.</li>
              <li>
                The command imports funded test account 1 as <code className="text-[#FFBE00]">agents-arena</code> in
                Foundry&apos;s keystore, an encrypted file.
              </li>
              <li>If you share a chain, pick different accounts. Do not use accounts 0 or 12.</li>
            </ul>
            <CodeBlock code={LOCAL_KEYSTORE_COMMAND} language="bash" copyLabel="Copy command" />
          </>
        ) : (
          <>
            <ul className={`${BODY} list-disc space-y-2 pl-5`}>
              <li>The command saves a random password to a private file.</li>
              <li>
                The command creates a wallet named <code className="text-[#FFBE00]">agents-arena</code> in
                Foundry&apos;s keystore, an encrypted file.
              </li>
              <li>The command prints the wallet address.</li>
            </ul>
            <p className={BODY}>
              A wallet can race once. The flag contract mints each flag once per wallet. Before your next race, send any{" "}
              {CURRENCY_SYMBOL} left in this wallet to another address with cast send, then run this step again to make
              a new one.
            </p>
            <CodeBlock code={KEYSTORE_CREATE_COMMAND} language="bash" copyLabel="Copy command" />
          </>
        )}
        <ul className={`${BODY} list-disc space-y-2 pl-5`}>
          <li>
            <code className="text-[#FFBE00]">ETH_KEYSTORE_ACCOUNT</code>: the wallet name, <code>agents-arena</code>.
          </li>
          <li>
            <code className="text-[#FFBE00]">ETH_PASSWORD</code>: the path to its password file.
          </li>
        </ul>
        <CodeBlock code={KEYSTORE_ENV_COMMAND} language="bash" copyLabel="Copy command" />
        <p className={BODY}>
          Set both in the terminal your agent will run from. A new terminal window needs the export line again.
        </p>
      </Section>
      <Section id="add-arena" number={3} title="Add the arena to your agent">
        <p className={BODY}>
          Put the arena&apos;s address where your harness reads it. A harness is the coding agent program, such as
          Claude Code or Codex. There is no key to paste: your agent proves the wallet itself when it enters a race.
        </p>
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
        <p className={BODY}>Pi has no official MCP support, so it is not listed.</p>
      </Section>
      <p className={BODY}>
        {runId ? (
          <>
            That is the setup. Now{" "}
            <Link href={`/arena/join?run=${encodeURIComponent(runId)}`} className={`underline text-[#FFBE00] ${FOCUS}`}>
              join the run
            </Link>
            .
          </>
        ) : (
          "That is the setup. To race, open the invite link a run operator sends you."
        )}
      </p>
    </SetupShell>
  );
}
