import { describe, expect, it } from "vitest";

import { nextCourseAfter, spineOf, validateSpine, type SpineEntry } from "./spine.js";

/**
 * 真实 4 个 study 的先修图基线（来自 52 门课程元数据 manifest）。
 *
 * 这条测试就是「作者排错推荐顺序 CI 直接红」的守护防线：
 * 任何 spineEntry 的 order 必须是对应先修图的一个合法线性扩展（拓扑有序）。
 */
const PREREQUISITES_BY_STUDY: Record<string, ReadonlyMap<string, readonly string[]>> = {
  buzz: new Map([
    ["buzz-orientation", []],
    ["buzz-reading-rust", []],
    ["buzz-one-message", []],
    ["buzz-agents-as-members", []],
    ["buzz-design-tokens", []],
  ]),

  supaluv: new Map([
    ["founder-engineer", []],
    ["ai-cost-and-boundaries", ["founder-engineer"]],
    ["ai-branching-narrative", ["ai-cost-and-boundaries"]],
    ["generated-assets", ["ai-branching-narrative"]],
    ["media-tooling", ["generated-assets"]],
    ["content-as-package", ["media-tooling"]],
    ["automated-playtesting", ["content-as-package"]],
  ]),

  "university-local": new Map([
    ["how-this-campus-works", []],
    ["four-layer-workbench", ["how-this-campus-works"]],
    ["how-this-campus-works-2", ["four-layer-workbench"]],
    ["communicate-with-ai", ["how-this-campus-works-2"]],
    ["evidence-and-freshness", ["communicate-with-ai"]],
    ["local-first-boundaries", ["evidence-and-freshness"]],
    ["spaced-repetition", ["evidence-and-freshness"]],
    ["content-governance", ["evidence-and-freshness"]],
    ["airlock-supply-chain", ["local-first-boundaries"]],
  ]),

  "turing-pact": new Map([
    ["foundations-before-zero", []],
    ["foundations-terrain", ["foundations-before-zero"]],
    ["foundations-reading-code", ["foundations-terrain"]],
    ["foundations-logic", ["foundations-reading-code"]],
    ["foundations-data", ["foundations-logic"]],
    ["foundations-async", ["foundations-data"]],
    ["foundations-ui", ["foundations-async"]],
    ["foundations-quality", ["foundations-ui"]],
    ["foundations-product", ["foundations-quality"]],
    ["realtime-presence", ["foundations-product"]],
    ["identity-and-accounts", ["foundations-product"]],
    ["failure-recovery", ["foundations-product"]],
    ["testing-strategy", ["foundations-product"]],
    ["platform-capabilities", ["foundations-product"]],
    ["bilingual-by-design", ["foundations-product"]],
    ["one-codebase-many-hosts", ["foundations-product"]],
    ["contracts-and-drift", ["foundations-product"]],
    ["state-and-process", ["foundations-product"]],
    ["world-navigation", ["realtime-presence"]],
    ["moment-design", ["realtime-presence"]],
    ["retention-engineering", ["realtime-presence"]],
    ["experiments-and-rollout", ["realtime-presence"]],
    ["e2e-and-qa-scripts", ["testing-strategy"]],
    ["ai-contracts-first", ["platform-capabilities"]],
    ["asset-pipeline", ["world-navigation"]],
    ["ai-budget-and-cost", ["ai-contracts-first"]],
    ["structured-output-repair", ["ai-contracts-first"]],
    ["ai-evaluation", ["structured-output-repair"]],
    ["agent-identity-continuity", ["ai-evaluation"]],
    ["solo-operations", []],
    ["directing-ai-agents", []],
  ]),
};

describe("validateSpine on all 4 studies", () => {
  const studies = ["buzz", "supaluv", "university-local", "turing-pact"] as const;

  it.each(studies)(
    "validates that study '%s' spine is a legal linear extension of its prerequisites",
    (studyId) => {
      const entries = spineOf(studyId);
      expect(entries.length).toBeGreaterThan(0);

      const prereqs = PREREQUISITES_BY_STUDY[studyId];
      expect(prereqs).toBeDefined();

      const violations = validateSpine(entries, prereqs!);
      expect(violations).toEqual([]);
    },
  );

  it("covers all 52 courses across all 4 studies", () => {
    const totalCourses = studies.reduce((sum, studyId) => sum + spineOf(studyId).length, 0);
    expect(totalCourses).toBe(52);
  });

  /**
   * buzz 的 5 门课先修全空，所以上面那条线性扩展测试对它是真空的——
   * 任何排列都能通过。这门 study 的顺序是一个纯粹的编辑判断（依据记在
   * spine.ts 的注释里：按证据锚点落在 Buzz 依赖图的哪一层排），
   * 而一个没有任何测试守着的编辑判断，下一次有人重新生成这份清单时就没了。
   * 所以这里显式钉住它。改顺序是允许的，改完顺手改这条测试也是应该的。
   */
  it("pins the buzz order, because its empty prerequisite graph guards nothing", () => {
    expect(spineOf("buzz").map((entry) => entry.courseId)).toEqual([
      "buzz-orientation",
      "buzz-reading-rust",
      "buzz-one-message",
      "buzz-agents-as-members",
      "buzz-design-tokens",
    ]);
  });
});

describe("spineOf and nextCourseAfter", () => {
  it("returns sequential orders starting at 1", () => {
    const entries = spineOf("supaluv");
    expect(entries.map((e) => e.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(entries[0]!.courseId).toBe("founder-engineer");
    expect(entries[6]!.courseId).toBe("automated-playtesting");
  });

  it("returns empty array for unknown study", () => {
    expect(spineOf("unknown-study")).toEqual([]);
  });

  it("finds next course on the spine correctly", () => {
    expect(nextCourseAfter("supaluv", "founder-engineer")).toBe("ai-cost-and-boundaries");
    expect(nextCourseAfter("supaluv", "ai-cost-and-boundaries")).toBe("ai-branching-narrative");
    expect(nextCourseAfter("supaluv", "automated-playtesting")).toBeNull();
    expect(nextCourseAfter("supaluv", "non-existent")).toBeNull();
  });
});

describe("validateSpine failure detection", () => {
  it("flags inverted prerequisite order", () => {
    const invalidEntries: readonly SpineEntry[] = [
      { studyId: "test", courseId: "course-b", order: 1 },
      { studyId: "test", courseId: "course-a", order: 2 },
    ];
    const prereqs = new Map([
      ["course-a", []],
      ["course-b", ["course-a"]],
    ]);
    const violations = validateSpine(invalidEntries, prereqs);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('requires "course-a"');
  });

  it("flags missing prerequisite courses", () => {
    const incompleteEntries: readonly SpineEntry[] = [
      { studyId: "test", courseId: "course-b", order: 1 },
    ];
    const prereqs = new Map([["course-b", ["course-missing"]]]);
    const violations = validateSpine(incompleteEntries, prereqs);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("missing from the spine");
  });

  it("flags duplicate course IDs", () => {
    const duplicateEntries: readonly SpineEntry[] = [
      { studyId: "test", courseId: "course-a", order: 1 },
      { studyId: "test", courseId: "course-a", order: 2 },
    ];
    const prereqs = new Map([["course-a", []]]);
    const violations = validateSpine(duplicateEntries, prereqs);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('Duplicate course "course-a"');
  });
});
