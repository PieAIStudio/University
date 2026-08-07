---
id: REF-MODULE-MAP
title: Source Module Map
type: reference
status: active
canonical: true
owner: ai-assisted
created: 2026-08-07
last_reviewed: 2026-08-07
domain: architecture
tags:
  - module
  - boundaries
  - refactor
pinned: false
related: []
---

# 源码分成哪几块，以及谁可以依赖谁

这份文档只写**机器在守的规则**。每一条边界都由
`scripts/check-module-boundaries.mjs` 强制，`pnpm verify` 每次都会跑它。

这条自我约束是有来由的。上一份手写的分层说明把 `api` 和 `view` 的方向写反了，
还漏掉了两层，错了很久没人发现——因为没有任何脚本在核对它。
**没人能验证的规则，会悄悄地不再成立。** 所以这里不写脚本管不到的承诺。

## 两棵树，一条共享边

```
server/**  ──可以依赖──▶  src/domain/**  ◀──可以依赖──  src/**
                              （共享 Zod schema）

server/**  ──不可以──▶  src/ 的其余部分
src/**     ──不可以──▶  server/**
```

- **`server/**`** 是本机 host 桥：CLI、HTTP、工作流、SQLite、UA 适配、内容仓库。
- **`src/**`** 是浏览器端。
- **`src/domain/**`** 是两边共用的 schema 核心，也是唯一一条跨线的依赖。

`src/domain/` 有一条额外约束：**它不能 import 任何 `.tsx`，也不能 import
`src/domain/` 以外的东西**。原因很具体——`tsconfig.server.json` 包含
`src/domain` 而且没有 `jsx` flag，往里放一个引用 `.tsx` 类型的模块会直接炸掉
server 编译。这件事真实发生过一次，规则 3 就是那次留下的。

## 浏览器端的分层

```
shell → lesson → evidence → review → language → api → view
   浅 ──────────────────────────────────────────────▶ 深
```

一层只能 import 自己或**更深**的层，不能往浅了 import。

| 层 | 装什么 |
| --- | --- |
| `src/shell/` | 校园壳：study 书架、今日、study 详情、空状态 |
| `src/lesson/` | 读一节课，以及它引用的代码 |
| `src/evidence/` | 证据面板：把课文引用的源码取出来显示 |
| `src/review/` | 练习题与复习卡的作答与批改 |
| `src/language/` | 外语层：词锚点的 remark 插件与朗读 |
| `src/api/` | 和本机 server 说话的唯一出口 |
| `src/view/` | 无框架的纯视图逻辑与共享类型 |

`view` 和 `language` 是叶子，不依赖任何其他层。`api` 依赖 `view`
（它复用 `view` 里的定位类型），**不是反过来**。

`src/` 顶层的散文件（`App.tsx`、`MarkdownContent.tsx`、`url-state.ts` 等）
不算层，规则 4 不管它们——它们是入口和共享碎片。
代价是：绕道散文件的间接依赖抓不到。这是已知的、接受的口子。

## 三个大文件，为什么不拆

审计过，结论是一个都不该拆。记在这里，免得下一个人重新纠结一遍。

| 文件 | 行数 | 为什么留着 |
| --- | ---: | --- |
| `server/workflows/revise-course.ts` | 1054 | 一件事做透了：「安全地应用一份课程修订提案」。里面的 Zod schema 是这个工作流自己的输入契约，抽出去只会造出一个只有它自己 import 的文件。 |
| `server/content/repository.ts` | 958 | **确实混了两件事**：原子写 revision，和状态流转规则。但两者守的是**同一条不变量**——磁盘上 revision 的布局，以及它什么时候可以变。拆开等于把一条不变量放到两个地方。 |
| `server/ua/adapter.ts` | 855 | 围绕「跑 UA 并把结果收进来」内聚。 |

行数是**审查触发器，不是规则**。超过阈值的动作是「检查并解释」，
不是「机械拆分」。什么时候该重新考虑：当这些文件的痛点**反复**出现时，
而不是预防性地拆。

## 相关命令 / 文件

| 命令 / 文件 | 作用 |
| --- | --- |
| `pnpm check:boundaries` | 强制上面全部四条规则 |
| `scripts/check-module-boundaries.mjs` | 规则的实现，含每条规则的 `why` 说明 |
| `npx madge --circular src server` | 补充检查：零循环依赖是硬底线 |
| `tsconfig.server.json` | 包含 `src/domain`，是规则 3 存在的原因 |
