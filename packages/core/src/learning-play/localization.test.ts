import { describe, expect, it } from "vitest";
import { primmStepsFixture } from "./fixtures/primm-steps.js";
import {
  activityDisplayStrings,
  activityTranslationIssues,
  localizeActivity,
} from "./localization.js";

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
});

const v3Activity = structuredClone(primmStepsFixture);

describe("activity translation preserves the actual V3 task", () => {
  it("translates nested step labels without changing ids or actions", () => {
    const translated = localizeActivity(v3Activity, "en-US");
    expect(translated.id).toBe(v3Activity.id);
    const first = translated.steps[0];
    expect(first?.title).toMatch(/^You want to know/);
    expect(first?.kind).toBe("choose");
    if (first?.kind === "choose") expect(first.options[0]?.id).toBe("vague");
    expect(translated.requests?.[0]?.id).toBe(v3Activity.requests?.[0]?.id);
  });
  it("leaves the authored Chinese activity intact", () => {
    expect(localizeActivity(v3Activity, "zh-CN")).toBe(v3Activity);
  });
  it("reports a translation key that is not display text", () => {
    const candidate = { ...v3Activity, locales: { en: { strings: { inventedId: "wrong" } } } };
    expect(activityTranslationIssues(candidate)).toContainEqual(
      expect.stringContaining("inventedId"),
    );
    expect(() => localizeActivity(candidate, "en")).toThrow();
  });
  it("keeps every display string in the authored translation inventory", () => {
    const strings = activityDisplayStrings(v3Activity);
    expect(strings).toContain(v3Activity.steps[0]!.title);
    const findStep = v3Activity.steps.find(
      (step): step is Extract<(typeof v3Activity.steps)[number], { kind: "find" }> =>
        step.kind === "find",
    );
    expect(findStep?.title).toBeDefined();
    expect(strings).toContain(findStep!.title);
    expect(activityTranslationIssues(v3Activity)).toEqual([]);
  });
});
