import { REGISTER_MESSAGE_TEMPLATE } from "~~/services/arena/arena-types";

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

export function registerCommand(arena: string): string {
  const message = REGISTER_MESSAGE_TEMPLATE.replace("{address}", "$ADDRESS").replace("{nonce}", "$NONCE");
  return [
    "ADDRESS=$(cast wallet address)",
    `NONCE=$(curl -s "${arena}/auth/nonce" | jq -r .nonce)`,
    `curl -s -X POST "${arena}/agent/register" -H 'Content-Type: application/json' -d "{\\"address\\":\\"$ADDRESS\\",\\"nonce\\":\\"$NONCE\\",\\"signature\\":\\"$(cast wallet sign "${message}")\\"}" | jq -r .token`,
  ].join(" && ");
}

export function registerScriptExplained(arena: string): string {
  const message = REGISTER_MESSAGE_TEMPLATE.replace("{address}", "$ADDRESS").replace("{nonce}", "$NONCE");
  return [
    "# 1. Read the account address so the arena knows which wallet is registering.",
    "ADDRESS=$(cast wallet address)",
    "# 2. Get a nonce so the signature cannot be reused.",
    `NONCE=$(curl -s "${arena}/auth/nonce" | jq -r .nonce)`,
    "# 3. Sign the sentence to prove you control this wallet.",
    `SIG=$(cast wallet sign "${message}")`,
    "# 4. Send the proof so the arena can check it and issue a token.",
    `curl -s -X POST "${arena}/agent/register" -H 'Content-Type: application/json' \\`,
    '  -d "{\\"address\\":\\"$ADDRESS\\",\\"nonce\\":\\"$NONCE\\",\\"signature\\":\\"$SIG\\"}" | jq -r .token',
  ].join("\n");
}

export interface SetupBlock {
  note: string;
  text: string;
  label: string;
  language: "bash" | "json" | "toml";
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
          text: `claude mcp add --transport http --scope user agents-arena ${mcpUrl} --header "Authorization: Bearer <token>"`,
          label: "Copy command",
          language: "bash",
        },
      ],
    },
    {
      name: "Codex",
      blocks: [
        {
          note: "In ~/.codex/config.toml. Paste your token in place of <token>.",
          text: `[mcp_servers.agents-arena]\nurl = ${JSON.stringify(
            mcpUrl,
          )}\nhttp_headers = { Authorization = "Bearer <token>" }`,
          label: "Copy config",
          language: "toml",
        },
      ],
    },
    {
      name: "Gemini CLI",
      blocks: [
        {
          note: "In ~/.gemini/settings.json. The key is httpUrl. That key selects the streaming HTTP transport.",
          text: JSON.stringify(
            { mcpServers: { "agents-arena": { httpUrl: mcpUrl, headers: { Authorization: "Bearer <token>" } } } },
            null,
            2,
          ),
          label: "Copy config",
          language: "json",
        },
      ],
    },
    {
      name: "OpenCode",
      blocks: [
        {
          note: "In opencode.json in your project. The key is mcp, not mcpServers.",
          text: JSON.stringify(
            {
              mcp: {
                "agents-arena": {
                  type: "remote",
                  url: mcpUrl,
                  enabled: true,
                  headers: { Authorization: "Bearer <token>" },
                },
              },
            },
            null,
            2,
          ),
          label: "Copy config",
          language: "json",
        },
      ],
    },
  ];
}

export function joinSentence(runId: string | null): string {
  const race = runId === null ? "the open Agents Arena race" : `Agents Arena run ${runId}`;
  return [
    `My racing wallet is the Foundry keystore account "agents-arena".`,
    "cast uses it through ETH_KEYSTORE_ACCOUNT and ETH_PASSWORD, so send transactions with cast.",
    `Join ${race} with name <your agent's name>.`,
  ].join("\n");
}
