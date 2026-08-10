import { describe, expect, it } from "vitest";

import type { LexiconEntry } from "../../src/domain/schemas.js";
import { adaptiveTargetCount, detectAnchors, type VocabularyStage } from "./detect.js";
import { resolveAnchors } from "./resolve-anchors.js";

function sense(senseId: string, headword: string): LexiconEntry {
  return {
    senseId,
    headword,
    phonetic: "/x/",
    partOfSpeech: "noun",
    gloss: `${headword} 的意思`,
    usage: `${headword} 的用法`,
    track: "technical",
  };
}

const LEXICON = [
  sense("file.fs", "file"),
  sense("load.fs", "load"),
  sense("open.fs", "open"),
  sense("run.proc", "run"),
  sense("commit.git", "commit"),
];

const noStages = new Map<string, VocabularyStage>();

describe("detecting vocabulary from the lesson itself", () => {
  it("finds a headword in prose and quotes the source casing", () => {
    const found = detectAnchors("先把 File 读进来。", LEXICON, {
      stages: noStages,
      targetCount: 5,
    });

    expect(found).toHaveLength(1);
    expect(found[0]!.anchor.quote).toBe("File");
    expect(found[0]!.anchor.senseId).toBe("file.fs");
  });

  it("matches plural and participle forms without a stemmer", () => {
    const content = "这些 files 会被 loaded，然后 running。";
    const ids = detectAnchors(content, LEXICON, { stages: noStages, targetCount: 5 }).map(
      (item) => item.anchor.senseId,
    );

    expect(ids).toContain("file.fs");
    expect(ids).toContain("load.fs");
    expect(ids).toContain("run.proc");
  });

  it("never matches a headword inside a longer word", () => {
    const found = detectAnchors("看 profile 和 filename 两个词。", LEXICON, {
      stages: noStages,
      targetCount: 5,
    });

    expect(found).toHaveLength(0);
  });

  it("ignores words that only appear inside code", () => {
    const content = [
      "这一段讲配置。",
      "",
      "```ts",
      "const file = open(path);",
      "```",
      "",
      "行内的 `load` 也是代码。",
      "链接 [x](https://example.com/run) 也是。",
      '标签 <input value="commit"> 也是。',
    ].join("\n");

    expect(detectAnchors(content, LEXICON, { stages: noStages, targetCount: 5 })).toHaveLength(0);
  });

  it("drops a sense the learner paused, and keeps one they are learning", () => {
    const stages = new Map<string, VocabularyStage>([
      ["file.fs", "paused"],
      ["load.fs", "learning"],
    ]);
    const found = detectAnchors("先 file 再 load。", LEXICON, { stages, targetCount: 5 });

    expect(found.map((item) => item.anchor.senseId)).toEqual(["load.fs"]);
    expect(found[0]!.reason).toBe("learning");
  });

  it("spends a tight budget on unseen words before familiar ones", () => {
    const stages = new Map<string, VocabularyStage>([
      ["file.fs", "familiar"],
      ["load.fs", "learning"],
    ]);
    // `file` comes first in the text but last in priority.
    const found = detectAnchors("file, load, open 三个词。", LEXICON, {
      stages,
      targetCount: 2,
    });

    expect(found.map((item) => item.anchor.senseId).toSorted()).toEqual(["load.fs", "open.fs"]);
  });

  it("puts due learning words ahead of new words", () => {
    const stages = new Map<string, VocabularyStage>([["run.proc", "learning"]]);
    const found = detectAnchors("file, load, run 三个词。", LEXICON, {
      stages,
      targetCount: 2,
    });

    expect(found.map((item) => item.anchor.senseId)).toEqual(["file.fs", "run.proc"]);
  });

  it("can close the new-word gate while retaining learning words", () => {
    const stages = new Map<string, VocabularyStage>([["run.proc", "learning"]]);
    const found = detectAnchors("file, load, run 三个词。", LEXICON, {
      stages,
      targetCount: 5,
      allowNew: false,
    });

    expect(found.map((item) => item.anchor.senseId)).toEqual(["run.proc"]);
  });

  it("introduces at most one new word per Markdown section", () => {
    const found = detectAnchors(
      "## 第一节\n\nfile 和 load。\n\n## 第二节\n\nopen 和 run。",
      LEXICON,
      { stages: noStages, targetCount: 5 },
    );

    expect(found.filter((item) => item.reason === "new")).toHaveLength(2);
  });

  it("still surfaces familiar words when there is room, marked as familiar", () => {
    const stages = new Map<string, VocabularyStage>([["file.fs", "familiar"]]);
    const found = detectAnchors("file 和 load。", LEXICON, { stages, targetCount: 5 });
    const file = found.find((item) => item.anchor.senseId === "file.fs");

    expect(file?.reason).toBe("familiar");
  });

  it("returns anchors in reading order even when ranking reordered them", () => {
    const stages = new Map<string, VocabularyStage>([["file.fs", "familiar"]]);
    const found = detectAnchors("file 在前，load 在后。", LEXICON, {
      stages,
      targetCount: 5,
    });

    expect(found.map((item) => item.anchor.senseId)).toEqual(["file.fs", "load.fs"]);
  });

  it("respects the budget", () => {
    const found = detectAnchors("file load open run commit 全在这里。", LEXICON, {
      stages: noStages,
      targetCount: 2,
    });

    expect(found).toHaveLength(2);
  });

  it("annotates each sense once, at its first prose occurrence", () => {
    const found = detectAnchors("file 出现，然后 file 又出现，再 file。", LEXICON, {
      stages: noStages,
      targetCount: 5,
    });

    expect(found).toHaveLength(1);
    expect(found[0]!.anchor.occurrence).toBe(1);
  });

  it("counts the occurrence past earlier hits that were inside code", () => {
    // The resolver counts every literal hit, code or not, so the occurrence
    // number has to be counted the same way or the anchor lands on the copy
    // inside the fence.
    const content = ["```ts", "const file = 1;", "```", "", "正文里的 file。"].join("\n");
    const found = detectAnchors(content, [sense("file.fs", "file")], {
      stages: noStages,
      targetCount: 5,
    });

    expect(found[0]!.anchor.occurrence).toBe(2);
  });

  it("produces anchors the resolver accepts — every one of them", () => {
    // The contract that matters. A detector that agrees with itself but not
    // with `resolveAnchors` produces a layer that silently renders nothing.
    const content = [
      "# 一节课",
      "",
      "先把 Files 读进来，再 load 一次，最后 open 它。",
      "",
      "```ts",
      "const commit = run();",
      "```",
      "",
      "正文里再说一次 run。",
    ].join("\n");
    const found = detectAnchors(content, LEXICON, { stages: noStages, targetCount: 10 });
    const { resolved, unresolved } = resolveAnchors(
      content,
      found.map((item) => item.anchor),
    );

    expect(found.length).toBeGreaterThan(0);
    expect(unresolved).toEqual([]);
    expect(resolved).toHaveLength(found.length);
    for (const item of resolved) {
      expect(content.slice(item.start, item.end)).toBe(item.anchor.quote);
    }
  });

  /**
   * `[[evidence:…]]` / `[[lesson:…]]` are markup tokens, not prose. Matching a
   * lexicon headword inside one rewrites the token before the evidence or
   * lesson resolvers can parse it — the foreign-language layer then shows the
   * broken literal (`[[evidence（evidence）:readme（README）.md:1-4]]`) instead
   * of a clickable reference.
   */
  it("never annotates a headword that only lives inside an evidence token", () => {
    const content = "先看 [[evidence:readme.md:1-4]] 这段说明。";
    const lexicon = [sense("evidence.study", "evidence"), sense("readme.doc", "readme")];
    const found = detectAnchors(content, lexicon, { stages: noStages, targetCount: 10 });
    const tokenStart = content.indexOf("[[evidence:readme.md:1-4]]");
    const tokenEnd = tokenStart + "[[evidence:readme.md:1-4]]".length;
    const { resolved } = resolveAnchors(
      content,
      found.map((item) => item.anchor),
    );

    expect(found).toHaveLength(0);
    for (const item of resolved) {
      expect(item.start < tokenEnd && item.end > tokenStart).toBe(false);
    }
  });

  it("never annotates a headword that only lives inside a lesson token", () => {
    // Bare id, qualified path, and label — any of them can hold a headword.
    const content = "延伸阅读 [[lesson:load-files|open the file]]。";
    const lexicon = [
      sense("lesson.course", "lesson"),
      sense("load.fs", "load"),
      sense("open.fs", "open"),
      sense("file.fs", "file"),
    ];
    const found = detectAnchors(content, lexicon, { stages: noStages, targetCount: 10 });
    const token = "[[lesson:load-files|open the file]]";
    const tokenStart = content.indexOf(token);
    const tokenEnd = tokenStart + token.length;
    const { resolved } = resolveAnchors(
      content,
      found.map((item) => item.anchor),
    );

    expect(found).toHaveLength(0);
    for (const item of resolved) {
      expect(item.start < tokenEnd && item.end > tokenStart).toBe(false);
    }
  });

  it("still annotates the same headword when it appears in real prose next to a token", () => {
    const content = "先看 [[evidence:readme.md:1-4]]，再 load 一次。";
    const lexicon = [sense("readme.doc", "readme"), sense("load.fs", "load")];
    const found = detectAnchors(content, lexicon, { stages: noStages, targetCount: 10 });

    expect(found.map((item) => item.anchor.senseId)).toEqual(["load.fs"]);
    expect(found[0]!.anchor.quote).toBe("load");
  });
});

describe("how many words a learner gets", () => {
  it("starts small, because an unreadable page teaches nothing", () => {
    expect(adaptiveTargetCount(0)).toBe(2);
  });

  it("never decreases as the learner retires more words", () => {
    let previous = 0;
    for (let known = 0; known <= 300; known += 1) {
      const target = adaptiveTargetCount(known);
      expect(target).toBeGreaterThanOrEqual(previous);
      previous = target;
    }
  });

  it("saturates rather than growing without bound", () => {
    expect(adaptiveTargetCount(10_000)).toBe(adaptiveTargetCount(200));
    expect(adaptiveTargetCount(10_000)).toBeLessThanOrEqual(2);
  });
});
