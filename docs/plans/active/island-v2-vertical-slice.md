---
id: PLAN-ISLAND-V2-VERTICAL-SLICE
title: Island V2 Vertical Slice
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-08-27
last_reviewed: 2026-08-27
domain: web3d
tags:
  - island-v2
  - vertical-slice
  - world-map
  - course-island
  - technical-art
pinned: false
related:
  - REF-CURRENT-WORK
  - REF-3D-REFERENCES
  - ADR-0004
  - ADR-0005
---

# Island V2 Vertical Slice：`foundations-before-zero`

## Goal

交付一条从世界地图到课程岛、再到课程阅读器的可试玩垂直切片，证明「岛是课程的自然底盘，路是学习顺序」这句话在数据、画面和点击路径上是同一件事。切片的第一座岛固定为 `foundations-before-zero`：以 `Kenney Nature` 构成自然底盘，再使用一个 `Fantasy Town` 物理强调包。后续星港岛才使用 `Space` + `Modular Space` 两个物理强调包；不能用逻辑族或斜线把多个物理包伪装成一个预算槽。

这次切片要证明的不是一个漂亮的孤立场景，而是以下六个可复用的产品合同：

- 一个没有真实分支的课程，永远只有一条连续语义主线；它可以被画成弧线、马蹄、绕丘环线、回头弯或蛇形，但视觉形状不能制造第二个「下一步」。
- 一份纯数据 blueprint 可以编译出详细的 `course` 投影和远景的 `world` 投影；两套投影共享节点 ID、顺序、地形语义和身份锚点，不复制地图数据。
- 课程岛内相邻节点可以用贴地路表达连续性；世界地图上的岛与岛之间没有桥、木板、栈道或暗示可步行连接的线。
- 单元之间不靠地形、空间分区或不同环境主题切开；同一 unit 的小节节点通过颜色与非颜色符号 / 环形纹样组成视觉家族，状态动画若出现则共享克制的运动词汇，颜色不是唯一线索，课程仍是一条路线。
- 云层是独立可替换的环境模块：用实例化低模云瓣、共享材质和远景 LOD 做出可爱、圆润、有厚度的软雕塑感，不用 ray-marched 真体积云，也不把切片扩成天气系统。
- 可读文字是 DOM；第一阶段通过点击 / 触摸选节点与镜头聚焦完成学习路径，不做流体模拟，也不做自由行走。

本计划已经进入实现与验证阶段：当前专用 worktree 包含 V2 blueprint、双投影、地形 / 岛体、R01 布景、云模块、交互接线与测试。下方复选框仍只由对应的结构测试、真实浏览器、性能测量或治理证据驱动；代码存在本身不等于验收通过。

## Scope

### In scope

- 从现有课程内容与进度端口读取 `foundations-before-zero`，不在地图代码里另写课程、lesson 数量或坐标表。
- 定义并验证可序列化的岛屿 blueprint：课程 / 节点身份、唯一顺序、路线形状、自然地形参数、稳定 seed、语义锚点和主题槽位。
- 从同一 blueprint 编译 `course` 与 `world` 两种投影。课程投影有可点的节点、贴地路和详细装饰；世界远景只保留轮廓、色彩 / 尺度、少量地标和进度等身份线索。
- 在课程投影中支持视觉形状夹具：`arc`、`horseshoe`、`loop-around-hill`、`switchback`、`serpentine`。形状是布局参数，不是先修图或新的课程关系；中心线不得自交，近邻路段须保留不会误读成交叉口的净距。
- 让自然底盘有连续的缓坡、丘陵或凹地；`unit` 只作为 DOM 分组标签，不在 unit 边界生成一级台阶、平台或地形断层。
- 为第一座岛布置 `Kenney Nature` 自然底盘 + `Fantasy Town` 一个强调包，统一尺度、材质和色彩方向；把 `Space` + `Modular Space` 留给后续独立星港配方。
- 定义可扩展的 Kenney 包目录、兼容配方和全局覆盖账本：单岛最多两个强调主题，但产品可以让不同岛组轮换使用所有适合课程语义的合规包；首个切片只实现其中一份配方。
- 让单元边界只出现在语义 / DOM 层：同一 unit 的小节节点共用颜色和非颜色符号 / 环形纹样；状态动画若出现则共享运动词汇，不用地形、空间分区或主题换景制造边界。
- 在同一垂直切片里交付一个独立云模块，优先实例化低模云瓣、共享材质和远景 LOD；云模块能替换且不能遮挡交互或 DOM 信息。
- 在一个共享的 `packages/world` 场景中完成世界地图点选、课程岛聚焦、节点点选和返回路径；authoring / delivery 继续共用学习者面，只由既有端口回答材料、AI 和源码从哪里来。
- 为桌面与手机保留同一组件树、同一 DOM 标签和同一交互意图，并留下真实浏览器截图与可重复的行为断言。

### Out of scope

- 第一阶段的流体模拟、真实水体交互、布料 / 粒子水面和任何依赖物理的漂浮玩法。
- 第一阶段的自由行走、碰撞、可跳跃地形、可旋转探索角色或 Rapier / `ecctrl` 接入；学习者是点选节点，不是操控一个开放世界角色。
- 真实课程分支、Y 型语义分叉、跨岛桥梁、把先修关系画成可走道路，或以视觉弯道替代课程数据。
- 同一座岛的第三个强调主题、未经登记的资产包、从 donor 项目整目录复制素材 / 渲染代码，以及为两个模式或两个投影各写一套实现。这个单岛限制不禁止后续岛组选择其他 Kenney 包。
- 天气系统、风雨 / 昼夜状态、云的物理交互和 ray-marched 真体积云；本切片只验收一个可替换的云环境模块，允许整组云做低频平移，但不增加天气状态或逐云模拟。
- 把课文、课程名、lesson 名、unit 标签、状态提示或按钮文字画进 WebGL 几何；Canvas 只承载世界、路径的视觉反馈和点选命中区域。
- 重写课程内容、发布包、账号 / 支付、阅读器和复习系统。它们沿用当前 V5 与现有端口合同。

## Design Brief

### 学习者要感到什么

学习者从世界远景认出「这是我的课程岛」，点下去后镜头落到同一块自然底盘上；脚下的节点是一条路，而不是一张课程关系图。当前节点明确、下一个节点有轻微强调，其余节点安静地留在连续路线里。完成 lesson 后，回到岛面能看见进度发生了变化，而不是换进另一个不相干的场景。

### 形状为构图服务，主线为语义服务

`foundations-before-zero` 使用现有课程数据的唯一教学顺序。它有 41 个 lesson、6 个 unit，是当前最长的课程之一；首个构图候选固定为紧凑的 `switchback`，让入口、当前节点、后续路线和主题地标在局部镜头内形成清晰方向，又不把整座岛拉成长条。其余测试夹具覆盖 `arc`、`horseshoe`、`loop-around-hill` 与 `serpentine`，确保路线变弯时仍只有一个 `next`。

路线不需要看起来像尺子，也不应为了「好看」切成 Y 字。曲线可以靠近山丘和折返，但中心线不能自交，非相邻路段也不能近到让两段路误读成交叉口。任何一个没有真实课程分支的 blueprint 都必须能按唯一 successor 从起点遍历到终点，且遍历覆盖全部节点。

### Unit 的视觉家族，不是环境分区

不同 unit 之间不换一块地、不切一个空间房间，也不把主题包当作章节背景。主题是整座岛的身份与构图资源，unit 边界只在 DOM 标签和学习语义里出现。

同一 unit 的每个小节节点共享两组恒定线索：一组颜色和一种非颜色符号 / 环形纹样。状态动画只在当前、完成等有意义的状态上出现；出现时，同一 unit 使用同一运动词汇，不能让整条路线不停跳动。颜色失效、低对比或被去色时，符号、环纹、状态和 DOM 标签仍能让学习者认出这一组；这套家族只帮助归组，不增加后继、不改变路形，也不把课程拆成多个分支。

### 云的情绪与边界

云层应像截图里可爱的软雕塑：圆润的云瓣有厚度、边缘清楚、受光柔和，数量和层次由实例化低模云瓣、共享材质与远景 LOD 控制。云是可替换的环境模块，可以在不改 blueprint、路线或主题槽位的情况下换实现；它不是天气系统，也不承担任何学习语义。

### 构图优先级

1. 先让当前节点和下一步够得着、看得懂、点得到。
2. 再让自然底盘的轮廓、坡面和接触阴影说明「这是一座岛」。
3. 再用一个主题建立第一座岛的身份：暖的 `Fantasy Town` 作为人居锚点；冷的 `Space` + `Modular Space` 留给后续星港岛。
4. 远景删去细节，只留可识别的轮廓、主题色块、至多少量身份地标和当前进度线索；不能把远景变成缩小版课程路线。

### 一句反误读规则

弯的是路的外形，不是课程的选择；高低是自然地形，不是 unit 层级；桥只存在于想象里，不存在于世界地图的模型里。

## Core Interaction Contract

| 状态 / 动作 | 学习者看到与操作的结果 | 不允许的替代行为 |
| --- | --- | --- |
| 世界远景 | 看到独立的浮岛轮廓、色彩 / 尺度和少量身份线索；点或触摸岛进入它的课程投影 | 岛之间画桥、木板、栈道、连接线，或在远景显示 lesson / unit 细节 |
| 进入课程岛 | 镜头聚焦同一 blueprint 的 `course` 投影；自然底盘、节点、贴地路和主题细节逐步出现 | 重新生成另一份岛、跳到第二套坐标、用模式分支替换学习者面 |
| 课程路线 | 相邻 lesson 节点按唯一教学顺序排列；贴地路可以连接相邻节点，路面采样同一自然地形 | Y 型语义分叉、无法点到的悬空路、按 unit 边界抬高一级的台阶 |
| unit 视觉家族 | 同一 unit 的小节节点共享颜色和非颜色符号 / 环形纹样；状态动画若出现则共享克制的运动词汇。颜色不是唯一线索，unit 边界不改变地形、空间或主题 | 用换主题、换地面、隔一堵空间墙或单独制造高度层来表示 unit |
| 环境云模块 | 云作为独立可替换的视觉层；实例化低模云瓣、共享材质和远景 LOD 提供圆润厚度，且不遮挡节点、命中区或 DOM | ray-marched 真体积云、天气系统、云的物理交互或让云挡住学习信息 |
| 点选节点 | 当前 / 已解锁节点可点击或触摸，进入共享 lesson reader；键盘和屏幕阅读器可操作对应 DOM 控件 | 要求自由行走、旋转角色找目标，或只能点击 WebGL 内没有语义名称的几何体 |
| 阅读与完成 | 继续沿用 V5 的读完 / 答对和结算合同；完成后的状态回写同一份学习者进度，再返回路线 | 为切片另造一套进度、阅读器或 completion 事件 |
| 文字与标签 | 课程名、lesson 名、unit 标签、状态、提示和按钮全部是 DOM，可选中、聚焦、缩放和读出 | TextMesh、Canvas 绘字或把可读文字烘进纹理 |
| 双模式与设备 | authoring / delivery、桌面 / 手机共享同一学习者组件树与交互意图；差异只留在既有端口 | `AUTHORING ? … : null` 隐藏学习者能力，或为手机另做一套地图组件 |

### Blueprint 的最小合同

蓝图是纯数据，不持有 Three.js 对象或 React state。至少包含：稳定版本、`studyId`、`courseId`、节点 ID 与有序索引、`next` / 终点关系、路线形状与参数、自然地形 seed / 高度参数、轮廓、入口 / 地标 / 终点锚点和不超过两个的主题槽位。unit 的分组语义可以随节点数据存在，但不能变成地形分区；云模块引用独立于蓝图。投影编译器只接受蓝图和 `course | world` 档位；任何需要另写顺序、坐标或关系的调用方都退回设计评审。

## Level / Composition Plan

### Level 0：世界地图投影

- 用稳定的俯瞰 / 远景镜头展示第一座岛与其他岛的间隔，保留「这是哪门课」的轮廓和色彩线索。
- 远景的细节预算只给身份：自然底盘的轮廓、已选强调主题的主色块、入口 / 地标中的少量可辨认形体和当前进度提示。lesson 圆盘、unit 分组、贴地课程路与可读标题由远景 LOD 隐去。
- 远景云只作为可替换的软雕塑层参与轮廓和纵深，不得用云的密度、颜色或位置表达 unit 边界；低模云瓣的 LOD 不能遮住世界点选和 DOM 信息。
- 世界投影的岛屿边界不出现跨岛几何；即便课程之间有先修关系，也由状态、标签和点选表达。
- 第一次点选要把学习者带进同一 blueprint 的课程投影，而不是切换到另一份课程岛模型。

### Level 1：`foundations-before-zero` 课程岛

- 课程数据从现有 content / reader 端口读取；切片不复制 lesson 内容和数量，不用数组下标挂手工装饰。
- 首个构图使用紧凑回头弯作为视觉路线：入口清晰，41 个 lesson 节点与 6 个 unit 沿唯一顺序落在同一自然底盘，节点间的道路贴地并留出点击与 DOM 标签空间。
- 自然底盘贯穿全岛，起伏由连续高度函数提供；任何 unit 标签变化只改变 DOM 分组和导航提示，不改变地面高度或道路拓扑。
- 首岛只用 `Fantasy Town` 建立人居身份锚点，并让自然底盘穿插其间；它不代表课程分支、不独占某个 unit，也不把主题边界伪装成 unit 台阶。`Space` + `Modular Space` 是后续独立星港岛的双包配方，不进入首岛。
- 同一 unit 的小节节点保持颜色 + 非颜色符号 / 环形纹样的视觉家族；有意义的状态动画共享同一运动词汇但不会让所有节点持续跳动。即便两个 unit 处于同一片环境，颜色之外仍能靠符号、环纹和 DOM 标签区分家族，路线语义不变。
- 把云模块作为独立后续工作包插入同一切片：圆润、有厚度的低模云瓣用实例化 / 共享材质 / 远景 LOD 组合，云在任何镜头下都不能盖住节点、交互命中区或 DOM 标签。
- 当前节点、下一节点、头像 / 进度反馈和回到世界地图的出口留出稳定屏幕区域；道路和装饰不能压住节点、DOM 标签或手机安全区。
- 需要展示长路线时，先用测试 blueprint 验证 `horseshoe`、`loop-around-hill`、`switchback`、`serpentine`，再决定哪些形状值得进入内容数据；第一座岛不为展示算法而牺牲可读性。

### Level 2：形状与尺度夹具

- 用短、中、长三组纯数据夹具覆盖弧线、马蹄、绕丘环线、回头弯和蛇形；每组只改变布局参数，不改变节点 ID、顺序和 successor 数量。
- 用带两个 unit 边界的夹具验证自然地形连续，特别检查 unit 边界不会生成第一层台阶、平台或误导性的 Y 路口。
- 用 world / course 两个投影对同一夹具做快照或结构比较：共享蓝图身份与锚点，world 只保留身份，course 才展开节点、贴地路和细节。
- 用可替换的云模块替身做一次投影回归：替换云不会改变 blueprint、节点顺序、主题槽位或 world / course 的语义；同时记录云的遮挡盒、实例数量和远景 LOD 结果。

## Technical Art Brief

### 资产与主题预算

| 层 | 允许内容 | 预算 / 约束 |
| --- | --- | --- |
| 自然底盘 | 浮岛轮廓、连续地形、岩层、植被和接触阴影；自然物件优先取自 `Kenney Nature` | 每座岛必有；不占强调主题槽，不承担课程分支语义 |
| 强调主题 1 | `Fantasy Town` | 一个主题槽；只用可登记、可追溯的资产 |
| 强调主题 2 | 首岛留空；后续星港可用 `Space` + `Modular Space` | 首岛不强行填满槽位；每座岛按视觉需要选择 0–2 个物理强调包 |
| 学习者 / UI | 共享头像 kit、DOM HUD、标签和按钮 | 不计为第三岛屿主题；不把 DOM 文字画进场景 |
| 环境云 | 可替换的低模云瓣、共享材质、实例化批次与远景 LOD | 独立模块；不计为第三主题，不做 ray-marched 真体积云或天气系统 |

主题使用逐项记录来源 URL、精确 commit / 版本、资产 ID、许可证和导入结果；遵循现有 `import-kit` / provenance 清单。Kenney 的 CC0 事实不能替代单个导入条目的来源记录，也不能授权把 donor 的渲染实现复制到 University。

首个切片把原始 GLB 角色控制在约 12–18 个：自然底盘占多数，Fantasy Town 只承担人居 / 废墟锚点。重复物件优先实例化，同一聚类用 3–7 个部件形成大小、朝向和疏密变化；这是一条避免“素材目录倾倒”的审美预算，不是限制最终可见丰富度。科技岛的 `Space` + `Modular Space` 另做配方和测量。

全局另维护「包目录 → 审核过的角色 → 兼容配方 → 已分配岛组」覆盖账本。目标是让每个适合产品语义的 Kenney 包最终至少进入一份配方，而不是把每一个近重复、固定拼块、过重或语义冲突的 GLB 强行摆进场景。主题配方是可序列化数据；渲染器只消费配方，不出现按课程 ID 特判的模型分支。

### Donor 登记与窄适配（2026-08-27）

`small-world` 已在 PGS canonical donor catalog 登记，University 在「各产品怎么用」中标记为「用」：仓库是 [paulrobello/small-world](https://github.com/paulrobello/small-world.git)，默认分支为 `main`，catalog `localPath` 为 `small-world`；本地 clone `<portfolio-root>/_donors/small-world` 已核验到精确 commit `10bd3bbf797898a6c094f573ac4773e0ff81f65e`。本计划只引用该 canonical 登记事实，不修改本仓库的 downstream donors snapshot；catalog 的同步与状态检查仍由 PGS / donor 目录维护者负责。

University 只通过窄 adapter 吸收该 commit 的局部算法，不复制 app 或整套渲染实现。允许的适配面严格限于：stable-seed height、岛形 falloff、flat-zone / sampler consistency、procedural normal / roughness、biome / cluster 摆放、mobile-tier，以及可让步的 prewarm；对应研究来源固定在该 commit 的 `src/seed.js`、`src/terrain.js`、`src/pbr.js`、`src/biomes.js`、`src/world/flora-placement.js`、`src/world/ground-cover.js`、`src/lowfx.js` 和 `src/world.js`，真正接入时仍要在现有资产 / provenance 记录里写文件级来源。适配必须继续服从 University 自己的 blueprint、课程路线、world / course 语义 LOD 和单 renderer 所有权。

明确不搬：app shell、角色 / 生物玩法、外部音乐 / 截图等非代码媒体、无限密草，以及 donor 当前“单圆岛”的产品假设；也不把这些边界通过别名、整目录复制或新依赖绕开。当前运行时没有引入 donor 整仓或其媒体。

`elemental-serenity` 与 `three-stylized` 已由 PGS donor 目录维护者登记（本轮精确 clone 均与远端分支对齐）；本计划只引用 canonical catalog，不在 University 维护第二份 donor 表。两者都以窄算法 / 视觉参考方式使用，不作为整仓运行时依赖：

- `elemental-serenity`：`main`，精确 commit `6b8cebefa0ee10e1bdd081dd342a01b3fe753e09`；只重写草/灌木 billboard 风、天空/水面层次等 shader 思路，保留 University 的 R3F 单 renderer、单次 grade 和 blueprint 高度源。仓库 MIT 仅覆盖代码，未逐项清权的模型、纹理、音频、CDN 字体不进入产品。
- `three-stylized`：`master`，精确 commit `8eb0dde5a8e7eae985d69f923b627b0cf253bed5`；只抽取确定性 value-noise/FBM 视觉算法、world-space 面积加权表面采样、coverage 抽象和草风/阴影同步思路。实质代码抽取同时保留其 README 指向的 `cortiz2894/stylized-components` MIT 上游归因；不把矩形 Terrain 当作 University 高度真相。

### 其他 Donor 研究观察（2026-08-27，未登记、未采用）

除上方已登记的三个 donor 外，以下固定提交只是本轮只读观察记录，不是 University 的产品依赖，也不构成新的平行 donor 目录；这些观察 donor 仍保持未登记、未采用。任何代码或资产采用前，必须先由 PGS / donor 目录维护者更新唯一 donor catalog 并通过相应状态检查。

没有找到另一个可以整体替换当前生成器、同时满足 seeded blueprint、非自交路线、手工感散布、WebGL2 和低成本云层的成熟 donor。保留 University 自己的语义合同，只吸收局部、可撤回的算法：

- [ZyFou/ProceduralTerrains](https://github.com/ZyFou/ProceduralTerrains)（MIT 核心，固定提交 `bbf76ff69d1d01924b0e5c456866e304e00425c4`）：参考可序列化 noise、CPU/GPU 高度一致、chunk skirt、实例化 LOD 和低分辨率云上采样；不带入其 GPL-3.0 Blender 扩展。
- [redblobgames/mapgen4](https://github.com/redblobgames/mapgen4)（Apache-2.0，固定提交 `c1d8cb018a11a8b9e17d59233c36c176429d37eb`）：参考约束 Poisson 点、边界 / 山峰约束和 distance field；Apache attribution 随研究记录保留，暂不复制完整地图管线。
- [IceCreamYou/THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain)（MIT，固定提交 `9c5b0f71d2194b1cd6608932a92424c59d06a414`）：参考按面散布、坡度 / 法线对齐和地形 falloff；其全局 `Math.random()` 不直接进入 University 的确定性蓝图。
- [SebLague/Path-Creator](https://github.com/SebLague/Path-Creator)（MIT，固定提交 `619c4c39d8a5a5d85914cc4c315121c288c32327`）：只参考贴地 ribbon 的采样 / 法线思路，不引入 Unity 运行时。

被否决或暂缓的候选（GPL、许可证不可验证、WebGPU / Godot / Rust 锁定或成熟度不足）不进入产品依赖。即使获得作者授权，外部代码也只通过独立 adapter 接入，方便回滚和替换。

### 视觉与渲染

- 自然底盘采用低多边形、哑光、可读轮廓；暖 / 冷两个主题共享比例、材质粗糙度和项目色彩管线，靠少量地标与材质细节建立差异，不用 unit 分区或无限加资产。
- 灯光先说明坡面和节点的接触关系，再谈调色；tone mapping 只编码一次，保留至少一层受控 grade / post，避免两种投影各自拥有不同的颜色管线。
- 世界投影优先轮廓、雾和主题色块；课程投影优先节点、地面路和接触阴影。LOD 减少细节，不改变蓝图语义。
- 一个 Canvas 只有一个 renderer owner 和一条 render loop；`packages/world` 持有场景，`packages/ui` 不引入 Three.js。DPR 限制在现有移动档位，移动 / 桌面输入通过意图和安全区契约适配。
- 第一阶段可使用静态 / 低成本的天空、云海或背景水面来交代尺度，但不做流体模拟、实时水体交互或自由行走；音频若加入，先满足首次手势解锁。
- 运行时不得依赖外部 CDN；新增库、donor 或 kit 能力先走对应 portfolio 规则，不能为了这一座岛临时装一套平行系统。

性能预算是效果优先后的护栏，不是事先砍画面的理由。首轮目标：桌面 ≤300 draw calls、≤750k 可见三角形、≤60 张纹理、估算 GPU 资源 ≤256 MB；移动 ≤150 draw calls、≤300k 可见三角形、≤40 张纹理、估算 GPU 资源 ≤128 MB，DPR 沿用现有 1.5 上限。若真实测量超线，先做实例化、离线简化、纹理合图和语义 LOD，不能先删掉路线清晰度、主地标或科技岛底；若效果确实需要调整预算，必须记录设备、镜头和测量证据。

### 语义流式 LOD 决策

LOD 是按学习语义管理 resident 资源的流式策略，不是只在一个场景里切换可见性。世界和课程使用同一份 blueprint，但详细资源按焦点和投影动态构建：

| 语义状态 | Resident / 构建内容 | 过渡与预算 |
| --- | --- | --- |
| 世界地图 | 只常驻 blueprint / manifest、low LOD silhouette 和少量 hero proxies；不常驻 lesson 节点、unit 分组、贴地课程路或课程细节 | 所有岛可共享这层低模身份，文字仍由 DOM 提供；低模必须可点且不遮住标签 |
| focus / 预热 | 对当前聚焦岛可预热中档资源，低模仍保持在场 | 中档准备好以前不清空低模；预热须可让步、可取消，不阻塞地图交互 |
| 进入课程岛 | 动态构建 high LOD：dense terrain、PBR、route flatten、grass 和已选 Kenney 资产 | high LOD 使用同一 builder 的桌面 / mobile tier；移动档可降密度与效果，但保留路线、地标和节点身份 |
| 投影切换 | low model 先保持，待目标档位 ready 后 crossfade，再移除不再需要的旧 resident 资源 | crossfade 不改变 seed、DNA、landmark identity 或 DOM 语义；world / course 不是同一块 resident mesh |
| 详细资源缓存 | 详细 resident 的 LRU 只保留当前岛和最近一个岛 | 淘汰必须真正卸载并 dispose geometry、material、texture、instance buffer 及未完成构建；不得以 `visible = false` 冒充释放 |

`THREE.LOD` 如果存在，只能作为同一 resident 对象的视觉分辨率选择，不能承担 residency、LRU 或释放语义；禁止用 visibility-only 的 `THREE.LOD` 留住所有高模。world 与 course 必须共享相同的 seed / DNA / landmark identity，却允许拥有不同的 resident mesh、细节预算与生命周期。释放和 crossfade 都由 `packages/world` 的单一 renderer / render loop 管理，不得为两种投影各写一套场景。

### 云模块实现边界

云模块只公开环境层需要的最小输入（镜头档位、密度预算、主题色和安全区域），不读取课程顺序、unit ID 或进度来决定云的形状。默认实现优先实例化一组低模云瓣和共享材质，远景减少实例数 / 面数并保持圆润轮廓；若需要漂移，只移动整个实例批次，不建立逐云天气模拟。模块可替换为静态 stub 供数据和交互测试使用。

独立验收至少要测三件事：云替身替换前后蓝图与路线结构相同；云的屏幕包围盒不覆盖节点命中区、头像、导航栏或 DOM 标签；渲染路径没有 ray-marched 真体积云、天气状态机或新的持续模拟循环。

### DOM 与无障碍

课程名、lesson 名、unit 标签、状态说明、按钮和错误提示都是 DOM，并拥有可定位的语义关系与焦点顺序。WebGL 命中区域只负责把点选意图送给同一套 DOM / 路由动作；测试不能只调用 `.click()`，要在真实视口中先验证命中区域没有被透明 overlay、导航栏或面板遮住。

### 节点可读性与地表安全区

节点可读性不依赖裸露的白圆盘，也不能把白色圆盘当作远近景唯一 fallback。节点的视觉识别组合使用 halo、icon 和有意义且克制的状态 animation；精确名称、unit、状态与提示继续使用 DOM label。点选意图由与视觉节点同位的 large invisible hit volume 承接，并同步到同一 DOM 控件，保证鼠标、触摸、键盘和屏幕阅读器都能到达同一节点。

草不以“无限密”填满安全区：只在必要的路线 / 节点安全区排除或压平草，路面、节点和地标继续使用同一 height sampler；其余地表才按当前 biome 与移动档位布置 ground cover。安全区的排除 / flatten 结果必须随路线和节点测试，不能靠一张白盘遮住穿草、悬空或不可点击的问题。

## Phased Steps

> 当前实现已进入以下工作包。每项只有在留下变更文件、可复跑命令、截图或结构断言，并记录尚未解决的风险后才能勾选；未勾选不表示没有代码，只表示证据尚未闭环。

### Phase 0 · 冻结合同与测试夹具

- [ ] 以本 V5 §08 和本计划为单一设计入口，确认 `foundations-before-zero` 的内容仍从现有 content / reader 端口来，地图不持有第二份课程事实。
- [ ] 盘点当前 `packages/world` 的 blueprint、course layout、world layout 和资产清单；保留已有实现，先找可以复用的一个 renderer / 一个纯函数，再决定最小扩展点。
- [ ] 定义序列化 blueprint 的字段、版本和 invariant：唯一节点索引、无分支时的 successor 上限、终点、路线形状、连续地形参数、主题槽位和身份锚点。
- [ ] 定义全局 Kenney 包目录、兼容配方与覆盖账本的数据形状；证明全局可以登记多包而任一岛的强调主题仍不超过两个。
- [ ] 写短 / 中 / 长与两个 unit 边界的纯数据夹具，夹具不引入真实课程内容和手工屏幕坐标。
- [ ] 先为 `course` / `world` 投影写结构断言，再开始模型或材质调整，避免艺术改动掩盖数据分叉。
- [ ] 为独立云模块冻结最小输入 / 替换接口和遮挡预算；把「云不是天气系统」写成测试夹具的边界，而不是留在美术口头约定里。
- [ ] 冻结语义流式 LOD 的 resident 状态、focus 预热、low-to-high crossfade、详细资源 LRU（当前 + 最近一个）和真正卸载 / dispose 合同；明确 `THREE.LOD` 不能替代 residency 管理。
- [ ] 冻结节点的 halo / icon / 克制 animation、DOM label、large invisible hit volume 与路线 / 节点草安全区合同；不以裸白圆盘承担可读性。

### Phase 1 · 首座岛可试玩切片（不做流体模拟 / 自由行走）

- [ ] 从 `foundations-before-zero` 现有课程数据生成一份可序列化 blueprint，稳定 seed 不随内容文案小修而漂移。
- [ ] 编译同一 blueprint 的 `world` 与 `course` 投影；世界档只留身份线索，课程档展开节点、贴地路、自然地形与已登记主题。
- [ ] 世界地图只常驻 blueprint / manifest、low LOD silhouette 和 hero proxies；focus 时可让步预热中档，进入课程岛后动态构建 high LOD 的 dense terrain / PBR / route flatten / grass / 已选 Kenney 资产，低模在目标档位 ready 前保持并 crossfade。
- [ ] 让 world / course 共享 seed、DNA 与 landmark identity，但不共享同一 resident mesh；详细资源缓存只保留当前岛与最近一个岛，离开时真实卸载并 dispose，不用 visibility-only `THREE.LOD` 假装释放。
- [ ] 先完成 `Kenney Nature` 自然底盘和连续起伏，再通过通用主题配方放置 `Fantasy Town`；逐项登记 Kenney 资产 provenance，并拒绝同一岛未经配方登记的第二 / 第三个强调主题。不得为首岛添加课程 ID 条件分支。
- [ ] 让 41 个课程节点沿紧凑回头弯按唯一顺序可点，贴地路贴合地形；6 个 unit 标签落在 DOM，不改变地形或生成一级台阶。
- [ ] 给同一 unit 的小节节点接上颜色和非颜色符号 / 环形纹样；状态动画仅在有意义时出现并共享克制的运动词汇。在去色或颜色不可用时，符号 / 环纹 / DOM 仍能完成归组。
- [ ] 以 halo / icon / 有意义的状态 animation、DOM label 和 large invisible hit volume 验证节点可读、可点、可聚焦；在必要的路线 / 节点安全区排除或压平草，不用白圆盘或无限密草遮盖问题。
- [ ] 交付独立云模块的首个实现：圆润有厚度的实例化低模云瓣、共享材质和远景 LOD；用静态替身检查模块可替换，且云不遮挡节点或 DOM。这里不做 ray-marched 云、天气状态或云的物理。
- [ ] 接入点 / 触摸选岛、镜头聚焦、点节点进共享 reader、返回地图和完成状态反馈；不添加角色自由行走或物理碰撞。
- [ ] 以桌面和手机真实浏览器各走一次 authoring / delivery，记录截图、可见 DOM 文本、命中区域和错误日志。

### Phase 2 · 形状、LOD 与三端硬化

- [ ] 让五种形状夹具通过同一布局入口生成，证明改变形状不改变节点 ID、顺序和 successor；没有真实分支的夹具不得出现 Y 型语义路口。
- [ ] 验证自然地形在 unit 边界连续；检查道路、节点和装饰始终采样同一高度函数，没有悬桥或隐形台阶。
- [ ] 验证 world / course 的蓝图字节、seed、锚点和主题槽位一致；world 远景不渲染 lesson / unit 细节或跨岛桥接对象。
- [ ] 通过真实镜头和内存 / GPU 记录验证 streaming LOD 的 low 保留与 crossfade、focus 中档预热、high 动态构建、当前 + 最近一个 LRU，以及 geometry / material / texture / instance buffer 的真实卸载与 dispose。
- [ ] 验证 world / course 的 seed、DNA、landmark identity 相同但 resident mesh 不复用；mobile tier 降密度 / 效果而不删路线、地标、节点或 DOM 语义。
- [ ] 完成 DOM 标签的碰撞 / 避让、键盘焦点、屏幕阅读器名称、手机安全区和真实 pointer hit-test；特别复查透明 overlay 不抢点击。
- [ ] 在去色、低对比、切换 LOD 和手机视口下复查 halo / icon / 状态 animation / DOM label / large invisible hit volume；确认必要安全区的草已排除或压平，且不靠裸白圆盘维持可读性。
- [ ] 单独验收云模块：换掉云实现不改变任何课程语义；云的实例 / LOD 预算可记录，屏幕包围盒不覆盖节点、命中区或 DOM；源码中没有 ray-marched 真体积云或天气系统。
- [ ] 按 Web3D 基线复查 renderer owner、tone mapping / sRGB、grade、DPR、音频解锁、输入意图和无外部 CDN；记录移动性能和截图证据。

### Phase 3 · 集成、发布前验收与 closeout

- [ ] 在不改 V4 的前提下，核对 V5 §08、本计划、当前工作索引和实现路径没有互相复制或矛盾的规则。
- [ ] 运行最小相关测试，再运行项目要求的 `pnpm verify`；失败时先修复本地 gate，不把 hosted CI 当调试循环。
- [ ] 通过 authoring / delivery × desktop / mobile 的行为和视觉矩阵；保留世界远景、课程岛、节点点选、回退和 completion 的证据。
- [ ] 记录已知缺口：流体模拟、自由行走、真实课程分支、更多主题、天气系统和完整发布素材均留在后续计划，不在切片完成线上假装存在。
- [ ] 只有所有验收闸门都通过，才把本计划从 `docs/plans/active/` 移到 `docs/plans/completed/` 并把状态改为 `completed`。

## Acceptance Gates

### Gate A · 语义主线

- [ ] 对没有真实分支的 blueprint，从起点沿唯一 `next` 可遍历到终点，恰好覆盖全部节点；没有节点拥有两个可选后继。
- [ ] `arc`、`horseshoe`、`loop-around-hill`、`switchback`、`serpentine` 夹具只改变位置 / 切线，不改变节点 ID、顺序、unit 标签或 successor 数量。
- [ ] 第一座岛的视觉弯道不会产生 Y 型语义分叉，路线中心线不自交，非相邻路段满足基于路宽和节点半径计算的最小净距；如果未来内容真的声明分支，必须先走新的产品设计和数据合同，不能由渲染器猜出来。

### Gate B · 单蓝图双投影

- [ ] course / world 由同一份可序列化 blueprint、版本、seed、语义锚点和主题槽位编译；没有每个投影私有的课程顺序或坐标表。
- [ ] course 投影的相邻节点路段都贴合自然地形；world 投影的跨岛桥、木板、栈道和连接线对象数量为 0。
- [ ] world 远景只显示身份线索；lesson 节点、unit 标签、课程贴地路和可读文字不进入远景 LOD，必要文字仍由 DOM 在明确上下文中显示。
- [ ] world 只常驻 blueprint / manifest + low LOD silhouette / hero proxies；focus 可预热中档，课程进入时动态构建 high LOD dense terrain / PBR / route flatten / grass / selected Kenney，low 先保留并 crossfade；详细 LRU 只有当前 + 最近一个，淘汰会真实卸载 / dispose。
- [ ] world / course 共享 seed、DNA、landmark identity 而不共享 resident mesh；`THREE.LOD` 不能以 visibility-only 替代 residency 或 dispose。

### Gate C · 自然底盘与主题预算

- [ ] 每座岛的强调主题槽位长度 ≤2；`foundations-before-zero` 严格使用 `Kenney Nature` 自然底盘 + `Fantasy Town`，未登记的第二或第三强调主题无法通过清单校验。
- [ ] 全局包目录可以登记多于两个 Kenney 包，兼容配方与覆盖账本能把不同包分配给不同岛组；渲染器只消费主题配方，没有按 `courseId` 选择模型的特例代码。
- [ ] 自然高度函数在 unit 边界连续；没有 unit 触发的一级台阶、平台抬升或把章节误读成楼层的断层。
- [ ] unit 不通过地形、空间分区或环境主题切开；同一 unit 的小节节点共享颜色和非颜色符号 / 环形纹样，状态动画只在有意义时共享运动词汇；去掉颜色后仍能归组，且课程仍是一条路线。
- [ ] Kenney 资产逐项有 provenance、许可证和导入记录；没有把 donor 项目的渲染代码或整套素材目录复制进产品。
- [ ] `small-world`、`elemental-serenity`、`three-stylized` 只按 PGS 已登记 commit 的窄 adapter 使用：前者提供 stable-seed height/falloff/biome/prewarm 参考，后两者提供材质 shader、表面采样和草风算法；app shell、角色 / 生物玩法、外部媒体、无限密草与矩形/单圆岛假设均未搬入，其他观察 donor 仍未登记。
- [ ] 云作为独立可替换模块通过单独检查：实例化低模云瓣、共享材质和远景 LOD 的预算可观测；云呈现圆润有厚度的软雕塑感，不使用 ray-marched 真体积云，不遮挡交互 / DOM，也不引入天气系统。

### Gate D · 学习者交互与 DOM

- [ ] 真实鼠标 / 触摸点击世界岛能进入课程投影，点击当前 / 已解锁节点能进入共享 reader，返回操作回到同一岛的正确焦点。
- [ ] 课程名、lesson 名、unit 标签、状态与提示存在于 DOM，能被键盘焦点、屏幕阅读器和文本选择访问；Canvas 中不存在可读文字。
- [ ] authoring / delivery 与 desktop / mobile 使用同一学习者组件树和行为；能力差异只通过既有端口说明，不隐藏入口。
- [ ] 透明 overlay、导航栏、上下文面板和安全区不会覆盖可见节点或按钮；验证使用真实视口命中测试，不能只用程序化 `.click()`。
- [ ] 节点在去色、低对比和 LOD 过渡时仍由 halo / icon / 有意义的状态 animation 与 DOM label 识别，并由 large invisible hit volume 可点击 / 可触摸 / 可聚焦；必要路线 / 节点安全区排除或压平草，不依赖裸白圆盘。
- [ ] 云模块在桌面 / 手机视口都不盖住节点命中区、头像、导航栏或可读 DOM；缩放、切换 LOD 或替换云实现后仍可点到同一节点。

### Gate E · Web3D 基线与性能

- [ ] 每个地图 viewport 只有一个 Canvas、一个 renderer owner 和一条 render loop；全局合法 Canvas mount 数由 Web3D registry 登记，`packages/world` 负责场景，`packages/ui` 保持零 Three.js。
- [ ] tone mapping 与 sRGB 编码各发生一次，有明确 grade / post、方向光 / 补光和接触阴影；移动 DPR、输入意图、音频解锁和生命周期出口契约有证据。
- [ ] 桌面 / 移动的 draw call、可见三角形、纹理和 GPU 资源估算有真实测量；超出首轮护栏时先优化实例化、离线资产和语义 LOD，任何预算例外都有设备与镜头证据；LRU 淘汰有真实卸载 / dispose 记录，不以 visibility-only `THREE.LOD` 充数。
- [ ] 第一阶段没有流体模拟、自由行走、物理碰撞、ray-marched 真体积云、天气系统或外部 CDN；世界和课程切换不新增第二套场景 / 阅读器实现。

### Gate F · 交付证据

- [ ] 最小相关测试、项目文档检查和 `pnpm verify` 结果可复跑；失败项附带准确命令、日志摘要和下一步，不用截图掩盖失败。
- [ ] 保存 authoring / delivery × desktop / mobile 的世界远景、课程岛、点选、DOM 和返回路径截图；截图只作证据，不成为运行时真相。
- [ ] V4 文件无改动；本计划完成后移动到 completed 并保留 closeout 证据，未完成的流体 / 自由行走 / 分支 / 天气系统等明确留作后续。

## Parallel Claude Conflict Strategy

并行工作只在 Phase 0 的 blueprint 字段和 invariant 冻结后开始。协调者持有集成权；每个 Claude 领取一个明确的路径白名单，不能在相邻任务里顺手修同一个文件。所有实现继续遵守「一份代码、一个 renderer、一个学习者面」的项目规则。

| Lane | 可拥有的文件面 | 明确不碰 | 交接物 |
| --- | --- | --- | --- |
| Contract / data | `packages/world/src/island/**` 的纯数据 blueprint 与测试 | `Maps.tsx`、UI、素材导入和 V4 | 字段 / invariant、序列化样本、测试结果 |
| Route geometry | `packages/world/src/course/**` 的路线形状与夹具测试 | blueprint schema、资产清单、DOM 组件 | 五种形状夹具、拓扑断言、地形采样断言 |
| Technical art / provenance | `packages/world/src/assets/**`、现有 kit / provenance 清单及材质说明 | 课程顺序、路由、第二套 renderer、未经批准的 donor 代码 | 主题槽位清单、资产来源 / 许可证、预算和截图 |
| Scene integration | 由协调者指定的 `packages/world` 集成文件 | 私自改 blueprint 字段、另做 world / course 场景、V4 | 单 Canvas 接线、投影切换、性能与输入报告 |
| Browser QA / docs | 本计划、V5 amendment、测试与 `SCRATCH/` 证据 | V4、运行时实现和生成内容 | 桌面 / 手机 × 两模式矩阵、命中测试、文档 diff |

执行规则：

1. 开始前先读本计划、V5 §08、`current-work` 和相关 shared rule，运行 `git status --short`；发现未归属改动先交给协调者，不覆盖、不 reset、不 checkout 掉别人的工作。
2. 先由 Contract lane 提交字段与 invariant，其他 lane 只能消费该合同；需要改字段时发一份小提案，由协调者决定并通知所有 lane，禁止各自扩展一份近似类型。
3. 不同 lane 不编辑同一文件。若确实需要跨边界，拥有该文件的 lane 提供最小 patch 或接口，另一个 lane 不直接改文件；冲突由协调者在集成工作区解决。
4. 生成文件、课程包和资产 manifest 由其现有 producer 负责；不得把手工 JSON、临时截图或 Claude 专属目录放进 `docs/**` 或运行时真相层。
5. 每个 lane 交接都必须写清 changed files、运行的最小命令、通过 / 失败、截图路径和未决风险；协调者先合并结构断言，再合并画面，再做真实浏览器验收。
6. 任何 lane 如果发现需求会引入第三个投影、第三个主题、自由行走、流体模拟或新的端口，立即停在设计评审，不用局部实现把边界变成既成事实。

## Closeout

### Verification receipt · 2026-08-27

本轮垂直切片的实现与证据已经落在 `codex/island-v2` worktree。以下是已实际复跑的结果，不把尚未实现的完整 residency streaming 冒充完成：

- `pnpm --filter @pieai/university-world typecheck`、`lint`、`format:check`：通过。
- `pnpm --filter @pieai/university-world test`：35 个文件、215 个测试通过。
- `pnpm --filter @pieai/university-app typecheck`、`build`：通过（Vite 仅有既有 chunk size 提示）。
- `pnpm docs:check`：`pro-gov`、`doc-gov` 全部通过；`check:canvas`、module boundaries、kit portability、contrast、shared styles、shelf、content revisions、lesson links、authoring exclusion 均通过。
- 完整 `pnpm verify` 已运行到末尾；唯一失败是基线 `apps/university/src/styles.css` 的 `check-raw-colours`，报告 26 个既有登记债务。用 `git show HEAD:apps/university/src/styles.css` 复核，基线同样失败；本轮 3D diff 没有改变这些颜色。
- 桌面课程岛：草 InstancedMesh `2200`，WebGL page errors `[]`，约 `185` draw calls / `256,348` triangles；移动课程岛：`760` 草实例、约 `156` calls / `231,276` triangles、page errors `[]`；世界地图草实例为 `0`，约 `263` calls / `224,974` triangles、page errors `[]`。
- 真实点击课程节点打开共享 reader 对话框；课程岛与世界地图都使用同一 blueprint 的稳定 seed / identity。首岛 manifest 只有 `Nature` + `Fantasy Town`，14 个显式 GLB，无 road/ground 独立模型。

截图证据保存在 `.scratch/island-v2-qa/style-2026-08-27/`：`course-final-default-role-v2.png`、`mobile-course-default-role-v2.png`、`world-default-role-v2.png`、`course-topmesh-elemental-v2.png`、`course-mossy-final-v2.png`、`course-desert-final-v2.png` 和 `node-click-final-v2.png`。截图只作验收证据，运行时真相仍是 blueprint、recipe、manifest 与渲染代码。

仍明确留在后续阶段的工作：真正的 world→focus→course 资源 residency/LRU/crossfade、authoring × delivery 的完整四象限浏览器矩阵、更多主题岛和更丰富的手工水域/季节构图。当前切片已经把地形共面、自然土路、草安全区、主题预算和移动档位的基础合同固定下来。

- [ ] Gate A–F 全部通过，且证据能在干净的本地工作区重跑。
- [ ] `pnpm doc-gov check`、`pnpm doc-gov scan --check`、相关测试和最终 `pnpm verify` 的结果已记录；浏览器截图与行为矩阵已留在约定的证据目录。
- [ ] 确认没有修改 V4，没有生成第二份课程 / 世界实现，没有把可读文字放进 canvas，也没有把第一阶段排除项伪装成完成。
- [ ] 更新当前执行索引的指针（如实施阶段需要），将本计划移动到 `docs/plans/completed/` 并把 `status` 改为 `completed`；若被外部依赖阻塞，记录精确 blocker 和复现命令后再决定下一计划。

When complete, move this plan to `docs/plans/completed/` and set `status: completed`.
