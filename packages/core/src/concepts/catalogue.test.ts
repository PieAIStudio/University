import { describe, expect, it } from "vitest";

import { validateChoiceExercise } from "../domain/choice-exercise.js";
import { sectionsToMarkdown } from "../domain/entry-section.js";
import { CONCEPT_CATEGORY_IDS, type ConceptCategory } from "../domain/concept.js";
import {
  CONCEPT_COUNTS,
  CONCEPT_ENTRIES,
  CONCEPT_PROBLEMS,
  conceptGroupsIn,
  conceptNeighbours,
} from "./catalogue.js";
import { CONCEPT_HEADS } from "./heads.js";
import { searchConcepts } from "./search.js";

/**
 * The catalogue's shape, recorded before a word of it was written.
 *
 * Three independent reads of the source site agreed on these numbers — a
 * browser pass here and two models scraping from the same brief, with no
 * disagreement on any of the 281 slugs. Pinning the result means a batch of
 * authored content that quietly drops four entries fails here rather than
 * showing up as a chip that says 133 and nobody noticing.
 */
const EXPECTED: {
  readonly [C in ConceptCategory]: {
    readonly total: number;
    readonly groups: readonly (readonly [string, number])[];
  };
} = {
  frontend: {
    total: 137,
    groups: [
      ["网页基础", 14],
      ["按钮与链接", 2],
      ["表单", 19],
      ["内容展示", 25],
      ["弹窗与提示", 12],
      ["导航", 9],
      ["官网区块", 10],
      ["页面布局", 9],
      ["CSS 布局", 11],
      ["文字", 3],
      ["外观", 11],
      ["动画", 5],
      ["鼠标", 7],
    ],
  },
  backend: {
    total: 40,
    groups: [
      ["网络与地址", 9],
      ["接口与数据", 5],
      ["数据库", 3],
      ["后端开发", 3],
      ["账号与权限", 2],
      ["上线与排错", 18],
    ],
  },
  product: {
    total: 17,
    groups: [
      ["用户与需求", 4],
      ["产品规划", 7],
      ["数据与验证", 6],
    ],
  },
  technology: {
    total: 26,
    groups: [
      ["开发工具", 6],
      ["测试", 11],
      ["技术栈", 1],
      ["编程语言", 3],
      ["前端框架", 3],
      ["CSS 与组件", 2],
    ],
  },
  ai: {
    total: 25,
    groups: [
      ["AI 基础", 4],
      ["上下文", 6],
      ["请求与输出", 3],
      ["Agent 与工具", 9],
      ["性能与成本", 3],
    ],
  },
  git: { total: 12, groups: [["Git", 12]] },
  design: { total: 24, groups: [["设计风格", 24]] },
};

const TOTAL = 281;

const EXPECTED_FLOW_CURRENT: Readonly<Record<string, number>> = {
  clone: 1,
  diff: 3,
  commit: 4,
  gitignore: 4,
  stash: 4,
  git: 4,
  branch: 5,
  worktree: 5,
  merge: 6,
  "pull-request": 6,
  push: 7,
  pull: 7,
  ci: 8,
  lint: 8,
  npm: 9,
  build: 9,
};

describe("concept catalogue", () => {
  it("assembles every record without a problem", () => {
    // Printed rather than counted: a failure here has to name the entry, or
    // finding the bad record in 281 means reading 281 records.
    expect(CONCEPT_PROBLEMS.map((problem) => `${problem.id}: ${problem.message}`)).toEqual([]);
  });

  it("holds all 281 entries", () => {
    expect(CONCEPT_ENTRIES).toHaveLength(TOTAL);
  });

  it("keeps the ten-step flow on exactly the designated concepts", () => {
    const flowEntries = CONCEPT_ENTRIES.filter((entry) =>
      entry.sections.some((section) => section.type === "flow"),
    );
    expect(flowEntries.map((entry) => entry.head.id).sort()).toEqual(
      Object.keys(EXPECTED_FLOW_CURRENT).sort(),
    );

    const invalidToolFlows = ["terminal", "browser-devtools"].filter((id) =>
      flowEntries.some((entry) => entry.head.id === id),
    );
    expect(invalidToolFlows).toEqual([]);

    const flowProblems = CONCEPT_PROBLEMS.filter((problem) =>
      Object.hasOwn(EXPECTED_FLOW_CURRENT, problem.id),
    );
    expect(flowProblems).toEqual([]);

    for (const entry of flowEntries) {
      const section = entry.sections.find((candidate) => candidate.type === "flow");
      expect(section?.type).toBe("flow");
      if (section?.type !== "flow") continue;
      expect(section.payload.steps).toHaveLength(10);
      expect(section.payload.steps.findIndex((step) => step.current) + 1).toBe(
        EXPECTED_FLOW_CURRENT[entry.head.id],
      );
    }
  });

  it("keeps the heads-only list in lockstep with the catalogue", () => {
    expect(CONCEPT_HEADS).toEqual(CONCEPT_ENTRIES.map((entry) => entry.head));
  });

  it("has no duplicate ids", () => {
    const ids = CONCEPT_ENTRIES.map((entry) => entry.head.id);
    expect([...new Set(ids)]).toHaveLength(ids.length);
  });

  it("matches the category counts three independent reads agreed on", () => {
    for (const category of CONCEPT_CATEGORY_IDS) {
      expect({ category, count: CONCEPT_COUNTS[category] }).toEqual({
        category,
        count: EXPECTED[category].total,
      });
    }
  });

  it("matches the sub-category groups and their sizes", () => {
    for (const category of CONCEPT_CATEGORY_IDS) {
      const groups = conceptGroupsIn(category);
      expect(groups).toEqual(EXPECTED[category].groups.map(([label]) => label));
      const result = searchConcepts(CONCEPT_ENTRIES, "", category);
      expect(result.groups.map((group) => [group.label, group.count])).toEqual(
        EXPECTED[category].groups.map(([label, count]) => [label, count]),
      );
    }
  });

  it("carries the four sections an entry is not an entry without", () => {
    // These four are what the head cannot supply. Without `colloquial` nobody
    // arrives here from a symptom; without `definition` there is no answer;
    // without `plain` it is a stub; without `agent-prompt` the learner is told
    // a word and given nothing to do with it.
    const required = ["colloquial", "definition", "plain", "agent-prompt"];
    const missing = CONCEPT_ENTRIES.flatMap((entry) => {
      const present = new Set(entry.sections.map((section) => section.type));
      const absent = required.filter((type) => !present.has(type as never));
      return absent.length > 0 ? [`${entry.head.id}: 缺 ${absent.join(", ")}`] : [];
    });
    expect(missing).toEqual([]);
  });

  it("states what each thing is not", () => {
    // The half most references omit, and the reason this catalogue is worth
    // having next to a search engine.
    const withoutBoundary = CONCEPT_ENTRIES.filter((entry) => {
      const definition = entry.sections.find((section) => section.type === "definition");
      return definition?.type === "definition" ? definition.payload.not === undefined : true;
    }).map((entry) => entry.head.id);
    expect(withoutBoundary).toEqual([]);
  });

  it("only points at concepts that exist", () => {
    // A prerequisite naming an id nobody wrote renders as a bare code span:
    // present, unhelpful, and invisible to anyone not looking for it.
    const known = new Set(CONCEPT_ENTRIES.map((entry) => entry.head.id));
    const dangling = CONCEPT_ENTRIES.flatMap((entry) =>
      entry.sections.flatMap((section) =>
        section.type === "prerequisites" || section.type === "related"
          ? section.payload.senseIds
              .filter((id) => !known.has(id))
              .map((id) => `${entry.head.id} → ${id}`)
          : [],
      ),
    );
    expect(dangling).toEqual([]);
  });

  it("passes the same choice checks a lesson exercise passes", () => {
    const bad = CONCEPT_ENTRIES.flatMap((entry) =>
      entry.sections.flatMap((section) => {
        if (section.type !== "quiz") return [];
        const result = validateChoiceExercise({
          options: section.payload.options,
          correctOptionId: section.payload.correctOptionId,
        });
        return result.ok ? [] : [`${entry.head.id}: ${result.errors.map((e) => e.code).join(",")}`];
      }),
    );
    expect(bad).toEqual([]);
  });

  it("walks neighbours inside the sub-category, not across it", () => {
    const first = CONCEPT_ENTRIES.find((entry) => entry.head.category === "git");
    expect(first).toBeDefined();
    if (!first) return;
    const group = CONCEPT_ENTRIES.filter(
      (entry) => entry.head.category === "git" && entry.head.group === first.head.group,
    );
    expect(conceptNeighbours(first.head.id).previous).toBeUndefined();
    const last = group[group.length - 1];
    expect(last).toBeDefined();
    if (last) expect(conceptNeighbours(last.head.id).next).toBeUndefined();
  });

  it("finds an entry by a symptom rather than by its name", () => {
    // The whole entry point. Before the shared tokeniser these queries either
    // returned nothing or returned the wrong entry, because matching was
    // "does the entire sentence appear verbatim" — which nobody's sentence does.
    const cases: readonly (readonly [string, string])[] = [
      ["怎么退回上一版", "rollback"],
      ["别人怎么打开我的网站", "domain"],
      ["刷新就没了", "browser-storage"],
    ];
    for (const [query, expected] of cases) {
      const hits = searchConcepts(CONCEPT_ENTRIES, query)
        .groups.flatMap((group) => group.entries)
        .slice(0, 5)
        .map((entry) => entry.head.id);
      expect({ query, hits }).toEqual({ query, hits: expect.arrayContaining([expected]) });
    }
  });

  it("keeps insider jargon out of copy written for beginners", () => {
    // The failure this exists to prevent actually shipped once: a catalogue
    // about spotting AI-written Chinese used 「芯片」 for a filter tag fourteen
    // times, which to someone who has never built a website means the silicon
    // in their laptop. Every word below has no defensible use in this
    // collection — unlike 「赋能」 or 「令牌」, which appear here on purpose,
    // one inside agent prompts as a thing to forbid and the other as a name the
    // entry warns the reader about.
    const banned = ["英雄区", "宾语", "谓语", "语素", "实例化", "挂载", "颗粒度", "对齐颗粒度"];
    const found = CONCEPT_ENTRIES.flatMap((entry) => {
      const text = `${entry.head.zh} ${entry.head.tagline} ${sectionsToMarkdown(entry.sections)}`;
      return banned
        .filter((word) => text.includes(word))
        .map((word) => `${entry.head.id}: ${word}`);
    });
    expect(found).toEqual([]);
  });

  it("does not return most of the catalogue for one sentence", () => {
    // The failure mode field weights exist to prevent: every entry's body is
    // thousands of characters, so an unweighted match returned 248 of 281.
    const hits = searchConcepts(CONCEPT_ENTRIES, "回到上一个能用的版本").total;
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(40);
  });
});
