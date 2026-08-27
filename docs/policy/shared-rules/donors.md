---
id: POLICY-SHARED-DONORS
title: PieAI Donor Catalog
type: policy
status: stable
canonical: true
owner: human
created: 2026-08-17
last_reviewed: 2026-08-28
domain: web3d
tags:
  - shared-rule
  - donors
  - web3d
pinned: true
related: []
supersedes: []
superseded_by: null
---

# PieAI donors

产品线只有这一份名单。找到新的开源仓库时，改**本文件**，不要写进某个产品的
`AGENTS.md`。

## 谁该做什么

- **下游产品 AI**：只读「登记」与「各产品怎么用」里当前产品的一行；只有任务确实需要该
  donor 时才看对应说明。不要在产品仓运行本文件的维护命令，也不要默认克隆整个 donor。
- **PGS / donor 目录维护者**：只有在维护这份唯一目录时，才执行下面四步。下游收到的是
  hash-checked 规则快照，不会带 `check-status.mjs` 或 donor 本地缓存。

## 仅供目录维护者的更新步骤

1. 在下面「登记」表加一行。
2. 克隆到 `<portfolio-root>/_donors/<localPath>/`：
   `git clone --filter=blob:none --single-branch <仓库> <portfolio-root>/_donors/<localPath>`
3. 在「各产品怎么用」里给每个 Web3D 产品写「用」或「不用」。
4. 跑 `node <portfolio-root>/_donors/check-status.mjs`。

`buzz` 是别的缓存，不要放进这张 Web3D 表。

品牌套件（SwimmerUIKit 等）不是 donor，走各仓库的
`docs/policy/shared-rules/brand-kit-first.md`。

---

## 登记

`check-status.mjs` 只读这一张表。列名不要改。

| id | repository | defaultBranch | localPath |
| --- | --- | --- | --- |
| world-of-claudecraft | https://github.com/levy-street/world-of-claudecraft.git | main | world-of-claudecraft |
| threejs-procedural-dungeon | https://github.com/majidmanzarpour/threejs-procedural-dungeon.git | main | threejs-procedural-dungeon |
| spark | https://github.com/sparkjsdev/spark.git | main | spark |
| three-quarks | https://github.com/Alchemist0823/three.quarks.git | master | three-quarks |
| ecctrl | https://github.com/pmndrs/ecctrl.git | main | ecctrl |
| small-world | https://github.com/paulrobello/small-world.git | main | small-world |
| elemental-serenity | https://github.com/SahilK-027/Elemental-Serenity.git | main | elemental-serenity |
| three-stylized | https://github.com/Steve245270533/three-stylized.git | master | three-stylized |
| threejs-awesome-graphics-agent-skills | https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills.git | main | threejs-awesome-graphics-agent-skills |
| threejs-skills | https://github.com/CloudAI-X/threejs-skills.git | main | threejs-skills |

---

## 各产品怎么用

做 3D / 音频 / 壳之前，先找**当前仓库**这一行。写「不用」就不要去搬。

| 产品 | WOC | dungeon | Spark | quarks | ecctrl | small-world | elemental-serenity | three-stylized | threejs-awesome-graphics-agent-skills | threejs-skills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TuringPact | 用：场地、音频、加载 | 用：聚会布局算法 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| YaZu | 用：移动、音频、运行时合同、环境资产 | 用：任务地图、调色思路 | 用：可选远景 | 不用 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| Break | 用：GLB、音频参考、资产模式 | 用：有种子的路线气氛 | 不用 | 用：已装依赖，只做英雄爆发 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| OwnMySpace | 用：起步 GLB、地形/加载/清单 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| Non-Heroes | 用：Wave E 音频、清单模式 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| Show | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| PieAIStudio-Site | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| SwimmerParty-Website | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 不用 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |
| University | 用：音频解锁、三端壳、移动 HUD、资产流水线 | 用：有种子的关卡地图与可达性 | 不用 | 不用 | 不用（待试玩证据） | 用：浮岛高度、平整区、高度采样、程序化 PBR、biome、移动档位与预热 | 用：草/灌木/水/天空风格 shader 的窄适配与视觉参考；媒体隔离可用、来源待确认（见下），不搬第二 renderer | 用：确定性地形噪声、world-space 三角面采样、草风/阴影算法的窄适配，不替换 blueprint 或 LOD 合同 | 用：manual-skills 图形/渲染参考，不自动执行 | 用：manual-skills Three.js 基础参考，按当前版本复核 |

真的拷了文件，把出处记在**那个产品已经有的资产清单**里，不要再为启动阅读另写一份账本。

---

## 每个 donor 是干什么的

### threejs-awesome-graphics-agent-skills

Scottstts 的 Three.js 图形专项 donor，固定在 `v0.9.1`。包含大气、后处理、相机、程序化几何/材质/植被/VFX、体积云、海洋、水面和视觉验证等 24 个技能系统。上游测试通过，但包的 npm peer 约束在 `three@0.185.1` 与 `postprocessing@6.37.4` 之间不一致；PGS 只分发 manual reference，不安装它的 npm runtime 或上游 installer。其降雨示例含 GPL-derived source，保留许可证边界，不直接复制到产品。

### threejs-skills

CloudAI-X 的基础 Three.js 文档 donor，固定在 2026-01-20 的 commit。包含 animation、fundamentals、geometry、interaction、lighting、loaders、materials、postprocessing、shaders、textures 十个 manual reference。仓库没有执行脚本，但若干导入路径、KTX2 CDN 和 WebGPU 版本表述过时；只作为起点，必须按目标项目实际 Three.js 版本和当前官方文档复核。固定 checkout 未提供 LICENSE 文件，保持 private/non-publishable。

### WOC（world-of-claudecraft）

产品模式 donor。代码 MIT；媒体逐项看它的 `CREDITS.md`，不能把 MIT 套到全部媒体。

**能偷：** 音频解锁、音频/音乐流程、Capacitor/Electron 壳、移动 HUD、资产流水线、运行诊断。

**不能偷：** 渲染层。它是 Svelte + 普通 Three.js 0.165，没有 React / R3F，搬不过去。也不要搬品牌名、角色名、付费包、MMO 经济、整仓 HUD。

调色不要来这里找。YaZu 那套来自 dungeon。

### dungeon（threejs-procedural-dungeon）

算法 donor。MIT。

**能偷：** 有种子的地图生成、可达性、调色合成块（冷阴影、暖高光、vignette）。

**不能偷：** 它的应用壳。对比枢轴 0.5 是地牢的，换场景必须重测。

### Spark

可选远景。MIT。要 WebGL2，移动端要过内存门。

**能偷：** Gaussian Splat 风景。

**不能偷：** 可走地面、碰撞、可编辑物件、多人权威地图、可存关卡。

### quarks（three.quarks）

粒子参考。MIT。Break 已当依赖安装，不要把源码拷进产品。

**不能偷：** 已经有对象池撑住的高密度命中流；Quarks 只做英雄爆发。

### ecctrl

研究 spike。MIT。先不要装。它要 Rapier，会改手感。等有试玩证据。

University 是第一个可能真的需要它的产品：世界地图上要不要一个能走动的小人，是它 V1 用户旅程里的公开待决项。先出旅程结论，再决定装不装 Rapier；如果地图只需要点击关卡节点，这条依赖就是纯支出。

### small-world

浮岛视觉与算法 donor。代码 MIT；外部音乐、截图和其他非代码媒体不能从代码许可证推断可再分发。

**能偷：** 稳定 seed 的高度函数、岛形 falloff、稠密近景地形、平整区与高度采样保持一致的做法、运行时生成 normal / roughness 细节、biome 配方、成簇生态摆放、移动效果档位，以及把同步生成拆成可让步预热步骤的加载方式。

**不能偷：** 应用壳、品牌与角色、生物玩法、外部音乐、截图、整套后处理、无限密草，或“当前只有一座圆岛”的产品假设。University 保留自己的课程 blueprint、路线、节点、world / course 语义 LOD 和渲染所有权；采用代码时通过窄 adapter 接入，并记录精确 commit 与文件级来源。

### elemental-serenity

视觉与 shader 算法 donor。代码为 MIT；登记基准为 `main` 的精确 commit
`6b8cebefa0ee10e1bdd081dd342a01b3fe753e09`（2026-06-17）。该仓库的 MIT
只覆盖代码，不覆盖仓库内没有逐文件来源和许可证明的模型、纹理、音频、截图或
CDN 字体。代码依赖的是普通 Three.js 0.182 的单场景
demo，University 不引入它的 renderer、World、GUI、第二 canvas、事件总线或整套
资源。

**媒体（2026-08-28 更新）：** owner 正在与作者直接沟通授权，并指示先按可用推进。
所以媒体从「不进入」改为**「隔离可用，来源待确认」**：进来的每一个文件必须登记进
`packages/world/src/island/*-assets.json` 同款清单，带 `provenance: "author-permission-pending"`
与登记日期，**和已确认 CC0 的 Kenney 分开放、分开记**，这样授权一旦有结论就能精确地拿掉或转正。
只取 shader 实际用到的文件——实测它全部只有 8 个 GLB（约 260KB），其中 `grass_blade` /
`leaf` / `bushEmitter` 合计 4.7KB 且是 shader 的几何载体（几个三角形，随时可用代码重生成），
`bridge` / `camp` / `tent` 是它自己场景的道具，与课程岛无关。真正有价值的是
`public/textures/{grass,bush,ground,water,noises}` 里的噪声与 ramp。**不要整目录搬。**

仍待确认的关键事实不是「作者是否同意」，而是**「这些素材是作者自己做的，还是他从别处下载的」**。
该仓库 README 没有任何 credits 章节；如果是下载来的，作者的许可不构成转授权。这条问题要问到答案，
在那之前所有相关文件保持 `provenance: "author-permission-pending"`。

**能偷：** `src/Shaders/Materials/skydome/*` 的天空配色/大气思路，
`src/Shaders/Materials/bush/*` 的 billboard 风与颜色 ramp，
`src/Shaders/Chunks/grass/*` 的草叶风变形，以及 `src/Shaders/Chunks/water/*`
的 ripple / Voronoi breakup 思路；均须在 University 的单一 R3F renderer、现有
色彩 grade 和 `IslandBlueprint` 高度源下重写为窄 adapter。可在 DEV-only 开关中
切换材质 uniform，切换不得重建 scene、blueprint 或 render loop。

**不能偷：** 把它宣传的季节/昼夜组合当成八个可复用场景；它实际是一个手工编排
world 的颜色和天气状态。它的地面是 5×5 平面上的 fragment paint，不是真实高度；
水面是固定平面，没有课程路线或浮岛底部语义。也不能搬 `frustumCulled=false` 的
无限草、CPU 天气系统、外部媒体或独立后处理。University 的节点可读性、DOM 文本、
单次 tone mapping 和 world/course 语义 LOD 优先。

### three-stylized

地形与草地算法 donor。代码为 MIT；登记基准为 `master` 的精确 commit
`8eb0dde5a8e7eae985d69f923b627b0cf253bed5`（2026-08-11）。README 说明其代码
受 MIT 的 `cortiz2894/stylized-components` 启发/改编；实质抽取须同时保留该上游
归因。仓库为私有 Vite demo，没有可直接安装的产品包，也没有外部模型/音频可供
资产再分发。

**能偷：** `src/grass/Terrain.ts` 的 value-noise / FBM / warped-FBM 视觉算法，
`src/grass/surfaceSampler.ts` 的 world-space 面积加权 barycentric 采样，
`src/grass/coverage.ts` 的 coverage 抽象，以及 `src/grass/shaders.ts` 的风、
tip-mask、背光和 shadow-depth 同步思路。University 只实现自己的 adapter：
采样必须使用 top-only surface，过滤路线/节点安全区，受移动档位和实例上限约束，
并由 `packages/world` 负责明确的 dispose。

**不能偷：** `Terrain.createTerrain()` 作为 University 的高度真相（它只生成矩形
草地），整套 `Grass` facade、无距离裁剪的 `frustumCulled=false`、无上限 density、
demo renderer/GUI/loop，或 donor 的 tone-mapping / colorspace 输出。University
继续由自己的 serializable blueprint 同时驱动地形、路线和节点；若将来复制实质
代码，必须在产品资产/来源清单中记录两个精确 commit 与上游归因。

---

## 还没克隆、只观察

这些在 HQ 技术方向里出现过，需要时再登记、再克隆：

- `xt4d/GameBlocks`：WOC 和现有生态都没有对应做法时才按模块看
- `majidmanzarpour/threejs-procedural-spider`：真要程序化生物动画时再看
- `erincatto/box3d`：还没有浏览器 WASM；物理仍用 Rapier
