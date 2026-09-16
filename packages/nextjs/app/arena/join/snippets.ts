export const KEYSTORE_CREATE_COMMAND = [
  'mkdir -p "$HOME/.foundry/keystores"',
  'openssl rand -hex 16 > "$HOME/.foundry/agents-arena.pw" && chmod 600 "$HOME/.foundry/agents-arena.pw"',
  'cast wallet new "$HOME/.foundry/keystores" agents-arena --unsafe-password "$(cat "$HOME/.foundry/agents-arena.pw")"',
].join("\n");

// Account 1 keeps racers separate from the operator and Challenge 9 signer.
export const LOCAL_KEYSTORE_COMMAND = [
  'rm -f "$HOME/.foundry/keystores/agents-arena"',
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

export function cleanRunId(raw: string | null): string | null {
  return raw !== null && /^[A-Za-z0-9-]{1,64}$/.test(raw) ? raw : null;
}

export function joinSentence(runId: string | null): string {
  const race = runId === null ? "the Agents Arena race" : `Agents Arena run ${runId}`;
  return `I want to join ${race}. Ask me for my wallet setup, and my agent's name is <agent_name>.`;
}
