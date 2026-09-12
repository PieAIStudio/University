/**
 * The catalogue these layout numbers were calibrated against.
 *
 * `placeWorld`, `placeStudyArchipelago` and `placePlanetClusters` are checked
 * for how their geometry *scales*: a one-course study still reaches the
 * clickable floor, a thirty-one-course study does not own the frame, a
 * 41-lesson silhouette is wider than a 12-lesson plateau, and the palette
 * spreads across at least eight tops. None of that can be asked of whatever
 * happens to be published today — on 2026-09-12 the shipped set became four
 * courses of nine lessons or fewer, and every one of those assertions lost its
 * subject.
 *
 * So the shapes are frozen here instead: studies, courses and lesson counts
 * exactly as they stood at `4209d071`, the commit the calibration was last
 * confirmed against. Lesson counts run 3, 4, 6, 8, 9, 10, 11, 12, 13, 19, 41,
 * 61 across four studies of 1, 1, 4 and 31 courses. Titles are kept because the
 * palette hashes them.
 *
 * This is a renderer fixture, not a claim about what ships. The live catalogue
 * is still read by the tests that check nothing gets dropped on the way into
 * the scene, and those are the ones that must move when a package is locked or
 * unlocked.
 */
export interface CalibrationCourse {
  readonly courseId: string;
  readonly title: string;
  readonly lessons: number;
}

export interface CalibrationStudy {
  readonly studyId: string;
  readonly title: string;
  readonly courses: readonly CalibrationCourse[];
}

export const CALIBRATION_CATALOGUE: { readonly studies: readonly CalibrationStudy[] } = {
  studies: [
    {
      studyId: "ai-foundations",
      title: "认识 AI，从这里开始",
      courses: [
        {
          courseId: "what-is-ai-really",
          title: "AI 到底是什么",
          lessons: 61,
        },
      ],
    },
    {
      studyId: "browser-ai",
      title: "学会用 AI 做应用",
      courses: [
        {
          courseId: "run-a-real-project-with-ai",
          title: "用 AI 把一个真实开源项目跑起来",
          lessons: 8,
        },
        {
          courseId: "make-the-cutout-app-yours",
          title: "把这个抠图应用改成你的",
          lessons: 9,
        },
        {
          courseId: "search-your-own-photos",
          title: "把搜图改成搜你自己的相册",
          lessons: 6,
        },
        {
          courseId: "when-a-project-is-too-big-to-read",
          title: "当项目大到读不完",
          lessons: 4,
        },
      ],
    },
    {
      studyId: "general",
      title: "学会用 AI 做网站",
      courses: [
        {
          courseId: "product-website",
          title: "从零做一个产品官网",
          lessons: 19,
        },
      ],
    },
    {
      studyId: "turing-pact",
      title: "学会用 AI 做游戏",
      courses: [
        {
          courseId: "foundations-before-zero",
          title: "《在开始之前：App、代码、和你》",
          lessons: 41,
        },
        {
          courseId: "foundations-terrain",
          title: "《认识地形》",
          lessons: 12,
        },
        {
          courseId: "foundations-reading-code",
          title: "《读懂一行代码》",
          lessons: 11,
        },
        {
          courseId: "foundations-logic",
          title: "《读懂一段逻辑》",
          lessons: 13,
        },
        {
          courseId: "foundations-data",
          title: "《数据从哪来》",
          lessons: 13,
        },
        {
          courseId: "foundations-async",
          title: "《等待与失败》",
          lessons: 12,
        },
        {
          courseId: "foundations-ui",
          title: "《界面是怎么长出来的》",
          lessons: 12,
        },
        {
          courseId: "foundations-quality",
          title: "《怎么知道没写错》",
          lessons: 13,
        },
        {
          courseId: "foundations-product",
          title: "《代码之外》",
          lessons: 12,
        },
        {
          courseId: "contracts-and-drift",
          title: "契约与防漂移",
          lessons: 3,
        },
        {
          courseId: "testing-strategy",
          title: "测试策略：把钱花在刀刃上",
          lessons: 3,
        },
        {
          courseId: "state-and-process",
          title: "状态与过程：半年后还改得动",
          lessons: 4,
        },
        {
          courseId: "one-codebase-many-hosts",
          title: "一套代码，多端交付",
          lessons: 4,
        },
        {
          courseId: "identity-and-accounts",
          title: "身份、账号、和「你是谁」",
          lessons: 12,
        },
        {
          courseId: "bilingual-by-design",
          title: "双语不是翻译表",
          lessons: 12,
        },
        {
          courseId: "realtime-presence",
          title: "谁在线，谁在打字",
          lessons: 11,
        },
        {
          courseId: "platform-capabilities",
          title: "同一个能力，三种实现",
          lessons: 12,
        },
        {
          courseId: "ai-contracts-first",
          title: "先定契约，再接模型",
          lessons: 12,
        },
        {
          courseId: "ai-budget-and-cost",
          title: "一次对话到底花多少钱",
          lessons: 12,
        },
        {
          courseId: "structured-output-repair",
          title: "从不可靠的模型里拿到可靠结构",
          lessons: 11,
        },
        {
          courseId: "ai-evaluation",
          title: "怎么知道我的 AI 够好",
          lessons: 11,
        },
        {
          courseId: "agent-identity-continuity",
          title: "让 AI 角色像同一个人",
          lessons: 11,
        },
        {
          courseId: "failure-recovery",
          title: "用户那边出错时，产品怎么自己爬起来",
          lessons: 12,
        },
        {
          courseId: "experiments-and-rollout",
          title: "先登记，再上线",
          lessons: 12,
        },
        {
          courseId: "retention-engineering",
          title: "给人一个回来的理由",
          lessons: 11,
        },
        {
          courseId: "moment-design",
          title: "产品的「时刻」是怎么搭出来的",
          lessons: 12,
        },
        {
          courseId: "world-navigation",
          title: "导航是产品结构的外化",
          lessons: 12,
        },
        {
          courseId: "e2e-and-qa-scripts",
          title: "一个人怎么替代一个 QA 团队",
          lessons: 12,
        },
        {
          courseId: "asset-pipeline",
          title: "351 个素材怎么进产品而不失控",
          lessons: 12,
        },
        {
          courseId: "solo-operations",
          title: "出事的时候只有你",
          lessons: 12,
        },
        {
          courseId: "directing-ai-agents",
          title: "指挥 AI 干活",
          lessons: 10,
        },
      ],
    },
  ],
};
