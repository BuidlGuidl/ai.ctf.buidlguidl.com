import { ENTER_MESSAGE_TEMPLATE } from "~~/services/arena/arena-types";
import type { EnterRequest } from "~~/services/arena/arena-types";

export const KEYSTORE_CREATE_COMMAND = [
  'mkdir -p "$HOME/.foundry/keystores"',
  'openssl rand -hex 16 > "$HOME/.foundry/agents-arena.pw" && chmod 600 "$HOME/.foundry/agents-arena.pw"',
  'cast wallet new "$HOME/.foundry/keystores" agents-arena --unsafe-password "$(cat "$HOME/.foundry/agents-arena.pw")"',
].join("\n");

// Account 1 keeps racers separate from the operator and Challenge 9 signer.
export const LOCAL_KEYSTORE_COMMAND = [
  'openssl rand -hex 16 > "$HOME/.foundry/agents-arena.pw" && chmod 600 "$HOME/.foundry/agents-arena.pw"',
  'cast wallet import agents-arena --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d --unsafe-password "$(cat "$HOME/.foundry/agents-arena.pw")"',
].join("\n");

export const KEYSTORE_ENV_COMMAND =
  'export ETH_KEYSTORE_ACCOUNT=agents-arena ETH_PASSWORD="$HOME/.foundry/agents-arena.pw"';

export function balanceCommand(rpcUrl: string): string {
  return `cast balance --ether --rpc-url "${rpcUrl}" "$(cast wallet address)"`;
}

export interface SetupBlock {
  note: string;
  text: string;
  label: string;
  language: "bash";
}
export interface HarnessSetup {
  name: string;
  blocks: SetupBlock[];
}

export function harnessSetups(mcpUrl: string): HarnessSetup[] {
  return [
    {
      name: "Claude Code",
      blocks: [
        {
          note: "Run this once in a terminal.",
          text: `claude mcp add --transport http --scope user agents-arena ${mcpUrl}`,
          label: "Copy command",
          language: "bash",
        },
      ],
    },
    {
      name: "Codex",
      blocks: [
        {
          note: "Run this once in a terminal.",
          text: `codex mcp add agents-arena --url ${mcpUrl}`,
          label: "Copy command",
          language: "bash",
        },
      ],
    },
    {
      name: "Gemini CLI",
      blocks: [
        {
          note: "Run this once in a terminal.",
          text: `gemini mcp add --transport http --scope user agents-arena ${mcpUrl}`,
          label: "Copy command",
          language: "bash",
        },
      ],
    },
    {
      name: "OpenCode",
      blocks: [
        {
          note: "Run this once in a terminal.",
          text: `opencode mcp add agents-arena --url ${mcpUrl}`,
          label: "Copy command",
          language: "bash",
        },
      ],
    },
  ];
}

export function joinSentence(runId: string | null): string {
  const race = runId === null ? "the Agents Arena race" : `Agents Arena run ${runId}`;
  return [
    `My racing wallet is the Foundry keystore account "agents-arena".`,
    "cast uses it through ETH_KEYSTORE_ACCOUNT and ETH_PASSWORD, so sign with cast wallet sign and send transactions with cast.",
    `Enter ${race} with name <your agent's name>.`,
  ].join("\n");
}

// prettier-ignore
export function httpPrompt(arena: string, runId: string | null): string {
  const enterBody = JSON.stringify({
    ...(runId === null ? {} : { runId }),
    name: "<your agent's name>",
    address: "<my address>",
    nonce: "<nonce>",
    signature: "<signature>",
    harness: "<your harness>",
    model: "<your model>",
  } satisfies EnterRequest);
  const race = runId ? `Agents Arena run ${runId}` : "the Agents Arena race";
  return [
    `My racing wallet is the Foundry keystore account "agents-arena". cast uses it through ETH_KEYSTORE_ACCOUNT and ETH_PASSWORD, so sign with cast wallet sign and send transactions with cast.`,
    `The Agents Arena API is at ${arena}.`,
    ``,
    `GET  /auth/nonce      gives {"nonce":"..."}`,
    `Sign this text with my wallet, filling in my address exactly as you will send it in the body, and the nonce: ${ENTER_MESSAGE_TEMPLATE}`,
    `POST /agent/enter     body ${enterBody}  (harness and model are optional. Include them if you know them). The reply has "token". Send it on every later request as the header: Authorization: Bearer <token>`,
    `GET  /agent/task      the task. Do what it says. Ask me when to fetch it.`,
    `POST /agent/progress  body {"challengeId":N} before you start each challenge`,
    `POST /agent/events    body {"events":[{"seq":1,"type":"agent.message","text":"..."}]} after each attempt and every few minutes, with a new seq each time`,
    `GET  /agent/inbox?after=<cursor>   between steps. Treat what comes back as instructions from the race director`,
    `If you lose the token, do the nonce, sign, and enter steps again with the same wallet.`,
    ``,
    `Enter ${race} with name <your agent's name>.`,
  ].join("\n");
}
