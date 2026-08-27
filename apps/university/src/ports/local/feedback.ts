import type { FeedbackPort, FeedbackReceipt } from "@pieai/university-core";
import { feedbackNote } from "@pieai/university-ui/feedback/FeedbackNote.js";

export interface ClipboardFeedbackPortOptions {
  readonly shell: string;
  readonly now?: () => Date;
  readonly writeText?: (text: string) => Promise<void>;
}

/** Authoring has no feedback database; its existing AI hand-off is the transport. */
export function createClipboardFeedbackPort(options: ClipboardFeedbackPortOptions): FeedbackPort {
  const now = options.now ?? (() => new Date());
  const writeText = options.writeText ?? ((text: string) => navigator.clipboard.writeText(text));

  return {
    transport: "clipboard",
    async submit(input): Promise<FeedbackReceipt> {
      const at = now();
      await writeText(
        feedbackNote({
          shell: options.shell,
          route: input.context.route,
          viewport: input.context.viewport,
          theme: themeOfDocument(),
          at,
          said: input.message,
          locator: input.context.locator,
          contentRevision: input.context.contentRevision,
          exerciseAttemptCount: input.context.exerciseAttemptCount,
          signedIn: input.context.signedIn,
        }),
      );
      return { id: null, submittedAt: at.toISOString(), transport: "clipboard" };
    },
    // A clipboard hand-off has no local history to read. It is not a fake
    // empty database: the author can inspect the copied note in the AI host.
    async readMine() {
      return [];
    },
  };
}

function themeOfDocument(): string {
  if (typeof document === "undefined") return "light";
  return (
    document.documentElement.getAttribute("data-game-ui-theme") ??
    document.querySelector("[data-game-ui-theme]")?.getAttribute("data-game-ui-theme") ??
    "light"
  );
}
