# University

3D 游戏化的 AI 学习产品。Web 为主，移动端与桌面端出壳，面向付费学习者。

它和 [UniversityLocal](../UniversityLocal) 是一条流水线的两半，不是同一个应用的两个版本：

- **UniversityLocal 是作者工作台。** 单人、本地、由 AI 编程宿主带着读真实仓库，
  产出课程内容。
- **University 是学生播放器。** 把已发布的课程包投放给付费学习者，用在线模型判分
  与辅导，用 3D 世界地图、关卡与复习节奏把学习变成习惯。

一句话：**UniversityLocal 生产，University 交付。** 所以「两边课程一致」不是同步
问题，而是供货问题——只有一个生产者。

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
