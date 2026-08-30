import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildModelInvocation,
  grokTransportRetryReason,
  normalizeSourcePath,
  runModelWithReceipt,
  splitModelOutput,
  writeDraft,
  writeReceipt,
} from "./lesson-pipeline-runner.mjs";

describe("lesson pipeline runner", () => {
  it("resolves legacy and canonical source paths inside the requested checkout", () => {
    const root = mkdtempSync(join(tmpdir(), "lesson-runner-path-"));
    try {
      const sourceRoot = join(root, "studies", "turing-pact", "source", "checkouts", "git-test");
      mkdirSync(sourceRoot, { recursive: true });
      writeFileSync(join(sourceRoot, "index.html"), "<main>fixture</main>\n");

      const expected = join(sourceRoot, "index.html");
      expect(
        normalizeSourcePath({
          studiesRoot: join(root, "studies"),
          studyId: "turing-pact",
          snapshotId: "git-test",
          sourcePath: "source/checkouts/git-test/index.html",
          cwd: root,
        }),
      ).toBe(expected);
      expect(
        normalizeSourcePath({
          studiesRoot: join(root, "studies"),
          studyId: "turing-pact",
          snapshotId: "git-test",
          sourcePath: "studies/turing-pact/source/checkouts/git-test/index.html",
          cwd: root,
        }),
      ).toBe(expected);
      expect(() =>
        normalizeSourcePath({
          studiesRoot: join(root, "studies"),
          studyId: "turing-pact",
          snapshotId: "git-test",
          sourcePath: "source/checkouts/another-snapshot/index.html",
          cwd: root,
        }),
      ).toThrow("escapes the requested snapshot");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps progress out of the final Markdown", () => {
    const output = splitModelOutput("host progress\nchecking files\n# 这是一节课？\n\n正文。\n");

    expect(output.progress).toBe("host progress\nchecking files\n");
    expect(output.finalText).toBe("# 这是一节课？\n\n正文。");
  });

  it("retries Grok transport failures and preserves every raw stream", async () => {
    const progress: string[] = [];
    const receipt = await runModelWithReceipt({
      role: "writer",
      model: "grok-current",
      effort: "high",
      command: process.execPath,
      buildArgs: (attempt: number) => [
        "-e",
        attempt === 1
          ? 'process.stderr.write("transport decoding error\\n"); process.exit(1)'
          : 'process.stderr.write("retry progress\\n"); process.stdout.write("# 结果标题？\\n\\n正文。\\n")',
      ],
      timeoutMs: 1_000,
      maxAttempts: 2,
      retryDecider: grokTransportRetryReason,
      onProgress: ({ chunk }: { chunk: string }) => progress.push(chunk),
    });

    expect(receipt.status).toBe("success");
    expect(receipt.retry).toEqual({ maxAttempts: 2, attempts: 2, retried: true });
    expect(receipt.attempts[0].rawStderr).toContain("transport decoding error");
    expect(receipt.attempts[0].retryReason).toBe("transport");
    expect(receipt.attempts[1].rawStdout).toContain("# 结果标题？");
    expect(receipt.finalText).toBe("# 结果标题？\n\n正文。");
    expect(progress.join("")).toContain("retry progress");
    expect(progress.join("")).not.toContain("# 结果标题？");
  });

  it("records the child's actual non-zero exit code in the session result", async () => {
    const receipt = await runModelWithReceipt({
      role: "detector",
      model: "gemini-current",
      effort: "high",
      command: process.execPath,
      args: ["-e", 'process.stderr.write("content failure\\n"); process.exit(7)'],
      timeoutMs: 1_000,
    });

    expect(receipt.status).toBe("failed");
    expect(receipt.attempts).toHaveLength(1);
    expect(receipt.attempts[0].exitCode).toBe(7);
    expect(receipt.sessionResult.exitCode).toBe(7);
    expect(receipt.rawStderr).toContain("content failure");
  });

  it("marks a timed-out child and keeps the timeout in the receipt", async () => {
    const receipt = await runModelWithReceipt({
      role: "writer",
      model: "grok-current",
      effort: "high",
      command: process.execPath,
      args: ["-e", "setTimeout(() => process.stdout.write('# late？\\n'), 1000)"],
      timeoutMs: 30,
    });

    expect(receipt.status).toBe("failed");
    expect(receipt.attempts[0].status).toBe("timeout");
    expect(receipt.attempts[0].timedOut).toBe(true);
    expect(receipt.sessionResult.timedOut).toBe(true);
    expect(receipt.error).toContain("timed out after 30ms");
  });

  it("honors the model CLI traps documented by write-lesson", () => {
    const claude = buildModelInvocation({
      provider: "agy",
      model: "claude-sonnet-current",
      effort: "high",
      prompt: "只检查，不改写。",
    });
    expect(claude.args).not.toContain("--effort");

    const codex = buildModelInvocation({
      provider: "codex",
      model: "codex-current",
      effort: "max",
      prompt: "输出一节课。",
    });
    expect(codex.args).not.toContain("--prompt-file");
    expect(codex.input).toBe("输出一节课。");
  });

  it("writes a structured receipt and draft without allowing course-content output", () => {
    const root = mkdtempSync(join(tmpdir(), "lesson-runner-output-"));
    try {
      const receiptPath = writeReceipt(
        join(root, "artifacts", "receipt.json"),
        { status: "success" },
        { projectRoot: root },
      );
      const draftPath = writeDraft(join(root, "drafts", "lesson.md"), "# 标题？\n\n正文。", {
        projectRoot: root,
      });

      expect(JSON.parse(readFileSync(receiptPath, "utf8"))).toEqual({ status: "success" });
      expect(readFileSync(draftPath, "utf8")).toBe("# 标题？\n\n正文。\n");
      expect(() =>
        writeDraft(join(root, "apps", "local", "studies", "lesson.md"), "# 禁止？", {
          projectRoot: root,
        }),
      ).toThrow("course studies");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
