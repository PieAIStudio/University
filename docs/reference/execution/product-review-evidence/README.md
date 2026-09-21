---
id: REF-PRODUCT-REVIEW-EVIDENCE
title: Product Review Evidence
type: reference
status: stable
canonical: true
owner: project
created: 2026-09-21
last_reviewed: 2026-09-21
domain: execution
tags:
  - evidence
  - product-review
  - retention
related:
  - REF-PRODUCT-COMPLETENESS-REVIEW
  - REF-CURRENT-WORK
---

# 这 639 个文件是什么

一次产品评审留下的执行证据，全部采集于 **2026-09-12**，全部钉在提交
`cea753e27e3c5196936ee30bf6a498aff8496c38` 上。它们不是指南，**读它们是为了核对
当时的结论，不是为了知道现在该做什么**。当前工作看同级目录的 `current-work.md`。

| 组 | 文件数 | 内容 |
| --- | --- | --- |
| `implementation-independent/` | 232 | 与实现无关的评审轮次，含 `post-recovery/` |
| `lightness/` | 174 | 明度与动效测量，`final/receipt.json` 与 `final/motion.json` 被结论引用 |
| `focus/` | 117 | 焦点轮次的 `before` / `after` / `final` 三组 |
| 顶层 | 116 | 首屏与关键路径截图、三份 `proposal-*.svg` |

## 能不能重新生成

**能，但只能在原提交上。** 每一轮的 `receipt.json` 记着 `head`、`randomSeed: 0`
和 `syntheticGuest: true`，所以那次采集是确定性的、可重放的。在今天的 HEAD 上重跑
得到的是**今天的产品**，不是被评审的那个产品——那不是重新生成，是另做一次评审。

也因此：**这些文件不能按「旧的 / 大的 / 没人看」删掉。** 它们是一份已发表结论的
底稿，删了那份结论就变成没有依据的断言。

## 谁在引用

- `docs/reference/execution/product-completeness-review.md` —— 评审结论本身
- `docs/plans/active/product-completeness.md` —— 仍在进行的产品完整性计划
- `docs/reference/execution/product-before-after/{before-after,first-pass-comparison}.md`

四份文档合计点名 **14 条具体路径**（截图、`receipt.json`、`motion.json`、三份
proposal svg、以及三个子目录整体）。其余约 620 个文件没有被逐个点名，它们是这些
结论背后的完整底稿。**没有被点名不等于可以删**，见上一节。

## 为什么它留在这里，而不是搬进 archive

2026-09-21 评估过一次搬迁，结论是**不搬**。

按文件数算，`docs/reference/execution/` 有 19 份指南和 667 份证据，看上去像是
指南埋在证据堆里。但读者实际 `ls` 这个目录看到的是 **22 条**——19 份 md 加三个
名字清楚的证据目录。噪音已经被收纳在一层子目录里了，搬迁要改 14 处引用、动 639
个文件，换来的是读者看到的东西几乎不变。

真正缺的是这份说明：639 个文件，此前没有任何地方讲过它们是什么、什么时候采的、
钉在哪个提交上、哪些还被引用。现在讲了。
