/**
 * Bake cited source ranges out of a study's Git mirror.
 *
 * Recovery packages name a commit and a line range. The authoring shell reads
 * those bytes from `studies/<id>/source/repository.git` on demand. The delivery
 * shell has no checkout, so import writes the same windowed snippet the
 * authoring API would return — content-addressed, per course, loaded only when
 * the reader opens that anchor. Same split the screenshots already use.
 *
 * A machine with no studies shelf (fresh clone, CI) bakes nothing and is not
 * a failed build. A missing blob is the same: skip it, keep going.
 *
 * `buzz` snippets carry their Apache-2.0 attribution on the JSON itself, so
 * the notice cannot drift from the bytes it describes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SNIPPET_LIMITS = Object.freeze({
  maxSourceBytes: 2 * 1024 * 1024,
  maxReturnedBytes: 64 * 1024,
  defaultContextLines: 5,
  maxHighlightedLines: 120,
  maxReturnedLines: 160,
});

/** Travels with every baked `buzz` range. Small and factual on purpose. */
export const BUZZ_ATTRIBUTION = "Source: https://github.com/block/buzz (Apache License 2.0)";

const ATTRIBUTION_BY_STUDY = Object.freeze({
  buzz: BUZZ_ATTRIBUTION,
});

export function studyRepository(studiesRoot, studyId) {
  if (!studiesRoot || !studyId) return null;
  const gitDir = join(studiesRoot, studyId, "source", "repository.git");
  return existsSync(gitDir) ? gitDir : null;
}

export function hasAnyStudyRepository(studiesRoot) {
  if (!studiesRoot || !existsSync(studiesRoot)) return false;
  try {
    for (const name of readdirSync(studiesRoot)) {
      const entry = join(studiesRoot, name);
      if (!statSync(entry).isDirectory()) continue;
      if (studyRepository(studiesRoot, name)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function gitBuffer(gitDir, args) {
  return execFileSync("git", ["--git-dir", gitDir, ...args], {
    env: {
      ...process.env,
      GIT_LITERAL_PATHSPECS: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
  });
}

function sourceLines(text) {
  if (text.length === 0) return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (/(?:\r\n|\n|\r)$/.test(text)) lines.pop();
  return lines;
}

export function inferSnippetLanguage(sourcePath) {
  const lower = String(sourcePath ?? "").toLowerCase();
  const name = lower.split("/").at(-1) ?? lower;
  if (name === "package.json" || name === "tsconfig.json" || name.endsWith(".json")) return "json";
  if (name === "dockerfile" || name === "makefile") return "shellscript";
  const extension = name.includes(".") ? (name.split(".").at(-1) ?? "") : "";
  return (
    {
      ts: "typescript",
      mts: "typescript",
      cts: "typescript",
      tsx: "tsx",
      js: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      jsx: "jsx",
      json: "json",
      css: "css",
      scss: "css",
      html: "html",
      htm: "html",
      md: "markdown",
      mdx: "markdown",
      sh: "shellscript",
      bash: "shellscript",
      zsh: "shellscript",
      py: "python",
      go: "go",
      rs: "rust",
      sql: "sql",
      yml: "yaml",
      yaml: "yaml",
      vue: "vue",
      svelte: "svelte",
    }[extension] ?? "text"
  );
}

export function windowCitedRange(lineCount, lineStart, lineEnd, context = SNIPPET_LIMITS.defaultContextLines) {
  const hasRange = lineStart !== undefined && lineStart !== null;
  const highlightStartLine = hasRange ? lineStart : null;
  const highlightEndLine = hasRange ? (lineEnd ?? lineStart) : null;
  if (highlightStartLine !== null && highlightEndLine !== null) {
    if (highlightStartLine < 1 || highlightEndLine < highlightStartLine) return null;
    if (highlightEndLine > lineCount) return null;
    if (highlightEndLine - highlightStartLine + 1 > SNIPPET_LIMITS.maxHighlightedLines) return null;
  }
  const startLine = hasRange ? Math.max(1, highlightStartLine - context) : 1;
  const endLine = hasRange
    ? Math.min(lineCount, (highlightEndLine ?? lineCount) + context)
    : lineCount;
  if (endLine - startLine + 1 > SNIPPET_LIMITS.maxReturnedLines) return null;
  return { startLine, endLine, highlightStartLine, highlightEndLine };
}

function decodeTextBlob(source, sourcePath) {
  if (source.includes(0)) {
    throw new Error(`binary blob: ${sourcePath}`);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(source);
}

/**
 * The same window the authoring `/evidence/:index` endpoint returns: cited
 * lines plus five of context, real line numbers, language inferred from path.
 * Returns null when the mirror cannot produce a displayable snippet.
 */
export function readCitedSnippet(gitDir, evidence) {
  const sourceCommit = evidence?.sourceCommit;
  const sourcePath = evidence?.sourcePath;
  if (!gitDir || typeof sourceCommit !== "string" || typeof sourcePath !== "string") return null;
  if (sourcePath.length === 0 || sourcePath.includes("\0") || sourcePath.startsWith("-")) {
    return null;
  }
  let raw;
  try {
    raw = gitBuffer(gitDir, ["show", `${sourceCommit}:${sourcePath}`]);
  } catch {
    return null;
  }
  if (raw.length > SNIPPET_LIMITS.maxSourceBytes) return null;
  let text;
  try {
    text = decodeTextBlob(raw, sourcePath);
  } catch {
    return null;
  }
  const lines = sourceLines(text);
  if (lines.length === 0) return null;
  const window = windowCitedRange(lines.length, evidence.lineStart, evidence.lineEnd);
  if (!window) return null;
  const code = lines.slice(window.startLine - 1, window.endLine).join("\n");
  if (Buffer.byteLength(code, "utf8") > SNIPPET_LIMITS.maxReturnedBytes) return null;
  return {
    sourcePath,
    sourceCommit,
    startLine: window.startLine,
    endLine: window.endLine,
    highlightStartLine: window.highlightStartLine,
    highlightEndLine: window.highlightEndLine,
    language: inferSnippetLanguage(sourcePath),
    code,
    ...(window.startLine > 1 ? { truncatedBefore: true } : {}),
    ...(window.endLine < lines.length ? { truncatedAfter: true } : {}),
  };
}

/**
 * Writes content-addressed snippet files and stamps `snippetUrl` onto each
 * evidence item that baked. Items that cannot be read are left untouched so
 * the reader can still show the locator.
 */
export function bakeLessonEvidence({
  studiesRoot,
  studyId,
  courseId,
  evidence,
  contentRoot,
  sha,
}) {
  const stats = { baked: 0, skipped: 0, bytes: 0, files: 0 };
  const items = Array.isArray(evidence) ? evidence : [];
  if (items.length === 0) return stats;
  const gitDir = studyRepository(studiesRoot, studyId);
  if (!gitDir) {
    stats.skipped = items.length;
    return stats;
  }
  const attribution = ATTRIBUTION_BY_STUDY[studyId];
  const outDir = join(contentRoot, studyId, courseId, "evidence");
  for (const item of items) {
    const snippet = readCitedSnippet(gitDir, item);
    if (!snippet) {
      stats.skipped += 1;
      continue;
    }
    if (attribution) snippet.attribution = attribution;
    const body = Buffer.from(`${JSON.stringify(snippet)}\n`, "utf8");
    const digest = sha(body);
    mkdirSync(outDir, { recursive: true });
    const name = `${digest}.json`;
    const target = join(outDir, name);
    if (!existsSync(target)) {
      writeFileSync(target, body);
      stats.files += 1;
      stats.bytes += body.length;
    }
    item.snippetUrl = `/content/${studyId}/${courseId}/evidence/${name}`;
    stats.baked += 1;
  }
  return stats;
}
