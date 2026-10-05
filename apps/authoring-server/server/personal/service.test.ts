import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStudyWithSource } from "../workflows/create-study.js";
import { createCourse } from "../workflows/create-course.js";
import * as nativeCourse from "../workflows/create-course.js";
import { PersonalLessonService, type PersonalGeneration } from "./service.js";
import { PersonalDraftSchema } from "./contracts.js";

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const evidence = {
  kind: "fact",
  sourceUrl:
    "https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt",
  sourceTitle: "Prompting guidance",
  sourceAuthority: "official-docs",
};

function locale(english = false) {
  const text = english
    ? "Keep the meeting time and place when shortening the notice."
    : "把通知变成简短提醒时，保留见面的时间和地点。";
  const practiceText = english
    ? "We meet at the library at 3 pm on Saturday. Bring a notebook."
    : "周六下午三点在图书馆集合，请带一本笔记本。周末来一起读书。";
  const makeText = english
    ? "Meet at the park at 9 am on Sunday. Bring water for the walk."
    : "周日早上九点在公园集合，请带水。我们一起散步，不用报名。";
  return {
    title: english ? "Write a useful reminder" : "把活动通知整理成提醒",
    connection: text,
    situation: text,
    need: text,
    prompt: english ? "Turn the notice into a short reminder." : "请把通知整理成一条简短提醒。",
    practiceText,
    makeText,
    investigateExplanation: text,
    investigateCards: [
      { text: english ? "Saturday" : "周六", bucket: "grounded", why: text },
      { text: english ? "Sunday" : "周日", bucket: "check", why: text },
      { text: english ? "Library" : "图书馆", bucket: "grounded", why: text },
      { text: english ? "Park" : "公园", bucket: "check", why: text },
    ],
    modifyGoal: text,
    makeScenario: text,
    makeGoal: text,
    checklist: [text, english ? "Do not invent an address." : "不要补写没有给出的地址。"],
    exerciseTitle: english ? "Your reminder" : "你的提醒",
    exercisePrompt: text,
    rubric: [text, english ? "Do not change the facts." : "不改变材料中的事实。"],
    cardFront: english ? "What should a reminder retain?" : "整理提醒时要保留什么？",
    cardBack: text,
  };
}
const output = (): PersonalGeneration => ({
  draft: { covered: true, sourceIndex: 0, zh: locale(), en: locale(true) },
  review: {
    writer: "fixture-writer",
    detector: "fixture-detector",
    polisher: "fixture-polisher",
    passed: true,
  },
});

function setup(generate: (input: any) => Promise<PersonalGeneration> = async () => output()) {
  const root = mkdtempSync(join(tmpdir(), "map-personal-tests-"));
  roots.push(root);
  const corpusRoot = join(root, "corpus");
  createStudyWithSource({ studiesRoot: corpusRoot, id: "source-study", title: "Test corpus" });
  createCourse({
    studiesRoot: corpusRoot,
    studyId: "source-study",
    proposal: {
      schemaVersion: 1,
      proposalId: "test-corpus",
      course: {
        id: "source-course",
        title: "Test course",
        description: "Test source",
        audience: "Adults",
        objectives: ["Use a clear request"],
        units: [
          {
            id: "source-unit",
            title: "Requests",
            objective: "Keep facts",
            lessons: [
              {
                id: "source-lesson",
                title: "A clear request",
                content: "# A clear request\n\nKeep time and place.\n\n::play{#fixture-play}\n",
                evidence: [evidence],
                activities: [
                  {
                    id: "fixture-play",
                    kind: "sort",
                    role: "apply",
                    difficulty: "intro",
                    title: "Compare",
                    brief: "Sort",
                    goal: "Keep facts",
                    takeaway: "Read the material",
                    hint: "Look again",
                    source: { label: "Guide", url: evidence.sourceUrl },
                    question: "Which is a time?",
                    buckets: [
                      { id: "time", label: "Time" },
                      { id: "place", label: "Place" },
                    ],
                    cards: [
                      { id: "one", text: "3 pm", bucket: "time", explanation: "An hour" },
                      { id: "two", text: "Library", bucket: "place", explanation: "A place" },
                    ],
                  },
                ],
                cards: [
                  {
                    id: "source-card",
                    front: "What matters?",
                    back: "Time and place.",
                    evidence: [evidence],
                  },
                ],
                exercises: [
                  {
                    id: "source-test",
                    title: "Recall",
                    prompt: "Name one thing",
                    expectedAnswer: "time",
                    evidence: [evidence],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });
  const service = new PersonalLessonService({
    projectRoot: root,
    scratchRoot: join(root, ".scratch/private"),
    corpusRoot,
    generate,
  });
  const input = {
    commandId: randomUUID(),
    accountScope: "guest-test-user",
    goal: "帮我整理一个活动通知，不要漏掉时间和地点",
    locale: "zh-CN",
    scope: {
      studyId: "source-study",
      courseId: "source-course",
      unitId: "source-unit",
      lessonIds: ["source-lesson"],
    },
  };
  return { service, input };
}

describe("native private lesson lifecycle", () => {
  it("creates a native interactive lesson, not a renamed public lesson; preserves revision and review body", async () => {
    const writer = vi.fn(async () => output());
    const { service, input } = setup(writer);
    const record = await service.create(input, new AbortController().signal);
    expect(record.locator.studyId).toBe("personal-learning");
    expect(record.locator.courseId).toBe(`task-${record.contentId}`);
    const view = service.lessonView(record.contentId, input.accountScope) as any;
    expect(view.lesson.activities[0].kind).toBe("primm");
    expect(view.lesson.activities[0].starter.materialIds).toEqual(["practice-material"]);
    expect(view.lesson.activities[0].make.materialIds).toEqual(["make-material"]);
    expect(service.card(record.contentId, input.accountScope).back).toBe(locale().cardBack);
    expect(await service.create(input, new AbortController().signal)).toEqual(record);
    expect(writer).toHaveBeenCalledTimes(1);
    const second = await service.create(
      { ...input, commandId: randomUUID() },
      new AbortController().signal,
    );
    expect(second.locator.courseId).not.toBe(record.locator.courseId);
    expect(service.list(input.accountScope)).toHaveLength(2);
    expect(service.list("guest-other")).toEqual([]);
    expect(() => service.get(record.contentId, "guest-other")).toThrow();
    expect(() => service.get("../../file", input.accountScope)).toThrow();
    await expect(
      service.create(
        { ...input, goal: "另一个目标，但是使用相同的请求编号" },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(() => service.complete(record.contentId, input.accountScope, randomUUID())).toThrow();
    service.recordPassedMake(record.contentId, input.accountScope, randomUUID(), 1);
    const completionId = randomUUID();
    expect(service.complete(record.contentId, input.accountScope, completionId)).toEqual(
      service.complete(record.contentId, input.accountScope, completionId),
    );
  });
  it("does not publish unsupported, cancelled or unreviewed work", async () => {
    const { service, input } = setup(async () => ({
      ...output(),
      draft: { covered: false, unsupportedReason: "现有资料不支持这个需要" },
    }));
    await expect(service.create(input, new AbortController().signal)).rejects.toThrow("不支持");
    expect(service.list(input.accountScope)).toEqual([]);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      service.create({ ...input, commandId: randomUUID() }, cancelled.signal),
    ).rejects.toThrow("取消");
    const unreviewed = setup(async () => ({
      ...output(),
      review: { writer: "", detector: "", polisher: "", passed: true },
    }));
    await expect(
      unreviewed.service.create(unreviewed.input, new AbortController().signal),
    ).rejects.toThrow("审查");
  });
  it("rejects malformed model drafts before the native writer sees them", () => {
    expect(
      PersonalDraftSchema.safeParse({ ...(output().draft as object), extra: "script" }).success,
    ).toBe(false);
  });
  it("can retry the same command after a native write fails, without exposing half a lesson", async () => {
    const { service, input } = setup();
    vi.spyOn(nativeCourse, "createCourse").mockImplementationOnce(() => {
      throw new Error("disk interruption");
    });
    await expect(service.create(input, new AbortController().signal)).rejects.toThrow(
      "disk interruption",
    );
    expect(service.list(input.accountScope)).toEqual([]);
    const record = await service.create(input, new AbortController().signal);
    expect(record.root).not.toContain(".pending");
    expect(service.list(input.accountScope)).toHaveLength(1);
    expect((service.lessonView(record.contentId, input.accountScope) as any).lesson.id).toBe(
      "practice",
    );
  });
  it("rejects changed bilingual classifications before exposing a lesson", async () => {
    const draft = output().draft as any;
    draft.en.investigateCards[0].bucket = "check";
    const { service, input } = setup(async () => ({ ...output(), draft }));
    await expect(service.create(input, new AbortController().signal)).rejects.toThrow("判断不一致");
    expect(service.list(input.accountScope)).toEqual([]);
  });
});
