# 地图课程标签对比度复核

日期：2026-08-29

Worktree：`/Users/yuanfei/PieAI/University-wt-labels`

分支：`work/label-contrast`

## 结果

`domLabelContrastMin` 的门槛保持 `4.5:1`，没有修改
`packages/world/src/island/look-contract.ts`，也没有调整任何 ratchet baseline。
固定种子为 `foundations-before-zero`；before 是改动前的基线，after 是
`apps/university/src/styles.css` 的标签 surface 改动。

| Shot | 视口 | Before | After | 结果 |
| --- | --- | ---: | ---: | --- |
| `course-design` | 1440×900 | 1.3002 | **8.6739** | 达标 |
| `course-near` | 1440×900 | 1.0490 | **7.8200** | 达标 |
| `course-far` | 1440×900 | 1.2590 | **8.5492** | 达标 |
| `world-design` | 1440×900 | 12.6155 | **12.6155** | 达标 |
| `course-design` | 390×844 | 1.2522 | **8.5282** | 达标 |
| `course-near` | 390×844 | 1.1724 | **10.2261** | 达标 |
| `course-far` | 390×844 | 2.1876 | **10.5911** | 达标 |
| `world-design` | 390×844 | 13.4513 | **13.4513** | 达标 |

`world-design` 的标签本来就使用已有的 study surface，因此没有需要改变；其余透明的
图标/单元标签是本次修复对象。全部 8 个 shot/viewport 都达到 4.5，最小值为
`7.8200`。

## 采用的方案

选择“标签自己的紧凑 surface”：

- `.label--icon` 和 `.label--unit` 保持为 DOM 文本/按钮，不进入 3D 场景。
- 使用 SwimmerUIKit 已有 token：`--game-ui-overlay-glass-bg`、
  `--game-ui-overlay-glass-text`、`--game-ui-radius-control`、
  `--game-ui-scrim-strong`。
- 图标增加很小的内边距，成为紧凑圆形标记；单元名成为紧凑圆角胶囊。
- 关闭这两个标签上的 `backdrop-filter`，只保留轻微边缘阴影；surface 跟随标签移动，
  不改变场景照明、地形、颜色、相机或地图覆盖范围。

这让标签在海、草、沙地和阴影上都有自己的局部地面，同时把深色面积限制在文字附近，
地图的森林、路线和岛屿仍是主视觉。

## 被考虑但没有采用的方案

1. **每个标签使用更大的实心 dark plate：拒绝。** 临时试验使用
   `--game-ui-overlay-glass-bg-strong` 和更大的 padding。它虽然能增加对比度，但在移动
   截图中把图标变成醒目的黑色方块、把单元名变成黑条，路径看起来像一串盖在地图上的
   UI 印章。证据保留在：
   `SHOTS/island-look/rejected-solid-plate-mobile.png`。
2. **只加 halo/text-shadow：拒绝。** 它能改善边缘，但不能给文字中心提供稳定的地面；
   当标签落在亮背景上时，实际像素尺子仍可能接近 1，因此不能单独承担 4.5:1 合同。
3. **靠 paint order 或全局 scrim：不采用。** DOM 标签已经在 WebGL 之上，改变绘制顺序
   不会改变标签下面的画面；宽范围 scrim 又会给 live WebGL 地图加一层明显的灰暗膜，
   影响远大于本次问题。最终使用的紧凑 surface 保留了“标签自己有地面”的优点，没有把
   整片地图变成面板。

## 浏览器截图证据

以下截图均已在真实浏览器中打开并人工查看；页面等待场景稳定后捕获，尺寸与表格一致。

修改前：

- 桌面近景：[before-course-near-desktop-full.png](SHOTS/island-look/before-course-near-desktop-full.png)
- 桌面设计景别：[before-course-design-desktop-full.png](SHOTS/island-look/before-course-design-desktop-full.png)
- 移动近景：[before-course-near-mobile-full.png](SHOTS/island-look/before-course-near-mobile-full.png)
- 移动设计景别（最差背景复核）：[before-course-design-mobile-full.png](SHOTS/island-look/before-course-design-mobile-full.png)

修改后：

- 桌面近景：[after-course-near-desktop-full.png](SHOTS/island-look/after-course-near-desktop-full.png)
- 桌面设计景别：[after-course-design-desktop-full.png](SHOTS/island-look/after-course-design-desktop-full.png)
- 移动近景：[after-course-near-mobile-full.png](SHOTS/island-look/after-course-near-mobile-full.png)
- 移动设计景别（最差背景复核）：[after-course-design-mobile-full.png](SHOTS/island-look/after-course-design-mobile-full.png)

另外，浏览器中的 `window.__islandLookMetrics()` 返回 `ready: true`。对可见 map canvas
做 `readPixels` 时读到非黑像素，例如桌面设计景别包含
`[54,146,140,255]`、`[82,99,64,255]`、`[255,211,164,255]`；因此没有把 stale tab 的
黑色画布误判成视觉结果。

## 验证与未完成项

- `pnpm --filter @pieai/university-app test`：44 个文件、190 项通过。
- `pnpm --filter @pieai/university-world test`：43 个文件、271 项通过。
- 应用/world lint 与 format check：通过。
- `pnpm e2e:island-look`：通过，1 个测试覆盖 8 个 shot/viewport；完整结果在
  `SHOTS/island-look/metrics.json`。
- `pnpm verify`：类型、lint、格式、生成内容格式、全量测试及前置边界检查通过；在已有的
  `check-raw-colours` 债务处失败。当前 diff 没有新增裸色，失败项是仓库原有
  `apps/university/src/styles.css` 中的未登记颜色（共 18 条）。

标签对比度没有剩余未达标视图；唯一未能全绿的是上述与本次标签改动无关的既有裸色登记债务。
