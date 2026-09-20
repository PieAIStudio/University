import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/interaction-path.json";
import {
  InteractionPathPayloadSchema,
  LessonActivitySchema,
  interactionLessonIssues,
} from "../domain/schemas.js";
import { activityDisplayStrings, localizeActivity } from "./localization.js";
import {
  emptyPathEvidence,
  evaluateInteractionStep,
  interactionPathIssues,
  pathFirstAttemptCount,
  recordPathAttempt,
  type InteractionPathActivity,
} from "./interaction-path.js";

const path = fixture as InteractionPathActivity;
const assembly = path.steps[3]!;
const lesson = {
  content:
    "# 按钮如何工作？\n\n::play{#keyboard-path}\n\n你可以用键盘触发按钮。先把焦点移到按钮，然后按 Enter 或空格。原始说明里分别列出了这两个操作。",
  activities: [fixture],
  exercises: [{ id: "independent" }],
  evidence: [{ sourceUrl: fixture.source.url }],
};

describe("interaction path contract", () => {
  it("accepts a bounded bilingual path in the existing activity schema", () => {
    expect(LessonActivitySchema.safeParse(fixture).success).toBe(true);
    expect(interactionLessonIssues(lesson)).toEqual([]);
    expect(activityDisplayStrings(path).every((text) => path.locales?.en?.strings?.[text])).toBe(
      true,
    );
    const english = localizeActivity(path, "en");
    expect(english.steps[0]?.question).toContain("keyboard");
    expect(english.steps[3]?.kind).toBe("assemble");
    expect(
      evaluateInteractionStep(english.steps[3]!, ["task", "keyboard-check", "no-claim"]).passed,
    ).toBe(true);
  });
  it.each([
    (p: any) => {
      p.steps[0].sourceId = "missing";
    },
    (p: any) => {
      p.sources.push(p.sources[0]);
    },
    (p: any) => {
      p.steps[1].id = p.steps[0].id;
    },
    (p: any) => {
      p.steps[0].options[1].id = p.steps[0].options[0].id;
    },
    (p: any) => {
      p.steps[0].correctOptionId = "missing";
    },
    (p: any) => {
      p.steps[1].correctSentenceId = "missing";
    },
    (p: any) => {
      p.sources[0].reference.url = "javascript:alert(1)";
    },
    (p: any) => {
      p.steps[3].constraints[0].pieceIds.push("missing");
    },
    (p: any) => {
      p.steps[3].constraints[1].pieceIds = ["task"];
    },
    (p: any) => {
      p.steps[3].initialPieceIds = ["task", "task"];
    },
    (p: any) => {
      p.steps[0].kind = "interaction-path";
      p.steps[0].steps = p.steps;
    },
    (p: any) => {
      p.steps.push(...p.steps, ...p.steps);
    },
    (p: any) => {
      delete p.locales.en.strings[p.steps[1].question];
    },
  ])("rejects invalid references, rules, recursion and incomplete translation", (change) => {
    const invalid = structuredClone(fixture);
    change(invalid);
    expect(LessonActivitySchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects a path without source evidence, independent work or its unique marker", () => {
    expect(interactionLessonIssues({ ...lesson, evidence: [] }).join()).toContain("absent");
    expect(interactionLessonIssues({ ...lesson, exercises: [] }).join()).toContain("independent");
    expect(
      interactionLessonIssues({ ...lesson, content: lesson.content.repeat(2) }).join(),
    ).toContain("exactly once");
    expect(interactionLessonIssues({ ...lesson, activities: [fixture, fixture] }).join()).toContain(
      "exactly one",
    );
    expect(interactionLessonIssues({ content: "legacy" })).toEqual([]);
  });
  it("requires and translates the source record for an unsupported-claim task", () => {
    const payload = InteractionPathPayloadSchema.parse(fixture);
    const step = payload.steps[1]!;
    if (step.kind !== "evidence") throw new Error("fixture");
    step.task = "unsupported";
    expect(interactionPathIssues(payload).join()).toContain("visible source record");
    step.material.reference = { label: "来源记录", text: "按钮可用键盘触发。" };
    expect(interactionPathIssues(payload)).toEqual([]);
    const candidate = {
      ...path,
      ...payload,
      locales: {
        en: {
          strings: {
            ...path.locales?.en?.strings,
            来源记录: "Source record",
            "按钮可用键盘触发。": "A button can be activated with a keyboard.",
          },
        },
      },
    };
    expect(LessonActivitySchema.safeParse(candidate).success).toBe(true);
    const translated = localizeActivity(candidate, "en").steps[1]!;
    expect(translated.kind === "evidence" && translated.material.reference?.text).toBe(
      "A button can be activated with a keyboard.",
    );
  });
  it("allows a transfer decision after the artifact and validates real image references", () => {
    const candidate = structuredClone(fixture);
    candidate.steps.push({ ...candidate.steps[0]!, id: "transfer" });
    expect(LessonActivitySchema.safeParse(candidate).success).toBe(true);
    const withImage = { ...candidate, assetId: "scene" };
    expect(interactionLessonIssues({ ...lesson, activities: [withImage] }).join()).toContain(
      "image is absent",
    );
    expect(
      interactionLessonIssues({
        ...lesson,
        activities: [withImage],
        assets: [{ id: "scene", mime: "image/jpeg" }],
      }),
    ).toEqual([]);
    expect(
      interactionLessonIssues({
        ...lesson,
        content: lesson.content.replace("{#keyboard-path}", "{id=keyboard-path}"),
      }).join(),
    ).toContain("using ::play{#id}");
  });
});

describe("deterministic semantic rules and evidence", () => {
  it("records a wrong first answer honestly after revision, review and reset", () => {
    let evidence = recordPathAttempt(emptyPathEvidence(), path.steps[0]!, ["mouse-only"]);
    evidence = recordPathAttempt(evidence, path.steps[0]!, ["keyboard"]);
    evidence = { ...evidence, resets: 1, reviewed: true };
    evidence = recordPathAttempt(evidence, path.steps[0]!, ["keyboard"]);
    expect(evidence.attempts.map((item) => item.passed)).toEqual([false, true, true]);
    expect(evidence.attempts[1]?.priorEvidence).toBe(true);
    expect(pathFirstAttemptCount(evidence)).toBe(0);
    const helped = recordPathAttempt(
      { ...emptyPathEvidence(), helpedStepIds: ["predict"] },
      path.steps[0]!,
      ["keyboard"],
    );
    expect(pathFirstAttemptCount(helped)).toBe(0);
  });
  it("accepts all meaningful orders, rejects unsupported pieces and produces the artifact", () => {
    for (const answer of [
      ["task", "keyboard-check", "no-claim"],
      ["no-claim", "task", "keyboard-check"],
      ["keyboard-check", "no-claim", "task"],
    ]) {
      const result = evaluateInteractionStep(assembly, answer);
      expect(result.passed).toBe(true);
      expect(result.artifact?.split("\n")).toHaveLength(3);
    }
    expect(evaluateInteractionStep(assembly, ["task", "pretend"]).passed).toBe(false);
    expect(evaluateInteractionStep(assembly, ["unknown"]).passed).toBe(false);
    expect(evaluateInteractionStep(assembly, ["task", "task"]).passed).toBe(false);
    expect(evaluateInteractionStep(path.steps[1]!, ["name"]).passed).toBe(false);
    expect(evaluateInteractionStep(path.steps[1]!, ["keys"]).passed).toBe(true);
  });
  it("checks authored one-of and before rules and rejects a cycle", () => {
    const payload = InteractionPathPayloadSchema.parse(fixture);
    const step = payload.steps[3]!;
    if (step.kind !== "assemble") throw new Error("fixture");
    step.constraints = [
      {
        id: "one",
        kind: "one-of",
        pieceIds: ["task", "pretend"],
        label: "One goal",
        explanation: "Choose one goal",
      },
      {
        id: "include",
        kind: "include",
        pieceIds: ["keyboard-check", "no-claim"],
        label: "Checks",
        explanation: "Include checks",
      },
      {
        id: "order",
        kind: "before",
        pieceIds: ["keyboard-check", "no-claim"],
        label: "Check first",
        explanation: "Check before reporting",
      },
    ];
    expect(evaluateInteractionStep(step, ["task", "keyboard-check", "no-claim"]).passed).toBe(true);
    expect(evaluateInteractionStep(step, ["task", "no-claim", "keyboard-check"]).passed).toBe(
      false,
    );
    step.constraints.push({
      ...step.constraints[2]!,
      id: "cycle",
      pieceIds: ["no-claim", "keyboard-check"],
    });
    expect(interactionPathIssues(payload).join()).toContain("Unsatisfiable");
  });
});
