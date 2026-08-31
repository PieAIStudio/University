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
