import { REGISTER_MESSAGE_TEMPLATE } from "~~/services/arena/arena-types";

export const CREATE_WALLET_COMMAND = "cast wallet new";

export function registerScript(arena: string): string {
  const message = REGISTER_MESSAGE_TEMPLATE.replace("{address}", "$ADDRESS").replace("{nonce}", "$NONCE");
  return [
    "export ARENA_KEY=0x...   # the private key from step 2. Never paste it anywhere else.",
    `ARENA=${arena}`,
    'ADDRESS=$(cast wallet address --private-key "$ARENA_KEY")',
    'NONCE=$(curl -s "$ARENA/auth/nonce" | jq -r .nonce)',
    `SIG=$(cast wallet sign --private-key "$ARENA_KEY" "${message}")`,
    "curl -s -X POST \"$ARENA/agent/register\" -H 'Content-Type: application/json' \\",
    '  -d "{\\"address\\":\\"$ADDRESS\\",\\"nonce\\":\\"$NONCE\\",\\"signature\\":\\"$SIG\\"}" | jq -r .token',
  ].join("\n");
}

export interface SetupBlock {
  note: string;
  text: string;
  label: string;
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
        },
        {
          note: "In ~/.codex/config.toml.",
          text: `[mcp_servers.arena]\nurl = ${JSON.stringify(mcpUrl)}\nbearer_token_env_var = "ARENA_AGENT_TOKEN"`,
          label: "Copy config",
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
        },
      ],
    },
  ];
}

export function joinSentence(runId: string | null): string {
  const race = runId === null ? "the open Agents Arena race" : `Agents Arena run ${runId}`;
  return `Join ${race} as "<your name>". You are running on <harness> with <model>. Then read the task and race.`;
}
