/**
 * Recommended learning sequence (spineOrder) across courses in a study.
 *
 * The prerequisite graph (`prerequisiteCourseIds`) is a directed acyclic graph
 * (DAG) describing hard dependencies ("you cannot understand B without A").
 * However, the main learning path requires a single linear sequence where there
 * is always exactly ONE "next step" at any time.
 *
 * This module defines the explicit, pedagogical order (spineOrder) for all
 * studies, and validates that every spine is a valid linear extension of the
 * prerequisite DAG.
 */

/** 一个 study 内所有课程的推荐学习顺序，从简单到难。 */
export interface SpineEntry {
  readonly studyId: string;
  readonly courseId: string;
  readonly order: number;
}

/**
 * 显式定义的各 Study 推荐学习清单。
 *
 * 排序原则：具体 → 抽象（能指着屏幕说的排前面，需要先有系统观的排后面）。
 * - `buzz`: 5 门全部零先修，所以先修图对它完全没有约束力。顺序改从
 *   「每门课的证据锚点落在依赖图的哪一层」取，理由见下方 buzz 数组的注释。
 * - `supaluv`: 7 门完全单链（深度 0→6 每层 1 门），保持链式顺序不变。
 * - `university-local`: 深度 0–4 单线；深度 5 分出 3 门（按具体→抽象排序：本地持久化/隔离 → 算法/表映射 → 内容全生命周期治理）；深度 6 收回 1 门。
 * - `turing-pact`: 深度 0 的入门基础 + 深度 1–8 foundations 九连；深度 9 的 9 门采用 v3 文档推荐顺序；深度 10 的 6 门按具体→抽象；深度 11 的 3 门按具体→抽象；深度 12–13 进阶；收尾 2 门全栈实践与指挥大课。
 */
const STUDY_SPINES: Readonly<Record<string, readonly string[]>> = {
  // 5 门全部零先修，先修图给不出任何顺序。改用一条能查证的依据：
  // 每门课的 [[evidence:]] 锚点集中在 Buzz 仓库的哪一层，就按那一层排。
  // 依赖关系读自 buzz@02f640bc 的 Cargo.toml，不是猜的。
  buzz: [
    // 1. 41 条锚点，100% 是 VISION/ARCHITECTURE/README —— 全课唯一不看代码的一门。
    "buzz-orientation",
    // 2. 39 条锚点，100% .rs，主要在 crates/buzz-core/（event / filter / verification）。
    //    buzz-core 的 Cargo.toml 没有任何 buzz-* 依赖，是整张图的底。先学名词。
    "buzz-reading-rust",
    // 3. 44 条锚点，100% .rs，主要在 crates/buzz-relay/handlers/。relay 依赖 buzz-core，
    //    所以它在图上就在上一门之上。名词认全了再看动词。
    "buzz-one-message",
    // 4. 40 条锚点，crates/buzz-acp/。注意 buzz-acp 并不 Cargo 依赖 buzz-relay——
    //    它是运行时依赖：agent 连上一个 relay 才有事件可订阅。本课第 2 单元
    //    「Agent 怎样把事件变成一轮工作」以「事件」为前提，那是上一门的全部内容。
    "buzz-agents-as-members",
    // 5. 21 条锚点，desktop/ 下的 .css 与 tailwind.config.js —— 唯一不碰 Rust 的一门，
    //    与前四门零重叠。放最后是为了不在主线中间换子系统，也让最短的一门收尾。
    "buzz-design-tokens",
  ],

  // 7 门完全链式，深度 0→6 每层 1 门，保持现有链路
  supaluv: [
    // 深度 0：创始人工程师定位与单人全栈心智
    "founder-engineer",
    // 深度 1：AI 产品的成本与边界（先修: founder-engineer）
    "ai-cost-and-boundaries",
    // 深度 2：分支叙事：作者意图与 AI 的分工（先修: ai-cost-and-boundaries）
    "ai-branching-narrative",
    // 深度 3：一个人如何量产内容（先修: ai-branching-narrative）
    "generated-assets",
    // 深度 4：一个人的媒体流水线（先修: generated-assets）
    "media-tooling",
    // 深度 5：把内容当依赖包管理（先修: media-tooling）
    "content-as-package",
    // 深度 6：让机器替你玩一千遍（先修: content-as-package）
    "automated-playtesting",
  ],

  // 9 门：深度 0–4 单线，深度 5 分出 3 门，深度 6 收回 1 门
  "university-local": [
    // 深度 0：大学概览与物理工作台
    "how-this-campus-works",
    // 深度 1：AI 时代的四层工作台架构（先修: how-this-campus-works）
    "four-layer-workbench",
    // 深度 2：这所大学自己是怎么盖的·下（先修: four-layer-workbench）
    "how-this-campus-works-2",
    // 深度 3：把话说清楚：跟 AI 协作的表达（先修: how-this-campus-works-2）
    "communicate-with-ai",
    // 深度 4：证据链与内容保鲜机制（先修: communicate-with-ai）
    "evidence-and-freshness",
    // 深度 5（具体 1）：本地优先与 SQLite 数据隔离边界，也是 airlock-supply-chain 的硬先修（先修: evidence-and-freshness）
    "local-first-boundaries",
    // 深度 5（具体 2）：遗忘曲线与 FSRS 状态表算法映射（先修: evidence-and-freshness）
    "spaced-repetition",
    // 深度 5（抽象 3）：草稿/发布/过期/退休的内容全生命周期治理流程（先修: evidence-and-freshness）
    "content-governance",
    // 深度 6：学自己的代码，为什么要先隔离（先修: local-first-boundaries）
    "airlock-supply-chain",
  ],

  // 31 门：foundations 九连 + 深度 9（9门初稿）+ 深度 10（6门）+ 深度 11（3门）+ 深度 12–13 + 收尾实践（2门）
  "turing-pact": [
    // --- Foundations 九连（深度 0–8，单线地基）---
    // 深度 0：在开始之前：App、代码、和你
    "foundations-before-zero",
    // 深度 1：认识地形（先修: foundations-before-zero）
    "foundations-terrain",
    // 深度 2：读懂一行代码（先修: foundations-terrain）
    "foundations-reading-code",
    // 深度 3：读懂一段逻辑（先修: foundations-reading-code）
    "foundations-logic",
    // 深度 4：数据从哪来（先修: foundations-logic）
    "foundations-data",
    // 深度 5：等待与失败（先修: foundations-data）
    "foundations-async",
    // 深度 6：界面是怎么长出来的（先修: foundations-async）
    "foundations-ui",
    // 深度 7：怎么知道没写错（先修: foundations-ui）
    "foundations-quality",
    // 深度 8：代码之外（先修: foundations-quality）
    "foundations-product",

    // --- 深度 9（9 门：按 v3 文档推荐顺序，具体 → 抽象）---
    // 深度 9（具体 1）：谁在线，谁在打字。最具体，界面可见，也是后续 4 门进阶课的先修（先修: foundations-product）
    "realtime-presence",
    // 深度 9（具体 2）：身份、账号、和「你是谁」。人人用过登录，有现成心智模型（先修: foundations-product）
    "identity-and-accounts",
    // 深度 9（具体 3）：用户那边出错时，产品怎么自己爬起来。具体场景驱动，承接《等待与失败》（先修: foundations-product）
    "failure-recovery",
    // 深度 9（具体 4）：测试策略：把钱花在刀刃上。承接《怎么知道没写错》，产品级测试延伸（先修: foundations-product）
    "testing-strategy",
    // 深度 9（半抽象 5）：同一个能力，三种实现。具象跨端对照，AI 支线入口（先修: foundations-product）
    "platform-capabilities",
    // 深度 9（半抽象 6）：双语不是翻译表。双语设计与防漂移锚点（先修: foundations-product）
    "bilingual-by-design",
    // 深度 9（半抽象 7）：一套代码，多端交付。多端壳层架构与宿主适配（先修: foundations-product）
    "one-codebase-many-hosts",
    // 深度 9（抽象 8）：契约与防漂移。类型与元数据防腐，需要前序具体实例支撑（先修: foundations-product）
    "contracts-and-drift",
    // 深度 9（最抽象 9）：状态与过程：半年后还改得动。长期演进与过程建模（先修: foundations-product）
    "state-and-process",

    // --- 深度 10（6 门：具体交互与机制 → 工程流程与治理 → AI 架构入口）---
    // 深度 10（具体 1）：导航是产品结构的外化。传送门与房间路径状态机（先修: realtime-presence）
    "world-navigation",
    // 深度 10（具体 2）：产品的「时刻」是怎么搭出来的。高潮节奏与仪式感（先修: realtime-presence）
    "moment-design",
    // 深度 10（具体 3）：给人一个回来的理由。日常循环、回访钩子与分享设计（先修: realtime-presence）
    "retention-engineering",
    // 深度 10（流程 4）：先登记，再上线。实验登记与灰度切片（先修: realtime-presence）
    "experiments-and-rollout",
    // 深度 10（质量 5）：一个人怎么替代一个 QA 团队。自动化端到端测试治理（先修: testing-strategy）
    "e2e-and-qa-scripts",
    // 深度 10（架构 6）：先定契约，再接模型。模型网关与调度契约，开启 AI 核心支线（先修: platform-capabilities）
    "ai-contracts-first",

    // --- 深度 11（3 门：素材管线 / 成本预扣 / 容错策略）---
    // 深度 11（具体 1）：351 个素材怎么进产品而不失控。美术资产管线与预算门禁（先修: world-navigation）
    "asset-pipeline",
    // 深度 11（具体 2）：一次对话到底花多少钱。模型调用成本/价表/预扣生命周期（先修: ai-contracts-first）
    "ai-budget-and-cost",
    // 深度 11（容错 3）：从不可靠的模型里拿到可靠结构。模型输出修复与决策重试（先修: ai-contracts-first）
    "structured-output-repair",

    // --- 深度 12–13（AI 高阶评测与角色一致性）---
    // 深度 12：怎么知道我的 AI 够好。评测基准与自动化评测集（先修: structured-output-repair）
    "ai-evaluation",
    // 深度 13：让 AI 角色像同一个人。AI Agent 长期记忆与身份连续性（先修: ai-evaluation）
    "agent-identity-continuity",

    // --- 收尾高阶全栈与 AI 指挥大课（零硬先修，作为压轴实践）---
    // 收尾实践 1：出事的时候只有你。独立全栈运维、线上探活与故障应急（无硬先修，读完基础后的高阶综合）
    "solo-operations",
    // 收尾实践 2：指挥 AI 干活。AI Agent 团队调度、授权闸门与人机协作终极治理（无硬先修，压轴大课）
    "directing-ai-agents",
  ],
};

/** 获取一个 study 的推荐学习顺序。若 studyId 未知则返回空数组。 */
export function spineOf(studyId: string): readonly SpineEntry[] {
  const courseIds = STUDY_SPINES[studyId];
  if (!courseIds) return [];
  return courseIds.map((courseId, index) => ({
    studyId,
    courseId,
    order: index + 1,
  }));
}

/** 获取指定课程在 study 主路径上的下一门课程 ID；若为最后一门或不存在则返回 null。 */
export function nextCourseAfter(studyId: string, courseId: string): string | null {
  const entries = spineOf(studyId);
  const index = entries.findIndex((entry) => entry.courseId === courseId);
  if (index === -1 || index + 1 >= entries.length) return null;
  return entries[index + 1]!.courseId;
}

/**
 * 校验：order 必须是先修图的合法线性扩展。
 *
 * 规则：
 * 1. 如果课程 B 依赖课程 A，则 A 必须存在于 entries 中，且 order(A) < order(B)。
 * 2. 课程 ID 不能在同一 study 的 spine 中重复。
 *
 * 返回违规说明列表，空数组表示合法。
 */
export function validateSpine(
  entries: readonly SpineEntry[],
  prerequisites: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const issues: string[] = [];
  const orderMap = new Map<string, number>();

  for (const entry of entries) {
    if (orderMap.has(entry.courseId)) {
      issues.push(`Duplicate course "${entry.courseId}" in spine for study "${entry.studyId}"`);
    }
    orderMap.set(entry.courseId, entry.order);
  }

  for (const entry of entries) {
    const requiredPrereqs = prerequisites.get(entry.courseId) ?? [];
    for (const prereq of requiredPrereqs) {
      const prereqOrder = orderMap.get(prereq);
      if (prereqOrder === undefined) {
        issues.push(
          `Course "${entry.courseId}" (order ${entry.order}) requires "${prereq}", which is missing from the spine`,
        );
      } else if (prereqOrder >= entry.order) {
        issues.push(
          `Course "${entry.courseId}" (order ${entry.order}) requires "${prereq}" (order ${prereqOrder}), but prerequisite order must be strictly smaller (< ${entry.order})`,
        );
      }
    }
  }

  return issues;
}
