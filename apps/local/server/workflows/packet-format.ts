/**
 * Shared shape for the Markdown briefs this project hands to an AI host.
 *
 * A packet is pasted whole into a fresh chat window, so it has to survive being
 * read as one document by something that will then act on it. Two rules make
 * that safe, and both are easy to get wrong once per packet type, which is why
 * they live here rather than in each builder.
 */

/**
 * Wraps a body in a fence wide enough to contain it.
 *
 * Content that itself contains a fence would otherwise close the block early,
 * and everything after it — including the write-back instructions — would be
 * read as prose the assistant might follow. Source files that document shell
 * commands do this routinely.
 */
export function fence(language: string, body: string): readonly string[] {
  const widest = [...body.matchAll(/^`{3,}/gm)].reduce(
    (longest, match) => Math.max(longest, match[0].length),
    2,
  );
  const marker = "`".repeat(Math.max(3, widest + 1));
  return [`${marker}${language}`, body, marker];
}

/**
 * The one line every packet carries.
 *
 * The learner may be in Grok Build, Claude Code, Antigravity, Codex, or
 * something that did not exist when this was written. A packet that assumes a
 * brand is a packet that fails silently in the other window.
 */
export const HOST_AGNOSTIC_NOTICE = "不要假设你是某一个品牌的 IDE。";
