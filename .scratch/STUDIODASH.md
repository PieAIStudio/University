# Studio「这一节该不该改」交付报告

- 日期：2026-08-30
- 分支：`work/studiodash`
- 页面：`#/studio`（authoring mode）
- 本地课程根：按简报要求使用 `/Users/yuanfei/PieAI/University/apps/local/studies`；没有写入该目录。

## 现有进度文档审计

结论：作者自己的答题事实已经足够计算第一版的逐课指标，但文档不是遥测仓库，也没有保存「首答」布尔字段。

| 要回答的事实 | 当前实际来源 | 当前状态 |
| --- | --- | --- |
| 某道题答了几次 | `ProgressDocument.exerciseAttempts`，以 `commandId` 为键，每条 `ExerciseAttemptRecord` 一条提交 | 已记录 |
| 这次答的是哪一节、哪一题、哪个版本 | `locator`（study/course/unit/lesson）、`exerciseId`、`contentRevision` | 已记录 |
| 答案与分数 | `answer`、`score`、`maxScore`、可空的 `hostGrade` | 已记录；宿主还没判定时 `hostGrade` 可为 `null` |
| 什么时候答的 | `occurredAt` ISO 时间 | 已记录 |
| 首答是否正确 | 没有持久化的 `firstAttempt` 字段；`recordExerciseAttempt` 只在写入当下计算 `firstTry`，用于 XP | 可由同一题同一课同一版本中最早的记录推导，但不是原始字段 |
| 错题与是否改正 | `mistakesOf(document)` 按题目和版本折叠；`hostGrade.passed === false` 才算错题，并给出 `wrongCount`、`corrected`、`wrongAt` 等 | 可推导；等待判定的记录不先算错题 |
| 课程级 `attempts` | `LessonProgress.attempts` | 只有课程进度标量，不能代替按题、按版本的 `exerciseAttempts` |
| 跨学习者汇总 | 当前 `ProgressDocument` 只代表一个作者/学习者 | 不存在；不能从本机文档推导全体学习者数据 |

旧进度文档缺少 `exerciseAttempts` 时，`parseProgress` 会读成空对象；因此空数据状态是可辨认的，不应被填成一个成功率。

## 本次实现

- `packages/core/src/progress/answer-stats.ts`
  - 新增纯函数 `answerStatsForAttempts` 与 `answerStatsOf`。
  - 只筛选精确的 lesson locator 和当前 `contentRevision`。
  - 每道题按 `occurredAt`，再按 `commandId` 稳定排序取首答；重试会增加尝试次数，但不会改写首答通过率。
  - `firstAttemptCount / exerciseCount` 显示首答覆盖；`totalAttempts` 显示全部当前版本提交。
  - 首答尚未得到 `hostGrade` 时不算失败，并让通过率保持 `null`，UI 显示等待判定而不是假装 0%。
- `apps/university/src/authoring/AnswerOverview.tsx`
  - Studio 中逐课程、逐单元、逐课一行展示：第一次通过率、尝试次数、已有首答记录的题数。
  - 明确标注「本机 / 作者自己的进度」；只读 browser `ProgressPort`，不改课、不上传原始答案。
  - 明确说明全体学习者的「答题汇总还没接好」，不填写全体学习者数字。
- `apps/university/src/authoring/FeedbackOverview.tsx`
  - 收敛为只展示学习者意见和原话，停止调用尚未接通的 answer aggregate 接口。
  - 与 `AnswerOverview` 在 Studio 中并列；课程和版本的确定性分组仍保留。
- `apps/university/src/authoring/answer-overview.css`
  - 宽内容区并列；应用壳在 1280px viewport 下的实际内容宽度不足时纵向排列；390px 手机宽度继续单列。
  - 未新增交互控件或第二套组件。
- `apps/university/src/authoring/StudioSection.tsx` / `index.tsx`
  - 只在作者工作台挂载答题面板，使用既有 `progressPort`。
  - 未从 `apps/local` import；delivery/learner 树不挂载 authoring 目录。

## 截图证据

以下截图来自全新的隔离浏览器会话，课程选择为外部 studies 根中的真实课程；答题数字来自该浏览器已有的 `university.progress.v2`，没有注入 fixture：

- [桌面 Studio 总览（1280×633）](studiodash/studio-desktop-overview.png)
- [桌面答题面板（1280×633）](studiodash/studio-desktop-answer.png)
- [移动答题面板（390×844）](studiodash/studio-mobile-answer.png)

截图中反馈区因当前环境没有可用的 SwimmerBackend 反馈权限而诚实显示「反馈数据还没接好」；答题区仍显示作者本机进度。全新会话稳定加载后浏览器 errors 为空，axe 实际 violations 为 0。

## 今天仍拿不到的 v5 数字

真实学习者群体的 owner-only 第一通过率、尝试次数和首答覆盖率仍拿不到。`FeedbackReviewSource.listAnswerAggregates(studyId)` 的类型契约已经存在，但当前 backend 实现明确抛出「SwimmerBackend 的答题汇总接口还没有接好」：现有进度行是单个学习者文档，不能把原始文档从浏览器拉出来冒充 owner dashboard。需要后端先提供真正的 owner-only 聚合查询/RPC，届时再替换答题列的数据源。

当前第一版能回答的是「作者自己学习时哪一节卡住了」。当本机作者没有某节的答题记录时，面板显示真实的「暂无答题数据」、`0` 次尝试和 `0/N` 首答覆盖；这些是空的作者文档事实，不是对其他学习者的估计。

## 验证

- `pnpm --filter @pieai/university-core exec vitest run src/progress/answer-stats.test.ts`：3 tests passed。
- authoring `FeedbackOverview.test.ts` + `AnswerOverview.test.ts`：2 files / 2 tests passed。
- `pnpm --filter @pieai/university-core typecheck`、app typecheck、lint、format check：通过。
- `pnpm boundaries`：module boundaries、kit portability、contrast、raw colours、shared styles 全通过。
- Impeccable detector（本次变更的 authoring TSX/CSS）：返回 `[]`。
- `pnpm verify`（最终文案之后完整重跑）：通过；其中 core 49 files / 414 tests、app 45 files / 195 tests 均通过，构建、authoring exclusion、bundle 与 docs checks 也通过。
- closeout learning 新增后运行 `pnpm docs:check`：通过（77 docs、79 current files、0 warning）。
- `check-export-freshness` 的现有信息提示是本机无 initialized studies，无法证明 source freshness；这是当前 worktree 的环境事实，不是本次 Studio 变更失败。
