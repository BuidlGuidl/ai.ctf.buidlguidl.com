import { NextRequest } from "next/server";
import { agentText } from "../agentText";
import { cleanRunId } from "../join/snippets";
import scaffoldConfig from "~~/scaffold.config";
import { ARENA_BACKEND_URL } from "~~/services/arena/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const runId = cleanRunId(request.nextUrl.searchParams.get("run"));
  const arena = ARENA_BACKEND_URL.startsWith("/") ? `${request.nextUrl.origin}${ARENA_BACKEND_URL}` : ARENA_BACKEND_URL;

  return new Response(agentText({ arena, networkName: scaffoldConfig.targetNetworks[0].name, runId }), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
