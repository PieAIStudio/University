import { describe, expect, it } from "vitest";

import { buildDomainPlan } from "./domain-plan.js";
import type { PlanetStudy } from "./planet-copy.js";

function makeStudy(id: string, title: string, domain?: { id: string; title: string }): PlanetStudy {
  return {
    id,
    title,
    domain,
    courseCount: 1,
    lessonCount: 2,
    lessonsDone: 0,
    courses: [{ id: `${id}-c1`, title: `${title} 课程`, lessonCount: 2, depth: 0 }],
    courseTitles: [`${title} 课程`],
  };
}

describe("buildDomainPlan", () => {
  it("keeps declared empty domains without manufacturing studies", () => {
    expect(buildDomainPlan([], [{ id: "empty", title: "暂未开课" }])).toEqual([
      { id: "empty", title: "暂未开课", studies: [] },
    ]);
    expect(() =>
      buildDomainPlan(
        [],
        [
          { id: "empty", title: "暂未开课" },
          { id: "empty", title: "暂未开课" },
        ],
      ),
    ).toThrow(/Duplicate domain/);
  });
  it("handles 1 domain with 4 studies (1/4 domain test)", () => {
    const studies: PlanetStudy[] = [
      makeStudy("turing-pact", "TuringPact", { id: "programming", title: "编程" }),
      makeStudy("buzz", "Buzz", { id: "programming", title: "编程" }),
      makeStudy("supaluv", "SupaLuv", { id: "programming", title: "编程" }),
      makeStudy("general", "通用课", { id: "programming", title: "编程" }),
    ];

    const plan = buildDomainPlan(studies);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.id).toBe("programming");
    expect(plan[0]?.title).toBe("编程");
    expect(plan[0]?.studies.map((s) => s.id)).toEqual([
      "buzz",
      "general",
      "supaluv",
      "turing-pact",
    ]);
  });

  it("handles 4 distinct domains and sorts them stably by domain id", () => {
    const studies: PlanetStudy[] = [
      makeStudy("s-prog", "Prog Study", { id: "programming", title: "编程" }),
      makeStudy("s-ai", "AI Study", { id: "aigc", title: "AIGC" }),
      makeStudy("s-game", "Game Study", { id: "gamedev", title: "游戏开发" }),
      makeStudy("s-design", "Design Study", { id: "design", title: "设计" }),
    ];

    const plan = buildDomainPlan(studies);
    expect(plan.map((d) => d.id)).toEqual(["aigc", "design", "gamedev", "programming"]);
    expect(plan.map((d) => d.title)).toEqual(["AIGC", "设计", "游戏开发", "编程"]);
  });

  it("handles 30 series at scale without failure", () => {
    const studies: PlanetStudy[] = Array.from({ length: 30 }, (_, index) => {
      const padded = index.toString().padStart(2, "0");
      const domainId = index < 15 ? "domain-alpha" : "domain-beta";
      const domainTitle = index < 15 ? "阿尔法领域" : "贝塔领域";
      return makeStudy(`series-${padded}`, `系列 ${padded}`, {
        id: domainId,
        title: domainTitle,
      });
    });

    const plan = buildDomainPlan(studies);
    expect(plan).toHaveLength(2);
    expect(plan[0]?.id).toBe("domain-alpha");
    expect(plan[0]?.studies).toHaveLength(15);
    expect(plan[1]?.id).toBe("domain-beta");
    expect(plan[1]?.studies).toHaveLength(15);

    // Verify total count
    const totalStudies = plan.reduce((sum, d) => sum + d.studies.length, 0);
    expect(totalStudies).toBe(30);
  });

  it("is stable under input rearrangement (order independence)", () => {
    const s1 = makeStudy("study-01", "Alpha 1", { id: "dom-a", title: "领域A" });
    const s2 = makeStudy("study-02", "Alpha 2", { id: "dom-a", title: "领域A" });
    const s3 = makeStudy("study-03", "Beta 1", { id: "dom-b", title: "领域B" });
    const s4 = makeStudy("study-04", "Beta 2", { id: "dom-b", title: "领域B" });
    const s5 = makeStudy("study-05", "Unclassified 1");
    const s6 = makeStudy("study-06", "Unclassified 2");

    const orderA = [s1, s2, s3, s4, s5, s6];
    const orderB = [s6, s3, s1, s5, s4, s2];
    const orderC = [s4, s5, s2, s6, s1, s3];

    const planA = buildDomainPlan(orderA);
    const planB = buildDomainPlan(orderB);
    const planC = buildDomainPlan(orderC);

    expect(planA).toEqual(planB);
    expect(planA).toEqual(planC);
    expect(planA.map((d) => d.id)).toEqual(["dom-a", "dom-b", "unclassified"]);
  });

  it("groups missing domain into unclassified / 未分类 without guessing title", () => {
    const studies: PlanetStudy[] = [
      makeStudy("study-ai-prompt", "AI 高级提示词工程"), // Missing domain
      makeStudy("study-no-domain", "普通课程"), // Missing domain
    ];

    const plan = buildDomainPlan(studies);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.id).toBe("unclassified");
    expect(plan[0]?.title).toBe("未分类");
    // Does not guess title "AI" or "提示词"
    expect(plan[0]?.title).not.toMatch(/AI|提示词/);
    expect(plan[0]?.studies.map((s) => s.id)).toEqual(["study-ai-prompt", "study-no-domain"]);
  });

  it("rejects duplicate study IDs with an error", () => {
    const studies: PlanetStudy[] = [
      makeStudy("study-dup", "第一份"),
      makeStudy("study-dup", "第二份"),
    ];

    expect(() => buildDomainPlan(studies)).toThrow(/Duplicate study ID: "study-dup"/);
  });

  it("rejects conflicting titles for the same domain ID", () => {
    const studies: PlanetStudy[] = [
      makeStudy("study-1", "课程 1", { id: "domain-x", title: "标题 A" }),
      makeStudy("study-2", "课程 2", { id: "domain-x", title: "标题 B" }),
    ];

    expect(() => buildDomainPlan(studies)).toThrow(
      /Conflicting domain title for domain ID "domain-x": "标题 A" vs "标题 B"/,
    );
  });

  it("rejects conflicting title if study explicitly specifies unclassified with different title", () => {
    const studies: PlanetStudy[] = [
      makeStudy("study-1", "隐式未分类"),
      makeStudy("study-2", "显式但异名", { id: "unclassified", title: "其它分类" }),
    ];

    expect(() => buildDomainPlan(studies)).toThrow(
      /Conflicting domain title for domain ID "unclassified": "未分类" vs "其它分类"/,
    );
  });
});
