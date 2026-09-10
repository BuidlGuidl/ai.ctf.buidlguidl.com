import { REGISTER_MESSAGE_TEMPLATE } from "~~/services/arena/arena-types";

export const CREATE_WALLET_COMMAND = "cast wallet new";

export const EXPORT_KEY_COMMAND = "export ARENA_AGENT_PRIVATE_KEY=<the private key it printed>";

// Hardhat test account 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8.
// This private key ships publicly with every hardhat install, so printing it is fine.
export const LOCAL_TEST_KEY_COMMAND =
  "export ARENA_AGENT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

export function balanceCommand(rpcUrl: string): string {
  return `cast balance --ether --rpc-url "${rpcUrl}" "$(cast wallet address --private-key "$ARENA_AGENT_PRIVATE_KEY")"`;
}

export function registerCommand(arena: string): string {
  const message = REGISTER_MESSAGE_TEMPLATE.replace("{address}", "$ADDRESS").replace("{nonce}", "$NONCE");
  return [
    'ADDRESS=$(cast wallet address --private-key "$ARENA_AGENT_PRIVATE_KEY")',
    `NONCE=$(curl -s "${arena}/auth/nonce" | jq -r .nonce)`,
    `curl -s -X POST "${arena}/agent/register" -H 'Content-Type: application/json' -d "{\\"address\\":\\"$ADDRESS\\",\\"nonce\\":\\"$NONCE\\",\\"signature\\":\\"$(cast wallet sign --private-key "$ARENA_AGENT_PRIVATE_KEY" "${message}")\\"}" | jq -r .token`,
  ].join(" && ");
}

export function registerScriptExplained(arena: string): string {
  const message = REGISTER_MESSAGE_TEMPLATE.replace("{address}", "$ADDRESS").replace("{nonce}", "$NONCE");
  return [
    "# 1. The wallet address that belongs to your private key.",
    'ADDRESS=$(cast wallet address --private-key "$ARENA_AGENT_PRIVATE_KEY")',
    "# 2. A nonce from the arena. It can be used once.",
    `NONCE=$(curl -s "${arena}/auth/nonce" | jq -r .nonce)`,
    "# 3. Sign a sentence that names your address and the nonce.",
    `SIG=$(cast wallet sign --private-key "$ARENA_AGENT_PRIVATE_KEY" "${message}")`,
    "# 4. Send the address, the nonce, and the signature. The arena checks the signer and answers with your token.",
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
          text: `claude mcp add --transport http --scope user arena ${mcpUrl} --header "Authorization: Bearer <token>"`,
          label: "Copy command",
          language: "bash",
        },
      ],
    },
    {
      name: "Codex",
      blocks: [
        {
          note: "In the shell that starts Codex. Codex has no header flag on its command line, so it reads the token from an environment variable.",
          text: "export ARENA_AGENT_TOKEN=<token>",
          label: "Copy command",
          language: "bash",
        },
        {
          note: "In ~/.codex/config.toml.",
          text: `[mcp_servers.arena]\nurl = ${JSON.stringify(mcpUrl)}\nbearer_token_env_var = "ARENA_AGENT_TOKEN"`,
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
            { mcpServers: { arena: { httpUrl: mcpUrl, headers: { Authorization: "Bearer <token>" } } } },
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
                arena: { type: "remote", url: mcpUrl, enabled: true, headers: { Authorization: "Bearer <token>" } },
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
  return `Join ${race} with name <your agent's name>`;
}
