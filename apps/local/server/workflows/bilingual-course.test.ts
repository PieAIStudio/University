import { createHash } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gradeDeterministically,
  localizeLearnerContent,
  type AnswerKey,
} from "@pieai/university-core";

import { createCourse } from "./create-course.js";
import { openCourseForEdit, reactivateCourse, reviseCourseLesson } from "./revise-course.js";
import { restorePublishedLessonRevision, writeLessonRevision } from "../content/repository.js";
import { createStudy, readStudy } from "../studies/repository.js";
import {
  readCourse,
  readUnit,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  writeCourse,
} from "../content/repository.js";
import { exportCourseRecovery, importCourseRecovery } from "../recovery/course-recovery.js";
import { buildLessonView, buildStudyView } from "../http/views.js";
import { createUniversityLocalHttpServer } from "../http-server.js";

const STUDY = "real-sources",
  COURSE = "first-steps",
  UNIT = "real-picture",
  LESSON = "find-the-date";
const URL = "https://www.nasa.gov/image-article/apollo-8-astronaut-bill-anders-captures-earthrise/";
// A tiny test-only PNG. No claim that these bytes are the historical photograph.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6V0AAAAASUVORK5CYII=",
  "base64",
);
const hash = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "university-bilingual-"));
  const studiesRoot = join(root, "studies");
  createStudy(studiesRoot, {
    id: STUDY,
    title: "真实资料",
    locales: { en: { title: "Real sources" } },
  });
  const file = join(root, "fixture.png");
  writeFileSync(file, PNG);
  const evidence = [
    {
      kind: "fact",
      sourceUrl: URL,
      sourceTitle: "Earthrise",
      sourceAuthority: "public-record",
      provenance: {
        type: "public-record",
        publisher: "NASA",
        accessedOn: "2026-09-15",
        supports: "日期来自记录。",
        limitations: "图片没有写明日期。",
        locales: {
          en: {
            supports: "The date comes from the record.",
            limitations: "The date is not printed on the image.",
          },
        },
      },
    },
  ];
  const activity = {
    id: "find-the-date-play",
    kind: "sort",
    title: "分清依据",
    brief: "把信息放回依据。",
    goal: "分清画面与记录",
    takeaway: "日期回到记录核对。",
    hint: "看图片还是看记录？",
    source: { label: "NASA record", url: URL },
    question: "在哪核对？",
    role: "apply",
    difficulty: "intro",
    buckets: [
      { id: "image", label: "图像", note: "看得见的位置" },
      { id: "record", label: "记录", note: "日期与摄影者" },
    ],
    items: [
      {
        id: "position",
        label: "地球位置",
        detail: "画面布局",
        bucketId: "image",
        why: "可以看图核对。",
        tempting: { bucketId: "record", whyNot: "先对着画面看。" },
      },
      {
        id: "date",
        label: "拍摄日期",
        detail: "背景记录",
        bucketId: "record",
        why: "图像没有日期标签。",
      },
    ],
    locales: {
      en: {
        title: "Find the support",
        strings: { 图像: "Image", 记录: "Record", "先对着画面看。": "Check the picture first." },
      },
    },
  };
  const proposal = {
    schemaVersion: 1,
    proposalId: "create-real-sources",
    course: {
      id: COURSE,
      title: "第一步",
      description: "认识资料",
      audience: "初学者",
      objectives: ["核查来源"],
      locales: {
        en: {
          title: "First steps",
          description: "Meet real sources",
          audience: "Beginners",
          objectives: ["Check the source"],
        },
      },
      units: [
        {
          id: UNIT,
          title: "一张图",
          objective: "知道何处核对",
          locales: { en: { title: "A picture", objective: "Know where to check" } },
          lessons: [
            {
              id: LESSON,
              title: "日期在哪？",
              content: `# 日期在哪？\n\n[记录](${URL})\n\n:::figure[测试图片]{#source-picture}\n:::\n\n::play{#find-the-date-play}\n`,
              locales: {
                en: {
                  title: "Where is the date?",
                  content: `# Where is the date?\n\n[Record](${URL})\n\n:::figure[Test image]{#source-picture}\n:::\n\n::play{#find-the-date-play}\n`,
                },
              },
              evidence,
              activities: [activity],
              assets: [
                {
                  id: "source-picture",
                  kind: "authorized-external",
                  path: "assets/source.png",
                  mime: "image/png",
                  bytes: PNG.length,
                  sha256: hash(PNG),
                  width: 1,
                  height: 1,
                  alt: "测试用单像素图片",
                  caption: "测试夹具，不是真实照片",
                  locales: {
                    en: {
                      alt: "A test-only one-pixel image",
                      caption: "Fixture, not the real photograph",
                    },
                  },
                  source: {
                    sourceUrl: URL,
                    license: "Test-only metadata fixture; no publication claim",
                    attribution: "Synthetic test fixture",
                  },
                },
              ],
              assetFiles: [{ path: "assets/source.png", sourcePath: file }],
              cards: [
                {
                  id: "date-card",
                  front: "日期去哪里核对？",
                  back: "查看原始记录。",
                  evidence,
                  locales: {
                    en: {
                      front: "Where do you check the date?",
                      back: "Read the original record.",
                    },
                  },
                },
              ],
              exercises: [
                {
                  id: "date-check",
                  title: "检查",
                  prompt: "选择：图像 / 记录",
                  expectedAnswer: "记录",
                  evidence,
                  locales: {
                    en: {
                      title: "Check",
                      prompt: "Choose: Image / Record",
                      expectedAnswer: "Record",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
  return { root, studiesRoot, file, proposal };
}

describe("bilingual real-world course production", () => {
  it("serves translated review cards and mistake answers from the actual HTTP endpoints", async () => {
    const { root, studiesRoot, proposal } = fixture();
    createCourse({ studiesRoot, studyId: STUDY, proposal });
    writeFileSync(
      join(root, "university-local.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        studiesRoot: "./studies",
      }),
    );
    const server = createUniversityLocalHttpServer(root);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const base = `${origin}/api/studies/${STUDY}/courses/${COURSE}/units/${UNIT}/lessons/${LESSON}`;
    try {
      const cardResponse = await fetch(`${base}/cards/date-card/content`);
      expect(cardResponse.status).toBe(200);
      const card = localizeLearnerContent(await cardResponse.json(), "en") as {
        front: string;
        back: string;
        contentRevision: number;
      };
      expect(card).toMatchObject({
        front: "Where do you check the date?",
        back: "Read the original record.",
        contentRevision: 1,
      });
      const response = await fetch(`${base}/exercises/date-check`);
      expect(response.status).toBe(200);
      const mistake = localizeLearnerContent(await response.json(), "en") as {
        title: string;
        lessonTitle: string;
        prompt: string;
        correctAnswer: string;
      };
      expect(mistake).toMatchObject({
        title: "Check",
        lessonTitle: "Where is the date?",
        prompt: "Choose: Image / Record",
        correctAnswer: "Record",
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("serves complete English teaching data through the real authoring HTTP projection without reference answers", () => {
    const { studiesRoot, proposal } = fixture();
    createCourse({ studiesRoot, studyId: STUDY, proposal });
    const route = { studyId: STUDY, courseId: COURSE, unitId: UNIT, lessonId: LESSON };
    const raw = buildLessonView(studiesRoot, route, null, []);
    const view = localizeLearnerContent(raw, "en") as {
      lesson: {
        title: string;
        content: string;
        assets: Array<{ alt: string; caption: string }>;
        cards: Array<{ front: string }>;
        exercises: Array<{ title: string; prompt: string; answerKey: AnswerKey }>;
      };
    };
    expect(view.lesson.title).toBe("Where is the date?");
    expect(view.lesson.content).toContain("# Where is the date?");
    expect(view.lesson.assets[0]).toMatchObject({
      alt: "A test-only one-pixel image",
      caption: "Fixture, not the real photograph",
    });
    expect(view.lesson.cards[0]?.front).toBe("Where do you check the date?");
    const exercise = view.lesson.exercises[0]!;
    expect(exercise.title).toBe("Check");
    expect(exercise.prompt).toBe("Choose: Image / Record");
    expect(gradeDeterministically("Record", exercise.answerKey).outcome).toBe("pass");
    expect(gradeDeterministically("Image", exercise.answerKey).outcome).not.toBe("pass");
    expect(JSON.stringify(raw)).not.toMatch(/"(?:expectedAnswer|rubric|back)"\s*:/u);
    const shelf = localizeLearnerContent(
      buildStudyView(studiesRoot, readStudy(studiesRoot, STUDY), null),
      "en",
    ) as { courses: Array<{ units: Array<{ lessons: Array<{ title: string }> }> }> };
    expect(shelf.courses[0]?.units[0]?.lessons[0]?.title).toBe("Where is the date?");
  });

  it("rejects conflicting course translations before recovery writes any lesson or activates the draft", () => {
    const { root, studiesRoot, proposal } = fixture();
    createCourse({ studiesRoot, studyId: STUDY, proposal });
    const folder = join(root, "conflict-export");
    exportCourseRecovery({ studiesRoot, studyId: STUDY, outDirectory: folder });
    const target = join(root, "conflict-target");
    createStudy(target, {
      id: STUDY,
      title: "真实资料",
      locales: { en: { title: "Real sources" } },
    });
    const original = readCourse(studiesRoot, STUDY, COURSE);
    const draft = writeCourse(target, STUDY, {
      ...original,
      status: "draft",
      locales: { en: { ...original.locales!.en!, title: "An owner-authored different title" } },
    });
    const units = join(target, STUDY, "courses", COURSE, "units");
    const before = readdirSync(units);
    expect(() =>
      importCourseRecovery({ studiesRoot: target, studyId: STUDY, inputDirectory: folder }),
    ).toThrow(/Existing draft course conflicts with recovery package/);
    expect(readCourse(target, STUDY, COURSE)).toEqual(draft);
    expect(readdirSync(units)).toEqual(before);
  });

  it("keeps recovery initialization separate from ordinary revision updates", () => {
    const { studiesRoot, proposal, file } = fixture();
    createCourse({ studiesRoot, studyId: STUDY, proposal });
    const original = readLatestLesson(studiesRoot, STUDY, COURSE, UNIT, LESSON);
    openCourseForEdit({ studiesRoot, studyId: STUDY, courseId: COURSE });
    const input = {
      manifest: { ...original.manifest, contentRevision: 3 },
      content: original.content,
      assetFiles: [{ path: "assets/source.png", sourcePath: file }],
    };
    expect(() => writeLessonRevision(studiesRoot, STUDY, input)).toThrow(/revision must be 2/);
    expect(() => restorePublishedLessonRevision(studiesRoot, STUDY, input)).toThrow(
      /empty lesson location/,
    );
    expect(readLatestLesson(studiesRoot, STUDY, COURSE, UNIT, LESSON)).toEqual(original);
  });

  it("revises a no-repository lesson without manufacturing a source registration", () => {
    const { root, studiesRoot, proposal } = fixture();
    createCourse({ studiesRoot, studyId: STUDY, proposal });
    const original = readLatestLesson(studiesRoot, STUDY, COURSE, UNIT, LESSON);
    openCourseForEdit({ studiesRoot, studyId: STUDY, courseId: COURSE });
    const input = proposal.course.units[0]!.lessons[0]!;
    const revision = {
      schemaVersion: 1,
      proposalId: "revise-real-source-copy",
      lesson: {
        ...input,
        courseId: COURSE,
        unitId: UNIT,
        expectedRevision: 1,
        content: input.content.replace("日期在哪？", "去哪里核对拍摄日期？"),
        cards: input.cards.map((card) => ({ ...card, expectedRevision: 1 })),
        exercises: input.exercises.map((exercise) => ({ ...exercise, expectedRevision: 1 })),
      },
    };
    expect(() =>
      reviseCourseLesson({ studiesRoot, studyId: STUDY, proposal: revision, dryRun: true }),
    ).not.toThrow();
    reviseCourseLesson({ studiesRoot, studyId: STUDY, proposal: revision });
    expect(reactivateCourse({ studiesRoot, studyId: STUDY, courseId: COURSE }).courseStatus).toBe(
      "active",
    );
    const revised = readLatestLesson(studiesRoot, STUDY, COURSE, UNIT, LESSON);
    expect(revised.manifest.contentRevision).toBe(2);
    expect(revised.manifest.locales).toEqual(original.manifest.locales);
    expect(revised.manifest.assets).toEqual(original.manifest.assets);
    expect(revised.manifest.evidence).toEqual(original.manifest.evidence);
    const exported = join(root, "revised-bilingual-export");
    exportCourseRecovery({ studiesRoot, studyId: STUDY, outDirectory: exported });
    const restoredRoot = join(root, "revised-bilingual-restored");
    importCourseRecovery({ studiesRoot: restoredRoot, studyId: STUDY, inputDirectory: exported });
    const restored = readLatestLesson(restoredRoot, STUDY, COURSE, UNIT, LESSON);
    expect(restored.manifest.contentRevision).toBe(2);
    expect(restored.content).toBe(revised.content);
    expect(restored.manifest.locales).toEqual(revised.manifest.locales);
    expect(restored.manifest.assets).toEqual(revised.manifest.assets);
  });

  it("creates through the ordinary workflow, then preserves media, translations and answers through recovery", () => {
    const { root, studiesRoot, proposal } = fixture();
    expect(createCourse({ studiesRoot, studyId: STUDY, proposal }).courseStatus).toBe("active");
    const folder = join(root, "export");
    exportCourseRecovery({ studiesRoot, studyId: STUDY, outDirectory: folder });
    const restored = join(root, "restored");
    importCourseRecovery({ studiesRoot: restored, studyId: STUDY, inputDirectory: folder });
    expect(readStudy(restored, STUDY).locales?.en?.title).toBe("Real sources");
    expect(readCourse(restored, STUDY, COURSE).locales?.en?.title).toBe("First steps");
    expect(readUnit(restored, STUDY, COURSE, UNIT).locales?.en?.title).toBe("A picture");
    const lesson = readLatestLesson(restored, STUDY, COURSE, UNIT, LESSON);
    expect(lesson.manifest.locales?.en?.content).toContain("# Where is the date?");
    expect(lesson.manifest.activities[0]?.locales?.en?.strings?.["先对着画面看。"]).toBe(
      "Check the picture first.",
    );
    expect(lesson.manifest.assets[0]?.locales?.en?.alt).toBe("A test-only one-pixel image");
    expect(
      readLatestCard(restored, STUDY, COURSE, UNIT, LESSON, "date-card").locales?.en?.back,
    ).toBe("Read the original record.");
    const exercise = readLatestExercise(restored, STUDY, COURSE, UNIT, LESSON, "date-check");
    expect(exercise.locales?.en?.expectedAnswer).toBe("Record");
    const path = join(
      restored,
      STUDY,
      "courses",
      COURSE,
      "units",
      UNIT,
      "lessons",
      LESSON,
      "revisions",
      "1",
      "assets",
      "source.png",
    );
    expect(readFileSync(path)).toEqual(PNG);
  });

  it("refuses a missing media license, a path escape and mismatched bytes before activation", () => {
    const { studiesRoot, proposal, file } = fixture();
    const broken = structuredClone(proposal);
    broken.course.units[0]!.lessons[0]!.assets[0]!.source.license = "";
    expect(() =>
      createCourse({ studiesRoot, studyId: STUDY, proposal: broken, dryRun: true }),
    ).toThrow();
    const escape = structuredClone(proposal);
    escape.course.units[0]!.lessons[0]!.assets[0]!.path = "../outside.png";
    expect(() =>
      createCourse({ studiesRoot, studyId: STUDY, proposal: escape, dryRun: true }),
    ).toThrow();
    writeFileSync(file, Buffer.from("This is not the declared image"));
    expect(() => createCourse({ studiesRoot, studyId: STUDY, proposal, dryRun: true })).toThrow(
      /asset|hash|size/i,
    );
  });
});
