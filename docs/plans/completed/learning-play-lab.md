---
id: PLAN-LEARNING-PLAY-LAB
title: Five reusable learning activities
type: plan
status: completed
canonical: true
owner: project
created: 2026-09-07
last_reviewed: 2026-09-08
domain: learning-interaction
tags:
  - learning
  - gameplay
  - verification
related:
  - SPEC-0001
---

# 五种可复用的学习玩法

> 本文保留该轮的决定和原始验收；当前入口、引导与难度配置由后续[易玩度与三档迭代](play-usability.md)接续，旧截图不代表当前首屏。

用户要求独立分支、独立 worktree，循环实验直到交付五种有趣、有效、可以插入课程的玩法。
本轮起点 `4da3605`，分支 `codex/learning-play-lab`，相邻工作区 `University-play`。
学习者行为先定义于 [journey v5](../../reference/player-journey/v5/index.html#learning-play)。
不改课程生产、发布或完成合同；样例是组件试验载荷，课程负责人之后经既有 CLI 配课。

## 已完成任务

每项完成后记录修改与验证。当前细分清单与原始输出放在工作区的
`SCRATCH/learning-play-lab/tasks.md`；此文保留可随分支交接的设计、决策与验收事实。

- [x] 核对主线、远端、现有 worktree，创建独立施工区。
- [x] 读取基线、journey、内容合同与品牌规则；执行学习召回。
- [x] 只读检查两个 PBMLS 归档的真实组件与调用链。
- [x] 检查共享 UI、路由、品牌按钮与现有音频解锁。
- [x] 定义五种动作与统一结果接口；先写 journey。
- [x] 实现确定性规则、五种共享组件、每类两个样例。
- [x] 建立独立试玩入口、可组合的连续试玩与内嵌接口。
- [x] 真实输入走完成功、失败、提示、重试、跳过与换情境。
- [x] 桌面、窄屏、键盘、减少动效与双主题证据；独立审查并修正。
- [x] 相关测试、构建、完整 `pnpm verify`；使用说明与合并交接材料齐备。

## 方法与证据边界

采用学习目标反推操作：先说学习者应能做什么，再定义可观察产物，最后设计玩法。
完成一次实验只说明本次操作成立，不写“已掌握”，也不自动发学习 XP。

IES 的教学实践指南支持提取练习、解释问题、图文互相补充与抽象/具体表征的连接；
这些是设计依据，不是对这五种组件的效果证明。
来源：[IES / Organizing Instruction and Study](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)。

PhET 的界面研究强调目标明确的探索、可理解控件、约束和反馈；据此让用户先改变系统，
再从结果得到线索。每个失败都应指向可修正原因，不能只有红叉。
来源：[PhET / Interface design study](https://phet.colorado.edu/publications/archive/Phet%20Interview%20Paper.htm)、
[Implicit scaffolding paper](https://arxiv.org/abs/1306.6544)。

动机方面，Ryan、Rigby 与 Przybylski 的游戏研究发现，游戏中的自主感、胜任感与愉悦、偏好有关。
据此提出本轮设计假设：自己选玩法和策略、操作容易上手、错误后能看见进步，比强制计时更值得先做。
这不等于已证明用户喜欢当前组件，相关体验仍需实际试学。
来源：[The Motivational Pull of Video Games](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf)。

也参考了对 HCI 游戏研究中浅层套用 SDT 的批评；方法论在这里用于提出可检验的设计假设，
不能当作「用了自主选择就一定好玩」的背书。
来源：[Tyack & Mekler, 2024](https://arxiv.org/abs/2405.12639)。

可探索解释提供“质疑一条规则并实际试验”的交互参照；这是设计论述，不是随机对照试验。
来源：[Bret Victor / Explorable Explanations](https://worrydream.com/ExplorableExplanations/)。

本轮自动测试与 AI 试玩可验证规则、可达性、错误反馈和状态一致性，无法证明真人觉得好玩
或能长期记住。后续试学观察：无帮助完成、错误后能修正、换情境成功、能解释一个因果关系；
延迟回访才讨论记忆保持。记录真实结果，不凭点击次数代替它们。

## 五个核心循环

| 玩法 | 操作与悬念 | 通关证据 | 迁移与变化 |
| --- | --- | --- | --- |
| 因果接线台 | 点起点、点终点接线，发出探针，看信号在哪断开 | 关系完整且无多余依赖，成功/失败路径都成立 | 请求链路 / 创作发布流程；多个独立关系可用任意顺序建立 |
| 调参实验室 | 改连续参数，观察多个指标，保存实验对照 | 多项相互制约的目标同时达成 | 图像传输 / 批量处理；多个可行解，不要求猜作者数值 |
| 反例猎手 | 自己造输入，观察规则承诺与程序实际输出的分歧 | 合法输入构成可复现反例 | 包邮阈值 / 数值限幅；允许所有成立的反例 |
| 请求调度台 | 把到来的任务送到处理通道，系统状态随决策改变 | 正确服务全部请求且成本不超预算 | 网页缓存 / 素材生产复用；旧请求再来时可用已经产生的缓存 |
| 指令画布 | 写移动、转向和重复次数，运行一个小程序 | 到达目标、经过检查点、无碰撞且不超指令预算 | 快递路线 / 灌溉路线；允许不同有效程序，循环减少表达负担 |

首屏就看见可操作物。每次操作即时回应；运行轨迹用短节奏、局部强调与共享声音。
基础模式无时间压力，调度玩法有主动开启的倒计时、暂停与到时继续练习。
声音复用共享设置，关闭声音仍可读懂；减少动效下直接显示同一运行证据。

## 第一轮试玩后的修正

独立试玩指出：调参只有数值会退化成把指标调绿的表单，反例的开场泄露了边界答案。
本轮调整为：调参同时展示可观察的图片细节或工作队列，明确标为教学模型；
反例默认只展示规格与可试验对象，把程序实现留在可选展开中，允许从数轴选取输入、
自己修正数值，再通过承诺与结果的并排对照发现分歧。初始文案不直接告诉边界答案。
手机试玩另发现长指令列表把运行按钮和棋盘分开：启动时应把棋盘带回视口，
执行控制与反馈保持可达，失败后能回到对应指令编辑。
接线的错误描述改为“不成立的直接关系”，区分跳步与倒置，不泛称逆因果。
最后的内嵌检查发现：在 1440px 桌面内嵌 390px 活动时，仅按视口断点排列会把棋盘压到约 121px。
改为按活动容器宽度切换上下布局，保留同一组件树，并加入窄课文栏实际运行的浏览器回归。

## 从旧项目推翻了什么

PBMLS 的排序模块值得继承构造行为，但唯一顺序、按移动次数评分和弹窗失败均不沿用。
预测回调丢弃用户输入、关键词覆盖率判分、点击即完成和强制等待均淘汰。
自信度是可叠加反馈而非第六个玩法；计时不能当作理解证据。
归档只作为设计启发，没有复制其代码、样式或依赖。

## 结构与集成边界

纯载荷和确定性计算在 `packages/core/src/learning-play/`；共享交互、样式与宿主在
`packages/ui/src/learning-play/`。按钮、输入、滑条、开关与声音使用既有品牌/共享实现。
`LearningActivity` 通过 `activity` 接受数据、通过 `onResult` 提交一次本轮结果。
不同活动可由父级编排，组件不知道课程、账号或存储。
试玩入口 `/play-lab` 对两个模式一致；示例与整页宿主延迟加载。
试玩记录仅在当前页面会话中显示；不创建第二套学习者存储，不改课节完成状态。

## 验收回执

交付五种可操作组件、十个情境、一个可内嵌宿主与连续试玩编排。双模式使用同一实现；
规则、输入、尝试、提示和结果均留有实际证据，重试与跳过不冒充课程进度。
接口与例子见 [组件 README](../../../packages/ui/src/learning-play/README.md)，
视觉、布局、动效与焦点规则见 [模块 DESIGN](../../../packages/ui/src/learning-play/DESIGN.md)。

### 核验范围

- 已通过完整 `pnpm verify`：类型、格式、lint、1963 个 Vitest 用例及脚本合同检查、模块/品牌/翻译边界、双模式构建、目录/发布/课程链接和文档治理。
- 已通过十一条真实浏览器回归，覆盖全部十个情境、错误恢复、可选计时的暂停与超时恢复、跳过与连续试玩、双模式手机布局、键盘输入、减少动效，手机长程序的实际视口断言，以及宽屏中窄课文栏的布局与运行。每条都检查未处理浏览器错误。
- 主核验在 worktree 内的默认路径没有找到直接初始化的 studies；随后显式指向主工作区的真实课程源补跑 `check:export-freshness`，四份导出均与源课程一致。没有将“跳过核对”记成已证明新鲜。
- 独立审查在固定构建上复核三项主要发现：调参可观察对象、反例开场泄题、手机执行反馈离屏，全部 resolved。另逐项完成十个情境，并复核接线箭头、测试历史、工作队列最大状态与碰撞后返回出错指令。
- 内嵌断点修正后，完整十一条浏览器用例再次通过；窄栏棋盘恢复到约 310px，三个添加指令按钮均超过 90px 宽。最后的完整 `pnpm verify` 复验通过。

这是 AI 专家试玩和自动回归。没有把它写成真人觉得好玩、长期记住或学习效果已被证明。
固定题目的重玩变化有限；第二情境主要用于初步迁移，尤其接线两题图结构相同。
后续扩题应改变关系、边界、约束或策略空间，避免只换标题和皮肤。

### 随分支保留的视觉证据

原始截图未拼接或重绘。桌面 1440px 宽；手机布局 390×844。
所有原始截图、详细独立发现与命令输出保存在本机 worktree 的 `SCRATCH/learning-play-lab/`，
下列选样随本计划入库，便于换工作区后复核。

| 场景 | 截图或录像 | 证明什么 |
| --- | --- | --- |
| 试玩入口 | [桌面入口](learning-play-evidence/entry-desktop.png) | 五种入口与首个可操作物的位置 |
| 接线 | [双分支通过](learning-play-evidence/connect-desktop.png) | 可读箭头、实际关系与双路径记录 |
| 调参 | [图片取舍](learning-play-evidence/tune-desktop.png) / [手机夜间主题](learning-play-evidence/tune-mobile-night.png) | 参数、可观察对象与指标对应 |
| 反例 | [包邮反例](learning-play-evidence/hunt-desktop.png) | 用户输入、规格与实际差异、测试历史 |
| 调度 | [预算内完成](learning-play-evidence/dispatch-desktop.png) | 七次处理、缓存复用与八点预算 |
| 程序 | [桌面路线](learning-play-evidence/program-desktop.png) / [手机运行中](learning-play-evidence/program-mobile.png) | 指令、轨迹、运行控件与反馈同屏 |
| 桌面窄栏内嵌 | [390px 课文栏](learning-play-evidence/program-embedded-desktop.png) | 桌面视口很宽时仍保住单栏和可读棋盘 |
| 七条手机程序 | [连续录像](learning-play-evidence/program-mobile-seven.webm) | 390px 下完整十二步的节奏与可见性 |

### 预览、复跑与合并

本机固定构建预览：`http://127.0.0.1:21997/play-lab`。停止后，在此 worktree 完成构建，使用：

```sh
pnpm --filter @pieai/university-app exec vite preview --mode delivery --host 127.0.0.1 --port 21997 --strictPort
```

本机内容来自现有课程源。独立 worktree 的浏览器回归应给 launcher 明确的 studies 路径；
它将输出到自己的临时目录，避免覆盖正在编辑的课程或共享生成内容。

```sh
UNIVERSITY_STUDIES_ROOT=/Users/yuanfei/PieAI/University/apps/local/studies \
E2E_ONLINE_PORT=22993 E2E_LOCAL_WEB_PORT=22994 \
E2E_LOCAL_API_PORT=22995 E2E_GRADING_PORT=22996 \
pnpm exec playwright test --config e2e/playwright.config.ts --project=default e2e/P.learning-play.spec.ts

UNIVERSITY_LOCAL_STUDIES_ROOT=/Users/yuanfei/PieAI/University/apps/local/studies \
pnpm check:export-freshness
```

分支以 `4da3605` 为基线。主要新目录为 core/ui 的 `learning-play`，跨工作线交集只有
共享路由、Practice 入口、全局 CSS 导入、i18n 注册、journey v5 与 current-work。
合并时保留其他工作线在这些文件里的增补，并重新生成文档 manifest；不要用整文件覆盖解决冲突。
本轮不合入其他未完成分支。配课时按 README 的学习目标挑一到两个活动，经既有课程 CLI 和发布合同接入。
