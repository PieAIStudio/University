# University

3D 游戏化的 AI 学习产品。Web 为主，移动端与桌面端出壳，面向付费学习者。

一个仓库，两个壳，一份共享的学习面：

```
apps/local      创作端。单人、本地，由 AI 编程宿主带着读真实仓库，产出课程内容。
apps/online     交付端。3D 世界地图、关卡与复习节奏，面向付费学习者。
packages/core   领域模型与学习规则：课程形状、FSRS 调度、判分。
packages/ui     两个壳共用的学习面：阅读器、证据、复习、markdown、语言层。
```

**两个壳都不许拥有另一个也需要的东西。** 课程一致因此不是同步问题——只有一份
实现，也只有一个生产者。线上壳并不禁止创作课程；当它创作时，跑的是创作端同一套
工作流。

## 现在处于什么阶段

设计阶段。仓库里还没有产品实现，只有：

- `docs/reference/player-journey/v1/` — 用户旅程 V1，这一版要先被推翻和修订
- `docs/specs/active/SPEC-0001-universitylocal-parity-contract.md` — 内容与功能的
  一致性契约
- 一个 DOM 占位页，用来让 `pnpm verify` 从第一天起就是真的门禁

先设计再开发。用户能看见的行为，先在用户旅程里定稿，再落地。

## 快速开始

```bash
pnpm install
pnpm dev
pnpm verify
```

## 给 AI 协作者

入口是 `AGENTS.md`（`CLAUDE.md` 是它的符号链接）。不要从本文件开始工作。
