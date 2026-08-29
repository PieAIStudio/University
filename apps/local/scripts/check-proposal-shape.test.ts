/**
 * The teaching gates are tested against the reviewed Turing Pact proposal as
 * well as small focused fixtures. The real file supplies the actual beginner
 * complaints; the fixtures make the positive boundary of each heuristic
 * explicit without editing the course that is intentionally still behind the
 * writing skill.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(import.meta.dirname, "check-proposal-shape.mjs");
const REAL_PROPOSAL = join(import.meta.dirname, "../course-proposals/turing-zero-tier.json");
const FIXTURE_DIR = mkdtempSync(join(tmpdir(), "proposal-shape-teaching-"));
const CHECK_IDS = ["exact-answer", "title-answer", "analogy-order", "term-drift"] as const;

type CheckId = (typeof CHECK_IDS)[number];

function run(paths: string[], skippedChecks: CheckId[] = []) {
  const args = [SCRIPT];
  for (const check of skippedChecks) args.push("--skip-check", check);
  args.push(...paths);
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

function runReal(skippedChecks: CheckId[]) {
  return run([REAL_PROPOSAL], skippedChecks);
}

function baseContent({
  conclusion = "这节课先把一个小概念放进地图。",
  work = "工作示例把它放回真实场景。",
} = {}) {
  return `# 示例课

## 学习目标
完成本课后，你能用自己的话复述这件事。

## 先给结论
${conclusion}

## 一个类比
它像一扇普通的门：先看门怎么开，再记门的名字。

## 工作示例
${work}

## 自检
你能说明刚才这件事为什么这样工作吗？

## 重点
先理解关系，再记住需要查找的名字。
`;
}

function proposalFor(lesson: Record<string, unknown>) {
  const evidence = {
    kind: "fact",
    snapshotId: "git-test",
    sourceCommit: "0".repeat(40),
    sourcePath: "README.md",
    lineStart: 1,
    lineEnd: 1,
    note: "focused gate fixture",
  };
  return {
    schemaVersion: 1,
    proposalId: "teaching-gate-fixture",
    targetSnapshotId: "git-test",
    targetAnalysisId: "ua-test",
    course: {
      id: "teaching-gate-fixture",
      title: "闸门测试",
      description: "focused fixture",
      audience: "beginner",
      objectives: ["理解概念", "读懂例子", "用自己的话复述"],
      units: [
        {
          id: "one-unit",
          title: "一个单元",
          objective: "理解一个概念",
          lessons: [
            {
              id: "one-lesson",
              title: "普通标题",
              content: baseContent(),
              evidence: [evidence],
              cards: [],
              exercises: [],
              ...lesson,
            },
          ],
        },
      ],
    },
  };
}

function writeFixture(name: string, lesson: Record<string, unknown>) {
  const path = join(FIXTURE_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(proposalFor(lesson)));
  return path;
}

describe("proposal teaching gates", () => {
  it("catches the reviewed copy exercises but leaves the short build recall alone", () => {
    const result = runReal(["title-answer", "analogy-order", "term-drift"]);

    expect(result.status).toBe(1);
    expect(result.output).toContain("doctype-first-line");
    expect(result.output).toContain("cap-app-id");
    expect(result.output).not.toContain("build-script-name: expectedAnswer");
  });

  it("catches real title leaks while leaving the real Web answer alone", () => {
    const result = runReal(["exact-answer", "analogy-order", "term-drift"]);

    expect(result.status).toBe(1);
    expect(result.output).toContain("root-div-line");
    expect(result.output).toContain("verify-script-name");
    expect(result.output).not.toContain("validation-path-word: expectedAnswer");
  });

  it("catches the reviewed runtime term while leaving an analogy-led lesson alone", () => {
    const result = runReal(["exact-answer", "title-answer", "term-drift"]);

    expect(result.status).toBe(1);
    expect(result.output).toContain("术语“运行时”");
    expect(result.output).not.toContain("app-is-a-pile-of-files: 术语");
  });

  it("finds a newly named term from its definition shape, not from a tech word list", () => {
    const badPath = writeFixture("unexplained-term", {
      content: baseContent({
        conclusion: "本节先出现量子门，稍后再解释它。",
        work: "**量子门**：一个可以控制通过方向的规则。",
      }),
    });
    const goodPath = writeFixture("explained-term", {
      content: baseContent({
        conclusion: "量子门（像一扇只能按规则打开的门）是本节的主角。",
        work: "**量子门**：一个可以控制通过方向的规则。",
      }),
    });

    const bad = run([badPath], ["exact-answer", "title-answer", "term-drift"]);
    const good = run([goodPath], ["exact-answer", "title-answer", "term-drift"]);

    expect(bad.status).toBe(1);
    expect(bad.output).toContain("术语“量子门”");
    expect(good.status).toBe(0);
    expect(good.output).toContain("ok  ");
  });

  it("catches the reviewed terminology drift and accepts an explicit relationship", () => {
    const real = runReal(["exact-answer", "title-answer", "analogy-order"]);
    const badPath = writeFixture("unexplained-drift", {
      content: baseContent({
        conclusion: "项目文件夹存放材料。",
        work: "项目仓库保存历史。",
      }),
    });
    const goodPath = writeFixture("explained-drift", {
      content: baseContent({
        conclusion: "项目文件夹也叫项目仓库。",
        work: "后文统一使用这个叫法。",
      }),
    });
    const bad = run([badPath], ["exact-answer", "title-answer", "analogy-order"]);
    const good = run([goodPath], ["exact-answer", "title-answer", "analogy-order"]);

    expect(real.status).toBe(1);
    expect(real.output).toContain("same-product-many-shells");
    expect(real.output).toContain("文件夹");
    expect(real.output).not.toContain("you-already-know-apps: 同一节课同时用了");
    expect(bad.status).toBe(1);
    expect(bad.output).toContain("term-drift");
    expect(good.status).toBe(0);
  });

  it("lets every teaching check be disabled independently and names the cost", () => {
    const expectedWhenAlone: Record<CheckId, string> = {
      "exact-answer": "doctype-first-line",
      "title-answer": "root-div-line",
      "analogy-order": "术语“运行时”",
      "term-drift": "same-product-many-shells",
    };

    for (const activeCheck of CHECK_IDS) {
      const skipped = CHECK_IDS.filter((check) => check !== activeCheck);
      const result = runReal([...skipped]);
      expect(result.status).toBe(1);
      expect(result.output).toContain(expectedWhenAlone[activeCheck]);
      for (const skippedCheck of skipped) {
        expect(result.output).toContain(`(${skippedCheck}) — cost:`);
      }
    }

    const allSkipped = runReal([...CHECK_IDS]);
    expect(allSkipped.status).toBe(0);
    expect(allSkipped.output).toContain("ok  ");
  });

  it("does not alter the real course fixture while reading it", () => {
    const before = readFileSync(REAL_PROPOSAL, "utf8");
    runReal([...CHECK_IDS]);
    expect(readFileSync(REAL_PROPOSAL, "utf8")).toBe(before);
  });
});
