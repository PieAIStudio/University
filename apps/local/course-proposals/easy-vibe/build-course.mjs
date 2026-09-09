#!/usr/bin/env node
/**
 * Assemble the per-unit proposals into one `course create` input.
 *
 * Each unit was written as its own file so it could be gated on its own and
 * so two writers could work at once. `course add-lessons` only ever appends,
 * so building the whole course in one `course create` is what puts the units
 * in teaching order rather than in the order they happened to be finished —
 * the previous adoption learned that the hard way and had to delete a landed
 * course to reorder it.
 *
 * Usage:
 *   node apps/local/course-proposals/easy-vibe/build-course.mjs
 *
 * Writes `full-course.json` next to this file. Landing it is a separate,
 * deliberate act — see LANDING.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Teaching order. The array is the source of truth for unit sequence. */
const ORDER = [
  "you-can-already-make-it",
  "tools-and-talking",
  "is-the-idea-worth-it",
  "narrow-it-down",
  "build-the-first-version",
  "when-it-does-not-run",
  "give-it-ai",
  "make-it-remember",
  "let-others-open-it",
  "getting-paid",
  "from-runs-to-usable",
  "when-vibing-stops-working",
];

const COURSE = {
  id: "from-idea-to-live",
  title: "一个念头，怎么变成别人能打开的东西",
  description:
    "写给没写过代码、但手里有一个想做的东西的人。从判断这个念头值不值得做，一路做到一个别人点得开的网址。",
  audience: "没写过代码，会用电脑，手里有一个自己想做的东西的人",
  objectives: [
    "判断自己那个念头是别人真的在费劲解决的事，还是自己想出来的",
    "把念头收敛成一版说得清、做得完的东西",
    "让 AI 做出这一版，并说清它哪里不对",
    "给它接上模型、存下数据、发到网上、收到钱",
  ],
};

const units = [];
const seen = new Map();
let lessons = 0;
let cards = 0;
let exercises = 0;

/** One id may be claimed once across the whole course, or the write fails late. */
function claim(kind, id, where) {
  const key = `${kind}:${id}`;
  if (seen.has(key)) {
    throw new Error(`${kind} id "${id}" used twice: ${seen.get(key)} and ${where}`);
  }
  seen.set(key, where);
}

for (const [index, unitId] of ORDER.entries()) {
  const path = join(here, `${unitId}.json`);
  let proposal;
  try {
    proposal = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`missing or unreadable unit file for "${unitId}": ${error.message}`);
  }

  const { unit } = proposal;
  if (!unit || unit.id !== unitId) {
    throw new Error(`${unitId}.json declares unit "${unit?.id}", which does not match its filename`);
  }
  if (!unit.title || !unit.objective) {
    throw new Error(`unit "${unitId}" needs both a title and an objective to be created`);
  }

  claim("unit", unit.id, path);
  for (const lesson of proposal.lessons) {
    claim("lesson", lesson.id, `${unitId}/${lesson.id}`);
    for (const card of lesson.cards ?? []) claim("card", card.id, `${unitId}/${lesson.id}`);
    for (const ex of lesson.exercises ?? []) claim("exercise", ex.id, `${unitId}/${lesson.id}`);
    cards += (lesson.cards ?? []).length;
    exercises += (lesson.exercises ?? []).length;
  }
  lessons += proposal.lessons.length;

  units.push({
    id: unit.id,
    title: unit.title,
    objective: unit.objective,
    /* Each unit follows the one before it, so the ladder is explicit in the
       data rather than implied by array position. */
    prerequisiteUnitIds: index === 0 ? [] : [ORDER[index - 1]],
    lessons: proposal.lessons,
  });
}

const out = {
  schemaVersion: 1,
  proposalId: "easy-vibe-from-idea-to-live",
  course: { ...COURSE, units },
};

const target = join(here, "full-course.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);

console.log(`${target}`);
console.log(`  单元 ${units.length} · 小节 ${lessons} · 卡片 ${cards} · 练习 ${exercises}`);
console.log(`  唯一 id ${seen.size}`);
