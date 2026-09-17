import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  gradeDeterministically,
  localizeLearnerContent,
  type AnswerKey,
} from "@pieai/university-core";
import { executeUniversityLocalCli } from "../cli/execute.js";
import { parseUniversityLocalCli } from "../cli/parse.js";
import { readLatestExercise, readLatestLesson } from "../content/repository.js";
import { createUniversityLocalHttpServer } from "../http-server.js";

const activity = JSON.parse(
  readFileSync(
    new URL("../../../../packages/core/fixtures/interaction-path-v2.json", import.meta.url),
    "utf8",
  ),
);
const evidence = [
  {
    kind: "fact",
    sourceUrl: activity.source.url,
    sourceTitle: activity.source.label,
    sourceAuthority: "w3c",
  },
];
const content = `# 键盘如何触发按钮？\n\n::play{#${activity.id}}\n\n你可以先把焦点移到按钮，再用 Enter 或空格触发它。按钮应当有能读懂的名称，让你知道这次会执行什么。这里是用于自动化检查的教学情境，不是一个已经验收的真实预约网站。参见 [W3C 按钮模式](${activity.source.url})。`;
const options = [
  { id: "enter", text: "Enter", explanation: "焦点在按钮上时，Enter 能触发按钮。" },
  { id: "tab", text: "Tab", explanation: "Tab 通常移动焦点，不是触发当前按钮。" },
  { id: "escape", text: "Escape", explanation: "Escape 不等于触发当前按钮。" },
];
const translated = [
  { id: "enter", text: "Enter", explanation: "Enter activates a focused button." },
  {
    id: "tab",
    text: "Tab",
    explanation: "Tab normally moves focus rather than activating the button.",
  },
  { id: "escape", text: "Escape", explanation: "Escape is not the button’s activation key." },
];
const run = (root: string, args: string[]) =>
  executeUniversityLocalCli({
    projectRoot: root,
    cwd: root,
    env: {},
    command: parseUniversityLocalCli(args),
  });
interface LessonWire {
  lesson: {
    exercises: { options: typeof options; answerKey: AnswerKey; locales: { en: unknown } }[];
    progress?: { status: string };
  };
}
interface AttemptWire {
  attemptId: string;
  attemptCount: number;
  hostGrade: unknown;
}

describe("native choice revision and grading boundary", () => {
  it("migrates a stored answer without changing IDs, round-trips locales and grades actual HTTP choices idempotently", async () => {
    const root = mkdtempSync(join(tmpdir(), "native-choice-source-"));
    const recoveredRoot = mkdtempSync(join(tmpdir(), "native-choice-recovered-"));
    const study = "choice-test",
      course = "keyboard-course",
      unit = "keyboard-unit",
      lesson = "keyboard-lesson";
    await run(root, ["study", "create", "--study", study, "--title", "Synthetic choice fixture"]);
    const proposalPath = join(root, "proposal.json");
    writeFileSync(
      proposalPath,
      JSON.stringify({
        schemaVersion: 1,
        proposalId: "choice-initial",
        course: {
          id: course,
          title: "Keyboard fixture",
          audience: "Automated test only",
          objectives: ["Test the native choice boundary"],
          units: [
            {
              id: unit,
              title: "Buttons",
              objective: "Check a button",
              lessons: [
                {
                  id: lesson,
                  title: "键盘如何触发按钮？",
                  content,
                  variant: "现象",
                  evidence,
                  activities: [activity],
                  cards: [],
                  exercises: [
                    {
                      id: "independent",
                      kind: "short-answer",
                      title: "独立练习",
                      prompt: "按钮已有焦点，按哪个键触发？",
                      expectedAnswer: "Enter",
                      evidence,
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
    await run(root, ["course", "create", "--study", study, "--input", proposalPath]);
    const readExercise = (project: string) =>
      readLatestExercise(join(project, "studies"), study, course, unit, lesson, "independent");
    const before = readExercise(root);
    expect(before.kind).toBe("short-answer");
    await run(root, ["course", "open-for-edit", "--study", study, "--course", course]);
    const revisionPath = join(root, "revision.json");
    writeFileSync(
      revisionPath,
      JSON.stringify({
        schemaVersion: 1,
        proposalId: "choice-migration",
        lesson: {
          courseId: course,
          unitId: unit,
          id: lesson,
          expectedRevision: 1,
          content: content + "\n你可以换个按钮再检查一次。",
          evidence,
          activities: [activity],
          cards: [],
          exercises: [
            {
              id: "independent",
              expectedRevision: 1,
              kind: "choice",
              title: "独立练习",
              prompt: "焦点已经在取消按钮上。哪个键能触发该按钮？",
              options,
              correctOptionId: "enter",
              evidence,
              locales: {
                en: {
                  title: "Independent question",
                  prompt: "The Cancel button has focus. Which key activates it?",
                  options: translated,
                },
              },
            },
          ],
        },
      }),
    );
    await run(root, ["course", "revise", "--study", study, "--input", revisionPath, "--dry-run"]);
    expect(readExercise(root)).toEqual(before);
    await run(root, ["course", "revise", "--study", study, "--input", revisionPath]);
    await run(root, ["course", "reactivate", "--study", study, "--course", course]);
    const revised = readExercise(root);
    expect(revised).toMatchObject({
      id: "independent",
      kind: "choice",
      contentRevision: 2,
      correctOptionId: "enter",
    });
    expect(revised).not.toHaveProperty("expectedAnswer");
    const exported = join(root, "exported");
    await run(root, ["course", "recovery", "export", "--study", study, "--out", exported]);
    await run(recoveredRoot, [
      "course",
      "recovery",
      "import",
      "--study",
      study,
      "--input",
      exported,
      "--dry-run",
    ]);
    await run(recoveredRoot, [
      "course",
      "recovery",
      "import",
      "--study",
      study,
      "--input",
      exported,
    ]);
    const recovered = readExercise(recoveredRoot);
    expect(recovered.kind).toBe("choice");
    if (recovered.kind !== "choice") throw new Error("choice transport was lost");
    expect(recovered.options).toEqual(options);
    expect(recovered.locales?.en?.options).toEqual(translated);
    expect(
      readLatestLesson(join(recoveredRoot, "studies"), study, course, unit, lesson).manifest
        .activities[0],
    ).toEqual(activity);

    // A new recovery root allocates its own exercise revision numbers. The
    // original root proves that a pre-migration submission cannot pass V2.
    const server = createUniversityLocalHttpServer(root);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const base = `${origin}/api/studies/${study}/courses/${course}/units/${unit}/lessons/${lesson}`;
    try {
      const bootstrap = (await (await fetch(`${origin}/api/bootstrap`)).json()) as {
        requestToken: string;
      };
      const headers = {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
      };
      const view = (await (await fetch(base)).json()) as LessonWire;
      const english = localizeLearnerContent(view, "en") as typeof view;
      const served = english.lesson.exercises[0];
      expect(served.options).toEqual(translated);
      expect(served).not.toHaveProperty("correctOptionId");
      expect(served.locales.en).not.toHaveProperty("correctOptionId");
      expect(gradeDeterministically("enter", served.answerKey).outcome).toBe("pass");
      expect(gradeDeterministically("Enter", served.answerKey).outcome).toBe("fail");
      const submit = (
        answer: string,
        commandId = randomUUID(),
        revision = revised.contentRevision,
      ) =>
        fetch(`${base}/exercises/independent/attempt`, {
          method: "POST",
          headers,
          body: JSON.stringify({ answer, commandId, contentRevision: revision }),
        });
      expect((await submit("not-an-option")).status).toBe(400);
      expect((await submit("enter", randomUUID(), 1)).status).toBe(409);
      const wrongId = randomUUID();
      const wrongResponse = await submit("tab", wrongId);
      expect(wrongResponse.status).toBe(200);
      const wrong = (await wrongResponse.json()) as AttemptWire;
      expect(wrong).toMatchObject({
        correct: false,
        awaitingHostGrade: false,
        attemptCount: 1,
        hostGrade: { host: "tier-1", learnerAnswer: "tab", passed: false },
      });
      const right = await (await submit("enter")).json();
      expect(right).toMatchObject({
        correct: true,
        awaitingHostGrade: false,
        score: 1,
        attemptCount: 2,
      });
      const replay = (await (await submit("tab", wrongId)).json()) as AttemptWire;
      expect(replay.attemptId).toBe(wrong.attemptId);
      expect(replay.attemptCount).toBe(2);
      expect(replay.hostGrade).toEqual(wrong.hostGrade);
      expect((await submit("enter", wrongId)).status).toBe(409);
      const after = (await (await fetch(base)).json()) as LessonWire;
      expect(after.lesson.exercises[0]).toMatchObject({
        contentRevision: 2,
        awaitingHostGrade: false,
        hostGrade: { passed: true, learnerAnswer: "enter", host: "tier-1" },
      });
      expect(after.lesson.progress?.status).not.toBe("completed");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
