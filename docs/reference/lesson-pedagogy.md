---
id: REF-LESSON-PEDAGOGY
title: How a UniversityLocal Lesson Is Built
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-08-07
last_reviewed: 2026-08-08
domain: learning
tags:
  - pedagogy
  - lesson-template
  - course-authoring
  - primm
---

# 一节课怎么写

这份文档是写课文的人（我、Grok、或以后任何 AI 宿主）必须遵守的结构。
它不是风格建议，是**验收标准**。

## 0. 先说问题出在哪

现在的课文是这个顺序：

```
学习目标 → 先给结论 → 一个类比 → 工作示例 → 自检 → 重点
```

对写的人来说这很合理：先声明要教什么，再给答案，再解释。
对读的人来说这是**倒着的**。

打个比方。这就像看侦探小说，第一页写着：

> 本章学习目标：理解凶手的作案手法。
> 先给结论：凶手是管家。

后面 20 页你还读得下去吗？读不下去。不是因为文字差，
是因为**悬念被作者自己拆掉了**。

学习和读侦探小说共用同一个心理机关：**你得先有问题，答案才有地方安放**。
没有问题的答案，只是一段需要背诵的文字。

## 1. 方法论的来源

用户提出的直觉——「先抛问题和现象，让人先猜，再讲」——不是拍脑袋，
它和编程教育里被反复验证的做法几乎重合。我没有自己发明方法论，
而是采用了成熟方案：

**主结构用 PRIMM**（Predict → Run → Investigate → Modify → Make）。
2017 年提出，专门针对文本编程教学，是目前英国计算机教育的主流课堂结构。
它的第一步 Predict——先看代码、先预测会发生什么——正是用户说的「先让他答」。

**「先猜再教」有独立的实验支持**：这叫 pretesting effect / prequestion effect。
2025 年的多层元分析给出：针对被预先提问的内容，学习效果 g ≈ .66。
关键细节有两个，直接决定我们怎么写题：

- 增益**主要落在被问到的那个点上**，对没问到的内容效果不稳定。
  → 所以预测题必须**正对这节课的核心**，不能随便出一道。
- **答错也有效**，前提是**紧接着能看到正确答案**。
  → 所以预测题后面必须马上跟解释，不能让人悬着。

**但有一条重要的反向约束**：认知负荷理论和 expertise reversal effect 说明，
**新手在缺少引导的环境里会过载**。所以这里的「先猜」必须是
**低成本、低风险、一道题、马上给答案**，而不是「你自己摸索半天」。
用户的直觉是对的，但如果做成「让学习者自己探索」，对零基础的人是灾难。

一句话总结这三条研究的合力：

> 制造一个**很短**的悬念，让人**猜一次**，然后**立刻、完整地**讲清楚。

## 1b. 语气：为什么「暖」必须配一条「不许变长」

课文按上面的结构写出来是对的，但读起来干。「干」不是错觉，它对应一个有名字的
效应，而顺着直觉去修会**把效果改差**。

**该做的：personalization principle（个人化原则）。** 同样的内容，用口语、用
「你」来写，比正式书面语学得更好。这是这个领域证据最硬的效应之一：Mayer 自己
的 11 个实验 11 次都赢，迁移测验效应量中位数 d ≈ 1.11；跨媒介元分析 g = 0.70；
专门针对「把教材改写成对话体」的元分析给出记忆 d = 0.30、迁移 d = 0.54。

**绝不能做的：seductive details（诱人细节）。** 为了让文章不那么干而加进来的
有趣但与要点无关的内容——小故事、趣闻、生动却不解释机制的比喻——会让记忆和
迁移**双双下降**（Rey 2012 元分析：记忆小到中等负效应，迁移中等负效应）。机制
是认知负荷：脑子的工作容量被无关的有趣东西占掉了。在 Mayer 系列的元分析里，
「删掉诱人细节」是所有原则中效应最大的一条。

这两条必须**成对**写进技能，否则「让语气暖一点」这条指令会被执行成「加故事」，
而那正好是效应最大的负面操作。技能里的硬线——**改写后正文不得超过原文
115%**——就是这一对规则的机械影子：换说法不需要更多字，变长了说明加的是内容。

**「诱」的结构：scaffolding（脚手架）**，Wood、Bruner、Ross 1976 年提出。它有
三个定义性特征：contingency（支持贴着学习者当前状态给）、fading（逐步撤走）、
transfer of responsibility（把责任交还）。本结构的 `## 先猜一下` 已经承担了
contingency；fading 是技能里「同一单元内扶手递减」那一节，缺了它，读者会一直
被扶着，永远不练自己走。

**边界条件仍然是 expertise reversal**（见 §1 末尾）：同一种写法对新手有效、对
已经懂的人有害。所以温度按课程层级调，`foundations-*` 全套扶手，其余课程少铺垫。

## 2. 结构住在技能里，不在这份文档里

**操作规范是 `.agents/skills/write-lesson/`**，不是这一节。写课文的人（我、Grok、
以后任何 AI 宿主）应该被那个技能触发，而不是指望有人主动来读一份 reference。

那里有：不变量、五个变体（`现象` / `对比` / `溯源` / `决策` / `术语`）、
选变体的判据、轮换规则、跨课链接规则、25 条验收清单。

机械可查的一半由 `pnpm lint:lessons`（`scripts/lint-lessons.mjs`）在
`pnpm verify` 里强制执行；只检查声明了 `variant` 的课。判断力那一半仍在清单里，
不进脚本。

这份文档只负责回答**为什么是这个形状**——研究依据、被否掉的方案、以及那两条
容易翻车的约束。两处不重复同一件事，是为了避免出现第二个真相源。

下面保留一节结构摘要，只为让这份文档能被独立读懂；**冲突时以技能为准**。

### 摘要：共同骨架

所有变体共用这个脊柱，只有中段随教学对象变化：

```
标题（问句）→ 现象/情境 → 先猜一下 → 答案 → <中段> → 再想想 → 自检 → 一句话
```

固定的部分承载学习心理学，变化的部分承载学科内容。这就是「变化都在方法论之内」
的具体含义：变的是中段，不变的是悬念、猜、立刻给答案这三步。

### 摘要：旧结构错在哪

旧结构是 `学习目标 → 先给结论 → 一个类比 → 工作示例 → 自检 → 重点`。
它的三段致命顺序是前三段：宣布要教什么、直接给答案、再解释。
读者还没产生问题，答案就已经落地了，于是答案没有地方可挂。

新结构把这三段倒过来：**先制造一个很短的悬念，让人猜一次，然后立刻讲清楚。**

### 摘要：五个变体

| 变体 | 什么时候用 | 中段 |
| --- | --- | --- |
| `现象` | 有能观察到的意外 | `## 为什么是这样` |
| `对比` | 两个东西老搞混 | `## 逐条对照` + `## 什么时候用哪个` |
| `溯源` | 一个值跨文件流动 | `## 一站一站往回走` |
| `决策` | 有取舍要讲 | `## 代价和收益` + `## 什么时候该反过来` |
| `术语` | 一个词总被读错 | `## 三个真实用例` + `## 它不是什么` |

同一单元内同一变体最多连用两节。选变体按内容选，不按轮换选——为了换花样而
硬凑出来的 `对比`，比老实写第三个 `现象` 更糟。

## 3. 为什么不换一套更花哨的

考虑过并放弃的：

- **Gagné 九事件**：完整但太重，九个环节写进每节小课会把课文撑爆。
  它的前三步（引起注意 → 告知目标 → 唤起旧知）已经被本结构的
  标题 + 现象 + 先猜覆盖。
- **5E（Engage/Explore/Explain/Elaborate/Evaluate）**：结构上和本文几乎同构，
  但它是给课堂实验设计的，Explore 阶段假设有教师在场兜底。
  自学场景下会退化成「自己摸索」，正好踩中上面说的新手过载。
- **纯 Use–Modify–Create**：适合有编辑器在手的动手课。
  本项目的课很多是「读懂一个已有项目」，没有 Modify 的位置。

PRIMM 的 Predict/Investigate 两步是我们真正需要的，
Run/Modify/Make 在「读懂别人项目」的场景里没有对应动作，因此不强制。

## 4. 参考

- PRIMM: <https://teachcomputing.org/blog/using-primm-to-structure-programming-lessons/>
- PRIMM 原始论文（Sentance et al., WiPSCE 2017): <https://dl.acm.org/doi/10.1145/3137065.3137084>
- 教师使用经验（SIGCSE 2019): <https://dl.acm.org/doi/10.1145/3287324.3287477>
- Prequestion 元分析（Educational Psychology Review, 2025):
  <https://link.springer.com/article/10.1007/s10648-025-10075-7>
- Pretesting 综述（Educational Psychology Review, 2023):
  <https://link.springer.com/article/10.1007/s10648-023-09814-5>
- Expertise reversal effect: <https://link.springer.com/article/10.1007/s11251-009-9102-0>
- Personalization principle（Mayer, *Multimedia Learning* ch.13）:
  <https://www.cambridge.org/core/books/abs/multimedia-learning/personalization-voice-and-image-principles/97F9B31362E6491806A4718FECCADE3D>
- 对话体改写元分析（Ginns et al., Educational Psychology Review 2013):
  <https://link.springer.com/article/10.1007/s10648-013-9228-0>
- Mayer 系列跨媒介元分析（2025，含各原则效应量排序）:
  <https://www.sciencedirect.com/science/article/pii/S1747938X25000673>
- Seductive detail 元分析（Rey, Educational Research Review 2012):
  <https://www.sciencedirect.com/science/article/abs/pii/S1747938X12000413>
- Scaffolding 三特征（Wood/Bruner/Ross 1976 起，van de Pol 等综述）:
  <https://www.sciencedirect.com/science/article/pii/S2590291123002188>
