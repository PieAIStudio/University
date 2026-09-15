import { describe, expect, it } from "vitest";
import { contrastCaseAgrees } from "./contrast.js";
import { activityTranslationIssues, localizeActivity } from "./localization.js";
import type { LearningActivitySpec } from "./types.js";

const activity = {
  id: "same-identity",
  kind: "sort",
  title: "分类",
  brief: "把材料分开",
  goal: "辨认来源",
  takeaway: "找得到依据再填写。",
  hint: "看具体字段",
  question: "依据在哪里？",
  source: { label: "原始材料", url: "https://www.nasa.gov/" },
  buckets: [
    { id: "fact", label: "明确写出", note: "保留原文事实" },
    { id: "gap", label: "未说明", note: "不要猜" },
  ],
  items: [{ id: "date", label: "日期", detail: "记录写了日期", bucketId: "fact", why: "可以核对" }],
  locales: {
    en: {
      title: "Sort the material",
      strings: {
        "依据在哪里？": "Where is the support?",
        明确写出: "Stated",
        未说明: "Not stated",
        日期: "Date",
        记录写了日期: "The record gives a date",
        可以核对: "You can check it",
      },
    },
  },
} as const;

describe("activity translation preserves the actual task", () => {
  it("translates inner labels and feedback without changing ids or solutions", () => {
    const translated = localizeActivity(activity, "en-US");
    expect(translated.id).toBe(activity.id);
    expect(translated.items[0]).toMatchObject({
      id: "date",
      bucketId: "fact",
      label: "Date",
      why: "You can check it",
    });
    expect(translated.question).toBe("Where is the support?");
    expect(translated.source.url).toBe(activity.source.url);
    expect(activity.items[0].label).toBe("日期");
  });
  it("leaves untranslated originals intact", () => {
    expect(localizeActivity(activity, "zh-CN")).toBe(activity);
  });
  it("does not translate identifiers even when they look like display strings", () => {
    const candidate = { ...activity, locales: { en: { strings: { fact: "not-a-rule-id" } } } };
    expect(activityTranslationIssues(candidate)).toContainEqual(expect.stringContaining("fact"));
    expect(() => localizeActivity(candidate, "en")).toThrow();
  });
  it("rejects translations that collapse different contrast outcomes", () => {
    const contrast = {
      ...activity,
      kind: "contrast",
      approaches: [
        { id: "left", label: "甲", note: "甲方法" },
        { id: "right", label: "乙", note: "乙方法" },
      ],
      cases: [
        {
          id: "different",
          label: "换条件",
          detail: "比较结果",
          outcomes: { left: "未说明", right: "已证实" },
          why: "结论不同",
        },
      ],
      locales: { en: { strings: { 未说明: "Same", 已证实: "Same" } } },
    } as unknown as LearningActivitySpec;
    expect(activityTranslationIssues(contrast)).toContainEqual(expect.stringContaining("outcome"));
    expect(() => localizeActivity(contrast, "en")).toThrow();
  });
  it("preserves genuine contrast equality and differences", () => {
    const contrast = {
      ...activity,
      kind: "contrast",
      approaches: [
        { id: "left", label: "甲", note: "甲方法" },
        { id: "right", label: "乙", note: "乙方法" },
      ],
      cases: [
        {
          id: "different",
          label: "换条件",
          detail: "比较结果",
          outcomes: { left: "未说明", right: "已证实" },
          why: "结论不同",
        },
      ],
      locales: { en: { strings: { 未说明: "Not stated", 已证实: "Confirmed" } } },
    } as const;
    const translated = localizeActivity(contrast, "en");
    expect(contrastCaseAgrees(translated, translated.cases[0])).toBe(false);
    expect(translated.cases[0].outcomes.right).toBe("Confirmed");
  });
});
