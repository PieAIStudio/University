# Prettyisle 执行报告

日期：2026-08-31
分支：`work/prettyisle`（`48a91ed` + `ec34c03`）
`pnpm verify` 已过。
接力：上一位完成 judge-07 后撞配额墙，本轮只收尾主控列出的 7 条，没有重做已验收项。

对照图：`.scratch/TARGET.png` vs `.scratch/prettyisle/final/clean-foundations-desktop.png`（以及 product / generated-assets、岛群图、手机宽度）。

## 原七条差距（judge-07 已验收，本轮未重做）

| # | 差距 | 做到什么程度 |
| --- | --- | --- |
| 1 | 路是构图主角 | 抬高奶白色石道 + 橙色踏板。本轮只改踏板颜色，不改路的几何。 |
| 2 | 崖面太薄 | 多层瓦片厚度保留。本轮只改顶面台地，不改 `cliffBottom`。 |
| 3 | 天空是平的蓝 | 日落渐变 + 柔和云 + DistantGround 保留。 |
| 4 | 道具太小太少 | 松 / 圆冠 / 灌木 / 蘑菇已在。本轮只加块头、去掉树桩。 |
| 5 | 底面不够戏剧 | 倒锥保留。本轮把视觉主角换成岩刺。 |
| 6 | 没有强光向和边缘光 | 暖主光 + 冷轮廓光保留。 |
| 7 | 顶面完全均匀 | 上一轮的顶面色差保留，但把过暗的边改弱，避免读成虚线。 |

## 本轮 7 条收尾意见

### 1. 踏板颜色发暗发浊 — 做到了

颜色只从 `GRID_ACCENT_RAMP` 取，写在 `GRID_LESSON_MARKER_COLOURS`：

- live / idle → `coralLight` (`0xff9a62`)
- done / locked → `coral` (`0xf37958`)

`Maps.tsx` 不再另调橙色。色表三个互相拉扯的测试（亮度分离 / 标记对比度 / 饱和度下限）没有放宽。踏板坐在象牙色石道上，所以用了 ramp 里偏亮的两档，而不是 meadow 对比用的 `coralDeep`。`toneMapped: false` 保留。

截图：`.scratch/prettyisle/final/clean-foundations-desktop.png`、`clean-product-desktop.png`。

### 2. 岛太平了 — 做到大部分

`gridElevationsFor` 不再用逐格噪声（邻域平滑后又变回高原）。现在是一条哈希轴上的 3 个台地带（1 / 2 / 3），路再抬一档，路边强制 `route - 1`。`GRID_ELEVATION_STEP` 从 0.5 提到 0.78。测试要求长课至少 3 个不同高度档。

截图里 foundations 左环路抬高、前缘下降、product 整条路像堤。还不是参考图那种非常干净的三大块梯田——路把岛切成很多局部台阶——但已经不是一整块高原。

### 3. 道具偏小偏细 — 做到了

松树水平放大 1.72、橡树 1.28、圆冠 1.38、灌木 1.42；可见树上限压到约 8 棵，避免盖住地面。`Placement.width` 是可选字段，默认仍等于 height。

### 4. 顶面中央深棕圆柱 — 查清并去掉了

那是 `stump_round`。俯视时 Kenney 圆树桩读成穿模残留，不是道具。课程可见场不再放置它（资产表仍保留，以免拆 donor 登记）。测试：可见 course 场没有 stump。

### 5. 点状虚线轮廓 — 做到了

原因是同高相邻格的微缝：65° 相机从缝里看到崖面，或者共边 z-fighting。`GRID_SEAM_STRENGTH.land` 改为 `-0.02`（轻微重叠）。顶面顶点色不再把边压到 0.8。路和分离格仍保留正缝。同高草地现在读成一片地；高度变化处的崖线仍在，这是 §13 要的。

### 6. 瀑布是扁平蓝矩形 — 便宜改了一点，没有超预算

同一条 `PlaneGeometry`、同一个 draw call：收腰、底部略展开、底端混一点浅色。没有第二张 mesh、没有粒子。仍是一条色带，不是参考图的落点水花。主控说不便宜就保持现状；这条的代价是 **0 draw call**。

### 7. 底面是光滑金字塔 — 做到大部分

倒锥半径缩小成暗核；5 根 instanced 岩刺加大、从岛底垂下去。还是 1 个锥 + 1 个 instanced 批次。参考图的岩刺更像独立雕塑；我们的是低模锥，剪影对了，细节不够。岛群图底面仍走原来的 2 个 instanced 批次（53 座岛，798 三角形），没有拆成 53 个 draw。

## 预算（同口径 `gl.info.render`）

Before 基线：`.scratch/skyworld/final/*.json` 的 `gl.calls` / `gl.triangles`（岛群图）。课程岛没有同脚本的 skyworld 课程镜头 JSON，课程岛 after 与上一轮 `prettyisle/after/matrix` 的 41-serpentine course-design（27 / 20,939）对照。

| 镜头 | seed | viewport | before calls / triangles | after calls / triangles |
| --- | --- | --- | ---: | ---: |
| 岛群图 | foundations-before-zero | desktop 1440×900 | 32 / 68,828 | **33 / 68,464** |
| 岛群图 | product-website | desktop | 32 / 68,896 | **33 / 68,528** |
| 岛群图 | generated-assets | desktop | 32 / 68,664 | **33 / 68,300** |
| 岛群图 | foundations-before-zero | mobile 390×844 | 32 / 58,496 | **33 / 58,132** |
| 课程岛 | foundations-before-zero 41 节 | desktop | 27 / 20,939（上一轮 matrix） | **26 / 19,419** |
| 课程岛 | product-website 19 节 | desktop | — | **24 / 10,311** |
| 课程岛 | generated-assets 3 节 | desktop | — | **19 / 3,021** |

JSON 在对应 PNG 旁边，例如 `.scratch/prettyisle/final/world-foundations-desktop.json`。

`aerialPlateVisible=false`、`deepSeaPresent=false`、`worldUndersideDrawBatches=2` 仍成立。skyworld 那三条测试（无可见海面、底面 instanced、雾远近）继续绿。

### 每条打磨的预算代价

| 打磨 | 代价 |
| --- | --- |
| `GRID_ACCENT_RAMP` 踏板 | 0 |
| 台地高度场 | 0（仍是同一套 hex instance） |
| 草地负缝重叠 | 0 |
| 树冠加宽 | 0 draw；三角形来自已有 Kenney GLB |
| 去掉树桩 | 负或 0 |
| 瀑布收腰 | 0 draw；同一 mesh 多几个顶点 |
| 课程岛岩刺加大 | 0（仍 5 instance / 1 batch） |
| DistantGround（上一轮留下） | **+1 draw call**（岛群图 32→33） |

LOOK-V2 §5 课程岛目标 `< 30` calls / `< 25,000` 三角形：41 节课 **26 / 19,419**，在预算内。

岛群图比 skyworld 基线多 1 个 draw，来自 `DistantGround`（主控已验收的高度感，不是本轮新加）。三角形反而少几百。若必须钉死 32，砍这一张盘即可；本轮没有为收尾再加 draw。

## 截图路径

课程岛（clean，无 UI）：

- `.scratch/prettyisle/final/clean-foundations-desktop.png`
- `.scratch/prettyisle/final/clean-foundations-mobile.png`
- `.scratch/prettyisle/final/clean-product-desktop.png`
- `.scratch/prettyisle/final/clean-product-mobile.png`
- `.scratch/prettyisle/final/clean-generated-assets-desktop.png`
- `.scratch/prettyisle/final/clean-generated-assets-mobile.png`

课程岛（带 UI）：`final/{foundations,product,generated-assets}-{desktop,mobile}.png`

岛群图：`final/world-{foundations,product,generated-assets}-{desktop,mobile}.png`

进度：`.scratch/prettyisle/progress/judge-07/`（接力前）→ `judge-08/` → `judge-09/`（本轮终态）

手机 `--clean` 无法藏掉主栏卡片，岛被 HUD 挡住一块；以 desktop clean 为准，手机看带 UI 的那张。

## 没做完 / 不确定

- 瀑布没有落点岩石和水花。再做就要第二套几何或半透明批次，本轮按「不便宜就保持」停在 0 成本变形。
- 台地是 3 档连贯带，不是参考图那样从镜头里一眼数出四层大梯田。路抬高后局部崖很多，整体仍偏「堤道穿过草地」而不是「三块高原」。
- 岩刺是加粗的 5 边锥，不是参考图里那些带棱的独立石柱。
- `generated-assets`（3 节）哈希到 `rust-down`，顶面本来就是土色，截图读起来像一座棕岛。这是色表身份，不是渲染把草地画成崖。
- 岛群图 33 vs 32：DistantGround。要不要留，请主控拍板。
- Kenney 松树再胖也胖不过参考图的几何圆球松；这是模型，不是第二套树。
- 没有跑 `island-look-matrix.mjs` 全矩阵（上一轮 60 张）。本轮按简报要求抓了 3 门课 × 课程岛/岛群图 × 桌面/手机。

## 铁律核对

1. 色表未绕过；崖面底面仍是 `GRID_SHARED_SOIL`。
2. 预算同上，打磨没加 draw（DistantGround 是上一轮留下的 +1）。
3. 岛群图和课程岛共用 `gridElevationsFor` / `gridPropsFor` / `hexGeometry`。
4. 未改 `LessonPlacement` 接口。
5. `packages/ui` 零 `three`；纯函数层零 `three`。
6. 可读文字仍是 DOM。
7. skyworld 测试继续绿。
