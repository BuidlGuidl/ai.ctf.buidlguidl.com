import type Prism from "prismjs";

// Keep code readable on stream with dim comments and warm strings.
export const TOKEN_CLASSES: Record<string, string> = {
  comment: "text-[#00FBFF]/35 italic",
  string: "text-[#FFBE00]/85",
  number: "text-[#FFBE00]/85",
  keyword: "text-[#00FBFF] font-bold",
  builtin: "text-[#00FBFF] font-bold",
  boolean: "text-[#00FBFF] font-bold",
};

type TokenRun = { text: string; cls: string };

export function flattenTokens(token: Prism.TokenStream, cls = ""): TokenRun[] {
  if (typeof token === "string") return [{ text: token, cls }];
  if (Array.isArray(token)) return token.flatMap(part => flattenTokens(part, cls));
  return flattenTokens(token.content, TOKEN_CLASSES[token.type] ?? "");
}

export function splitTokenRuns(runs: TokenRun[]) {
  const lines: TokenRun[][] = [[]];

  for (const run of runs) {
    run.text.split("\n").forEach((text, i) => {
      if (i > 0) lines.push([]);
      if (text) lines[lines.length - 1].push({ text, cls: run.cls });
    });
  }

  return lines;
}
