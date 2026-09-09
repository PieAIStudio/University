---
id: ARCHIVE-CONTINUOUS-WORLD-R26-R33
title: Continuous World Delivery Evidence R26–R33
type: archive
status: archived
canonical: false
owner: ai-assisted
created: 2026-09-08
last_reviewed: 2026-09-08
domain: web3d
tags:
  - execution-history
  - evidence
related:
  - PLAN-CONTINUOUS-WORLD-DELIVERY
  - ARCHIVE-CONTINUOUS-WORLD-R01-R25
  - ADR-0008
  - ADR-0009
  - REF-LOCAL-DEVICE-TESTING
pinned: false
---

# R26–R33：历史证据，不是接手指令

2026-09-08 从活动面板、三版交接及重复专项报告提炼。这里只保留追溯所需的
变化、反例和证据入口；当前状态只看[唯一面板](../../plans/active/continuous-world-delivery.md)。
原始测试日志、失败截图、trace、CPU profile 和设备收据留在原路径，没有因文档整理删除。
以下结果均属于当时源码快照，不是最后版本的通行证；路径相对项目根目录。

R28交接目录的校验日志和hash/状态快照已移至
`.devspace-visual/documentation-history/r28-handoff/`，不再夹在接手入口旁。
较早的长篇代理诊断归入 `SCRATCH/archive/continuous-island-reviews/`，仅按需追溯，
不作为当前缺陷或所有权证明。最早的patch/源码tarball仍作事故恢复材料保留，未重放。

## 阶段证据

| 阶段 | 已记录的变化与验证边界 | 原始证据入口 |
| --- | --- | --- |
| R25（参照） | 正式头像 registry 0.5.1 已接入，完整 verify exit 0；G 转向 685.3ms 超原 540ms，G/N 合计 3/4。旧临时包及“尚未发布”交接失效。 | `.devspace-visual/tooling-closeout/verify-final.log`、`verify-exit.json`、`browser-results/` |
| R26–R27 | 压缩启动文档，128 项当时 62 已勾/66 未勾逐字保留；107 文档检查通过。移除旧项目反馈技能登记；Android 配对 TLS 页面读取成功，尚非触摸验收。LAN 20000 从可达变为无监听，未确定退出原因。 | `docs/archive/execution/continuous-world-delivery-through-r25.md`；`.devspace-visual/device-readiness/android/`；工具恢复只读现行设备参考 |
| R28 | V5 M 明确同层级多领域星球；四个系列不是四颗星球，多领域合成夹具不得冒充上架课程。交接 HEAD c199f2e、当时远端 3D e387e20/main 4da3605；只做文档交接，未新增产品通过。 | V5 决定 M；旧交接的重复正文已移除，事故恢复材料单独保留 |
| R29 | 同源 worker、领域布局/空领域、自然岛体、营火与检查器候选。首手势 AudioContext 构造约 162ms；静默准备后转向 688.7→515ms，门槛未改。G/L/M/N/O 定向 21/21，不是完整 default。 | `.devspace-visual/astra-r29/ordinary-chain/results.json`、`profile-before/`、`profile-after/`、`domain-before/`、`domain-after-worker/` |
| R30 | 共用系列布局、课程有效总览、云载体净距、检查器位置与未知量修复。声音所有权/失败解锁重试 17 项、检查器 24 项、技术锁 9 项各有专项通过。浏览器 23/27：转向 574.5ms，另三项标签碰撞。 | `.devspace-visual/astra-r30/browser/results.json`、`targeted-models.log`、`ordinary/`、`production-before/` |
| R31 | 修复隐藏世界同步生成、pointerdown 提示退场丢失 click、worker 旧回调及资源归属。G 原上限连续三次通过，O 原九项通过；完整 default 65/67，F 修复后另跑 2/2，不可相加称全量全绿。 | `.devspace-visual/astra-r31/default-suite/output.log`、`pick-regression/output.log`、`commit-clock/output.log`、`ordinary-fixed/` |
| R31 设备 | Redmi 竖屏 13 步通过；后续横屏长名称压力仍 INCOMPLETE，驱动了选择栏滚动修复。 | `.devspace-visual/astra-r31/android-portrait-r2/receipt.json`、`android-landscape-final-stress/receipt.json` |
| R32 首轮 | world 773/776。暖缓存 24.3ms/拓扑 60s 超时单独复跑通过（2.4ms/36.25s），移入已有串行组，原 20ms/60s 限制不变；短课零岩石反例单跑仍失败，修复搜索预算与景物数量耦合。 | `.devspace-visual/astra-r32/verify.log`、`isolated-exit.json`、`cache-isolated.log`、`rocks-before.log`、`geometry-isolated.log` |
| R32 第二轮 | world 82 文件/776 项及产品检查、双模式构建通过，整条 verify 因末尾文档 manifest 不同步 exit 1。之后源码仍有修改。源新鲜度检查未证明另一工作线作者源已复核。 | `.devspace-visual/astra-r32/verify-r2.log`、`verify-r2-exit.json` |
| R32 设备 | 真实 Redmi 四领域×30 系列长名称横屏 15 步/竖屏 17 步通过；竖屏含可信 CDP 注入平移/双指缩放、真实前后台同 scene 恢复，恢复路由/方向/reverse 并移除临时 forward。 | `.devspace-visual/astra-r32/android-landscape-stress/`、`android-portrait-stress/` |
| R32 看图修复 | 五门真实课程 3/4/12/19/41 节、两视口采样 9 组完整通过；41 节桌面额外学院取景失败保留。发现错误主题替身巨型喷泉、岩根折叠、状态不明，新增反例后修复。几何16+有向边4+DOM3=23/23；随后测试类型输入又有修正。 | `.devspace-visual/astra-r32/courses/receipt.json`、`course-review.log`、`new-visual-regressions.log`、`geometry-contract-final.log` |
| R33 | 同一大岩石因 landmark 身份仅留 0.42 半径，真实约 1.729；未知模型也被猜为安全。修复真实占地、整底面极值及组内间距。新增7项通过，摆放22/23，合计29/30；短长树数9/9，短课容量改后仍待复验。 | `.devspace-visual/astra-r33/outpost-before.log`、`outpost-r1.log`；当前接续见面板 |

R32 设备 DPR 2.75、渲染 DPR 1.5、帧间隔 p95 约 17.9–19.3ms 是历史记录，
不等于 GPU 时间、VRAM 或人工手指验收。iPhone 未完成项不能由 Android 或 WebKit 模拟覆盖。

## 专项审查中仍值得保存的判断

| 原报告组 | 保留的结论及承接位置 |
| --- | --- |
| inspector / final-review / inspector-closeout | 中间的 `layoutStudyRoad` 回退不是生产 catalogue 位置，最终改为传真实 id/position；缺失或重复数据保持 unknown，world 不列课程树冠零实例旧行。R30 的修复/24项通过不能代替最后 L 浏览器验收；由 P05/J12 承接。 |
| natural-root / root-final | 宽缓地形、坡度海岸、五圈岩根不增加远景640三角。早期“逐三角翻面修复底面”仍会折叠，已被 R32 同 kernel 收敛、有向边检查替代；不要恢复旧算法或其中的临时超时参数。技术理由已在 ADR-0008。 |
| world-audit / placement-closeout | `lit`/`idle`、火焰锚点、累计有效 delta、leaf 退役、实际降级集合均有实现。生产营火固定 lit、无空间时 open-meadow 均可合法；不能为凑功能制造闲置火或替代物。D05/D11/D13 仍以后续反例为准。 |
| technique-closeout | 生产远景只有 RemoteIslandField/RemotePropsField；旧396三角 donor 树干+锥体不是第二预算。规划 `planIslandDressing(...,"world")` 可用于数据子集，不等于生产 renderer。依据在 ADR-0008/0009 与锁测试。 |
| tooling-readiness / tooling-closeout | 旧“头像未发布、Blender未安装、需要修私有DS桥接”的安排已失效。WebKit 两项当时虽通过，拉远图仍只有天空，说明测试绿不代表构图绿；课程总览后由 R30/R31重新实现验收。可选工具详情仍在设备参考及本机工具报告。 |
| documentation-consolidation | R26曾将 current-work 386→72行、ADR-0008 498→118行，旧全文已归档；不是本次整理的新成果，也不证明 R33产品通过。 |

其中营火原点来自木堆 AABB 高度分数 0.55，并非扫描煤面；普通画面仍须核对火焰接触。
侧壁着色顶点可以坐标重合而不共享索引，有向边/实际表面而非索引复用才是该生成器的闭合依据。
早期别名/fallback、退役 world 路径、DOM/球体排序意见均须结合最新代码，不按旧行号重做。

## 中断与状态修正

R29/R31曾出现“未读/未改/未测”的错误聊天总结，后被磁盘和测试回执推翻。
反过来，文件名含 final/closeout 或子代理自报完成也不是验收。
R32面板曾到81项；重开D05/D13、关闭G07后为80；R33重开D11后为79。
这些变化是证据纠正，不是缺陷被删除。具体128项只保留在活动面板，不复制到这里。

历史拒绝：R30阶段Git写入与标签探针、R32最后类型/格式/浏览器采集、R33地形和容量复验。
未通过CLI/另一模型/改写脚本绕过；R32 `courses-final-exit.json` 当时实查不存在。
R33 Gemini只读审查超时，无最终报告。旧worker状态、PID、会话ID不构成当前所有权。
当时 HEAD 一直为c199f2e，暂存为空，无新增产品提交/推送；当前 Git 必须重新查询。

本档案不指示重试被拒操作或等待旧代理。工具/权限问题按当下明确回执处理，
停止具体被拒动作，继续独立且获准的工作；不要把一次拒绝当作全部工作区不可访问。
