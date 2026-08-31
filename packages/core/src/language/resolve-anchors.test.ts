import { describe, expect, it } from "vitest";

import { proseQuote, resolveAnchors, segmentContent } from "./resolve-anchors.js";

const anchor = (quote: string, occurrence = 1, senseId = "snapshot.git") => ({
  quote,
  occurrence,
  senseId,
});

describe("resolveAnchors", () => {
  it("finds the occurrence the author chose, not the first one", () => {
    const content = "快照是一份副本。第二次说快照时讲的是别的。";
    const { resolved } = resolveAnchors(content, [anchor("快照", 2)]);
    expect(resolved).toHaveLength(1);
    expect(content.slice(resolved[0]!.start, resolved[0]!.end)).toBe("快照");
    expect(resolved[0]!.start).toBe(content.indexOf("快照", 1));
  });

  it("reports an occurrence that does not exist instead of guessing", () => {
    const { resolved, unresolved } = resolveAnchors("只出现一次快照", [anchor("快照", 2)]);
    expect(resolved).toEqual([]);
    expect(unresolved[0]?.reason).toBe("occurrence-missing");
  });

  it("reports a quote the lesson no longer contains", () => {
    const { unresolved } = resolveAnchors("这里没有那个词", [anchor("快照")]);
    expect(unresolved[0]?.reason).toBe("not-found");
  });

  /**
   * Replacing text inside code changes what the code does. A lesson that cites
   * `快照` in prose and also shows it in a command must annotate only the prose.
   */
  it("refuses to touch a fenced code block", () => {
    const content = ["讲解在这里。", "", "```bash", "echo 快照", "```", ""].join("\n");
    const { resolved, unresolved } = resolveAnchors(content, [anchor("快照")]);
    expect(resolved).toEqual([]);
    expect(unresolved[0]?.reason).toBe("inside-code");
  });

  it("refuses to touch inline code", () => {
    const { unresolved } = resolveAnchors("命令是 `快照` 这个词。", [anchor("快照")]);
    expect(unresolved[0]?.reason).toBe("inside-code");
  });

  it("refuses to touch a link target", () => {
    const { unresolved } = resolveAnchors("见 [文档](docs/快照.md) 一节。", [anchor("快照")]);
    expect(unresolved[0]?.reason).toBe("inside-code");
  });

  it("annotates prose even when the same word also appears in code", () => {
    const content = ["快照是一份副本。", "", "```bash", "echo 快照", "```"].join("\n");
    const { resolved } = resolveAnchors(content, [anchor("快照", 1)]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.start).toBe(0);
  });

  /**
   * Two anchors claiming the same characters cannot both render. Dropping the
   * later one keeps the output from depending on array order.
   */
  it("drops an anchor that overlaps one already placed", () => {
    const { resolved, unresolved } = resolveAnchors("不可变快照很重要", [
      anchor("不可变快照", 1, "snapshot.git"),
      anchor("快照", 1, "snapshot.other"),
    ]);
    expect(resolved).toHaveLength(1);
    expect(unresolved[0]?.reason).toBe("overlaps");
  });

  it("returns anchors in document order however they were listed", () => {
    const content = "先说 A，再说 B。";
    const { resolved } = resolveAnchors(content, [
      anchor("B", 1, "b.sense"),
      anchor("A", 1, "a.sense"),
    ]);
    expect(resolved.map((item) => item.anchor.senseId)).toEqual(["a.sense", "b.sense"]);
  });
});

describe("segmentContent", () => {
  it("reassembles to exactly the lesson it was given", () => {
    const content = "快照是一份副本，证据钉在提交上。";
    const { resolved } = resolveAnchors(content, [
      anchor("快照", 1, "snapshot.git"),
      anchor("证据", 1, "evidence.study"),
    ]);
    const segments = segmentContent(content, resolved);
    expect(segments.map((segment) => segment.text).join("")).toBe(content);
    expect(segments.filter((segment) => segment.senseId !== null)).toHaveLength(2);
  });

  it("leaves an unannotated lesson as one plain stretch", () => {
    const segments = segmentContent("没有标注的课文", []);
    expect(segments).toEqual([{ text: "没有标注的课文", senseId: null }]);
  });

  it("keeps an anchor at the very start and very end intact", () => {
    const content = "快照";
    const { resolved } = resolveAnchors(content, [anchor("快照")]);
    expect(segmentContent(content, resolved)).toEqual([{ text: "快照", senseId: "snapshot.git" }]);
  });
});

describe("proseQuote", () => {
  it("drops a bare wiki token but keeps the sentence around it", () => {
    expect(
      proseQuote("这一段说明为什么。[[evidence:/assets/game/ui/clay/asset-manifest.json:1-20]]"),
    ).toBe("这一段说明为什么。");
  });

  it("keeps the half of a labelled token that was written to be read", () => {
    expect(proseQuote("先看 [[lesson:foo|这一节]] 再回来。")).toBe("先看 这一节 再回来。");
  });

  it("returns nothing when the line was only an address", () => {
    // The caller has to notice this: quoting an empty string at the moment a
    // learner missed is worse than saying nothing specific.
    expect(proseQuote("[[evidence:/assets/game/ui/clay/asset-manifest.json:1-20]]")).toBe("");
  });

  it("drops emphasis, code ticks and a directive marker", () => {
    expect(proseQuote("**加粗** 和 `代码`")).toBe("加粗 和 代码");
    expect(proseQuote("::: detail 标题")).toBe("");
  });
});
