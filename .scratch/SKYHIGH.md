# Skyhigh 执行报告

## 结论

第二轮把第一层的视觉粒度改成了正确的单位：一个 study 是一块共享 world landmass，不再把 53 门课的 53 个小岛拉远后冒充星球页。真实目录仍是 5 个 study、53 门课、579 节课；第二轮首屏实际生成 746 个共享 world-grid cells，低于第一轮的 1,092 个 cells。

study 列表、进度、详情和「进入 X」仍是 DOM；第一层只负责用 canvas 呈现五块 landmass、空间关系和选中反馈。

## 共享实现与分叉边界

- `packages/world/src/Maps.tsx` 保留原有 `buildWorldCourseGrid()` 供岛群图使用，并新增 `buildWorldStudyGrid()`：它仍调用同一份 `projection: "world"` 的 `buildCourseGrid()`，只是把 study 体量压成一个高层 landmass 的 field。
- planet 直接复用 `WorldHexField` 的 instanced 六棱柱地形、`WorldUndersideField` 的 soil cone/spike、`grid-palette.ts` 的颜色和 `Weather` / `SkyDome` / `WORLD_SUN`。没有 globe、球面 Goldberg 网格或 planet-only shader/light rig。
- `buildWorldStudyGrid()` 的单个 synthetic route anchor 只让共享 generator 具备合法 route；它不是课程、lesson marker 或第二份课程目录。
- standalone shot host 没有 app 的 public GLB 根目录，因此 planet evidence 将这份 shared map 的 `props` 置空；产品里的 world catalogue 仍由原有 `WorldPropField` 处理。这是 prop-count 的证据边界，地形、底面、天空、颜色没有另造一份。
- `packages/ui` 没有引入 `three`；纯布局 `packages/world/src/planet/placement.ts` 也没有引入 `three`；`Maps.tsx` 的 `LessonPlacement` 未修改。

## 一个 study 的格子公式与阈值

第一层使用 study 的体量，不使用 course-level pack：

```text
footprintLessons = max(12, lessonCount, courseCount × 4)
mainTarget       = min(396, max(24, worldGridTargetForLessons(footprintLessons)))
totalCells       = mainCells + detachedCells ≤ 400
```

`24` 是最小可见/可点 landmass floor；`400` 是已有 shared world field 的单 study ceiling，`396 + 最多 4 个 detached cells` 留出结构余量。`courseCount × 4` 防止课程很多但 lesson export 不完整时地块塌缩；`lessonCount` 仍是更完整数据存在时的主增长项。

第二轮真实数据的 study field：

| Study | 课程 / 节数 | Cells | 半径 |
| --- | ---: | ---: | ---: |
| 通用课 | 1 / 19 | 32 | 5.37 |
| Buzz | 5 / 60 | 96 | 8.69 |
| SupaLuv | 7 / 54 | 86 | 8.30 |
| UniversityLocal 自身 | 9 / 84 | 133 | 10.08 |
| TuringPact | 31 / 362 | 399 | 19.75 |

纯函数布局先按 study id 稳定排序，再按测得 landmass envelope 的 `max(halfX, halfZ)` 从大到小 pack。外轮廓最小间隙是 `2.8` world units；最大最近邻间隙是 `24`，保证五块地分开但仍读作同一张 catalogue。相机使用 `48°` 高位极角和 `1.06` breathing-room padding；输入顺序和 selected study 不参与布局，selection 不会重算场景原点。

真实目录回归在 `packages/world/src/planet/placement.test.ts` 和 `packages/world/src/grid/world-grid.test.ts`：覆盖最小 study、31-course 最大 study、五 study 数量、cell 总量、簇间边界、乱序稳定性和 desktop/mobile fit。

## 选中态与天空

选中的 study 在同一份 `WorldHexField` 上获得三层反馈：

- landmass 抬升 `1.08` world units；
- landmass scale 为 `1.045`，其他 study 的 instance colour 乘 `0.62`；
- 在 landmass 外沿绘制一个 render order `10` 的 focus ring（不再增加 halo draw），DOM rail 同步显示 active row、详情和「进入 X」。

星球页调用的是与课程页相同的 `Weather`，天空 stops 直接复用 `Maps.tsx` 的 `COURSE_SKY_STOPS`，云仍来自共享 `CuteCloudSea`，太阳仍来自 `WORLD_SUN`。星球只改变高度、视距和组合，不换天空；fog 绑定 fit 后的 camera distance，planet 使用 `fogNearRatio = 0.22`、`fogFarRatio = 1.65`，比 catalogue 的远端衰减更强。`cloudLevel = -10.2` 与课程层保持同一垂向语言，另外保留共享 `DistantGround` 作为远端深度。

`.scratch/hexgrid-capture.mjs` 在当前 worktree 中不存在；按同一证据要求实际使用已有的 `packages/world/src/planet/shot.mjs`，它通过真实 Chrome、canvas 坐标 pointer hit-test、Tab/Enter/Escape、`readPixels` 和 Stage scene GL counter 完成抓取。

## 同口径 before / after 证据

两轮都使用同一 preview host、同一真实 Chrome、同一 viewport；表中是 Stage 的 scene pass counter，避免把 post-process blit 当成场景预算。

| 状态 | Desktop 1440×810 | Mobile 390×844 | 备注 |
| --- | ---: | ---: | --- |
| round2 before | 11 calls / 36,035 tris | 11 calls / 25,703 tris | 53 个 course-level objects，第一轮基线 |
| round2 after | 9 calls / 29,102 tris | 9 calls / 18,770 tris | 5 个 study landmass，746 cells；低于第一轮上限 |

改后 desktop/mobile 的九点 `readPixels` 都是 `nonBlack: true`。真实 pointer 在 Buzz landmass 命中后得到 `data-selected = "buzz"`；Tab/Enter/Escape 也通过。默认 TuringPact 选中截图与 Buzz 选中截图证明至少两个不同 study 的 canvas 反馈可见，且两者 projection bounds/cell count 不变。

截图与证据：

- 改前 desktop：[planet-round2-before-desktop-1440x810.png](./skyhigh/round2/before/planet-round2-before-desktop-1440x810.png)
- 改前 mobile：[planet-round2-before-mobile-390x844.png](./skyhigh/round2/before/planet-round2-before-mobile-390x844.png)
- 改前 Buzz 选择路径：[planet-round2-before-desktop-selected-buzz-1440x810.png](./skyhigh/round2/before/planet-round2-before-desktop-selected-buzz-1440x810.png)
- 改后 desktop（默认选中 TuringPact）：[planet-round2-after-desktop-1440x810.png](./skyhigh/round2/after/planet-round2-after-desktop-1440x810.png)
- 改后 mobile（默认选中 TuringPact）：[planet-round2-after-mobile-390x844.png](./skyhigh/round2/after/planet-round2-after-mobile-390x844.png)
- 改后 desktop（选中 Buzz）：[planet-round2-after-desktop-selected-buzz-1440x810.png](./skyhigh/round2/after/planet-round2-after-desktop-selected-buzz-1440x810.png)
- 完整布局、readPixels、GL 证据：[planet-round2-after-evidence.json](./skyhigh/round2/after/planet-round2-after-evidence.json)
- 同世界参考：[clean-foundations-desktop.png](./prettyisle/final/clean-foundations-desktop.png)

## 验证

- `pnpm --filter @pieai/university-world typecheck`：passed。
- `pnpm --filter @pieai/university-world test`：49 files、318 tests passed；第二/第三层共享 world/course 回归包含在内。
- `pnpm verify`：passed；workspace typecheck/lint/format/test、module boundaries、canvas registry、两种 mode build、shelf/content/link、bundle 和全部 doc-gov checks 均为 0 exit。
- oxfmt check：passed；`git diff --check`：passed。
- Playwright real Chrome：desktop/mobile screenshot、真实 canvas pointer、Tab/Enter、Escape、DOM selection、raw `readPixels` 和 scene GL counters 均完成。

## 未完成或不确定

- 功能上没有未完成项；第二/第三层共享 world/course 管线已随最终 `pnpm verify` 再跑一次并通过。
- `shot.mjs` 运行时仍会打印依赖侧 `THREE.Clock` deprecation warning；本轮未改第三方依赖，因为没有 runtime error，也不影响截图或 GL 计数。
- 参考图的课程层包含更近的大型装饰资产；第一层为了保持 study 粒度和预算只保留 shared grid / underside / cloud silhouette。这个减少是本层的刻度取舍，不是把课程文字或课程岛重新塞回 picker。
