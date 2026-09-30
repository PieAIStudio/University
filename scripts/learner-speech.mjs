/** V7 G2 / author-speech release boundary. This checks visible message VALUES,
 * not the legacy lookup keys, comments, authored computer-science examples or
 * arbitrary occurrences of the useful words “comparison” and “decision”. */
export function learnerSpeechViolations(messages, location = "interface") {
  const violations = [];
  for (const [key, text] of Object.entries(messages)) {
    if (typeof text !== "string") continue;
    // Explicit author-workbench/lab messages remain available in their own tools.
    if (/^(?:app\.authoring\.|ui\.authoring\.|propFinish\.|play\.lab\.|doors\.lab\.)/.test(key))
      continue;
    for (const [rule, pattern] of [
      [
        "author-note",
        /(?:作者备注|写给作者看的|开发者备注|设计师备注|原型验收备注|\[(?:AUTHOR|DEV)[ _-]?NOTE\]|author[- ]only note|developer note:)/i,
      ],
      [
        "layout-explanation",
        /(?:没有先后的就平铺|没有先后.{0,8}平铺列出|no set order, so they are listed flat|without an order are laid out side by side)/i,
      ],
      [
        "implementation-name",
        /(?:\b(?:className|data-testid)\s*=|\b(?:CourseView|LessonMarkerField|IslandBlueprint|SceneLabelText)\b)/,
      ],
      ["account-name", /帐户/],
      [
        "lesson-name",
        /小节关卡|学完[一二三四五六七八九十\d]+节|(?:[上下这那每]一?|最后一)节(?![奏约省点]|车厢|活动)|[一二三四五六七八九十]节新课|(?<![字细调音章季])节课|第\s*(?:[一二三四五六七八九十百千万零\d]+|\{[^}]+\})\s*节|\}\s*节(?![奏约省点])|^[\s\d]*节(?:$|\s*[\/·])/,
      ],
    ]) {
      // This is authored appointment-example content: a class booked on a
      // calendar, not a University level. Keep that exact real-world wording.
      if (
        rule === "lesson-name" &&
        key === "play.aiQuality.eval.schedule.information.absent" &&
        text === "想约一节课，但没有日期"
      )
        continue;
      if (pattern.test(text)) violations.push({ location, key, rule, text });
    }
  }
  return violations;
}

/** Published lessons may teach code and discuss real-world classes. Only
 * explicit author notes/layout instructions are rejected in their authored
 * prose; interface-only terminology rules must not rewrite the curriculum. */
export function publishedAuthorSpeechViolations(value, location = "content") {
  const violations = [];
  const visit = (current, at) => {
    if (typeof current === "string") {
      violations.push(
        ...learnerSpeechViolations({ value: current }, at).filter(
          (entry) => entry.rule === "author-note" || entry.rule === "layout-explanation",
        ),
      );
    } else if (Array.isArray(current))
      current.forEach((item, index) => visit(item, `${at}[${index}]`));
    else if (current && typeof current === "object")
      for (const [key, child] of Object.entries(current)) visit(child, `${at}.${key}`);
  };
  visit(value, location);
  return violations;
}

export function assertLearnerSpeech(messages, location) {
  const violations = learnerSpeechViolations(messages, location);
  if (violations.length)
    throw new Error(
      `Learner copy gate rejected ${violations.length} value(s):\n${violations.map((entry) => `${entry.location}:${entry.key} [${entry.rule}] ${entry.text}`).join("\n")}`,
    );
}
