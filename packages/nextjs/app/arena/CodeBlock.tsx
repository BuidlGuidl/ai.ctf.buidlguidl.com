"use client";

import { Fragment, useMemo } from "react";
import { CopyButton } from "./CopyButton";
import { flattenTokens, splitTokenRuns } from "./codeTokens";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-toml";

export function CodeBlock({
  code,
  language,
  title = language,
  copyLabel = "Copy code",
}: {
  code: string;
  language: "bash" | "json" | "toml" | "text";
  title?: string;
  copyLabel?: string;
}) {
  const lines = useMemo(
    () => splitTokenRuns(flattenTokens(language === "text" ? code : Prism.tokenize(code, Prism.languages[language]))),
    [code, language],
  );

  return (
    <div className="min-w-0 rounded border border-[#00FBFF]/15 bg-[#00090b]">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#00FBFF]/10">
        <span className="font-bold text-white">{title}</span>
        <CopyButton text={code} label={copyLabel} iconOnly compact />
      </div>
      <pre
        tabIndex={0}
        aria-label={title}
        className="max-h-[32rem] overflow-x-auto whitespace-pre console-scroll px-3 py-2 text-sm leading-relaxed text-[#9fe7ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FBFF]"
      >
        <code>
          {lines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && "\n"}
              {line.map((part, j) => (
                <span key={j} className={part.cls}>
                  {part.text}
                </span>
              ))}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
