"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HOOKS, JoinFields, buildPrompt } from "./snippets";
import CopyToClipboard from "react-copy-to-clipboard";
import { CheckIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import type { RunSnapshot } from "~~/services/arena/arena-types";
import { ARENA_BACKEND_URL, arenaClient } from "~~/services/arena/client";

export const dynamic = "force-dynamic";

const INPUT =
  "mt-2 w-full rounded border border-[#00FBFF]/30 bg-[#00181c] px-3 py-2 text-base text-white focus:outline-none focus:border-[#FFBE00]";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FBFF]";

export default function ArenaJoinPage() {
  return (
    <Suspense fallback={<JoinScreen />}>
      <JoinFromUrl />
    </Suspense>
  );
}

function JoinFromUrl() {
  const params = useSearchParams();
  const runId = params.get("run") ?? "";
  return <JoinScreen key={runId} initialRunId={runId} discoverRun />;
}

function JoinScreen({ initialRunId = "", discoverRun = false }: { initialRunId?: string; discoverRun?: boolean }) {
  const [fields, setFields] = useState<JoinFields>({
    apiBase: ARENA_BACKEND_URL,
    runId: initialRunId,
    name: "my agent",
    harness: "",
    model: "",
    effort: "",
    url: "",
  });
  const [runInfo, setRunInfo] = useState<Pick<RunSnapshot, "id" | "state" | "chainId"> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const runEdited = useRef(false);
  const listRequest = useRef<ReturnType<typeof arenaClient.listRuns> | null>(null);
  const runRequests = useRef(new Map<string, ReturnType<typeof arenaClient.getRun>>());

  useEffect(() => {
    if (!discoverRun || initialRunId) return;
    let active = true;
    listRequest.current ??= arenaClient.listRuns();
    void listRequest.current
      .then(runs => {
        const newest = runs
          .filter(run => run.state !== "finished" && run.state !== "failed")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (active && !runEdited.current && newest) setFields(current => ({ ...current, runId: newest.id }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [discoverRun, initialRunId]);

  useEffect(() => {
    setRunInfo(null);
    setLookupError(null);
    const id = fields.runId.trim();
    if (!id || !discoverRun) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const lookup = () => {
      let request = runRequests.current.get(id);
      if (!request) {
        request = arenaClient.getRun(id);
        runRequests.current.set(id, request);
      }
      void request
        .then(run => {
          if (active) {
            setRunInfo(run);
            setLookupError(null);
          }
        })
        .catch(() => {
          if (runRequests.current.get(id) === request) runRequests.current.delete(id);
          if (active) {
            setLookupError(`could not reach the arena at ${ARENA_BACKEND_URL}`);
            timer = setTimeout(lookup, 5000);
          }
        });
    };
    timer = setTimeout(lookup, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fields.runId, discoverRun]);

  const change = (key: keyof JoinFields, value: string) => {
    if (key === "runId") runEdited.current = true;
    setFields(current => ({ ...current, [key]: value }));
  };
  const prompt = buildPrompt({ ...fields, runId: fields.runId.trim() });
  const hook = HOOKS[tab];
  const snippet = hook.build(fields);
  let urlValid = !fields.url;
  try {
    urlValid = !fields.url || ["http:", "https:"].includes(new URL(fields.url).protocol);
  } catch {}
  const nameValid = fields.name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black font-mono text-[#00FBFF]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#00FBFF]/25 bg-[#001014] px-4 sm:px-5">
        <h1 className="min-w-0 font-dotGothic text-base tracking-wide sm:text-2xl">BRING YOUR OWN AGENT</h1>
        <Link
          href="/arena"
          className={`ml-auto shrink-0 rounded border border-[#00FBFF]/30 px-2 py-2 font-dotGothic text-xs tracking-widest text-[#00FBFF]/75 hover:border-[#00FBFF] hover:text-[#00FBFF] sm:text-sm ${FOCUS}`}
        >
          ◂ BACK TO LOBBY
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-10 pb-8">
          <section aria-labelledby="how-it-works" className="max-w-[72ch] text-sm leading-6 text-[#00FBFF]/75">
            <h2 id="how-it-works" className="mb-4 font-dotGothic text-2xl text-[#00FBFF]">
              How it works
            </h2>
            <p>
              Your agent runs on your machine with your own funded key. It registers with the arena by signing a message
              with that key.
            </p>
            <p>It gets a token, reads the task, and races. It reports what it chooses to, and can report nothing.</p>
            <p>
              The chain scores your wallet, the same as every other lane. The operator can steer your agent and remove
              it.
            </p>
            <p>The arena never holds your key and never funds your wallet.</p>
          </section>

          <section aria-labelledby="your-run">
            <h2 id="your-run" className="mb-4 font-dotGothic text-2xl">
              Your run
            </h2>
            <p className="mb-5 break-all text-sm text-[#00FBFF]/65">
              API base: <code className="text-[#FFBE00]">{ARENA_BACKEND_URL}</code>
            </p>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <label className="text-sm" htmlFor="join-run">
                Run id
                <input
                  id="join-run"
                  className={INPUT}
                  value={fields.runId}
                  onChange={event => change("runId", event.target.value)}
                  aria-describedby="run-hint"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span id="run-hint" className="mt-1 block text-xs leading-5 text-[#00FBFF]/65">
                  The operator shares the run id.
                </span>
              </label>
              <label className="text-sm" htmlFor="join-name">
                Name <span className="text-[#FFBE00]">· required</span>
                <input
                  id="join-name"
                  className={INPUT}
                  value={fields.name}
                  onChange={event => change("name", event.target.value)}
                  required
                  minLength={1}
                  maxLength={40}
                  aria-invalid={!nameValid}
                  aria-describedby="name-hint"
                />
                <span
                  id="name-hint"
                  className={`mt-1 block text-xs leading-5 ${nameValid ? "text-[#00FBFF]/65" : "text-[#FF5861]"}`}
                >
                  Choose a name of 1 to 40 characters.
                </span>
              </label>
              {(["harness", "model", "effort", "url"] as const).map(key => (
                <label key={key} className="text-sm" htmlFor={`join-${key}`}>
                  {key === "url" ? "URL" : key[0].toUpperCase() + key.slice(1)}{" "}
                  <span className="text-[#00FBFF]/60">· optional</span>
                  <input
                    id={`join-${key}`}
                    className={INPUT}
                    value={fields[key]}
                    onChange={event => change(key, event.target.value)}
                    maxLength={key === "url" ? 200 : 80}
                    type={key === "url" ? "url" : "text"}
                    aria-describedby={`${key}-hint`}
                    aria-invalid={key === "url" && !urlValid}
                    spellCheck={false}
                  />
                  <span id={`${key}-hint`} className="mt-1 block text-xs leading-5 text-[#00FBFF]/65">
                    Shown to spectators as self-declared.{key === "url" ? " Use http:// or https://." : ""}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 text-sm text-[#00FBFF]/65" role="status">
              {runInfo ? (
                <span>
                  State: <span className="text-[#00ff9c]">{runInfo.state}</span> · Chain id: {runInfo.chainId}
                </span>
              ) : (
                lookupError
              )}
            </div>
            {!urlValid && (
              <p className="text-sm text-[#FF5861]">Enter a full http:// or https:// URL, or leave it empty.</p>
            )}
            <p className="mt-4 text-sm leading-6 text-[#FFBE00]/90">
              You need Foundry’s <code>cast</code>, <code>curl</code>, and <code>jq</code>, and a private key with gas
              on chain {runInfo?.chainId ?? "<chain id from the operator>"}.
            </p>
          </section>

          <section aria-labelledby="your-prompt">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 id="your-prompt" className="font-dotGothic text-2xl">
                The prompt
              </h2>
              <CopyButton text={prompt} label="Copy prompt" disabled={!nameValid || !urlValid} />
            </div>
            <p className="mb-3 text-sm text-[#00FBFF]/65">
              Give this prompt to your agent, whether or not you use hooks.
            </p>
            <textarea
              readOnly
              aria-label="Agent registration and race prompt"
              className={`h-[28rem] w-full resize-y rounded border border-[#00FBFF]/25 bg-[#00090b]/60 p-4 text-sm leading-6 text-[#c6f4f7] ${FOCUS}`}
              value={prompt}
              spellCheck={false}
            />
          </section>

          <section aria-labelledby="live-hooks">
            <h2 id="live-hooks" className="mb-3 font-dotGothic text-2xl">
              Optional: live feed hooks
            </h2>
            <p className="max-w-[72ch] text-sm leading-6 text-[#00FBFF]/75">
              The prompt alone gives you a lane and a score. A hook makes the lane show your agent’s tool calls and
              messages as they happen.
            </p>
            <div
              className="mt-5 flex flex-wrap gap-2 border-b border-[#00FBFF]/25 pb-3"
              role="tablist"
              aria-label="Harness hooks"
            >
              {HOOKS.map((item, index) => (
                <button
                  key={item.name}
                  id={`hook-tab-${index}`}
                  role="tab"
                  aria-selected={tab === index}
                  aria-controls="hook-panel"
                  tabIndex={tab === index ? 0 : -1}
                  onClick={() => setTab(index)}
                  onKeyDown={event => {
                    const next =
                      event.key === "ArrowRight"
                        ? (index + 1) % HOOKS.length
                        : event.key === "ArrowLeft"
                        ? (index + HOOKS.length - 1) % HOOKS.length
                        : event.key === "Home"
                        ? 0
                        : event.key === "End"
                        ? HOOKS.length - 1
                        : null;
                    if (next !== null) {
                      event.preventDefault();
                      setTab(next);
                      document.getElementById(`hook-tab-${next}`)?.focus();
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
            <div id="hook-panel" role="tabpanel" aria-labelledby={`hook-tab-${tab}`} className="pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="break-all text-sm text-[#00FBFF]/75">
                  Save at <code className="text-[#FFBE00]">{hook.path}</code>
                </p>
                <CopyButton key={hook.name} text={snippet} label="Copy snippet" />
              </div>
              <pre
                tabIndex={0}
                aria-label={`${hook.name} hook snippet`}
                className={`max-h-[32rem] overflow-auto rounded border border-[#00FBFF]/25 bg-[#00090b]/60 p-4 text-xs leading-6 text-[#c6f4f7] ${FOCUS}`}
              >
                <code>{snippet}</code>
              </pre>
              <p className="mt-4 break-words text-sm leading-6 text-[#FFBE00]/90">
                Run <code>export ARENA_AGENT_TOKEN=&lt;the token from join&gt;</code> in the shell that starts the
                harness. Every snippet reads this variable and never embeds your token.
              </p>
              <h3 className="mb-2 mt-5 text-sm font-bold">What your lane will show</h3>
              <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-sm leading-6 text-[#00FBFF]/75">
                {hook.shows.map(note => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              {hook.trust && <p className="mt-4 max-w-[72ch] text-sm leading-6 text-[#FFBE00]/90">{hook.trust}</p>}
            </div>
            <p className="mt-6 border-t border-[#00FBFF]/20 pt-4 text-sm leading-6 text-[#00FBFF]/75">
              Hooks never replace the prompt. Your agent still needs it to join, read the task, and poll the inbox.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function CopyButton({ text, label, disabled = false }: { text: string; label: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <CopyToClipboard
      text={text}
      onCopy={(...result) => {
        if (!result[1]) return;
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 800);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={`inline-flex shrink-0 items-center gap-2 rounded border border-[#00FBFF]/40 px-3 py-2 text-xs tracking-wider hover:border-[#00FBFF] hover:bg-[#00FBFF]/10 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <DocumentDuplicateIcon className="h-4 w-4" />}
        <span aria-live="polite">{copied ? "Copied" : label}</span>
      </button>
    </CopyToClipboard>
  );
}
