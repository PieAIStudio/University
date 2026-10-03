import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import { PrimmPayloadSchema } from "@pieai/university-core/domain/schemas.js";
import { primmIssues } from "@pieai/university-core";
import * as pipeline from "./primm-pipeline.mjs";
import { schemas, draftActivity, lintDraft, displayMap, polishIssues } from "./primm-pipeline.mjs";
import {
  isStructuralStepPath,
  realWorldPlanSchema,
  renderStepLesson,
  stepAuthoringShape,
  stepModifyPrompt,
  stepSampleRequests,
  stepTeachingIssues,
} from "./primm-pipeline-step-support.mjs";

vi.mock("node:child_process", async (original) => ({
  ...(await original()),
  spawn: vi.fn(),
}));

describe("model failure receipts", () => {
  it.each([
    { parsed: false, message: /quota exhausted/ },
    { parsed: true, message: /structured result survived/ },
  ])(
    "stops on exhausted credits without a duplicate call (parsed=$parsed)",
    async ({ parsed, message }) => {
      const dir = mkdtempSync(join(tmpdir(), "primm-failure-"));
      const stderr = "AGY_ERROR: RESOURCE_EXHAUSTED (code 429): Resource has been exhausted.";
      vi.mocked(spawn).mockImplementationOnce(() => {
        const child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        child.kill = vi.fn();
        queueMicrotask(() => {
          child.stdout.end(
            JSON.stringify(
              parsed
                ? { status: "SUCCESS", structured_output: { retained: true } }
                : { status: "ERROR" },
            ),
          );
          child.stderr.end(stderr);
          child.emit("close", 3, null);
        });
        return child;
      });
      try {
        await expect(
          pipeline.callModel("detector", "Synthetic failure fixture", {}, join(dir, "attempt")),
        ).rejects.toThrow(message);
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(readFileSync(join(dir, "attempt.stderr.log"), "utf8")).toBe(stderr);
        expect(JSON.parse(readFileSync(join(dir, "attempt.receipt.json"), "utf8"))).toMatchObject({
          parsed,
          exitCode: 3,
        });
        expect(readdirSync(dir).some((name) => name.includes("retry"))).toBe(false);
      } finally {
        vi.mocked(spawn).mockReset();
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

// Synthetic contract fixture, not any current or proposed learner lesson.
function fixture() {
  const source = {
    id: "verified",
    url: "https://example.org/primary",
    publisher: "Fixture",
    supports: "A synthetic source record",
    accessedOn: "2026-10-03",
    sourceAuthority: "first-party",
  };
  const packet = {
    createdAt: "2026-10-03T00:00:00Z",
    library: [source],
    assets: [],
    operations: ["text"],
    cardIds: ["review-one", "review-two"],
    exerciseIds: ["independent"],
    lesson: { lessonId: "synthetic-lesson" },
  };
  const activity = {
    intro: {
      situation: "A practice note",
      need: "Change a bounded part",
      connection: "A source-backed door",
      sourceIds: [source.id],
    },
    materials: [
      { id: "practice", kind: "practice", label: "Practice note", text: "First. Second. Third." },
      {
        id: "transfer",
        kind: "practice",
        label: "Different practice note",
        text: "Another purpose and another note.",
      },
    ],
    starter: {
      operation: "text",
      prompt: "Change this note.",
      materialIds: ["practice"],
      assetIds: [],
    },
    requests: [{ id: "specific", prompt: "Change the second sentence only." }],
    steps: [
      {
        kind: "choose",
        id: "guess",
        phase: "predict",
        title: "Which request?",
        options: [
          { id: "all", label: "The whole note", requestId: "starter" },
          { id: "one", label: "One part", requestId: "specific" },
        ],
      },
      {
        kind: "send",
        id: "run",
        phase: "run",
        title: "Try that request",
        request: "chosen",
        after: "Compare the result with what you meant.",
        wait: { text: "A related sourced fact", sourceId: "verified" },
      },
      {
        kind: "match",
        id: "compare",
        phase: "investigate",
        title: "Match the actual runs",
        requestIds: ["starter", "specific"],
        after: "A bounded request names the part.",
      },
      {
        kind: "sort",
        id: "round",
        phase: "investigate",
        title: "Choose the boundary",
        buckets: [
          { id: "yes", label: "Bounded" },
          { id: "no", label: "Unbounded" },
        ],
        cards: [
          { id: "card-a", text: "Only the greeting", bucketId: "yes", why: "One part is named." },
          { id: "card-b", text: "Make it better", bucketId: "no", why: "No part is named." },
          { id: "card-c", text: "The last line only", bucketId: "yes", why: "One line is named." },
        ],
        after: "Say which part must stay.",
      },
      {
        kind: "build",
        id: "build",
        phase: "modify",
        title: "Build a request",
        context: "Context is visible, never silently appended.",
        pieces: [
          { id: "part", text: "Change the greeting." },
          { id: "keep", text: "Keep the other lines." },
        ],
        answers: [["part", "keep"]],
        after: "Compare the requested boundary.",
      },
      {
        kind: "send",
        id: "modify",
        phase: "modify",
        title: "Run the built request",
        request: "built",
        after: "Check every unchanged line.",
      },
      { kind: "make", id: "make", phase: "make", title: "Try another note" },
      {
        kind: "choose",
        id: "check",
        phase: "make",
        title: "What will you inspect?",
        options: [
          { id: "content", label: "The kept lines", after: "Compare them with the source." },
          { id: "look", label: "The appearance", after: "Also compare the kept lines." },
        ],
      },
    ],
    make: {
      title: "Try another note",
      scenario: "A different practice note",
      goal: "Ask for a small change and keep the rest.",
      operation: "text",
      materialIds: ["transfer"],
      assetIds: [],
      promptPlaceholder: "What should change?",
      checklist: ["The purpose is clear.", "Other facts remain."],
      artifactLabel: "Your revised note",
    },
    finish: {
      title: "A bounded request",
      note: "Name what changes and what stays.",
      didYouKnow: { text: "A related primary-source fact", sourceId: "verified" },
      today: "Try this on one message today.",
    },
  };
  const draft = {
    title: "Synthetic contract fixture",
    activity,
    sources: [{ id: source.id, label: "Fixture source", note: "Bounded support" }],
    plan: {
      realWorld: ["door", "wait", "after"].map((placement) => ({
        placement,
        sourceId: source.id,
        kind: "fact",
        relatesTo: "The named boundary",
        reviewBy: "2027-04-03",
      })),
    },
    samples: { makePrompt: "Change only the greeting." },
    cards: [
      { front: "What changes?", back: "A named part." },
      { front: "What stays?", back: "Everything outside it." },
    ],
  };
  const payload = {
    ...activity,
    method: "PRIMM",
    experienceVersion: 3,
    sources: [
      {
        id: source.id,
        reference: { url: source.url, label: "Fixture source" },
        note: "Bounded support",
      },
    ],
    make: { ...activity.make, exerciseId: "independent" },
  };
  Object.assign(draft.plan, {
    capability: "Keep a named part unchanged",
    situations: Array.from({ length: 5 }, (_, i) => ({
      moment: `Synthetic moment ${i}`,
      withoutAi: "Manual edit",
      commonThisMonth: true,
      simplerWay: "Not assumed",
      keep: true,
    })),
    practice: "First practice",
    make: "Different purpose",
    caseSourceId: source.id,
    caseNeeded: "",
    caseRole: "Bounded editing",
    predictUncertainty: "Which request?",
    investigateAct: "Compare the boundary",
    teacherThread: "Name a part, run, inspect and try again.",
  });
  draft.exercise = {
    title: "Independent bounded edit",
    rubric: ["Names the change", "Preserves the facts"],
  };
  return { packet, draft, payload };
}

describe("native step lesson authoring contract", () => {
  it("tells the independent reader which branch ran, when hints appear, and that Make output is not a graded final work", () => {
    const { draft, payload } = fixture();
    payload.steps.find((step) => step.kind === "build").hint = "A hint after a wrong assembly";
    const sample = {
      prompt: payload.starter.prompt,
      text: "A real draft, not a learner-approved final work.",
    };
    const rendered = renderStepLesson(
      payload,
      draft,
      { run: sample, modify: sample, requests: { starter: sample, specific: sample } },
      sample,
    );
    expect(rendered).toContain("本次样例选择 starter；其他选择会执行各自绑定的请求");
    expect(rendered).toContain("仅拼接失败后显示的提示，不是操作前给出的答案");
    expect(rendered).toContain("未经学习者编辑、未经评分的真实初稿");
    expect(rendered).toContain("原生评分为 pass 后才能继续，fail / undecided 留在本步");
    expect(rendered).toContain("独立作品通过评分后的不评分自查，没有标准答案");
    expect(rendered).toContain("A real draft, not a learner-approved final work.");
  });
  it("preserves an explicitly Owner-fixed title without disabling other polish", () => {
    const before = { title: "An agreed title", "activity.intro.need": "Try this carefully." };
    const after = { title: "Another title", "activity.intro.need": "Try this." };
    expect(polishIssues(before, after, { fixedTitle: before.title })).toContain(
      "title: Owner-fixed title must stay unchanged",
    );
    expect(polishIssues(before, after)).toEqual([]);
    expect(() => polishIssues(before, after, { fixedTitle: "Not the reviewed title" })).toThrow(
      /reviewed title/,
    );
  });
  it("shows every native-valid build alternative so an optional tile is not reviewed as mandatory", () => {
    const { payload, draft } = fixture();
    const build = payload.steps.find((step) => step.kind === "build");
    build.pieces.push({ id: "optional", text: "Return the whole note." });
    build.answers = [[...build.answers[0], "optional"], [...build.answers[0]]];
    const sample = { prompt: payload.starter.prompt, text: "A retained real answer." };
    const rendered = renderStepLesson(payload, draft, { run: sample, modify: sample }, sample);
    expect(rendered).toContain("以下每一种都是合法拼法");
    expect(rendered).toContain("3 块即可通过");
    expect(rendered).toContain("2 块即可通过");
    expect(rendered).toContain("学习者看不到这份答案表");
  });
  it("repairs machine-invalid drafts without inventing an independent review or retrying a failed runtime", () => {
    expect(typeof pipeline.reviewContextForFix).toBe("function");
    const missingField = [{ code: "shape", where: "steps.3.terms", detail: "Missing terms" }];
    expect(pipeline.reviewContextForFix(missingField, null)).toMatchObject({ performed: false });
    expect(pipeline.reviewContextForFix(missingField, null)).not.toHaveProperty("verdict");
    const review = { findings: [{ code: "F9", severity: "major" }], verdict: "revise" };
    expect(pipeline.reviewContextForFix([], review)).toBe(review);
    expect(() => pipeline.reviewContextForFix([], null)).toThrow(/independent review/);
    expect(() => pipeline.reviewContextForFix([{ code: "runtime" }], null)).toThrow(/real run/);
  });
  it("runs the actual pipeline schema, projection and machine checker, not only a support helper", async () => {
    const { draft, packet } = fixture();
    const S = await schemas();
    expect(S.zod.draft.safeParse(draft).success).toBe(true);
    const activity = draftActivity(draft, packet);
    expect(activity.experienceVersion).toBe(3);
    expect(activity.make.exerciseId).toBe("independent");
    expect(primmIssues(activity)).toEqual([]);
    expect(lintDraft(draft, packet).filter((item) => item.code === "shape")).toEqual([]);
    expect(activity).not.toHaveProperty("predict");
    expect(activity).not.toHaveProperty("investigate");
    expect(
      S.zod.draft.safeParse({ ...draft, activity: { ...draft.activity, madeUpField: true } })
        .success,
    ).toBe(false);
  });
  it("the actual polish map excludes identities and freezes already-run requests and build targets", () => {
    const { draft } = fixture();
    const map = displayMap(draft);
    expect(map["activity.steps.0.phase"]).toBeUndefined();
    expect(map["activity.steps.0.options.0.requestId"]).toBeUndefined();
    expect(map["activity.steps.4.answers.0.0"]).toBeUndefined();
    expect(map["activity.starter.prompt"]).toBe(draft.activity.starter.prompt);
    expect(map["activity.steps.4.pieces.0.text"]).toBe("Change the greeting.");
    const changed = { ...map, "activity.starter.prompt": "Change the whole note." };
    expect(polishIssues(map, changed)).toContain(
      "activity.starter.prompt: operational text is frozen after review",
    );
  });
  it("derives the Writer shape from the existing V3 schema and preserves its constraints", () => {
    const { draft, payload } = fixture();
    const authored = stepAuthoringShape(PrimmPayloadSchema, z).safeParse(draft.activity);
    expect(authored.success, authored.error?.message).toBe(true);
    const native = PrimmPayloadSchema.safeParse(payload);
    expect(native.success, native.error?.message).toBe(true);
    expect(primmIssues(payload)).toEqual([]);
    expect(
      stepAuthoringShape(PrimmPayloadSchema, z).safeParse({
        ...draft.activity,
        predict: { question: "Legacy" },
      }).success,
    ).toBe(false);
    payload.steps[2].kind = "invented-game";
    expect(PrimmPayloadSchema.safeParse(payload).success).toBe(false);
  });
  it("keeps chosen and match requests exact and joins Modify with the native builder", () => {
    const { payload } = fixture();
    expect(stepSampleRequests(payload)).toEqual([
      { id: "starter", phase: "run", prompt: "Change this note." },
      { id: "specific", phase: "run", prompt: "Change the second sentence only." },
    ]);
    expect(stepModifyPrompt(payload)).toBe("Change the greeting. Keep the other lines.");
    expect(stepModifyPrompt(payload)).not.toContain("Context is visible");
  });
  it("never translates phase, request or answer identities as displayed prose", () => {
    for (const path of [
      "activity.steps.0.phase",
      "activity.steps.0.options.0.requestId",
      "activity.steps.4.answers.0.1",
      "activity.steps.2.requestIds.0",
    ])
      expect(isStructuralStepPath(path), path).toBe(true);
    for (const path of [
      "activity.steps.2.title",
      "activity.steps.0.options.0.after",
      "activity.steps.4.pieces.0.text",
    ])
      expect(isStructuralStepPath(path), path).toBe(false);
  });
  it("accepts bounded source placements and rejects a fact placed on Modify", () => {
    const { draft, packet } = fixture();
    expect(realWorldPlanSchema(z).safeParse(draft.plan.realWorld).success).toBe(true);
    expect(stepTeachingIssues(draft, packet)).toEqual([]);
    draft.activity.steps.find((step) => step.id === "modify").wait = {
      text: "Wrong place",
      sourceId: "verified",
    };
    expect(
      stepTeachingIssues(draft, packet).some((issue) => issue.detail.includes("only to the Run")),
    ).toBe(true);
  });
  it("rejects missing, mismatched, secondary and overdue source metadata", () => {
    for (const change of [
      ({ draft }) => {
        draft.plan.realWorld.pop();
      },
      ({ draft }) => {
        draft.activity.finish.didYouKnow.sourceId = "unselected";
      },
      ({ packet }) => {
        packet.library[0].sourceAuthority = "journalism";
      },
      ({ packet }) => {
        packet.library[0].sourceAuthority = "news-report";
      },
      ({ packet }) => {
        delete packet.library[0].sourceAuthority;
      },
      ({ draft }) => {
        draft.plan.realWorld[0].reviewBy = "2026-02-30";
      },
      ({ draft }) => {
        draft.plan.realWorld[0].reviewBy = "2028-10-03";
      },
    ]) {
      const input = fixture();
      change(input);
      expect(stepTeachingIssues(input.draft, input.packet).length).toBeGreaterThan(0);
    }
  });
  it("uses the verified image coordinates, not merely the existence of a verification record", () => {
    const { draft, packet } = fixture();
    const region = { id: "target", label: "Known place", x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    packet.assets = [{ id: "image", verifiedFacts: { regions: [region] } }];
    draft.activity.steps[2] = {
      kind: "point",
      id: "point",
      phase: "investigate",
      title: "Locate it",
      assetId: "image",
      regions: [{ ...region }],
      targetId: "target",
      miss: "Look again.",
      after: "The known place.",
    };
    expect(stepTeachingIssues(draft, packet)).toEqual([]);
    draft.activity.steps[2].regions[0].x = 0.8;
    expect(
      stepTeachingIssues(draft, packet).some((issue) => issue.detail.includes("coordinates")),
    ).toBe(true);
  });
  it("rejects a second round, oversized round and graded prediction without weakening native validation", () => {
    const input = fixture();
    input.draft.activity.steps.push({ ...input.draft.activity.steps[3], id: "second-round" });
    input.draft.activity.steps[3].cards.push(
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `extra-${i}`,
        text: "Extra",
        bucketId: "yes",
        why: "Synthetic",
      })),
    );
    input.draft.activity.steps[0].answerId = "one";
    const issues = stepTeachingIssues(input.draft, input.packet);
    expect(issues.some((issue) => issue.detail.includes("At most one"))).toBe(true);
    expect(issues.some((issue) => issue.detail.includes("3–6"))).toBe(true);
    expect(issues.some((issue) => issue.detail.includes("does not grade"))).toBe(true);
  });
  it("keeps full model answers and explicit failure states in the independent review render", () => {
    const { draft, payload } = fixture();
    const long = "Actual full-length output. ".repeat(120) + "UNTRUNCATED-END";
    const run = { prompt: payload.starter.prompt, text: long };
    const rendered = renderStepLesson(
      payload,
      draft,
      {
        run,
        modify: { prompt: stepModifyPrompt(payload), error: "unavailable" },
        requests: { starter: run, specific: { text: "Different actual output" } },
      },
      { error: "not-run" },
    );
    expect(rendered).toContain(long);
    expect(rendered).toContain("UNTRUNCATED-END");
    expect(rendered).toContain("真实运行未成功：unavailable");
    expect(rendered).toContain("没有替换成示例");
    expect(rendered).toContain("Different actual output");
  });
});
