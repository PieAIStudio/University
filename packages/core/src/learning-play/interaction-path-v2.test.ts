import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/interaction-path-v2.json";
import { InteractionPathPayloadSchema, LessonActivitySchema } from "../domain/schemas.js";
import {
  activityDisplayStrings,
  activityTranslationIssues,
  localizeActivity,
} from "./localization.js";
import {
  emptyPathEvidence,
  evaluateInteractionStep,
  interactionPathIssues,
  pathFirstAttemptCount,
  recordPathAttempt,
  type ExperimentStep,
  type InteractionPathActivity,
} from "./interaction-path.js";

const path = fixture as InteractionPathActivity;
const experiment = path.steps[1] as ExperimentStep;

describe("material-first V2 contract", () => {
  it("accepts three steps, shared materials, a current experiment and a final decision", () => {
    expect(LessonActivitySchema.safeParse(fixture).success).toBe(true);
    expect(interactionPathIssues(path)).toEqual([]);
    expect(activityDisplayStrings(path).every((text) => path.locales?.en?.strings?.[text])).toBe(
      true,
    );
    const english = localizeActivity(path, "en-US");
    expect(english.context?.introduction).toContain("booking page");
    expect(english.context?.task).toContain("button guidance");
    expect(english.materials?.[0]?.text).toContain("When a button has focus");
    expect(english.sources[0]).toMatchObject({
      date: "Publication date not specified",
      summary: "The guidance describes button keyboard operation.",
      limitation: "Guidance is not evidence that a real website has passed testing.",
    });
    const translatedExperiment = english.steps[1] as ExperimentStep;
    expect(translatedExperiment.simulationNote).toContain(
      "does not operate a real booking page or call AI",
    );
    expect(evaluateInteractionStep(translatedExperiment, ["enter", "focus"])).toMatchObject({
      passed: true,
      artifact: "With focus on the button, Enter triggers one booking submission.",
      feedback: ["Focus and keypress together meet this simulation’s conditions."],
      currentCase: { id: "activated", selectedControlIds: ["focus", "enter"], accepted: true },
    });
    expect(english.materials?.map((material) => material.id)).toEqual(
      path.materials?.map((material) => material.id),
    );
    expect(english.steps.map((step) => step.phase)).toEqual(["predict", "practice", "transfer"]);
  });

  it.each([
    [
      "missing context",
      (p: any) => {
        delete p.context;
      },
    ],
    [
      "missing materials",
      (p: any) => {
        delete p.materials;
      },
    ],
    [
      "empty materials",
      (p: any) => {
        p.materials = [];
      },
    ],
    [
      "context source",
      (p: any) => {
        p.context.sourceIds.push("unknown");
      },
    ],
    [
      "material source",
      (p: any) => {
        p.materials[0].sourceId = "unknown";
      },
    ],
    [
      "duplicate material",
      (p: any) => {
        p.materials.push(p.materials[0]);
      },
    ],
    [
      "step material",
      (p: any) => {
        p.steps[0].materialIds = ["unknown"];
      },
    ],
    [
      "unused source summary",
      (p: any) => {
        for (const step of p.steps) step.materialIds = ["draft-note"];
      },
    ],
    [
      "no source summary",
      (p: any) => {
        p.materials[0].kind = "teaching-draft";
      },
    ],
    [
      "missing transfer",
      (p: any) => {
        delete p.steps[2].phase;
      },
    ],
    [
      "multiple transfers",
      (p: any) => {
        p.steps[0].phase = "transfer";
      },
    ],
    [
      "non-final transfer",
      (p: any) => {
        p.steps[0].phase = "transfer";
        p.steps[2].phase = "practice";
      },
    ],
    [
      "future version",
      (p: any) => {
        p.pedagogyVersion = 3;
      },
    ],
    [
      "untranslated material",
      (p: any) => {
        delete p.locales.en.strings[p.materials[0].text];
      },
    ],
    [
      "untranslated feedback",
      (p: any) => {
        delete p.locales.en.strings[p.steps[1].cases[0].feedback];
      },
    ],
    [
      "untranslated simulation",
      (p: any) => {
        delete p.locales.en.strings[p.steps[1].simulationNote];
      },
    ],
    [
      "untranslated context task",
      (p: any) => {
        delete p.locales.en.strings[p.context.task];
      },
    ],
    [
      "untranslated limitation",
      (p: any) => {
        delete p.locales.en.strings[p.sources[0].limitation];
      },
    ],
  ] as const)("rejects %s at the stored activity boundary", (_, mutate) => {
    const invalid = structuredClone(fixture);
    mutate(invalid);
    expect(LessonActivitySchema.safeParse(invalid).success).toBe(false);
  });

  it("allows a V2 path with no assembly or experiment artifact, while V1 retains its checks", () => {
    const payload = InteractionPathPayloadSchema.parse(fixture);
    payload.steps[1] = { ...payload.steps[0]!, id: "another-condition", phase: "practice" };
    expect(interactionPathIssues(payload)).toEqual([]);
    for (const step of payload.steps) {
      expect(
        evaluateInteractionStep(step, [step.kind === "decision" ? step.correctOptionId : ""])
          .artifact,
      ).toBeUndefined();
    }
    delete payload.pedagogyVersion;
    expect(interactionPathIssues(payload).join()).toContain(
      "starts with decision and includes evidence and a usable assembly",
    );
  });

  it("does not rewrite rule-like fields, including task in evidence or native games", () => {
    const dictionary = { ...path.locales?.en?.strings, focus: "translated-control-id" };
    expect(
      activityTranslationIssues({ ...path, locales: { en: { strings: dictionary } } }).join(),
    ).toContain("not display text");
    const native = {
      kind: "program",
      text: "code",
      task: "support",
      feedback: "machine-event",
      summary: "machine-summary",
    };
    expect(activityDisplayStrings(native)).toEqual([]);
    expect(
      activityDisplayStrings({
        kind: "interaction-path",
        steps: [{ kind: "evidence", task: "support" }],
      }),
    ).toEqual([]);
  });
});

describe("bounded experiment", () => {
  it.each([1, 2, 3, 4])(
    "covers exactly all combinations of %i controls independent of selection order",
    (count) => {
      const controls = Array.from({ length: count }, (_, index) => ({
        id: `control-${index}`,
        label: `Condition ${index}`,
      }));
      const cases = Array.from({ length: 2 ** count }, (_, mask) => ({
        id: `case-${mask}`,
        selectedControlIds: controls
          .filter((_, index) => mask & (1 << index))
          .map((control) => control.id),
        title: `State ${mask}`,
        text: `Observed result ${mask}`,
        feedback: `Explanation for state ${mask}`,
        accepted: mask === 0 || mask === 2 ** count - 1,
      }));
      const step: ExperimentStep = { ...experiment, controls, cases, initialControlIds: [] };
      const candidate = { ...path, steps: [path.steps[0]!, step, path.steps[2]!] };
      expect(InteractionPathPayloadSchema.safeParse(candidate).success).toBe(true);
      expect(interactionPathIssues(candidate)).toEqual([]);
      for (const item of cases) {
        const result = evaluateInteractionStep(step, [...item.selectedControlIds].reverse());
        expect(result.currentCase).toBe(item);
        expect(result.passed).toBe(item.accepted);
        expect(result.feedback).toEqual([item.feedback]);
        expect(result.artifact).toBe(item.accepted ? item.text : undefined);
      }
    },
  );

  it.each([
    [
      "no controls",
      (step: ExperimentStep) => {
        step.controls = [];
      },
    ],
    [
      "too many controls",
      (step: ExperimentStep) => {
        step.controls = Array.from({ length: 5 }, (_, index) => ({
          id: `c-${index}`,
          label: "Condition",
        }));
      },
    ],
    [
      "duplicate controls",
      (step: ExperimentStep) => {
        step.controls[1]!.id = step.controls[0]!.id;
      },
    ],
    [
      "duplicate case IDs",
      (step: ExperimentStep) => {
        step.cases[1]!.id = step.cases[0]!.id;
      },
    ],
    [
      "missing combination",
      (step: ExperimentStep) => {
        step.cases.pop();
      },
    ],
    [
      "overlapping combinations",
      (step: ExperimentStep) => {
        step.cases.push({
          ...step.cases[3]!,
          id: "overlap",
          selectedControlIds: ["enter", "focus"],
        });
      },
    ],
    [
      "duplicate case controls",
      (step: ExperimentStep) => {
        step.cases[1]!.selectedControlIds = ["focus", "focus"];
      },
    ],
    [
      "unknown case controls",
      (step: ExperimentStep) => {
        step.cases[1]!.selectedControlIds = ["unknown"];
      },
    ],
    [
      "duplicate initial controls",
      (step: ExperimentStep) => {
        step.initialControlIds = ["focus", "focus"];
      },
    ],
    [
      "unknown initial controls",
      (step: ExperimentStep) => {
        step.initialControlIds = ["unknown"];
      },
    ],
    [
      "no accepted state",
      (step: ExperimentStep) => {
        step.cases.forEach((item) => {
          item.accepted = false;
        });
      },
    ],
  ] as const)("rejects %s in the pure validator", (_, mutate) => {
    const candidate = structuredClone(path);
    mutate(candidate.steps[1] as ExperimentStep);
    expect(interactionPathIssues(candidate).length).toBeGreaterThan(0);
  });

  it("requires useful feedback in every state at the schema boundary", () => {
    const candidate = structuredClone(fixture);
    candidate.steps[1]!.cases![0]!.feedback = "   ";
    expect(LessonActivitySchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects unknown and repeated answers and never carries a visited success into a failing state", () => {
    expect(evaluateInteractionStep(experiment, ["unknown"]).passed).toBe(false);
    expect(evaluateInteractionStep(experiment, ["focus", "focus"]).passed).toBe(false);
    let evidence = emptyPathEvidence();
    for (const selection of [[], ["enter", "focus"], ["enter"]]) {
      evidence = recordPathAttempt(evidence, experiment, selection);
    }
    expect(evidence.attempts.map((attempt) => attempt.passed)).toEqual([false, true, false]);
    expect(evidence.attempts[1]?.priorEvidence).toBe(true);
    expect(pathFirstAttemptCount(evidence)).toBe(0);
    expect(evaluateInteractionStep(experiment, ["enter"]).artifact).toBeUndefined();
    const helped = recordPathAttempt(
      { ...emptyPathEvidence(), helpedStepIds: [experiment.id] },
      experiment,
      ["focus", "enter"],
    );
    expect(pathFirstAttemptCount(helped)).toBe(0);
  });
});
