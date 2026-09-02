# Grid asset library 扩容报告

日期：2026-09-03
分支：`work/library`
基线：`main@9cb6f79`
应用端口：`18308`

## 结论

完成了 77 → 279 个可用 grid 资产的扩容，新增 202 个烘焙资产。新增资产只来自三个和目标 biome 风格相容的 kit：

| biome | nature base | 新增 accent | 取舍 |
| --- | ---: | ---: | --- |
| `old-ruins` | 保留 | castle 64 | 石墙、塔、门、旗帜、攻城物件；拒绝跨 atlas 色块的墙/塔部件 |
| `logging-camp` | 保留 | survival 78 | 木材、营地、工具、栅栏、棚屋、资源堆；作为完整伐木营资产池 |
| `farmstead` | 保留 | survival 42 | 从 survival 池再收窄到桶、箱、围栏、农具、木材、工作台、乡间棚屋 |
| `palm-shore` | 保留 | pirate 60 | 棕榈、码头、划艇、桅杆、木平台、箱桶和塔；拒绝超预算大船 |

没有把 228 个候选模型全部塞进来：castle 选 64/76、survival 选 78/80、pirate 选 60/72。279 是“接近 300 且能在这些世界里使用”的结果，不是为了凑整数放入明显不搭或无法安全烘焙的模型。

`GRID_BIOMES` 的顺序和字段结构未重排；这里只扩展资产数组、accent 查询和 landmark 资产，四个目标 biome 的 `groundTint` 原值未改动。

## 烘焙方案

`apps/university/scripts/kenney-grid-bake.mjs` 提供纯脚本路径：

1. 读取 GLB 的每个 primitive、索引和 `TEXCOORD_0`。
2. 读取对应 512×512 `colormap.png`，按 glTF 的 UV 方向用最近邻采样；输出每个源顶点的 RGB 字节。
3. 只有当一个三角形的三个顶点仍在同一个 64×128 atlas 色块时才接受模型。跨两个色块的模型抛出 `CROSS_COLOUR_TRIANGLE`，不会平均成一个颜色。
4. 将采样结果写成 `COLOR_0: VEC3 / UNSIGNED_BYTE / normalized=true`，删除 `TEXCOORD_*`、`TANGENT`、`baseColorTexture`、images、textures、samplers，并压缩不再可达的 BIN bufferViews。
5. 重新读取写出的 GLB，逐顶点比较 `COLOR_0` 字节与源 UV 采样结果；同时断言几何 triangles/aspect 不变、没有 UV 和任何纹理引用。

glTF 规范把纹理坐标 `(0,0)` 定义在图像左上角；实现依据：[glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)。因此 PNG 的第一行对应 `v=0`，烘焙使用 `y = round(v * height)`。

## 采样实测与判定边界

这里有一个必须保留在记录里的测量差异：用户提供的 `.scratch/uvsweep.mjs` 使用 `round((1-v) * height)`。这次我先按该方向做过输出，截图显示新增模型整体落在黑色 padding 上；该方案被截图证据杀掉，改为 glTF 方向后重新生成并复核。

直接按 RGB 判断会把同一个 atlas 色块内部的渐变也算成跨色。正确方向下全 kit 的 RGB 变化统计为：

| kit | 模型数 | 三角形总数 | 三顶点 RGB 不全相同 | RGB 变化占比 |
| --- | ---: | ---: | ---: | ---: |
| castle | 76 | 22,095 | 14,116 | 63.89% |
| survival | 80 | 12,665 | 8,770 | 69.25% |
| pirate | 72 | 31,228 | 24,792 | 79.39% |
| holiday | 99 | 28,459 | 21,915 | 77.01% |

这些 RGB 变化大部分是同一 64×128 色块内的渐变，不是要被平均掉的颜色。实现保留每个顶点的精确 RGB，同时以可审计的 atlas 色块边界判定“跨色”。在这个判定下：castle 有 7 个模型、106/22,095 个三角形跨块；survival 和 pirate 均为 0。被选的 202 个源模型因此全部是 `sourceCrossColourTriangles: 0`。

这也解释了为什么报告不把用户表中的 `0.00%` 原样当作实现证明：它和当前脚本的 `(1-v)` 方向绑定，而该方向会把本 kit 的 UV 采到黑色 padding。差异已由黑色截图和修正后的重新测量验证，并记录在这里。

## 无损与反向 tripwire

- 202 个烘焙 GLB 全部通过 `assertBakedGlbLossless`。
- 逐顶点比较：77,348 个顶点；烘焙资产共 44,058 个三角形；每个输出的 `COLOR_0` 都与源 colormap 采样字节一致。
- 202 个输出均无 images、textures、samplers、`TEXCOORD_*`；输出只保留批处理需要的几何属性和颜色。
- `holiday-kit/train-locomotive.glb` 作为反向 tripwire：8/740 个三角形（1.08%）跨 atlas 色块，导入器以 `CROSS_COLOUR_TRIANGLE` 失败，消息包含首个失败位置 `mesh 0 / primitive 0 / triangle 6`。
- `holiday-kit/cabin-wall-roof-center` 曾作为候选检查过；正确 UV 方向下它有 70/80 个 RGB 渐变顶点三角形，但仍在同一 atlas 色块内，所以没有用它冒充跨色 tripwire；最终选用 locomotive 让反向闸门确实能失败。

## 拒绝清单

导入器对每个 donor GLB 要求“显式选中或显式拒绝”，未知文件会使导入失败。当前拒绝共 26 个：

### castle-kit（12 个）

- `bridge-draw`：horizontal aspect `10.0207`，不满足任何 role 的两端尺寸带。
- `ground`：实测零高度，不是可绘制 prop。
- `siege-tower` `1598`、`siege-tower-demolished` `1390`、`siege-trebuchet` `1518`：超过 decoration `1200` 三角形上限。
- 跨 atlas 色块而拒绝：`tower-base` `48/332`、`tower-square-arch` `8/308`、`wall-corner-half-tower` `38/632`、`wall-corner-slant` `4/140`、`wall-narrow-stairs-rail` `2/430`、`wall-narrow-stairs` `2/262`、`wall-pillar` `4/186`。

### survival-kit（2 个）

- `patch-grass`、`patch-grass-large`：实测零高度，是 terrain decal，不是 prop。

### pirate-kit（12 个）

- 尺寸带外：`patch-grass` aspect `21.0923`、`patch-sand-foliage` `13.7182`、`patch-sand` `30.9452`、`platform` depth aspect `11.0206`。
- 超过 decoration `1200`：`ship-ghost` `1703`、`ship-large` `1849`、`ship-medium` `1723`、`ship-pirate-large` `1938`、`ship-pirate-medium` `1812`、`ship-pirate-small` `1461`、`ship-small` `1370`、`ship-wreck` `2282`。

所有资产仍记录实际 `triangles`、`aspect.width`、`aspect.depth`；tree 继续按 `≤900`，其他 decoration 按 `≤1200`，当前选中资产最大为 `1112`，选中 tree 最大为 `482`。

## 性能前后

`PORT=18308 node .scratch/cost.mjs` 的最终实测：

| 指标 | 基线 | 当前 | 变化 | 闸门 |
| --- | ---: | ---: | ---: | --- |
| `frame.calls` | 41 | 41 | 0 | `≤41`，通过 |
| `frame.triangles` | 81,278 | 79,742 | -1,536 / -1.89% | `≤101,597`，通过 |
| `rendererInfo.textures` | 11 | 11 | 0 | 未增加 |
| `hex-grid-prop-library` triangles | 4,862 | 7,046 | +2,184 | 仍为一个 batch |
| manifest 模型数 | 77 | 279 | +202 | 目标约 300 |
| manifest payload bytes | 889,376 | 3,544,564 | +2,655,188 | 资源库增长，非 draw call 增长 |

运行时仍把所有 grid prop 归一到 `position/normal/color` 的同一属性签名，nature 没有颜色属性时使用原有 fallback color；baked kits 使用导入时的 `COLOR_0`。没有增加材质或第二个 `BatchedMesh`。

## 试过但否掉的方案

| 方案 | 杀死它的证据 |
| --- | --- |
| 沿用 `(1-v)` 采样 | 新资产首轮截图整体变成黑色 padding；与真实运行时的 glTF UV 方向不符。 |
| 把 RGB 不同就一律定义为跨色并导入 | 正确方向实测 castle/survival/pirate 分别有 63.89%/69.25%/79.39% 的同三角形 RGB 变化；这些是色块内部渐变。若平均会违反逐顶点无损要求，因此保留精确 RGB、只拒绝跨 64×128 atlas 色块。 |
| 每个 kit 保留一张 colormap、增加材质 | 三张不同 colormap 必然需要三个额外材质/batch；直接违反“不增加 draw call”，所以没有把贴图带进 runtime。 |
| 228 个候选全部导入 | 26 个模型被尺寸、零高度、triangle ceiling 或跨色实测明确杀掉；显式 whitelist 也阻止 donor 更新静默改变产品。 |

## provenance 与产物

`packages/world/src/grid/grid-assets.json` 是扩容后的 manifest，延续原 nature-kit 的 provenance 机制：每个 asset 保存 donor 相对路径、源 GLB SHA-256、输出 GLB SHA-256、pack、版本、CC0 license 文件及 hash；baked asset 还保存 colormap 相对路径/hash、烘焙方法、源测量与 lossless check。三个 accent kit 的 colormap 只作为导入源，不复制到 public runtime。

生成产物目录：`apps/university/public/kenney/grid/{castle,survival,pirate}`。旧入口文件已更名为 `grid-assets.json`，`GRID_NATURE_ASSET_IDS` 仍严格返回原 77 个 nature 资产；accent 资产通过 pack/role/biome 查询接入，不污染旧 API。

## 截图证据

最终按交付命令生成并查看：

- `.scratch/library/real/course-desktop.png`
- `.scratch/library/real/course-phone.png`
- `.scratch/library/shots/course-design-desktop-post-on.png`
- `.scratch/library/shots/course-design-mobile-post-on.png`
- `.scratch/library/shots/metrics.json`

最终 `course-design` 指标：桌面 `landCoverage 0.3006`、`lightnessStdDev 18.8696`、`accentArea 0.0337`；移动端 `landCoverage 0.0774`、`lightnessStdDev 14.8222`、`accentArea 0.0371`。视觉检查未见黑色烘焙块、UV 倒置、贴图残留、明显跨 pack 的材质风格或移动端 UI 越界；近景补拍也能看到木架、围栏、桶等资产的颜色和阴影连贯。

## 已通过 / 最终总闸

已通过：

- `pnpm --filter @pieai/university-app kenney:grid`
- `pnpm --filter @pieai/university-app kenney:grid:test`：2/2
- `pnpm --filter @pieai/university-world test -- grid-theme.test.ts`：54 files / 375 tests
- `pnpm --filter @pieai/university-world typecheck`
- `pnpm --filter @pieai/university-world lint`
- `pnpm --filter @pieai/university-world format:check`
- `git diff --check`
- `PORT=18308 node .scratch/cost.mjs`
- 两组要求的截图命令及人工查看

- `pnpm verify`：通过；包含 workspace typecheck/lint/format、全量测试、module/canvas/public 边界、双模式 build、catalog/content/docs 闸门。

本报告对应的实现已提交到 `work/library`。
