import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertNoUnexplainedShrink } from "./import-shrink.mjs";

const evidence = [{ sourceUrl: "https://www.nasa.gov/example", kind: "fact" }];
function packageOf() {
  return {
    packageKind: "university-local-course-recovery",
    course: {
      id: "course",
      units: [
        {
          id: "unit",
          lessons: [
            {
              id: "lesson",
              contentRevision: 1,
              content: "A long but redundant explanation.",
              evidence,
              assets: [{ metadata: { id: "image" }, dataBase64: "same-image" }],
              cards: [{ id: "card", evidence }],
              exercises: [{ id: "exercise", evidence }],
            },
          ],
        },
      ],
    },
  };
}
function fixture(change = () => {}) {
  const before = packageOf();
  const after = structuredClone(before);
  after.course.units[0].lessons[0].content = "A clear explanation.";
  after.course.units[0].lessons[0].contentRevision = 2;
  change(before, after);
  const files = new Map();
  const manifest = (pkg, servedBytes) => {
    const bytes = Buffer.from(JSON.stringify(pkg));
    const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    files.set(sha256, bytes);
    return {
      studies: [{ studyId: "study", courses: [{ courseId: "course", sha256, servedBytes }] }],
    };
  };
  const previous = manifest(before, 1_000);
  const next = manifest(after, 900);
  return { previous, next, files, read: (_study, entry) => files.get(entry.sha256) };
}

describe("the importer preserves evidence while accepting shorter real revisions", () => {
  it("allows revised card and question wording only in the newer containing lesson", () => {
    const f = fixture((before, after) => {
      for (const pkg of [before, after]) {
        const lesson = pkg.course.units[0].lessons[0];
        lesson.cards[0].kind = "basic";
        lesson.cards[0].front = "Original question";
        Object.assign(lesson.exercises[0], {
          kind: "choice",
          prompt: "Original prompt",
          correctOptionId: "a",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
        });
      }
      const revised = after.course.units[0].lessons[0];
      revised.cards[0].front = "A clearer question";
      revised.exercises[0].prompt = "A new independent task";
      revised.exercises[0].correctOptionId = "b";
      revised.exercises[0].options = [
        { id: "b", text: "New B" },
        { id: "a", text: "New A" },
      ];
    });
    expect(assertNoUnexplainedShrink(f.previous, f.next, f.read)).toHaveLength(1);
  });

  it.each([
    (lesson) => {
      lesson.cards[0].id = "replacement-card";
    },
    (lesson) => {
      lesson.exercises[0].kind = "short-answer";
    },
    (lesson) => {
      lesson.cards[0].evidence = [];
    },
    (lesson) => {
      lesson.exercises[0].evidence[0].sourceUrl = "https://example.invalid/replaced";
    },
    (lesson) => {
      lesson.exercises[0].options.pop();
    },
    (lesson) => {
      lesson.exercises[0].options[1].id = "a";
    },
    (lesson) => {
      lesson.exercises[0].options[1].id = "replacement-option";
    },
    (lesson) => {
      lesson.cards[0].front = "Changed in place";
      lesson.contentRevision = 1;
    },
  ])(
    "rejects lost or replaced assessment material even if a lesson claims a new revision",
    (change) => {
      const f = fixture((before, after) => {
        for (const pkg of [before, after]) {
          const lesson = pkg.course.units[0].lessons[0];
          Object.assign(lesson.cards[0], { kind: "basic", front: "Question" });
          Object.assign(lesson.exercises[0], {
            kind: "choice",
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
          });
        }
        change(after.course.units[0].lessons[0]);
      });
      expect(() => assertNoUnexplainedShrink(f.previous, f.next, f.read)).toThrow("unexplained");
    },
  );

  it("accepts a shorter verified public-source revision with preserved protected material", () => {
    const f = fixture();
    expect(assertNoUnexplainedShrink(f.previous, f.next, f.read)).toMatchObject([
      { course: "study/course", removedBytes: 100 },
    ]);
  });
  it.each([
    (_old, next) => {
      next.course.units[0].lessons[0].evidence = [];
    },
    (_old, next) => {
      next.course.units[0].lessons[0].assets = [];
    },
    (_old, next) => {
      next.course.units[0].lessons[0].cards = [];
    },
    (_old, next) => {
      next.course.units[0].lessons[0].exercises = [];
    },
    (_old, next) => {
      next.course.units[0].lessons = [];
    },
    (_old, next) => {
      next.course.units[0].lessons[0].contentRevision = 1;
    },
    (old, next) => {
      for (const pkg of [old, next])
        pkg.course.units[0].lessons[0].evidence = [{ sourcePath: "README.md" }];
    },
  ])("rejects missing material, immutable rewrites and repository-source shrink", (change) => {
    const f = fixture(change);
    expect(() => assertNoUnexplainedShrink(f.previous, f.next, f.read)).toThrow("unexplained");
  });
  it("rejects same-package shrink even if another course grows more", () => {
    const f = fixture();
    f.next.studies[0].courses[0].sha256 = f.previous.studies[0].courses[0].sha256;
    f.previous.studies[0].courses.push({ courseId: "growing", sha256: "same", servedBytes: 5 });
    f.next.studies[0].courses.push({ courseId: "growing", sha256: "same", servedBytes: 5_000 });
    expect(() => assertNoUnexplainedShrink(f.previous, f.next, f.read)).toThrow("unexplained");
  });
  it("rejects a missing course and missing or tampered immutable package bytes", () => {
    const f = fixture();
    expect(() => assertNoUnexplainedShrink(f.previous, { studies: [] }, f.read)).toThrow("remove");
    expect(() => assertNoUnexplainedShrink(f.previous, f.next, () => null)).toThrow("unexplained");
    expect(() => assertNoUnexplainedShrink(f.previous, f.next, () => Buffer.from("{}"))).toThrow(
      "unexplained",
    );
  });
  it("does not demand old packages when all course byte counts remain unchanged", () => {
    const f = fixture();
    expect(assertNoUnexplainedShrink(f.previous, f.previous, () => null)).toEqual([]);
  });
});
