# Surface2 执行报告

- 分支：`work/surface2`
- 基线：`main@9cb6f79`
- 日期：2026-09-03
- 目标：给 `GridCell` 增加与 `kind` 正交的 `surface` 轴，让地面本身产生可读的类型变化。

## 结论

已采用四种 surface：`grass`、`stone`、`sand`、`water`。

这四种刚好覆盖本轮要解决的视觉语义：grass 是默认地面，stone 让采石场/遗迹成为真正的
石地，sand 是农田/旱原和水岸的过渡，water 只在 palm-shore 的岛缘成片出现。没有加入泥、
雪或熔岩：它们会继续扩大颜色表，却没有本项目已经定义的 biome / 过渡语义，属于本轮范围外
的第三种变化来源。

`kind` 不变：它仍然只表示 `route | land | detached`。`surface` 只表示地面材料角色；
渲染层没有用 surface 改写碰撞、路线或 lesson 语义。

## 实现位置

- [`grid-surface.ts`](../../packages/world/src/grid/grid-surface.ts)：无 React / Three 的确定性
  surface planner、flood-fill、混合比/色带断言和 reverse tripwire 诊断。
- [`grid-theme.ts`](../../packages/world/src/grid/grid-theme.ts)：`GridSurface`、
  `GRID_SURFACES` 和与 `groundTint` 并列的 `surfaceMix`。
- [`course-grid.ts`](../../packages/world/src/grid/course-grid.ts)：先生成 territory，再为
  共享 `GridCell` 规划 surface，最后用 `assertGridSurfaceContract()` fail closed。
- [`HexField.tsx`](../../packages/world/src/grid/HexField.tsx)：course 的 bed / land 都通过
  `setColorAt()` 写实例色；既有 hex geometry 的 vertex color 仍负责中心、边缘和侧面。
- [`WorldHexField.tsx`](../../packages/world/src/grid/WorldHexField.tsx)：继续复用同一个
  `cellTopColour()` 和一个 `world-grid-hex-field` instanced mesh。
- [`grid-surface.test.ts`](../../packages/world/src/grid/grid-surface.test.ts)：压力矩阵、
  biome 直测、连通块、色带和三条反向 tripwire。

## Biome surface mix

这些是比例意图，不是另建一套 palette；planner 会在普通、非 route/lesson 的 land 上用低频
场表达它们，并在候选不足时保持保护规则优先。

| biome | grass | stone | sand | water | 依据 |
| --- | ---: | ---: | ---: | ---: | --- |
| pine-ridge | 0.92 | 0.03 | 0.05 | 0 | 松岭基本全草，少量裸石/土壤 |
| fall-grove | 0.78 | 0.04 | 0.18 | 0 | 林下土带比松岭更宽 |
| stone-quarry | 0.24 | 0.62 | 0.14 | 0 | 石料是主体，草只留在缝隙 |
| flower-meadow | 0.82 | 0.03 | 0.15 | 0 | 花野仍是草地，保留裸土 |
| mushroom-hollow | 0.66 | 0.16 | 0.18 | 0 | 潮湿菌谷允许石/土露出 |
| logging-camp | 0.68 | 0.10 | 0.22 | 0 | 营地和木料周围是压实土 |
| farmstead | 0.58 | 0.04 | 0.38 | 0 | 田垄以裸土带表达耕作痕迹 |
| dry-mesa | 0.42 | 0.36 | 0.22 | 0 | 旱原是草、岩、砂三者混合 |
| old-ruins | 0.34 | 0.54 | 0.12 | 0 | 遗迹石地明显高于普通草地 |
| palm-shore | 0.50 | 0.04 | 0.28 | 0.18 | 岛缘有水，沙是水草之间的岸线 |

每行均通过 `gridSurfaceMixIsValid()`：所有值有限且非负，和为 `1 ± 1e-6`。合成 61 格
`stone-quarry` 直测中 stone 占比为 `≥ 60%`；合成 61 格 `palm-shore` 直测会生成 water
patch，并通过完整 transition contract。

## 新增约束和实测数字

### 可走性

`gridSurfaceConstraintViolations()` 是纯函数，`assertGridSurfaceContract()` 在
`buildCourseGrid()` 的数据边界调用它。

- route cell 永远为 grass。
- `lessonIndex !== null` 的 cell 永远为 grass。
- water 只允许落在 `kind === "land" && lessonIndex === null`。
- detached water 也拒绝；这避免水被写进岛外的孤立轮廓块。

### 水体连通性和过渡

- `GRID_SURFACE_MIN_WATER_COMPONENT = 5`。
- `GRID_SURFACE_MAX_WATER_BOUNDARY_DISTANCE = 1`，水只能在外缘肩部开始生长。
- 候选水格不能邻接 route 或 lesson；连通候选先 flood-fill，再从一个 seed 做 connected
  prefix 生长，所以不是独立 hash 的散点阈值。
- water 写入后，所有相邻的非保护岛内格先强制为 sand；因此岛内不允许 water 直接贴
  grass。水贴岛外空域不算“水草硬边”。

N 取 5 的依据：1–4 格在当前六边网格的课程机位只读成散点/短条，5 格才是最小可读岸线；
在 41 课的 330 格样本里，5 格只占 `1.52%`，不会强迫短课制造一片湖。

### 色带闸门

canonical role table 是：

```text
grass  0x609d5a
stone  0x77786f
sand   0xc7a663
water  0x2c7f9b
```

用线性化 sRGB RGB 距离、相对 luminance 和 route ivory `GRID_SHARED_SOIL.road = 0xf0e5c7`
测得：

| 指标 | 实测 | 闸门 |
| --- | ---: | ---: |
| 最小两两 RGB 距离 | 0.1897 | ≥ 0.14 |
| 最大两两 RGB 距离 | 0.6642 | ≥ 0.35 |
| luminance span | 0.2224 | ≥ 0.16 |
| stone : route contrast | 3.5608 | ≥ 2.4 |

因此 surface 不会缩成一组近似米色，stone 也不会撞 route 的象牙色。`gridSurfaceColourFor()`
另有测试确保套进 course palette 的四个角色仍不塌成同一个值。

## 压力测试：5 个课量 × 4 个 seed

以下是 `3/8/16/41/60 × 4` 共 20 个真实 grid planner 样本。`cells` 包含 detached；
`components` 是 water 连通块面积，`-` 表示该样本没有 palm-shore water quota 或候选
不足以制造一个合法 patch，因此不会凭空制造小水点。

| 课数 | seed | cells | grass | stone | sand | water | components |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 3 | foundations-before-zero | 28 | 21 | 1 | 6 | 0 | - |
| 3 | seed-b | 26 | 19 | 1 | 6 | 0 | - |
| 3 | seed-c | 28 | 24 | 1 | 3 | 0 | - |
| 3 | another-course | 27 | 25 | 1 | 1 | 0 | - |
| 8 | foundations-before-zero | 67 | 33 | 15 | 14 | 5 | [5] |
| 8 | seed-b | 68 | 50 | 2 | 10 | 6 | [6] |
| 8 | seed-c | 66 | 53 | 4 | 9 | 0 | - |
| 8 | another-course | 66 | 48 | 13 | 5 | 0 | - |
| 16 | foundations-before-zero | 130 | 78 | 22 | 25 | 5 | [5] |
| 16 | seed-b | 131 | 94 | 4 | 25 | 8 | [8] |
| 16 | seed-c | 132 | 101 | 9 | 22 | 0 | - |
| 16 | another-course | 132 | 97 | 21 | 14 | 0 | - |
| 41 | foundations-before-zero | 330 | 223 | 44 | 51 | 12 | [12] |
| 41 | seed-b | 332 | 247 | 19 | 51 | 15 | [15] |
| 41 | seed-c | 330 | 255 | 20 | 55 | 0 | - |
| 41 | another-course | 330 | 211 | 66 | 48 | 5 | [5] |
| 60 | foundations-before-zero | 397 | 266 | 57 | 61 | 13 | [13] |
| 60 | seed-b | 399 | 288 | 28 | 66 | 17 | [17] |
| 60 | seed-c | 398 | 303 | 28 | 67 | 0 | - |
| 60 | another-course | 398 | 240 | 92 | 60 | 6 | [6] |

20/20 样本通过 `gridSurfaceContractHolds()`，约束 violations 全为空；含水样本的连通块
范围是 **5–17 格**。

## 反向 tripwire 结果

| 破坏方式 | 预期红项 | 实测 |
| --- | --- | --- |
| 把水体拆成 3 个散点（0,0 / 2,0 / 4,0） | `water-component:*` | 3 个面积 1 的 component，contract `false` |
| 把 route/lesson cell 设成 water | `walkability:0,0` | contract `false` |
| 把四个 surface color 都设成 `0x808080` | color gate | `minimumPairDistance=0`，gate `false` |
| water 直接邻 grass | `water-grass-transition:*` | contract `false` |

对应测试都在 `grid-surface.test.ts`，不是只留在报告里的人工约定。

## 渲染预算：改前 / 改后

surface 没有加入 geometry、material、mesh 或 batch。课程固定压力课当前的几何拆分是：

| instanced layer | instances | triangles / instance | terrain triangles |
| --- | ---: | ---: | ---: |
| `hex-grid-bed` | 328 | 18 | 5,904 |
| `hex-grid-land` | 287 | 30 | 8,610 |
| `hex-grid-route` | 41 | 30 | 1,230 |
| `hex-grid-detached` | 2 | 30 | 60 |
| 合计 | — | — | **15,804** |

这四个 layer、18/30 triangle geometry 和 JSX mesh 数量在 surface 前后完全相同；因此同一
`1440×900` Chrome 帧的 before / after 是：

| 口径 | 改前 | 改后 | 变化 |
| --- | ---: | ---: | ---: |
| course full frame `gl.info.render` | 41 calls / 81,278 triangles | 41 / 81,278 | +0 / +0% |
| course terrain geometry | 4 batches / 15,804 triangles | 4 / 15,804 | +0 / +0% |
| world `world-grid-hex-field` | 1 batch / 16,974 triangles | 1 / 16,974 | +0 / +0% |
| world full frame `gl.info.render` | 29 calls / 68,632 triangles | 29 / 68,632 | +0 / +0% |

改后真实浏览器取数来自 `.scratch/cost.mjs` 和 world 帧 probe；改前的 batch/geometry
口径由 `main@9cb6f79` 的同一 `hexGeometry` / JSX 结构逐项对照。surface 改动只增加
`setColorAt()` 的 instance color 写入，所以三角形增幅为 0%，远低于 15% 上限。

## 截图与人工复核

接受版由指定命令生成，并在每轮改动后用 `view_image` 逐张看过：

- 真实课程桌面：[real/course-desktop.png](real/course-desktop.png)
- 真实课程手机：[real/course-phone.png](real/course-phone.png)
- 课程设计桌面：[shots/course-design-desktop-post-on.png](shots/course-design-desktop-post-on.png)
- 课程设计手机：[shots/course-design-mobile-post-on.png](shots/course-design-mobile-post-on.png)
- 岛群桌面：[world/world-desktop.png](world/world-desktop.png)
- 岛群手机：[world/world-phone.png](world/world-phone.png)

人眼结论：真实课程近景中前景 olive / grass 的大片差异来自地面本身，路线和 lesson plinth
仍是象牙色；设计桌面右下能读出连续 blue water patch 及其 tan sand shoreline，旁边不是
散落的蓝点；world 仍是同一套 grid 的共享 instanced terrain。手机使用现有 `renderTier()`
路径，没有第二套 surface 或第二套布局。

设计机位的最终像素指标也随截图保存在 `shots/metrics.json`：desktop 的
`grassHueCount=9 / grassHueSpread=120`、`landMedianLightness=57.4681`，mobile 的
`grassHueCount=9 / grassHueSpread=120`；本轮没有改 sky、grade、灯光或相机。

## 试过但否掉的方案

1. **每格独立 hash 选 water**：同一 41 课、foundations seed、外缘 109 个候选中选出
   9 格，得到 `[1,1,1,1,1,1,1,1,1]` 九个水体。杀死它的数字是连通块闸门，不合并。
2. **高频 surface field**：把低频场系数从 `0.43 / 0.27 / 0.37 / 0.19` 提到
   `1.43 / 1.07 / 1.37 / 0.91`。数值色带仍能过 gate，但人工看图时 stone/sand 变成
   逐格棋盘，地面又退回“摆件上色”的感觉。拒收图：
   [rejected-high-frequency/course-design-desktop-post-on.png](rejected-high-frequency/course-design-desktop-post-on.png)。

接受版改回低频波场，并用确定性 tie-break 让 stone/sand 形成较大的连续区域；不是用增加
摆件数量掩盖 surface 的结构问题。

## 验证命令

- `pnpm --filter @pieai/university-world test`：55 files / 385 tests passed
- `pnpm --filter @pieai/university-world typecheck`：passed
- `pnpm --filter @pieai/university-world lint`：passed
- `pnpm --filter @pieai/university-world format:check`：passed
- `pnpm verify`：passed（全仓 typecheck / lint / format / test / boundaries / build / bundle / docs）

未修改 `packages/world/src/sky/**`、`grade.ts`、灯光、相机距离或 `packages/ui`。
