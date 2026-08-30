/**
 * Feedback transport, and why it is not in `local/` or `online/`.
 *
 * Those two directories hold the mode adapters: the pair of answers to a
 * question the two builds genuinely answer differently. Feedback is not one of
 * those questions. Both builds run the same ordered chain — the account
 * backend first, the clipboard when it is absent or fails — so a copy of this
 * file under `local/` would say the opposite of what the code does, which is
 * the misreading that put a fourth port in the constitution once already.
 */
import { translate } from "@pieai/university-ui/i18n.js";
import type { FeedbackPort, FeedbackReceipt } from "@pieai/university-core";
import { feedbackNote } from "@pieai/university-ui/feedback/FeedbackNote.js";

export interface ClipboardFeedbackPortOptions {
  readonly shell: string;
  readonly now?: () => Date;
  readonly writeText?: (text: string) => Promise<void>;
}

/** The shared clipboard destination for feedback when the account backend is absent or fails. */
export function createClipboardFeedbackPort(options: ClipboardFeedbackPortOptions): FeedbackPort {
  const now = options.now ?? (() => new Date());
  const writeText = options.writeText ?? browserClipboardWriter();

  if (!writeText) return createUnavailableClipboardPort();

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

/** One ordered destination chain, shared by authoring and delivery. */
export function createFeedbackPort(options: {
  readonly backend: FeedbackPort | null;
  readonly clipboard: FeedbackPort;
}): FeedbackPort {
  return {
    transport: options.backend?.transport ?? options.clipboard.transport,
    async submit(input) {
      if (options.backend) {
        try {
          return await options.backend.submit(input);
        } catch {
          // A missing table, rejected write, or network failure uses the same
          // clipboard destination; the learner's message must not disappear.
        }
      }
      return options.clipboard.submit(input);
    },
    async readMine() {
      return options.backend ? options.backend.readMine() : [];
    },
  };
}

function browserClipboardWriter(): ((text: string) => Promise<void>) | null {
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
    return null;
  }
  return (text) => navigator.clipboard.writeText(text);
}

function createUnavailableClipboardPort(): FeedbackPort {
  return {
    transport: "unavailable",
    async submit() {
      throw new Error(translate("app.ports.feedback.copy.当前浏览器不提供复制功能"));
    },
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
