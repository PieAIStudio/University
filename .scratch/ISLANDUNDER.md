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

---

## 2026-09-01 · round 2：把 land median 拉回 band

本轮从已有的两个提交继续：`af449f6`（闭合体积与预算）和 `3acb7cb`（课程镜头的 judge
ready 修复）均保留，没有改历史、没有 push。目标是处理 judge 第一次真正看到课程岛后暴露的
`landMedianLightness=75.7712`，同时不撤销闭合云、闭合瀑布、同色相底面、接触 AO 或预算下降。

### 先看图，再看数

本轮基线与最终图使用同一 URL、同一 `post=off`、同一 `freeze=1`、同一 `seed`、同一
1440×900 DPR 1 Chrome canvas-only 拍法；截图时隐藏 DOM overlay，避免上一轮 baseline/final
机位和画面层级不一致的问题。

- [round2 baseline · course-design · desktop](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/round2-baseline-course-design-desktop.png)
- [round2 final · course-design · desktop](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/round2-final-course-design-desktop.png)
- [round2 final · course-near · desktop](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/round2-final-course-near-desktop.png)
- [round2 final · course-far · desktop](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/round2-final-course-far-desktop.png)
- [round2 final · course-design · mobile](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/round2-final-course-design-mobile.png)
- [round2 final · world-design · desktop](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/round2-final-world-design-desktop.png)

肉眼先看到的结论是：课程岛仍然是有路线、树、蘑菇、封闭土层和瀑布厚度的浮岛；近景虽然
地面占满画面，但路线石块和每个石块的土层仍可读；没有上一轮的黑洞或红黑大块。world
archipelago 也保持每座岛的体积和青色负空间。post-on 复核图在
[这里](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/round2-final-course-design-post-on.png)，
仍没有黑洞/红块；它的 grade 仍是上一轮已经验证过的路径，没有为了 raw judge 偷改 grade。

### 本轮只改共享生成规则

改动只有三个源文件：

- [`Maps.tsx`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/Maps.tsx)：课程天空
  仍是暖色夕阳，但把会被固定画框的暖色地面候选区拉低一点：`zenith=#f97f76`、
  `mid=#f5a36f`、`horizon=#f2c397`、`nadir=#a39acd`。这是整套课程 sky stop 规则，不是某个
  岛或某张截图的值。
- [`grid-palette.ts`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/grid/grid-palette.ts)：
  新增共享常量 `GRID_COURSE_TOP_LINEAR_SCALE = 0.82`，给课程投影的非路线地表保留色相/饱和度，
  只增加一点线性明度 headroom；world 投影和路线不走这个分支。
- [`HexField.tsx`](/Users/yuanfei/PieAI/University-wt-islandunder/packages/world/src/grid/HexField.tsx)：
  同一规则同时用于课程 land layer 和非路线 bed layer。没有复制 mobile renderer，没有改
  geometry、instance 数量、路线、props 或 judge。

一次只改一个规则的实验记录：只加地表缩放时 design median 只从 75.7712 到 75.4578，说明
固定 frame 的暖色天空候选像素才是主因；天空改成较低的 mid/horizon 后，配合地表 headroom
才稳定进入 band。移动端也单独扫描过：最终规则的 course-design/mobile 为 68.1006，而不是
只让桌面绿。

### 官方 judge 原始输出

执行命令：`pnpm e2e:island-look`

下面是最终源代码这次运行到 ratchet 结论的原始 judge 表格和错误（没有改
`look-contract.ts` 的阈值，也没有改 `J.island-look.spec.ts` 的 pin）：

```text
main · course-design · desktop · 1440×900
displayDarkPixelShare=0.075768
┌─────────┬─────────────────────────────┬────────────────────────────────────────────────────────────────────────────────┬────────────────────────────┬────────┐
│ (index) │ metric                      │ value                                                                          │ threshold                  │ pass   │
├─────────┼─────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┼────────┤
│ 0       │ 'sceneLinearRange'          │ 9.173                                                                          │ 4                          │ 'PASS' │
│ 1       │ 'landMedianLightness'       │ 65.7616                                                                        │ '{"min":50,"max":70}'      │ 'PASS' │
│ 2       │ 'landP95Lightness'          │ 76.5947                                                                        │ 85                         │ 'RED'  │
│ 3       │ 'landLightnessRise'         │ 10.8331                                                                        │ 15                         │ 'RED'  │
│ 4       │ 'backgroundLightnessSpread' │ 32.58                                                                          │ 40                         │ 'RED'  │
│ 5       │ 'grassLightnessSpread'      │ 13.5193                                                                        │ 45                         │ 'RED'  │
│ 6       │ 'grassLightnessP95'         │ 68.312                                                                         │ 85                         │ 'RED'  │
│ 7       │ 'lightnessP2'               │ 26.9029                                                                        │ 25                         │ 'RED'  │
│ 8       │ 'lightnessP98'              │ 81.0237                                                                        │ 90                         │ 'RED'  │
│ 9       │ 'lightnessStdDev'           │ 13.4723                                                                        │ 18                         │ 'RED'  │
│ 10      │ 'grassHueCount'             │ 4                                                                              │ 3                          │ 'PASS' │
│ 11      │ 'grassHueSpread'            │ 116.9012                                                                       │ 35                         │ 'PASS' │
│ 12      │ 'accentArea'                │ 0.5156                                                                         │ '{"min":0.015,"max":0.15}' │ 'RED'  │
│ 13      │ 'keyToFillRatio'            │ 6.6452                                                                         │ 3                          │ 'PASS' │
│ 14      │ 'domLabelContrastMin'        │ 9.3919                                                                         │ 4.5                        │ 'PASS' │
│ 15      │ 'domLabelCount'             │ 6                                                                              │ 'null'                     │ 'PASS' │
│ 16      │ 'layerDistribution'         │ '{"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41}' │ 'null'                     │ 'PASS' │
│ 17      │ 'lessonNodeCount'           │ 41                                                                             │ 'null'                     │ 'PASS' │
│ 18      │ 'coursePropCount'           │ 328                                                                            │ 'null'                     │ 'PASS' │
│ 19      │ 'propsPerLessonNode'        │ 8                                                                              │ 7                          │ 'PASS' │
│ 20      │ 'rimPropShare'              │ 0.314                                                                          │ 0.2                        │ 'PASS' │
│ 21      │ 'landCoverage'              │ 0.803                                                                          │ 0.34                       │ 'PASS' │
│ 22      │ 'nodeOcclusionShare'        │ 0                                                                              │ 0.05                       │ 'PASS' │
└─────────┴─────────────────────────────┴────────────────────────────────────────────────────────────────────────────────┴────────────────────────────┴────────┘
  ✘  1 [island-look] › e2e/J.island-look.spec.ts:641:3 › J island look judge · fixed-pressure ratchet › 固定镜头 × 桌面/手机，输出画布 PNG 与逐项 metrics.json (11.6s)


  1) [island-look] › e2e/J.island-look.spec.ts:641:3 › J island look judge · fixed-pressure ratchet › 固定镜头 × 桌面/手机，输出画布 PNG 与逐项 metrics.json

    Error: course-design/desktop/landLightnessRise regressed: observed 10.8331, pinned 24.7634

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      379 |       ratchetPass(metric, pinned),
      380 |       `${key}/${metric.metric} regressed: observed ${String(metric.value)}, pinned ${pinned}`,
      381 |     ).toBe(true);
        at assertIslandLookRatchet (/Users/yuanfei/PieAI/University-wt-islandunder/e2e/J.island-look.spec.ts:381:7)
        at /Users/yuanfei/PieAI/University-wt-islandunder/e2e/J.island-look.spec.ts:719:11

  1 failed
    [island-look] › e2e/J.island-look.spec.ts:641:3 › J island look judge · fixed-pressure ratchet › 固定镜头 × 桌面/手机，输出画布 PNG 与逐项 metrics.json
[ELIFECYCLE] Command failed with exit code 1.
```

判官 exit 1 的原因是旧 pin，不是本轮的 median contract：首次跑通课程时 baseline 的
`landLightnessRise` 就只有 6.0097，本轮是 10.8331，方向上反而改善但仍低于历史 pin
24.7634。其它 RED 也不是被藏起来的：本次真正首次可见的课程判定把它们记录为当前历史
look debt；本轮没有用阈值或 pin 解决它们。

### 最终默认镜头数值与预算

所有课程默认镜头都用同一个 `post=off` raw canvas measuring stick；world 的画面已拍并查看，
但它没有 `island-look-aerial-plate`，所以 judge 的 `ready=false` 是已有 scene/judge 边界债务，
不能把 `pixels=null` 冒充成通过。

| 镜头 | viewport | median | p95 | rise | scene range | calls / triangles |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| course-design | desktop | 65.7616 | 76.5947 | 10.8331 | 9.173 | 25 / 19,810 |
| course-near | desktop | 64.6730 | 76.8435 | 12.1705 | 11.362 | 24 / 19,802 |
| course-far | desktop | 65.8103 | 76.8614 | 11.0511 | 11.306 | 25 / 19,810 |
| course-design | mobile | 68.1006 | 75.7937 | 7.6930 | 1.919 | 25 / 19,810 |
| course-near | mobile | 64.9578 | 78.3047 | 13.3469 | 12.136 | 23 / 19,746 |
| course-far | mobile | 65.7523 | 77.1070 | 11.3547 | 10.522 | 25 / 19,810 |
| world-design | desktop | — | — | — | 6.718 | 33 / 62,261 |
| world-design | mobile | — | — | — | 6.883 | 33 / 51,929 |

课程代码指标在默认镜头仍是 41 lesson nodes、328 props、8 props/node、0 node occlusion、
rim share 0.314、key/fill 6.6452。和上一轮记录一致：course-design 由 26/19,913 降到
25/19,810，course-near 由 25/19,905 降到 24/19,802，world desktop 保持 33/62,261；
课程云仍为 36 triangles，闭合瀑布仍为 96 triangles。没有把云/水退回贴片来换预算。

### 三 seed × 四节数 × 五路线抽样

按技能要求实际跑了 60 个课程 design 样本：layout seed 为
`round2-seed-a`、`round2-seed-b`、`round2-seed-c`；每个 seed 都覆盖 6/12/24/41 节，
以及 `arc`、`horseshoe`、`loop-around-hill`、`switchback`、`serpentine` 五种路线。
60/60 的 `__islandLookMetrics().ready` 为 true，`landMedianLightness` 范围为
**60.2552–67.6802**，全部在 50–70；render calls 范围 19–25，triangles 范围
4,164–19,924。每种节数的结构计数保持 6/48、12/96、24/192、41/328（nodes/props）。

矩阵中其它红项没有被误报为全绿：不同路线/seed 的 p95、rise、grass 和 accent 仍反映
当前 look debt；本矩阵只证明这次 median 规则不是只对一个固定岛生效。

### 历史债务与本轮新增 trade-off

历史债务：

- `landLightnessRise` 的旧 ratchet pin 24.7634 高于 baseline 6.0097，本轮 10.8331 仍
  过不了 pin，但没有比 baseline 更差；这是旧 pin/旧 composition debt，不应改 pin。
- contract 的 land p95、background spread、grass spread/P95、P2/P98、stddev、accent
  在首次官方课程判定就已经越界，本轮没有改它们的阈值，也没有声称它们变绿。
- world `ready=false` 是 world 可见 sea=false 与 judge 仍等待 aerial plate 的现有边界问题；
  课程 ready 已由 `3acb7cb` 修好，本轮没有伪造 world plate。

本轮新增且已接受的 trade-off：课程天空的 mid/horizon 和非路线地表一起压低后，默认
course-design 的 land p95 由 baseline 81.7809 变为 76.5947，grass P95 由 76.0528 变为
68.312，grass spread 由 16.8486 变为 13.5193；这些是为了把 median 拉回 band 的可见代价，
并且仍是同一生成规则，而不是 per-island 修补。相对地，median 从 75.7712 到 65.7616，
60 个矩阵样本也全部守住 band；体积和预算没有回退。

### 验证与自评

通过：

- `pnpm --filter @pieai/university-world test`：49 files / 327 tests
- world typecheck、lint、format check
- `pnpm docs:check`：89 docs、0 warning
- `pnpm check:lesson-links`
- `pnpm bundle`
- `pnpm check:experience`：29 findings、24 fixed、5 open
- `pnpm verify` 中除 freshness 外的 typecheck、全仓 lint/format、全仓 tests、boundaries、
  canvas registry、build、shelf、content revisions
- `git diff --check`，并确认 `e2e/J.island-look.spec.ts` 与
  `packages/world/src/island/look-contract.ts` 没有 diff

`pnpm verify` 仍在最后的 `check-export-freshness` 失败，原始错误仍是：
`turing-pact — re-export failed: Study has no active courses: turing-pact`。任务明确禁止修改
`apps/local/studies/`，所以这条保持记录而不绕过。

本轮自评：**86/100**。核心 median、跨视口、60 样本、同拍法和预算目标完成，且没有 judge
作弊；扣分来自官方 ratchet 尚有历史 rise pin、world readiness 债务，以及本轮为 median
付出的 grass/p95 值域收窄。下一轮若要继续，应先由契约拥有者决定这些历史红项和 world
plate 边界的归属，不应在本分支偷偷调阈值。

## Island 4 收尾与可判定证据（2026-09-01）

这一节是本轮追加的最新记录；此前正文保留不动。此前正文里关于 world `ready=false` 的描述属于修复前状态，以下结果取代它。

### 先提交遗留成果

第一步已完成：先读懂并提交原有 8 个未提交文件，提交为 `bd57d50 world: preserve island look pass`。该提交只包含以下 8 个文件（144 insertions / 32 deletions）：

- `packages/world/src/Maps.tsx`
- `packages/world/src/grid/GridCloudLayers.tsx`
- `packages/world/src/grid/HexField.tsx`
- `packages/world/src/grid/LessonMarkerField.tsx`
- `packages/world/src/grid/grid-palette.ts`
- `packages/world/src/island/look-metrics.ts`
- `packages/world/src/kit.tsx`
- `packages/world/src/sky/cloud-volume.ts`

之后的唯一修复提交为 `ef694c3 fix(look): wait for world terrain readiness`：把 world 判定绑定到实际地形对象，并保留了前一提交的视觉成果。`git status` 的 tracked 部分干净；`look-contract.ts`、`e2e/J.island-look.spec.ts`、harness、阈值和 ratchet pin 均没有 diff。

### 判官运行口径

官方命令 `pnpm e2e:island-look` 使用仓库原有固定镜头、`seed=foundations-before-zero`、`freeze=1`、`post=off`，真实退出码为 1；它打印了 `course-design/desktop` 和 `course-near/desktop` 后，在 `course-near/desktop/landCoverage` 停止：`observed 0.9716, pinned 1`。这不是把失败藏掉。因为官方 runner 在第一个 ratchet 红项就退出，后面 6 组用相同 URL、viewport、可见 headed browser、稳定画布等待和同一 `metricsFor` 逻辑补读；表中明确保留这一证据边界。

每组的二次 reload 哈希均相同，`document.visibilityState=visible`，`ready=true`；desktop 画布为 1440×900，mobile 画布为 390×590。`displayDarkPixelShare` 是判官单独打印的显示域指标，也一并列出。

| 镜头 / viewport | ready | displayDarkPixelShare | canvas | first = second pixel hash | calls / triangles |
| --- | --- | ---: | --- | --- | ---: |
| course-design/desktop | true | 0.154175 | 1440×900 | a265b553 = a265b553 | 25 / 19,810 |
| course-near/desktop | true | 0.127926 | 1440×900 | 5b547bc8 = 5b547bc8 | 24 / 19,802 |
| course-far/desktop | true | 0.09655 | 1440×900 | 4fa2816a = 4fa2816a | 25 / 19,810 |
| world-design/desktop | true | 0.145417 | 1440×900 | fe48399c = fe48399c | 33 / 62,261 |
| course-design/mobile | true | 0.264746 | 390×590 | 213a3579 = 213a3579 | 25 / 19,810 |
| course-near/mobile | true | 0.088336 | 390×590 | 85bdb8e4 = 85bdb8e4 | 23 / 19,746 |
| course-far/mobile | true | 0.085528 | 390×590 | a3e5c541 = a3e5c541 | 25 / 19,810 |
| world-design/mobile | true | 0.254594 | 390×590 | db7e11df = db7e11df | 33 / 51,929 |

字段含义：`current` 是本轮读到的数；`pin` 是 `ISLAND_LOOK_RATCHET` 原值；`contract band` 是 look contract 的合约区间；`direction` 是 ratchet 方向；`contract` 与 `ratchet` 分开判定。`INFO` 字段仍列出，因为它们属于判官输出，不能省略。

#### course-design/desktop

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 17.404 | 5.825 | ≥4 | min | PASS | PASS |
| landMedianLightness | 57.2474 | 50.5244 | 50–70 | range | PASS | PASS |
| landP95Lightness | 97.6579 | 75.2878 | ≥85 | min | PASS | PASS |
| landLightnessRise | 40.4105 | 24.7634 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 56.8343 | 32.293 | ≥40 | min | PASS | PASS |
| grassLightnessSpread | 45.8613 | 39.8258 | ≥45 | min | PASS | PASS |
| grassLightnessP95 | 97.6771 | 76.2718 | ≥85 | min | PASS | PASS |
| lightnessP2 | 23.7851 | 35.8535 | ≤25 | max | PASS | PASS |
| lightnessP98 | 97.6674 | 78.5922 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 19.7891 | 12.71 | ≥18 | min | PASS | PASS |
| grassHueCount | 9 | 9 | ≥3 | min | PASS | PASS |
| grassHueSpread | 120 | 120 | ≥35 | min | PASS | PASS |
| accentArea | 0.0161 | 0.0015 | 0.015–0.15 | range | PASS | PASS |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 9.2578 | 8.8868 | ≥4.5 | min | PASS | PASS |
| domLabelCount | 6 | — | — | info | INFO | — |
| layerDistribution | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41} | — | — | info | INFO | — |
| lessonNodeCount | 41 | — | — | info | INFO | — |
| coursePropCount | 328 | — | — | info | INFO | — |
| propsPerLessonNode | 8 | 7.7073 | ≥7 | min | PASS | PASS |
| rimPropShare | 0.314 | 0.2753 | ≥0.2 | min | PASS | PASS |
| landCoverage | 0.5418 | 0.4277 | ≥0.34 | min | PASS | PASS |
| nodeOcclusionShare | 0 | 0 | ≤0.05 | max | PASS | PASS |

#### course-near/desktop

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 24.83 | 5.686 | ≥4 | min | PASS | PASS |
| landMedianLightness | 62.8168 | 39.2856 | 50–70 | range | PASS | PASS |
| landP95Lightness | 97.7682 | 53.4286 | ≥85 | min | PASS | PASS |
| landLightnessRise | 34.9514 | 14.1431 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 33.8161 | 0 | ≥40 | min | RED | PASS |
| grassLightnessSpread | 52.5965 | 25.6484 | ≥45 | min | PASS | PASS |
| grassLightnessP95 | 97.7896 | 48.8736 | ≥85 | min | PASS | PASS |
| lightnessP2 | 18.1359 | 22.2487 | ≤25 | max | PASS | PASS |
| lightnessP98 | 97.8449 | 56.191 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 24.2807 | 6.7783 | ≥18 | min | PASS | PASS |
| grassHueCount | 8 | 5 | ≥3 | min | PASS | PASS |
| grassHueSpread | 118.4234 | 70.677 | ≥35 | min | PASS | PASS |
| accentArea | 0.0213 | 0 | 0.015–0.15 | range | PASS | PASS |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 13.0236 | 12.5226 | ≥4.5 | min | PASS | PASS |
| domLabelCount | 4 | — | — | info | INFO | — |
| layerDistribution | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41} | — | — | info | INFO | — |
| lessonNodeCount | 41 | — | — | info | INFO | — |
| coursePropCount | 328 | — | — | info | INFO | — |
| propsPerLessonNode | 8 | 7.7073 | ≥7 | min | PASS | PASS |
| rimPropShare | 0.314 | 0.2753 | ≥0.2 | min | PASS | PASS |
| landCoverage | 0.9716 | 1 | ≥0.34 | min | PASS | RED |
| nodeOcclusionShare | 0 | 0 | ≤0.05 | max | PASS | PASS |

#### course-far/desktop

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 22.431 | 13.796 | ≥4 | min | PASS | PASS |
| landMedianLightness | 62.6779 | 50.4215 | 50–70 | range | PASS | PASS |
| landP95Lightness | 97.7682 | 75.5239 | ≥85 | min | PASS | PASS |
| landLightnessRise | 35.0903 | 25.1024 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 36.5476 | 43.4949 | ≥40 | min | RED | RED |
| grassLightnessSpread | 49.2027 | 53.654 | ≥45 | min | PASS | RED |
| grassLightnessP95 | 97.8114 | 77.2241 | ≥85 | min | PASS | PASS |
| lightnessP2 | 24.6043 | 23.0834 | ≤25 | max | PASS | RED |
| lightnessP98 | 97.8224 | 85.773 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 23.0471 | 16.2052 | ≥18 | min | PASS | PASS |
| grassHueCount | 8 | 9 | ≥3 | min | PASS | RED |
| grassHueSpread | 119.4828 | 119.717 | ≥35 | min | PASS | RED |
| accentArea | 0.0241 | 0.0015 | 0.015–0.15 | range | PASS | PASS |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 10.3376 | 10.64 | ≥4.5 | min | PASS | RED |
| domLabelCount | 10 | — | — | info | INFO | — |
| layerDistribution | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41} | — | — | info | INFO | — |
| lessonNodeCount | 41 | — | — | info | INFO | — |
| coursePropCount | 328 | — | — | info | INFO | — |
| propsPerLessonNode | 8 | 7.7073 | ≥7 | min | PASS | PASS |
| rimPropShare | 0.314 | 0.2753 | ≥0.2 | min | PASS | PASS |
| landCoverage | 0.8969 | 0.7704 | ≥0.34 | min | PASS | PASS |
| nodeOcclusionShare | 0 | 0 | ≤0.05 | max | PASS | PASS |

#### world-design/desktop

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 4.812 | 2.907 | ≥4 | min | PASS | PASS |
| landMedianLightness | 55.6785 | 48.7604 | 50–70 | range | PASS | PASS |
| landP95Lightness | 94.8376 | 77.0935 | ≥85 | min | PASS | PASS |
| landLightnessRise | 39.1591 | 28.3331 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 69.8701 | 47.6364 | ≥40 | min | PASS | PASS |
| grassLightnessSpread | 52.1556 | 56.0291 | ≥45 | min | PASS | RED |
| grassLightnessP95 | 96.3592 | 91.5368 | ≥85 | min | PASS | PASS |
| lightnessP2 | 16.1373 | 34.6623 | ≤25 | max | PASS | PASS |
| lightnessP98 | 97.7895 | 92.0102 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 22.0282 | 14.315 | ≥18 | min | PASS | PASS |
| grassHueCount | 9 | 9 | ≥3 | min | PASS | PASS |
| grassHueSpread | 120 | 120 | ≥35 | min | PASS | PASS |
| accentArea | 0.0251 | 0.0054 | 0.015–0.15 | range | PASS | PASS |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 10.5701 | 12.6155 | ≥4.5 | min | PASS | RED |
| domLabelCount | 9 | — | — | info | INFO | — |
| layerDistribution | {"dressingProps":89,"lessonNodes":0,"routeSamples":0,"terrainPatches":0} | — | — | info | INFO | — |
| lessonNodeCount | 0 | — | — | info | INFO | — |
| coursePropCount | 89 | — | — | info | INFO | — |
| landCoverage | 0.1207 | — | 信息 | info | INFO | — |
| worldPropsPerIsland | 0 | 8 | ≤8 | max | PASS | PASS |

#### course-design/mobile

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 7.239 | 3.286 | ≥4 | min | PASS | PASS |
| landMedianLightness | 52.2125 | 73.9746 | 50–70 | range | PASS | PASS |
| landP95Lightness | 96.5372 | 82.8142 | ≥85 | min | PASS | PASS |
| landLightnessRise | 44.3246 | 8.8396 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 70.167 | 38.2893 | ≥40 | min | PASS | PASS |
| grassLightnessSpread | 45.4867 | 32.4114 | ≥45 | min | PASS | PASS |
| grassLightnessP95 | 97.6674 | 78.4072 | ≥85 | min | PASS | PASS |
| lightnessP2 | 12.3991 | 37.8218 | ≤25 | max | PASS | PASS |
| lightnessP98 | 96.6315 | 82.9636 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 21.7033 | 14.3485 | ≥18 | min | PASS | PASS |
| grassHueCount | 9 | 9 | ≥3 | min | PASS | PASS |
| grassHueSpread | 120 | 120 | ≥35 | min | PASS | PASS |
| accentArea | 0.0078 | 0.0905 | 0.015–0.15 | range | RED | RED |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 9.1066 | 10.0051 | ≥4.5 | min | PASS | RED |
| domLabelCount | 3 | — | — | info | INFO | — |
| layerDistribution | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41} | — | — | info | INFO | — |
| lessonNodeCount | 41 | — | — | info | INFO | — |
| coursePropCount | 328 | — | — | info | INFO | — |
| propsPerLessonNode | 8 | 7.7073 | ≥7 | min | PASS | PASS |
| rimPropShare | 0.314 | 0.2753 | ≥0.2 | min | PASS | PASS |
| landCoverage | 0.4203 | 0.4239 | ≥0.34 | min | PASS | RED |
| nodeOcclusionShare | 0 | 0 | ≤0.05 | max | PASS | PASS |

#### course-near/mobile

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 22.347 | 4.361 | ≥4 | min | PASS | PASS |
| landMedianLightness | 64.5108 | 39.6919 | 50–70 | range | PASS | PASS |
| landP95Lightness | 97.6966 | 48.0839 | ≥85 | min | PASS | PASS |
| landLightnessRise | 33.1858 | 8.392 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 45.9397 | 0 | ≥40 | min | PASS | PASS |
| grassLightnessSpread | 37.6751 | 22.1062 | ≥45 | min | RED | PASS |
| grassLightnessP95 | 97.7065 | 45.7713 | ≥85 | min | PASS | PASS |
| lightnessP2 | 24.7463 | 22.2487 | ≤25 | max | PASS | RED |
| lightnessP98 | 97.7166 | 54.9768 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 23.5302 | 6.4264 | ≥18 | min | PASS | PASS |
| grassHueCount | 5 | 6 | ≥3 | min | PASS | RED |
| grassHueSpread | 115.3161 | 73.6407 | ≥35 | min | PASS | PASS |
| accentArea | 0.0261 | 0 | 0.015–0.15 | range | PASS | PASS |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 10.6371 | 12.5524 | ≥4.5 | min | PASS | RED |
| domLabelCount | 4 | — | — | info | INFO | — |
| layerDistribution | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41} | — | — | info | INFO | — |
| lessonNodeCount | 41 | — | — | info | INFO | — |
| coursePropCount | 328 | — | — | info | INFO | — |
| propsPerLessonNode | 8 | 7.7073 | ≥7 | min | PASS | PASS |
| rimPropShare | 0.314 | 0.2753 | ≥0.2 | min | PASS | PASS |
| landCoverage | 0.9883 | 1 | ≥0.34 | min | PASS | RED |
| nodeOcclusionShare | 0 | 0 | ≤0.05 | max | PASS | PASS |

#### course-far/mobile

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 22.058 | 15.735 | ≥4 | min | PASS | PASS |
| landMedianLightness | 62.5248 | 52.6041 | 50–70 | range | PASS | PASS |
| landP95Lightness | 97.7065 | 80.8839 | ≥85 | min | PASS | PASS |
| landLightnessRise | 35.1817 | 28.2798 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 35.2214 | 31.9002 | ≥40 | min | RED | PASS |
| grassLightnessSpread | 50.3017 | 49.4044 | ≥45 | min | PASS | PASS |
| grassLightnessP95 | 97.7369 | 72.9974 | ≥85 | min | PASS | PASS |
| lightnessP2 | 25.0404 | 22.7128 | ≤25 | max | RED | RED |
| lightnessP98 | 97.7473 | 83.7498 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 23.7326 | 16.4703 | ≥18 | min | PASS | PASS |
| grassHueCount | 8 | 9 | ≥3 | min | PASS | RED |
| grassHueSpread | 119.4828 | 120 | ≥35 | min | PASS | RED |
| accentArea | 0.0227 | 0.0511 | 0.015–0.15 | range | PASS | RED |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 10.2931 | 10.576 | ≥4.5 | min | PASS | RED |
| domLabelCount | 7 | — | — | info | INFO | — |
| layerDistribution | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41} | — | — | info | INFO | — |
| lessonNodeCount | 41 | — | — | info | INFO | — |
| coursePropCount | 328 | — | — | info | INFO | — |
| propsPerLessonNode | 8 | 7.7073 | ≥7 | min | PASS | PASS |
| rimPropShare | 0.314 | 0.2753 | ≥0.2 | min | PASS | PASS |
| landCoverage | 0.9426 | 0.8671 | ≥0.34 | min | PASS | PASS |
| nodeOcclusionShare | 0 | 0 | ≤0.05 | max | PASS | PASS |

#### world-design/mobile

| 判官字段 | current | pin | contract band | direction | contract | ratchet |
| --- | ---: | ---: | ---: | --- | --- | --- |
| sceneLinearRange | 7.159 | 3.039 | ≥4 | min | PASS | PASS |
| landMedianLightness | 55.5624 | 80.4531 | 50–70 | range | PASS | PASS |
| landP95Lightness | 95.1943 | 85.7285 | ≥85 | min | PASS | PASS |
| landLightnessRise | 39.6318 | 5.2754 | ≥15 | min | PASS | PASS |
| backgroundLightnessSpread | 81.0077 | 34.5319 | ≥40 | min | PASS | PASS |
| grassLightnessSpread | 51.9972 | 40.192 | ≥45 | min | PASS | PASS |
| grassLightnessP95 | 96.09 | 74.8088 | ≥85 | min | PASS | PASS |
| lightnessP2 | 15.5081 | 34.4671 | ≤25 | max | PASS | PASS |
| lightnessP98 | 98.7695 | 83.5046 | ≥90 | min | PASS | PASS |
| lightnessStdDev | 26.9809 | 12.9957 | ≥18 | min | PASS | PASS |
| grassHueCount | 9 | 9 | ≥3 | min | PASS | PASS |
| grassHueSpread | 120 | 120 | ≥35 | min | PASS | PASS |
| accentArea | 0.0312 | 0.3923 | 0.015–0.15 | range | PASS | PASS |
| keyToFillRatio | 6.6452 | 5.3608 | ≥3 | min | PASS | PASS |
| domLabelContrastMin | 11.926 | 13.4513 | ≥4.5 | min | PASS | RED |
| domLabelCount | 3 | — | — | info | INFO | — |
| layerDistribution | {"dressingProps":89,"lessonNodes":0,"routeSamples":0,"terrainPatches":0} | — | — | info | INFO | — |
| lessonNodeCount | 0 | — | — | info | INFO | — |
| coursePropCount | 89 | — | — | info | INFO | — |
| landCoverage | 0.1375 | — | 信息 | info | INFO | — |
| worldPropsPerIsland | 0 | 8 | ≤8 | max | PASS | PASS |

### RED 的逐项归类

分类按检查维度拆开：1 = 相对这次实测的 pre-merge baseline 变差；2 = 合约在合并前就已经红；3 = 只有旧 ratchet pin 红、而当前合约通过，且 pin 绑定了旧的几何 / 材质 / 光照构图。一个字段可以同时是 2 和 3；这比把合约红与历史 pin 红混成一个结论更准确。

| 镜头 / 字段 | 当前 | pre-merge baseline | pin | contract band | 红的检查 | 归类与证据 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| course-near/desktop · backgroundLightnessSpread | 33.8161 | 4.3895 | 0 | ≥40 | contract | 2：合并前已红；本轮由 4.3895 提到 33.8161，仍未过合约 |
| course-near/desktop · landCoverage | 0.9716 | 0.9995 | 1 | ≥0.34 | ratchet | 1：相对实测 baseline 下降；合约仍 PASS。pin=1 是旧精确截图值，见下方 pin 证据 |
| course-far/desktop · backgroundLightnessSpread | 36.5476 | 22.3962 | 43.4949 | ≥40 | contract + ratchet | 2 + 3：合约合并前已红；相对 baseline 改善但达不到旧 pin |
| course-far/desktop · grassLightnessSpread | 49.2027 | 29.44 | 53.654 | ≥45 | ratchet | 3：合约已 PASS，旧 pin 仍要求旧构图的 53.654 |
| course-far/desktop · lightnessP2 | 24.6043 | 26.8513 | 23.0834 | ≤25 | ratchet | 3：相对 baseline 朝 max 方向改善且合约 PASS，旧 pin 不再是合理目标 |
| course-far/desktop · grassHueCount | 8 | 5 | 9 | ≥3 | ratchet | 3：合约 PASS；旧 pin 记录的是旧 foliage 色相构成 |
| course-far/desktop · grassHueSpread | 119.4828 | 120 | 119.717 | ≥35 | ratchet | 3：合约 PASS；仅丢失旧构图的 0.5172 |
| course-far/desktop · domLabelContrastMin | 10.3376 | — | 10.64 | ≥4.5 | ratchet | 3：合约 PASS；旧 DOM label 构图 pin 不应支配当前画面 |
| world-design/desktop · grassLightnessSpread | 52.1556 | —（旧 world 未 ready） | 56.0291 | ≥45 | ratchet | 3：合约 PASS；旧 world pin 来自另一套可见构图 |
| world-design/desktop · domLabelContrastMin | 10.5701 | —（旧 world 未 ready） | 12.6155 | ≥4.5 | ratchet | 3：合约 PASS；旧 world label 构图 pin |
| course-design/mobile · accentArea | 0.0078 | 0.7152 | 0.0905 | 0.015–0.15 | contract + ratchet | 2 + 3：合并前已红（当时是上界红），现在变成下界红；不能称为本轮修绿 |
| course-design/mobile · domLabelContrastMin | 9.1066 | — | 10.0051 | ≥4.5 | ratchet | 3：合约 PASS，旧 label 构图 pin |
| course-design/mobile · landCoverage | 0.4203 | 0.6305 | 0.4239 | ≥0.34 | ratchet | 1 + 3：相对 baseline 下降 0.2102；仍过合约，pin 只比当前高 0.0036，受当前像素分割 / 构图影响 |
| course-near/mobile · grassLightnessSpread | 37.6751 | 7.3464 | 22.1062 | ≥45 | contract | 2：合并前已红；本轮显著改善，仍低于合约 |
| course-near/mobile · lightnessP2 | 24.7463 | 26.9977 | 22.2487 | ≤25 | ratchet | 3：相对 baseline 已朝 max 方向改善，合约 PASS，旧 pin 过严 |
| course-near/mobile · grassHueCount | 5 | 2 | 6 | ≥3 | ratchet | 3：相对 baseline 改善，合约 PASS，旧 pin 绑定旧色相构成 |
| course-near/mobile · domLabelContrastMin | 10.6371 | — | 12.5524 | ≥4.5 | ratchet | 3：合约 PASS，旧 label 构图 pin |
| course-near/mobile · landCoverage | 0.9883 | 0.9997 | 1 | ≥0.34 | ratchet | 1 + 3：相对 baseline 下降 0.0114；合约 PASS，pin=1 是旧精确值 |
| course-far/mobile · backgroundLightnessSpread | 35.2214 | 21.1426 | 31.9002 | ≥40 | contract | 2：合并前已红；本轮改善但仍未过合约 |
| course-far/mobile · lightnessP2 | 25.0404 | 27.4234 | 22.7128 | ≤25 | contract + ratchet | 2 + 3：合并前已红；本轮接近合约但仍超过 25，且未达到旧 pin |
| course-far/mobile · grassHueCount | 8 | 3 | 9 | ≥3 | ratchet | 3：合约 PASS；相对 baseline 改善，旧 pin 绑定旧色相构成 |
| course-far/mobile · grassHueSpread | 119.4828 | 30 | 120 | ≥35 | ratchet | 3：合约 PASS；相对 baseline 大幅改善，旧 pin 的 120 是旧构图精确值 |
| course-far/mobile · accentArea | 0.0227 | 0.3566 | 0.0511 | 0.015–0.15 | ratchet | 3：合约 PASS；合并前反而是上界红，当前进入 band，旧 range pin 不应否决 |
| course-far/mobile · domLabelContrastMin | 10.2931 | — | 10.576 | ≥4.5 | ratchet | 3：合约 PASS，旧 label 构图 pin |
| world-design/mobile · domLabelContrastMin | 11.926 | —（旧 world 未 ready） | 13.4513 | ≥4.5 | ratchet | 3：合约 PASS；当前 median 从旧 pin 外的 80.4531 回到合约 band 内 |

### 为什么这些 pin 已失去判定意义

pin 文件的注释写明它们是在 2026-08-30、66° polar、-1 target-height offset、course-design own fit 下采集的历史观察；本轮没有改 camera、light、contract 或 pin。`bd57d50` 改的是共享的 sky / terrain value ramp / cloud / marker / foliage / material composition，并保留同一生成管线，所以旧 pin 会随着像素分布和遮挡边界一起移动。

两个可复核的反例：

- `course-design/desktop` 的 current `landMedian=57.2474`、`landP95=97.6579`、`landLightnessRise=40.4105`、`backgroundSpread=56.8343` 全部满足合约，但相对旧 pin 的 50.5244 / 75.2878 / 24.7634 / 32.293 大幅变化；这不是失去体积，而是旧材质构图的数值已不再是当前尺子。
- `world-design/mobile` 的旧 median pin 是 80.4531，本身就在当前合约上界 70 之外；current 是 55.5624，实际进入 50–70，同时 scene range=7.159、triangles=51,929、hash 二次一致。继续追旧 pin 会把已经合约通过的 world 往错误方向推。

world 的 `worldPropsPerIsland` current=0 需要单独注明：当前 source 没有 blueprint plans，因此 judge 的这个字段取 0；同一 report 的 `coursePropCount=89`、`layerDistribution.dressingProps=89` 和画布预算证明实际 world dressing 并非 0。这里没有趁收尾再改 metric 语义，避免把证据轮变成新的画面轮。

### world ready 修复

修复位置是 `packages/world/src/island/look-metrics.ts:313` 附近。旧判定等待不存在的 `island-look-aerial-plate`，而 world scene 明确 `visibleSea=false`，所以永远不能进入 judge。现在 `worldGridReady(scene)` 必须找到名为 `world-grid-hex-field` 的实际 `InstancedMesh`，并同时满足 `count > 0` 与 geometry 的 position attribute 有顶点；`detailSurfaceReady` 只对 world 使用这条检查。没有 direct `true`，没有新增 aerial plate。

修复后的真实 headed-browser 结果是 `world-design/desktop ready=true`（33 calls / 62,261 triangles / hash `fe48399c`）和 `world-design/mobile ready=true`（33 calls / 51,929 triangles / hash `db7e11df`），两组均二次 reload 不漂移。

### 同镜头截图证据

baseline 与 final 都是 `course-design`、同一 fixed camera、同一 1440×900 canvas；final 只切换 `post=off/on`，并在 DOM 隐藏后截 raw canvas，没有把 UI 当画面。四个绝对路径如下：

- `/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/baseline/course-design-post-off.png` — 1440×900，SHA-256 `45279df94385434293db613cd57ed10176bd96f1649d1a514a62a57175ef916c`
- `/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/baseline/course-design-post-on.png` — 1440×900，SHA-256 `93df484fad3ba3f9b7a8cfcf477f979d5c7168a3d08650d887b893081fd750e5`
- `/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/final/course-design-post-off.png` — 1440×900，SHA-256 `c13962437380b45a55cbf60770eb35e5267ed540c64892ee739a1620b5ecf990`
- `/Users/yuanfei/PieAI/University-wt-islandunder/.scratch/islandunder/final/course-design-post-on.png` — 1440×900，SHA-256 `a49e94476cb5d918310f7f78a585e0e9c7553c44dab49b436292552188c02b32`

### 验证收尾

通过：

- `pnpm typecheck`、全仓 lint、format check、generated-format
- 全仓测试：core 49 files / 421 tests，backend 2 / 6，grading 4 / 27，ui 65 / 382，local 45 / 428，world 49 / 327，university 49 / 217
- module boundaries、kit portability、contrast、raw colours、shared styles、i18n、canvas registry、review-card registry、experience ledger
- 两个 mode 的 build、shelf、content revisions
- 单独补跑的 `pnpm check:lesson-links`、`pnpm bundle`、`pnpm docs:check`；后者 89 docs、0 warning
- `git diff --check`，以及受保护的 contract / e2e / harness 路径无 diff

`pnpm verify` 唯一失败仍是最后阶段的既有 export freshness：

`turing-pact — re-export failed: Study has no active courses: turing-pact`

修复提示是让 `apps/local` 对 `turing-pact` 做 recovery export；本任务明确禁止改 `apps/local/studies/`，所以没有越界修它，也没有把失败写成通过。

这轮的交付判断：视觉生成规则不再继续调；已有成果已保住并提交，world 判官已能真正看到实际地形，8 个固定镜头的完整数值、每一个合约 / ratchet 红项、pre-merge 证据和四张同镜头截图均已留档。

## Island 5 第五轮：只收拾三处颜色（2026-09-01）

本轮严格按 brief 只动三类颜色：课程地表的固有色坡度、课程天空 nadir、共享自然道具 foliage 端点。云体、底面/土层、瀑布、判官 readiness 与两处既有修复均未回退；没有修改 `look-contract.ts`、`ISLAND_LOOK_RATCHET`、`e2e/J.island-look.spec.ts`、harness、`packages/ui` 或 `apps/local`。

### 三处颜色具体改动

- `packages/world/src/grid/grid-palette.ts:38`：`GRID_TERRAIN_VALUE_RAMP.course` 从 `[0.21, 0.5, 2.87, 4.4]` 收窄为 `[0.78, 0.88, 1.0, 1.12]`。地表不再由固有色制造两块黄/褐硬边；四级真实 terrace、高度、阴影和底面仍负责体积。
- `packages/world/src/Maps.tsx:139`：`COURSE_SKY_STOPS.nadir` 从 `0x4e3b7e` 恢复为 `0xc0b8e5`，去掉天空底部的深紫灰压带；其余 sky stops 不动。
- `packages/world/src/grid/grid-palette.ts:49`：`GRID_PROP_FOLIAGE_COLOURS` 的青蓝端点从 `0x4fa68b, 0x35a58b` 换为 `0x5d9147, 0x3c713d`；`BatchedAssetField` 仍走同一共享 palette，课程树/草/叶回到绿域，world 也没有另拆一份。
- 回归断言：`packages/world/src/grid/grid-palette.test.ts` 锁住课程坡度单调且总倍率 `<1.5`，并锁住 foliage 色相不进入青蓝区；`packages/world/src/sky/sky.test.ts` 锁住课程 nadir。

### 视觉结论

四张 final5 对照图亲眼复核：final 的地表是连续黄绿草地，只剩轻微值变化，台阶/路牌/底面/瀑布仍有体积；天空底部是轻薄的暖紫灰渐变；树木不再青蓝。设计机位中 3D 云体、瀑布和两处判官修复均保留。near / far / world 机位也没有看到青蓝 foliage 或新的硬边色块。

### 8 组完整指标

正式 runner 的指标 contract 与旧 ratchet 分开看：下表是同一 URL、同一 viewport、同一 `metricsFor` 口径的无断点补采；`C` 是当前 contract，`R` 是未修改的历史 ratchet pin。INFO 字段保留。每组都 `ready=true`，二次 reload 的像素 hash 一致。

| 镜头 | ready | canvas | sampledPixels | displayDarkPixelShare | first = second pixel hash |
| --- | --- | --- | ---: | ---: | --- |
| course-design/desktop | true | 1440×900 | 324000 | 0.081941 | dc57e4b8 = dc57e4b8 |
| course-near/desktop | true | 1440×900 | 324000 | 0.133194 | 108ab831 = 108ab831 |
| course-far/desktop | true | 1440×900 | 324000 | 0.100944 | 9850af5d = 9850af5d |
| world-design/desktop | true | 1440×900 | 324000 | 0.146194 | 51a0732b = 51a0732b |
| course-design/mobile | true | 390×590 | 230100 | 0.030413 | e80b5d62 = e80b5d62 |
| course-near/mobile | true | 390×590 | 230100 | 0.088279 | 8bc1d490 = 8bc1d490 |
| course-far/mobile | true | 390×590 | 230100 | 0.087849 | 43f5677a = 43f5677a |
| world-design/mobile | true | 390×590 | 230100 | 0.255259 | 6fb69ac3 = 6fb69ac3 |

| 判官字段 | threshold | CD-D | CN-D | CF-D | WD-D | CD-M | CN-M | CF-M | WD-M |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sceneLinearRange | 4 | 13.397<br><sub>C PASS · R PASS</sub> | 11.592<br><sub>C PASS · R PASS</sub> | 12.731<br><sub>C PASS · R RED</sub> | 4.812<br><sub>C PASS · R PASS</sub> | 2.039<br><sub>C RED · R RED</sub> | 11.294<br><sub>C PASS · R PASS</sub> | 11.537<br><sub>C PASS · R RED</sub> | 7.159<br><sub>C PASS · R PASS</sub> |
| landMedianLightness | {"min":50,"max":70} | 65.6111<br><sub>C PASS · R PASS</sub> | 71.8339<br><sub>C RED · R RED</sub> | 71.1551<br><sub>C RED · R RED</sub> | 55.6739<br><sub>C PASS · R PASS</sub> | 52.2196<br><sub>C PASS · R PASS</sub> | 71.8442<br><sub>C RED · R RED</sub> | 71.2782<br><sub>C RED · R RED</sub> | 55.5412<br><sub>C PASS · R PASS</sub> |
| landP95Lightness | 85 | 74.8929<br><sub>C RED · R RED</sub> | 80.8304<br><sub>C RED · R PASS</sub> | 78.6646<br><sub>C RED · R PASS</sub> | 94.8376<br><sub>C PASS · R PASS</sub> | 72.0715<br><sub>C RED · R RED</sub> | 77.8195<br><sub>C RED · R PASS</sub> | 77.5202<br><sub>C RED · R RED</sub> | 95.1943<br><sub>C PASS · R PASS</sub> |
| landLightnessRise | 15 | 9.2818<br><sub>C RED · R RED</sub> | 8.9965<br><sub>C RED · R RED</sub> | 7.5095<br><sub>C RED · R RED</sub> | 39.1637<br><sub>C PASS · R PASS</sub> | 19.852<br><sub>C PASS · R PASS</sub> | 5.9753<br><sub>C RED · R RED</sub> | 6.242<br><sub>C RED · R RED</sub> | 39.6531<br><sub>C PASS · R PASS</sub> |
| backgroundLightnessSpread | 40 | 22.4622<br><sub>C RED · R RED</sub> | 32.9819<br><sub>C RED · R PASS</sub> | 17.3459<br><sub>C RED · R RED</sub> | 69.8701<br><sub>C PASS · R PASS</sub> | 27.0118<br><sub>C RED · R RED</sub> | 47.2728<br><sub>C PASS · R PASS</sub> | 17.5295<br><sub>C RED · R RED</sub> | 81.0077<br><sub>C PASS · R PASS</sub> |
| grassLightnessSpread | 45 | 8.9598<br><sub>C RED · R RED</sub> | 51.3231<br><sub>C PASS · R PASS</sub> | 33.4107<br><sub>C RED · R RED</sub> | 57.1266<br><sub>C PASS · R PASS</sub> | 6.1996<br><sub>C RED · R RED</sub> | 5.4564<br><sub>C RED · R RED</sub> | 28.56<br><sub>C RED · R RED</sub> | 56.0917<br><sub>C PASS · R PASS</sub> |
| grassLightnessP95 | 85 | 73.902<br><sub>C RED · R RED</sub> | 79.4913<br><sub>C RED · R PASS</sub> | 77.2999<br><sub>C RED · R PASS</sub> | 96.3271<br><sub>C PASS · R PASS</sub> | 72.8683<br><sub>C RED · R RED</sub> | 76.0363<br><sub>C RED · R PASS</sub> | 76.0977<br><sub>C RED · R PASS</sub> | 96.075<br><sub>C PASS · R PASS</sub> |
| lightnessP2 | 25 | 24.8019<br><sub>C PASS · R PASS</sub> | 18.1635<br><sub>C PASS · R PASS</sub> | 25.0404<br><sub>C RED · R RED</sub> | 16.1373<br><sub>C PASS · R PASS</sub> | 31.0391<br><sub>C RED · R PASS</sub> | 25.1815<br><sub>C RED · R RED</sub> | 25.343<br><sub>C RED · R RED</sub> | 15.5081<br><sub>C PASS · R PASS</sub> |
| lightnessP98 | 90 | 83.8095<br><sub>C RED · R PASS</sub> | 83.3423<br><sub>C RED · R PASS</sub> | 82.2677<br><sub>C RED · R RED</sub> | 97.7895<br><sub>C PASS · R PASS</sub> | 83.8095<br><sub>C RED · R PASS</sub> | 84.4141<br><sub>C RED · R PASS</sub> | 81.9088<br><sub>C RED · R RED</sub> | 98.7695<br><sub>C PASS · R PASS</sub> |
| lightnessStdDev | 18 | 14.7198<br><sub>C RED · R PASS</sub> | 17.9233<br><sub>C RED · R PASS</sub> | 15.8281<br><sub>C RED · R RED</sub> | 22.0416<br><sub>C PASS · R PASS</sub> | 12.092<br><sub>C RED · R RED</sub> | 15.5674<br><sub>C RED · R PASS</sub> | 15.6993<br><sub>C RED · R RED</sub> | 26.9893<br><sub>C PASS · R PASS</sub> |
| grassHueCount | 3 | 7<br><sub>C PASS · R RED</sub> | 7<br><sub>C PASS · R PASS</sub> | 9<br><sub>C PASS · R PASS</sub> | 9<br><sub>C PASS · R PASS</sub> | 6<br><sub>C PASS · R RED</sub> | 6<br><sub>C PASS · R PASS</sub> | 7<br><sub>C PASS · R RED</sub> | 9<br><sub>C PASS · R PASS</sub> |
| grassHueSpread | 35 | 120<br><sub>C PASS · R PASS</sub> | 95.7<br><sub>C PASS · R PASS</sub> | 120<br><sub>C PASS · R PASS</sub> | 120<br><sub>C PASS · R PASS</sub> | 119.4177<br><sub>C PASS · R RED</sub> | 79.4643<br><sub>C PASS · R PASS</sub> | 93.75<br><sub>C PASS · R RED</sub> | 120<br><sub>C PASS · R PASS</sub> |
| accentArea | {"min":0.015,"max":0.15} | 0.0159<br><sub>C PASS · R PASS</sub> | 0.0211<br><sub>C PASS · R PASS</sub> | 0.0238<br><sub>C PASS · R PASS</sub> | 0.0249<br><sub>C PASS · R PASS</sub> | 0.0078<br><sub>C RED · R RED</sub> | 0.0261<br><sub>C PASS · R PASS</sub> | 0.0225<br><sub>C PASS · R RED</sub> | 0.0309<br><sub>C PASS · R PASS</sub> |
| keyToFillRatio | 3 | 6.6452<br><sub>C PASS · R PASS</sub> | 6.6452<br><sub>C PASS · R PASS</sub> | 6.6452<br><sub>C PASS · R PASS</sub> | 6.6452<br><sub>C PASS · R PASS</sub> | 6.6452<br><sub>C PASS · R PASS</sub> | 6.6452<br><sub>C PASS · R PASS</sub> | 6.6452<br><sub>C PASS · R PASS</sub> | 6.6452<br><sub>C PASS · R PASS</sub> |
| domLabelContrastMin | 4.5 | 9.2578<br><sub>C PASS · R PASS</sub> | 13.0236<br><sub>C PASS · R PASS</sub> | 10.0827<br><sub>C PASS · R RED</sub> | 10.5701<br><sub>C PASS · R RED</sub> | 9.07<br><sub>C PASS · R RED</sub> | 10.5044<br><sub>C PASS · R RED</sub> | 10.0827<br><sub>C PASS · R RED</sub> | 11.926<br><sub>C PASS · R RED</sub> |
| domLabelCount | — | 6<br><sub>C INFO · R —</sub> | 4<br><sub>C INFO · R —</sub> | 10<br><sub>C INFO · R —</sub> | 9<br><sub>C INFO · R —</sub> | 3<br><sub>C INFO · R —</sub> | 4<br><sub>C INFO · R —</sub> | 7<br><sub>C INFO · R —</sub> | 3<br><sub>C INFO · R —</sub> |
| layerDistribution | — | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41}<br><sub>C INFO · R —</sub> | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41}<br><sub>C INFO · R —</sub> | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41}<br><sub>C INFO · R —</sub> | {"terrainPatches":0,"routeSamples":0,"dressingProps":89,"lessonNodes":0}<br><sub>C INFO · R —</sub> | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41}<br><sub>C INFO · R —</sub> | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41}<br><sub>C INFO · R —</sub> | {"terrainPatches":4,"routeSamples":329,"dressingProps":328,"lessonNodes":41}<br><sub>C INFO · R —</sub> | {"terrainPatches":0,"routeSamples":0,"dressingProps":89,"lessonNodes":0}<br><sub>C INFO · R —</sub> |
| lessonNodeCount | — | 41<br><sub>C INFO · R —</sub> | 41<br><sub>C INFO · R —</sub> | 41<br><sub>C INFO · R —</sub> | 0<br><sub>C INFO · R —</sub> | 41<br><sub>C INFO · R —</sub> | 41<br><sub>C INFO · R —</sub> | 41<br><sub>C INFO · R —</sub> | 0<br><sub>C INFO · R —</sub> |
| coursePropCount | — | 328<br><sub>C INFO · R —</sub> | 328<br><sub>C INFO · R —</sub> | 328<br><sub>C INFO · R —</sub> | 89<br><sub>C INFO · R —</sub> | 328<br><sub>C INFO · R —</sub> | 328<br><sub>C INFO · R —</sub> | 328<br><sub>C INFO · R —</sub> | 89<br><sub>C INFO · R —</sub> |
| propsPerLessonNode | 7 | 8<br><sub>C PASS · R PASS</sub> | 8<br><sub>C PASS · R PASS</sub> | 8<br><sub>C PASS · R PASS</sub> | — | 8<br><sub>C PASS · R PASS</sub> | 8<br><sub>C PASS · R PASS</sub> | 8<br><sub>C PASS · R PASS</sub> | — |
| rimPropShare | 0.2 | 0.314<br><sub>C PASS · R PASS</sub> | 0.314<br><sub>C PASS · R PASS</sub> | 0.314<br><sub>C PASS · R PASS</sub> | — | 0.314<br><sub>C PASS · R PASS</sub> | 0.314<br><sub>C PASS · R PASS</sub> | 0.314<br><sub>C PASS · R PASS</sub> | — |
| landCoverage | 0.34 | 0.5487<br><sub>C PASS · R PASS</sub> | 0.9851<br><sub>C PASS · R RED</sub> | 0.9142<br><sub>C PASS · R PASS</sub> | 0.1217<br><sub>C INFO · R —</sub> | 0.4231<br><sub>C PASS · R RED</sub> | 0.9951<br><sub>C PASS · R RED</sub> | 0.9517<br><sub>C PASS · R PASS</sub> | 0.1386<br><sub>C INFO · R —</sub> |
| nodeOcclusionShare | 0.05 | 0<br><sub>C PASS · R PASS</sub> | 0<br><sub>C PASS · R PASS</sub> | 0<br><sub>C PASS · R PASS</sub> | — | 0<br><sub>C PASS · R PASS</sub> | 0<br><sub>C PASS · R PASS</sub> | 0<br><sub>C PASS · R PASS</sub> | — |
| worldPropsPerIsland | 8 | — | — | — | 0<br><sub>C PASS · R PASS</sub> | — | — | — | 0<br><sub>C PASS · R PASS</sub> |

标记解释：`C PASS/RED` 是当前合约结果，`R PASS/RED` 是按原文件 pin 与方向重算的结果；这轮不因 R RED 改画面。`course-design/desktop` 第一项旧 ratchet 红为 `landP95Lightness=74.8929 < 75.2878`，所以 `pnpm e2e:island-look` 真实退出码为 1；测试文件没有被放宽。

### 相对第四轮的变化

下表是当前值减去本文件上一节（第四轮）同镜头 current 的 delta；正数表示上升，负数表示下降。它把这轮主动收掉的“指标型对比度”明确列出来，而不把画面改善包装成判官全绿。

| 指标 delta | CD-D | CN-D | CF-D | WD-D | CD-M | CN-M | CF-M | WD-M |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sceneLinearRange | -4.0070 | -13.2380 | -9.7000 | +0.0000 | -5.2000 | -11.0530 | -10.5210 | +0.0000 |
| landMedianLightness | +8.3637 | +9.0171 | +8.4772 | -0.0046 | +0.0071 | +7.3334 | +8.7534 | -0.0212 |
| landP95Lightness | -22.7650 | -16.9378 | -19.1036 | +0.0000 | -24.4657 | -19.8771 | -20.1863 | +0.0000 |
| landLightnessRise | -31.1287 | -25.9549 | -27.5808 | +0.0046 | -24.4726 | -27.2105 | -28.9397 | +0.0213 |
| backgroundLightnessSpread | -34.3721 | -0.8342 | -19.2017 | +0.0000 | -43.1552 | +1.3331 | -17.6919 | +0.0000 |
| grassLightnessSpread | -36.9015 | -1.2734 | -15.7920 | +4.9710 | -39.2871 | -32.2187 | -21.7417 | +4.0945 |
| grassLightnessP95 | -23.7751 | -18.2983 | -20.5115 | -0.0321 | -24.7991 | -21.6702 | -21.6392 | -0.0150 |
| lightnessP2 | +1.0168 | +0.0276 | +0.4361 | +0.0000 | +18.6400 | +0.4352 | +0.3026 | +0.0000 |
| lightnessP98 | -13.8579 | -14.5026 | -15.5547 | +0.0000 | -12.8220 | -13.3025 | -15.8385 | +0.0000 |
| lightnessStdDev | -5.0693 | -6.3574 | -7.2190 | +0.0134 | -9.6113 | -7.9628 | -8.0333 | +0.0084 |
| grassHueCount | -2.0000 | -1.0000 | +1.0000 | +0.0000 | -3.0000 | +1.0000 | -1.0000 | +0.0000 |
| grassHueSpread | +0.0000 | -22.7234 | +0.5172 | +0.0000 | -0.5823 | -35.8518 | -25.7328 | +0.0000 |
| accentArea | -0.0002 | -0.0002 | -0.0003 | -0.0002 | +0.0000 | +0.0000 | -0.0002 | -0.0003 |
| keyToFillRatio | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| domLabelContrastMin | +0.0000 | +0.0000 | -0.2549 | +0.0000 | -0.0366 | -0.1327 | -0.2104 | +0.0000 |
| domLabelCount | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| lessonNodeCount | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| coursePropCount | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| propsPerLessonNode | +0.0000 | +0.0000 | +0.0000 | — | +0.0000 | +0.0000 | +0.0000 | — |
| rimPropShare | +0.0000 | +0.0000 | +0.0000 | — | +0.0000 | +0.0000 | +0.0000 | — |
| landCoverage | +0.0069 | +0.0135 | +0.0173 | +0.0010 | +0.0028 | +0.0068 | +0.0091 | +0.0011 |
| nodeOcclusionShare | +0.0000 | +0.0000 | +0.0000 | — | +0.0000 | +0.0000 | +0.0000 | — |
| worldPropsPerIsland | — | — | — | +0.0000 | — | — | — | +0.0000 |

主要解读：课程 design desktop 的 `landP95Lightness` 97.6579→74.8929（−22.7650）、`landLightnessRise` 40.4105→9.2818（−31.1287）、`backgroundLightnessSpread` 56.8343→22.4622（−34.3721）、`grassLightnessSpread` 45.8613→8.9598（−36.9015）；这是为了消除视觉上的黄/褐硬切主动放弃的亮度跨度，不是忘记了体积。课程 near/far 也相应收窄；world 地表 ramp 没有改，world 的地形/天空/几何指标保持原生成规则。

### 为画面主动放弃的指标

- 放弃用 `landP95Lightness` / `landLightnessRise`、`grassLightnessSpread` / `grassLightnessP95` 继续追高：它们正是把一片草地推成黄/褐两块的数值杠杆；现在多个课程机位因此落在 contract RED，但画面恢复连续。
- 放弃用 `backgroundLightnessSpread` 追天空底部跨度：`nadir` 变浅后课程 desktop design 为 22.4622、near 为 32.9819、far 为 17.3459，避免重新压回深紫灰带。
- 连带放弃部分 `lightnessP98` / `lightnessStdDev` / `sceneLinearRange` 的旧 pin 方向；没有修改 contract 或 pin，因为它们是观测尺，不应为本轮颜色收拾临时改尺。
- 没有为这些红项增设课程专用指标、另拆 foliage palette 或另写一套渲染分支；本轮目标是共享生成规则的颜色卫生。

### final5 截图与完整取数文件

- [baseline course-design post-off](./islandunder/final5/baseline-course-design-post-off.png)
- [final course-design post-off](./islandunder/final5/final-course-design-post-off.png)
- [baseline course-design post-on](./islandunder/final5/baseline-course-design-post-on.png)
- [final course-design post-on](./islandunder/final5/final-course-design-post-on.png)
- [8 组完整 metrics.json](./islandunder/final5/metrics.json)

四张图均为同一 `course-design` fixed camera、1440×900、同一截图方式；baseline 保留原文件，final 为本轮重拍，post off/on 各一张。

### 验证

- `pnpm --filter @pieai/university-world test`：49 files / 330 tests PASS。
- `pnpm --filter @pieai/university-world typecheck`：PASS。
- `pnpm --filter @pieai/university-world lint`：PASS。
- `pnpm --filter @pieai/university-world format:check`：PASS。
- `pnpm e2e:island-look`：真实 FAIL，首个失败是未修改的 `course-design/desktop/landP95Lightness` ratchet（74.8929 vs pin 75.2878）；无断点补采 8/8 ready、8/8 reload hash 一致。
- `pnpm verify`：前置全仓 test（core 49/421、backend 2/6、grading 4/27、ui 65/382、local 45/428、world 49/330、university 49/217）、build、generated-format、shelf、content revisions、contrast/raw-colours 均通过；最后在既有 export freshness 红项退出：`turing-pact — re-export failed: Study has no active courses: turing-pact`。本轮不触碰 brief 禁止的 `apps/local`。

本次 surface 强调课程地表，是因为三处颜色都由课程/共享 foliage 的同一 surface 规则驱动，用户实际看到的是一整片可读的学习岛；不拆另一套是为了让两种 mode、不同机位和 world/课程继续共享同一个生成管线，避免用分支掩盖颜色规则的问题。

## Island 6 第六轮：同一族绿色的受光面与背光面（2026-09-01）

### 结论先说

第六轮把明暗杠杆移回了真实光照和地形坡度：课程地表四级 albedo ramp 固定为
`[1, 1, 1, 1]`，同一族绿不再靠换色阶制造块面；`gridSurfaceSlopeFor()` 用实际相邻
`topY` 梯度，加沿共享太阳方向的低频 relief，给课程 land 的六边棱柱整体倾斜并更新顶面法线。
路线、bed、detached 和 world 都继续拿平面，不会偷偷改变另一种投影。

我先试过两条不合并的分支：把共享 key 推到 9.0，数字会好看但画面会出现死亮的黄绿色面；
只抬顶不抬底，棱柱上沿会被拉斜并制造连续土壁条带。两条都舍弃。当前截图里受光/背光
是连续的绿地明暗面，棕色仍只来自既有土壁和阴影，没有新增黄/褐地表色块，也没有新增
按 cell 造 hue 的表。

### 交付截图

同一 course / fixed camera 重拍了 4 个 shot × 桌面/手机 × `post=off/on`，共 16 张，
都等画布像素 hash 稳定后再保存：

- [course-design desktop · post-off](./islandunder/final6/post-off/course-design-desktop.png)
- [course-design desktop · post-on](./islandunder/final6/post-on/course-design-desktop.png)
- [course-near desktop · post-off](./islandunder/final6/post-off/course-near-desktop.png)
- [course-near desktop · post-on](./islandunder/final6/post-on/course-near-desktop.png)
- [course-far desktop · post-off](./islandunder/final6/post-off/course-far-desktop.png)
- [course-far desktop · post-on](./islandunder/final6/post-on/course-far-desktop.png)
- [world-design desktop · post-off](./islandunder/final6/post-off/world-design-desktop.png)
- [world-design desktop · post-on](./islandunder/final6/post-on/world-design-desktop.png)
- [16 组原始 metrics](./islandunder/final6/metrics.json)

### 8 个固定机位对 contract 硬带逐条结果（`post=off`）

单元格格式为「当前值 + 结果」；`🔴` 是当前 contract 未过，不能把它解释成测试通过。

#### 明度与色相

| 指标 | 带 | CD-D | CN-D | CF-D | WD-D | CD-M | CN-M | CF-M | WD-M |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sceneLinearRange | ≥4 | 13.4138 ✅ | 10.8980 ✅ | 12.8269 ✅ | 4.8122 ✅ | 5.0000 ✅ | 11.3725 ✅ | 12.0577 ✅ | 7.1594 ✅ |
| landMedianLightness | 50–70 | 60.9055 ✅ | 61.7192 ✅ | 63.3261 ✅ | 55.6739 ✅ | 51.3374 ✅ | 61.7192 ✅ | 62.2892 ✅ | 55.5412 ✅ |
| landP95Lightness | ≥85 | 80.1963 🔴 | 78.9399 🔴 | 80.8968 🔴 | 94.8376 ✅ | 77.4898 🔴 | 78.4466 🔴 | 80.5593 🔴 | 95.1943 ✅ |
| landLightnessRise | ≥15 | 19.2908 ✅ | 17.2206 ✅ | 17.5707 ✅ | 39.1637 ✅ | 26.1524 ✅ | 16.7274 ✅ | 18.2700 ✅ | 39.6531 ✅ |
| backgroundLightnessSpread | ≥40 | 22.4622 🔴 | 33.1112 🔴 | 17.2032 🔴 | 69.8701 ✅ | 27.0118 🔴 | 47.6743 ✅ | 17.1953 🔴 | 81.0077 ✅ |
| grassLightnessSpread | ≥45 | 26.3171 🔴 | 42.7705 🔴 | 38.7361 🔴 | 57.1266 ✅ | 19.2870 🔴 | 9.9159 🔴 | 36.6701 🔴 | 56.0917 ✅ |
| grassLightnessP95 | ≥85 | 81.0979 🔴 | 70.8789 🔴 | 80.9064 🔴 | 96.3271 ✅ | 79.6635 🔴 | 70.6367 🔴 | 80.5593 🔴 | 96.0750 ✅ |
| lightnessP2 | ≤25 | 24.8019 ✅ | 18.1635 ✅ | 24.9203 ✅ | 16.1373 ✅ | 30.8761 🔴 | 25.1815 🔴 | 25.4757 🔴 | 15.5081 ✅ |
| lightnessP98 | ≥90 | 84.0965 🔴 | 83.4506 🔴 | 83.3423 🔴 | 97.7895 ✅ | 83.8095 🔴 | 84.4141 🔴 | 82.3534 🔴 | 98.7695 ✅ |
| lightnessStdDev | ≥18 | 16.3650 🔴 | 15.8306 🔴 | 17.5051 🔴 | 22.0416 ✅ | 12.6685 🔴 | 13.2554 🔴 | 17.5174 🔴 | 26.9893 ✅ |
| grassHueCount | ≥3 | 7 ✅ | 7 ✅ | 8 ✅ | 9 ✅ | 6 ✅ | 5 ✅ | 7 ✅ | 9 ✅ |
| grassHueSpread | ≥35° | 119.4828 ✅ | 95.7000 ✅ | 119.7458 ✅ | 120.0000 ✅ | 119.1368 ✅ | 78.7500 ✅ | 93.7500 ✅ | 120.0000 ✅ |

缩写：`CD` course-design，`CN` course-near，`CF` course-far，`WD` world-design；`D` desktop，
`M` mobile。最重要的五条已经全部从第五轮的平坦状态向真实坡度方向恢复，8 组中的
`landLightnessRise` 已全过；但 P95/P98/stddev/grass spread 仍有红项。强行让它们全过
需要回到黄/褐 albedo ramp、过强 key 或局部死白，这与 brief 的视觉目标冲突，所以保留红项
并写清原因，不用数字牺牲画面。

#### 其它 contract 字段

| 指标 | 带 | CD-D | CN-D | CF-D | WD-D | CD-M | CN-M | CF-M | WD-M |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| accentArea | 0.015–0.15 | 0.0160 ✅ | 0.0211 ✅ | 0.0239 ✅ | 0.0249 ✅ | 0.0078 🔴 | 0.0261 ✅ | 0.0226 ✅ | 0.0309 ✅ |
| keyToFillRatio | ≥3 | 6.6452 ✅ | 6.6452 ✅ | 6.6452 ✅ | 6.6452 ✅ | 6.6452 ✅ | 6.6452 ✅ | 6.6452 ✅ | 6.6452 ✅ |
| domLabelContrastMin | ≥4.5 | 9.2578 ✅ | 13.0236 ✅ | 9.2899 ✅ | 10.5701 ✅ | 9.0700 ✅ | 10.5044 ✅ | 10.2372 ✅ | 11.9260 ✅ |
| propsPerLessonNode | ≥7（course） | 8 ✅ | 8 ✅ | 8 ✅ | — | 8 ✅ | 8 ✅ | 8 ✅ | — |
| rimPropShare | ≥0.2（course） | 0.314 ✅ | 0.314 ✅ | 0.314 ✅ | — | 0.314 ✅ | 0.314 ✅ | 0.314 ✅ | — |
| landCoverage | ≥0.34（course） | 0.5465 ✅ | 0.9865 ✅ | 0.9109 ✅ | 已知 0.1217，非本轮 | 0.4220 ✅ | 0.9957 ✅ | 0.9496 ✅ | 已知 0.1386，非本轮 |
| nodeOcclusionShare | ≤0.05（course） | 0 ✅ | 0 ✅ | 0 ✅ | — | 0 ✅ | 0 ✅ | 0 ✅ | — |
| worldPropsPerIsland | ≤8（world） | — | — | — | 0 ✅ | — | — | — | 0 ✅ |

### 矩阵复核

用真实浏览器重新跑了 3 个 seed（`foundations-before-zero`、`foundations-terrain`、
`identity-and-accounts`）× 6/12/24/41 课 × 5 种路线（arc、horseshoe、loop-around-hill、
switchback、serpentine）× course-design/course-near/world-design，共 **180/180** 张，
0 个 page error；原始结果在 [matrix-final6/metrics.json](./islandunder/matrix-final6/metrics.json)。
矩阵范围如下，证明坡度规则没有只对一个 41 课压力样本生效：

| shot | landLightnessRise | grassLightnessSpread | landP95Lightness | lightnessP98 | lightnessStdDev | hue count | hue spread |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| course-design（60） | 16.3169–32.8379 | 18.0439–80.7680 | 71.4791–91.1537 | 83.8679–91.4032 | 15.4536–20.0505 | 4–9 | 60.6744–120 |
| course-near（60） | 6.7582–34.2156 | 1.5291–82.0054 | 68.9683–93.0042 | 74.6290–99.0984 | 9.5760–27.8678 | 3–8 | 32.7170–119.0287 |
| world-design（60） | 36.7522–39.1637 | 57.1266–62.5884 | 92.5070–94.8376 | 97.7895–98.0341 | 22.0367–22.0478 | 9 | 120 |

矩阵中的近景低值是相机只看见同一坡面/同一高度带的结果，不用加一层人工色斑去掩盖；
它是下一轮是否调整尺子或近景构图的证据。

### 代码与验证

- 改动：`packages/world/src/grid/grid-elevation.ts`、`packages/world/src/grid/HexField.tsx`、
  `packages/world/src/grid/grid-palette.ts`；新增/更新 `grid-elevation.test.ts`、
  `grid-palette.test.ts`。没有改 `look-contract.ts`、`ISLAND_LOOK_RATCHET`、
  `e2e/J.island-look.spec.ts`、`packages/ui/`、`e2e/harness/` 或 `apps/`。
- `pnpm --filter @pieai/university-world test`：**50 files / 332 tests PASS**。
- world lint、typecheck、format check：**PASS**。
- `pnpm e2e:island-look`：保留原 ratchet 后真实在第一机位停止，错误为
  `course-design/desktop/landLightnessRise: observed 19.2908, pinned 24.7634`；没有改测试让它绿。
- 手工正式截图：16/16 ready，reload 前后 hash 稳定，0 个 page error。
- `pnpm verify`：typecheck、lint、format、全量测试、边界、构建、shelf、content revisions、
  module checks、canvas/review-card/experience checks 均通过；最后在
  `check-export-freshness` 失败：`turing-pact — re-export failed: Study has no active courses: turing-pact`。
  修复提示会改 `apps/local`，本任务明确禁止碰 `apps/`，所以保留真实失败，不伪报通过。

### 收尾

提交前保护路径审计无 diff；最终 commit hash 见 git log。

## Island 7：历史 pin 重新校准审计（2026-09-01）

### 结论

本轮按 `.scratch/BRIEF-island7.md` 执行到硬带判定即停止。**没有重钉任何
`ISLAND_LOOK_RATCHET` pin**：第一条 ratchet 失败本身虽然通过硬带，但同一轮完整
metrics 已发现真实硬带越界，不能继续把历史 pin 当成过期记忆来改写。

已应用重钉：`0 / 146` 个可比较 pin；因此没有进入“超过一半”的刹车条件。实际停止
原因是更优先的硬带缺陷。

### 判官与视觉证据

执行命令：

```bash
E2E_ONLINE_PORT=18293 E2E_LOCAL_WEB_PORT=18294 E2E_LOCAL_API_PORT=18295 E2E_GRADING_PORT=18296 pnpm e2e:island-look
```

官方判官在 `course-design/desktop/landLightnessRise` 停止：实测 `19.2908`，旧 pin
`24.7634`，而硬带 `≥15` 通过。这一条本来属于“硬带通过、历史 pin 落后”的候选
重钉项，但在看到同一批 metrics 的硬带红项后，不再执行重钉。

先于数字检查的 canvas-only 截图：

- [course-design / desktop](/Users/yuanfei/PieAI/University-wt-islandunder/SHOTS/island-look/course-design-desktop.png)

肉眼复核：课程岛仍是一整片有真实高度明暗的绿色地表，路线、节点、树、土壁与瀑布
均可读；本轮没有因为数字去改画面。

### 触发停止的硬带

| 机位 | 指标 | 实测值 | `look-contract.ts` 硬带 | 结果 |
| --- | --- | ---: | ---: | --- |
| course-design / desktop | landP95Lightness | 80.1963 | ≥85 | FAIL |
| course-design / desktop | backgroundLightnessSpread | 22.4622 | ≥40 | FAIL |
| course-design / desktop | grassLightnessSpread | 26.3171 | ≥45 | FAIL |
| course-design / desktop | grassLightnessP95 | 81.0979 | ≥85 | FAIL |
| course-design / desktop | lightnessP98 | 84.0965 | ≥90 | FAIL |
| course-design / desktop | lightnessStdDev | 16.3650 | ≥18 | FAIL |

### 重钉表

空：本轮没有任何 pin 被重新钉，因此没有“机位 / 指标 / 旧 pin / 新值 / 硬带 / 理由”
需要列出。硬带失败项均未重钉。

### 冻结面核对

- `packages/world/src/island/look-contract.ts`：未修改，阈值未动。
- `e2e/J.island-look.spec.ts`：未修改，`ISLAND_LOOK_RATCHET`、
  `ISLAND_LOOK_RATCHET_MODES` 与 `ratchetPass` 未动。
- `packages/world/src/Maps.tsx`、`packages/world/src/grid/HexField.tsx` 及其余渲染代码：
  未修改。
- 末次 sha256：`look-contract.ts` 为
  `7d6ff66a9e3f7262784a64fac03069e998720972c3ac2167cf0b1d11a71ab105`；
  `J.island-look.spec.ts` 为
  `580ac19b62d61e1e373a259a9104a9151516f1e1c78621fd7982f8fe3b753bf4`。

### 验证

- `pnpm --filter @pieai/university-world test`：**50 files / 332 tests PASS**。
- world typecheck：**PASS**。
- world lint：**PASS**。
- world format check：**PASS**。
- `pnpm e2e:island-look`：**按硬带缺陷规则停止，FAIL**；没有继续重钉或伪造完整通过。
- `pnpm verify`：typecheck、lint、format、全量测试、边界、registry、experience 检查及
  各包构建前置均通过；在 `@pieai/university-app` delivery build 清理已有
  `apps/university/dist/delivery/content` 时因 `ENOTEMPTY` 退出。本轮未为此触碰
  `apps/`，该失败保留为环境/构建目录问题。

按任务书，后续应由人工决定这些硬带缺陷是否需要修复；在作出该决定前，历史 pin 不应
被重钉。
