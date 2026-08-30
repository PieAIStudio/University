# Skyhigh 执行报告

## 结论

已在 `work/skyhigh` 完成第一层 planet 的替换：它现在是同一片天空里站得更高的共享 world island field，不再绘制独立球体、球面 Goldberg 网格或 planet-only 光照/色表。

真实目录数据为 5 个 study、53 门课、579 节课；首屏生成 1092 个共享 world grid cells。study 列表、进度、详情和「进入 X」DOM 侧保持原样。

## 共享实现与分叉边界

- `packages/world/src/Maps.tsx` 新增 `buildWorldCourseGrid()`，catalogue 与 planet 都从同一份 `projection: "world"` 的 `buildCourseGrid()` 生成课程岛。
- planet 直接复用 `WorldHexField` 的 instanced 六棱柱地形管线、grid palette 和世界 `Weather`；天空、底面、太阳和雾色来自同一套 `WORLD_SKY_CONTRACT` / `WORLD_SUN`。
- `apps/university/src/app/world-model.ts` 只把真实 `CourseNode` 的 id、title、lessonCount、depth 投影为 planet 输入；没有在 planet 再造课程目录。
- 唯一有意的 planet 分叉是相机距离、study/course 的二维分簇和道具数量。独立截图 host 不提供 app 的 public GLB 根目录，所以 `PlanetScene` 的 standalone evidence 将 shared map 的 `props` 置空；产品 catalogue 仍由原有 `WorldPropField` 装饰。这是 brief 允许的 prop-count 分叉，地形、天空、底面和颜色未分叉。
- `packages/ui` 没有引入 `three`；纯布局 `placement.ts` 也没有 `three`。`Maps.tsx` 的 `LessonPlacement` 接口没有修改。

## 分簇判据和阈值

1. 每门课先用 `buildWorldCourseGrid()` 取真实 footprint 的 `halfX/halfZ` 和 envelope center，圆半径取 `max(halfX, halfZ)`。
2. study 内按 course id 排序，从大到小确定性 pack，任意两门课的圆间隙至少为 `0.72` world units，保证簇内不穿插。
3. study 簇按簇半径再次确定性 pack，簇间外轮廓间隙至少为 `2.4` world units；每个簇到最近邻的间隙必须不超过 `18`，保证五摊东西分开但仍是一张 catalogue。
4. 所有 study/course id 都先排序；输入数组顺序、课程数组顺序和 selected study 不参与布局，因此 selection 不会改变场景原点或其他簇的位置。
5. 相机使用 `48°` 高位极角和 `1.14` breathing-room padding，并按 desktop/mobile 的最窄 FOV 拟合实际 field bounds；测试覆盖 `1440×810 / fov 34` 与 `390×844 / fov 42`。
6. 大气透视是主要分隔手段：`fogNearRatio = 0.34`、`fogFarRatio = 2.8`，仍绑定到 fit 后的 camera distance，而不是另造一套 planet shader。

真实数据回归测试位于 `packages/world/src/planet/placement.test.ts`，验证 5 簇、53 课程、簇内/簇间边界、输入乱序稳定性和两种 viewport fit。

## 选中态

选中的 study 同时得到三层反馈：

- 对应课程岛抬升 `0.48` world units；
- 其他 study 的共享 field 变暗，selected cluster 保持清晰；
- selected cluster 生成共享色表中的 focus halo/ring（render order 10），DOM rail 仍显示选中 row、详情和「进入 X」。

真实浏览器中 pointer scan 命中 Buzz 课程岛的 canvas 坐标 `(675,565)` 后，`data-selected = "buzz"`；详情从 TuringPact 变为 Buzz，课程数从 31/362 变为 5/60，且布局投影保持不变。

## 改前/改后证据

截图均为同一 preview host、同一 viewport：

| 状态 | Desktop | Mobile | 备注 |
| --- | ---: | ---: | --- |
| 改前旧球体 | 43 calls / 6,580 tris | 43 calls / 6,580 tris | `gl.info.render` 的 scene pass；黑色星空球体基线 |
| 改后共享岛群 | 11 calls / 36,035 tris | 11 calls / 25,703 tris | 5 study、53 course 的真实共享 grid；低于当前 world `33 calls / 68,464 tris` |

改前的 9 点 `readPixels` 采样保留了黑色星空背景；改后的 desktop/mobile 各 9 点全部 `nonBlack: true`，说明截图不是黑帧误判。改后证据还记录了 `selectedLift: 0.48`、Buzz focus object `visible: true` 和 render order 10。

截图与指标：

- 改前 desktop：[`.scratch/skyhigh/before/planet-desktop-1440x810.png`](./skyhigh/before/planet-desktop-1440x810.png)
- 改前 mobile：[`.scratch/skyhigh/before/planet-mobile-390x844.png`](./skyhigh/before/planet-mobile-390x844.png)
- 改后 desktop：[`.scratch/skyhigh/after/planet-skyhigh-after-desktop-1440x810.png`](./skyhigh/after/planet-skyhigh-after-desktop-1440x810.png)
- 改后 mobile：[`.scratch/skyhigh/after/planet-skyhigh-after-mobile-390x844.png`](./skyhigh/after/planet-skyhigh-after-mobile-390x844.png)
- 选中 Buzz：[`.scratch/skyhigh/after/planet-skyhigh-after-desktop-selected-buzz-1440x810.png`](./skyhigh/after/planet-skyhigh-after-desktop-selected-buzz-1440x810.png)
- 浏览器控制后的选中 Buzz：[`.scratch/skyhigh/after/planet-agent-browser-buzz-final.png`](./skyhigh/after/planet-agent-browser-buzz-final.png)
- 完整 readPixels/GL/布局证据：[`.scratch/skyhigh/after/planet-skyhigh-after-evidence.json`](./skyhigh/after/planet-skyhigh-after-evidence.json)

## 验证

- `pnpm --filter @pieai/university-world test`：49 files、317 tests passed。
- world typecheck、lint、oxfmt check、app typecheck：passed。
- `pnpm verify`：passed，包含 workspace 全量 typecheck/lint/format/test、module boundaries、canvas registry、两种 mode build、shelf/content/lesson-link checks、bundle 和全部 doc-gov checks。
- Playwright real Chrome：desktop/mobile screenshot、real pointer、Tab/Enter、Escape、DOM selection 和 raw WebGL `readPixels` 均完成。
- agent-browser real browser：点击 Buzz 后 snapshot 显示 Buzz heading、5 门课 · 60 节、`进入 Buzz`，eval 返回 `"buzz"`。

## 未完成或不确定

没有功能性未完成项。focus ring 有意保持克制，主选中信号是共享颜色、抬升、非选中衰减与 DOM 详情；证据已确认 ring object 可见，但它不是额外的大号 UI 标牌。

独立截图运行仍会打印依赖侧 `THREE.Clock` 弃用 warning；没有 runtime error。`check-export-freshness` 也提示本机没有 initialized studies，因此 freshness 在此机器上是“未证明”而非失败；全量 `pnpm verify` 仍以 0 exit code 完成。
