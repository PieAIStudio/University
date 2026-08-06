#!/usr/bin/env node
/**
 * Checks the things a course proposal has to get right that the schema does not
 * police: unique ids, the section skeleton every lesson body is supposed to
 * follow, answers short enough for the normalized comparison to be fair, and
 * an evidence note on every reference.
 *
 * `check-proposal-evidence.mjs` answers "do these citations point at real
 * code". This answers "is the course usable once the citations check out".
 * A generated course is a few hundred cards; both questions need a machine.
 *
 * Usage:
 *   node scripts/check-proposal-shape.mjs <proposal.json> [<proposal.json> ...]
 */
import { readFileSync } from "node:fs";

const REQUIRED_SECTIONS = [
  "## 学习目标",
  "## 先给结论",
  "## 一个类比",
  "## 工作示例",
  "## 自检",
  "## 重点",
];
/** Phrases that assume the reader already knows the thing the lesson teaches. */
const BANNED_PHRASES = ["众所周知", "显而易见", "简单来说", "不言而喻"];
/** A card back has to stand on its own — it is read without the lesson around it. */
const DANGLING_REFERENCES = ["见上文", "见前文", "如上所述", "参见上面"];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const args = process.argv.slice(2);
const flagIndex = args.indexOf("--min-lessons");
const minLessons = flagIndex === -1 ? 1 : Number(args[flagIndex + 1]);
// Guard the "flag absent" case explicitly. With flagIndex === -1 the value slot
// is index 0, so a positional filter would silently eat the first file path and
// the script would print usage for a perfectly valid invocation.
const valueIndex = flagIndex === -1 ? -1 : flagIndex + 1;
const paths = args.filter((value, index) => index !== flagIndex && index !== valueIndex);
if (paths.length === 0 || !Number.isInteger(minLessons) || minLessons < 1) {
  console.error(
    "usage: node scripts/check-proposal-shape.mjs <proposal.json> [...] [--min-lessons <n>]",
  );
  process.exit(2);
}

let failed = false;
for (const path of paths) {
  const problems = check(JSON.parse(readFileSync(path, "utf8")));
  if (problems.length === 0) {
    console.log(`ok  ${path}`);
    continue;
  }
  failed = true;
  console.error(`\n${path} — ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
}
process.exit(failed ? 1 : 0);

/**
 * Both proposal shapes carry the same lesson objects, so both get the same
 * checks. Only reading `course` used to mean add-lessons proposals — the normal
 * way a course grows after day one — passed the gate by not being looked at,
 * which is the worst possible way to pass.
 */
function unitsOf(proposal) {
  if (proposal.course) return proposal.course.units ?? [];
  if (proposal.unit && proposal.lessons) return [{ ...proposal.unit, lessons: proposal.lessons }];
  return null;
}

function check(proposal) {
  const problems = [];
  const units = unitsOf(proposal);
  if (!units) {
    return ["neither a `course` nor a `unit` + `lessons` pair — not a course proposal"];
  }

  const lessonIds = new Set();
  const cardIds = new Set();
  const exerciseIds = new Set();
  let lessonCount = 0;

  const claimId = (set, id, kind, where) => {
    if (!ID_PATTERN.test(id ?? "")) problems.push(`${where}: ${kind} id "${id}" is not kebab-case`);
    if (set.has(id)) problems.push(`${where}: duplicate ${kind} id "${id}"`);
    set.add(id);
  };

  for (const unit of units) {
    for (const lesson of unit.lessons ?? []) {
      lessonCount += 1;
      const where = `lesson ${lesson.id}`;
      claimId(lessonIds, lesson.id, "lesson", `unit ${unit.id}`);
      checkEvidence(lesson.evidence, where, problems);
      checkContent(lesson.content, where, problems);

      const cards = lesson.cards ?? [];
      const exercises = lesson.exercises ?? [];
      if (cards.length > 0 && exercises.length === 0) {
        problems.push(
          `${where}: has ${cards.length} card(s) and no exercise, so the cards can never enroll`,
        );
      }
      if (cards.length > 4)
        problems.push(`${where}: ${cards.length} cards on one lesson floods the review queue`);

      for (const card of cards) {
        claimId(cardIds, card.id, "card", where);
        checkEvidence(card.evidence, `${where} → card ${card.id}`, problems);
        if (!card.front?.trim()) problems.push(`${where} → card ${card.id}: empty front`);
        if (!card.back?.trim()) problems.push(`${where} → card ${card.id}: empty back`);
        for (const phrase of DANGLING_REFERENCES) {
          if (card.back?.includes(phrase)) {
            problems.push(
              `${where} → card ${card.id}: back says "${phrase}" but is read on its own`,
            );
          }
        }
      }

      for (const exercise of exercises) {
        const exerciseWhere = `${where} → exercise ${exercise.id}`;
        claimId(exerciseIds, exercise.id, "exercise", where);
        checkEvidence(exercise.evidence, exerciseWhere, problems);
        checkExercise(exercise, exerciseWhere, problems);
      }
    }
  }

  // Structural minimum only. How many lessons a course *should* have belongs
  // to the brief that commissioned it, not to a gate every proposal passes
  // through — a hardcoded 8 here forced a four-lesson course to pad itself
  // with filler, which is worse content wearing a green checkmark.
  if (lessonCount < minLessons) {
    problems.push(
      `course has only ${lessonCount} lessons; this run requires at least ${minLessons}`,
    );
  }
  // Objectives belong to the course manifest, which an add-lessons proposal
  // does not carry and must not be asked to restate.
  if (proposal.course && (proposal.course.objectives ?? []).length < 3) {
    problems.push("course needs at least 3 objectives");
  }
  return problems;
}

function checkEvidence(evidence, where, problems) {
  if (!evidence || evidence.length === 0) {
    problems.push(`${where}: no evidence`);
    return;
  }
  for (const [index, reference] of evidence.entries()) {
    const at = `${where}: evidence[${index}]`;
    if (!["fact", "inference"].includes(reference.kind)) {
      problems.push(
        `${at}: kind must be "fact" or "inference", got ${JSON.stringify(reference.kind)}`,
      );
    }
    // The note is what the learner actually reads in the evidence rail. A
    // reference without one shows a bare file path and explains nothing.
    if (!reference.note?.trim()) problems.push(`${at}: missing note`);
    // The UA graph does not index every file — configs and workflows are
    // outside it — so a reference may rest on the git snapshot alone. What it
    // may not do is claim a graph binding it does not carry.
    const bound = Boolean(reference.analysisId) || Boolean(reference.graphHash);
    if (bound && (reference.nodeIds ?? []).length === 0) {
      problems.push(`${at}: bound to a UA analysis but names no node`);
    }
    if (!bound && (reference.nodeIds ?? []).length > 0) {
      problems.push(`${at}: names UA nodes without an analysis to resolve them against`);
    }
  }
}

function checkContent(content, where, problems) {
  if (!content?.trim()) {
    problems.push(`${where}: empty content`);
    return;
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section))
      problems.push(`${where}: body is missing the "${section}" section`);
  }
  for (const phrase of BANNED_PHRASES) {
    if (content.includes(phrase))
      problems.push(
        `${where}: body says "${phrase}" to a reader who is here because they do not know`,
      );
  }
}

function checkExercise(exercise, where, problems) {
  if (!exercise.prompt?.trim()) problems.push(`${where}: empty prompt`);
  if (exercise.kind === "short-answer") {
    const answer = exercise.expectedAnswer;
    if (!answer?.trim()) {
      problems.push(`${where}: short-answer without an expectedAnswer`);
      return;
    }
    // Grading is a normalized string comparison, so a sentence-length answer is
    // a question the learner cannot pass except by guessing the exact wording.
    if (answer.length > 24) {
      problems.push(
        `${where}: expectedAnswer is ${answer.length} characters — too long to compare fairly: ${JSON.stringify(answer)}`,
      );
    }
    // A dot is not evidence of a sentence here — `?.` and `./utils` are whole
    // valid answers. Clause punctuation is.
    if (/[。，；、！？,;]/.test(answer)) {
      problems.push(
        `${where}: expectedAnswer reads as a sentence, not a term: ${JSON.stringify(answer)}`,
      );
    }
  } else if (exercise.kind === "explain") {
    const rubric = exercise.rubric ?? [];
    if (rubric.length < 3)
      problems.push(`${where}: explain needs at least 3 rubric points, has ${rubric.length}`);
  } else {
    problems.push(`${where}: unknown kind ${JSON.stringify(exercise.kind)}`);
  }
}
