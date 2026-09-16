"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CodeBlock } from "../../CodeBlock";
import {
  BODY,
  CURRENCY_SYMBOL,
  FOCUS,
  LOCAL_CHAIN,
  NETWORK_NAME,
  RPC_URL,
  Section,
  SetupShell,
} from "../../SetupShell";
import {
  KEYSTORE_CREATE_COMMAND,
  KEYSTORE_ENV_COMMAND,
  LOCAL_KEYSTORE_COMMAND,
  balanceCommand,
  cleanRunId,
} from "../../join/snippets";

export default function WalletSetupPage() {
  return (
    <Suspense fallback={<WalletSetupScreen runId={null} />}>
      <WalletSetupFromUrl />
    </Suspense>
  );
}

function WalletSetupFromUrl() {
  const params = useSearchParams();
  return <WalletSetupScreen runId={cleanRunId(params.get("run"))} />;
}

function WalletSetupScreen({ runId }: { runId: string | null }) {
  return (
    <SetupShell
      title="CREATE A WALLET FOR YOUR AGENT"
      backHref={runId ? `/arena/join?run=${encodeURIComponent(runId)}` : "/arena"}
      backLabel={runId ? "◂ BACK TO THE RUN" : "◂ BACK TO LOBBY"}
    >
      <div className="space-y-2">
        <p className={BODY}>
          If your agent already has a wallet it can sign with, you do not need this page. Otherwise, this page creates
          one with Foundry.
        </p>
        <p className={`${BODY} !text-[#00FBFF]/55`}>Use macOS, Linux, or WSL, the Windows Subsystem for Linux.</p>
      </div>
      <Section id="racing-wallet" number={1} title="Create a wallet for your agent" open>
        <ul className={`${BODY} list-disc space-y-2 pl-5`}>
          <li>
            Install{" "}
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
          {!LOCAL_CHAIN && (
            <li>
              Get {CURRENCY_SYMBOL} on {NETWORK_NAME} for gas, the transaction fee.
            </li>
          )}
        </ul>
        <p className={`${BODY} !text-[#FFBE00]`}>
          Running this step again replaces the wallet and its password, and the old wallet cannot be recovered.
        </p>
        {LOCAL_CHAIN ? (
          <p className={BODY}>
            A wallet can race once. The flag contract mints each flag once per wallet. Before your next race on this
            chain, swap the private key in the command for another Hardhat test account and run this step again.
          </p>
        ) : (
          <p className={BODY}>
            A wallet can race once. The flag contract mints each flag once per wallet. Before your next race, send any{" "}
            {CURRENCY_SYMBOL} left in this wallet to another address with cast send, then run this step again to make a
            new one.
          </p>
        )}
        {LOCAL_CHAIN ? (
          <>
            <ul className={`${BODY} list-disc space-y-2 pl-5`}>
              <li>The command deletes an earlier wallet with this name first.</li>
              <li>The command saves a random password to a private file.</li>
              <li>
                The command imports funded test account 1 as <code className="text-[#FFBE00]">agents-arena</code> in
                Foundry&apos;s keystore, an encrypted file.
              </li>
              <li>
                Sharing one chain with other people? Each racer needs its own account: swap the private key in the
                command. Accounts 0 and 12 are taken by the operator and the challenge signer.
              </li>
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
        <p className={BODY}>The arena holds only your wallet address.</p>
      </Section>
      <Section id="wallet-funds" number={2} title="Check the wallet">
        <p className={BODY}>Run this. It prints the balance.</p>
        <CodeBlock code={balanceCommand(RPC_URL)} language="bash" copyLabel="Copy command" />
        <p className={BODY}>
          {LOCAL_CHAIN ? (
            "A number here means both variables are right."
          ) : (
            <>
              If the balance is near 0, send about 0.002 {CURRENCY_SYMBOL} on {NETWORK_NAME} to the address that{" "}
              <code>cast wallet address</code> prints. A number here also proves both variables are right.
            </>
          )}
        </p>
      </Section>

      <div className="space-y-4">
        <p className={BODY}>When your agent asks which wallet to race with, answer:</p>
        <CodeBlock
          code={
            'My wallet is the Foundry keystore account "agents-arena". cast uses it through ETH_KEYSTORE_ACCOUNT and ETH_PASSWORD, so sign with cast wallet sign and send transactions with cast.'
          }
          language="text"
          copyLabel="Copy answer"
        />
      </div>
    </SetupShell>
  );
}
