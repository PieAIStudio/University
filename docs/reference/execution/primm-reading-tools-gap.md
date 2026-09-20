---
id: REF-PRIMM-READING-TOOLS-GAP
title: PRIMM Reading Tools Gap
type: reference
status: active
canonical: true
owner: human
created: 2026-09-21
last_reviewed: 2026-09-21
domain: execution
tags:
  - primm
  - reading-tools
  - i18n
  - learner-surface
related:
  - REF-CURRENT-WORK
  - REF-I18N-STRATEGY
---

# PRIMM 课没有外语模式和阅读详略

这是一份产品能力缺口说明。PRIMM 课用的是自己的阅读器（`primm-reader__main`），
它没有接经典阅读器工具条里的两个阅读辅助。缺口在 2026-09-21 合并
`codex/interaction-first` 时由 `Y.english-campus` 的浏览器闸门抓到，
**不是这次合并引入的**：PRIMM 阅读器从写出来就没有这两个控件。

**本轮不修。** Owner 2026-09-21 裁决：先落地合并，把缺口记成待办。
原因是"这两个控件在分步流程里放哪"是设计问题，不该在合并里顺手决定。

## 实测到的差别

同一门课 `ai-literacy / understanding-ai`，同一个工具条位置，`?lang=en`：

| | 经典课 `first-request-checkpoint`（sort） | PRIMM 课 `ask-about-a-picture` |
| --- | --- | --- |
| `.lesson-toolbar__tools` 里的目标 | `Foreign language mode`、`Standard`、`Detailed`、`Turn off sound` | 只有 `Turn off sound` |
| `.game-ui-segmented-option` 数量 | 2 | 0 |

也就是说 PRIMM 课上缺的是：

- **外语模式**（`Foreign language mode`）——英文学习者读不懂时的主要依靠
- **阅读详略**（`Standard` / `Detailed`）

## 为什么这件事比"少两个按钮"严重

`understanding-ai` 第一单元 `first-useful-step` 的六节课里，**前五节全是 PRIMM**：
`ask-about-a-picture`、`sound-words-and-meaning`、`name-the-result`、
`edit-one-part`、`answer-or-search`。第六节 `first-request-checkpoint` 才是经典课。

所以一个英文学习者进入这门课，会**连续五节课看不到阅读辅助**，直到第六节才第一次
遇到它们——并且没有任何地方解释为什么前面没有。这与 `AGENTS.md` 的学习者表面规则
相抵触：缺失的能力要渲染控件并给出解释，不能直接不画。

## 闸门现状

`e2e/Y.english-campus.spec.ts` 的 “English reading tools fit and stay operable”
原本走该单元的第一节课，现在那一节是 PRIMM，于是四条用例同时红。
本轮把它收窄到**确实带这些工具的课**，并保留一条断言：一旦整个产品里
再也找不到带阅读工具的课，它会明确失败，而不是静默通过。

所以这份文档是这个缺口**唯一**的记录点：闸门现在不再为它报警。

## 补它的时候要一起决定的事

1. 两个控件放在分步流程的哪里——每一步都在，还是只在有大段正文的步骤上。
2. 外语模式改变正文呈现，而 PRIMM 的每一步正文都很短；标准/详略在这种形态下
   还有没有意义，或者应该换成别的辅助。
3. 若判定某一步不该有，也要按学习者表面规则**渲染控件并解释**，不能隐藏。
