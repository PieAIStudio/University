# 零基础主干课程编排

## 这份文件解决什么

现有 7 门正式课程默认你已经会读 TypeScript、知道什么是异步、见过 React。
这份编排负责把起点拉到零，让「学过一点但漏洞很多」的人可以从头走一遍，
已经会的快速略过（答对即进入长间隔），没会的自然暴露出来。

## 一条不能绕开的约束

**每一节课、每一张卡片、每一道练习，schema 都要求至少一条 `evidence`，而且证据会被真实校验：**
指向的文件必须在钉住的 commit 里存在，行号必须落在文件范围内。

所以**不能写一节纯讲「什么是变量」的课**——它没有证据可引。

三条路，选了第二条：

| 方案 | 结论 |
| --- | --- |
| 给基础课开证据豁免 | 否。证据是这个系统唯一的立身之本，为了铺量把它挖掉，剩下的就是一堆无法核对的教程 |
| **用真实代码教基础概念** | **采用** |
| 造一个教学专用假仓库当 study | 否。为了满足约束而造仓库，是仪式不是工程 |

### 为什么第二条不是妥协，是更好的教法

1. **具体。** `src/ui/utils.ts` 只有 3 行，用它讲「什么是函数」比讲抽象定义有效得多。
2. **复利。** 在「什么是对象」里见过 `authStore.ts`，之后学《状态与过程》时它已经是老朋友。
   零基础课不是正式课的前置台阶，是同一批代码的第一次相遇。
3. **诚实。** 每张卡片背后都是你真要维护的代码，不是教科书里的 `foo`/`bar`。

**代价：** 教不了图灵密约里不存在的东西（指针、Rust 所有权、Java 泛型）。
对「能维护这两个项目、能做一人公司」这个目标，这不是损失。

## 阶段主干

钉在 `git-3b402e069a5d` / `ua-3b402e06-v2-9-4-zh-full-e98206c7358f1ff1-179ee6bc7b4a`。

| # | 课程 ID | 名称 | 教什么 | 主要证据来源 |
| --- | --- | --- | --- | --- |
| 0 | `foundations-terrain` | 认识地形 | 一个项目由什么组成；文件为什么这么摆；commit 为什么是盖章 | `package.json`、`tsconfig*.json`、目录结构 |
| 1 | `foundations-reading-code` | 读懂一行代码 | 函数、值、类型、对象数组、导入导出 | `src/ui/utils.ts`(3行)、`src/platform/web/haptics.ts`(3行)、`src/services/product-analytics/types.ts`(9行) |
| 2 | `foundations-logic` | 读懂一段逻辑 | 分支、遍历、联合类型与穷尽、空值 | `src/features/experiments/analytics.ts`、`src/services/room-entry/types.ts`、`src/platform/runtimeInfo.ts` |
| 3 | `foundations-async` | 等待与失败 | 同步/异步为什么存在、Promise、错误处理 | `src/platform/storage.ts`、`src/platform/index.ts` |
| 4 | `foundations-ui` | 界面是怎么长出来的 | 组件是返回界面的函数、props、state、副作用 | `src/features/**` 的小组件 |
| 5 | `foundations-data` | 数据从哪来 | 客户端状态、服务端数据、实时 | `src/stores/*`、`src/services/supabase`、Realtime |
| 6 | `foundations-quality` | 怎么知道没写错 | 测试与断言、类型检查、lint、CI 门禁 | `tests/*`、`scripts/qa/*` |
| 7 | `foundations-product` | 代码之外 | 埋点与隐私、转化漏斗、内容治理、成本 | `product-analytics`、`roomFunnelTracking`、`moderation`、`ai-budget-client` |

每门 2–3 个单元，每单元 3–5 节，合计约 60–90 节。
**这是「抓大放小」之后的规模，不是把几百节当成目标。**

## 学习顺序

```
foundations 0 → 7   （零基础主干，用 focus 指向它）
        ↓
contracts-and-drift · state-and-process · testing-strategy · one-codebase-many-hosts   （TuringPact 正式课）
        ↓
ai-cost-and-boundaries · generated-assets · founder-engineer   （SupaLuv，之后再学）
```

## 生成约定（交给 Grok 执行时必须遵守）

1. **证据必须真实。** 每条 `evidence` 的 `sourcePath` 必须存在于 commit
   `3b402e069a5db5fe9eb82dbc03aa05152b3d298b`，`lineStart`/`lineEnd` 必须在文件行数内。
   写之前先 `git show <commit>:<path> | wc -l` 核对。
2. **有卡片就必须有练习。** 否则卡片永远进不了复习队列，schema 会直接拒绝。
3. **ID 在整门课内唯一**——课时、卡片、练习的 ID 都是同一课程目录下的文件夹名。
4. **中文正文**，沿用现有课文结构：`学习目标` → `先给结论`（事实/推论分开标注）→
   `一个类比` → `工作示例` → `自检` → `重点`。
5. **一节课只讲一件事。** 零基础读者的预算是一次一个新概念。
6. **练习两种**：`short-answer` 给参考答案；`explain` 给 3–4 条评分要点。
   零基础阶段以 `short-answer` 为主，概念性强的用 `explain`。
