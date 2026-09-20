import { interactionLessonIssues } from "@pieai/university-core/domain/schemas.js";

/** One mechanical prose contract, shared by proposal and persisted-lesson checks. */
export const LESSON_VARIANTS = {
  现象: { openCount: 1, middleCount: 1 },
  对比: { openCount: 1, middleCount: 2 },
  溯源: { openCount: 1, middleCount: 1 },
  决策: { openCount: 1, middleCount: 2, boundary: "什么时候该反过来" },
  术语: { openCount: 1, middleCount: 2, boundary: "它不是什么" },
};

/** Keep the words a reader sees, not the length of a source's hidden URL.
 * A source URL must neither require filler in the main text nor stand in for
 * a detailed explanation. Visible autolinks deliberately remain visible text.
 */
export function lessonProseWithoutLinkDestinations(text) {
  return text.replace(
    /\[([^\]\n]+)\]\((?:<https?:\/\/[^>\n]+>|https?:\/\/(?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"\n]*")?\)/g,
    "$1",
  );
}

export function stripLessonCode(text) {
  return text
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, (block) =>
      block
        .split("\n")
        .map((line) => " ".repeat(line.length))
        .join("\n"),
    )
    .replace(/`[^`\n]+`/g, (span) => " ".repeat(span.length));
}

function sectionsOf(prose) {
  return [...prose.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((match) => ({
    heading: match[1].trim(),
    start: match.index,
    bodyStart: match.index + match[0].length,
  }));
}

export function checkLessonSpine(
  content,
  variant,
  { allowLegacyGuessLine = false, interactionLesson } = {},
) {
  if (
    interactionLesson?.activities?.some(
      (activity) => activity.kind === "interaction-path" || activity.kind === "primm",
    )
  ) {
    const issues = interactionLessonIssues({ ...interactionLesson, content });
    if (!Object.hasOwn(LESSON_VARIANTS, variant ?? ""))
      issues.push("Interaction lesson still needs one of the five content-led variants");
    return issues.map((message) => ({
      item: 1,
      message,
    }));
  }
  const problems = [];
  const fail = (item, message) => problems.push({ item, message });
  const prose = stripLessonCode(content ?? "");
  const sections = sectionsOf(prose);
  const headings = sections.map((section) => section.heading);
  const body = (name) => {
    const at = headings.indexOf(name);
    return at < 0 ? "" : prose.slice(sections[at].bodyStart, sections[at + 1]?.start).trim();
  };
  const shape = Object.hasOwn(LESSON_VARIANTS, variant ?? "") ? LESSON_VARIANTS[variant] : null;
  if (!shape) fail(1, `manifest variant 不是五种之一：${variant ?? "缺失"}`);
  const title = /^#[ \t]+(.+)$/m.exec(prose)?.[1]?.trim() ?? "";
  if (!/[？?]\s*$/.test(title)) fail(2, `标题不是问句（不以问号结尾）：${title || "缺 H1"}`);

  const spine = ["先猜一下", "答案", "自检", "一句话"];
  for (const name of spine) {
    const count = headings.filter((heading) => heading === name).length;
    if (count === 0) fail(3, `body is missing the "## ${name}" section`);
    else if (count !== 1) fail(3, `「${name}」出现了 ${count} 次，必须恰好 1 次`);
    else if (!body(name)) fail(3, `「${name}」没有正文`);
  }
  for (const name of ["学习目标", "先给结论", "一个类比", "工作示例", "重点"]) {
    if (headings.includes(name)) fail(6, `不使用旧骨架标题「${name}」`);
  }
  const [guessAt, answerAt, selfAt, endAt] = spine.map((name) => headings.indexOf(name));
  if (
    !(
      guessAt >= 0 &&
      answerAt === guessAt + 1 &&
      selfAt > answerAt &&
      endAt === selfAt + 1 &&
      endAt === headings.length - 1
    )
  ) {
    fail(3, "固定教学骨架顺序不对：先猜一下 → 答案 → 中段 → 自检 → 一句话（正文最后）");
  }
  if (shape && guessAt >= 0 && selfAt > answerAt && answerAt >= 0) {
    if (guessAt !== shape.openCount)
      fail(3, `${variant} 变体需要恰好 ${shape.openCount} 个开场章节，实际为 ${guessAt}`);
    const middle = headings.slice(answerAt + 1, selfAt).filter((heading) => heading !== "再想想");
    if (middle.length !== shape.middleCount)
      fail(3, `${variant} 变体需要 ${shape.middleCount} 个中段章节，实际为 ${middle.length}`);
    if (shape.boundary && middle.at(-1) !== shape.boundary)
      fail(5, `${variant} 变体必须以「## ${shape.boundary}」说明边界`);
  }
  const rethink = headings.flatMap((heading, index) => (heading === "再想想" ? [index] : []));
  if (
    rethink.length > 1 ||
    (rethink.length === 1 && !(rethink[0] === selfAt - 1 && rethink[0] > answerAt + 1))
  ) {
    fail(4, "「再想想」只能出现一次，放在全部中段之后、自检之前");
  }
  const guess = body("先猜一下");
  const invitation = "先写下你的判断，再往下看答案。";
  if (!guess.replace(invitation, "").replace("随便猜，猜错不影响任何进度。", "").trim()) {
    fail(7, "「先猜一下」缺少预测题正文，不能只有作答提示");
  }
  if (
    !guess.includes(invitation) &&
    !(allowLegacyGuessLine && guess.includes("随便猜，猜错不影响任何进度。"))
  ) {
    fail(7, `「先猜一下」里缺少低压力作答提示：${invitation}`);
  }
  if (/^[ \t]*(?:[-*][ \t]*)?[A-Da-d][.、)]/m.test(guess) || /选一个/.test(guess)) {
    fail(8, "预测题看起来是选择题；只提一个开放的核心判断，不列选项");
  }
  if (/(?:\*\*)?(?:参考答案|答案|答)(?:\*\*)?[：:]/m.test(body("自检"))) {
    fail(14, "「自检」里印了答案；自检只出题，独立练习另给判分反馈");
  }
  const links = [...prose.matchAll(/\[\[lesson:/g)];
  if (links.length > 3) fail(15, `跨课链接 ${links.length} 个，上限 3 个`);
  for (const link of links) {
    const section = sections.findLast((candidate) => candidate.start < link.index);
    if (section?.heading !== "再想想") fail(16, "正文跨课链接只能放在「再想想」里");
  }
  const closing = body("一句话");
  if (!/^\*\*[^\n]+\*\*$/.test(closing)) fail(21, "「一句话」不是单独一句加粗的话");
  else if ((closing.match(/[。！？]/g) ?? []).length > 1) fail(21, "「一句话」超过一句");
  return problems;
}

/** An external source needs a visible ordinary Markdown link, not a fake file range. */
export function checkLessonUrlEvidence(content, evidence) {
  const prose = stripLessonCode(content ?? "");
  return (evidence ?? []).flatMap((citation) => {
    const url = citation.sourceUrl;
    if (!url) return [];
    // Match the known URL, rather than stopping at the first ')' inside it.
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const inline = new RegExp(
      "\\[[^\\]\\n]+\\]\\((?:" + escaped + "|<" + escaped + '>)(?:\\s+"[^"\\n]*")?\\)',
    );
    return inline.test(prose) || prose.includes(`<${url}>`)
      ? []
      : [`URL引用没有正文可点击出处：${url}`];
  });
}
