"use client";

import { useEffect, useRef, useState } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import { CheckIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00FBFF]";

export function CopyButton({
  text,
  label,
  disabled = false,
  compact = false,
  iconOnly = false,
}: {
  text: string;
  label: string;
  disabled?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <CopyToClipboard
      text={text}
      onCopy={(...result) => {
        if (!result[1]) return;
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 800);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? (copied ? "Copied" : label) : undefined}
        className={`inline-flex shrink-0 items-center gap-2 rounded border border-[#00FBFF]/40 px-3 ${
          compact ? "py-1.5 tracking-widest" : "py-2 tracking-wider"
        } text-xs hover:border-[#00FBFF] hover:bg-[#00FBFF]/10 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <DocumentDuplicateIcon className="h-4 w-4" />}
        <span className={iconOnly ? "sr-only" : undefined} aria-live="polite">
          {copied ? "Copied" : label}
        </span>
      </button>
    </CopyToClipboard>
  );
}
