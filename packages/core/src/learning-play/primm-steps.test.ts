import { describe, expect, it } from "vitest";
import { LessonActivitySchema, PrimmPayloadSchema } from "../domain/schemas.js";
import { primmStepsFixture } from "./fixtures/primm-steps.js";
import { activityDisplayStrings, localizeActivity } from "./localization.js";
import {
  joinPrimmPieces,
  primmBuildVerdict,
  primmIssues,
  primmLessonIssues,
  primmRequestPrompt,
  primmSentences,
  primmSentencesMentioning,
  type PrimmStep,
  type PrimmStepOf,
  type PrimmStepsActivity,
} from "../index.js";

const lesson = structuredClone(primmStepsFixture);
const issuesOf = (activity: PrimmStepsActivity) => {
  const parsed = PrimmPayloadSchema.safeParse(activity);
  return parsed.success ? primmIssues(parsed.data) : parsed.error.issues.map((i) => i.message);
};
const withSteps = (edit: (steps: PrimmStep[]) => PrimmStep[]) => {
  const next = structuredClone(primmStepsFixture);
  next.steps = edit(next.steps);
  return next;
};
const stepOf = <K extends PrimmStep["kind"]>(kind: K, id?: string) =>
  primmStepsFixture.steps.find(
    (step): step is PrimmStepOf<K> => step.kind === kind && (!id || step.id === id),
  )!;

describe("PRIMM steps: the fixed frame", () => {
  it("accepts lesson one as a bilingual version-3 activity", () => {
    expect(LessonActivitySchema.safeParse(lesson).success).toBe(true);
    expect(issuesOf(lesson)).toEqual([]);
    for (const text of activityDisplayStrings(lesson))
      expect(lesson.locales?.en?.strings?.[text], text).toBeTruthy();
  });

  it("lets a phase hold one or several steps of any allowed kind", () => {
    // Predict with two steps, Investigate with one: still the same frame.
    const varied = withSteps((steps) => [
      steps[0]!,
      { ...stepOf("sort"), id: "sort-first", phase: "predict" },
      ...steps.slice(1, 3),
      steps[4]!,
      ...steps.slice(5),
    ]);
    expect(issuesOf(varied)).toEqual([]);
  });

  it("keeps the five phases in order, each with one to four steps", () => {
    const swapped = withSteps((steps) => [steps[3]!, ...steps.slice(0, 3), ...steps.slice(4)]);
    expect(issuesOf(swapped).join()).toContain("out of phase order");
    const noInvestigate = withSteps((steps) =>
      steps.filter((step) => step.phase !== "investigate"),
    );
    expect(issuesOf(noInvestigate)).toContain("PRIMM investigate needs one to four steps");
    const crowded = withSteps((steps) => [
      steps[0]!,
      ...[1, 2, 3, 4].map((n) => ({
        ...stepOf("sort"),
        id: `extra-${n}`,
        phase: "predict" as const,
      })),
      ...steps.slice(1),
    ]);
    expect(issuesOf(crowded)).toContain("PRIMM predict needs one to four steps");
  });

  it("requires exactly one real run in Run and in Modify, and Make to open with the task", () => {
    const twice = withSteps((steps) => [
      ...steps.slice(0, 2),
      { ...stepOf("send", "send-choice"), id: "again", request: "starter" },
      ...steps.slice(2),
    ]);
    expect(issuesOf(twice)).toContain("PRIMM run needs exactly one real run");
    const noModifyRun = withSteps((steps) => steps.filter((step) => step.id !== "send-built"));
    expect(issuesOf(noModifyRun)).toContain("PRIMM modify needs exactly one real run");
    const lateMake = withSteps((steps) => [...steps.slice(0, -2), steps.at(-1)!, steps.at(-2)!]);
    expect(issuesOf(lateMake)).toContain("PRIMM make opens with exactly one independent task");
  });

  it("binds every run to a request the lesson prepared", () => {
    const unknown = withSteps((steps) =>
      steps.map((step) => (step.id === "send-choice" ? { ...step, request: "invented" } : step)),
    );
    expect(issuesOf(unknown)).toContain("Unknown PRIMM request: invented");
    const chosenWithoutRequests = withSteps((steps) =>
      steps.map((step) =>
        step.kind === "choose" && step.phase === "predict"
          ? { ...step, options: step.options.map(({ requestId: _, ...option }) => option) }
          : step,
      ),
    );
    expect(issuesOf(chosenWithoutRequests).join()).toContain(
      "chosen request needs a Predict choice of requests",
    );
    const builtWithoutBuild = withSteps((steps) => steps.filter((step) => step.kind !== "build"));
    expect(issuesOf(builtWithoutBuild).join()).toContain("built request needs an earlier build");
  });

  it("only looks for sentences after something was really run", () => {
    const early = withSteps((steps) => [steps[0]!, steps[2]!, steps[1]!, ...steps.slice(3)]);
    expect(issuesOf(early)).toContain("PRIMM find needs an earlier real run: find-spoon");
  });

  it("checks point targets, build answers and reserved request IDs", () => {
    const badPoint = withSteps((steps) =>
      steps.map((step) => (step.kind === "point" ? { ...step, targetId: "nowhere" } : step)),
    );
    expect(issuesOf(badPoint)).toContain("Unknown PRIMM point target: nowhere");
    const badBuild = withSteps((steps) =>
      steps.map((step) => (step.kind === "build" ? { ...step, answers: [["p-ghost"]] } : step)),
    );
    expect(issuesOf(badBuild)).toContain("Invalid PRIMM build answer: build-ask");
    const reserved = structuredClone(primmStepsFixture);
    reserved.requests = [{ id: "chosen", prompt: "另一句" }];
    expect(issuesOf(reserved).join()).toContain("Reserved PRIMM request ID: chosen");
  });

  it("resolves inspected images against the lesson's assets", () => {
    const base = {
      activities: [lesson],
      evidence: [
        { sourceUrl: "https://www.bemyeyes.com/blog/introducing-be-my-ai/" },
        { sourceUrl: "https://scikit-image.org/docs/stable/api/skimage.data.html" },
      ],
      exerciseIds: ["ask-about-a-picture-exercise"],
    };
    const images = [
      { id: "everyday-coffee", mime: "image/png" },
      { id: "everyday-cat", mime: "image/png" },
    ];
    expect(primmLessonIssues(lesson, lesson, { ...base, assets: images })).toEqual([]);
    expect(primmLessonIssues(lesson, lesson, { ...base, assets: [images[1]!] }).join()).toContain(
      "Unknown PRIMM lesson asset: everyday-coffee",
    );
  });
});

describe("PRIMM steps: pure helpers", () => {
  it("resolves prepared requests and translates them with the lesson", () => {
    expect(primmRequestPrompt(lesson, "starter")).toBe("说说这张照片里有什么。");
    expect(primmRequestPrompt(lesson, "ask-spoon")).toBe("勺子在杯子的哪一边？");
    expect(primmRequestPrompt(lesson, "invented")).toBeUndefined();
    const en = localizeActivity(lesson, "en") as PrimmStepsActivity;
    expect(primmRequestPrompt(en, "ask-spoon")).toBe("Which side of the cup is the spoon on?");
    expect(en.steps[0]!.title).toMatch(/^You want to know/);
    expect((en.steps[2] as PrimmStepOf<"find">).terms).toEqual(["spoon"]);
  });

  it("splits a live answer into tappable sentences and finds the ones that mention a term", () => {
    const zh = primmSentences(
      "照片里有一杯咖啡。**旁边**放着一把小勺子，靠近杯子。\n整体画面温暖！",
    );
    expect(zh).toEqual(["照片里有一杯咖啡。", "旁边放着一把小勺子，靠近杯子。", "整体画面温暖！"]);
    expect(primmSentencesMentioning(zh, ["勺"])).toEqual([1]);
    expect(primmSentencesMentioning(zh, ["猫"])).toEqual([]);
    const en = primmSentences("A cup of coffee. A silver Spoon lies to the right. Warm light.");
    expect(primmSentencesMentioning(en, ["spoon"])).toEqual([1]);
  });

  it("joins Chinese pieces as written and puts spaces between English words", () => {
    expect(joinPrimmPieces(["看这张照片，", "杯子里", "有没有泡沫？"])).toBe(
      "看这张照片，杯子里有没有泡沫？",
    );
    expect(joinPrimmPieces(["Look at this photo:", "Is there foam", "in the cup?"])).toBe(
      "Look at this photo: Is there foam in the cup?",
    );
  });

  it("judges a built request against the authored answers and names a stray piece", () => {
    const build = stepOf("build");
    expect(primmBuildVerdict(build, ["p-look", "p-cup", "p-foam"])).toEqual({
      ok: true,
      prompt: "看这张照片，杯子里有没有泡沫？",
    });
    expect(primmBuildVerdict(build, ["p-cup", "p-foam"]).ok).toBe(true);
    expect(primmBuildVerdict(build, ["p-cup", "p-foam", "p-long"])).toEqual({
      ok: false,
      reason: "extra",
      pieceId: "p-long",
    });
    expect(primmBuildVerdict(build, ["p-foam", "p-cup"])).toEqual({ ok: false, reason: "order" });
    expect(primmBuildVerdict(build, ["p-look", "p-cup"])).toEqual({
      ok: false,
      reason: "missing",
    });
  });
});
