---
id: PLAN-PLAY-USABILITY
title: Beginner playability for ten learning activities
type: plan
status: completed
canonical: true
owner: project
created: 2026-09-08
last_reviewed: 2026-09-08
domain: learning-interaction
tags:
  - gameplay
  - onboarding
related:
  - PLAN-AI-PRODUCT-PLAY
  - PLAN-LEARNING-PLAY-LAB
---

# 十种玩法的易玩度

用户确认十种玩法的价值，要求显著降低普通人的进入门槛。沿用 University-play / codex/learning-play-lab，基线 d6cd44f。保留十种、二十情境、既有品牌与确定性证据；优先改新五种 AI 玩法，不增加第十一种。

## 首玩证据与决定

1280×900 和 390×844、同一 dark 主题、同一固定构建各采十个入口。手机 AI 第一个控件距页面顶部分别约 996/975/1308/1051/1338px，均不在首屏；Agent 原游戏区有14个实际可见、可用控件（早期DOM矩形计数36把折叠内容也算进去，已排除）。这里是 DOM 与截图事实，不是玩家完成时长。原图与逐项尺寸在 `SCRATCH/play-usability/before/`，用户原话也是直接体验反馈。

先让人动手，再随操作引出需要理解的事实。压缩实验室营销介绍与重复的背景/目标，把背景和扩展工具作为可展开材料。活动标题和教学沙盒性质继续可见；当前一步的目标贴着真实按钮和结果。

| 玩法 | 最先做什么 | 随后如何增加信息 |
| --- | --- | --- |
| 原型 | 同样提交一次，看两份产品不同 | 在产品旁逐个问清约定并写入；随时可回看和修改，最后实际验收与客户变更 |
| 装箱 | 让第一位顾客试问 | 错误旁打开相关来源，修改材料后就地重生成并重试；材料库、容量和历史渐进显示 |
| Agent | 看当前读取目标，明确授权再执行 | 下一步的拟改文件和保留项出现；工具箱/工作区记录折叠可达，文件范围仍来自真实 capability |
| 评测 | 使用公开写明条件和预期的入门题，点一次真实试跑 | 同题再试揭示反差，然后自己造题；模板观察不替代后面的自主用例和整组回归 |
| 返工 | 跟着一句当前提示在产品上复现 | 封存后突出改法与双版回放，再引导保留旧功能；高级分支和完整历史随用随开 |
| 接线 | 点一个起点，再点下一站 | 当前选中项与已连接数反馈，探针和恢复在场地旁 |
| 调参 | 先动一个滑块，直接看到变化 | 当前读数与未满足条件贴近参数；历史与模型后置 |
| 反例 | 先用现成输入测一次 | 从承诺与实际结果引向边界探索，保留精确输入与历史 |
| 调度 | 看当前请求，选择一个处理入口 | 第一次留下缓存后才解释复用；计时挑战与审计记录按需展开 |
| 指令 | 先加一条前进，运行看路径 | 棋盘旁可加基础动作，首次碰撞/未到终点引回编辑；重复与完整轨迹按需展开 |

默认带当前步骤提示，提供“自由探索”切换，保留同一玩法状态及所有证据。不是另写一套教程，也不将切换、模板或点击继续当作完成。熟悉后可直接展开工具，学习路径不必强制单向。

## 方法依据

NN/G 的渐进展示区分当前核心功能与少用工具，也指出需要来回比较的操作不应被拆到彼此隔离的向导屏。因此把修改与结果保持相邻，只收起本阶段不需要的内容。[原文](https://www.nngroup.com/articles/progressive-disclosure/)。

NN/G 的移动教程实验提醒前置讲解不一定改善操作；本轮把说明放进实际动作，避免要先记住一段教程才能开始。[研究](https://www.nngroup.com/articles/mobile-tutorials/)。GDC 的 onboarding 实务同样把机制、早期体验和学习节奏一起考虑。[Six Pillars of Impactful Onboarding](https://www.gdcvault.com/play/1026855/Six-Pillars-of-Impactful)。这些是设计依据，非本组件真人效果证明。

## 执行与验证

细任务板在 `SCRATCH/play-usability/tasks.md`。当前步骤：共享首屏、五个 AI 引导、原五个当前动作提示；然后同尺寸前后对照、真实首动作/恢复回归、独立 AfterCritic、必要修正、完整 verify。结束时更新 README/DESIGN、journey/current-work 与所有者简报；前轮计划保留原证据，当前事实由本轮与模块文档说明。

## 用户追加：每种玩法的三档挑战

难度与帮助独立：`intro`（入门）减少要同时处理的判断，`practice`（进阶）组合常见判断，`challenge`（挑战）加入交叉条件、诊断或更严格的回归。不能把不显示提示、强制倒计时、更多点击或更多重复题单独叫高难度。

采用一个 `ActivityFamily` 包含同 kind 的三份显式载荷，每份拥有独立 activity id 与 difficulty。UI 选择载荷后仍只调用原来的一个引擎；`guided` 只影响呈现。一次课节选一个 family/level，后期课程仍可选入门做复习，不按系列序号自动升难。选择新难度开始新一轮，不把旧证据搬到新条件；结果同时记录本轮真实难度和活动 id。

| 组件 | 入门 | 进阶 | 挑战 |
| --- | --- | --- | --- |
| 接线 | 三节点两条关系，先接一段短链 | 完成现有全关系与分支 | 加入失败后的重新尝试回路及对应探针 |
| 调参 | 一个可调变量、明确取舍 | 两变量协调 | 增加独立约束或收紧可行域；不把等价读数算多个挑战 |
| 反例 | 缩小试验范围找一处反例 | 在完整范围主动找反例 | 反例外还要实际验证分界两侧 |
| 调度 | 三件请求认识服务和复用 | 现有七件混合请求 | 更多键/实时请求交错，预算要求分清可复用与必须重做 |
| 指令 | 短路径与少量检查点 | 现有关卡 | 额外绕行检查点与有依据的指令预算，给维护者保留可运行路线 |
| 原型 | 两项已明确，只问准入方式并试用 | 三项约定和实际验收 | 验收后收到临时变更，保留其他约定并重测 |
| 装箱 | 一个顾客、较少来源 | 多个顾客与冲突材料 | 必须摘取才能装下的材料预算，仍有充分解 |
| Agent | 读取并产生一份有用草稿 | 原有混合写入、材料指令与预览 | 更多相互依赖的行动及来源指令，真实产物与保留项都验收 |
| 评测 | 正常请求与一种边界 | 四类请求 | 交叉条件也必须冻结并实际回归，不能只逐个开开关 |
| 返工 | 两种改法中选取，并复验一次旧能力 | 原有三种改法和双版本回归 | 预约保留A同时把B改成C；偏好两次改选分别重开仍能读回 |

默认进阶载荷承接前轮案例（原型的原临时变更进入挑战）；入门与挑战都需证明可解且没有预置完成证据。预置的是明确提供的约定、连接或测试条件，不是玩家的操作收据。课程作者/AI 以学习目标、先修动作、已知事实、待练判断和验收证据选难度；载荷形状会由共享 family 检查，正式课节仍通过已有课程 CLI，不能由组件注册表直接生成课程。


## 实际迭代与独立复核

首次手机检查发现除了重复说明，Agent 仍需滚过文件检查区、Eval 仍需滚过两层介绍。已经把明确的读取授权前移，将评测的当前请求、公开预期与首次试跑收在同一工作区。原型从一次同步报名开始，顾客与来源由实际错误串起来；完整玩法可通过自由探索查看。

新 R 回归继续发现：调度的第一个按钮是尚不可用的缓存，真正的文件服务在首屏之外。现将处理入口并排，当前无副本时引导视图的缓存按钮不可用，并把难度与情境工具行合并。首动作按真实可用控件统计，不再用 DOM 第一个按钮代表；调参首动作是滑块。

独立 AfterCritic 实际操作 Agent 与 Eval 入门前三个判断，验证提示切换保留授权和记录，换挑战会清本轮并展示四类+两个交叉条件。发现并修正：评测按钮右侧与意见浮钮相交；正常请求已备好时，空白区却要求“先改条件”。修后改为“确认或调整条件”；按钮与浮钮的边界已分开。独立对照也确认调度文件入口/结果连贯，以及反例测试后真实结果和返回输入可达。开发服务器 HMR 曾使会话重置，该事件单独记为采集环境，不当成产品缺陷。

所有独立判断都只是 AI 试玩与可见证据，不能外推真人喜欢程度或实际学习迁移。小范围/完整范围的反例两档，以及更紧的工作队列约束，其主观难度差异仍需试学观察；不声称三档认知负荷已做真人量化。


## 验证范围与保留项

维护回归现共34条唯一用例：基础P11、完整AI玩法Q13、新易玩度/三档R10。最终分批确认全部通过。R包含十种默认入门的手机首动作（两模式）、两个情境的8条AI入门完整流程、原型客户变更、30种档位组合的可达/身份、混合难度连玩，以及新增业务条件下的返工/评测挑战。中途失败的首屏位置、误导提示及脚本旧定位已分别修正并留下原始回执；不将分批通过写成同一整批零失败。

单元/规则层为全部20个family、60份载荷保留可执行解；挑战程序的原路径会漏新增检查点、评测只有四类题会缺交叉条件、返工旧改约/一次重开证据不足，都有负例。默认引导仍保留失败和重新操作；收货按钮在当前阶段必要条件满足后出现，测试也按这一真实流程核对。

档位是课程作者逐个练习作的选择，并不按系列序号自动上调。真人“玩进去”的速度、主观难度和学习迁移仍需要实际试学；这里可验证的是入口位置、可见反馈、明确下一步、状态真实性和任务合同。


## 完成回执 · 2026-09-08

- `pnpm verify` 全部通过：2108 个 Vitest 用例及脚本自测、类型/lint/格式、边界、内容、双模式构建和文档治理。另以仅作用于 source check 的环境变量核对4份导出与真实课程相符。没有把真实源覆盖变量带进测试进程。
- 34条唯一浏览器回归分批确认通过；正式 delivery 构建另通过3条维护用例，覆盖十种手机首动作、30组合与混合难度连玩。原始摘录：[浏览器检查](play-usability-evidence/browser-checks.txt)、[正式预览](play-usability-evidence/production-smoke.txt)。完整回执：[verify](play-usability-evidence/verify.txt)、[真实课程源](play-usability-evidence/source-freshness.txt)。
- 最终前后截图来自同一工作区、同一21996 URL、1280×900/390×844和night主题。后图选进阶以尽量保持原任务需求；默认入门的实际完整流程另由R验证。采集会等待精确的data-activity身份，排除早期标签切换未完成的错误帧。度量按真实可见/可用控件和视觉位置排序，滑块也算控件；不将y坐标当成人的阅读时间。[原始度量](play-usability-evidence/entry-metrics.json)。
- 五个 AI 进阶入口从约996/975/1308/1051/1338px，前移到524/567/656/679/535px（依次原型、装箱、Agent、评测、返工；390×844）。原型、装箱、Agent、评测初始游戏区均只突出一个动作。此数字是页面位置事实，不证明真人学习效果。
- [独立 AfterCritic](play-usability-evidence/after-critic.txt)与[难度架构审查](play-usability-evidence/difficulty-review.txt)保留不同角色的结论和边界；开发URL复核与最终静态URL截图没有混作一次像素差分。

| 同档位手机入口 | 改前 | 改后 |
| --- | --- | --- |
| 原型 | [前](play-usability-evidence/before-ai-brief-phone.png) | [后](play-usability-evidence/after-ai-brief-phone.png) |
| 装箱 | [前](play-usability-evidence/before-ai-context-phone.png) | [后](play-usability-evidence/after-ai-context-phone.png) |
| Agent | [前](play-usability-evidence/before-ai-agent-phone.png) | [后](play-usability-evidence/after-ai-agent-phone.png) |
| 评测 | [前](play-usability-evidence/before-ai-eval-phone.png) | [后](play-usability-evidence/after-ai-eval-phone.png) |
| 返工 | [前](play-usability-evidence/before-ai-repair-phone.png) | [后](play-usability-evidence/after-ai-repair-phone.png) |
| 接线 | [前](play-usability-evidence/before-connect-phone.png) | [后](play-usability-evidence/after-connect-phone.png) |
| 调参 | [前](play-usability-evidence/before-tune-phone.png) | [后](play-usability-evidence/after-tune-phone.png) |
| 反例 | [前](play-usability-evidence/before-hunt-phone.png) | [后](play-usability-evidence/after-hunt-phone.png) |
| 调度 | [前](play-usability-evidence/before-dispatch-phone.png) | [后](play-usability-evidence/after-dispatch-phone.png) |
| 指令 | [前](play-usability-evidence/before-program-phone.png) | [后](play-usability-evidence/after-program-phone.png) |

[返工挑战的实际对照](play-usability-evidence/challenge-repair-0.png)、[偏好两次重开](play-usability-evidence/challenge-repair-1.png)、[评测交叉条件](play-usability-evidence/challenge-eval-cross-inputs.png)与[挑战操作录像](play-usability-evidence/repair-challenge.webm)保留新难度的实际行为。录像由维护脚本驱动，不代表真人反应或理解速度。

固定试玩仍为 `http://127.0.0.1:21996/play-lab/ai`；另一合集 `/play-lab`。代码留在 `codex/learning-play-lab`，基线d6cd44f，供统一整合。当前API/AI配课顺序归[组件README](../../../packages/ui/src/learning-play/README.md)，视觉和提示规则归[DESIGN](../../../packages/ui/src/learning-play/DESIGN.md)。没有新增课程生成器、模型调用或真实文件/发送能力；正式配课与发布继续经过原课程CLI。
