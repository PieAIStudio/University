# 改写标记交付记录

本次实现以 `docs/reference/player-journey/v5/index.html` 的「决定 H」为产品合同：课程全部保留；学习者能在地图上看到并进入课程；地图名称显示“改写中”；选课卡只提示一次；课程页不重复提示；不锁课、不打折。

数据管道没有改动。本次只补了共享类型和两个学习者 UI 面：地图标记与选课卡。

## 类型

- `packages/core/src/progress/contract.ts` 增加可选的 `CourseShape.isBeingRewritten`，并导出 `CourseLearnerFact`。字段缺失时保持旧的 progress shape 输出不变。
- `packages/ui/src/view/lesson-view.ts`、`packages/world/src/course/course.ts`、`apps/university/src/content/library.ts` 复用同一个 learner fact；没有新增 `any` 或第二份字段定义。
- `apps/university/src/app/world-model.ts` 只把已存在的 marker `sub` 作为地图 DOM 状态文案来源；没有修改生成目录或发布管道。

## 两处 UI

### 地图

`packages/world/src/WorldMapCanvas.tsx` 继续用 DOM label 渲染课程名，在课程状态的 `<small>` 上加 `.label__course-status`，在外层 label 加 `data-course-rewrite-marker="true"`。样式在 `packages/world/src/overlay.css`。

状态文案通过 `app.app.worldmodel.copy.改写中` 从 i18n 注入，地图没有锁定、隐藏、打折或改变进入行为；学习者仍可点击岛和 DOM label 进入课程。

### 选课卡

`packages/ui/src/path/CoursePickCard.tsx` 在现有进入按钮前渲染一次 `[data-course-rewrite-notice]`。文案只来自 i18n key `ui.path.coursePickCard.copy.早期版本提示`，原文为：

> 这门课是早期版本，正在重写。内容可以读，但用词和讲解顺序还没到现在的标准。

`packages/ui/src/path/path-cards.css` 只负责提示的视觉样式。`apps/university/src/app/App.tsx` 将 learner fact 传入卡片；进入按钮仍然存在且可用。

课程阅读页没有添加提示。`LessonScreen.test.tsx` 用 `isBeingRewritten: true` 的课程 fixture 验证阅读页不存在该提示。

## 探针与测试

探针钉的是结构，不是“改写中”这三个字：

- 地图：`[data-course-rewrite-marker]` 与 `.label__course-status`
- 选课卡：`[data-course-rewrite-notice]`
- 地图测试通过真实 DOM button 的子节点文本验证屏幕阅读可读性；没有依赖 `aria-label` 中的状态文案，也没有使用“改写中”作为结构选择器。

已覆盖：改写课程有提示且仍可进入；普通课程没有提示；地图标记是 DOM、可读且可激活；阅读页没有提示。

为验证测试确实守住行为，曾临时把卡片条件改成 `{false ? (`：选课卡测试出现 1/6 失败，失败断言为提示节点应存在；恢复为 `{isBeingRewritten ? (` 后该文件 6/6 通过。临时缺陷未保留。

## 浏览器证据

使用 headed Chromium 实测 delivery 页面，确认地图状态、选课卡文案、窄屏换行和进入链路：

- [desktop-map.png](/Users/yuanfei/PieAI/University-wt-rewriting/.scratch/rewriting/desktop-map.png) — 1440×900 地图，课程名旁的状态为 DOM 小标签。
- [desktop-card.png](/Users/yuanfei/PieAI/University-wt-rewriting/.scratch/rewriting/desktop-card.png) — 1440×900 选课卡，原文提示与进入按钮同时可见。
- [mobile-card.png](/Users/yuanfei/PieAI/University-wt-rewriting/.scratch/rewriting/mobile-card.png) — 390×844，提示换行后进入按钮仍完整可见。

浏览器中实际点击了“进入这门课”，随后进入课程页并确认没有重复的改写提示。

## 最终验证

`pnpm verify` 通过，包含 typecheck、lint、format、全仓测试、delivery/authoring build、课程/发布目录检查、i18n、canvas/review registry、experience ledger 以及 doc-gov 闸门。

未修改 `apps/local/`、生成/发布数据管道、`packages/world/src/grid/`、`sky/`、`island/`、`Maps.tsx` 等 brief 明确排除的路径。
