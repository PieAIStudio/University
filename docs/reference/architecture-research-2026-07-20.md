---
id: REF-UNIVERSITY-LOCAL-ARCHITECTURE-RESEARCH-2026-07-20
title: UniversityLocal Architecture Research 2026-07-20
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-20
domain: architecture
tags:
  - research
  - fsrs
  - sqlite
  - understand-anything
  - shared-platforms
pinned: false
related:
  - ADR-0001
  - SPEC-0001
---

# UniversityLocal Architecture Research 2026-07-20

> Boundary update: backend observations below remain historical portfolio
> research only. ADR-0003 permanently excludes SwimmerBackend and all other
> application backends from UniversityLocal; a future commercial `University`
> would make its own decision in a separate repository.

## Evidence Summary

### AnvilLocal

AnvilLocal 证明了“工具源码 + 根级私有内容书架”的本地 AI 宿主模式。books
下面每本书拥有稳定 slug 和独立内容容器。UniversityLocal 复用容器思路，
但一级对象使用 study，因为同一项目可以生成多条课程路线。

不直接复用的部分：AnvilLocal 把 books 根写死在项目路径中；UniversityLocal
必须允许外置 studiesRoot。

### Understand Anything 2.9.4

已检查本机安装的 2.9.4 源码和 SupaLuv 真实数据：

- SupaLuv 历史导入图有 1,453 节点、3,256 条边；当前全量分析覆盖 606 个
  文件，ready manifest 记录 1,542 个节点、2,656 条边、9 个架构层和 10 步
  中文 Tour。
- Learn 页面读取 knowledge graph 中的 tour，没有正式课程、练习、卡片、
  FSRS 或持久学习进度。
- 核心 persistence 把数据目录固定解析到被分析根下的 .ua 或旧目录。
- worktree skill 默认会重定向输出；适配器运行时必须显式关闭重定向。
- 上游文档确认新项目使用 .ua，旧数据目录保持兼容，并支持增量指纹。
- UA 仓库根包含 MIT LICENSE，虽然插件 `package.json` 没有重复声明 license
  字段；允许按 MIT 条款调用和修改，但复制 substantial portions 时必须保留
  许可证与版权声明。

结论：UA 是外部地图引擎和原生导览来源，不是 UniversityLocal 的课程系统。

### FSRS

[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 是 Open Spaced
Repetition 维护的 MIT TypeScript 实现。2026-07-20 npm latest 为 5.4.1，支持
Node 20 以上，提供 Again/Hard/Good/Easy、repeat/next、参数序列化、回滚和
从 review history 重建等能力。

PBMLS 自研代码虽然声称 FSRS-6，但实际使用手写倍数更新 stability 和简化
遗忘公式。它可作为 UI、交叉练习和先修关系的 donor，不应成为调度真相。

结论：精确锁定 ts-fsrs 5.4.1；第一阶段不引入参数优化 binding，等真实复习
数据量足够后再评估。

### SQLite

[Node 24.18 SQLite 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
显示 node:sqlite 在 24.15 后是 release candidate，DatabaseSync 默认启用外键
约束和 defensive mode，并支持 prepared statements、session/changeset 与
backup。

结论：本地单用户、小事务场景使用 node:sqlite，避免额外 native dependency；
通过 LearningStore 接口隔离 RC 风险。浏览器不能直接访问数据库，只有本地
Node 服务拥有连接。

### Pie Shared Repositories

- SwimmerUIKit 1.2.0：已安装，负责共享组件、API 和设计 token。
- SwimmerBackend client 0.4.0：现有公开合同只有 Auth 和 Wallet，没有学习
  资料同步；云同步阶段需要产品级后端合同。
- SwimmerAIKit 0.3.0：只在应用运行时真正调用模型时使用。第一阶段由 AI 宿主
  教学，所以不安装无效依赖。
- SwimmerGameServerKit 0.2.1：权威多人游戏服务器，与单人学习和测验无关，
  明确不采用。

## Chosen Reuse

| Need | Choice | Reason |
| --- | --- | --- |
| Spaced repetition | ts-fsrs 5.4.1 | 成熟 MIT TypeScript 实现 |
| Local learner state | Node 24 node:sqlite | 随已固定 runtime 提供，减少 native 依赖 |
| Project map | External UA 2.9.4 adapter | 保留全量图能力，不污染源仓库 |
| Shared UI | SwimmerUIKit 1.2.0 | HQ 对齐的品牌组件和 token |
| Commercial University auth/sync | SwimmerBackend | 仅供未来独立 `University` 评估；UniversityLocal 不接后端 |
| PBMLS reuse | Concepts only | 保留交叉练习/先修关系，拒绝手写 FSRS 和 localStorage SSOT |

## Rejected Options

- 把 UA Tour 当正式课程。
- 在 SupaLuv 内保留 UniversityLocal 学习资料。
- 在浏览器 localStorage 中保存全部课程和学习历史。
- 自研 FSRS 数学实现。
- 为单人复习引入 SwimmerGameServerKit。
- 为了省事直接移植 UA Dashboard，而不是消费其数据并建设本项目学习 UI。
- 同一 commit 的 UA 数据直接原地覆盖。
