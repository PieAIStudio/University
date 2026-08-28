---
id: REF-PROCEDURAL-MAP-HANDOFF
title: Procedural Map Handoff
type: reference
status: active
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-08-28
domain: execution
tags:
  - current-work
  - 3d
pinned: false
---

# 程序化地图：交接给下一个 session

给**全新 session** 读的。目标只有一个：把三层程序化地图做到**能商用**——
作者写完课，岛内景观、飞岛群的小模型、行星页的变化全部自己生成，
不需要逐座岛手工调，而且在核显笔记本上跑得动。

## 你的工作方式（老板明确要求）

- **从全局、从审美、从商业角度思考。** 不要陷进「改一个常数、截一张图、再改一个常数」的循环。
  每次动手前先问：这个改动在最终画面上占多少像素？值这个预算吗？
- **大量使用子代理，并行。** 两个 CLI：
  - Codex：`codex exec -m gpt-5.6-luna -c 'model_reasoning_effort="max"' --dangerously-bypass-approvals-and-sandbox "<任务>"`
  - Antigravity：`agy -p "<任务>" --model gemini-3.7-flash-high --effort high --dangerously-skip-permissions --print-timeout 180m`
    （模型 id 以 `claude-` 开头时不要加 `--effort`。）
  - **模型 id 照抄，不要自己"升级"。** 我今天擅自把 luna 换成 sol，被纠正了。
  - **同时最多 4 个。** 今天 8 个并行把机器负载推到 100+，测试开始假失败。
  - 额度不够就直接跟老板说，他会补。
- **你自己看图，不要信指标。** 已经有两次 agent 因为「指标变好」宣称成功而图明显更丑。
- **多沟通。** 老板说：跳出框架想到的东西、需要拍板的事，尽管问，他不懂的会教你怎么决策。

## 已经锁死的东西，不要再重新决定

`docs/adr/ADR-0008-one-locked-technique-per-island-element.md` +
`packages/world/src/island/island-technique-lock.ts` + 它的测试。

每个视觉元素只有一种技术、一个来源、一个预算，**外加一张「已否决」清单，每条都带杀死它的那个数字**。
改锁只能通过修订 ADR，而且必须先有测量。测试里有一条绊线：草的三角形数被钉在 45，
任何重写都会让它红——这是故意的。

**这个锁是今天最重要的产出。** 它存在的原因：草被重写了三次，两次方向相反，
最后一次回退是因为我凭观感否决了一个 donor 移植，却从没量过它的成本。
量完一行就结束了争论：我们一簇草 45 个三角形，donor 一片叶 1 个，
而**草占整个场景 92.7% 的三角形**。

## 已经证实的根因（不用重查）

1. **三个互不相干的随机场。** 地面颜色用三条 sin 波，草密度用格子噪声，
   道具哪个场都不读。两个场的相关系数只有 **r = 0.31**，岛面三分之一区域互相打架。
   **这是「杂乱」的架构级原因**，调任何一个场的常数都修不了。
2. **地面「色块」的波长比岛还长。** `drift = maxHalf*0.22 = 9.36`，正弦周期 58.8，
   岛横跨 85 单位——整座岛只有 1.4 个周期，那是一道渐变不是色块。
   这就是「一整片同一个绿」。
3. **草密度场有肉眼可见的直角边**（格子噪声只做了 smoothstep）。
4. **零环境贴图。** 全仓库 `envMap` 命中 0 次，所有材质的间接光为 0，
   所以看起来像塑料原型。已经在修（`work/island-ibl`）。
5. **没有尺度层级。** 只有「一堆一样大的小件」，缺参考图里那种「几个大地标」。
   donor 媒体已获授权，bridge / camp / tent / rocks 现在可以用了。

## 目标架构

```
写完课
  ↓
IslandBlueprint      纯数据：路线 / 轮廓 / 地形参数 / seed / 主题槽
  ↓
IslandField          唯一真相：高度 · 遮罩(路|草|水|岩) · 烘焙AO
  ↓                  ← 草、道具、地表、地标全部只读它
  ├─ 课程投影（低镜头）  地表网格 + 三向贴图 · 草LOD · 道具 · 地标 · 节点
  ├─ 世界投影（飞岛群）  剪影 + 明暗断层 + 一个亮点，仅此而已
  └─ 行星投影（大气层）  岛群浮在行星大气层里，不是长在地面上
  ↑
IslandStyle          唯一的美术旋钮：约12个颜色 + 贴图组 + 太阳/天空
```

**组织原则：预算按屏幕像素分配，不按世界尺寸分配。**
飞岛群里一座岛只有 40 像素、底盘 8 像素——那里放任何"构造"都是浪费
（今天有 569 行几何因此被退回）。低镜头下学习者身边几十个单位才值得花钱。

## 待判断的分支（都没合，都要你看图后决定）

| 分支 | 状态 | 我的判断 |
| --- | --- | --- |
| `work/course-camera` | 4 commits，我做的 | 节点改成干净圆盘+刻环、飞岛底盘改成2个draw、内容降级闸门、技术锁、文档精简。**建议直接合。** |
| `work/island-ibl` | 2 commits，完成 | 环境贴图可用但强度只有 0.1，收益要等贴图落地才兑现。**可以合，之后重调强度。** |
| `work/planet-atmosphere` | 1 commit，完成 | **还没看图。** 行星页重做 + 选取点改成漂在大气层。 |
| `work/island-field` | 在跑 | `IslandField` 架构地基，最重要的一个。 |
| `work/island-grass-donor` | 在跑 | 草换成 donor 单三角形架构，省下约 64 万三角形。 |
| `work/near-view` | 在跑 | 镜头放低放近 + 加宽路面 + 暖化调色板。 |
| `work/island-textures` | 在跑 | triplanar 贴图研究与生产。 |
| `work/island-underside` | 已退回 | 569 行 8 像素看不见的几何，留作反例，不要合。 |
| `work/island-meadow` | 未判 | Grok 的地表颗粒实验。 |
| `work/island-card-vegetation` | 未判 | 卡片树实验，早于技术锁。 |
| `work/liquid-in-app` | 1 commit | 液态 UI 用在 XP 光球上，用了临时本地链接，**发版前必须还原**。 |

**建议合并顺序**：course-camera → ibl → field → grass → near-view → textures → planet。
field 是地基，grass 省出预算，near-view 花掉它，textures 和 planet 最后。

## 老板已经拍板的产品决定

- **课程岛镜头要放低、放近**，类似 MOBA：跟着学习者头像，头像在画面中心偏上，
  小节节点向下排开。构图逻辑代码里已经有（`COURSE_LOOK_PULL`），
  缺的只是 `COURSE_POLAR` / `COURSE_DISTANCE` 两个常数。**旋转保持锁定**——
  `controls.tsx` 顶部注释里三条禁用旋转的理由依然成立，和"放低"无关。
- **行星页要重做**，选取点是**漂在大气层里的岛群**，不是长在行星表面。
- **参考图** `docs/reference/island-art-reference/target-island-*.png` 只学优点：
  配色（明亮黄绿草 / 奶油色路 / 暖棕岩 / 青蓝科技光）、明度三段、尺度层级、
  树密集在岛缘围一圈中间留空。**它们的 3D 预算是我们的十倍以上，禁止照抄。**

## 还没做的

- **`current-work.md` 里约 150 行是"已完成"清单**，git 历史已经有了，该删。
- **`clean-image-generation-rules.md` 的宿主路由表已经过时**——它教 AI
  「不要假装有生图能力，去用浏览器生图」，而 luna 能直接调 GPT Image 2，
  gemini 也能调自己的。这一节会把 agent 推到更差的路上，要改或删。
- **`SPEC-0002-vibehub-absorption.md`** 453 行、`status: active`，但 current-work
  里一处都没提。要么补上在跑的证据，要么归档。
- **PGS 上游的 `donors.md` 还是旧版**（University 这份已经从 208 行砍到 60 行，
  并写明"所有 donor 都已授权"）。需要让 PGS 那边同步。
- 岛的边缘仍然太规则，能看出"下面有块底板"。参考图是层理台地。
