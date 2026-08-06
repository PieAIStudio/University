import { describe, expect, it } from "vitest";

import type { EvidenceSnippet } from "../content/evidence.js";
import {
  buildExerciseCoachingPacket,
  disclosesReference,
  type BuildCoachingPacketInput,
} from "./exercise-coaching-packet.js";

function snippet(overrides: Partial<EvidenceSnippet> = {}): EvidenceSnippet {
  return {
    sourcePath: "server/config/load-config.ts",
    sourceCommit: "a".repeat(40),
    startLine: 122,
    endLine: 135,
    highlightStartLine: 124,
    highlightEndLine: 133,
    language: "typescript",
    code: "export function assertSeparatedRoots() {\n  // ...\n}",
    ...overrides,
  };
}

function input(overrides: Partial<BuildCoachingPacketInput> = {}): BuildCoachingPacketInput {
  return {
    locator: {
      studyId: "turing-pact",
      courseId: "foundations-terrain",
      unitId: "map",
      lessonId: "what-is-a-repo",
    },
    lessonTitle: "仓库是什么",
    exercise: {
      id: "name-the-guard",
      kind: "short-answer",
      title: "说出守卫的名字",
      prompt: "哪个函数拒绝重叠的根目录？",
      contentRevision: 3,
      ...overrides.exercise,
    },
    learnerAnswer: "assertSeparatedRoots",
    submissionCount: 1,
    commandId: "11111111-2222-4333-8444-555555555555",
    evidence: [{ note: "这里就是那道守卫", snippet: snippet() }],
    reference: null,
    evidenceOmitted: 0,
    ...overrides,
  };
}

describe("disclosesReference", () => {
  it("withholds the reference on a learner's first try", () => {
    expect(disclosesReference({ passed: false, submissionCount: 1 })).toBe(false);
  });

  it("discloses once the learner has really tried twice", () => {
    expect(disclosesReference({ passed: false, submissionCount: 2 })).toBe(true);
  });

  it("discloses immediately after a pass, since the practice is over", () => {
    expect(disclosesReference({ passed: true, submissionCount: 1 })).toBe(true);
  });
});

describe("buildExerciseCoachingPacket", () => {
  it("carries the cited source so a host that cannot open the repo still grades on evidence", () => {
    const packet = buildExerciseCoachingPacket(input());
    expect(packet).toContain("server/config/load-config.ts:124-133");
    expect(packet).toContain("commit aaaaaaaaaaaa");
    expect(packet).toContain("export function assertSeparatedRoots()");
    expect(packet).toContain("这里就是那道守卫");
  });

  it("tells the host to refuse rather than guess when the reference is withheld", () => {
    const packet = buildExerciseCoachingPacket(input({ reference: null }));
    expect(packet).toContain("本次不提供参考答案");
    expect(packet).toContain("不要猜");
    expect(packet).not.toContain("参考答案（学习者已多次尝试");
  });

  it("includes the reference answer once disclosure is allowed", () => {
    const packet = buildExerciseCoachingPacket(
      input({
        reference: { kind: "short-answer", expectedAnswer: "assertSeparatedRoots" },
        submissionCount: 2,
      }),
    );
    expect(packet).toContain("参考答案（学习者已多次尝试，可以揭晓）");
    expect(packet).toContain("不是唯一正确写法");
  });

  it("lists rubric points for an explain exercise once disclosed", () => {
    const packet = buildExerciseCoachingPacket(
      input({
        exercise: {
          id: "explain-guard",
          kind: "explain",
          title: "解释守卫",
          prompt: "用自己的话说明",
          contentRevision: 1,
        },
        reference: { kind: "explain", rubric: ["提到互相包含", "提到 realpath"] },
      }),
    );
    expect(packet).toContain("1. 提到互相包含");
    expect(packet).toContain("2. 提到 realpath");
    expect(packet).toContain("全部覆盖");
  });

  /**
   * A host that forgets to edit the template must not hand out a pass. The
   * write-back path trusts `passed` outright, so the template is the only place
   * this can fail closed.
   */
  it("defaults the write-back template to not passed", () => {
    const packet = buildExerciseCoachingPacket(input());
    expect(packet).toContain(`"passed": false`);
    expect(packet).toContain("照抄等于判不通过");
  });

  it("keeps the write-back identity the server issued", () => {
    const packet = buildExerciseCoachingPacket(input());
    expect(packet).toContain(`"commandId": "11111111-2222-4333-8444-555555555555"`);
    expect(packet).toContain(`"contentRevision": 3`);
    expect(packet).toContain("--study turing-pact");
  });

  /**
   * Source that contains a fence would otherwise close the block early, and
   * everything after it — including the write-back instructions — would read as
   * prose the assistant might act on.
   */
  it("widens the fence when the cited source contains one", () => {
    const packet = buildExerciseCoachingPacket(
      input({
        evidence: [
          {
            note: null,
            snippet: snippet({
              language: "markdown",
              code: "示例：\n```bash\nrm -rf /\n```\n结束",
            }),
          },
        ],
      }),
    );
    expect(packet).toContain("````markdown");
    expect(packet).toContain("\n````");
  });

  it("stays host-agnostic", () => {
    const packet = buildExerciseCoachingPacket(input());
    expect(packet).toContain("不要假设你是某一个品牌的 IDE");
    expect(packet).not.toMatch(/请在 Grok Build 中/);
  });

  it("says how many evidence snippets were dropped for length", () => {
    const packet = buildExerciseCoachingPacket(input({ evidenceOmitted: 2 }));
    expect(packet).toContain("另有 2 条证据未附上");
  });

  it("does not pretend to have evidence it could not read", () => {
    const packet = buildExerciseCoachingPacket(input({ evidence: [], evidenceOmitted: 1 }));
    expect(packet).toContain("本题没有可展示的证据片段");
    expect(packet).not.toContain("判分请以这些代码为准");
  });

  it("shows an empty answer as an empty answer rather than a blank block", () => {
    const packet = buildExerciseCoachingPacket(input({ learnerAnswer: "" }));
    expect(packet).toContain("（学习者提交了空答案）");
  });
});
