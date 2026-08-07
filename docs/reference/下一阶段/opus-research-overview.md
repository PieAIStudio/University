---
id: REF-OPUS-NEXT-PHASE-OVERVIEW
title: Opus Next Phase Research Overview
type: reference
status: draft
canonical: false
owner: ai-assisted
created: 2026-08-06
last_reviewed: 2026-08-08
domain: architecture
tags:
  - research
  - next-phase
  - english-mode
  - communication
  - self-study
pinned: false
related: []
---

# Opus 下一阶段研究总览

**交付状态（2026-08-08）：三方向核心均已落地**——外语旁注层（检测合成）、表达
点评包路径、airlock 自学。本文是 2026-08-06 研究总览；**「还没有实现」一句已过时**。
以 `docs/reference/execution/current-work.md` 为在飞索引；勿把建议执行顺序当成
未完成 backlog。

这一组文档研究三个方向：教程内嵌外语词、沟通能力的提升机制、把 UniversityLocal
自己变成可学习的项目。研究基于当时对代码的查证。

三份深入文档：

- [英文模式](opus-english-mode.md)（产品名：外语模式；核心已交付）
- [沟通能力](opus-communication-coaching.md)
- [自学本项目](opus-self-study-recursion.md)

## 三条结论先行

**一、英文模式必须做成「渲染层叠加」，绝不能改写课程内容。**

课程内容不是普通文本，它带着 `contentHash` 和 `contentRevision`
（`src/domain/schemas.ts:236-238`）。打个比方：课程内容像一本已经印刷装订的书，
书上每一页都盖了骑缝章；你的复习卡片背面写着「见第 47 页第 3 行」。往正文里塞
英文单词，等于重排版重印——骑缝章对不上了，所有指向这一页的复习卡都得作废重排。
所以英文词只能是一层「贴在书上的便利贴」，可以随时撕掉换一张，书本身一个字不动。

**二、沟通这块，「加课程」不是最优解，你选的「点评我真实写下的东西」才是——
而且素材已经躺在你的数据库里了。**

你每做一次 explain 练习写下的作答，系统已经原样存进了
`exercise_attempt.response_json`（`server/learning/sqlite-learning-store.ts:638`，
写入点在 `server/http-server.ts:1208`）。缺的不是内容，是一个把它们读出来的口子——
`LearningStore` 接口目前根本没有「列出历史作答」这个方法。

**三、「本项目学本项目」不是递归问题，是路径问题。真正的拦路石是一行守卫。**

`assertSeparatedRoots`（`server/config/load-config.ts:124`）禁止「学习数据目录」和
「被学项目目录」互相包含。默认的 `studies/` 就在项目里，所以注册自己必然被拒。
把 `studies/` 搬到项目外，这条限制自然消失，零代码改动，而且顺带消灭了另一个隐患
（UA 分析时会在项目内部再 checkout 一整份项目）。

## 三个方向之间的关系

它们不是并列的。第三个方向解锁了第二个方向的一部分：一旦 UniversityLocal 自己
成为一个 study，`.agents/skills/*/SKILL.md`、`docs/policy/`、`AGENTS.md`、以及
`docs/reference/execution/current-work.md` 里记录的真实经验，就都成了**可引用的
证据**。这很关键，因为课程 schema 强制每条内容至少挂一条证据
（`src/domain/schemas.ts:239`），而「怎么跟 AI 沟通」这件事在此之前**没有任何
合法证据源**。

举个具体例子：`current-work.md` 的 Zero-Basics Tier Receipt 里写着——让 Grok 产出
可用内容的不是模型，而是简报：每份简报点名了确切的文件、行数、以及每个文件能教
什么。这是一条有日期、有上下文、可引用的真实经验，比任何「提示词十大技巧」都有
说服力，因为它是你自己项目里发生过的事。

## 建议的执行顺序

| 顺序 | 方向 | 大致成本 | 为什么排这个位置 |
| --- | --- | --- | --- |
| 1 | 自学本项目 | 最小（配置迁移 + 一个脚本 + 一次 UA） | 零代码改动就能通，而且解锁方向二的证据源 |
| 2 | 沟通点评 | 小（一个读取方法 + 一个出口 + 技能接线） | 素材已存在，只差管道 |
| 3 | 英文模式 | 最大（词表 + 词典裁剪 + 注入器 + 弹层 + 词汇进度 + 设置） | 唯一需要引入新数据和新存储的方向 |

这个顺序是建议不是命令。如果你更想先看到英文模式的效果，[英文模式](opus-english-mode.md)
里给了一个「先切一刀」的最小版本：只让教程原文里**已经存在**的英文词
（commit、snapshot、async、schema）变成可点击查词 + 发音，不新增任何词、不改任何
内容。这个版本的工作量大概是完整版的十分之一，而且它产出的点击数据正好可以用来
校准完整版的频率参数。

## 这三份文档不回答什么

它们是研究，不是计划。拍板与实现已部分发生：旁注层 / airlock / 宿主包路径见
current-work 收据。仍写在各文「待决问题」里、且 current-work 未收口的项，才算
开放问题。
