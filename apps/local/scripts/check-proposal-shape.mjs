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

const SHAPE_DATA = JSON.parse(
  readFileSync(new URL("./proposal-shape-data.json", import.meta.url), "utf8"),
);

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

const TEACHING_CHECKS = {
  "exact-answer": {
    label: "正文逐字默写",
    cost: "长代码或长标识符短答可能继续把抄写误当成理解",
  },
  "title-answer": {
    label: "标题泄露答案",
    cost: "标题直接给出答案的送分题可能继续消耗初学者的耐心",
  },
  "analogy-order": {
    label: "类比先于术语",
    cost: "术语可以先出现再补解释；保守检测漏掉的未标记术语也不会报警",
  },
  "term-drift": {
    label: "同义词漂移",
    cost: "同一节课中称呼改变造成的迷惑可能继续留给学习者",
  },
};

/**
 * Measured against the reviewed course's first six lessons:
 * 「图灵密约」= 4 chars, 「<!doctype html>」= 15 chars,
 * 「com.pieai.turingpact」= 20 chars, 「Web」= 3 chars, 「build」= 5 chars.
 * 19 is deliberately one character below the 20-character appId: it catches
 * that reviewed copy exercise, stays well above the 5-character `build` recall,
 * and does not classify every ordinary 13–19-character identifier by length.
 * Code punctuation still catches a short code answer independently.
 */
const EXACT_COPY_LENGTH_THRESHOLD = 19;
const CODE_SHAPED_ANSWER = /[<>{};]/;
const IGNORED_TERM_LABELS = new Set(SHAPE_DATA.termOrder?.ignoreLabels ?? []);

const args = process.argv.slice(2);
const parsedArgs = parseArgs(args);
if (parsedArgs.help) {
  console.log(usage());
  process.exit(0);
}
if (parsedArgs.error || parsedArgs.paths.length === 0) {
  console.error(parsedArgs.error ?? usage());
  process.exit(2);
}

for (const checkId of parsedArgs.skippedChecks) {
  const check = TEACHING_CHECKS[checkId];
  console.error(`note: skipped ${check.label} (${checkId}) — cost: ${check.cost}`);
}

let failed = false;
for (const path of parsedArgs.paths) {
  const problems = check(JSON.parse(readFileSync(path, "utf8")), parsedArgs);
  if (problems.length === 0) {
    console.log(`ok  ${path}`);
    continue;
  }
  failed = true;
  console.error(`\n${path} — ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
}
process.exit(failed ? 1 : 0);

function parseArgs(values) {
  const paths = [];
  const skippedChecks = new Set();
  let minLessons = 1;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h")
      return { help: true, paths, skippedChecks, minLessons };
    if (value === "--min-lessons") {
      const raw = values[index + 1];
      minLessons = Number(raw);
      index += 1;
      if (!Number.isInteger(minLessons) || minLessons < 1) {
        return {
          error: "--min-lessons must be a positive integer",
          paths,
          skippedChecks,
          minLessons,
        };
      }
      continue;
    }
    if (value === "--skip-check") {
      const checkId = values[index + 1];
      index += 1;
      if (!TEACHING_CHECKS[checkId]) {
        return {
          error: `unknown teaching check ${JSON.stringify(checkId)}; choose one of ${Object.keys(TEACHING_CHECKS).join(", ")}`,
          paths,
          skippedChecks,
          minLessons,
        };
      }
      skippedChecks.add(checkId);
      continue;
    }
    if (value.startsWith("--")) {
      return { error: `unknown option ${JSON.stringify(value)}`, paths, skippedChecks, minLessons };
    }
    paths.push(value);
  }

  return { paths, skippedChecks, minLessons };
}

function usage() {
  const checks = Object.entries(TEACHING_CHECKS)
    .map(([id, check]) => `  ${id}: ${check.label}；关闭代价：${check.cost}`)
    .join("\n");
  return `usage: node scripts/check-proposal-shape.mjs <proposal.json> [...] [options]
options:
  --min-lessons <n>       require at least n lessons (default: 1)
  --skip-check <id>       repeatable; disable one teaching check only
  --help                  show this message

teaching checks (each can be disabled independently with --skip-check <id>):
${checks}`;
}

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

function check(proposal, options = {}) {
  const problems = [];
  const units = unitsOf(proposal);
  const minLessons = options.minLessons ?? 1;
  const skippedChecks = options.skippedChecks ?? new Set();
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

  // Tags are `StableId` in the schema, so a camelCase tag fails at write time
  // like a bad id does. Checking only ids meant a proposal could pass every
  // gate here and still be refused by the writer on its last step, after the
  // whole course had been generated.
  const checkTags = (tags, where) => {
    for (const tag of tags ?? []) {
      if (!ID_PATTERN.test(tag ?? "")) problems.push(`${where}: tag "${tag}" is not kebab-case`);
    }
  };

  for (const unit of units) {
    for (const lesson of unit.lessons ?? []) {
      lessonCount += 1;
      const where = `lesson ${lesson.id}`;
      claimId(lessonIds, lesson.id, "lesson", `unit ${unit.id}`);
      checkEvidence(lesson.evidence, where, problems);
      checkContent(lesson.content, where, problems);
      if (!skippedChecks.has("analogy-order")) checkAnalogyOrder(lesson, where, problems);
      if (!skippedChecks.has("term-drift")) checkTermDrift(lesson, where, problems);

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
        checkTags(card.tags, `${where} → card ${card.id}`);
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
        checkExercise(exercise, exerciseWhere, problems, lesson, skippedChecks);
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

function checkExercise(exercise, where, problems, lesson, skippedChecks) {
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
    if (!skippedChecks.has("exact-answer")) checkExactAnswer(lesson, exercise, where, problems);
    if (!skippedChecks.has("title-answer")) checkTitleAnswer(lesson, exercise, where, problems);
  } else if (exercise.kind === "explain") {
    const rubric = exercise.rubric ?? [];
    if (rubric.length < 3)
      problems.push(`${where}: explain needs at least 3 rubric points, has ${rubric.length}`);
  } else {
    problems.push(`${where}: unknown kind ${JSON.stringify(exercise.kind)}`);
  }
}

function checkExactAnswer(lesson, exercise, where, problems) {
  const answer = exercise.expectedAnswer;
  const body = lesson.content ?? "";
  const index = body.indexOf(answer);
  if (index === -1) return;

  const reasons = [];
  if (answer.length > EXACT_COPY_LENGTH_THRESHOLD) {
    reasons.push(`长度 ${answer.length} 超过 ${EXACT_COPY_LENGTH_THRESHOLD}`);
  }
  if (CODE_SHAPED_ANSWER.test(answer)) reasons.push("答案含代码符号");
  if (reasons.length === 0) return;

  const line = lineNumberAt(body, index);
  const excerpt = excerptAt(body, index);
  problems.push(
    `${where}: expectedAnswer ${JSON.stringify(answer)} 在课文正文第 ${line} 行原样出现（${reasons.join("且")}）；这会把抄写代码/标识符当成理解。请改成解释概念的题，或用 --skip-check exact-answer（代价：${TEACHING_CHECKS["exact-answer"].cost}）。原文位置：${JSON.stringify(excerpt)}`,
  );
}

function checkTitleAnswer(lesson, exercise, where, problems) {
  const answer = exercise.expectedAnswer;
  const title = lesson.title ?? "";
  const directMatch = title.includes(answer);
  const normalizedAnswer = stripPunctuation(answer);
  const normalizedTitle = stripPunctuation(title);
  const normalizedMatch = normalizedAnswer.length > 0 && normalizedTitle.includes(normalizedAnswer);
  if (!directMatch && !normalizedMatch) return;

  const matchKind = directMatch ? "原样" : "去掉标点后";
  problems.push(
    `${where}: expectedAnswer ${JSON.stringify(answer)} 已由本节标题${matchKind}直接给出（标题：${JSON.stringify(title)}）；题目测到的是抄标题，不是理解。请换一个需要回忆或解释的问法，或用 --skip-check title-answer（代价：${TEACHING_CHECKS["title-answer"].cost}）。`,
  );
}

/** Remove fenced code while keeping offsets and line breaks useful for reports. */
function withoutFencedCode(text) {
  return text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
}

/**
 * This check deliberately does not guess a Chinese technology vocabulary.
 * It only considers a CJK phrase that the author themselves presented as a
 * definition (for example `**运行时（runtime）**：...` or `运行时：...`).
 * That catches "term first, explanation later" without flagging every ordinary
 * noun in a lesson. An unmarked term is a known blind spot; a language model or
 * explicit author annotation would be the next step, not a larger hard-coded
 * word list.
 */
function checkAnalogyOrder(lesson, where, problems) {
  const content = lesson.content ?? "";
  const analogyIndex = content.indexOf("## 一个类比");
  if (analogyIndex === -1) return;

  const text = withoutFencedCode(content);
  for (const term of definedTerms(text)) {
    const firstIndex = text.indexOf(term);
    if (firstIndex === -1 || firstIndex >= analogyIndex) continue;
    const paragraph = paragraphAt(text, firstIndex);
    if (hasInlineExplanation(paragraph.text, paragraph.relativeIndex, term)) continue;

    const line = lineNumberAt(content, firstIndex);
    problems.push(
      `${where}: 术语“${term}”在类比段（第 ${lineOfHeading(content, "## 一个类比")} 行）之前首次出现于正文第 ${line} 行，但同一段没有先给解释；请先用一个类比/白话说明，再引入这个词，或用 --skip-check analogy-order（代价：${TEACHING_CHECKS["analogy-order"].cost}）。`,
    );
  }
}

function definedTerms(text) {
  const terms = new Set();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const withoutBullet = trimmed.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, "");
    const withoutFormatting = withoutBullet.replace(/\*\*/g, "").trim();
    const delimiter = withoutFormatting.match(/^(.+?)\s*[：:]\s*\S/);
    if (delimiter) addDefinedTerm(terms, delimiter[1]);

    const inlineDefinition = withoutBullet.match(
      /(?:^|[，。；、\s])(?:\*\*)?([^*\n]{2,20})(?:\*\*)?\s*[（(][^）)\n]{1,80}[）)]\s*(?:[：:]|是|就是|指|指的是|用来|负责|表示|意味着)/u,
    );
    if (inlineDefinition) addDefinedTerm(terms, inlineDefinition[1]);

    const markedDefinition = withoutBullet.match(
      /\*\*([^*\n]{2,24})\*\*\s*(?:[：:]|——|—|–|是|就是|指|指的是|用来|负责|表示|意味着)/u,
    );
    if (markedDefinition) addDefinedTerm(terms, markedDefinition[1]);
  }
  return terms;
}

function addDefinedTerm(terms, raw) {
  const term = raw
    .replace(/[`*_]/g, "")
    .split(/[（(]/, 1)[0]
    .trim();
  if (
    term.length < 2 ||
    term.length > 16 ||
    !/\p{Script=Han}/u.test(term) ||
    IGNORED_TERM_LABELS.has(term) ||
    /[，。；、？！]/u.test(term) ||
    /^\d/.test(term)
  ) {
    return;
  }
  terms.add(term);
}

function paragraphAt(text, index) {
  const startMarker = text.lastIndexOf("\n\n", index);
  const endMarker = text.indexOf("\n\n", index);
  const start = startMarker === -1 ? 0 : startMarker + 2;
  const end = endMarker === -1 ? text.length : endMarker;
  return { text: text.slice(start, end), relativeIndex: index - start };
}

function hasInlineExplanation(paragraph, relativeIndex, term) {
  const after = paragraph.slice(relativeIndex + term.length);
  const before = paragraph.slice(Math.max(0, relativeIndex - 32), relativeIndex);
  return (
    /^\s*(?:[：:]|——|—|–|[-－]|[（(][^）)\n]{0,80}[）)])/.test(after) ||
    /^\s*(?:是|就是|指|指的是|用来|负责|表示|意味着|叫作|也就是|可以理解为)/.test(after) ||
    /(?:是|就是|指|指的是|叫作|也就是|可以理解为)\s*$/.test(before)
  );
}

function checkTermDrift(lesson, where, problems) {
  const content = withoutFencedCode(lesson.content ?? "");
  const text = `${lesson.title ?? ""}\n${content}`;
  for (const pair of SHAPE_DATA.termDrift?.pairs ?? []) {
    if (!(pair.terms ?? []).every((term) => text.includes(term))) continue;
    if (hasExplicitTermRelation(text, pair)) continue;

    const locations = pair.terms.map((term) => {
      const index = text.indexOf(term);
      const titleLength = (lesson.title ?? "").length;
      return index <= titleLength
        ? "标题"
        : `正文第 ${lineNumberAt(content, index - titleLength - 1)} 行`;
    });
    problems.push(
      `${where}: 同一节课同时用了“${pair.terms[0]}”（${locations[0]}）和“${pair.terms[1]}”（${locations[1]}），但没有一句话说明它们是同一个东西或有何区别；请统一叫法或补一句关系说明，或用 --skip-check term-drift（代价：${TEACHING_CHECKS["term-drift"].cost}）。`,
    );
  }
}

function hasExplicitTermRelation(text, pair) {
  const groups = [pair.terms, ...(pair.aliasPairs ?? [])];
  for (const group of groups) {
    for (const paragraph of paragraphsOf(text)) {
      const indexes = group.map((term) => paragraph.indexOf(term));
      if (indexes.some((index) => index === -1)) continue;
      const left = Math.min(...indexes);
      const right = Math.max(...indexes);
      const longestTerm = Math.max(...group.map((term) => term.length));
      const relationSpan = paragraph.slice(left, right + longestTerm + 36);
      const hasParentheticalPair = group.some((term, index) => {
        const other = group.find((_, otherIndex) => otherIndex !== index);
        if (!other) return false;
        const first = escapeRegExp(term);
        const second = escapeRegExp(other);
        return new RegExp(
          `${first}\\s*[（(][^）)]{0,48}${second}[^）)]{0,48}[）)]|${second}\\s*[（(][^）)]{0,48}${first}[^）)]{0,48}[）)]`,
        ).test(relationSpan);
      });
      if (
        (SHAPE_DATA.termDrift?.relationCues ?? []).some((cue) => relationSpan.includes(cue)) ||
        hasParentheticalPair ||
        /[（(][^）)]{0,48}(?:\/|／)[^）)]{0,48}[）)]/.test(relationSpan) ||
        /(?:\/|／)/.test(relationSpan)
      ) {
        return true;
      }
    }
  }
  return false;
}

function paragraphsOf(text) {
  return text.split(/\n\n+/).filter((paragraph) => paragraph.trim());
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripPunctuation(text) {
  return text.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "");
}

function lineNumberAt(text, index) {
  return text.slice(0, Math.max(0, index)).split("\n").length;
}

function lineOfHeading(text, heading) {
  const index = text.indexOf(heading);
  return index === -1 ? "?" : lineNumberAt(text, index);
}

function excerptAt(text, index) {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEnd = text.indexOf("\n", index);
  return text
    .slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
    .trim()
    .slice(0, 160);
}
