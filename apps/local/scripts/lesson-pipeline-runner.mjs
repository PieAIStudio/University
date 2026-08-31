#!/usr/bin/env node
/**
 * The process boundary for the write-lesson model stages.
 *
 * This runner deliberately does not use a shell. It gives every model call a
 * normalized snapshot path, captures the child process's close event directly,
 * keeps progress separate from the final Markdown, and retains one structured
 * receipt for every attempt. It only produces a draft and a receipt; course
 * revisions still go through the course CLI.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

export const DEFAULT_MAX_ATTEMPTS = 2;
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
export const DEFAULT_RECEIPT_PATH = "artifacts/write-lesson/last-receipt.json";

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GROK_TRANSPORT_ERRORS = [
  /transport/i,
  /decod(?:e|ing)/i,
  /(?:ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|EPIPE|ENETUNREACH)/i,
  /\b(?:429|502|503|504)\b/,
  /(?:network|rate limit|temporarily unavailable|timed out)/i,
];

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  if (value.includes("\0")) throw new TypeError(`${label} contains a NUL byte`);
  return value.trim();
}

function requireSafeId(value, label) {
  const id = requireText(value, label);
  if (!SAFE_ID.test(id)) {
    throw new TypeError(`${label} must be a kebab-case id, got ${JSON.stringify(id)}`);
  }
  return id;
}

function isInside(parent, candidate) {
  const child = relative(parent, candidate);
  return child === "" || (!child.startsWith(`..${sep}`) && child !== ".." && !isAbsolute(child));
}

function portablePath(path) {
  return path.split(sep).join("/");
}

/** Return the only checkout root a lesson model is allowed to read. */
export function snapshotCheckoutRoot({
  studiesRoot = "studies",
  studyId,
  snapshotId,
  cwd = process.cwd(),
}) {
  const study = requireSafeId(studyId, "studyId");
  const snapshot = requireSafeId(snapshotId, "snapshotId");
  return resolve(cwd, studiesRoot, study, "source", "checkouts", snapshot);
}

/**
 * Normalize all accepted source-path forms to an absolute path inside the
 * requested immutable checkout.
 *
 * Accepted inputs are a path relative to the checkout (`index.html`), the
 * legacy study-relative form (`source/checkouts/<snapshot>/index.html`), or a
 * repository-relative/absolute canonical path. A path from another snapshot
 * or a path traversal is rejected before any model process is started.
 */
export function normalizeSourcePath({
  studiesRoot = "studies",
  studyId,
  snapshotId,
  sourcePath,
  cwd = process.cwd(),
}) {
  const raw = requireText(sourcePath, "sourcePath");
  const workingDirectory = resolve(cwd);
  const checkoutRoot = snapshotCheckoutRoot({
    studiesRoot,
    studyId,
    snapshotId,
    cwd: workingDirectory,
  });
  const studiesRootAbsolute = resolve(workingDirectory, studiesRoot);
  const studyIdValue = requireSafeId(studyId, "studyId");
  const snapshotIdValue = requireSafeId(snapshotId, "snapshotId");
  const portableRaw = raw.replaceAll("\\", "/");
  const legacySnapshot = /^source\/checkouts\/([^/]+)(?:\/|$)/.exec(portableRaw)?.[1];
  const canonicalSnapshot = /^studies\/([^/]+)\/source\/checkouts\/([^/]+)(?:\/|$)/.exec(
    portableRaw,
  );
  if (legacySnapshot && legacySnapshot !== snapshotIdValue) {
    throw new Error(
      `Source path escapes the requested snapshot: ${JSON.stringify(raw)}; expected snapshot ${snapshotIdValue}`,
    );
  }
  if (
    canonicalSnapshot &&
    (canonicalSnapshot[1] !== studyIdValue || canonicalSnapshot[2] !== snapshotIdValue)
  ) {
    throw new Error(
      `Source path escapes the requested snapshot: ${JSON.stringify(raw)}; expected ${studyIdValue}/${snapshotIdValue}`,
    );
  }
  const candidates = isAbsolute(raw)
    ? [resolve(raw)]
    : [
        // Also accept the canonical path written from the repository root.
        resolve(workingDirectory, raw),
        // Repair the old dispatcher form: source/checkouts/... was missing the study.
        resolve(studiesRootAbsolute, studyIdValue, raw),
        // The manifest's sourcePath is relative to the pinned checkout.
        resolve(checkoutRoot, raw),
      ];
  const normalized = candidates.find((candidate) => isInside(checkoutRoot, candidate));
  if (!normalized) {
    throw new Error(
      `Source path escapes the requested snapshot: ${JSON.stringify(raw)}; expected a path inside ${checkoutRoot}`,
    );
  }

  // Lexical containment prevents traversal. If the file already exists, the
  // realpath check also prevents a symlink from smuggling a different file into
  // the model context.
  if (existsSync(normalized) && existsSync(checkoutRoot)) {
    const realRoot = realpathSync.native(checkoutRoot);
    const realFile = realpathSync.native(normalized);
    if (!isInside(realRoot, realFile)) {
      throw new Error(`Source path resolves outside the requested snapshot: ${normalized}`);
    }
  }
  return normalized;
}

/** Add normalized source paths to the model prompt without changing the lesson content. */
export function appendSourcePaths(prompt, sourcePaths) {
  const body = requireText(prompt, "prompt");
  if (!sourcePaths?.length) return body;
  return [
    body,
    "",
    "请直接读取以下已规范化的源码路径；不要用模糊搜索替代它们：",
    ...sourcePaths.map((path) => `- ${portablePath(path)}`),
    "",
  ].join("\n");
}

function isInsideMarkdownFence(text, index) {
  let fenced = false;
  for (const line of text.slice(0, index).split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced;
  }
  return fenced;
}

/**
 * Find a glued lesson H1 without treating an inline hash as a heading.
 *
 * The normal path remains the strict Markdown rule: H1 must start a line. A
 * model can nevertheless append its final Markdown to the last progress
 * sentence. The fallback accepts only a question-shaped H1 after punctuation,
 * followed by a blank line; `C# 是一门语言` therefore remains ordinary prose.
 */
function findInlineLessonHeading(text) {
  const candidates = /#[ \t]+\S[^\r\n]*/g;
  let candidate;
  while ((candidate = candidates.exec(text)) !== null) {
    const index = candidate.index;
    const preceding = text[index - 1];
    if (!preceding || /[A-Za-z0-9_$]/.test(preceding) || !/[\p{P}\p{S}]/u.test(preceding)) {
      continue;
    }
    if (isInsideMarkdownFence(text, index)) continue;
    const title = candidate[0].trimEnd();
    if (!/[?？]$/.test(title)) continue;
    const afterTitle = text.slice(index + candidate[0].length);
    if (!/^(?:\r?\n){2}/.test(afterTitle)) continue;
    return { index, length: candidate[0].length };
  }
  return null;
}

/**
 * Split a model's mixed stdout. Progress before the first H1 is diagnostic
 * output; the first H1 onward is the candidate Markdown. No final Markdown is
 * ever forwarded through the progress callback. `finalTextSource` is retained
 * so a fallback recovery is visible in the stage receipt.
 */
export function splitModelOutput(rawStdout) {
  const text = String(rawStdout ?? "");
  const strictHeading = /^#[ \t]+\S.*$/m.exec(text);
  const heading = strictHeading
    ? { index: strictHeading.index, length: strictHeading[0].length, source: "line-start-h1" }
    : (() => {
        const fallback = findInlineLessonHeading(text);
        return fallback ? { ...fallback, source: "inline-h1-fallback" } : null;
      })();
  if (!heading) return { progress: text, finalText: null, finalTextSource: null };
  return {
    progress: text.slice(0, heading.index),
    finalText: text.slice(heading.index).trim(),
    finalTextSource: heading.source,
  };
}

function emitProgress(onProgress, stream, chunk) {
  if (!onProgress || !chunk) return;
  try {
    onProgress({ stream, chunk });
  } catch {
    // A progress sink is observability only. A broken terminal/logger must not
    // turn a successful model response into a different model result.
  }
}

/**
 * Spawn one child process without a shell and resolve from its `close` event.
 * `exitCode` is the child's actual exit code; it is intentionally not stored in
 * a shell variable named `status` (zsh reserves that name).
 */
export function runChildProcess({
  command,
  args = [],
  cwd,
  env,
  input,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onProgress,
}) {
  const executable = requireText(command, "command");
  if (!Array.isArray(args)) throw new TypeError("args must be an array");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive finite number");
  }

  return new Promise((resolveResult) => {
    const startedAtMs = Date.now();
    let child;
    try {
      child = spawn(executable, args, {
        cwd,
        env: { ...process.env, ...(env ?? {}) },
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      const finishedAtMs = Date.now();
      resolveResult({
        startedAt: new Date(startedAtMs).toISOString(),
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: finishedAtMs - startedAtMs,
        exitCode: null,
        signal: null,
        timedOut: false,
        spawnError: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        stdout: "",
        stderr: "",
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let spawnError = null;
    let settled = false;
    let timeoutHandle;
    let killHandle;

    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      clearTimeout(killHandle);
      const parsed = splitModelOutput(stdout);
      emitProgress(onProgress, "stdout", parsed.progress);
      const finishedAtMs = Date.now();
      resolveResult({
        startedAt: new Date(startedAtMs).toISOString(),
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: finishedAtMs - startedAtMs,
        exitCode,
        signal,
        timedOut,
        spawnError,
        stdout,
        stderr,
      });
    };

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      emitProgress(onProgress, "stderr", text);
    });
    child.once("error", (error) => {
      spawnError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    });
    child.once("close", (exitCode, signal) => finish(exitCode, signal));

    timeoutHandle = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      emitProgress(
        onProgress,
        "runner",
        `model process timed out after ${timeoutMs}ms; stopping it\n`,
      );
      child.kill("SIGTERM");
      killHandle = setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 250);
    }, timeoutMs);

    if (input === undefined || input === null) child.stdin.end();
    else child.stdin.end(input);
  });
}

function failureMessage(processResult, parsed, timeoutMs) {
  if (processResult.timedOut) return `model process timed out after ${timeoutMs}ms`;
  if (processResult.spawnError) return processResult.spawnError;
  if (processResult.exitCode !== 0) {
    return `model process exited with code ${processResult.exitCode ?? "unknown"}${processResult.signal ? ` (${processResult.signal})` : ""}`;
  }
  if (!parsed.finalText) return "model stdout did not contain a Markdown H1 final answer";
  return null;
}

/** Return the reason a failed Grok attempt is safe to retry, or null. */
export function grokTransportRetryReason(attempt) {
  if (attempt.timedOut) return "timeout";
  const output = `${attempt.rawStdout}\n${attempt.rawStderr}\n${attempt.error ?? ""}`;
  return GROK_TRANSPORT_ERRORS.some((pattern) => pattern.test(output)) ? "transport" : null;
}

/**
 * Run one model stage and return a receipt even when the child fails. Every
 * attempt keeps raw stdout/stderr, parsed progress/final text, close metadata,
 * and a sessionResult suitable for postmortem inspection.
 */
export async function runModelWithReceipt({
  role = "model",
  model = null,
  effort = null,
  command,
  args = [],
  buildArgs,
  cwd,
  env,
  input,
  buildInput,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = 1,
  retryDecider = () => null,
  onProgress,
}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }
  const startedAtMs = Date.now();
  const attempts = [];
  let finalAttempt = null;

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    const commandArgs = buildArgs ? buildArgs(attemptNumber) : args;
    const commandInput = buildInput ? buildInput(attemptNumber) : input;
    const processResult = await runChildProcess({
      command,
      args: commandArgs,
      cwd,
      env,
      input: commandInput,
      timeoutMs,
      onProgress,
    });
    const parsed = splitModelOutput(processResult.stdout);
    const error = failureMessage(processResult, parsed, timeoutMs);
    const status = error === null ? "success" : processResult.timedOut ? "timeout" : "failed";
    const attempt = {
      attempt: attemptNumber,
      startedAt: processResult.startedAt,
      finishedAt: processResult.finishedAt,
      durationMs: processResult.durationMs,
      status,
      exitCode: processResult.exitCode,
      signal: processResult.signal,
      timedOut: processResult.timedOut,
      error,
      rawStdout: processResult.stdout,
      rawStderr: processResult.stderr,
      progressStdout: parsed.progress,
      finalText: parsed.finalText,
      finalTextSource: parsed.finalTextSource,
      sessionResult: {
        outcome: status,
        exitCode: processResult.exitCode,
        signal: processResult.signal,
        timedOut: processResult.timedOut,
        spawnError: processResult.spawnError,
        durationMs: processResult.durationMs,
        finalTextCaptured: parsed.finalText !== null,
      },
      retryReason: null,
      retryable: false,
      command: { executable: command, args: [...commandArgs], cwd: cwd ?? process.cwd() },
    };
    const retryReason = error === null ? null : retryDecider(attempt);
    attempt.retryReason = retryReason;
    attempt.retryable = retryReason !== null && attemptNumber < maxAttempts;
    attempts.push(attempt);
    finalAttempt = attempt;
    if (!attempt.retryable) break;
    emitProgress(
      onProgress,
      "runner",
      `retrying ${role} after ${retryReason} (attempt ${attemptNumber + 1}/${maxAttempts})\n`,
    );
  }

  const finishedAtMs = Date.now();
  const success = finalAttempt?.status === "success";
  return {
    schemaVersion: 1,
    role,
    model,
    effort,
    status: success ? "success" : "failed",
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    command: finalAttempt?.command ?? { executable: command, args: [], cwd: cwd ?? process.cwd() },
    retry: {
      maxAttempts,
      attempts: attempts.length,
      retried: attempts.length > 1,
    },
    error: finalAttempt?.error ?? null,
    rawStdout: finalAttempt?.rawStdout ?? "",
    rawStderr: finalAttempt?.rawStderr ?? "",
    progressStdout: finalAttempt?.progressStdout ?? "",
    finalText: finalAttempt?.finalText ?? null,
    finalTextSource: finalAttempt?.finalTextSource ?? null,
    sessionResult: finalAttempt?.sessionResult ?? null,
    attempts,
  };
}

function requireProvider(value) {
  const provider = requireText(value, "provider");
  if (!["grok", "agy", "codex"].includes(provider)) {
    throw new TypeError(`provider must be grok, agy, or codex; got ${provider}`);
  }
  return provider;
}

/** Build a direct child-process invocation matching references/models.md. */
export function buildModelInvocation({
  provider: rawProvider,
  model: rawModel,
  effort,
  cwd,
  prompt,
  promptFile,
}) {
  const provider = requireProvider(rawProvider);
  const model = requireText(rawModel, "model");
  const workingDirectory = resolve(cwd ?? process.cwd());
  if (provider === "grok") {
    const file = requireText(promptFile, "promptFile");
    if (!effort) throw new TypeError("Grok requires an effort");
    return {
      command: "grok",
      args: [
        "-m",
        model,
        "--effort",
        effort,
        "--always-approve",
        "--cwd",
        workingDirectory,
        "--prompt-file",
        file,
      ],
      input: undefined,
    };
  }
  if (provider === "agy") {
    return {
      command: "agy",
      args: [
        "-p",
        requireText(prompt, "prompt"),
        "--model",
        model,
        // agy rejects --effort for Claude; the fallback must omit it.
        ...(effort && !/claude/i.test(model) ? ["--effort", effort] : []),
        "--dangerously-skip-permissions",
      ],
      input: undefined,
    };
  }
  return {
    command: "codex",
    args: [
      "exec",
      "-m",
      model,
      ...(effort ? ["-c", `model_reasoning_effort=${JSON.stringify(effort)}`] : []),
      "--dangerously-bypass-approvals-and-sandbox",
      "-",
    ],
    input: requireText(prompt, "prompt"),
  };
}

/**
 * Dispatch a single Writer, Detector, fixer, or Polisher stage. Source files
 * are resolved before the command starts, and Grok gets the measured retry
 * policy; other providers fail once unless the caller supplies another policy.
 */
export async function dispatchModel({
  provider: rawProvider,
  role = "model",
  model,
  effort = null,
  prompt,
  promptFile,
  cwd = process.cwd(),
  studiesRoot = "studies",
  studyId,
  snapshotId,
  sourcePaths = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts,
  onProgress,
}) {
  const provider = requireProvider(rawProvider);
  const workingDirectory = resolve(cwd);
  const initialPrompt = promptFile
    ? readFileSync(resolve(workingDirectory, promptFile), "utf8")
    : requireText(prompt, "prompt");
  if (promptFile && prompt !== undefined)
    throw new TypeError("provide prompt or promptFile, not both");

  const normalizedSources = sourcePaths.map((sourcePath) => {
    if (!studyId || !snapshotId) {
      throw new Error("studyId and snapshotId are required when sourcePaths are supplied");
    }
    const normalized = normalizeSourcePath({
      studiesRoot,
      studyId,
      snapshotId,
      sourcePath,
      cwd: workingDirectory,
    });
    if (!existsSync(normalized)) throw new Error(`Source file does not exist: ${normalized}`);
    return normalized;
  });
  const enrichedPrompt = appendSourcePaths(initialPrompt, normalizedSources);

  let temporaryPromptDirectory = null;
  let effectivePromptFile = promptFile ? resolve(workingDirectory, promptFile) : null;
  try {
    if (provider === "grok" && (!effectivePromptFile || normalizedSources.length > 0)) {
      temporaryPromptDirectory = mkdtempSync(join(tmpdir(), "write-lesson-prompt-"));
      effectivePromptFile = join(temporaryPromptDirectory, "prompt.md");
      writeFileSync(effectivePromptFile, enrichedPrompt, "utf8");
    }
    const invocation = buildModelInvocation({
      provider,
      model,
      effort,
      cwd: workingDirectory,
      prompt: enrichedPrompt,
      promptFile: effectivePromptFile,
    });
    const receipt = await runModelWithReceipt({
      role,
      model,
      effort,
      ...invocation,
      cwd: workingDirectory,
      timeoutMs,
      maxAttempts: maxAttempts ?? (provider === "grok" ? DEFAULT_MAX_ATTEMPTS : 1),
      retryDecider: provider === "grok" ? grokTransportRetryReason : undefined,
      onProgress,
    });
    return {
      ...receipt,
      provider,
      sourceFiles: normalizedSources.map(portablePath),
    };
  } finally {
    if (temporaryPromptDirectory)
      rmSync(temporaryPromptDirectory, { recursive: true, force: true });
  }
}

function assertNotCourseContentPath(filePath, projectRoot) {
  const absolute = resolve(projectRoot, filePath);
  const forbiddenRoots = [
    resolve(projectRoot, "apps", "local", "studies"),
    resolve(projectRoot, "studies"),
  ];
  if (forbiddenRoots.some((root) => isInside(root, absolute))) {
    throw new Error(`Draft/receipt output may not be written inside course studies: ${absolute}`);
  }
  return absolute;
}

export function writeReceipt(filePath, receipt, { projectRoot = process.cwd() } = {}) {
  const absolute = assertNotCourseContentPath(filePath, projectRoot);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return absolute;
}

export function writeDraft(filePath, finalText, { projectRoot = process.cwd() } = {}) {
  if (typeof finalText !== "string" || finalText.trim() === "") {
    throw new Error("cannot write a draft without final Markdown text");
  }
  const absolute = assertNotCourseContentPath(filePath, projectRoot);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${finalText.trim()}\n`, "utf8");
  return absolute;
}

function usage() {
  return `Usage: pnpm lesson:run -- --provider <grok|agy|codex> --model <id> --prompt-file <file> [options]

Runs one write-lesson model stage, writes final Markdown separately from progress, and retains a JSON receipt.

Options:
  --role <name>             receipt role (default: model)
  --effort <level>          model reasoning effort (omitted for Claude under agy)
  --cwd <path>              model/repository working directory (default: cwd)
  --studies-root <path>     studies root used for source normalization (default: studies)
  --study <id>              study id, required with --source
  --snapshot <id>           snapshot id, required with --source
  --source <path>           source path relative to the snapshot; repeatable
  --timeout-ms <n>          child timeout (default: ${DEFAULT_TIMEOUT_MS})
  --max-attempts <n>       max attempts (Grok defaults to ${DEFAULT_MAX_ATTEMPTS})
  --output <file>           write final Markdown to this path instead of stdout
  --receipt <file>          receipt path (default: ${DEFAULT_RECEIPT_PATH})
  --help                    show this help
`;
}

function parseCliArgs(values) {
  const args = values[0] === "--" ? values.slice(1) : values;
  const options = { sourcePaths: [] };
  const valueOptions = new Set([
    "provider",
    "role",
    "model",
    "effort",
    "prompt-file",
    "cwd",
    "studies-root",
    "study",
    "snapshot",
    "source",
    "timeout-ms",
    "max-attempts",
    "output",
    "receipt",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--help" || value === "-h") return { help: true, options };
    if (!value.startsWith("--") || !valueOptions.has(value.slice(2))) {
      throw new Error(`Unknown option: ${value}`);
    }
    const key = value.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`Missing value for ${value}`);
    index += 1;
    if (key === "source") options.sourcePaths.push(next);
    else options[key] = next;
  }
  for (const key of ["provider", "model", "prompt-file"]) {
    if (!options[key]) throw new Error(`Missing required option --${key}`);
  }
  return { help: false, options };
}

export async function main(argv = process.argv.slice(2), io = process) {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.help) {
      io.stdout.write(usage());
      return 0;
    }
    const options = parsed.options;
    const cwd = resolve(options.cwd ?? process.cwd());
    const receiptPath = options.receipt ?? DEFAULT_RECEIPT_PATH;
    const receipt = await dispatchModel({
      provider: options.provider,
      role: options.role ?? "model",
      model: options.model,
      effort: options.effort ?? null,
      promptFile: options["prompt-file"],
      cwd,
      studiesRoot: options["studies-root"] ?? "studies",
      studyId: options.study,
      snapshotId: options.snapshot,
      sourcePaths: options.sourcePaths,
      timeoutMs: options["timeout-ms"] ? Number(options["timeout-ms"]) : DEFAULT_TIMEOUT_MS,
      maxAttempts: options["max-attempts"] ? Number(options["max-attempts"]) : undefined,
      onProgress: ({ chunk }) => io.stderr.write(chunk),
    });
    const writtenReceipt = writeReceipt(receiptPath, receipt, { projectRoot: cwd });
    io.stderr.write(`receipt: ${writtenReceipt}\n`);
    if (receipt.status !== "success") {
      io.stderr.write(`model stage failed: ${receipt.error ?? "unknown error"}\n`);
      return 1;
    }
    if (options.output) {
      const output = writeDraft(options.output, receipt.finalText, { projectRoot: cwd });
      io.stderr.write(`draft: ${output}\n`);
    } else {
      io.stdout.write(`${receipt.finalText}\n`);
    }
    return 0;
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
