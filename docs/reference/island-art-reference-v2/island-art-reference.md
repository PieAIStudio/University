---
id: REF-ISLAND-ART-V2
title: Island art reference (hexagonal tiles)
type: reference
status: active
canonical: true
owner: human
created: 2026-08-31
last_reviewed: 2026-08-31
domain: world
tags:
  - island
  - art-reference
---

# 飞岛参考图（六边形版）

这两张是当前有效的飞岛外观参考，由菲哥用 AI 生成后选定。
上一版自然岩崖的参考图已作废，见 `REF-ISLAND-ART-V1-RETIRED`。

## 两张图各自回答什么

| 文件 | 回答的问题 |
| --- | --- |
| `islandpalette1morning.png` | 一座岛的整体质感、S 形路径、天空渐变 |
| `image-1788061292748.jpg` | 12 座岛的配色关系，尤其是**每座岛底面和自己岛面色的关系** |

## 从这两张图读出来的、当前代码没做到的一条

参考图里每座岛的底面是**它自己那个色相的暗调**——粉色岛是灰粉底，
蓝色岛是灰蓝底。当前 `packages/world/src/island/island-geometry.ts`
用一个共享常量 `CLIFF_DARK`（`0x5d3d32`，褐色）无差别套给所有岛，
再叠上 28° 太阳角让近垂直面几乎没有主光，于是所有底面糊成一团暗块。

菲哥 2026-08-31 的评分：当前渲染 60 分，参考图 80 分。
要求是**先不增加运行时开销地追平参考图**，之后再谈更高的质感。

这条走 `island-look-review` 闭环，台账编号 `f7bf257435aa`。
