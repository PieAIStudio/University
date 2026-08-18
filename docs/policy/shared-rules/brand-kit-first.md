---
id: POLICY-SHARED-BRAND-KIT-FIRST
title: Brand Kit First
type: policy
status: stable
canonical: true
owner: human
created: 2026-08-17
last_reviewed: 2026-08-17
domain: product-line-architecture
tags:
  - shared-rule
  - brand-kits
  - swimmer
pinned: true
related: []
supersedes: []
superseded_by: null
---

# Brand Kit First

适用：PieAI 名下每一个仓库。Web3D、官网、CLI、共享包、总部都算。

产品缺能力时，先用自己的品牌仓库，不要在产品里再造一套平行实现。

## 品牌仓库

| 需要                                     | 仓库                                                              | 包                                 |
| ---------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| 2D UI、按钮、面板、token、HUD 控件       | `SwimmerUIKit`（portfolio id: `swimmer-ui-kit`）                  | `@pieai/swimmer-ui-kit`            |
| 产品代码调用模型                         | `SwimmerAIKit`（portfolio id: `swimmer-ai-kit`）                  | `@pieai/swimmer-ai-kit`            |
| 账号、钱包、Auth、Realtime、schema、迁移 | `SwimmerBackend`（portfolio id: `swimmer-backend`）               | `@pieai/swimmer-backend-client` 等 |
| 色彩管线、grade、sRGB 只编码一次         | `SwimmerRenderKit`（portfolio id: `swimmer-render-kit`）          | `@pieai/swimmer-render-kit`        |
| Colyseus 房间骨架、认证、健康检查        | `SwimmerGameServerKit`（portfolio id: `swimmer-game-server-kit`） | `@pieai/swimmer-game-server-kit`   |

仓库名和 portfolio id 是身份，某台电脑上的绝对路径不是。组合工作区里由 PGS
portfolio manifest 解析 checkout；独立 clone 里先用已发布包和本项目携带的规则快照，
不要猜 `/Users/...` 路径。

方向口径在 HQ `docs/canon/pie-product-technology-stack.md`。本文是工作程序。

## 判断

1. 这个产品现在真的需要这个能力吗？不需要就不要装。写作 CLI 不要装
   SwimmerGameServerKit；没有 3D 的产品不要装 SwimmerRenderKit；没有产品级
   模型调用就不要为了「对齐」去装 SwimmerAIKit。
2. 需要，就先读对应品牌仓库和已发布包，直接用。
3. 品牌仓库缺功能或不好用：去改那个品牌仓库，发新版本，再让本产品升级引用。
   不要在产品仓库里复制一份「差不多的」按钮、解锁器、调色 pass 或 Auth。
4. 只有品牌仓库明确不该拥有的产品规则（玩法、文案、关卡、商业 Gate）才留在
   产品仓库。

## 品牌仓库自己

你正在改的如果就是上面五个仓库之一：缺的能力加在这里，而不是让消费产品分叉。
第二个产品出现同一需求时，再考虑从产品抽回 kit；不要为第一个调用方过度设计。

## 禁止

- 产品代码直连 OpenRouter 或模型厂商 SDK。
- 产品仓库自己定义 `supabase/migrations` 或 `supabase/functions`。
- 为了「先跑起来」在产品里重写 kit 已有的按钮、grade、音频解锁或房间骨架。
