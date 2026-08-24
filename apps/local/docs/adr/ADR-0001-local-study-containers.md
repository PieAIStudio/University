---
id: ADR-0001
title: Separate UniversityLocal Study Containers From The Future University Product
type: decision
status: accepted
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
domain: architecture
tags:
  - storage
  - product-boundary
  - ua
  - local-first
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - SPEC-0001
  - PLAN-0001
supersedes: []
superseded_by: null
---

# ADR-0001: Separate UniversityLocal Study Containers From The Future University Product

## Context

UniversityLocal 的运行方式与 AnvilLocal 类似：用户打开本地仓库，由已有 AI
宿主执行高上下文研究和教学。学习对象可能是 SupaLuv，也可能是其他代码库、
文档库或知识项目。

一个学习对象会产生多门课程，所以一级容器不能是 course。UA 生成的知识图
和 Tour 也不是完整课程；它们缺少教学目标、练习、卡片、持久进度和复习排程。

UA 2.9.4 把原生数据目录解析为被分析根目录下的 .ua 或旧目录，且 worktree
模式会尝试重定向到主仓库。直接在产品仓库运行会违反“不污染工厂”的目标。

## Decision

1. 当前仓库和产品身份使用 UniversityLocal。未来消费级 University 使用
   独立仓库。
2. 默认数据根是仓库根级 studies 目录，允许 CLI、环境变量和本地配置覆盖。
3. 每个被学习对象使用一个稳定 study 容器；一项 study 可以拥有多门 course。
4. 持久目录只保留 source、ua、courses 和 learner 四个责任区。课程、单元、
   讲义、练习和卡片按 `course → unit → lesson` 放在同一课程树中，不再拆成
   curriculum、materials 和 practice 三套平行目录。
5. UA 原生输出按独立 analysisId 保存。analysisId 绑定 snapshot、UA 版本、
   配置和 graph hash，不能只按 commit 覆盖。
6. UniversityLocal 只按需获取明确 commit 到自己的浅层裸 Git 对象仓库。
   snapshot 是 commit/tree manifest，不保存永久 checkout。UA 分析期间才创建
   临时 worktree，并把其 .ua 映射到相应 analysis 数据目录；完成或失败后移除。
7. 课程、材料、练习和卡片使用人类可读文件；个人动态状态使用每项 study
   自己的 SQLite 数据库。
8. 卡片内容与 FSRS 状态分离。review event 是追加式事实，card state 是当前
   可审计投影。
9. 采用成熟的 ts-fsrs，不复用 PBMLS 的自研近似 FSRS 算法。
10. 课程原稿、源码快照、UA 和笔记仍只在本地 study shelf；learner/account
    数据使用仓库级 ADR-0001 定义的共享云端文档、缓存和 outbox。AI 宿主/剪贴板
    是本地端唯一允许的运行时差异。

## Consequences

### Positive

- 与 AnvilLocal 的 books 心智模型一致，同时允许一个项目拥有多门课程。
- 被研究仓库保持干净，学习资产可以整体迁移和备份。
- 同一个 commit 可以保留多次 UA 分析，不会静默覆盖课程证据。
- 正式课程不会被 UA Tour 的能力边界限制。
- 动态学习历史拥有事务和重放能力，AI 宿主也能读取导出的可解释证据。
- 作者书架与 learner account 仍有清晰边界：前者不上传，后者可跨设备同步。

### Negative

- 需要本地 Node 服务连接浏览器与文件系统/SQLite。
- UA 适配器必须管理裸 Git 对象、临时 worktree、映射和版本验证。
- 每项 study 一个 SQLite 数据库使跨 study 今日队列需要聚合查询；第一阶段
  的数据规模可接受。
- Node 24.18 的 node:sqlite 仍是 release candidate，因此必须隔离在 Store
  接口后面并保留替换出口。
- UniversityLocal 不需要也不允许学习资料同步合同；未来商业化 `University`
  的后端选择不属于本仓库。

### Licensing Boundary

当前 UA 仓库根包含 MIT LICENSE；插件 `package.json` 本身没有重复声明 license
字段。UniversityLocal 可以按 MIT 条款调用、修复或复用代码，但复制 substantial
portions 时必须保留许可证与版权声明。本项目第一阶段只调用外部 UA 引擎并消费
其数据，不移植 UA Dashboard，因为 UniversityLocal 有自己的学习 UI。
