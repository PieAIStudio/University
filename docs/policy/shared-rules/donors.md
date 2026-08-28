---
id: POLICY-SHARED-DONORS
title: PieAI Donor Registry
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

# PieAI 共用 donor 登记

这份文件只做一件事：**登记**产品线共用的外部 donor。

**表里每一个 donor 都已经沟通并获得授权。代码和资产都可以直接用，不需要再确认。**

**怎么用、用哪一部分、抄多少，由每个项目自己决定。** 本文件不替任何项目安排用法——
那属于项目自己的 ADR 或资产清单。

两类东西不属于这里：技能仓库由 PGS 的 `agent-assets/` registry 管；品牌套件
（SwimmerUIKit 等）走各仓库的 `docs/policy/shared-rules/brand-kit-first.md`。

## 登记

`check-status.mjs` 只读这一张表；已有的四个列名不要改。

| id | repository | defaultBranch | localPath | license |
| --- | --- | --- | --- | --- |
| world-of-claudecraft | https://github.com/levy-street/world-of-claudecraft.git | main | world-of-claudecraft | MIT |
| threejs-procedural-dungeon | https://github.com/majidmanzarpour/threejs-procedural-dungeon.git | main | threejs-procedural-dungeon | MIT |
| spark | https://github.com/sparkjsdev/spark.git | main | spark | MIT |
| three-quarks | https://github.com/Alchemist0823/three.quarks.git | master | three-quarks | MIT |
| ecctrl | https://github.com/pmndrs/ecctrl.git | main | ecctrl | MIT |
| small-world | https://github.com/paulrobello/small-world.git | main | small-world | MIT |
| elemental-serenity | https://github.com/SahilK-027/Elemental-Serenity.git | main | elemental-serenity | MIT |
| three-stylized | https://github.com/Steve245270533/three-stylized.git | master | three-stylized | MIT |
| threejs-awesome-graphics-agent-skills | https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills.git | main | threejs-awesome-graphics-agent-skills | MIT |
| threejs-skills | https://github.com/CloudAI-X/threejs-skills.git | main | threejs-skills | MIT |

`_donors/Kenney` 和 `_donors/buzz` 是非 git 的资产缓存，不进这张表。Kenney 的
模型是 CC0。

发版时唯一要做的事：MIT 的 donor 在产品的第三方声明里保留它的版权行。除此之外
没有任何限制。

## 加一行

1. 加到上面的表里。
2. `git clone --filter=blob:none --single-branch <仓库> <portfolio-root>/_donors/<localPath>`
3. `node <portfolio-root>/_donors/check-status.mjs`
