import { useEffect, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";

/**
 * Copies a string and flips the label. Shared by the page-level
 * 「复制为 Markdown」 control and the agent-prompt's own copy button so the
 * two cannot grow different clipboard timings.
 */
export function CopyTextButton({
  text,
  idleLabel,
  copiedLabel,
  variant = "secondary",
}: {
  readonly text: string;
  readonly idleLabel: string;
  readonly copiedLabel: string;
  readonly variant?: "primary" | "secondary" | "ghost";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <GameButton
      type="button"
      variant={variant}
      onClick={() => {
        const write = navigator.clipboard?.writeText;
        if (!write) return;
        void write.call(navigator.clipboard, text).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? copiedLabel : idleLabel}
    </GameButton>
  );
}
