---
id: POLICY-SHARED-DONORS
title: PieAI Donor Catalog
type: policy
status: stable
canonical: true
owner: human
created: 2026-08-17
last_reviewed: 2026-08-17
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

---

## 各产品怎么用

做 3D / 音频 / 壳之前，先找**当前仓库**这一行。写「不用」就不要去搬。

| 产品 | WOC | dungeon | Spark | quarks | ecctrl |
| --- | --- | --- | --- | --- | --- |
| TuringPact | 用：场地、音频、加载 | 用：聚会布局算法 | 不用 | 不用 | 不用 |
| YaZu | 用：移动、音频、运行时合同、环境资产 | 用：任务地图、调色思路 | 用：可选远景 | 不用 | 不用 |
| Break | 用：GLB、音频参考、资产模式 | 用：有种子的路线气氛 | 不用 | 用：已装依赖，只做英雄爆发 | 不用 |
| OwnMySpace | 用：起步 GLB、地形/加载/清单 | 不用 | 不用 | 不用 | 不用 |
| Non-Heroes | 用：Wave E 音频、清单模式 | 不用 | 不用 | 不用 | 不用 |
| Show | 不用 | 不用 | 不用 | 不用 | 不用 |
| PieAIStudio-Site | 不用 | 不用 | 不用 | 不用 | 不用 |
| University | 用：音频解锁、三端壳、移动 HUD、资产流水线 | 用：有种子的关卡地图与可达性 | 不用 | 不用 | 不用（待试玩证据） |

真的拷了文件，把出处记在**那个产品已经有的资产清单**里，不要再为启动阅读另写一份账本。

---

## 每个 donor 是干什么的

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

---

## 还没克隆、只观察

这些在 HQ 技术方向里出现过，需要时再登记、再克隆：

- `xt4d/GameBlocks`：WOC 和现有生态都没有对应做法时才按模块看
- `majidmanzarpour/threejs-procedural-spider`：真要程序化生物动画时再看
- `erincatto/box3d`：还没有浏览器 WASM；物理仍用 Rapier
