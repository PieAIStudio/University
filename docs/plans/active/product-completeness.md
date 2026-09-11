---
id: PLAN-PRODUCT-COMPLETENESS
title: University 产品完整性实施
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-09
last_reviewed: 2026-09-11
domain: product
tags:
  - onboarding
  - commercial-readiness
related:
  - REF-PRODUCT-COMPLETENESS-REVIEW
  - REF-CURRENT-WORK
---

# 产品完整性：让开始、学习、保存和收费说同一种话

工作树 `University-product`，分支 `codex/product-ux`，起点 `cea753e27e3c5196936ee30bf6a498aff8496c38`。2026-09-11 用户明确授权收尾、提交并推送本分支，交给集中整合。只处理本树，不改主目录、课程/视觉工作树，不发布或启用真实收费。下文旧轮次中“未提交/不提交”的描述是当时边界，不再是当前暂停指令。

## 集中整合交接入口

本批不再扩展功能。交接目标是一个可取得、可复测、依赖清楚的产品分支，不是已经完成全产品联合验收的主线。

### 本批要保留的成果

| 范围 | 合并时必须保留 |
| --- | --- |
| 欢迎、会员与设置 | 简短主张、真实课程入口、按需展开细则；不恢复常驻“尚未开售”等开发告示。价格、周期、另付费用仍在购买决策位置 |
| 学习信任 | 三态判题、未提交答案防丢、按账号/题目/版本隔离、真实保存失败与重试；不把不能判断改回答错或直接通关 |
| 日常操作 | 搜索、任务直达、三题可选回合、个人成长；答题时收起准备区，第三题先保留解释，再由用户确认结束 |
| 安全边界 | 付款报价/周期核对、订单恢复、账号隔离、订阅管理入口；默认不广播学习活动；不让截图或前端状态授予权益 |

### 接手步骤

1. 取得本分支的已提交版本，与产品线给出的提交编号核对；不要复制未提交目录代替合并。整合在独立工作树进行，由一位整合负责人处理冲突。
2. 阅读 [V5 当前产品决定](../../reference/player-journey/v5/index.html#product-lightness) 与 [实际改前改后](../../reference/execution/product-before-after/before-after.md)。以下历史记录仅在追查证据时阅读。
3. 合并代码与测试后，按依赖整合课程线的完整 `activities` 合同及视觉线；不能整文件选 ours/theirs、删除活动字段或关闭校验来消除冲突。
4. 新组合完成后，重新跑 `pnpm verify`、默认双模式 `pnpm e2e`，以及明确指向最终课程源的 `pnpm check:export-freshness`。验证从新地图进入新课程、活动、答题、保存、返回的完整路径，再纳入主线。此分支的专项结果不替代这一步。

### 冲突检查地图

| 文件/目录 | 整合时的重点 |
| --- | --- |
| `apps/university/src/app/App.tsx`、`MainRouter.tsx` | 保留欢迎接入、真实课程导航、账号切换的组件身份；同时接回视觉线的新地图与外壳，不复制第二份 App |
| `apps/university/src/screens/LessonScreen.tsx`、`packages/ui/src/review/ExerciseBlock.tsx` | 课程线的新互动显示与本分支的草稿/判题/账号保护必须同时存在 |
| `packages/core/src/ports/`、`progress/`、`packages/backend/src/` | 不能退回两态判题或未隔离缓存；迟到请求不得写入另一个账号 |
| `packages/ui/src/practice/`、`review/ChoiceBlock.tsx`、`cta/liquid-cta.css` | 保留第三题解释、焦点转移、可读的禁用按钮、手机底部可点击空间与减少动效 |
| V5、`e2e/experience-ledger.json`、文档 MANIFEST | 合并产品决定与按 ID 去重的发现；MANIFEST 在整合后重新生成，不机械选一边 |

### 文件与输入边界

源代码、测试、正式对照文档及其 `images/` 随分支交接。原始审查和迭代截图保留，不把旧候选图当最终效果。HTML 是同目录 Markdown 的阅读版。

`apps/university/content`、`apps/local/studies/studies`、`.scratch/` 是本机生成/测试输入，不随 Git 自动传递。`apps/local/course-proposals/recovery` 中的已发布恢复包属于已有基线，本批不改课程内容或导出索引。接手同机时保留本工作树，按只读方式使用必要输入；换机须通过项目已有恢复/构建流程物化，不能只拉代码后把课程 404 当 UI 回归。

新增可提交的专项入口 `pnpm e2e:product`：先构建当前 App，再在未占用端口运行，例如 `E2E_ONLINE_PORT=21898 pnpm e2e:product`。它自行启动真实 delivery 预览并跑 T/U/V，不依赖旧 `.scratch` 配置、不复用未知服务，不替换默认 E2E 或 pre-push。

本次另保留本机发布版本测试源 `.scratch/product-handoff/e2e-studies`：`browser-ai` 由现有 `course recovery import` 从 Git 中的发布恢复包还原，其余三学科的课程/来源/快照来自原隔离检查副本，未复制学员数据库。四学科均通过独立导出新鲜度检查。这只证明本分支与自身发布版本一致，不冒充兼容课程线尚未合入的新活动格式。

在本机独立复跑默认双模式检查时，明确使用 `E2E_STUDIES_ROOT="$PWD/.scratch/product-handoff/e2e-studies" pnpm e2e`；整合完课程线后必须改用最终课程源。不要全局设置 `UNIVERSITY_LOCAL_STUDIES_ROOT` 后跑单测。源包新鲜度单独用 `UNIVERSITY_LOCAL_STUDIES_ROOT="$PWD/.scratch/product-handoff/e2e-studies" pnpm check:export-freshness` 检查。

恢复工具另有一个已复现的基线问题：对 `turing-pact` 的全新恢复在 `foundations-before-zero` 报 `Recovered course failed canonical verification`。本次没有放宽恢复一致性检查，也没有继续用这个半完成副本；实际验收使用上述已通过四学科新鲜度的独立输入。跨机器交接课程应取得课程线的完整源包，不假定只拉 Git 就能恢复全部私人来源。

### 整合前已知边界

- 本分支读取最新课程线的 `browser-ai.activities` 仍会失败；需完整合入活动载荷、校验、渲染与导出，不是删一个字段。产品独立复测应使用与本分支已发布恢复包一致的输入；最新课程联合验收另算。
- 原 G.avatar 真实浏览器转向时间曾超门槛，需与视觉线在最终组合上重新测；不能用通过的世界单测代替。
- 真账号跨设备、真实支付/取消/退款、实体手机及次日提醒未在本批验收。不因推送分支自动发布，不编造经营或退款条款。

### 交接收尾记录

文件清点、可复跑入口和最后验证正在本次收尾中归并；最终状态以本节后续记录及 Git 实际提交/远端引用为准。历史 `.scratch` 日志只作为本机追查线索，不能要求接手者拥有它们才能理解交付状态。

## 实施与验证历史（按需追溯）

行为权威是 [V5 产品完整性决定](../../reference/player-journey/v5/index.html#product-completeness)。[三轮检查](../../reference/execution/product-completeness-review.md) 是原始发现，不作为另一份待办。以下是唯一实施状态表。

给产品负责人的直观看图入口：[改前／改后图文对照](../../reference/execution/product-before-after/before-after.md)。它是本次实施结果的截图说明，不替代本计划的验收状态。

| 编号 | 交付范围 | 状态 |
| --- | --- | --- |
| U1 | 三态判题；无法判断不记错、不通关；输入按身份/题目/版本恢复 | 本机实现与专项验收通过；三尺寸刷新、提交后恢复及判题反馈有正式包证据 |
| U2 | 真实发布路径的可跳过欢迎；短揭幕、直达与回访不拦截；最小统计 | 已接入并验证；首次/回访/直达、键盘退出、减少动效通过，不是四页强制引导 |
| U3 | 课程搜索与起点、任务动作、三题练习、成长命名与通用档案 | 本机实现通过；搜索与任务实际进入课程，练习单测检查三道不同题的结束点 |
| U4 | 价值与费用分层；周期进订单；管理取消入口与付款保护 | 客户端合同保留；按用户修订撤销常驻开发告示，真实收费未启用 |
| U5 | 本机/账号/同步说明、默认不共享、反馈/提醒诚实状态、可读性 | 本地状态/隔离测试通过；整页检查补修首页标题与顶部地标，真机跨设备和提醒送达未验收 |
| U6 | 聚焦红绿测试、完整 verify、默认 E2E、真实浏览器截图和复核 | 专项和分层检查已收束；完整双模式浏览器验收仍受下文课程合同与转向时长问题阻塞，计划保持 active |

## 刻意收窄的方案

不强制四页引导，不把编程小游戏塞给所有学科，不新增课程写入者。不重画地图，不删全局导航；先靠明确的入口和动作减少寻找。不会承诺精确体验时长或转化增长。

## 不能靠这个前端工作树假装完成的部分

真实支付/取消/退款与到账回调归 SwimmerBackend 和支付服务；经营主体、适用条款、退款政策与客服联系方式由负责人确认。云同步、AI 和提醒的真实跨设备/送达验收须有对应账号与设备证据。这里完成本地契约、诚实状态与拦截，不伪造服务。课程前段的互动由课程线生产，读取已发布内容，不直接改写或重导出。

## 验证记录

以下记录本次恢复后的实际结果，不用原审查的 23 项测试代替实现验收。收据统一位于 `.scratch/product-audit/`；可保留的实际画面在 [实现证据](../../reference/execution/product-review-evidence/implementation-independent/post-recovery/)。

| 范围 | 本次结果与边界 | 回执 |
| --- | --- | --- |
| 所有工作区单元测试 | core 594、backend 6、grading 27、UI 487、local 457、world 872、app 247，共 2690 项通过；原生 Node 测试另有 2 项通过 | `resumed-verify-bounded.log` |
| 最后补修的页面结构 | AppShell、UniversityShell、通用档案与账号共 28 项通过；新增断言覆盖顶部地标与会员同步说明 | `resumed-shell-tests.log` |
| 正式包专项浏览器 | 同一份 T1–T4 共 10 项全部通过；1440×900、390×844、320×740，含首页与欢迎整页 Axe | `resumed-product-green.log` |
| 独立逐屏复核 | 37 项检查通过、37 张截图，0 失败；含刷新保留答案、三尺寸七个页面及深色减少动效欢迎。手机为模拟视口，不是真机 | `resumed-visual-proof.log`、证据目录 `independent-review.json` |
| 断言是否真能发现问题 | 隔离页面临时注入错误进度标签、旧低对比文字色、移除同伴语义，三项均能报错，恢复后均通过；不改产品源文件 | `resumed-assertion-attacks-green.log` |
| 构建与静态/产物检查 | 整仓构建、双模式编译、typecheck、lint、format、generated-format、boundaries、canvas、review-cards、experience、shelf、public-boundary、catalog、content-revisions、lesson-links、bundle 均另行通过 | `resumed-final-build.log`；DevSpace session 2518 退出 0 |

**整条 `pnpm verify` 不能记为退出 0。** 这次限制并发的完整命令跑完所有单测后，因新增 CSS 改变了旧颜色登记的行号而退出 1。随后把无颜色的新样式移到文件末尾，恢复原登记定位；最后相关单测、构建及上表全部静态/产物检查通过。没有放宽颜色规则或增加豁免。这是分阶段完整收据，不是一次整包全绿。完整源课新鲜度与双模式浏览器问题仍见下文。

## 保留的关键修正依据

支付 B6–B8、发送答案前的账号切换、阅读段数标签均有先红后绿的收据，分别为 `recovered-payment-{red,green}.log`、`recovered-token-race-{red,green}.log`、`recovered-reading-label-{red,green}.log`。最后一次整页扫描又发现首页缺一级标题和顶部状态不在地标内，见 `resumed-product-final.log`；修复后的同一检查见 `resumed-product-green.log`。不能把只检查局部组件的旧扫描说成整页通过。

测试入口也修正了一处：`kenney-grid-bake.test.mjs` 使用 `node:test`，不能交给 Vitest；现在包级 test 先跑 Vitest，再调用已有 `kenney:grid:test`，不是删掉两条断言。原 App 进度条断言同步更新为实际的“阅读 2/3 段”。

前轮 world 性能测试失败仍保留在 `recovered-verify.log` 和 `recovered-world-budget-recheck.log`。本轮第一次全量运行另有两条作者工作流超时；在 `VITEST_MAX_WORKERS=1` 下单独重查 23 项通过，再跑完整验收，world 872 项和 local 457 项全部通过。50 岛为 354.73 ms，低于原 500 ms 上限。没有修改渲染器或提高时长门槛；并发控制改变的是验收调度，不是产品性能承诺，也不代表真实浏览器转向门槛已通过。

## 仍待整合的两项验收问题

**课程格式整合。** 独立课程快照 `.scratch/product-audit/e2e-studies` 的 `browser-ai` 已带 `activities`，本分支的 `LessonManifestSchema` 尚未支持完整合同。实际 `GET /api/studies/browser-ai` 返回 400；如 `chat-ai-versus-doing-ai/revisions/3/manifest.json`。明确指向真实快照的源课新鲜度检查也失败，回执 `recovered-export-freshness.log`。应与课程线完整对齐“活动载荷→验证→显示”，不能删除课件字段或放宽 strict 校验。测试快照通过 `E2E_STUDIES_ROOT` 注入，不修改原课程；作者服务仍保留目录保护。

**真实浏览器转向时间。** G.avatar 前轮实测 750 ms，超过 540 ms 上限，本轮未重测通过。默认双模式 E2E 的最终收据仍是 128 项中 18 通过、7 失败、1 中断、102 未运行（其中六个失败由上述作者书架合同引起）；日志 `recovered-default-e2e-3.log` 退出 130。新版专项 T10 使用正式 delivery 预览，不冒充这套默认回归全绿。

## 恢复状态与继续入口

## 2026-09-10 轻量化 UIUX 五轮

用户认可原功能改动，要求撤下开发阶段告示、减少常驻解释，保留正式商业产品的吸引力。本轮仍在同一工作树、不动课程/视觉工作树，不提交或发布。以 V5 的 product-lightness 修订为准。此前不开售常驻告示的决定已被本轮取代，真实付款与保存保护不回退。

| 轮次 | 实施与复核目标 | 状态 |
| --- | --- | --- |
| L1 | 欢迎与会员：主张、主要动作、完整价格；移走开发告示 | 已实施、拍照复核 |
| L2 | 答题与保存：一个结论，正常状态轻，异常明确 | 已实施、刷新与提示展开检查通过 |
| L3 | 练习、任务与成长：动作优先，规则展开，真实短庆祝 | 已实施；修正短页面把顶部状态栏撑大的布局问题 |
| L4 | 档案与设置：按需说明；手机、键盘、减少动效复查 | 已实施；当前会员、隐私范围与实际媒体偏好均复查 |
| L5 | 跨屏回归、反例测试、文字量与真实截图对照、文档收口 | 本轮 UIUX 修订完成；25 项实际浏览器检查通过，对照文档与动图已更新 |

每轮的截图与测量写入 product-review-evidence/lightness/，最终给用户的入口继续使用 product-before-after/before-after.md，不另造一份长期待办。

### 轻量化最终收据与范围

后续用户要求继续优化并自查，F1 操作连续性复核已完成：准备页只在开始前出现，答题与结束分别聚焦；第三题保留解释，由用户确认结束；词条按需展开，手机底部入口可实际点击；看图后补修共享提交按钮的禁用可读性。仍保留三态判题、题库、费用与存储合同，没有修改主目录或其他工作树。

#### F1 本轮自查结果

本轮原图和逐步记录位于 `product-review-evidence/focus/{before,after,final}/`。`after` 是第一次候选版，不是最终交付；同一道实际题目、同主题和同尺寸对比。390 宽下题目顶部约 454→191 px、提交底部 895→603 px、按钮宽度 66→316 px，字号未缩小。第三题反馈保留及焦点转移按真实操作核对，不把一次截图当成功能证明。

| 检查 | 结果 | 回执 |
| --- | --- | --- |
| T/U/V 浏览器回归 | 33 项通过，含 320/390/1440、浅深色、真实减少动效、键盘、词条展开、最后一题反馈和禁用→启用外观 | `.scratch/product-focus/acceptance-final.log` |
| 所有模块单测 | core 594、backend 6、grading 27、UI 489、local 457、world 872、app 247；共 2692 项通过，Node 原生另 2 项通过 | `.scratch/product-focus/verify.log` |
| 最终局部复查 | 练习、ChoiceBlock、共享 CTA 等 36 项通过；双模式最终构建通过 | `targeted-final.log`、`build-delivery-final.log` |
| 先红后绿 | 原页面的题目挤压、第三题反馈丢失、禁用文字均先复现失败，再用同一守卫确认修复 | `red.log`、`final-answer-red.log`、`disabled-red.log`、`acceptance-final.log` |

`pnpm verify` 本次已走完全部单测、边界、构建与发布目录检查，仍在既有源课新鲜度处退出 1：`browser-ai.activities` 尚未与本分支的完整课程合同整合。没有放宽该门槛或删除课件。最后提交按钮仅改包装层 CSS，其后的 36 项局部测试、33 项浏览器与最终构建另行通过；不把这批证据称为一次从头到尾的发布全绿。后续源课整合与默认双模式 E2E 仍按原待办继续，不属于本轮 UIUX 未完成。

本轮五轮 UIUX 修订已经完成，不等于整产品已发布或真实支付已经联调。最初“尚未开售”告示及反复解释已按用户决定撤下；价格、计费周期、额外 AI 费用、失败状态、取消管理与身份隔离保护仍在。

| 检查 | 实际结果 | 收据 |
| --- | --- | --- |
| 既有 T 加新增 U 浏览器检查 | 25 项通过；390×844、320×740、1440×900，含草稿、搜索、任务、付款失败、当前主动作可达、深色、键盘、真实减少动效和三题完成 | `.scratch/product-lightness/browser-acceptance.log` |
| 所有模块单测 | core 594、backend 6、grading 27、UI 488、local 457、world 872 通过；最后修正 App 旧成长文案断言后 App 247 通过，共 2691 项；原生 Node 测试另有 2 项通过 | `verify-complete.log` 的前六模块；`app-final.log` 的最终 App 与 Node 结果 |
| 最后源代码与产物检查 | typecheck、lint、format 已在末次整跑通过；修正的 App 文案断言未改变运行时代码。另行 boundaries、canvas、review-cards、experience、shelf、public-boundary、catalog、content-revisions、lesson-links、bundle 以及整仓双模式 build 均退出 0 | `.scratch/product-lightness/final-checks/`、`all-build-final.log` |
| 最终实际画面 | 20 张截图，0 页面脚本异常；含展开费用、三题过程/结束、深色设置；图文入口新增 10 张最新对照/展开图片 | `product-review-evidence/lightness/final/receipt.json`、`product-before-after/image-manifest.json` |
| 动效证据 | 实际答完三题后，对真实 650ms CSS 奖杯动画逐帧采样，生成一次播放 GIF；非另绘动画、非虚构进度 | `product-review-evidence/lightness/final/motion.json` |
| 文档收敛 | 最新对照保留原入口；第一轮对照改为有明显历史标注的 `first-pass-comparison.md`，旧图未丢失。manifest、链接、audit/doctor 通过 | `.scratch/product-lightness/docs-final.log` |

默认显示的主内容字符数（除空白、折叠详情未展开）：欢迎 130→76、会员 455→153、练习 216→61、任务 163→57、成长 139→44、设置 547→116。相同地址、尺寸、主题；这是界面文字测量，不是转化率或阅读时长实验。

**仍不能把完整 `pnpm verify` 写成退出 0。** 末次整跑 `verify-complete.log` 在 App 中一条旧文案断言处失败；该断言已更新为实际个人成长语义及详情默认折叠，整个 App 247 项随后通过。后续静态和构建检查另行全部通过，但源课新鲜度仍因前文既有 `browser-ai.activities` 合同未整合而失败（`source-freshness-final.log`）。没有删除课程字段、改松校验或把专项 25 项浏览器检查冒充全套双模式 E2E。计划保持 active 的原因是这些已有整合/发布事项，不是五轮 UIUX 尚未执行。

本轮反例过程还保留了两项纠正：短页面初次删字后顶部状态行被拉高，已用固定内容行及 U3 几何断言守住；最初 U7 环境没有真正进入减少动效，诊断确认后显式设置并断言 `matchMedia`，再验证无动画及正常模式单次动画，不用测试配置声明代替实际状态。

DevSpace 已能读写、运行和返回验证结果；前轮工具中断不再作为暂停理由。只由本会话整合，没有新并行写入者。保留初次审查、失败收据和当前代码；没有提交、推送、发布或开启收费。

下一步从上述课程合同和 G.avatar 两项整合开始，再运行默认双模式浏览器验收及明确源目录的新鲜度检查。不要重做已通过的欢迎、草稿和支付前端，也不要用已发布包检查替代源课检查。真实服务和经营信息仍按上文边界单独验收。
