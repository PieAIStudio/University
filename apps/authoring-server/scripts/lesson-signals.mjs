#!/usr/bin/env node
/**
 * Which lessons are failing their reader, and which of those failures nobody
 * reported.
 *
 * The obvious way to find weak lessons is to collect complaints: let the reader
 * mark what they did not understand, count the marks, fix what tops the list.
 * That measurement has a hole in it, and the hole is the important part.
 *
 * A reader who marks a passage is a reader who noticed they were lost and
 * stayed. The reader who quietly misread a lesson, felt fine, and then got the
 * exercise wrong marks nothing at all — there was nothing they knew to mark.
 * Ranking by complaints therefore optimises for the confused-and-persistent and
 * never once mentions the people it actually lost.
 *
 * So this reads both signals and crosses them:
 *
 *     marked + passed   合意困难      the reader worked for it and got there.
 *                                     This is what learning feels like; leave
 *                                     it alone. Sanding it smooth would remove
 *                                     the effort that made it stick.
 *     marked + missed   已知的难点      they said so and it showed. Fix, and the
 *                                     mark says where.
 *     unmarked + missed 沉默的误解      the dangerous one. They believed they
 *                                     understood. Nothing in a complaints list
 *                                     would ever surface this.
 *     unmarked + passed 好              nothing to do.
 *
 * Only the first attempt at each exercise counts. Getting something wrong and
 * then right is what practice is; counting every retry would score a lesson by
 * how much practice it invited.
 *
 * Usage:
 *   node scripts/lesson-signals.mjs [study]     # default: every study
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const STUDIES_ROOT = "studies";
const onlyStudy = process.argv[2] ?? null;

/** Lesson titles, so a report names lessons instead of directory paths. */
function lessonTitles(studyId) {
  const titles = new Map();
  const coursesRoot = join(STUDIES_ROOT, studyId, "courses");
  if (!existsSync(coursesRoot)) return titles;
  for (const courseId of readdirSync(coursesRoot)) {
    const unitsRoot = join(coursesRoot, courseId, "units");
    if (!existsSync(unitsRoot)) continue;
    for (const unitId of readdirSync(unitsRoot)) {
      const lessonsRoot = join(unitsRoot, unitId, "lessons");
      if (!existsSync(lessonsRoot)) continue;
      for (const lessonId of readdirSync(lessonsRoot)) {
        const latest = join(lessonsRoot, lessonId, "latest.json");
        if (!existsSync(latest)) continue;
        try {
          const revision = JSON.parse(readFileSync(latest, "utf8")).contentRevision;
          const manifest = JSON.parse(
            readFileSync(
              join(lessonsRoot, lessonId, "revisions", String(revision), "manifest.json"),
              "utf8",
            ),
          );
          titles.set(`${courseId}/${unitId}/${lessonId}`, manifest.title ?? lessonId);
        } catch {
          // A lesson whose manifest cannot be read still has a key worth
          // reporting; it just goes out under its id.
        }
      }
    }
  }
  return titles;
}

function readStudy(studyId) {
  const dbPath = join(STUDIES_ROOT, studyId, "learner", "learning.sqlite");
  if (!existsSync(dbPath)) return null;
  // Read-only: this is a report, and it must never be the thing that migrates
  // a learner database or takes a write lock on one being studied in.
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const attempts = db
      .prepare(`
        SELECT exercise_id, score, max_score, occurred_at
        FROM exercise_attempt
        ORDER BY occurred_at ASC, rowid ASC
      `)
      .all();

    const firstAttempt = new Map();
    for (const row of attempts) {
      if (!firstAttempt.has(row.exercise_id)) firstAttempt.set(row.exercise_id, row);
    }

    const lessons = new Map();
    const ensure = (key) => {
      if (!lessons.has(key)) {
        lessons.set(key, { key, exercises: 0, missed: 0, questions: 0, resolved: 0 });
      }
      return lessons.get(key);
    };

    for (const [exerciseId, row] of firstAttempt) {
      // `course/unit/lesson/exercise` — the lesson is the first three segments.
      const lessonKey = exerciseId.split("/").slice(0, 3).join("/");
      if (lessonKey.split("/").length !== 3) continue;
      const lesson = ensure(lessonKey);
      lesson.exercises += 1;
      if (Number(row.score) < Number(row.max_score)) lesson.missed += 1;
    }

    let marks = [];
    try {
      marks = db.prepare("SELECT lesson_id, kind, resolved_at FROM reader_mark").all();
    } catch {
      // A learner database from before reader marks existed. Absent marks are
      // not zero marks, and the report says which case it is below.
      marks = null;
    }
    if (marks) {
      for (const row of marks) {
        if (row.kind !== "question") continue;
        const lesson = ensure(row.lesson_id);
        lesson.questions += 1;
        if (row.resolved_at !== null) lesson.resolved += 1;
      }
    }

    return { lessons: [...lessons.values()], hasMarkTable: marks !== null };
  } finally {
    db.close();
  }
}

function classify(lesson) {
  const marked = lesson.questions > 0;
  const missed = lesson.missed > 0;
  if (missed && !marked) return "沉默的误解";
  if (missed && marked) return "已知的难点";
  if (!missed && marked) return "合意困难";
  return "好";
}

const RANK = { 沉默的误解: 0, 已知的难点: 1, 合意困难: 2, 好: 3 };

const studies = onlyStudy
  ? [onlyStudy]
  : existsSync(STUDIES_ROOT)
    ? readdirSync(STUDIES_ROOT).filter((name) =>
        existsSync(join(STUDIES_ROOT, name, "learner", "learning.sqlite")),
      )
    : [];

let reported = 0;
for (const studyId of studies) {
  const result = readStudy(studyId);
  if (!result) continue;
  const titles = lessonTitles(studyId);
  const rows = result.lessons
    .map((lesson) => ({ ...lesson, verdict: classify(lesson) }))
    .filter((lesson) => lesson.verdict !== "好")
    .sort(
      (left, right) =>
        RANK[left.verdict] - RANK[right.verdict] ||
        right.missed - left.missed ||
        right.questions - left.questions,
    );

  if (rows.length === 0) continue;
  reported += rows.length;
  console.log(`\n${studyId}`);
  if (!result.hasMarkTable) {
    console.log("  （这个学习库还没有标记表，下面只有练习信号）");
  }
  for (const row of rows) {
    const title = titles.get(row.key) ?? row.key;
    const detail = [
      `首次答错 ${row.missed}/${row.exercises}`,
      row.questions > 0 ? `标记 ${row.questions} 处` : "无标记",
    ].join(" · ");
    console.log(`  ${row.verdict.padEnd(6, "　")}  ${title}`);
    console.log(`  ${"".padEnd(6, "　")}  ${detail}`);
  }
}

if (reported === 0) {
  console.log("没有需要留意的课：练习都是一次做对，也没有未解决的标记。");
} else {
  console.log(`\n${reported} 节课值得看一眼。`);
  console.log("「沉默的误解」排在最前：读者没提出任何疑问，但练习答错了——");
  console.log("那说明他读完时以为自己懂了。这一类是只收集反馈永远发现不了的。");
  console.log("「合意困难」不要动：卡住了但最后答对，正是学习真正发生的地方。");
}
