import { describe, expect, it } from "vitest";

import { ANTI_PATTERN_NOTICE } from "../domain/anti-pattern.js";
import { antiPatternEntryToMarkdown } from "../domain/anti-pattern.js";
import { ANTI_PATTERN_COUNTS, ANTI_PATTERN_ENTRIES, getAntiPatternEntry } from "./catalog.js";

const REQUIRED_TYPES = ["plain", "before-after", "when-not", "agent-prompt"] as const;

describe("anti-pattern catalogue", () => {
  it("is the 25 F-group entries, split 11 / 8 / 6", () => {
    expect(ANTI_PATTERN_ENTRIES).toHaveLength(25);
    expect(ANTI_PATTERN_ENTRIES.map((entry) => entry.head.name)).toEqual([
      "稳稳接住",
      "单字动作",
      "什么都要加双引号",
      "动不动就来个夸张比喻",
      "提升立意",
      "满口砍一刀、收口、闭环",
      "动不动就夸你抓住本质",
      "不是 X，而是 Y",
      "先说结论的套话",
      "每句话都拆成分点",
      "如果你愿意",
      "居中大标题",
      "三张等宽卡片",
      "蓝紫渐变光球",
      "框里再套框",
      "每段都画分割线",
      "左边都要加一条竖线",
      "又大又黑又挤",
      "Emoji 当图标",
      "每块都要飞进来",
      "手机端一路堆到底",
      "到处补说明",
      "同一操作换着叫",
      "按钮只是摆设",
      "只放图标，不写名字",
    ]);
    expect(ANTI_PATTERN_COUNTS).toEqual({ verbal: 11, template: 8, interaction: 6 });
    expect(ANTI_PATTERN_ENTRIES.filter((entry) => entry.head.category === "verbal")).toHaveLength(
      11,
    );
    expect(ANTI_PATTERN_ENTRIES.filter((entry) => entry.head.category === "template")).toHaveLength(
      8,
    );
    expect(
      ANTI_PATTERN_ENTRIES.filter((entry) => entry.head.category === "interaction"),
    ).toHaveLength(6);
  });

  it("gives every entry a unique id and the four required sections", () => {
    const ids = ANTI_PATTERN_ENTRIES.map((entry) => entry.head.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ANTI_PATTERN_ENTRIES) {
      expect(entry.collection).toBe("anti-patterns");
      const types = entry.sections.map((section) => section.type);
      for (const required of REQUIRED_TYPES) {
        expect(types).toContain(required);
      }
      expect(entry.head.complaint.length).toBeGreaterThan(0);
      expect(getAntiPatternEntry(entry.head.id)).toBe(entry);
    }
  });

  it("keeps the epistemic notice out of the entries so the index owns it", () => {
    for (const entry of ANTI_PATTERN_ENTRIES) {
      expect(antiPatternEntryToMarkdown(entry)).not.toContain(ANTI_PATTERN_NOTICE);
    }
  });

  it("does not ship VibeHub's invented product names", () => {
    const banned = ["MeetFlow", "Nimbus", "林夏"];
    const blob = ANTI_PATTERN_ENTRIES.map((entry) => antiPatternEntryToMarkdown(entry)).join("\n");
    for (const name of banned) {
      expect(blob).not.toContain(name);
    }
  });
});
