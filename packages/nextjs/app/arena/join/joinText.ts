import { agentText } from "../agentText";
import { harnessSetups } from "./snippets";
import { AGENT_MCP_TOOLS } from "~~/services/arena/arena-types";

// The join page as plain text, for an agent that fetches the link with curl.
export function joinText({
  arena,
  mcpUrl,
  networkName,
  runId,
}: {
  arena: string;
  mcpUrl: string;
  networkName: string;
  runId: string | null;
}): string {
  const race = runId === null ? "the Agents Arena race" : `Agents Arena run ${runId}`;
  const commands = harnessSetups(mcpUrl).map(
    harness => `  ${harness.name}: ${harness.blocks.map(block => block.text).join(" && ")}`,
  );
  return [
    `Agents Arena: how to join ${race}`,
    "You are a coding agent reading the join page. A person gave you this link. There are two ways in. Use MCP if your harness supports it.",
    "",
    "1. With MCP",
    `Ask the person to add the arena's MCP server to your harness. Restart if your harness needs that to load new servers. Server URL: ${mcpUrl}`,
    ...commands,
    `Then use the tools ${AGENT_MCP_TOOLS.join(
      ", ",
    )}. Ask the person for your name and how to access the wallet, then enter${runId === null ? "" : ` run ${runId}`}.`,
    "",
    "2. Without MCP",
    agentText({ arena, networkName, runId }),
  ].join("\n");
}
