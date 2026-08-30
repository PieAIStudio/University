# Skyworld 执行报告

日期：2026-08-30
分支：`work/skyworld`
验证镜头：`world-design`，固定 seed，`post=off`，desktop `1440×900`，mobile `390×844`

## 做了什么

- 把 `WorldScene` 的可见 world ground 改成天空负空间：复用现有 `SkyDome`，把 world 的
  horizon / nadir 收敛到浅蓝大气色，关闭可见 `AerialWorldPlate` 与 `DeepSea`。
- 保留现有 `CuteCloudSea` 两批实例化云层；没有为 53 座岛复制 `GridCloudLayers`，也没有
  创建第二份 sky / cloud 实现。
- 在 world weather 上加了经截图复核的 `FogExp2` aerial perspective：远岛向 lower air
  收敛，但近中景仍保留课程身份色。该改动不增加网格或 draw batch。
- 加深 `WorldUndersideField` 的共享倒锥，并把岩刺规则提升为每岛 3–5 根。底座和岩刺仍是
  两批 `InstancedMesh`，几何分别为 6 边倒锥和 3 边低模尖刺；总共 53 个底座、160 个岩刺。
- 新增无 Three.js 的 `world-underside.ts` 纯规则与预算函数，并补充真实 53 门课程的测试。
  没有修改 `Maps.tsx` 的 `LessonPlacement` 接口，也没有改变 `packages/ui`。
- 远景瀑布没有加入：在这个固定远景镜头中它只剩亚像素透明纹理，不能形成稳定可读形状，
  还会增加排序和预算风险；课程岛原有的 waterfall 没有动。

## 预算证据

主表使用 capture 脚本写入 JSON 的 `gl.info.render`，这是完整渲染帧的同口径 before/after
比较；每条数据都可在对应 JSON 中复核。截图中心的 `readPixels` 非黑检查也通过。

| seed | viewport | before calls / triangles | after calls / triangles |
| --- | --- | ---: | ---: |
| `foundations-before-zero` | desktop | 34 / 69,022 | **32 / 68,828** |
| `product-website` | desktop | 34 / 69,090 | **32 / 68,896** |
| `generated-assets` | desktop | 34 / 68,858 | **32 / 68,664** |
| `foundations-before-zero` | mobile | 34 / 58,690 | **32 / 58,496** |
| `product-website` | mobile | 34 / 58,758 | **32 / 58,564** |
| `generated-assets` | mobile | 34 / 58,526 | **32 / 58,332** |

World 运行时 JSON 还记录了：`aerialPlateVisible=false`、`deepSeaPresent=false`、
`cloudSeaPresent=true`、`worldUndersideDrawBatches=2`、
`worldUndersideTriangleCount=798`。因此可见海面已经不在帧中，底面没有变成 53 个 draw call。

简报中上一轮记录的 `22 calls / 15,424 triangles` 是旧版 filtered hook 的口径；本次 capture
同时保留了新的 hook 字段，但它包含 instanced API 的完整实例计数，不能和旧字段直接相减。
为避免自报数字或混用口径，本报告只用同一脚本、同一 `gl.info.render` 字段做 before/after，
并保留原始 JSON 作为证据。

## 复用的实现

- 天空：`packages/world/src/sky/skydome.tsx` 的唯一 `SkyDome`，包括现有 sun / atmosphere
  shader。world 只通过 `WORLD_SKY_CONTRACT` 提供投影参数。
- 云：`packages/world/src/sky/cloud-sea.tsx` 的 `CuteCloudSea`，桌面 / 移动仍为两批
  instanced batches。`packages/world/src/grid/GridCloudLayers.tsx` 已阅读，但它是围绕单座
  课程岛的三层局部云；把它复制到 53 座 world island 会重复实现并扩大预算，所以没有采用。
- 地表：`WorldHexField` 原有的一个共享 `world-grid-hex-field`，本次没有拆成按岛绘制。
- 底面：`WorldUndersideField.tsx` 原有的两个实例批次和 `GRID_SHARED_SOIL`；新增的深度、
  岩刺数量、triangle 统计集中在 `world-underside.ts`。
- 视觉验证：沿用 `.scratch/hexgrid-capture.mjs`，增加了 world sky / underside runtime evidence
  字段；未把 capture 工具变成产品运行时代码。

## 截图路径

### Before

- Desktop：
  - `.scratch/skyworld/before/baseline-desktop-foundations-desktop.png`
  - `.scratch/skyworld/before/baseline-desktop-product-desktop.png`
  - `.scratch/skyworld/before/baseline-desktop-generated-assets-desktop.png`
- Mobile：
  - `.scratch/skyworld/before/baseline-mobile-foundations-mobile.png`
  - `.scratch/skyworld/before/baseline-mobile-product-mobile.png`
  - `.scratch/skyworld/before/baseline-mobile-generated-assets-mobile.png`

### After

- Desktop：
  - `.scratch/skyworld/final/final-foundations-desktop.png`
  - `.scratch/skyworld/final/final-product-desktop.png`
  - `.scratch/skyworld/final/final-generated-assets-desktop.png`
- Mobile：
  - `.scratch/skyworld/final/final-foundations-mobile.png`
  - `.scratch/skyworld/final/final-product-mobile.png`
  - `.scratch/skyworld/final/final-generated-assets-mobile.png`

对应 metrics JSON 与 PNG 同名，仅扩展名为 `.json`。

## 视觉判断与未完成项

在 3 个真实课程、两个 viewport 的截图中，匿名观察者应能先读到“天空里漂着许多浮岛”：
连续青绿色海面消失；远岛向蓝色空气渐隐；中心与近景岛仍保留色块；倒锥和尖刺让底部有
垂直悬浮证据。移动端没有单独的组件或第二套布局。

仍有两点诚实的不确定性：

1. 远景岩刺使用 3 边低模尖刺来守住预算，因此它们在极小岛上更像轮廓的三角缺口，不会像
   课程近景里的完整岩石；这是 world projection 的刻意取舍。
2. 隐藏的 aerial plate 仍会加载，以保留 `island-look` ready probe 所需的 `.map.image`；
   它不可见且不提交 draw。若未来 look judge 改为不需要该 probe，可再移除这部分加载成本，
   但本轮没有改判官契约。

## 验证

- `pnpm --filter @pieai/university-world test`：317 tests passed。
- `pnpm --filter @pieai/university-world lint`：passed。
- `pnpm --filter @pieai/university-world format:check`：passed。
- `pnpm verify`：passed。
