# 互动课件

当前课程的 PRIMM 载荷只有 `experienceVersion: 3`，每一步一屏、一个动作。八种步骤动作与写课合同以 [组件表](../../../../apps/local/.agents/skills/write-lesson/references/components.md) 为准；这里仅说明代码归属。

`PrimmLesson.tsx` 是 `PrimmSteps.tsx` 的薄入口。外壳组织进度、按账号/课节/版本/语言隔离的草稿、实际执行、原生 Make 判分与学完提交；`primm-steps/` 分别实现八种动作。`StepContext` 提供外壳状态，动作返回 `StepView`。两种 app 模式共用这些实现，执行与判分通过既有 port。

本机 Owner 预览用仓库根目录的 `pnpm primm:preview`，页面与受限执行服务都绑定 `127.0.0.1`（23150/23151）。执行需要本机 Ollama 的 `university-primm-local`；语音需要已有 Whisper 安装。启动器不会下载模型。未配置或失败时保留输入并明确失败，不填回示例。第 4 关双击入口与阅读状态以任务 12 为准。

`LearningActivity` 还承载测试目录和试玩页使用的三个原生玩法：`connect`、`sort`、`tune`。`LearningPlayLab` 的登记表与 wire enum 一起检查；每个玩法的三档任务、帮助、重开、完成/跳过证据共用同一宿主。原生活动完成不等于原生练习通过，不直接结算课程。

`/play-lab/catalog` 汇集这三种原生玩法、实际课程中的 V3 样课和六种岛上游戏。岛上游戏由 game-kit 与 world 组装；题目从课程中已有明确答案和解释的载荷投影，不给无答案预测编正确选项。

V1/V2 PRIMM、interaction-path 及已退役的独立大型玩法于任务 17 R3 移除。代码历史和仓库外备份保留；[原始截图相册](../../../../docs/reference/interaction-components/album.html)继续保留当时的画面。旧计划是历史证据，不再定义运行时。

设计约束见 [DESIGN](DESIGN.md)。回归入口为 `PrimmSteps.test.tsx`、`LearningActivity.test.tsx`、`LearningPlayLab.test.tsx`、`e2e/primm.spec.ts`、`e2e/learning-play.spec.ts`、`e2e/play-usability.spec.ts` 和 `e2e/play-completeness.spec.ts`。
