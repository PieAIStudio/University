#!/usr/bin/env node
/**
 * The PRIMM lesson production line: outline → teaching design → independent
 * beginner review → fix → Flash polish → native revision proposal.
 *
 * It is a drafting tool, not a second producer: it never writes a course
 * revision itself. `assemble --apply` hands the proposal to the native course
 * CLI (open-for-edit → revise), exactly as a person would. Every model call
 * keeps its prompt, raw output and receipt under the run directory, and every
 * hand edit must be logged with `note` so an automated result is never
 * confused with a manual one.
 *
 * The teaching rules are not in this file. They live in the write-lesson
 * skill's `references/teaching-contract.md` and are pasted verbatim into each
 * role's prompt, so a rule changes in one place.
 *
 *   node scripts/primm-pipeline.mjs <stage> --lesson <unit>/<lesson> [options]
 *   stages: packet | write | check | detect | fix | polish | assemble | run | status | note
 */
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  appendFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadUniversityLocalConfig } from "../.university-local-build/server/config/load-config.js";
import {
  isStructuralStepPath,
  realWorldPlanSchema,
  renderStepLesson,
  stepAuthoringShape,
  stepModifyPrompt,
  stepSampleRequests,
  stepTeachingIssues,
} from "./primm-pipeline-step-support.mjs";
import { prepareUnpublished, prepareUnpublishedPreview } from "./primm-pipeline-authoring.mjs";
import { contentPaths } from "../../../scripts/content-root.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(moduleRoot, "../..");
const configuredContent = contentPaths({ projectRoot: repoRoot });
const skillRoot = join(moduleRoot, ".agents/skills/write-lesson");
const STUDY = "ai-literacy";
const COURSE = "understanding-ai";
const TODAY = new Date().toISOString().slice(0, 10);

// ── Models: roles, not versions. Preflight is `models.md`; override by env. ──
// Writer fallback when Grok's quota is gone: PRIMM_WRITER_CLI=agy (Claude via
// Antigravity) or codex. The choice is recorded in every receipt; the Detector
// must stay a different family from whichever Writer runs.
// Default "auto": Grok while its quota lasts, then Claude via agy for an hour.
const WRITER_CLI = process.env.PRIMM_WRITER_CLI ?? "auto";
const WRITER_DEFAULT = { grok: "grok-4.6", agy: "claude-opus-4-6-thinking", codex: "gpt-5.6-luna" };
const WRITER_EFFORT = { grok: "xhigh", agy: "high", codex: "max" };
const writerSpec = (cli) => ({
  cli,
  model: process.env.PRIMM_WRITER_MODEL ?? WRITER_DEFAULT[cli],
  effort: process.env.PRIMM_WRITER_EFFORT ?? WRITER_EFFORT[cli],
});
// A family whose quota ran out is skipped for an hour: grok → Claude (agy) → codex.
const EXHAUSTED = (cli) => join(repoRoot, `.scratch/primm-engine/.${cli}-exhausted`);
const exhausted = (cli) =>
  existsSync(EXHAUSTED(cli)) &&
  Date.now() - Number(readFileSync(EXHAUSTED(cli), "utf8")) < 60 * 60_000;
const nextWriter = () => ["grok", "agy", "codex"].find((cli) => !exhausted(cli)) ?? "codex";
const MODELS = {
  writer: writerSpec(WRITER_CLI === "auto" ? "grok" : WRITER_CLI),
  detector: {
    cli: "agy",
    model: process.env.PRIMM_DETECTOR_MODEL ?? "gemini-3.8-flash-high",
    effort: "high",
  },
  polisher: { cli: "agy", model: "gemini-3.8-flash-high", effort: "high" },
  // Research is volume work with web access; the scarce Grok quota stays on writing.
  researcher: {
    cli: process.env.PRIMM_RESEARCH_CLI ?? "agy",
    model: process.env.PRIMM_RESEARCH_MODEL ?? "gemini-3.1-pro-high",
    effort: "high",
  },
};

// ── Small utilities ──────────────────────────────────────────────────────────
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};
const sha = (value) => createHash("sha256").update(value).digest("hex");
function args() {
  const [stage, ...rest] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (!key.startsWith("--")) throw Error(`Unexpected argument ${key}`);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) options[key.slice(2)] = true;
    else options[key.slice(2)] = rest[++i];
  }
  return { stage, options };
}
function authoringProjectRoot() {
  const root = resolve(process.env.PRIMM_PROJECT_ROOT ?? moduleRoot);
  return existsSync(root) ? realpathSync(root) : root;
}
function studiesRoot() {
  // The same native resolver owns optional personal config, environment priority
  // and the root safety boundary for packet reads and CLI writes.
  // A PRIMM run with an explicit project root is an isolated authoring shelf;
  // do not let a caller's content checkout redirect that temporary project.
  const env = { ...process.env };
  if (env.PRIMM_PROJECT_ROOT && !env.UNIVERSITY_LOCAL_STUDIES_ROOT) {
    delete env.UNIVERSITY_COURSE_ROOT;
  }
  const config = loadUniversityLocalConfig({
    projectRoot: authoringProjectRoot(),
    env,
  });
  return realpathSync(config.studiesRoot);
}
const latest = (dir) =>
  readdirSync(join(dir, "revisions"))
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .at(-1);

// ── Stage: packet ────────────────────────────────────────────────────────────
/** Everything a writer may use, gathered deterministically from native storage. */
function buildPacket(unitId, lessonId, mode, ownerNotes) {
  const root = studiesRoot();
  const courseDir = join(root, STUDY, "courses", COURSE);
  const course = readJson(join(courseDir, "course.json"));
  const unitOrder = course.units ?? course.unitIds;
  const unitTitle = (id) => {
    const file = join(courseDir, "units", id, "unit.json");
    return existsSync(file) ? readJson(file).title : id;
  };
  const lessonDir = join(courseDir, "units", unitId, "lessons", lessonId);
  const rev = latest(lessonDir);
  const manifest = readJson(join(lessonDir, "revisions", String(rev), "manifest.json"));
  const content = readFileSync(join(lessonDir, "revisions", String(rev), "content.md"), "utf8");
  const lessonTitle = (unit, id) => {
    const dir = join(courseDir, "units", unit, "lessons", id);
    return readJson(join(dir, "revisions", String(latest(dir)), "manifest.json")).title;
  };
  const unitLessons = (unit) => {
    const file = join(courseDir, "units", unit, "unit.json");
    const ids = existsSync(file)
      ? (readJson(file).lessons ?? readJson(file).lessonIds)
      : readdirSync(join(courseDir, "units", unit, "lessons"));
    return ids.map((id) => ({ id, title: lessonTitle(unit, id) }));
  };
  const unitIndex = unitOrder.indexOf(unitId);
  const before = unitOrder.slice(0, unitIndex).map((id) => ({
    unit: unitTitle(id),
    lessons: unitLessons(id).map((l) => l.title),
  }));
  const siblings = unitLessons(unitId);
  const lessonIndex = siblings.findIndex((lesson) => lesson.id === lessonId);
  if (unitIndex < 0 || lessonIndex < 0)
    throw Error("Lesson is absent from its native course outline");
  const priorSiblings = siblings.slice(0, lessonIndex);
  if (priorSiblings.length)
    before.push({ unit: unitTitle(unitId), lessons: priorSiblings.map((lesson) => lesson.title) });
  const examples = priorSiblings.flatMap((lesson) => {
    const dir = join(courseDir, "units", unitId, "lessons", lesson.id);
    const example = readJson(join(dir, "revisions", String(latest(dir)), "manifest.json"));
    const activity = example.activities?.find(
      (item) => item.kind === "primm" && item.experienceVersion === 3,
    );
    return activity
      ? [{ lessonId: lesson.id, revision: latest(dir), activity: stripLocales(activity) }]
      : [];
  });
  // The verified-evidence library: every source already checked in this study.
  const library = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) walk(path);
      else if (name.name === "manifest.json" && path.includes("/revisions/")) {
        const m = readJson(path);
        const r = Number(path.split("/revisions/")[1].split("/")[0]);
        for (const evidence of m.evidence ?? []) {
          if (!evidence.sourceUrl) continue;
          const prior = library.get(evidence.sourceUrl);
          if (!prior || prior.rev < r) library.set(evidence.sourceUrl, { rev: r, evidence });
        }
      }
    }
  };
  walk(join(root, STUDY, "courses"));
  const libraryEntries = [...library.values()].map(({ evidence }, n) => ({
    id: `lib-${sha(evidence.sourceUrl).slice(0, 8)}`,
    url: evidence.sourceUrl,
    title: evidence.sourceTitle,
    publisher: evidence.provenance?.publisher,
    accessedOn: evidence.provenance?.accessedOn,
    publishedOn: evidence.provenance?.publishedOn,
    sourceAuthority: evidence.sourceAuthority,
    evidence,
    supports: evidence.provenance?.supports,
    limitations: evidence.provenance?.limitations,
    order: n,
  }));
  const researchFile = join(runDir(lessonId), "research.accepted.json");
  const researched = existsSync(researchFile) ? readJson(researchFile).sources : [];
  // The writer cannot see or hear media. It may only rely on host-verified facts:
  // what a recording says, what a photo shows, which image regions were checked.
  const factsFile = join(repoRoot, ".scratch/primm-engine/asset-facts.json");
  const facts = existsSync(factsFile) ? readJson(factsFile) : {};
  const assets = (manifest.assets ?? []).map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    mime: asset.mime,
    alt: asset.alt,
    caption: asset.caption,
    ...(facts[asset.id] ? { verifiedFacts: facts[asset.id] } : {}),
  }));
  const operations = ["text"];
  if (assets.some((a) => a.mime?.startsWith("image/"))) operations.push("vision");
  if (assets.some((a) => /^(audio|video)\//.test(a.mime ?? "")))
    operations.push("transcribe", "audio-text");
  const current = (manifest.activities ?? []).find((a) => a.kind === "primm");
  return {
    createdAt: new Date().toISOString(),
    mode,
    experienceVersion: 3,
    storage: { projectRoot: authoringProjectRoot(), studiesRoot: root },
    lesson: { studyId: STUDY, courseId: COURSE, unitId, lessonId, revision: rev },
    course: { title: course.title, description: course.description, audience: course.audience },
    unit: {
      title: unitTitle(unitId),
      objective: readJson(join(courseDir, "units", unitId, "unit.json")).objective,
      lessons: unitLessons(unitId),
    },
    learnerAlreadyMet: before,
    formExample: examples.length
      ? {
          instruction:
            "这是前一关经 Owner 接受的原生第3版样板。只学习结构、每屏一个动作和老师接话的方式；不得沿用人物、情境、材料、请求或句子。",
          ...examples[0],
        }
      : null,
    outline: {
      title: manifest.title,
      note:
        mode === "new"
          ? "这是旧版课文，只作为大纲：它告诉你这节课要教的能力。旧课站在设计者角度写成，不要沿用它的情境、材料和措辞。"
          : "这是一节已上线的样板课（修订模式）。保留它做对的事，按 ownerNotes 和教学合同重做做错的事。",
      oldContent: content.slice(0, 6000),
      ...(current ? { currentActivity: stripLocales(current) } : {}),
    },
    ownerNotes: ownerNotes ?? null,
    library: [...libraryEntries, ...researched],
    assets,
    operations,
    cardIds: manifest.cardIds,
    exerciseIds: manifest.exerciseIds,
  };
}
function stripLocales(value) {
  if (Array.isArray(value)) return value.map(stripLocales);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => k !== "locales")
      .map(([k, v]) => [k, stripLocales(v)]),
  );
}
function runDir(lessonId) {
  // PRIMM_RUN_ROOT lets a comparison run (e.g. two Writer families) keep separate receipts.
  return join(process.env.PRIMM_RUN_ROOT ?? join(repoRoot, ".scratch/primm-engine"), lessonId);
}

// ── Model calls ──────────────────────────────────────────────────────────────
function spawnCapture(command, argv, { cwd, input, timeoutMs }) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const child = spawn(command, argv, {
      cwd,
      shell: false,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (s) => (stdout += s));
    child.stderr.setEncoding("utf8").on("data", (s) => (stderr += s));
    if (input !== undefined) child.stdin.end(input);
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolveRun({ code, signal, stdout, stderr, ms: Date.now() - started });
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolveRun({ code: -1, signal: null, stdout, stderr: String(error), ms: 0 });
    });
  });
}
/**
 * One structured model call with bounded retries. Every attempt keeps its own
 * prompt, raw output and receipt. A retry happens on rate limiting, a missing or
 * truncated result, or an `accept` veto (e.g. a report pasted into lesson fields).
 */
async function callModel(role, prompt, schema, outBase, { webSearch = false, accept } = {}) {
  let spec = role === "writer" && WRITER_CLI === "auto" ? writerSpec(nextWriter()) : MODELS[role];
  let release = await acquireSlot(role, spec);
  let rejectedShape = null;
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const base = attempt === 1 ? outBase : `${outBase}.retry${attempt}`;
      const attemptPrompt = rejectedShape
        ? `${prompt}\n\n## 上一次交稿未通过结构检查\n${rejectedShape}\n请返回修正后的完整 JSON，不写检查报告。`
        : prompt;
      const { parsed, receipt, stderr } = await callOnce(spec, role, attemptPrompt, schema, base, {
        webSearch,
      });
      if (receipt.parsed && receipt.exitCode !== 0)
        throw Error(
          `A structured result survived a transport failure: ${base}.raw.txt. Inspect/reparse that receipt before starting another model call.`,
        );
      const quotaGone =
        (spec.cli === "grok" && /usage limit/i.test(stderr)) ||
        (spec.cli === "agy" && /RESOURCE_EXHAUSTED/.test(stderr)) ||
        (spec.cli === "codex" && /usage limit|quota.*exceed|insufficient.*credit/i.test(stderr));
      if (quotaGone && role === "writer" && WRITER_CLI === "auto" && spec.cli !== "codex") {
        // This family's quota is gone: mark it for an hour and fall to the next one.
        writeFileSync(EXHAUSTED(spec.cli), String(Date.now()));
        writeJson(`${base}.rejected.json`, {
          reason: `${spec.cli} quota exhausted; switching writer family`,
        });
        release();
        spec = writerSpec(nextWriter());
        release = await acquireSlot(role, spec);
        attempt = 0;
        continue;
      }
      const veto = parsed !== undefined && accept ? accept(parsed) : null;
      if (parsed !== undefined && !veto) {
        writeJson(`${outBase}.receipt.json`, { ...receipt, attempts: attempt });
        writeJson(`${outBase}.json`, parsed);
        return parsed;
      }
      writeJson(`${base}.rejected.json`, {
        reason: veto ?? "no structured result",
        stderrTail: stderr.slice(-400),
      });
      if (quotaGone)
        throw Error(`${role} (${spec.model}) quota exhausted; stop and retain ${base}.stderr.log`);
      rejectedShape = veto;
      if (attempt < 3)
        await new Promise((r) =>
          setTimeout(r, /429|RESOURCE_EXHAUSTED|rate/i.test(stderr) ? attempt * 120_000 : 5_000),
        );
    }
    throw Error(
      `${role} (${spec.model}) produced no acceptable structured result after 3 attempts; see ${outBase}*.rejected.json`,
    );
  } finally {
    release();
  }
}
/** Cross-process cap on concurrent Claude writer calls: agy rate-limits a burst (429). */
async function acquireSlot(role, spec) {
  const pool =
    spec.cli === "grok"
      ? "grok"
      : spec.cli === "agy" && spec.model.startsWith("claude-")
        ? "claude"
        : null;
  if (!pool) return () => {};
  const root = join(repoRoot, ".scratch/primm-engine/.slots");
  mkdirSync(root, { recursive: true });
  const limit = pool === "grok" ? 2 : Number(process.env.PRIMM_WRITER_SLOTS ?? 4);
  for (;;) {
    for (let i = 0; i < limit; i++) {
      const slot = join(root, `${pool}-${i}`);
      try {
        mkdirSync(slot);
        writeFileSync(join(slot, "pid"), String(process.pid));
        return () => rmSync(slot, { recursive: true, force: true });
      } catch {
        // A slot held by a dead process is reclaimed.
        try {
          const pid = Number(readFileSync(join(slot, "pid"), "utf8"));
          process.kill(pid, 0);
        } catch {
          rmSync(slot, { recursive: true, force: true });
        }
      }
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
}
async function callOnce(spec, role, prompt, schema, outBase, { webSearch }) {
  const cwd = join(repoRoot, ".scratch/primm-engine/.sandbox");
  mkdirSync(cwd, { recursive: true });
  if (spec.cli === "codex")
    prompt += `\n\n## 输出格式\n\n只输出一个 JSON 对象，严格符合下面的 JSON Schema，不要任何其他文字。\n\n\`\`\`json\n${JSON.stringify(schema)}\n\`\`\`\n`;
  writeFileSync(`${outBase}.prompt.md`, prompt);
  writeJson(`${outBase}.schema.json`, schema);
  let argv;
  if (spec.cli === "grok") {
    argv = [
      "-m",
      spec.model,
      "--effort",
      spec.effort,
      "--no-subagents",
      "--json-schema",
      JSON.stringify(schema),
      "--prompt-file",
      `${outBase}.prompt.md`,
      ...(webSearch ? [] : ["--disable-web-search", "--tools", ""]),
    ];
  } else if (spec.cli === "codex") {
    argv = [
      "exec",
      "-m",
      spec.model,
      "-c",
      `model_reasoning_effort="${spec.effort}"`,
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "-o",
      `${outBase}.last.txt`,
      prompt,
    ];
  } else {
    argv = [
      "-p",
      prompt,
      "--model",
      spec.model,
      ...(spec.model.startsWith("claude-") ? [] : ["--effort", spec.effort]),
      "--disable-slash-commands",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(schema),
      "--print-timeout",
      "40m",
    ];
  }
  const result = await spawnCapture(spec.cli, argv, {
    cwd,
    timeoutMs: 45 * 60_000,
    ...(spec.cli === "codex" ? { input: "" } : {}),
  });
  writeFileSync(`${outBase}.raw.txt`, result.stdout);
  writeFileSync(`${outBase}.stderr.log`, result.stderr);
  let parsed;
  let usage;
  try {
    if (spec.cli === "codex") {
      // Codex has no structured-output mode compatible with this schema; take the
      // final message's JSON object and let the zod checks in `check` judge it.
      const last = readFileSync(`${outBase}.last.txt`, "utf8");
      const body = last.slice(last.indexOf("{"), last.lastIndexOf("}") + 1);
      parsed = JSON.parse(body);
      throw { done: true };
    }
    const json = JSON.parse(result.stdout);
    parsed = spec.cli === "grok" ? json.structuredOutput : json.structured_output;
    if (spec.cli === "agy" && json.status !== "SUCCESS") parsed = undefined;
    // agy sometimes returns the object only inside the text response; a truncated
    // one fails JSON.parse and is retried, a complete one is judged by `check`.
    if (spec.cli === "agy" && parsed === undefined && typeof json.response === "string") {
      const text = json.response.replace(/^[\s\S]*?```json\s*/, "").replace(/```[\s\S]*$/, "");
      try {
        parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        // agy's submit tool appends its own bookkeeping fields to the object.
        delete parsed.toolAction;
        delete parsed.toolSummary;
      } catch {
        parsed = undefined;
      }
    }
    usage = json.usage ?? json.modelUsage ?? null;
    if (json.total_cost_usd !== undefined) usage = { ...usage, costUsd: json.total_cost_usd };
  } catch (error) {
    if (!error?.done) parsed = undefined;
  }
  const receipt = {
    role,
    cli: spec.cli,
    model: spec.model,
    effort: spec.model.startsWith("claude-") ? null : spec.effort,
    exitCode: result.code,
    signal: result.signal,
    ms: result.ms,
    promptSha256: sha(prompt),
    parsed: parsed !== undefined,
    usage,
    finishedAt: new Date().toISOString(),
  };
  writeJson(`${outBase}.receipt.json`, receipt);
  return { parsed: result.code === 0 ? parsed : undefined, receipt, stderr: result.stderr };
}
/** Recover a complete result that a late transport error (e.g. 429 after streaming) hid. */
async function stageReparse(dir, S, name) {
  const raw = JSON.parse(readFileSync(join(dir, `${name}.raw.txt`), "utf8"));
  let parsed = raw.structured_output;
  if (!parsed && typeof raw.response === "string") {
    const text = raw.response.replace(/^[\s\S]*?```json\s*/, "").replace(/```[\s\S]*$/, "");
    parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  }
  delete parsed.toolAction;
  delete parsed.toolSummary;
  // Mechanical format repair only: string-encoded objects and a null optional note.
  for (const key of ["plan", "sources", "activity", "cards", "exercise", "samples", "resolutions"])
    if (typeof parsed[key] === "string") parsed[key] = JSON.parse(parsed[key]);
  if (parsed.plan && parsed.plan.caseNeeded === null) parsed.plan.caseNeeded = "";
  const schema = name.startsWith("fixer") ? S.zod.fixed : S.zod.draft;
  // Content-level schema errors (e.g. a refine) are left for `check` and the fixer;
  // only a result without the lesson's top-level shape is unrecoverable.
  const check = schema.safeParse(parsed);
  const structural = check.success
    ? []
    : check.error.issues.filter((issue) => issue.code === "invalid_type" && issue.path.length <= 1);
  const veto = lessonVeto(parsed);
  if (structural.length || veto)
    throw Error(`Not recoverable: ${veto ?? JSON.stringify(structural).slice(0, 500)}`);
  const version = name.startsWith("writer") ? 1 : Number(name.split(".v")[1]);
  writeJson(join(dir, `${name}.json`), parsed);
  writeJson(join(dir, `draft.v${version}.json`), parsed);
  log(
    dir,
    `reparse ${name}: result recovered from raw output after a late transport error; schema=${check.success ? "valid" : "needs-check"}, no veto; native check is still required`,
  );
}
/** A lesson draft whose learner text talks about the pipeline is not a lesson. */
const PIPELINE_WORDS =
  /JSON|resolution|finding|schema|packet|教学合同|检查者|机器检查|\bF\d{1,2}\b|activity\.|plan\./;
function lessonVeto(draft) {
  const texts = [];
  const walk = (v) => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk({ title: draft.title, activity: draft.activity, cards: draft.cards });
  const hit = texts.find((t) => PIPELINE_WORDS.test(t));
  return hit ? `learner-visible text talks about the pipeline: ${hit.slice(0, 120)}` : null;
}

// ── Output shapes ────────────────────────────────────────────────────────────
async function schemas() {
  const { PrimmPayloadSchema } = await import(
    pathToFileURL(join(repoRoot, "packages/core/dist/domain/schemas.js")).href
  );
  const { z } = await import(
    pathToFileURL(join(repoRoot, "packages/core/node_modules/zod/index.js")).href
  );
  const text = z.string().min(1);
  const activity = stepAuthoringShape(PrimmPayloadSchema, z);
  const plan = z
    .object({
      capability: text.describe("一句话：学完能在生活里做成什么"),
      situations: z
        .array(
          z
            .object({
              moment: text.describe("谁、什么时候、手里有什么、想做成什么"),
              withoutAi: text.describe("不用 AI 时平常怎么办，麻烦在哪"),
              commonThisMonth: z.boolean(),
              simplerWay: text.describe("有没有更简单、根本不用 AI 的办法；没有就写“没有”"),
              keep: z.boolean(),
            })
            .strict(),
        )
        .min(5),
      practice: text.describe("选中的练习情境（P–M）"),
      make: text.describe("选中的独立任务情境，与练习不同"),
      caseSourceId: z.string().nullable().describe("library 里选中的真实案例 id；都不合适填 null"),
      caseNeeded: z.string().describe("caseSourceId 为 null 时，需要什么样的真实案例"),
      caseRole: text.describe("这个案例证明了什么，学习者为什么因此愿意学"),
      predictUncertainty: text.describe("预想问题针对的是初学者哪一个真实的拿不准"),
      investigateAct: text.describe("探究要让他弄懂什么，为什么选这个玩法"),
      teacherThread: text.describe("用三四句话讲清整节课老师带他做的这一件小事"),
      realWorld: realWorldPlanSchema(z),
    })
    .strict();
  const draft = z
    .object({
      plan,
      title: text.describe("课的标题：学习者会问的一个问题，≤30字"),
      sources: z
        .array(
          z
            .object({
              id: z.string().describe("library 里的 id"),
              label: text.describe("链接上显示的字：谁的什么，大白话"),
              note: text.describe("一句话：这个来源在本课里证明什么"),
            })
            .strict(),
        )
        .min(1)
        .max(4),
      activity,
      cards: z
        .array(z.object({ front: text, back: text }).strict())
        .describe("数量必须等于 packet.cardIds 的数量"),
      exercise: z
        .object({ title: text, rubric: z.array(text).min(2).max(4) })
        .strict()
        .describe("Make 的评分标准，语义判断"),
      samples: z
        .object({
          makePrompt: text.describe("一个普通初学者在 Make 这一步大概会写的请求，不必完美"),
        })
        .strict(),
    })
    .strict();
  const fixed = draft.extend({
    resolutions: z
      .array(
        z
          .object({
            finding: text,
            action: z.enum(["fixed", "rejected"]),
            detail: text,
          })
          .strict(),
      )
      .describe("逐条回应检查者和机器检查提出的问题"),
  });
  const finding = z
    .object({
      code: z.string().describe("F1–F15"),
      severity: z.enum(["blocker", "major", "minor"]),
      where: text,
      quote: z.string(),
      problem: text,
    })
    .strict();
  const detector = z
    .object({
      screens: z
        .array(
          z
            .object({
              screen: text,
              whyClear: z.boolean(),
              whatToDoClear: z.boolean(),
              whatHappenedClear: z.boolean(),
              soundsLikeTeacher: z.boolean(),
              innerVoice: text.describe("王阿姨读这一屏时心里的话"),
            })
            .strict(),
        )
        .min(5),
      childReadingProblems: z.array(z.object({ quote: text, why: text }).strict()),
      findings: z.array(finding),
      teacherThread: text.describe("老师连读测试的结论"),
      realNeed: text.describe("练习和独立任务的情境，普通人真会遇到吗"),
      verdict: z.enum(["ready", "revise"]),
    })
    .strict();
  const json = (schema) => z.toJSONSchema(schema, { unrepresentable: "any" });
  return {
    zod: { draft, fixed, detector },
    draft: json(draft),
    fixed: json(fixed),
    detector: json(detector),
    z,
  };
}

// ── Prompts ──────────────────────────────────────────────────────────────────
const contract = () => readFileSync(join(skillRoot, "references/teaching-contract.md"), "utf8");
const NO_TOOLS =
  "不要使用任何工具，不要读写文件，不要上网，不要运行命令。需要的一切都在下面。直接返回符合 JSON 结构的结果。";
function writerPrompt(packet) {
  return `# 写一节 PRIMM 课

你是 University 的写课老师，为普通成年人写一节 AI 入门互动课。${NO_TOOLS}

先写 plan（动笔前的思考，给检查者看，必须诚实），再写课。

## 教学合同（必须遵守）

${contract()}

## 这节课的输入包

\`\`\`json
${JSON.stringify(packet, null, 2)}
\`\`\`

## 交稿要求

- plan.situations 至少 5 个，逐个做第 1 节的两道淘汰题；practice 和 make 选不同的情境。
- 真实案例只能从 library 里选（caseSourceId）。都不合适时填 null，在 caseNeeded 写清需要什么案例，
  其余照常写完，开场先不提案例。sources 只列本课真正用到的 library 条目。
- starter.operation 和 make.operation 只能从 packet.operations 里选；assetIds 只能用 packet.assets 里的 id。
- 你看不见图片、听不见录音。关于它们的内容，只能依据 packet.assets[].verifiedFacts；
  point 的区域坐标必须原样使用 verifiedFacts.regions 里的某几个，不猜坐标。没有核实区域就不用 point。
- 材料 id、卡片、练习：cards 的数量必须等于 packet.cardIds 的数量。材料 id 用小写英文加连字符。
- starter.materialIds 与 make.materialIds 不能相同。
- 只写原生第 3 版 steps：choose/send/find/point/match/sort/build/make。五段按顺序，每段 1–4 步；
  加上开场和结尾共 8–12 屏。Run 和 Modify 各恰好一个 send；Make 从唯一的 make 步开始。
- Predict 的 choose 不设 answerId；可把每个选项连到 starter 或 requests 的 id，Run 用 request: chosen。
  Modify 用原生 build 的完整问法和 send request: built；build.context 只是显示材料，不会偷偷加进请求。
- send.after 或 debriefs、各互动 after 都是做完才出现的老师话，不能断言实时答案一定包含某句话。
- plan.realWorld 在 door/wait/after 各放一条核实事实，标 sourceId/kind/relatesTo/reviewBy；
  分别用 intro.sourceIds、Run 的 send.wait、finish.didYouKnow 承接。同一个 source 可支持不同事实，
  但不重复说同一件事。普通事实复核日期不晚于 accessedOn 后 6 个月，研究不晚于 12 个月。
- sort 小回合每关至多一次，3–6 张同类判断；finish 留一句带走的话、来源事实、今天的一个动作；
  cards 由宝箱承接。不要生成当前原生结构里不存在的组件或字段。
- samples.makePrompt 写一个普通初学者在 Make 这一步大概会写的请求（不必完美）。它会被真的运行，给检查者看。
- 写完做一遍合同第 3 节的“老师连读测试”和第 6 节的自查，再交稿。
`;
}
function detectorPrompt(packet, render, plan) {
  return `# 检查一节课：学习者会在哪里停下

你是独立的课程检查者，不是写课的人。${NO_TOOLS}
你**不写**任何替换文字、标题或建议措辞，只指出学习者会在哪里停下、困惑、烦躁，或学不到东西。

请扮演两位读者，从头到尾走一遍下面这节课。它就是学习者屏幕上依次看到的内容；
其中的 AI 结果是本机 AI 刚刚按这节课真实生成的（每次运行可能不同）。

- **王阿姨**：55 岁，会用微信和手机支付，没用过 AI 聊天。认真，看不懂就停下，停两次就关掉。
  她判断：我知道为什么做这一步吗？知道现在做什么吗？知道刚才发生了什么吗？这像一位耐心老师在说话吗？
  这件事是我生活里真会遇到的吗？
- **一个 9 岁的孩子**：只检查字句能不能读懂（不评价内容适不适合孩子）。把读不懂的句子逐字抄进 childReadingProblems。

然后按教学合同第 6 节的代码列出 findings。每条写：code、severity、where（屏幕编号和字段名）、
quote（逐字抄原文）、problem（站在学习者角度，为什么会停下）。
- blocker：学习者会卡住、误解重要边界，或学到错的东西。
- major：假需要、跳题、结果后沉默、先说答案、不像老师、Make 给了答案。
- minor：可以更好，但不影响学会。
只报真实问题，不为凑数找问题；没有问题的地方不要写。有 blocker 或 major 时 verdict 为 revise。

## 教学合同

${contract()}

## 写课人的计划（用来核对它说的和课里做的是否一致）

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

## 学习者看到的课（按屏幕顺序）

${render}

## 课程位置（学习者此前学过什么）

\`\`\`json
${JSON.stringify({ course: packet.course, unit: packet.unit, learnerAlreadyMet: packet.learnerAlreadyMet }, null, 2)}
\`\`\`
`;
}
function fixerPrompt(packet, draft, lint, detector, render) {
  // A fixer already has the whole draft. Re-sending every old lesson/source
  // and the form example wastes context and can exceed the host argv limit.
  const { formExample, storage, outline, library, ...identity } = packet;
  const selected = new Set(draft.sources?.map((source) => source.id) ?? []);
  const input = {
    ...identity,
    outline: { title: outline.title, note: outline.note },
    library:
      draft.plan?.caseSourceId && !draft.plan?.caseNeeded?.trim()
        ? library.filter((source) => selected.has(source.id))
        : library,
  };
  return `# 修改你写的课

你是写这节课的老师。${detector?.performed === false ? "独立检查者还没有运行：结构不合格，先修机器检查列出的错误，不编造检查者意见。" : "独立检查者扮演初学者读了你的课，机器检查也给了结果。"}${NO_TOOLS}

请修改，返回**完整的新版本**（和原来同样的 JSON 结构，包括 plan），并在 resolutions 里逐条回应
每个问题：fixed（改了什么）或 rejected（为什么检查者说得不对，引用材料或合同）。

修改原则：
- **只动被指出的地方**，以及为了修好它们必须一起改的地方；其余字段逐字保留。
  整节重写会修好旧问题、又带进一批新问题——这一版已经比很多版本好，别把它推倒。
  只有检查者指出的是整节的根本问题（例如练习的需要是假的）时，才重做那一部分。
- 修根源，不打补丁。假需要就换情境和材料；跳题就补台阶或调整顺序；结果后沉默就写 debrief。
- 不因为检查者“想要更多”就加内容。能删就删。
- 再做一遍冗余检查：删掉界面已经表达的话，保留理解需要的台阶。
- 检查者看到的 AI 结果是真实运行的一次样例；以后每次可能不同，debrief 不能写死它。
- 不改 packet 里的 id、来源、素材。

## 教学合同

${contract()}

## 输入包

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

## 你现在的版本

\`\`\`json
${JSON.stringify(draft, null, 2)}
\`\`\`

## 学习者看到的样子（含真实运行样例）

${render}

## 机器检查

\`\`\`json
${JSON.stringify(lint, null, 2)}
\`\`\`

## 独立检查者的报告

\`\`\`json
${JSON.stringify(detector, null, 2)}
\`\`\`
`;
}

// ── Stage: check (deterministic lint + real sample runs + learner script) ────
const BANNED = [
  "助手",
  "助理",
  "场景",
  "维度",
  "要素",
  "交付物",
  "闭环",
  "验收",
  "溯源",
  "赋能",
  "提示词工程",
  "上下文窗口",
  "输出结果",
  "输入内容",
];
const UI_NARRATION =
  /点击|点一下|按钮|下方的|上方的|下面的选项|在下面选|选完之后|点继续|点“继续”|拖到这里/;
const MATERIAL_META = /练习|虚构|假设的|示例材料|本课|本节|教学用/;
function sentences(text) {
  return text
    .split(/[。！？；\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function lintDraft(draft, packet) {
  const issues = stepTeachingIssues(draft, packet);
  const add = (code, where, detail) => issues.push({ code, where, detail });
  const a = draft.activity;
  const visible = [];
  const walk = (value, path) => {
    if (isStructuralStepPath(path)) return;
    if (typeof value === "string") visible.push([path, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (
          /(^|\.)(id|kind|operation|materialIds|assetIds|assetId|sourceId|sourceIds|targetId|bucketId)$/.test(
            k,
          )
        )
          continue;
        walk(v, path ? `${path}.${k}` : k);
      }
  };
  walk({ title: draft.title, activity: a, cards: draft.cards, exercise: draft.exercise }, "");
  for (const [path, text] of visible) {
    if (path.includes("materials") && path.endsWith(".text")) {
      if (MATERIAL_META.test(text)) add("F12", path, "发给 AI 的材料正文里有练习/虚构等说明");
      continue;
    }
    for (const word of BANNED) if (text.includes(word)) add("F7", path, `用了“${word}”`);
    if (UI_NARRATION.test(text) && !path.includes("rubric")) add("F8", path, "像是在讲界面怎么点");
    for (const s of sentences(text)) {
      const len = s.replace(/[，、：“”‘’（）()《》\s]/g, "").length;
      if (len > 38) add("F9", path, `句子太长（${len}字）：${s.slice(0, 40)}…`);
    }
  }
  const same =
    a.make.materialIds.length === a.starter.materialIds.length &&
    a.make.materialIds.every((id) => a.starter.materialIds.includes(id));
  if (same) add("F11", "activity.make.materialIds", "Make 用的材料和前面一样");
  if (draft.cards.length !== packet.cardIds.length)
    add("shape", "cards", `卡片应为 ${packet.cardIds.length} 张`);
  for (const [n, card] of draft.cards.entries()) {
    if (card.front.length > 40) add("F9", `cards[${n}].front`, "卡片正面超过 40 字");
    if (card.back.length > 120) add("F9", `cards[${n}].back`, "卡片背面超过 120 字");
  }
  for (const op of [a.starter.operation, a.make.operation])
    if (!packet.operations.includes(op)) add("shape", "operation", `不可用的运行方式 ${op}`);
  const libraryIds = new Set(packet.library.map((entry) => entry.id));
  for (const source of draft.sources)
    if (!libraryIds.has(source.id)) add("shape", "sources", `来源不在依据库：${source.id}`);
  if (draft.plan.caseSourceId && !draft.sources.some((s) => s.id === draft.plan.caseSourceId))
    add("shape", "plan.caseSourceId", "选中的案例没有列入 sources");
  return issues;
}

/** Assemble the zh-only activity exactly as the native payload will carry it. */
function draftActivity(draft, packet, existing) {
  // A source missing from the library is reported by lint; it is dropped here so
  // the rest of the lesson can still be checked, rendered and run.
  const used = draft.sources
    .filter((source) => packet.library.some((item) => item.id === source.id))
    .map((source) => {
      const entry = packet.library.find((item) => item.id === source.id);
      return {
        id: source.id,
        reference: { label: source.label, url: entry.url },
        note: source.note,
        ...(entry.supports ? { summary: entry.supports } : {}),
        ...(entry.limitations ? { limitation: entry.limitations } : {}),
      };
    });
  const kept = (existing?.sources ?? []).filter((s) => !used.some((u) => u.id === s.id));
  const primary = used.find((s) => s.id === draft.plan.caseSourceId) ??
    used[0] ??
    stripLocales(existing?.sources?.[0]) ?? {
      // Only reached while lint reports that no chosen source is in the library.
      id: packet.library[0].id,
      reference: { label: packet.library[0].title, url: packet.library[0].url },
    };
  const a = draft.activity;
  return {
    id: existing?.id ?? `${packet.lesson.lessonId}-primm`,
    kind: "primm",
    role: "apply",
    difficulty: "intro",
    title: draft.title,
    brief: a.intro.need,
    goal: a.make.goal,
    hint: a.finish.note,
    takeaway: a.finish.note,
    source: primary.reference,
    method: "PRIMM",
    experienceVersion: 3,
    intro: a.intro,
    sources: [...used, ...stripLocales(kept)],
    materials: a.materials,
    starter: a.starter,
    steps: a.steps,
    ...(a.requests ? { requests: a.requests } : {}),
    make: { ...a.make, exerciseId: packet.exerciseIds[0] },
    finish: a.finish,
  };
}

async function sampleRuns(activity, packet) {
  const base = pathToFileURL(
    join(repoRoot, "apps/university-ai/.primm-preview-build/src/primm/"),
  ).href;
  const { createPrimmRuntime } = await import(`${base}runtime.js`);
  const { createLocalOllamaTransport } = await import(`${base}local-transport.js`);
  const root = studiesRoot();
  const lessonDir = join(
    root,
    STUDY,
    "courses",
    COURSE,
    "units",
    packet.lesson.unitId,
    "lessons",
    packet.lesson.lessonId,
  );
  const manifest = readJson(
    join(lessonDir, "revisions", String(packet.lesson.revision), "manifest.json"),
  );
  const assetBytes = (ids) =>
    ids.map((id) => {
      const meta = manifest.assets.find((a) => a.id === id);
      const bytes = readFileSync(
        join(lessonDir, "revisions", String(packet.lesson.revision), meta.path),
      );
      return { id, mime: meta.mime, bytes };
    });
  const lessonRef = {
    studyId: STUDY,
    courseId: COURSE,
    unitId: packet.lesson.unitId,
    lessonId: packet.lesson.lessonId,
  };
  const runtime = createPrimmRuntime({
    transport: createLocalOllamaTransport(),
    resolveLesson: async (input) => ({
      activity,
      contentRevision: 1,
      exercise: { id: activity.make.exerciseId, prompt: "", rubric: ["draft"] },
      exerciseRevision: 1,
      assets: assetBytes(
        input.phase === "make" ? activity.make.assetIds : activity.starter.assetIds,
      ),
      fingerprint: sha(JSON.stringify(activity)),
    }),
    quota: 10,
    timeoutMs: 150_000,
  });
  const once = async (phase, prompt) => {
    try {
      const out = await runtime.run({
        lessonRef,
        contentRevision: 1,
        phase,
        prompt,
        commandId: randomUUID(),
        locale: "zh-CN",
      });
      return {
        prompt,
        text: out.text,
        model: out.model,
        characters: [...out.text].length,
        bytes: Buffer.byteLength(out.text),
      };
    } catch (error) {
      return { prompt, error: String(error?.code ?? error?.message ?? error) };
    }
  };
  try {
    const requests = {};
    const planned = stepSampleRequests(activity);
    for (const request of planned) requests[request.id] = await once(request.phase, request.prompt);
    return {
      run: requests[planned[0].id],
      modify: await once("modify", stepModifyPrompt(activity)),
      requests,
    };
  } finally {
    runtime.close?.();
  }
}

function renderLearnerScript(activity, draft, samples, makeSample) {
  return renderStepLesson(activity, draft, samples, makeSample);
}

async function makeSampleRun(activity, packet, prompt) {
  const base = pathToFileURL(
    join(repoRoot, "apps/university-ai/.primm-preview-build/src/primm/"),
  ).href;
  const { createPrimmRuntime } = await import(`${base}runtime.js`);
  const { createLocalOllamaTransport } = await import(`${base}local-transport.js`);
  const runtime = createPrimmRuntime({
    transport: createLocalOllamaTransport(),
    resolveLesson: async () => ({
      activity,
      contentRevision: 1,
      exercise: { id: activity.make.exerciseId, prompt: "", rubric: ["draft"] },
      exerciseRevision: 1,
      assets: [],
      fingerprint: sha(JSON.stringify(activity)),
    }),
    quota: 3,
    timeoutMs: 150_000,
  });
  try {
    const out = await runtime.run({
      lessonRef: {
        studyId: STUDY,
        courseId: COURSE,
        unitId: packet.lesson.unitId,
        lessonId: packet.lesson.lessonId,
      },
      contentRevision: 1,
      phase: "make",
      prompt,
      commandId: randomUUID(),
      locale: "zh-CN",
    });
    return {
      prompt,
      text: out.text,
      model: out.model,
      characters: [...out.text].length,
      bytes: Buffer.byteLength(out.text),
    };
  } catch (error) {
    return { prompt, error: String(error?.code ?? error?.message ?? error) };
  } finally {
    runtime.close?.();
  }
}

// ── Stage orchestration ──────────────────────────────────────────────────────
function currentVersion(dir) {
  const versions = readdirSync(dir)
    .map((name) => /^draft\.v(\d+)\.json$/.exec(name)?.[1])
    .filter(Boolean)
    .map(Number);
  return versions.length ? Math.max(...versions) : 0;
}
function log(dir, line) {
  appendFileSync(join(dir, "log.md"), `- ${new Date().toISOString()} ${line}\n`);
  console.log(line);
}
function existingPrimm(packet) {
  const root = studiesRoot();
  const dir = join(
    root,
    STUDY,
    "courses",
    COURSE,
    "units",
    packet.lesson.unitId,
    "lessons",
    packet.lesson.lessonId,
  );
  const manifest = readJson(
    join(dir, "revisions", String(packet.lesson.revision), "manifest.json"),
  );
  return (manifest.activities ?? []).find((a) => a.kind === "primm");
}

async function stageCheck(dir, packet, version, S, final = false) {
  const label = final ? "final" : `v${version}`;
  const draft = final
    ? readJson(join(dir, "final.json")).draft
    : readJson(join(dir, `draft.v${version}.json`));
  const parsed = S.zod.draft.safeParse(stripResolutions(draft));
  if (!parsed.success) {
    const lint = [{ code: "shape", where: "schema", detail: parsed.error.message }];
    try {
      lint.push(...lintDraft(draft, packet));
    } catch (error) {
      lint.push({
        code: "shape",
        where: "machine-check",
        detail: `The incomplete draft cannot finish lint: ${error.message}`,
      });
    }
    const render = `〔检查者注：Writer 输出不符合原生步骤结构，未运行模型、未虚构课堂〕\n${parsed.error.message}`;
    writeJson(join(dir, `lint.${label}.json`), lint);
    writeFileSync(join(dir, `render.${label}.md`), render);
    log(dir, `check ${label}: invalid authored structure; no live sample executed`);
    return { lint, render };
  }
  const lint = lintDraft(draft, packet);
  const activity = draftActivity(draft, packet, existingPrimm(packet));
  const { PrimmPayloadSchema } = await import(
    pathToFileURL(join(repoRoot, "packages/core/dist/domain/schemas.js")).href
  );
  const { primmIssues } = await import(
    pathToFileURL(join(repoRoot, "packages/core/dist/learning-play/primm.js")).href
  );
  const payload = PrimmPayloadSchema.safeParse(activity);
  if (!payload.success)
    lint.push({ code: "shape", where: "payload", detail: payload.error.message.slice(0, 2000) });
  else
    for (const issue of primmIssues(payload.data))
      lint.push({ code: "shape", where: "payload", detail: issue });
  writeJson(join(dir, `lint.${label}.json`), lint);
  if (lint.some((issue) => issue.code === "shape")) {
    const render = `〔检查者注：原生结构或材料/来源合同未过，不运行无效请求〕\n${JSON.stringify(lint, null, 2)}\n${JSON.stringify(draft, null, 2)}`;
    writeFileSync(join(dir, `render.${label}.md`), render);
    log(dir, `check ${label}: native/teaching shape rejected; no live sample executed`);
    return { lint, render };
  }
  const samples = await sampleRuns(activity, packet);
  const makeSample = await makeSampleRun(activity, packet, draft.samples.makePrompt);
  writeJson(join(dir, `samples.${label}.json`), { ...samples, make: makeSample });
  for (const [where, sample] of Object.entries({
    run: samples.run,
    modify: samples.modify,
    make: makeSample,
    ...(samples.requests ?? {}),
  }))
    if (sample.error || !sample.text?.trim())
      lint.push({ code: "runtime", where, detail: sample.error ?? "Empty real model output" });
  writeJson(join(dir, `lint.${label}.json`), lint);
  const render = renderLearnerScript(activity, draft, samples, makeSample);
  writeFileSync(join(dir, `render.${label}.md`), render);
  log(
    dir,
    `check ${label}: ${lint.length} machine findings (${lint.filter((l) => l.code === "shape").length} shape); samples ${["run", "modify"].map((k) => (samples[k].error ? `${k}=failed` : `${k}=ok`)).join(" ")}`,
  );
  if (lint.some((issue) => issue.code === "runtime"))
    throw Error(
      "A real local-model sample failed; retain its receipt and stop before Detector or publication",
    );
  return { lint, render };
}
const stripResolutions = ({ resolutions, ...rest }) => rest;

async function stageWrite(dir, packet, S) {
  const draft = await callModel("writer", writerPrompt(packet), S.draft, join(dir, "writer.v1"), {
    accept: (value) =>
      S.zod.draft.safeParse(value).success
        ? lessonVeto(value)
        : S.zod.draft.safeParse(value).error.message,
  });
  writeJson(join(dir, "draft.v1.json"), draft);
  log(dir, `write v1: ${readJson(join(dir, "writer.v1.receipt.json")).model}`);
}
async function stageDetect(dir, packet, version, S) {
  const machine = readJson(join(dir, `lint.v${version}.json`));
  if (machine.some((finding) => ["shape", "runtime"].includes(finding.code)))
    throw Error(
      "The independent Detector needs a valid lesson and real runs; repair the machine failure first",
    );
  const draft = readJson(join(dir, `draft.v${version}.json`));
  const render = readFileSync(join(dir, `render.v${version}.md`), "utf8");
  const report = await callModel(
    "detector",
    detectorPrompt(packet, render, draft.plan),
    S.detector,
    join(dir, `detector.v${version}`),
  );
  const counts = ["blocker", "major", "minor"].map(
    (s) => `${s}=${report.findings.filter((f) => f.severity === s).length}`,
  );
  log(
    dir,
    `detect v${version}: ${MODELS.detector.model} verdict=${report.verdict} ${counts.join(" ")}`,
  );
  return report;
}
/** Fix from the best-scoring version, writing a new latest version: never build on a regression. */
export function reviewContextForFix(lint, report) {
  if (lint.some((issue) => issue.code === "runtime"))
    throw Error(
      "A failed real run is not a prose defect; inspect the execution failure before another model call",
    );
  if (report) return report;
  if (lint.some((issue) => issue.code === "shape"))
    return {
      performed: false,
      reason: "Native structure must pass before the independent Detector runs",
    };
  throw Error("The draft has no independent review; run the Detector first");
}
async function stageFix(dir, packet, latestVersion, S, from) {
  const version = from ?? (bestVersion(dir) || latestVersion);
  const next = currentVersion(dir) + 1;
  const draft = readJson(join(dir, `draft.v${version}.json`));
  const lint = readJson(join(dir, `lint.v${version}.json`));
  const reportPath = join(dir, `detector.v${version}.json`);
  const detector = reviewContextForFix(lint, existsSync(reportPath) ? readJson(reportPath) : null);
  const render = readFileSync(join(dir, `render.v${version}.md`), "utf8");
  const fixed = await callModel(
    "writer",
    fixerPrompt(packet, stripResolutions(draft), lint, detector, render),
    S.fixed,
    join(dir, `fixer.v${next}`),
    {
      accept: (value) =>
        S.zod.fixed.safeParse(value).success
          ? lessonVeto(value)
          : S.zod.fixed.safeParse(value).error.message,
    },
  );
  writeJson(join(dir, `draft.v${next}.json`), fixed);
  log(
    dir,
    `fix v${version} → v${next} (${readJson(join(dir, `fixer.v${next}.receipt.json`)).model}): ${fixed.resolutions.filter((r) => r.action === "fixed").length} fixed, ${fixed.resolutions.filter((r) => r.action === "rejected").length} rejected`,
  );
}

// ── Polish and translation (Gemini Flash, text only, pointer-bound) ─────────
const HEDGES = ["可能", "不一定", "多数时候", "通常", "往往", "一般", "大多", "有时"];
const ABSOLUTES = [
  "绝不",
  "绝对",
  "必然",
  "从不",
  "全都是",
  "根本不",
  "压根",
  "随时都能",
  "完全可以",
  "一定能",
];
function displayMap(draft) {
  const map = {};
  const put = (key, value) => {
    if (typeof value === "string" && value.trim()) map[key] = value;
  };
  put("title", draft.title);
  draft.sources.forEach((s, i) => {
    put(`sources.${i}.label`, s.label);
    put(`sources.${i}.note`, s.note);
  });
  const walk = (value, path) => {
    if (typeof value === "string") {
      if (
        isStructuralStepPath(path) ||
        /(^|\.)(id|kind|operation|targetId|bucketId|sourceId|assetId)$/.test(path)
      )
        return;
      if (/materials\.\d+\.text$/.test(path)) return; // practice material is frozen content
      put(path, value);
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (
          [
            "materialIds",
            "assetIds",
            "sourceIds",
            "x",
            "y",
            "width",
            "height",
            "carryObservation",
          ].includes(k)
        )
          continue;
        walk(v, `${path}.${k}`);
      }
  };
  walk(draft.activity, "activity");
  draft.cards.forEach((c, i) => {
    put(`cards.${i}.front`, c.front);
    put(`cards.${i}.back`, c.back);
  });
  put("exercise.title", draft.exercise.title);
  draft.exercise.rubric.forEach((r, i) => put(`exercise.rubric.${i}`, r));
  return map;
}
function setPath(target, path, value) {
  const keys = path.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) node = node[/^\d+$/.test(key) ? Number(key) : key];
  node[keys.at(-1)] = value;
}
const numbers = (s) =>
  (s.match(/\d+/g) ?? [])
    .map(Number)
    .sort((a, b) => a - b)
    .join(",");
function polishIssues(before, after, { fixedTitle } = {}) {
  const issues = [];
  if (fixedTitle !== undefined) {
    if (before.title !== fixedTitle)
      throw Error("Owner-fixed title differs from the reviewed title; return through review → fix");
    if (after.title !== fixedTitle) issues.push("title: Owner-fixed title must stay unchanged");
  }
  for (const [key, text] of Object.entries(before)) {
    const out = after[key];
    if (typeof out !== "string" || !out.trim()) {
      issues.push(`${key}: missing`);
      continue;
    }
    // Operational strings were actually run and reviewed. Polish may translate
    // them later, but must not silently change the Chinese request or targets.
    if (
      /(?:starter\.prompt|requests\.\d+\.prompt|steps\.\d+\.(?:pieces\.\d+\.text|terms\.\d+))$/.test(
        key,
      ) &&
      out !== text
    )
      issues.push(`${key}: operational text is frozen after review`);
    if (numbers(text) !== numbers(out)) issues.push(`${key}: numbers changed`);
    for (const h of HEDGES)
      if (text.includes(h) && !out.includes(h)) issues.push(`${key}: lost hedge ${h}`);
    for (const a of ABSOLUTES)
      if (!text.includes(a) && out.includes(a)) issues.push(`${key}: new absolute ${a}`);
    if (/助手|助理/.test(out)) issues.push(`${key}: AI alias`);
    if (out.length > text.length * 1.15 + 6)
      issues.push(`${key}: grew ${text.length}→${out.length}`);
    const quoted = [...text.matchAll(/「([^」]+)」|“([^”]+)”/g)].map((m) => m[1] ?? m[2]);
    for (const q of quoted)
      if (
        q.length >= 4 &&
        !out.includes(q) &&
        key.includes("modify.workbench") === false &&
        /[A-Za-z0-9]/.test(q)
      )
        issues.push(`${key}: lost quote ${q}`);
  }
  for (const key of Object.keys(after)) if (!(key in before)) issues.push(`${key}: unknown key`);
  return issues;
}
async function stagePolish(dir, packet, version, S, { fixedTitle } = {}) {
  const report = readJson(join(dir, `detector.v${version}.json`));
  const findings = readJson(join(dir, `lint.v${version}.json`));
  if (
    report.verdict !== "ready" ||
    report.findings.some((finding) => finding.severity !== "minor") ||
    findings.some((finding) => ["shape", "runtime"].includes(finding.code))
  )
    throw Error(
      "This version is not ready for polish; use review → fix rather than bypassing failed checks",
    );
  const draft = stripResolutions(readJson(join(dir, `draft.v${version}.json`)));
  const render = readFileSync(join(dir, `render.v${version}.md`), "utf8");
  const before = displayMap(draft);
  polishIssues(before, before, { fixedTitle });
  const keys = Object.keys(before);
  const stringsSchema = S.z.toJSONSchema(
    S.z.object(Object.fromEntries(keys.map((k) => [k, S.z.string().min(1)]))).strict(),
  );
  const polishPrompt = `# 口语润色（只改说法）

${NO_TOOLS}
这是一节给普通成年人的 AI 入门课。下面的 JSON 是课里每一处显示的中文，键是位置，值是原文。
请只做一件事：让它读起来更像一位耐心的老师在身边说话。字句要让 8–9 岁的孩子也读得懂，
但不要哄小孩的语气。

规则（机器会逐条检查，违反就整份作废）：
1. 不改事实、数字、日期、名字、要求和判断标准；不删理解需要的台阶；不改变哪一步做什么。
2. 保留所有“可能、不一定、多数时候、通常、往往、一般、有时”。不新增“绝不、绝对、一定能、完全可以”等。
3. 不变长：每一条都不能比原文长（可以更短）。口语是更短的句子，不是更多的字。
4. 称 AI 为“AI”，不用“助手”“助理”。
5. 键不变，数量不变，返回同样结构的 JSON。
${fixedTitle === undefined ? "" : `6. Owner 已确定标题，title 必须逐字保留：${fixedTitle}`}

为了理解上下文，这是学习者看到的整节课（只读，不要修改它）：

${render}

## 要润色的文字

\`\`\`json
${JSON.stringify(before, null, 2)}
\`\`\`
`;
  const polished = await callModel(
    "polisher",
    polishPrompt,
    stringsSchema,
    join(dir, `polish.v${version}`),
  );
  const issues = polishIssues(before, polished, { fixedTitle });
  // A rejected key keeps the fixed draft wording: never hand-repair a polish and call it accepted.
  const accepted = Object.fromEntries(
    keys.map((k) => [k, issues.some((i) => i.startsWith(`${k}:`)) ? before[k] : polished[k]]),
  );
  writeJson(join(dir, `polish.v${version}.acceptance.json`), {
    ...(fixedTitle === undefined ? {} : { fixedTitle }),
    keys: keys.length,
    rejectedKeys: [...new Set(issues.map((i) => i.split(":")[0]))],
    issues,
  });
  const translatePrompt = `# Faithful English translation

${NO_TOOLS}
Translate each Chinese value into plain, warm English for adult beginners who have never used AI.
Keep every number, date, name, hedge (may, often, usually, not always) and requirement. Do not add
advice or absolutes. Use "AI", never "assistant". Keep keys identical and return the same JSON shape.
Practice-material quotes that are part of the task stay faithful.

\`\`\`json
${JSON.stringify(accepted, null, 2)}
\`\`\`
`;
  const english = await callModel(
    "polisher",
    translatePrompt,
    stringsSchema,
    join(dir, `translate.v${version}`),
  );
  const materials = Object.fromEntries(
    draft.activity.materials.flatMap((m, i) => [[`activity.materials.${i}.text`, m.text]]),
  );
  const materialSchema = S.z.toJSONSchema(
    S.z
      .object(Object.fromEntries(Object.keys(materials).map((k) => [k, S.z.string().min(1)])))
      .strict(),
  );
  const materialEnglish = await callModel(
    "polisher",
    `# Translate practice material\n\n${NO_TOOLS}\nTranslate each Chinese practice text into natural English with the same facts, numbers and line breaks. Keep keys.\n\n\`\`\`json\n${JSON.stringify(materials, null, 2)}\n\`\`\`\n`,
    materialSchema,
    join(dir, `translate-materials.v${version}`),
  );
  // Evidence text shown with a source (summary/limitation) also needs English;
  // library records from earlier lessons usually carry it, fresh research does not.
  const sourceTexts = {};
  for (const source of draft.sources) {
    const entry = packet.library.find((item) => item.id === source.id);
    const localized = entry?.evidence?.provenance?.locales?.en;
    if (entry?.supports && !localized?.supports)
      sourceTexts[`source.${source.id}.summary`] = entry.supports;
    if (entry?.limitations && !localized?.limitations)
      sourceTexts[`source.${source.id}.limitation`] = entry.limitations;
  }
  const sourceEnglish = Object.keys(sourceTexts).length
    ? await callModel(
        "polisher",
        `# Translate source notes\n\n${NO_TOOLS}\nTranslate each Chinese note about a source into plain English. Keep facts, dates and limits exactly. Keep keys.\n\n\`\`\`json\n${JSON.stringify(sourceTexts, null, 2)}\n\`\`\`\n`,
        S.z.toJSONSchema(
          S.z
            .object(
              Object.fromEntries(Object.keys(sourceTexts).map((k) => [k, S.z.string().min(1)])),
            )
            .strict(),
        ),
        join(dir, `translate-sources.v${version}`),
      )
    : {};
  const final = structuredClone(draft);
  for (const [k, v] of Object.entries(accepted)) setPath(final, k, v);
  const en = { ...english, ...materialEnglish };
  for (const k of Object.keys(en)) if (!(k in accepted) && !(k in materials)) delete en[k];
  for (const [k, v] of Object.entries(sourceEnglish)) if (k in sourceTexts) en[k] = v;
  writeJson(join(dir, "final.json"), { version, draft: final, en });
  log(
    dir,
    `polish v${version}: ${keys.length} strings, ${new Set(issues.map((i) => i.split(":")[0])).size} kept pre-polish wording by gate; translated`,
  );
}

// ── Research: find real cases, then verify each quote against the live page ──
function pageText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;|&#8217;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"');
}
const normalize = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
async function verifyQuote(url, quote) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh) UniversityCaseCheck/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return { status: `http-${response.status}` };
    const text = normalize(pageText(await response.text()));
    return { status: text.includes(normalize(quote)) ? "verified" : "quote-not-found" };
  } catch (error) {
    return { status: `fetch-failed: ${error.message}` };
  }
}
async function stageResearch(dir, packet, S, need) {
  const z = S.z;
  const text = z.string().min(1);
  const schema = z.toJSONSchema(
    z
      .object({
        candidates: z
          .array(
            z
              .object({
                url: text,
                title: text,
                publisher: text,
                date: z.string().describe("页面或事件日期；不知道就写空字符串"),
                quote: text.describe("页面上逐字存在的一句原文（原语言），用来核对"),
                claim: text.describe("中文：这个来源能证明的一件事——谁在现实里怎样用这项能力"),
                limitations: text.describe("中文：它不能证明什么"),
              })
              .strict(),
          )
          .min(1)
          .max(4),
      })
      .strict(),
  );
  const prompt = `# 为一节 AI 入门课找真实案例

请上网查找 2–4 个**真实、可公开访问**的来源，证明现实里有人（普通人、机构或产品的真实用户）
在用下面这项能力，或这件事在现实里真实发生过。来源只能是：官方产品文档或帮助页、研究原文、
公共记录或机构公告、权利人自己的材料、对真实事件的原始报道。不要转述别人报道的二手文章、
博客或聚合网站。有日期；与普通人生活相关。
不要编造网址或原文。quote 必须是页面上逐字存在的一句话，脚本会打开网页核对，对不上就作废。
不要运行命令，不要修改任何文件。只用网页搜索；${MODELS.researcher.cli === "agy" ? "不要调用 read_url 打开网页（无人值守时会被拒绝），quote 取自搜索结果里出现的原句。" : "可以打开网页核对原句。"}

## 这节课要教的能力

- 课：${packet.outline.title}
- 单元目标：${packet.unit.objective}
- 需要的案例：${need}

## 旧课（只作大纲参考）

${packet.outline.oldContent.slice(0, 2000)}
`;
  const result = await callModel("researcher", prompt, schema, join(dir, "research"), {
    webSearch: true,
  });
  // The quote found on the fetched page is the admission; no host list is consulted.
  const checked = [];
  for (const candidate of result.candidates) {
    checked.push({ ...candidate, check: await verifyQuote(candidate.url, candidate.quote) });
  }
  const accepted = checked
    .filter((c) => c.check.status === "verified")
    .map((c) => ({
      id: `lib-${sha(c.url).slice(0, 8)}`,
      url: c.url,
      title: c.title,
      publisher: c.publisher,
      accessedOn: TODAY,
      supports: c.claim,
      limitations: c.limitations,
      evidence: {
        kind: "fact",
        sourceUrl: c.url,
        sourceTitle: c.title,
        sourceAuthority: "first-party",
        provenance: {
          type: "public-record",
          publisher: c.publisher,
          accessedOn: TODAY,
          locator: c.quote.slice(0, 300),
          supports: c.claim,
          limitations: c.limitations,
        },
      },
    }));
  writeJson(join(dir, "research.checked.json"), checked);
  const prior = existsSync(join(dir, "research.accepted.json"))
    ? readJson(join(dir, "research.accepted.json")).sources
    : [];
  const merged = [...prior, ...accepted.filter((a) => !prior.some((p) => p.url === a.url))];
  writeJson(join(dir, "research.accepted.json"), { sources: merged });
  log(
    dir,
    `research: ${checked.length} candidates, ${accepted.length} quote-verified (${checked.map((c) => c.check.status).join(", ")})`,
  );
  return accepted;
}

// ── Assemble a native revision proposal ─────────────────────────────────────
async function stageAssemble(dir, packet, apply) {
  const { draft, en } = readJson(join(dir, "final.json"));
  const root = studiesRoot();
  const lessonDir = join(
    root,
    STUDY,
    "courses",
    COURSE,
    "units",
    packet.lesson.unitId,
    "lessons",
    packet.lesson.lessonId,
  );
  const rev = latest(lessonDir);
  if (rev !== packet.lesson.revision)
    throw Error(`Lesson moved from r${packet.lesson.revision} to r${rev}; rebuild the packet`);
  const manifest = readJson(join(lessonDir, "revisions", String(rev), "manifest.json"));
  const zhActivity = draftActivity(draft, packet, existingPrimm(packet));
  // Translation map keyed by the exact displayed zh strings (the native localization contract).
  const zhMap = displayMap(draft);
  const strings = {};
  for (const [key, zh] of Object.entries(zhMap)) if (en[key]) strings[zh] = en[key];
  draft.activity.materials.forEach((m, i) => {
    if (en[`activity.materials.${i}.text`]) strings[m.text] = en[`activity.materials.${i}.text`];
  });
  const { activityDisplayStrings } = await import(
    pathToFileURL(join(repoRoot, "packages/core/dist/learning-play/localization.js")).href
  );
  const kept = zhActivity.sources.filter((s) => !draft.sources.some((d) => d.id === s.id));
  const existingStrings = existingPrimm(packet)?.locales?.en?.strings ?? {};
  for (const s of activityDisplayStrings({ ...zhActivity, sources: kept }))
    if (existingStrings[s] && !strings[s]) strings[s] = existingStrings[s];
  for (const source of zhActivity.sources) {
    for (const field of ["summary", "limitation"]) {
      const value = source[field];
      if (value && !strings[value] && en[`source.${source.id}.${field}`])
        strings[value] = en[`source.${source.id}.${field}`];
      if (value && !strings[value]) {
        const evidence = libraryEvidence(packet, source.reference.url);
        const localized =
          evidence?.provenance?.locales?.en?.[field === "summary" ? "supports" : "limitations"];
        if (localized) strings[value] = localized;
      }
    }
  }
  // The native dictionary may only hold the activity's own display strings.
  const display = new Set(activityDisplayStrings(zhActivity));
  for (const key of Object.keys(strings)) if (!display.has(key)) delete strings[key];
  const missing = [...display].filter((s) => !strings[s]);
  if (missing.length)
    throw Error(`Translation is incomplete before native revision: ${JSON.stringify(missing)}`);
  const activity = { ...zhActivity, locales: { en: { strings } } };
  // Evidence: keep every existing record, add each newly used library source once.
  const evidence = [...manifest.evidence];
  for (const source of zhActivity.sources) {
    if (!evidence.some((e) => e.sourceUrl === source.reference.url)) {
      const record = libraryEvidence(packet, source.reference.url);
      if (!record) throw Error(`No verified evidence for ${source.reference.url}`);
      evidence.push(record);
    }
  }
  const evidenceFor = (url) => evidence.find((e) => e.sourceUrl === url);
  const makeSourceUrls = zhActivity.materials
    .filter((m) => zhActivity.make.materialIds.includes(m.id) && m.sourceId)
    .map((m) => zhActivity.sources.find((s) => s.id === m.sourceId).reference.url);
  const exerciseEvidence = [...new Set([zhActivity.source.url, ...makeSourceUrls])].map(
    evidenceFor,
  );
  const cardDir = (id) => join(lessonDir, "cards", id);
  const exerciseDir = (id) => join(lessonDir, "exercises", id);
  const cards = packet.cardIds.map((id, n) => ({
    id,
    kind: "basic",
    front: draft.cards[n].front,
    back: draft.cards[n].back,
    tags: [],
    evidence: [evidenceFor(zhActivity.source.url)],
    locales: { en: { front: en[`cards.${n}.front`], back: en[`cards.${n}.back`] } },
    expectedRevision: readJson(join(cardDir(id), "latest.json")).contentRevision,
  }));
  const exId = packet.exerciseIds[0];
  const prompt = `${draft.activity.make.scenario}\n${draft.activity.make.goal}`;
  const exercise = {
    id: exId,
    kind: "explain",
    title: draft.exercise.title,
    prompt,
    rubric: draft.exercise.rubric,
    evidence: exerciseEvidence,
    locales: {
      en: {
        title: en["exercise.title"],
        prompt: `${en["activity.make.scenario"]}\n${en["activity.make.goal"]}`,
        rubric: draft.exercise.rubric.map((_, i) => en[`exercise.rubric.${i}`]),
      },
    },
    expectedRevision: readJson(join(exerciseDir(exId), "latest.json")).contentRevision,
  };
  const links = zhActivity.sources
    .filter((s) => draft.sources.some((d) => d.id === s.id))
    .map((s) => `[${s.reference.label}](${s.reference.url})`)
    .join(" · ");
  const enLinks = zhActivity.sources
    .filter((s) => draft.sources.some((d) => d.id === s.id))
    .map((s) => `[${strings[s.reference.label] ?? s.reference.label}](${s.reference.url})`)
    .join(" · ");
  const a = draft.activity;
  const content = `# ${draft.title}\n\n${a.intro.connection}\n\n${a.intro.situation}\n\n${a.intro.need}\n\n::play{#${activity.id}}\n\n${a.finish.note}\n\n${links}\n`;
  const enContent = `# ${en.title}\n\n${en["activity.intro.connection"]}\n\n${en["activity.intro.situation"]}\n\n${en["activity.intro.need"]}\n\n::play{#${activity.id}}\n\n${en["activity.finish.note"]}\n\n${enLinks}\n`;
  const { CourseRevisionProposalSchema } = await import(
    pathToFileURL(join(moduleRoot, ".university-local-build/server/workflows/revise-course.js"))
      .href
  );
  const proposal = CourseRevisionProposalSchema.parse({
    schemaVersion: 1,
    proposalId: `primm-engine-${packet.lesson.lessonId}-r${rev + 1}`,
    lesson: {
      courseId: COURSE,
      unitId: packet.lesson.unitId,
      id: packet.lesson.lessonId,
      expectedRevision: rev,
      title: draft.title,
      variant: manifest.variant,
      content,
      sections: [],
      locales: { en: { title: en.title, content: enContent } },
      evidence,
      assets: manifest.assets,
      assetFiles: [],
      activities: [activity],
      cards,
      exercises: [exercise],
    },
  });
  writeJson(join(dir, "proposal.json"), proposal);
  const receipts = await nativeApply(dir, root, apply);
  writeJson(join(dir, apply ? "native-apply.json" : "native-proposal-check.json"), {
    missingTranslations: missing,
    receipts,
  });
  log(
    dir,
    `assemble r${rev + 1}: ${apply ? "APPLIED via native dry-run + revise" : "native dry-run validated (not applied)"}; missing en strings: ${missing.length}`,
  );
}

/** The one landing path: open the course for edit if needed, native dry-run, then revise. */
async function nativeApply(dir, root, apply) {
  const { executeUniversityLocalCli, parseUniversityLocalCli } = await import(
    pathToFileURL(join(moduleRoot, ".university-local-build/server/cli.js")).href
  );
  const run = (argv) =>
    executeUniversityLocalCli({
      projectRoot: authoringProjectRoot(),
      cwd: repoRoot,
      env: process.env,
      command: parseUniversityLocalCli(argv),
    });
  const receipts = [];
  if (realpathSync(root) !== studiesRoot())
    throw Error("Native proposal and CLI must use the same authoring root");
  // Native revise only accepts a stale (open-for-edit) course; the batch's
  // `finish` stage reactivates it. Opening an already open course is a no-op.
  const course = readJson(join(root, STUDY, "courses", COURSE, "course.json"));
  if (course.status !== "stale" && !apply)
    throw Error(
      "Native dry-run requires an open-for-edit authoring course; prepare the unpublished project first",
    );
  if (course.status !== "stale")
    receipts.push({
      args: "open-for-edit",
      result: await run(["course", "open-for-edit", "--study", STUDY, "--course", COURSE]),
    });
  const input = join(dir, "proposal.json");
  receipts.push({
    args: "revise --dry-run",
    result: await run(["course", "revise", "--study", STUDY, "--input", input, "--dry-run"]),
  });
  if (apply)
    receipts.push({
      args: "revise",
      result: await run(["course", "revise", "--study", STUDY, "--input", input]),
    });
  return receipts;
}

/**
 * Retained explicitly manual step-lesson import, not the automated Writer path.
 * Input: { activity, exercise: { title, rubric, en }, cards: [{ front,
 * back, en }] }. Same evidence, card/exercise identities and native path as
 * `assemble`; every display string must already carry its English.
 */
async function stageAssembleSteps(dir, packet, inputFile, apply, replace) {
  const input = readJson(inputFile);
  const root = studiesRoot();
  const lessonDir = join(
    root,
    STUDY,
    "courses",
    COURSE,
    "units",
    packet.lesson.unitId,
    "lessons",
    packet.lesson.lessonId,
  );
  const rev = latest(lessonDir);
  if (rev !== packet.lesson.revision)
    throw Error(`Lesson moved from r${packet.lesson.revision} to r${rev}; rebuild the packet`);
  const manifest = readJson(join(lessonDir, "revisions", String(rev), "manifest.json"));
  const existing = existingPrimm(packet);
  const activity = {
    ...input.activity,
    id: existing?.id ?? input.activity.id,
    make: { ...input.activity.make, exerciseId: packet.exerciseIds[0] },
  };
  if (activity.experienceVersion !== 3) throw Error("assemble-steps lands version-3 lessons only");
  // `--replace` (Owner G3): new content in the lesson's identities. It keeps the
  // cards, exercises and IDs, but cites only its own sources and retires the old
  // lesson's media it no longer uses.
  const used = new Set([
    ...activity.starter.assetIds,
    ...activity.make.assetIds,
    ...activity.materials.flatMap((m) => (m.assetId ? [m.assetId] : [])),
    ...activity.steps.flatMap((s) => (s.kind === "point" ? [s.assetId] : [])),
  ]);
  const assets = replace ? manifest.assets.filter((a) => used.has(a.id)) : manifest.assets;
  const retireAssetIds = manifest.assets.filter((a) => !assets.includes(a)).map((a) => a.id);
  const { activityDisplayStrings } = await import(
    pathToFileURL(join(repoRoot, "packages/core/dist/learning-play/localization.js")).href
  );
  const strings = activity.locales?.en?.strings ?? {};
  const missing = activityDisplayStrings(activity).filter((text) => !strings[text]?.trim());
  if (missing.length) throw Error(`Missing English for: ${missing.join(" | ")}`);
  const evidence = replace ? [] : [...manifest.evidence];
  for (const source of activity.sources) {
    if (!evidence.some((e) => e.sourceUrl === source.reference.url)) {
      const record = libraryEvidence(packet, source.reference.url);
      if (!record) throw Error(`No verified evidence for ${source.reference.url}`);
      evidence.push(record);
    }
  }
  const evidenceFor = (url) => evidence.find((e) => e.sourceUrl === url);
  const makeSourceUrls = activity.materials
    .filter((m) => activity.make.materialIds.includes(m.id) && m.sourceId)
    .map((m) => activity.sources.find((s) => s.id === m.sourceId).reference.url);
  if (input.cards.length !== packet.cardIds.length)
    throw Error(`Need ${packet.cardIds.length} cards`);
  const cards = packet.cardIds.map((id, n) => ({
    id,
    kind: "basic",
    front: input.cards[n].front,
    back: input.cards[n].back,
    tags: [],
    evidence: [evidenceFor(activity.source.url)],
    locales: { en: { front: input.cards[n].en.front, back: input.cards[n].en.back } },
    expectedRevision: readJson(join(lessonDir, "cards", id, "latest.json")).contentRevision,
  }));
  const exId = packet.exerciseIds[0];
  const en = (text) => strings[text] ?? text;
  const exercise = {
    id: exId,
    kind: "explain",
    title: input.exercise.title,
    prompt: `${activity.make.scenario}\n${activity.make.goal}`,
    rubric: input.exercise.rubric,
    evidence: [...new Set([activity.source.url, ...makeSourceUrls])].map(evidenceFor),
    locales: {
      en: {
        title: input.exercise.en.title,
        prompt: `${en(activity.make.scenario)}\n${en(activity.make.goal)}`,
        rubric: input.exercise.en.rubric,
      },
    },
    expectedRevision: readJson(join(lessonDir, "exercises", exId, "latest.json")).contentRevision,
  };
  const links = (label) =>
    activity.sources.map((s) => `[${label(s.reference.label)}](${s.reference.url})`).join(" · ");
  const recap = (pick) =>
    `# ${pick(activity.title)}\n\n${pick(activity.intro.connection)}\n\n${pick(activity.intro.situation)}\n\n${pick(activity.intro.need)}\n\n::play{#${activity.id}}\n\n${pick(activity.finish.note)}\n\n${links(pick)}\n`;
  const { CourseRevisionProposalSchema } = await import(
    pathToFileURL(join(moduleRoot, ".university-local-build/server/workflows/revise-course.js"))
      .href
  );
  const proposal = CourseRevisionProposalSchema.parse({
    schemaVersion: 1,
    proposalId: `primm-steps-${packet.lesson.lessonId}-r${rev + 1}`,
    lesson: {
      courseId: COURSE,
      unitId: packet.lesson.unitId,
      id: packet.lesson.lessonId,
      expectedRevision: rev,
      title: activity.title,
      variant: manifest.variant,
      content: recap((text) => text),
      sections: [],
      locales: { en: { title: en(activity.title), content: recap(en) } },
      evidence,
      assets,
      ...(retireAssetIds.length ? { retireAssetIds } : {}),
      assetFiles: [],
      activities: [activity],
      cards,
      exercises: [exercise],
    },
  });
  writeJson(join(dir, "proposal.json"), proposal);
  const receipts = await nativeApply(dir, root, apply);
  writeJson(join(dir, apply ? "native-apply.json" : "native-proposal-check.json"), { receipts });
  log(
    dir,
    `MANUAL assemble-steps r${rev + 1}: hand-written version-3 lesson from ${inputFile}${replace ? ` replacing the old lesson (retired assets: ${retireAssetIds.join(", ") || "none"})` : ""}; ${apply ? "APPLIED via native dry-run + revise" : "native dry-run validated (not applied)"}`,
  );
}

/** Once per batch, after every lesson's `assemble --apply`: reactivate, then export recovery. */
async function stageFinish(dir) {
  const project = authoringProjectRoot();
  const formalRoot = existsSync(configuredContent.root)
    ? realpathSync(configuredContent.root)
    : configuredContent.root;
  if (project !== moduleRoot && project !== formalRoot)
    throw Error(
      "An unpublished authoring project cannot export into the configured content root; prepare its isolated preview instead",
    );
  const { executeUniversityLocalCli, parseUniversityLocalCli } = await import(
    pathToFileURL(join(moduleRoot, ".university-local-build/server/cli.js")).href
  );
  const run = (argv) =>
    executeUniversityLocalCli({
      projectRoot: project,
      cwd: repoRoot,
      env: process.env,
      command: parseUniversityLocalCli(argv),
    });
  const receipts = [
    {
      args: "reactivate",
      result: await run(["course", "reactivate", "--study", STUDY, "--course", COURSE]),
    },
    {
      args: "recovery export",
      result: await run([
        "course",
        "recovery",
        "export",
        "--study",
        STUDY,
        "--out",
        join(configuredContent.recovery, STUDY),
      ]),
    },
  ];
  writeJson(join(dir, "native-finish.json"), receipts);
  log(
    dir,
    "finish: course reactivated and recovery exported; run `pnpm content` at the repository root",
  );
}
function libraryEvidence(packet, url) {
  const root = studiesRoot();
  let best;
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) walk(path);
      else if (name.name === "manifest.json" && path.includes("/revisions/")) {
        const r = Number(path.split("/revisions/")[1].split("/")[0]);
        for (const e of readJson(path).evidence ?? [])
          if (e.sourceUrl === url && (!best || best.r < r)) best = { r, e };
      }
    }
  };
  walk(join(root, STUDY, "courses"));
  if (best) return best.e;
  return packet.library.find((entry) => entry.url === url)?.evidence;
}

// ── Which version is best: a fix can regress, and the Detector is noisy ─────
function versionScore(dir, v) {
  if (!existsSync(join(dir, `detector.v${v}.json`)) || !existsSync(join(dir, `lint.v${v}.json`)))
    return Infinity;
  // A person's review is an instruction to the fixer, not a Detector measurement.
  const findings = readJson(join(dir, `detector.v${v}.json`)).findings.filter(
    (f) => f.code !== "HUMAN",
  );
  const weight = { blocker: 10, major: 3, minor: 1 };
  const shape = readJson(join(dir, `lint.v${v}.json`)).filter((l) => l.code === "shape").length;
  return findings.reduce((sum, f) => sum + weight[f.severity], 0) + shape * 10;
}
function bestVersion(dir) {
  let best = 0;
  for (let v = 1; existsSync(join(dir, `draft.v${v}.json`)); v++)
    if (!best || versionScore(dir, v) < versionScore(dir, best)) best = v;
  return best;
}

// ── Batch report: what the line did unaided, what a person changed ──────────
function stageStatus() {
  const root = process.env.PRIMM_RUN_ROOT ?? join(repoRoot, ".scratch/primm-engine");
  const rows = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const dir = join(root, name.name);
    if (!name.isDirectory() || !existsSync(join(dir, "packet.json"))) continue;
    const packet = readJson(join(dir, "packet.json"));
    const versions = [];
    for (let v = 1; existsSync(join(dir, `draft.v${v}.json`)); v++) {
      const detector = existsSync(join(dir, `detector.v${v}.json`))
        ? readJson(join(dir, `detector.v${v}.json`))
        : null;
      const lint = existsSync(join(dir, `lint.v${v}.json`))
        ? readJson(join(dir, `lint.v${v}.json`))
        : [];
      const receipt = [`writer.v${v}`, `fixer.v${v}`]
        .map((b) => join(dir, `${b}.receipt.json`))
        .find(existsSync);
      versions.push({
        v,
        writer: receipt ? readJson(receipt).model : "?",
        minutes: receipt ? Math.round(readJson(receipt).ms / 6000) / 10 : null,
        shape: lint.filter((l) => l.code === "shape").length,
        verdict: detector?.verdict ?? "-",
        blocker: detector?.findings.filter((f) => f.severity === "blocker").length ?? null,
        major: detector?.findings.filter((f) => f.severity === "major").length ?? null,
        minor: detector?.findings.filter((f) => f.severity === "minor").length ?? null,
        score: versionScore(dir, v),
      });
    }
    const logText = existsSync(join(dir, "log.md"))
      ? readFileSync(join(dir, "log.md"), "utf8")
      : "";
    rows.push({
      lesson: `${packet.lesson.unitId}/${packet.lesson.lessonId}`,
      mode: packet.mode,
      versions,
      manual: logText
        .split("\n")
        .filter((l) => l.includes("MANUAL:"))
        .map((l) => l.replace(/^- \S+ MANUAL: /, "")),
      best: bestVersion(dir),
      polished: existsSync(join(dir, "final.json")),
      applied: existsSync(join(dir, "native-apply.json")),
    });
  }
  writeJson(join(root, "status.json"), rows);
  for (const row of rows) {
    console.log(
      `\n${row.lesson} (${row.mode})${row.polished ? " polished" : ""}${row.applied ? " landed" : ""}`,
    );
    for (const v of row.versions)
      console.log(
        `  v${v.v} ${v.writer} ${v.minutes ?? "?"}min shape=${v.shape} detector=${v.verdict} B${v.blocker ?? "-"}/M${v.major ?? "-"}/m${v.minor ?? "-"} score=${v.score}${v.v === row.best ? " ← best" : ""}`,
      );
    for (const m of row.manual) console.log(`  MANUAL ${m}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { stage, options } = args();
  if (stage === "status") {
    stageStatus();
    process.exit(0);
  }
  if (!stage || !options.lesson) {
    console.error(
      "Usage: primm-pipeline.mjs <packet|write|check|detect|fix|polish|assemble|run|note> --lesson <unit>/<lesson>",
    );
    process.exit(2);
  }
  const [unitId, lessonId] = String(options.lesson).split("/");
  const dir = runDir(lessonId);
  mkdirSync(dir, { recursive: true });
  const packetFile = join(dir, "packet.json");
  if (stage === "prepare-unpublished") {
    if (!process.env.PRIMM_PROJECT_ROOT)
      throw Error("Choose an explicit PRIMM_PROJECT_ROOT for the unpublished native shelf");
    const receipt = await prepareUnpublished({
      projectRoot: authoringProjectRoot(),
      recoveryRoot: resolve(options.recovery ?? join(configuredContent.recovery, STUDY)),
      studyId: STUDY,
      courseId: COURSE,
    });
    writeJson(join(dir, "unpublished-authoring.json"), receipt);
    log(dir, `prepared unpublished native authoring: ${receipt.studiesRoot}`);
    process.exit(0);
  }
  if (stage === "preview") {
    const receipt = await prepareUnpublishedPreview({ projectRoot: authoringProjectRoot() });
    writeJson(join(dir, "preview.json"), receipt);
    log(dir, `UNIVERSITY_PRIMM_PREVIEW_ROOT=${dirname(receipt.manifestPath)} pnpm primm:preview`);
    process.exit(0);
  }
  if (stage === "note") {
    log(dir, `MANUAL: ${options.text}`);
    process.exit(0);
  }
  if (stage === "packet" || (stage === "run" && !existsSync(packetFile))) {
    const notes = options["owner-notes"] ? readFileSync(options["owner-notes"], "utf8") : null;
    writeJson(packetFile, buildPacket(unitId, lessonId, options.mode ?? "new", notes));
    log(dir, `packet: ${lessonId} (${options.mode ?? "new"})`);
    if (stage === "packet") process.exit(0);
  }
  const packet = readJson(packetFile);
  if (
    packet.storage &&
    (packet.storage.projectRoot !== authoringProjectRoot() ||
      packet.storage.studiesRoot !== studiesRoot())
  )
    throw Error(
      "The packet belongs to a different authoring root; select its original PRIMM_PROJECT_ROOT",
    );
  // Cases verified by `research` after the packet was built join the library.
  if (existsSync(join(dir, "research.accepted.json")))
    for (const source of readJson(join(dir, "research.accepted.json")).sources)
      if (!packet.library.some((entry) => entry.url === source.url)) packet.library.push(source);
  const S = await schemas();
  const version = currentVersion(dir);
  if (stage === "research") {
    const draft = version ? readJson(join(dir, `draft.v${version}.json`)) : null;
    await stageResearch(
      dir,
      packet,
      S,
      options.need ?? draft?.plan.caseNeeded ?? packet.outline.title,
    );
  } else if (stage === "write") await stageWrite(dir, packet, S);
  else if (stage === "check") await stageCheck(dir, packet, version, S, !!options.final);
  else if (stage === "detect") await stageDetect(dir, packet, version, S);
  else if (stage === "fix")
    await stageFix(dir, packet, version, S, options.from ? Number(options.from) : undefined);
  else if (stage === "polish")
    await stagePolish(dir, packet, Number(options.version ?? bestVersion(dir)), S, {
      fixedTitle: options["fixed-title"],
    });
  else if (stage === "assemble") await stageAssemble(dir, packet, !!options.apply);
  else if (stage === "assemble-steps")
    await stageAssembleSteps(
      dir,
      packet,
      String(options.input),
      !!options.apply,
      !!options.replace,
    );
  else if (stage === "finish") await stageFinish(dir);
  else if (stage === "review") {
    // A person's reading goes into the same fix loop as the Detector's, marked as theirs.
    const v = Number(options.version ?? bestVersion(dir));
    const file = join(dir, `detector.v${v}.json`);
    const report = readJson(file);
    report.findings.push({
      code: "HUMAN",
      severity: options.severity ?? "major",
      where: options.where ?? "whole lesson",
      quote: options.quote ?? "",
      problem: String(options.text),
    });
    report.verdict = "revise";
    writeJson(file, report);
    log(dir, `MANUAL review of v${v} (${options.severity ?? "major"}): ${options.text}`);
  } else if (stage === "reparse") await stageReparse(dir, S, options.name ?? "writer.v1");
  else if (stage === "run") {
    const rounds = Number(options.rounds ?? 2);
    if (!version) await stageWrite(dir, packet, S);
    let v = currentVersion(dir);
    for (let round = 0; ; round++) {
      if (!existsSync(join(dir, `render.v${v}.md`))) await stageCheck(dir, packet, v, S);
      const lint = readJson(join(dir, `lint.v${v}.json`));
      if (lint.some((issue) => issue.code === "runtime"))
        throw Error("A real sample failed; inspect it before continuing the authoring run");
      const report = lint.some((issue) => issue.code === "shape")
        ? null
        : existsSync(join(dir, `detector.v${v}.json`))
          ? readJson(join(dir, `detector.v${v}.json`))
          : await stageDetect(dir, packet, v, S);
      const plan = readJson(join(dir, `draft.v${v}.json`)).plan;
      // Research when the writer found no fitting verified case, or said the one it used is weak.
      if (
        (!plan.caseSourceId || plan.caseNeeded?.trim()) &&
        !existsSync(join(dir, "research.checked.json"))
      ) {
        const found = await stageResearch(dir, packet, S, plan.caseNeeded || packet.outline.title);
        for (const source of found)
          if (!packet.library.some((e) => e.url === source.url)) packet.library.push(source);
      }
      const serious =
        (report?.findings.filter((f) => f.severity !== "minor").length ?? 0) +
        lint.filter((l) => l.code === "shape").length +
        (plan.caseSourceId ? 0 : 1);
      if ((!serious && report?.verdict === "ready") || round >= rounds) break;
      // A fix that scores worse than an earlier version ends the loop; the next fix
      // would start from the worse text. Polish picks the best version anyway.
      if (v > 1 && versionScore(dir, v) > versionScore(dir, bestVersion(dir))) break;
      await stageFix(dir, packet, v, S);
      v = currentVersion(dir);
    }
    const best = bestVersion(dir);
    log(
      dir,
      `run: stopped at v${v}; best is v${best} (score ${versionScore(dir, best)}); polish uses the best version`,
    );
  } else throw Error(`Unknown stage ${stage}`);
}

// Importing the pipeline for its own tests must never start a model or write a
// run directory. CLI execution remains the same single native-authoring path.
export { schemas, draftActivity, lintDraft, displayMap, polishIssues, buildPacket, callModel };
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
