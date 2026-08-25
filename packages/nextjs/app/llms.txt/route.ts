import { getChallengeDocs } from "~~/utils/challenges";
import { buildLlmsTxt } from "~~/utils/llmsTxt";

export const dynamic = "force-static";

export async function GET() {
  const challenges = await getChallengeDocs();

  return new Response(buildLlmsTxt(challenges), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
