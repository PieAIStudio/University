/** Synthetic contract fixtures only; never writes to an actual campus. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = import.meta.dirname;
const RAW_CONTENT = readFileSync(
  join(
    ROOT,
    "../fixtures/lesson-lint/valid/studies/fixture-study/courses/fixture-course/units/fixture-unit/lessons/valid-opening/revisions/1/content.md",
  ),
  "utf8",
);
const citation = {
  kind: "fact",
  sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  sourceTitle: "MDN JavaScript",
  sourceAuthority: "mdn",
  note: "Synthetic URL-evidence fixture",
};
const CONTENT = RAW_CONTENT.replace(
  "## 自检",
  `[JavaScript 的官方说明](${citation.sourceUrl})\n\n## 自检`,
);

function inspect(
  content = CONTENT,
  variant: string | undefined = "现象",
  exercise = true,
  copies = 1,
  references = [citation],
) {
  const root = mkdtempSync(join(tmpdir(), "university-teaching-contract-"));
  try {
    const lessons = Array.from({ length: copies }, (_, index) => ({
      id: `lesson-${index}`,
      title: "这个结果是怎样产生的？",
      variant,
      content,
      evidence: references,
      cards: [],
      exercises: exercise
        ? [
            {
              id: `exercise-${index}`,
              kind: "short-answer",
              prompt: "换一个输入后，应当检查脚本还是截图？",
              expectedAnswer: "脚本",
              evidence: [citation],
            },
          ]
        : [],
    }));
    const proposal = join(root, "proposal.json");
    writeFileSync(proposal, JSON.stringify({ unit: { id: "unit-one" }, lessons }));
    for (const lesson of lessons) {
      const revision = join(
        root,
        "studies/study-one/courses/course-one/units/unit-one/lessons",
        lesson.id,
        "revisions/1",
      );
      mkdirSync(revision, { recursive: true });
      writeFileSync(join(revision, "content.md"), content);
      writeFileSync(
        join(revision, "manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          id: lesson.id,
          contentRevision: 1,
          variant,
          contentHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
          evidence: references,
          assets: [],
        }),
      );
    }
    const run = (script: string, args: string[] = []) => {
      const result = spawnSync(process.execPath, [join(ROOT, script), ...args], {
        cwd: root,
        encoding: "utf8",
      });
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    };
    return {
      proposal: run("check-proposal-shape.mjs", [proposal]),
      persisted: run("lint-lessons.mjs"),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function expectBoth(result: ReturnType<typeof inspect>, status: number, message?: string) {
  for (const gate of [result.proposal, result.persisted]) {
    expect(gate.status, gate.output).toBe(status);
    if (message) expect(gate.output).toContain(message);
  }
}

describe("one lesson contract before and after persistence", () => {
  it("does not turn an invisible source URL into required explanatory prose", () => {
    const url = `${citation.sourceUrl}/${"long-source-locator-".repeat(100)}`;
    const content = CONTENT.replace(citation.sourceUrl, url);
    expectBoth(inspect(content, "现象", true, 1, [{ ...citation, sourceUrl: url }]), 0);
  });

  it("still requires explanatory detail when a lesson has a source link", () => {
    const content = CONTENT.replace(/^:::detail\[[^\]\n]*\]\s*\n[\s\S]*?^:::\s*$/gm, "\n");
    const result = inspect(content);
    expect(result.persisted.status).toBe(1);
    expect(result.persisted.output).toContain("还没有 :::detail 块");
  });

  it("does not let a long hidden destination substitute for a detailed explanation", () => {
    const url = `${citation.sourceUrl}/${"locator-".repeat(100)}`;
    const content = CONTENT.replace(
      /^:::detail\[[^\]\n]*\][ \t]*\n[\s\S]*?^:::[ \t]*$/gm,
      `:::detail[你还需要知道什么？]\n[来源](${url})\n:::`,
    );
    const result = inspect(content);
    expect(result.persisted.status).toBe(1);
    expect(result.persisted.output).toContain("下限 60%");
  });

  it.each([false, true])(
    "accepts a source URL containing parentheses (angle wrapped: %s)",
    (wrapped) => {
      const url = `${citation.sourceUrl}#example(one)`;
      const content = CONTENT.replace(
        `[JavaScript 的官方说明](${citation.sourceUrl})`,
        `[来源](${wrapped ? `<${url}>` : url})`,
      );
      expectBoth(inspect(content, "现象", true, 1, [{ ...citation, sourceUrl: url }]), 0);
    },
  );
  it("accepts the checked-in no-repository example before and after persistence", () => {
    const sample = JSON.parse(
      readFileSync(
        join(ROOT, "../../../.agents/skills/adopt-outside-course/assets/sample-proposal.json"),
        "utf8",
      ),
    );
    const lesson = sample.lessons[0];
    expectBoth(inspect(lesson.content, lesson.variant, true, 1, lesson.evidence), 0);
  });
  it.each(["现象", "对比", "溯源", "决策", "术语"])(
    "supports the %s variant with primary URL evidence",
    (variant) => {
      const extra =
        variant === "决策"
          ? "什么时候该反过来"
          : variant === "术语"
            ? "它不是什么"
            : "这两种情况分别适合在哪里用？";
      const content = ["对比", "决策", "术语"].includes(variant)
        ? CONTENT.replace("## 自检", `## ${extra}\n\n换个条件再判断。\n\n## 自检`)
        : CONTENT;
      expectBoth(inspect(content, variant), 0);
    },
  );

  it("accepts URL-backed lessons without manufacturing repository anchors", () => {
    expectBoth(inspect(), 0);
  });

  it.each(["先猜一下", "答案", "自检", "一句话"])(
    "rejects a duplicated %s section in both gates",
    (heading) => {
      expectBoth(
        inspect(CONTENT.replace(`## ${heading}\n`, `## ${heading}\n\n## ${heading}\n`)),
        1,
      );
    },
  );

  it("does not accept required headings hidden inside a code fence", () => {
    expectBoth(inspect(`\`\`\`markdown\n${CONTENT}\n\`\`\``), 1);
  });

  it("requires a real prediction prompt, not just the invitation line", () => {
    const empty = CONTENT.replace(
      /## 先猜一下[\s\S]*?## 答案/,
      "## 先猜一下\n\n先写下你的判断，再往下看答案。\n\n## 答案",
    );
    expectBoth(inspect(empty), 1, "预测题正文");
  });

  it("requires a clickable source instead of accepting a URL hidden in code", () => {
    const unlinked = CONTENT.replace(
      `[JavaScript 的官方说明](${citation.sourceUrl})`,
      `\`[来源](${citation.sourceUrl})\``,
    );
    expectBoth(inspect(unlinked), 1, "URL引用");
  });

  it("keeps the repository-anchor coverage guard for mixed-source lessons", () => {
    const result = inspect(CONTENT.replace("## 自检", "[[evidence:missing.ts:1]]\n\n## 自检"));
    expect(result.persisted.status).toBe(1);
    expect(result.persisted.output).toContain("manifest 没有引用的文件");
  });

  it("rejects an answer printed inside self-check", () => {
    expectBoth(inspect(CONTENT.replace("## 自检\n", "## 自检\n\n答案：脚本。\n")), 1, "自检");
  });

  it("keeps cross-lesson links in the optional rethink section only", () => {
    const link = "[[lesson:another-lesson|另一个例子]]";
    expectBoth(inspect(CONTENT.replace("## 自检", `${link}\n\n## 自检`)), 1, "再想想");
    expectBoth(inspect(CONTENT.replace("## 自检", `## 再想想\n\n${link}\n\n## 自检`)), 0);
  });

  it.each([
    ["决策", "什么时候该反过来"],
    ["术语", "它不是什么"],
  ])(
    "requires the fixed boundary for %s while allowing natural middle headings",
    (variant, boundary) => {
      expectBoth(
        inspect(
          CONTENT.replace("## 自检", "## 读者为什么还会犹豫？\n\n换个条件再看。\n\n## 自检"),
          variant,
        ),
        1,
        boundary,
      );
      expectBoth(
        inspect(CONTENT.replace("## 自检", `## ${boundary}\n\n换个条件再看。\n\n## 自检`), variant),
        0,
      );
    },
  );

  it("requires variant selection for new proposals rather than silently skipping their later lint", () => {
    const result = inspect(CONTENT, "");
    expect(result.proposal.status).toBe(1);
    expect(result.proposal.output).toContain("variant");
  });

  it("does not let a demonstration stand in for the independent exercise", () => {
    const result = inspect(CONTENT, "现象", false);
    expect(result.proposal.status).toBe(1);
    expect(result.proposal.output).toContain("恰好 1 道");
  });

  it("requests judgment on a third repeated variant without rejecting a sound shape automatically", () => {
    const result = inspect(CONTENT, "现象", true, 3);
    expectBoth(result, 0);
    expect(result.persisted.output).toContain("需人工复核");
    expect(result.persisted.output).toContain("说明理由");
  });

  it("does not count an ordinary task opening as invalid just because it is not surprising", () => {
    const task = CONTENT.replace(
      "## 你看到的空白，和屏幕上的结果对不上",
      "## 你要让别人照着规格完成页面",
    );
    expectBoth(inspect(task), 0);
  });
});
