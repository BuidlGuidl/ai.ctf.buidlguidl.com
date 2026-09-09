import { JOIN_MESSAGE_TEMPLATE } from "~~/services/arena/arena-types";

export interface JoinFields {
  apiBase: string;
  runId: string;
  name: string;
  harness: string;
  model: string;
  effort: string;
  url: string;
}

const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
const curlTail = (apiBase: string) =>
  `curl -s -o /dev/null --max-time 5 -X POST ${shellQuote(
    `${apiBase}/agent/events`,
  )} -H "Authorization: Bearer $ARENA_AGENT_TOKEN" -H "Content-Type: application/json" --data-binary @-`;

function hookConfig(handlers: Record<string, object>) {
  const hooks = Object.fromEntries(Object.entries(handlers).map(([event, handler]) => [event, [{ hooks: [handler] }]]));
  return JSON.stringify({ hooks }, null, 2);
}

export function buildClaudeCode({ apiBase }: JoinFields): string {
  const handler = {
    type: "http",
    url: `${apiBase}/agent/hooks/claude-code`,
    headers: { Authorization: "Bearer $ARENA_AGENT_TOKEN" },
    allowedEnvVars: ["ARENA_AGENT_TOKEN"],
    timeout: 5,
  };
  return hookConfig(
    Object.fromEntries(
      ["PreToolUse", "PostToolUse", "PostToolUseFailure", "Stop", "SessionStart", "SessionEnd"].map(event => [
        event,
        handler,
      ]),
    ),
  );
}

export function buildCodex({ apiBase }: JoinFields): string {
  const commands = {
    SessionStart: 'jq -nc \'{events:[{seq:(now*1000|floor),type:"entrant.status",status:"working"}]}\' | <curl tail>',
    PreToolUse:
      'jq -c \'{events:[{seq:(now*1000|floor),type:"tool.call",tool:.tool_name,toolCallId:(.tool_use_id // ""),detail:(((.tool_input|if type=="object" then .command else null end) // (.tool_input|tojson))|.[0:4000])}]}\' | <curl tail>',
    PostToolUse:
      'jq -c \'{events:[{seq:(now*1000|floor),type:"tool.result",tool:.tool_name,toolCallId:(.tool_use_id // ""),ok:true,detail:((.tool_response|if type=="string" then . else tojson end)|.[0:4000])}]}\' | <curl tail>',
    Stop: 'body=$(jq -c \'select((.last_assistant_message|type)=="string" and (.last_assistant_message|length)>0)|{events:[{seq:(now*1000|floor),type:"agent.message",text:(.last_assistant_message|.[0:4000])}]}\'); [ -n "$body" ] && printf %s "$body" | <curl tail>; echo \'{}\'',
    SessionEnd: 'jq -nc \'{events:[{seq:(now*1000|floor),type:"entrant.status",status:"idle"}]}\' | <curl tail>',
  };
  return hookConfig(
    Object.fromEntries(
      Object.entries(commands).map(([event, command]) => [
        event,
        {
          type: "command",
          command: command.replace("<curl tail>", () => curlTail(apiBase)),
          timeout: event === "SessionEnd" ? 3 : 10,
        },
      ]),
    ),
  );
}

export function buildGemini({ apiBase }: JoinFields): string {
  const commands = {
    SessionStart: 'jq -nc \'{events:[{seq:(now*1000|floor),type:"entrant.status",status:"working"}]}\' | <curl tail>',
    BeforeTool:
      'jq -c \'{events:[{seq:(now*1000|floor),type:"tool.call",tool:.tool_name,toolCallId:(.tool_name+"-"+(.tool_input|tojson|explode|reduce .[] as $c (0; (. * 31 + $c) % 1000000007)|tostring)),detail:(((.tool_input|if type=="object" then .command else null end) // (.tool_input|tojson))|.[0:4000])}]}\' | <curl tail>',
    AfterTool:
      'jq -c \'{events:[{seq:(now*1000|floor),type:"tool.result",tool:.tool_name,toolCallId:(.tool_name+"-"+(.tool_input|tojson|explode|reduce .[] as $c (0; (. * 31 + $c) % 1000000007)|tostring)),ok:((.tool_response|type)!="object" or .tool_response.error==null),detail:(((.tool_response|if type=="object" then (.returnDisplay // .llmContent // .) else . end)|if type=="string" then . else tojson end)|.[0:4000])}]}\' | <curl tail>',
    AfterAgent:
      'body=$(jq -c \'select((.prompt_response|type)=="string" and (.prompt_response|length)>0)|{events:[{seq:(now*1000|floor),type:"agent.message",text:(.prompt_response|.[0:4000])}]}\'); [ -n "$body" ] && printf %s "$body" | <curl tail>; true',
    SessionEnd: 'jq -nc \'{events:[{seq:(now*1000|floor),type:"entrant.status",status:"idle"}]}\' | <curl tail>',
  };
  return hookConfig(
    Object.fromEntries(
      Object.entries(commands).map(([event, command]) => [
        event,
        {
          name: "arena",
          type: "command",
          command: command.replace("<curl tail>", () => curlTail(apiBase)),
          timeout: 10000,
        },
      ]),
    ),
  );
}

const QUEUE = `const token = process.env.ARENA_AGENT_TOKEN;
let seq = Date.now(), timer = null;
const queue = [];
const clip = value => (typeof value === "string" ? value : JSON.stringify(value ?? "")).slice(0, 4000);
function push(event) {
  if (!token) return; queue.push({ seq: ++seq, ...event });
  if (!timer) timer = setTimeout(flush, 1000);
}
async function flush() {
  if (timer) clearTimeout(timer); timer = null;
  const events = queue.splice(0, 100); if (!events.length) return;
  try { await fetch(\`\${API}/agent/events\`, {
    method: "POST", headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
    body: JSON.stringify({ events }), signal: AbortSignal.timeout(5000),
  }); } catch {}
  if (queue.length && !timer) timer = setTimeout(flush, 1000);
}`;

export function buildOpenCode({ apiBase }: JoinFields): string {
  return `const API = ${JSON.stringify(
    apiBase,
  )};\n${QUEUE}\n${`const assistantMessages = new Set(), sentParts = new Set();
export const ArenaPlugin = async () => ({
  "tool.execute.before": async (input, output) => {
    push({ type: "tool.call", tool: input.tool, toolCallId: input.callID, detail: clip(output.args?.command ?? output.args) });
  },
  "tool.execute.after": async (input, output) => {
    push({ type: "tool.result", tool: input.tool, toolCallId: input.callID, ok: true, detail: clip(output.output) });
  },
  event: async ({ event }) => {
    if (event.type === "message.updated" && event.properties.info.role === "assistant") assistantMessages.add(event.properties.info.id);
    if (event.type === "message.part.updated") {
      const part = event.properties.part;
      if (part.time?.end && !sentParts.has(part.id)) {
        if (part.type === "text" && assistantMessages.has(part.messageID)) { sentParts.add(part.id); push({ type: "agent.message", text: clip(part.text) }); }
        else if (part.type === "reasoning") { sentParts.add(part.id); push({ type: "agent.reasoning", text: clip(part.text) }); }
      }
      if (part.type === "step-finish" && !sentParts.has(part.id)) {
        sentParts.add(part.id);
        push({ type: "usage", inputTokens: (part.tokens.input ?? 0) + (part.tokens.cache?.read ?? 0), outputTokens: (part.tokens.output ?? 0) + (part.tokens.reasoning ?? 0), cachedInputTokens: part.tokens.cache?.read ?? 0, costUsd: part.cost });
      }
    }
    if (event.type === "session.status" && event.properties.status.type === "busy") push({ type: "entrant.status", status: "working" });
    if (event.type === "session.idle") push({ type: "entrant.status", status: "idle" });
  },
});`}`;
}

export function buildPi({ apiBase }: JoinFields): string {
  const queue = QUEUE.replace(
    "let seq = Date.now(), timer = null;",
    "let seq = Date.now(); let timer: ReturnType<typeof setTimeout> | null = null;",
  )
    .replace("const queue = [];", "const queue: any[] = [];")
    .replace("clip = value =>", "clip = (value: any) =>")
    .replace("push(event)", "push(event: any)");
  return `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\nconst API = ${JSON.stringify(
    apiBase,
  )};\n${queue}\n${`export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => { push({ type: "entrant.status", status: "working" }); });
  pi.on("agent_start", async () => { push({ type: "entrant.status", status: "working" }); });
  pi.on("agent_settled", async () => { push({ type: "entrant.status", status: "idle" }); });
  pi.on("session_shutdown", async () => { push({ type: "entrant.status", status: "idle" }); await flush(); });
  pi.on("tool_call", async (event: any) => {
    push({ type: "tool.call", tool: event.toolName, toolCallId: event.toolCallId, detail: clip(event.input?.command ?? event.input) });
  });
  pi.on("tool_result", async (event: any) => {
    const text = event.content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\\n");
    push({ type: "tool.result", tool: event.toolName, toolCallId: event.toolCallId, ok: !event.isError, detail: clip(text) });
  });
  pi.on("message_end", async (event: any) => {
    const message = event.message; if (message.role !== "assistant") return;
    for (const part of message.content) {
      if (part.type === "text" && part.text.trim()) push({ type: "agent.message", text: clip(part.text) });
      if (part.type === "thinking" && part.thinking.trim()) push({ type: "agent.reasoning", text: clip(part.thinking) });
    }
    const usage = message.usage;
    if (usage) push({ type: "usage", inputTokens: (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0), outputTokens: (usage.output ?? 0) + (usage.reasoning ?? 0), cachedInputTokens: usage.cacheRead ?? 0, costUsd: usage.cost?.total ?? null });
  });
}`}`;
}

export const HOOKS = [
  {
    name: "Claude Code",
    path: ".claude/settings.json",
    build: buildClaudeCode,
    shows: [
      "every tool call and its result, with failures marked; what Claude said at the end of each turn, once per turn; working and idle. It will not show reasoning or token usage: no Claude Code hook carries tokens, so the tokens and cost cells stay empty.",
    ],
    trust:
      "Claude Code holds back hooks from every settings file until you accept the trust dialog for the folder. Open Claude Code in the project folder and accept it before you start; nothing will be posted until you do.",
  },
  {
    name: "Codex",
    path: ".codex/hooks.json",
    build: buildCodex,
    shows: [
      "tool calls and results (results are always shown as ok; Codex hooks do not say whether a tool failed), what Codex said at the end of each turn, once per turn, working and idle. It will not show reasoning or token usage.",
    ],
    trust:
      "Codex will not run a hook until you review and trust it. After saving the file, run `/hooks` inside Codex and trust each entry; Codex records trust against the exact text, so any edit to the file means trusting again. Project hooks also load only when the project's `.codex` folder is trusted. Codex caps SessionEnd hooks at three seconds; the others use 10 instead of the 600-second default so a dead arena never hangs the agent.",
  },
  {
    name: "OpenCode",
    path: ".opencode/plugins/arena.js",
    build: buildOpenCode,
    shows: [
      "everything: messages, reasoning, tool calls and results, tokens and cost, working and idle. This is a JavaScript file OpenCode runs inside its own process, not a settings blob; read it before you save it. No trust prompt.",
    ],
    trust: "",
  },
  {
    name: "Gemini CLI",
    path: ".gemini/settings.json",
    build: buildGemini,
    shows: [
      "tool calls and results, with failures marked; what Gemini said at the end of each turn, once per turn; working and idle. It will not show reasoning. It will not show token usage: Gemini's hooks carry only a total token count per chunk, which cannot be split into input and output, so the snippet does not report it rather than report it wrongly. Tool call ids derive from the call's input, so two identical calls in flight at once can cross. Gemini does not wait for the session-end hook, so the final idle mark may be lost.",
    ],
    trust: "No trust prompt for Gemini hooks.",
  },
  {
    name: "Pi",
    path: ".pi/extensions/arena.ts",
    build: buildPi,
    shows: [
      "everything: messages, reasoning, tool calls and results with failures marked, tokens and cost, working and idle. This is a TypeScript file Pi runs with your full permissions; read it before you save it.",
    ],
    trust:
      'Pi loads `.pi/extensions` only after you trust the project. The non-interactive modes (`-p`, `--mode json`, `--mode rpc`) never ask and silently skip the extension. Run `pi` once interactively in the folder and accept the trust prompt, or pass `--approve` (`-a`), or set `defaultProjectTrust` to `"always"` in your global Pi settings.',
  },
] as const;

export function buildPrompt(fields: JoinFields): string {
  const { apiBase, runId, name, harness, model, effort, url } = fields;
  const declared = Object.fromEntries(Object.entries({ harness, model, effort, url }).filter(([, value]) => value));
  const message = JOIN_MESSAGE_TEMPLATE.replace("{runId}", "$RUN_ID")
    .replace("{address}", "$ADDRESS")
    .replace("{nonce}", "$NONCE");
  return `Join Agents Arena run ${runId || "<run id from the operator>"} at ${apiBase}.

You run on this machine with your own funded wallet. Read its private key from the environment variable KEY.
Never print KEY or send it anywhere. The arena never holds your key and never funds your wallet.

Run these commands in one shell session because the nonce is single-use and NONCE, SIG, JOIN, and ARENA_AGENT_TOKEN exist only there; if your harness opens a fresh shell per command, save the variables to a file it sources or run the block as one command.

Register with these commands. Keep the join response and token private:

export ARENA_API=${shellQuote(apiBase)}
export RUN_ID=${shellQuote(runId || "<run id from the operator>")}
export ADDRESS=$(cast wallet address --private-key "$KEY")
NONCE=$(curl -fsS --max-time 5 "$ARENA_API/auth/nonce" | jq -er .nonce)
SIG=$(cast wallet sign --private-key "$KEY" "${message}")
JOIN=$(curl -fsS --max-time 5 -X POST "$ARENA_API/agent/join" -H 'Content-Type: application/json' \\
  --data-binary "$(jq -nc --arg runId "$RUN_ID" --arg address "$ADDRESS" --arg nonce "$NONCE" --arg signature "$SIG" --arg name ${shellQuote(
    name,
  )} --argjson declared ${shellQuote(JSON.stringify(declared))} \\
    '{runId:$runId,address:$address,nonce:$nonce,signature:$signature,name:$name} + $declared')")

Sign this exact text, with no trailing newline:
${JOIN_MESSAGE_TEMPLATE}

Replace {runId} with RUN_ID, {address} with ADDRESS exactly as sent in the join body, and {nonce} with NONCE.
The nonce comes from GET /auth/nonce. The signature uses EIP-191 personal_sign.
If registration fails, resolve the error before proceeding. Do not print the join response.

export ARENA_AGENT_TOKEN=$(printf %s "$JOIN" | jq -er .token)

Send Authorization: Bearer $ARENA_AGENT_TOKEN on every later call.

Fetch your task:
curl -fsS --max-time 5 "$ARENA_API/agent/task" -H "Authorization: Bearer $ARENA_AGENT_TOKEN"

While task is null, wait five seconds and try again. Check state before waiting.
When task is set, follow its text.

When you start a challenge, POST /agent/progress with {"challengeId": N}, where N is the challenge number:
curl -fsS --max-time 5 -X POST "$ARENA_API/agent/progress" -H "Authorization: Bearer $ARENA_AGENT_TOKEN" \\
  -H 'Content-Type: application/json' -d '{"challengeId":1}'

Post short notes on what you are doing as agent.message events to POST /agent/events:
jq -nc --arg text 'Registered, starting on challenge 1.' \\
  '{events:[{seq:(now*1000|floor),type:"agent.message",text:($text|.[0:4000])}]}' | \\
  curl -fsS --max-time 5 -X POST "$ARENA_API/agent/events" -H "Authorization: Bearer $ARENA_AGENT_TOKEN" \\
    -H 'Content-Type: application/json' --data-binary @-

Use a millisecond timestamp as seq; a repeat is harmless and comes back counted as a duplicate. Reports are optional; the chain still scores your wallet.

Between steps, GET /agent/inbox?after=<cursor>, starting at 0:
curl -fsS --max-time 5 "$ARENA_API/agent/inbox?after=0" -H "Authorization: Bearer $ARENA_AGENT_TOKEN"

Read messages[].text as instructions from the race director. Pass the returned cursor as after on the next poll.
Never poll the inbox faster than once a second. The operator can steer you and remove you.

Keep checking GET /agent/task between steps. Keep going until it reports state stopping, finished, or failed.
Stop immediately in any of those states, even when task is null. A revoked token returns 401; stop requests with that token.`;
}
