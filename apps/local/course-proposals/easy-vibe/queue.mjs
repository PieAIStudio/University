#!/usr/bin/env node
/**
 * Keep a fixed number of model jobs in flight across a whole list of lessons.
 *
 * Batch-and-wait wastes the tail: six jobs launched together finish minutes
 * apart and the machine idles until the slowest returns. This starts the next
 * lesson the moment a slot frees, so the queue drains at the rate the backend
 * actually answers.
 *
 * A failed lesson is recorded and the queue keeps going. Stopping the whole run
 * because one lesson's answer did not parse would waste every job still in
 * flight, and the failure is readable afterwards either way.
 *
 * Usage: node queue.mjs <concurrency> <targets-file>
 *   targets-file: one "studyId courseId unitId lessonId" per line
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";

// Defaults to this script's own directory so it works from wherever it was
// checked out, rather than one session's scratchpad path.
const HERE = process.env.QUEUE_DIR || new URL(".", import.meta.url).pathname;
const [concurrencyArg, targetsFile] = process.argv.slice(2);
const concurrency = Number(concurrencyArg) || 4;

const targets = readFileSync(targetsFile, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split(/\s+/));

for (const dir of ["acts", "logs"]) mkdirSync(`${HERE}/${dir}`, { recursive: true });

const queue = [...targets];
const done = [];
const started = Date.now();

function runOne([studyId, courseId, unitId, lessonId]) {
  return new Promise((resolveJob) => {
    const out = `${HERE}/acts/${lessonId}.json`;
    // Already answered on an earlier run: skip rather than pay for it twice.
    if (existsSync(out)) {
      done.push({ lessonId, status: "跳过（已有答案）" });
      resolveJob();
      return;
    }
    const log = `${HERE}/logs/act-${lessonId}.log`;
    const child = spawn(
      "node",
      [`${HERE}/pick-activity.mjs`, studyId, courseId, unitId, lessonId, out],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let text = "";
    child.stdout.on("data", (chunk) => (text += chunk));
    child.stderr.on("data", (chunk) => (text += chunk));
    child.on("close", (code) => {
      writeFileSync(log, text);
      const line = text.trim().split("\n").pop() ?? "";
      done.push({ lessonId, status: code === 0 ? line : `失败(${code}) ${line.slice(0, 120)}` });
      console.log(
        `[${done.length}/${targets.length}] ${code === 0 ? "✓" : "✗"} ${line || lessonId}`,
      );
      resolveJob();
    });
  });
}

async function worker() {
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    await runOne(next);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));

const minutes = Math.round((Date.now() - started) / 60000);
console.log(`\n=== 队列跑完：${done.length} 节，${minutes} 分钟 ===`);
for (const entry of done) console.log(`  ${entry.status}`);
