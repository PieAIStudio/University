# ISLANDUNDER · 场景立体感执行报告

日期：2026-09-01
分支：`work/islandunder`
工作树：`/Users/yuanfei/PieAI/University-wt-islandunder`
状态：代码、截图、合同和台账已完成；未 push。

## 结论

这次没有只给飞岛底面换颜色，而是把课程岛的云、瀑布、底面和 post=on 的暗部一起处理：
云和水都是真正的闭合三维体，不是天空/云/水贴片；底面跟随每座岛自己的顶面色相；
post=on 不再把它们压成黑红块。改动没有增加渲染批次、三角形预算、纹理采样或每帧 CPU 工作。

自评：**78/100**。已经达到“有体积、可辨识、预算不涨”的目标；离参考图仍有一段差距，
主要是低模云的刻面感、近景课程岛的地形仍偏平，以及官方 island-look 判官的 ready 条件
仍与课程 `includeSea=false` 的现状不一致。

## 第一关：先拍同机位 post 对比

在任何代码改动前，先用同一 1440×900 机位拍了：

`/turing-pact/foundations-before-zero/what-is-code/who-turns-text-into-motion?shot=course-design&post=off&seed=foundations-before-zero&freeze=1`

以及同 URL 的 `post=on`。原始证据：

- [baseline post=off](/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/baseline/course-design-post-off.png)
- [baseline post=on](/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/baseline/course-design-post-on.png)

基线肉眼结论：`post=off` 已经显示云是浅色平面、瀑布是带色带的平面，所有岛底面共享一块
褐色；`post=on` 又把这个共享褐色和 AO/grade 放大成黑红暗块。也就是说，“继续调太阳光”
不是根因：光照比固定指标为 `6.6452`，真正缺的是几何体积和值域分层。

基线 `readPixels` 记录为：off 的最小通道 86、非黑像素占比 1.0000；on 的最小通道 0、
非黑像素占比 0.9895，说明 post=on 确实把一部分画面压进了黑暗区。

## 做了什么

- 新增 [`cloud-volume.ts`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/sky/cloud-volume.ts)：
  课程云使用三瓣闭合低模 bank，岛群云复用同一帮助器的球形 lobe 分支；值域渐变写入
  vertex color，几何只在 `useMemo` 创建。
- [`GridCloudLayers.tsx`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/grid/GridCloudLayers.tsx)：
  课程云仍是原有三层、7 个实例，改为闭合体 + 单材质 + `FrontSide`，不引入环境纹理采样。
- [`Underside.tsx`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/grid/Underside.tsx)：
  瀑布从 `PlaneGeometry` 改成浅盒体，保留冷色带、收窄和底部外扩；清掉 BoxGeometry 默认分组，
  仍走一个 mesh / 一个 draw。
- [`grid-palette.ts`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/grid/grid-palette.ts)：
  新增纯函数，把顶面色变成“78% 同色相暗调 + 22% 共享土色”的底面色；课程投影和
  [`WorldUndersideField.tsx`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/grid/WorldUndersideField.tsx)
  共用它，远景仍为两批实例。
- [`ao.ts`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/island/ao.ts) /
  [`grade.ts`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/island/grade.ts)：
  把整面黑压改成接触折痕，并降低暖高光、对比度和暗部 pivot，修复 post=on 的红黑裁切。
- 新增的测试守护云体积、瀑布闭合且不增预算、底面按顶面色相、AO 上限和 grade 暗部 pivot。

没有触碰 `packages/world/src/avatar/`、`packages/world/src/labels/`、
`apps/university/src/app/App.tsx` 或 `apps/local/studies/`。

## 预算实测

以下是同一 `foundations-before-zero`、同一 1440×900 机位的完整 WebGL 场景统计：

| 镜头 | 改前 calls / triangles | 改后 calls / triangles |
| --- | ---: | ---: |
| course-design | 26 / 19,913 | **25 / 19,810** |
| course-near | 25 / 19,905 | **24 / 19,802** |
| world-design | 33 / 62,261 | **33 / 62,261** |

课程云单体是 37 → **36 triangles**；瀑布是 96 → **96 triangles**。post=on 没有新增本轮
pass，仍只使用已有的 AO/grade 路径。

可见 Chrome、`document.visibilityState=visible`、`freeze=0`，每个状态 3 轮 × 180 帧：

| 状态 | 改前平均帧间隔 | 改后平均帧间隔 | 改后 p95 最大值 |
| --- | ---: | ---: | ---: |
| post=off | 16.663–16.668 ms | 16.671 ms | 18.5 ms |
| post=on | 16.666–16.668 ms | 16.665 ms | 18.4 ms |

这是显示帧间隔，不冒充 GPU/CPU profiler；预算和代码路径证明本轮没有新增逐帧计算，
浏览器测量也没有出现 60Hz 级别的回退。

## 三 seed 全矩阵

最终有效矩阵为 **180 张**：

- seed：`foundations-before-zero`、`foundations-terrain`、`identity-and-accounts`
- 课时数：6 / 12 / 24 / 41
- 形状：`arc` / `horseshoe` / `loop-around-hill` / `switchback` / `serpentine`
- 机位：`course-design` / `course-near` / `world-design`
- 全部 180 条都有 `scene`、`pixel`、`code` 统计，且页面可见；[完整 metrics.json](/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/matrix-seeded/metrics.json)。

代表截图：

- [foundations-terrain / course-design / 41-serpentine](/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/matrix-seeded/foundations-terrain/course-design/41-serpentine.png)
- [identity-and-accounts / course-design / 41-serpentine](/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/matrix-seeded/identity-and-accounts/course-design/41-serpentine.png)
- [foundations-terrain / course-near / 6-arc](/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/matrix-seeded/foundations-terrain/course-near/6-arc.png)
- [identity-and-accounts / world-design / 41-serpentine](/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/matrix-seeded/identity-and-accounts/world-design/41-serpentine.png)

代表图先于数字复核：课程云是有顶部/侧面/底部明度差的低模体，瀑布有厚度和下缘，
远景继续是天空负空间而不是连续海板。矩阵的 `__islandLookMetrics().ready` 仍为 false，
因为当前课程 weather 不提交可见 sea，但判官仍要求 `island-look-aerial-plate` 的材质信号；
这是已有的判官/场景契约问题，本轮没有伪造 ready，也没有把空像素当通过。

## 台账与长期记录

- `f7bf257435aa` 已标记 `fixed`，由
  `island-geometry.test.ts::keeps each projection's underside in its own palette family` 和
  `world-underside.test.ts::keeps the remote world underside in two instanced batches` 守护。
- 简报提到的 `5af5df4513e8` 在当前 `e2e/experience-ledger.json` 中不存在；没有凭空新增或
  标成 fixed。`pnpm check:experience` 结果为 29 findings、24 fixed、5 open。
- 已把“闭合低模体 + vertex value ramp 在不涨运行时预算下恢复体积感”的可复用经验写入
  [`closed-low-poly-volumes-restore-depth-without-a-runtime-budget-increase.md`](/Users/yuanfei/PieAI/University-wt-islandunder/docs/reference/learnings/workflow-issues/closed-low-poly-volumes-restore-depth-without-a-runtime-budget-increase.md)。
- 已更新 [`island-look-contract.md`](/Users/yuanfei/PieAI/University-wt-islandunder/docs/reference/execution/island-look-contract.md)，
  明确记录本轮推翻的“课程瀑布不改”和“继续调灯即可解决平感”两个结论；同步生成了
  `docs/governance/MANIFEST.yml`。

## 验证结果

通过：

- `pnpm --filter @pieai/university-world test`：49 files / 327 tests
- world typecheck、lint、format check
- `pnpm docs:check`：89 docs、0 warning
- `pnpm check:experience`
- 完整 `pnpm test`、边界检查、build、canvas registry、shelf、content revision 等步骤

标准 `pnpm verify` 在最后的 `check-export-freshness` 失败：工作树当前外置的
`apps/local/studies/turing-pact/study.json` 声明 active，但它没有可用的 active default course，
因此 exporter 报 `Study has no active courses: turing-pact`。这是现有本地学习数据状态，且任务
明确禁止修改 `apps/local/studies/`；此前 verify 的所有本轮相关步骤均通过，docs check 单独重跑已绿。
