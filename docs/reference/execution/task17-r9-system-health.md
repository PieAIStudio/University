---
id: REF-TASK17-R9-SYSTEM-HEALTH
title: Task 17 R9 System Health
type: reference
status: active
canonical: true
owner: ai-assisted
created: 2026-10-05
last_reviewed: 2026-10-05
domain: execution
tags:
  - task-17
  - r9
  - system-health
related:
  - PLAN-17-DEEP-REFACTOR
  - REF-CURRENT-WORK
  - REF-REVIEW-REMINDERS-BACKEND-GAP
---

# Task 17 R9：学习者系统体检

这张表是 R9 的唯一当前体检入口。它回答任务文档要求的三个问题：真实链路
能不能走通、实现是不是只有一份、哪一组测试守着它。截图、完整门禁和原始输出
仍留在 `.scratch/overnight-20261003/`；这里只保留能让下一位维护者定位事实的
结论和链接。

## 证据批次

体检在 R8 `9bd55a9c` 推送后、R9 文档提交前进行，所有服务都使用测试自有的
catalogue 和合成账号，没有调用付费模型或真实推送服务：

- 单元回归：core `9 files / 97 tests`、UI `6 files / 27 tests`、app `6 files /
  47 tests`，共 **171 tests passed**；原始输出在
  `.scratch/overnight-20261003/task17-r9-focused.log`。
- 课程、步骤、批改和阅读：**25 passed (1.5m)**，覆盖 W1/W2/W3/W4、练习焦点、
  互动课件和源码证据；原始输出在
  `.scratch/overnight-20261003/task17-r9-grading-e2e.log`。
- 复习、六岛游戏、账号和设置：**82 passed (5.2m)**；原始输出在
  `.scratch/overnight-20261003/task17-r9-e2e-focused.log`。
- 岛上节点、六种游戏目录和庭院拦截：**15 passed (3.1m)**；原始输出在
  `.scratch/overnight-20261003/task17-r9-island-e2e.log`。
- 宝箱、知识卡、房间和复习小精灵：**14 passed (2.4m)**；原始输出在
  `.scratch/overnight-20261003/task17-r9-rewards-e2e.log`。

`Failed to fetch` 和 SwimmerUIKit 的图标提示只出现在测试明确模拟离线账号或
占位图标资源的夹具里；对应测试仍通过，未把它们当作产品成功信号。提醒发送和
真实 Supabase 跨设备读取也没有被伪造成已验收，见表内的边界说明。

## 逐系统结论

| 系统 | 端到端是否真实可走 | 唯一实现（代码归属） | 测试守门与结论 |
| --- | --- | --- | --- |
| 课文步骤与分层批改 | **通过（本地/合成服务）**。PRIMM 步骤、普通课练习、确定性判分、结构化批改的请求/错误边界都能走完；真实付费 provider 没有在 R9 启动。 | `apps/university/src/lesson/LessonRoute.tsx` 只组装共享 `LessonReader`/`PrimmLessonReader`；判分规则在 `packages/core/src/grading/answer-key.ts` 和 `fact-coverage.ts`，网络层只有 `apps/university/src/ports/online/grading.ts`。 | `task17-r9-grading-e2e.log` 的 25 项、`e2e/primm.spec.ts`、`e2e/W.ai-literacy.spec.ts`、core grading tests、app online-grading tests。**通过；没有发现需要冻结期修复的断路。** |
| 复习与间隔重复 | **通过**。从课程掉卡、次日到期、`/review` 先回忆再揭示、四档评分到清空队列，小精灵随到期卡出现并在评分后消失。 | FSRS 只有 `packages/core/src/scheduling/fsrs.ts` 一份；`packages/core/src/progress/port.ts` 写入，UI 的 `scheduler-ports.ts` 只做只读预览；两个 shell 共用同一 `ProgressPort`。 | `task17-r9-e2e-focused.log` 的 `review.spec.ts`、`review-clock.spec.ts`、`review-wisps.spec.ts`，以及 core FSRS/merge/review-wisp、UI scheduler tests。**通过；无第二套排程。** |
| 复习提醒 | **客户端状态机通过；真实发送未完成**。设置页读取和撤销订阅、拒绝权限、iPhone 普通 Safari 说明均可走通；发送服务开关固定为 false，所以不会假装通知已经送达。 | `apps/university/src/ports/notifications.ts` 是唯一浏览器适配器；设置控件在 `packages/ui/src/navigation/empty/ReviewReminderSettings.tsx`，进度字段仍走同一 `ProgressDocument`。 | `apps/university/src/ports/notifications.test.ts`、UI reminder prompt/settings tests、`docs/reference/execution/review-reminders-backend-gap.md`。**这不是 R9 本地红灯；VAPID、调度、投递和真实设备验收仍由 Backend gap 持有。** |
| 六个岛上游戏 | **入口和节点链路通过；完整浏览器演练只对庭院拦截**。六个身份 `courtyard/links/snake/moles/runner/blocks` 都出现在目录，节点按足够素材轮换并可回退二维玩法；庭院拦截实际走了启动、正确/错误判定和手机触控。其余五个游戏的规则和场景使用相同门面，未把目录存在误报成五个独立的完整通关验收。 | `packages/core/src/game-content/island-games.ts` 负责投影和轮换，`apps/university/src/game/IslandGame.tsx` 是唯一分派器，`apps/university/src/game/RoundGameShell.tsx` 是唯一共享外壳；六个 `*Game.tsx` 只提供各自规则和场景。 | `task17-r9-island-e2e.log`（15 项）、`e2e/courtyard-game.spec.ts`、`e2e/play-catalog.spec.ts`、`e2e/map-learning-nodes.spec.ts`、`packages/core/src/game-content/island-games.test.ts`。**通过当前承诺的入口/回退/庭院链路；若要六个都做完整浏览器通关，应另开测试增强包。** |
| 房间、宝箱与 keepsakes | **通过**。完成课后先开岛上宝箱，奖励顺序、延迟保存、匿名接管、减速动效、房间拖拽/键盘/手机平移和空房间都走过。 | 宝箱进度在 `packages/core/src/progress/chest-reward.ts`，keepsake 派生在 `packages/core/src/progress/keepsakes.ts`，房间展示在 `packages/ui/src/house/HouseRoom.tsx`；无第二个房间实现。 | `task17-r9-rewards-e2e.log` 的 14 项、`e2e/house.spec.ts`、`e2e/chest-opening.spec.ts`、core house/keepsake/chest tests。**通过。** |
| 衣柜与卡包 | **客户端通过；正式服务仍关闭**。房间里的卡包盒能说明发布边界，合成丢包响应会恢复一次、按序揭示并保留装备记录；没有调用未开放的 cosmetics RPC。 | `apps/university/src/cosmetics/store.ts` 是领取前的同步闸门，`packages/ui/src/cosmetics/CosmeticsPanel.tsx` 是唯一面板；衣柜旧地址只路由到房间，不再复制一套页面。 | `task17-r9-e2e-focused.log` 的 cosmetics 6 项、`e2e/cosmetics.spec.ts`、core cosmetics-store/reward tests。**本地行为通过；真实 Backend 注册和服务验收仍属任务 06 的 Owner-held 边界。** |
| 云端账号同步与离线 outbox | **本地/合成远端通过，真实远端待 Owner 环境验收**。游客进度保存在浏览器，登录后按选择合并；远端版本冲突、账号切换、失败时保留 dirty outbox 都有回归；浏览器账号表单和回课链路通过。 | `apps/university/src/progress/store.ts` 只创建一个浏览器 singleton；远端适配器由 `apps/university/src/account/progress-remote.ts` re-export `@pieai/university-backend/browser.js`，合并算法在 core `progress/merge.ts`，没有 authoring/delivery 两套 outbox。 | `task17-r9-focused.log`（core account.e2e、app session/progress-remote）、`task17-r9-e2e-focused.log` 的 Z account tests、`packages/core/src/progress/account.e2e.test.ts`。**代码闭环通过；真实 Supabase/RLS、跨设备和账号删除仍需真实凭据，不在 R9 自行登录。** |
| 设置 | **通过（本地和合成账号）**。主题、声音、界面语言、阅读细节、语音和每日目标有可达控件；英文路径能从星球、课程、课文进入设置再回课。 | `packages/ui/src/navigation/empty/SettingsScreen.tsx` 是唯一设置页；偏好结构在 `packages/core/src/ports/account-data.ts` 和 `learner-preferences.ts`，由同一进度文档承载，authoring 只注入同一 shell。 | `task17-r9-e2e-focused.log` 的 Y English/settings 6 项、UI empty-screen/theme/foreign-settings tests、core learner-preferences tests。**通过；提醒投递和真实账户保存的外部边界已在相邻行标出。** |

## R9 判断

R9 没有发现需要冻结期立即修复的“没真正跑通”功能，因此没有偷偷改产品行为，
也没有新建 Owner 任务包。提醒投递、真实 Supabase/RLS、正式卡包服务和五个岛上
游戏的完整浏览器通关都是明确的外部或覆盖范围边界，不应在本阶段用模拟成功来
填平。它们分别由 `review-reminders-backend-gap.md`、任务 06/09/15 的 Owner-held
事项或未来测试增强任务持有。R9 本阶段只增加这张证据索引和对当前工作入口的
链接，产品代码没有修改。
