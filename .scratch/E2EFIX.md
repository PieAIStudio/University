# E2E 修复交接

日期：2026-09-01
分支：`work/e2efix`

## 撤回的错误方向

已恢复任务书指定的五个文件，不把上一轮的 `directRouteCourses` 方向带进提交：

- `apps/local/course-proposals/recovery/turing-pact/index.json`
- `apps/local/server/recovery/course-recovery.ts`
- `apps/university/scripts/delivery-artifact.mjs`
- `apps/university/scripts/import-courses.mjs`
- `apps/local/studies/README.md`（同时恢复了原文件类型，未提交软链接陷阱）

全仓库检索不到 `directRouteCourses`。没有改动 `apps/local/studies/` 的内容、课程状态，或 `packages/world/src/island|grid|sky`。

## 探针现在钉住的结构

`e2e/harness/experience.ts` 从投放端真实的 `/content/shelf.json` 展平 study → course → unit → lesson，优先选一节同时有练习、短源码证据、单条证据的已发布课文；找不到时仍从同一货架回退到课程第一节或其他合格课文。它不会再保存任何课程 ID。每次选择都会断言 study、course、unit、lesson ID 以及课程/课文标题非空，并从这些返回值构造路径。

`L.reader-interaction.spec.ts`、`N.nocollide.spec.ts`、`O.nav.spec.ts` 和共享路由入口都使用这个 fixture。N2 的右栏断言也改为所选课程的第一节标题，而不是另一门旧课程的文案。作者端 E2E 启动器只额外解析工作树里的直接 study 软链接，把本地 API 指到真实的只读 study 根；没有写回课程源。

验证时导入器报告 `4 studies, 16 courses`，货架检查报告 `4 studies, 44 courses, 495 lessons match the manifest`。实际运行的动态课文是：

`/buzz/buzz-orientation/orientation-workspace/home-feed-on-read`

旧的 `foundations-terrain` 不在这份已发布货架里，探针仍自动选到 Buzz 课程并完整通过 46 条 E2E。因此课程转为 stale、从投放货架合法消失时，不会再把这组结构探针一起打红；本轮没有通过修改 stale 状态来证明这一点。

保留了两处真正的探针修复：`humanClick` 先 `scrollIntoViewIfNeeded()`，F 的课程标签在点击前按可访问名称重新解析并等待稳定盒子。Axe 匹配也只把证据路径、行号和 React 生成 ID 归一为同一个证据控件结构；仍保留当前违规数量不得超过 baseline、不得出现 fresh violation 的约束。

## 拾取时课名列表是否重排

结论：产品没有重排课程数据或 DOM 顺序，不需要在这个分支修产品。

`apps/university/src/app/world-model.ts` 按 `world.placements` 原顺序生成 markers，拾取只调用 `onCoursePick()` 和 `setPicked(entry.node)`；`packages/world/src/WorldMapCanvas.tsx` 也按 `markers.map(...)` 渲染标签。拾取后入口提示退场，`placeLabels` 可能重新计算标签的屏幕位置，但这是空间布局重算，不是课程名列表换序。F 的按 accessible name 重新定位是针对这个时序风险的探针加固，没有掩盖产品缺陷。

## G2 跨端能力控件

这是实质统一，不是把断言改软：

- `LayerCoverage` 两端都显示「查看项目分层」；投放端缺少分析能力时仍显示已引用文件、不可用状态和按钮，点击按钮仍打开 `CapabilityExplanation`。
- `LessonSourceVersion` 两端都显示「打开正在学习的 App」；浏览器端不能启动时仍显示边界说明和按钮，点击仍通过 `lessonVersion` 打开解释。

组件测试实际点击了两个不可用控件，并断言解释对话框出现且包含「为什么这一端现在做不到」及具体原因；`LessonScreen` 测试也断言不可用状态、控件和 parity control 可见。没有删测试、skip、fixme 或放宽失败条件。

## 验收结果

- `E2E_ONLINE_PORT=18193 E2E_LOCAL_WEB_PORT=18194 E2E_LOCAL_API_PORT=18195 E2E_GRADING_PORT=18196 pnpm e2e`：退出码 0，`46 passed`（约 4.3 分钟）。运行前四个端口均无监听；定向 M 也为 `7 passed`。
- `pnpm verify`：第一次在 Vite 清理 `apps/university/dist` 时遇到一次 `ENOTEMPTY`；随后单独运行 `pnpm --filter @pieai/university-app build` 成功。第二次完整运行通过 typecheck、lint、format、workspace tests、边界、canvas、review-card、experience ledger、双模式构建、shelf 和 content-revisions，最后只在任务书预告的既有问题停止：

  `turing-pact — re-export failed: Study has no active courses: turing-pact`

  因此 `pnpm verify` 本轮最终退出码为 1，未绕过或修改该 freshness 闸门。

## 仍需留意

- freshness 闸门仍等待另一项导出/课程状态工作处理；本分支没有碰它。
- E2E 继续记录已有的 X1 feedback 对话框关闭控件/ESC 问题，以及 `THREE.Clock` 弃用警告；它们不是本次课文身份或 G2 修复的一部分。
- Axe baseline 仍有历史对比债务，M 只证明没有新增违规并允许已消失项；没有把历史债务从报告里删掉。
