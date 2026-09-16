import { MCP_URL, NETWORK_NAME } from "../../SetupShell";
import { joinText } from "../joinText";
import { cleanRunId } from "../snippets";
import { ARENA_PUBLIC_BACKEND_URL } from "~~/services/arena/client";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const runId = cleanRunId(new URL(request.url).searchParams.get("run"));
  const body = joinText({ arena: ARENA_PUBLIC_BACKEND_URL, mcpUrl: MCP_URL, networkName: NETWORK_NAME, runId });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
