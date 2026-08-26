/**
 * A passage identified by what it says and what surrounds it.
 *
 * The shared W3C Web Annotation TextQuoteSelector shape. Character offsets
 * would be simpler and would rot:
 * a lesson revision rewrites the whole content, so every offset past an edited
 * paragraph moves, and a mark saved yesterday would silently point at the wrong
 * sentence today.
 */
export interface TextQuote {
  readonly exact: string;
  readonly prefix: string;
  readonly suffix: string;
}

export type ReaderMarkKind = "question" | "highlight";

export interface ReaderMark {
  readonly markId: string;
  readonly lessonKey: string;
  readonly contentRevision: number;
  readonly kind: ReaderMarkKind;
  readonly quote: TextQuote;
  readonly sectionTitle: string | null;
  readonly note: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

/** Lesson titles by content key, so a batch names lessons rather than ids. */
export type LessonTitleLookup = ReadonlyMap<string, string>;

/**
 * Turns marked passages into a question someone can actually answer.
 *
 * Three things go in beyond the quotes themselves, and each one exists because
 * leaving it out produces a worse answer:
 *
 * - **Where each passage came from.** "I don't understand this" without a
 *   location gets a definition of the words. With the lesson and section, it
 *   gets an explanation of the point being made there.
 * - **What the reader is studying.** The same sentence needs a different answer
 *   for someone reading a Rust codebase than for someone reading a design
 *   system.
 * - **An explicit request to keep them separate.** Handed several quotes at
 *   once, an assistant will otherwise synthesise one flowing essay, and the
 *   reader loses the ability to tell which part answered which question.
 *
 * Deliberately plain text. It goes to the clipboard today and through an API
 * later, and neither should require this function to change.
 */
export function buildQuestionPrompt(
  marks: readonly ReaderMark[],
  context: { readonly studyTitle: string; readonly lessonTitles: LessonTitleLookup },
): string {
  const questions = marks.filter((mark) => mark.kind === "question" && mark.resolvedAt === null);
  if (questions.length === 0) return "";

  const lines = [
    `我在学《${context.studyTitle}》的课程，下面几处没看懂。`,
    "",
    "请逐条解释，每条单独回答，不要合并成一段。用初学者能懂的话，必要时打比方。",
    "",
  ];
  questions.forEach((mark, index) => {
    const lessonTitle = context.lessonTitles.get(mark.lessonKey) ?? mark.lessonKey;
    const where = mark.sectionTitle
      ? `《${lessonTitle}》「${mark.sectionTitle}」`
      : `《${lessonTitle}》`;
    lines.push(`${index + 1}. ${where}`);
    lines.push(`   原文：${mark.quote.exact}`);
    if (mark.note) lines.push(`   我的疑问：${mark.note}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

/**
 * Where a quote sits in a run of text, or null when it is no longer there.
 *
 * Tries the exact text with its recorded prefix first, so a sentence occurring
 * twice resolves to the occurrence that was actually marked, then falls back to
 * the exact text alone. Returning null is a real answer: it means the lesson
 * was rewritten under the reader's note, which is worth telling them.
 *
 * Takes a plain string rather than a DOM node — `src/domain` is compiled for
 * the server too, where there is no `document`. Turning the offset back into a
 * range is the browser layer's job.
 */
export function locateQuote(text: string, quote: TextQuote): { start: number; end: number } | null {
  let at = -1;
  if (quote.prefix) {
    const withContext = text.indexOf(quote.prefix + quote.exact);
    if (withContext !== -1) at = withContext + quote.prefix.length;
  }
  if (at === -1) at = text.indexOf(quote.exact);
  if (at === -1) return null;
  return { start: at, end: at + quote.exact.length };
}
