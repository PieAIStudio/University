---
id: SPEC-0001
title: UniversityLocal Study System Foundation
type: spec
status: completed
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
domain: product
tags:
  - study
  - curriculum
  - fsrs
  - ua
  - local-first
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - ADR-0001
  - PLAN-0001
  - REF-UNIVERSITY-LOCAL-ARCHITECTURE-RESEARCH-2026-07-20
---

# SPEC-0001: UniversityLocal Study System Foundation

## Problem

AI 宿主能够读取真实项目，却缺少一个独立、可追溯、可复习的大学空间。
现有 UA 可以生成项目图和 Tour，但不是正式课程；历史 PBMLS 把重要状态放入
浏览器 localStorage，并自行实现近似 FSRS，难以让 AI 宿主、文件系统和 Web
UI 共享可靠真相。

UniversityLocal 必须在不污染被研究仓库的前提下，保存项目快照、UA 图、正式
课程、练习卡片和个人学习历史，并以 SupaLuv 完成第一条真实闭环。

## Configuration Contract

配置优先级从高到低：

1. 当前 CLI 显式参数。
2. UNIVERSITY_LOCAL_STUDIES_ROOT 环境变量。
3. 机器私有的 university-local.config.local.json。
4. 受版本控制的 university-local.config.json。
5. 仓库根下的 studies 默认目录。

相对路径以 UniversityLocal 仓库根解析，不以调用命令时的 cwd 解析。所有运行
时路径必须 realpath 后再比较。

机器私有配置允许绝对路径但不得提交。可移植配置优先使用相对路径。

studiesRoot 不得与任何 sourceRoot 相同，也不得互相包含，避免把学习数据扫描
进源项目或把源项目误当学习数据删除。

## Study Container Contract

每个 study 使用稳定小写 kebab-case id。概念目录如下：

```text
studies/
  .university-local-root
studies/<study-id>/
  study.json
  source/
    registration.json
    repository.git/
    snapshots/<snapshot-id>.json
  ua/
    <analysis-id>/
      manifest.json
      data/
      workspace/                 # 仅分析期间存在
  courses/
    <course-id>/
      course.json
      units/<unit-id>/
        unit.json
        lessons/<lesson-id>/
          latest.json
          revisions/<n>/
          exercises/<exercise-id>/
          cards/<card-id>/
  learner/
    learning.sqlite
    backups/
```

study.json 保存可移植身份、标题、目标和默认 course；source/registration.json
保存本机绝对源路径。`studies/` 默认在项目根可见，但整体被 Git 忽略；可以用
受控配置把书架移到其他目录。

不建立另一个手工维护的 study index。系统通过发现有效 study.json 构建索引，
避免目录和索引出现两个真相。

## Source Snapshot Contract

- 第一阶段只接受 clean snapshot；不实现 dirty snapshot。
- snapshot manifest 固定 full commit SHA、tree SHA、工具版本和被排除的外部
  symlink 路径。
- UniversityLocal 的 `repository.git` 是按需、浅层的裸对象仓库，只获取明确
  commit 并写入 `refs/university-local/commits/*`，不镜像源仓库全部 refs。
- 事实证据直接读取固定 commit 的普通 Git blob，不依赖可写 checkout。
- submodule 和 Git LFS 在明确支持前拒绝；外部 symlink 被记录并从 UA 扫描移除。
- 所有 fetch/worktree 操作都只写 UniversityLocal，不能写入源仓库 `.git`。

## UA Analysis Contract

- 每次分析生成独立 analysisId。
- 默认 analysisId 由 snapshot、source commit、engine version、输出语言、full
  模式和语义 config hash 共同派生；显式 ID 仍必须通过相同 immutable manifest
  字段校验，不能恢复或覆盖另一种配置的分析。
- analysis manifest 至少记录 engine、engineVersion、snapshotId、sourceCommit、
  outputLanguage、configHash、graphHash、nodeCount、edgeCount、createdAt 和 status。
- 运行时临时创建 snapshot worktree，并把其 `.ua` 映射到该 analysis 的 data
  目录；成功、失败和取消都必须清理 workspace。
- worktree 模式设置 UNDERSTAND_NO_WORKTREE_REDIRECT=1。
- 不安装 UA 自动 commit hook，不在源项目运行 UA。
- 第一条证明路径执行 full analysis 且关闭 auto-update；增量优化等全量闭环
  稳定后再设计，不能复用不匹配 commit 的旧图伪装当前分析。
- 课程证据引用 analysisId、graphHash 和 nodeIds；不能只引用易变 current 指针。
- UA Tour 在 UI 标记为“UA 原生导览”，不能标记为正式课程。

## Course Contract

- `course` 是 study 内的一门正式课程，例如 founder-engineer；不再增加 track
  这一层同义概念。
- course 包含有序 unit 和先修关系；lesson 属于 unit，exercise/card 与 lesson
  同目录保存。
- lesson 正文使用 Markdown，元数据使用 JSON。
- 内容状态只有 draft、active、stale、retired。
- course 和 unit 必须以 draft 创建；只有其所有子内容均存在、active、hash
  正确且证据仍有效时，才能自底向上激活。active/retired 容器禁止直接改内容。
- 每条事实性材料必须区分 fact 与 inference，并带 evidence references。
- evidence 至少包含 snapshotId、sourceCommit 和 source path；使用 UA 时再包含
  analysisId、graphHash 和 nodeIds。
- source/UA 变化后系统计算受影响内容并标记 stale，不自动改写已批准课程。

## Practice Contract

第一条浏览器闭环只支持短答案练习和 basic recall 卡片；数据 schema 可以保留
cloze/explain 作为后续出口，但不能在 UI 中展示未完成能力。必须先回答再揭晓，
GET 接口不得泄露 exercise expectedAnswer 或 card back。

exercise 和 card 内容拥有稳定 id、contentRevision、contentHash、来源状态和证据。

只修改措辞且语义不变时保留 card id 和 FSRS 状态；知识含义变化时必须创建新
card 或显式 reset，不能静默继承旧掌握度。

## Learner State Contract

每个 study 使用一个 learning.sqlite，至少包含：

- schema_migrations
- scheduler_profile
- card_state
- review_event
- lesson_progress
- exercise_attempt
- learning_session

review_event 是追加式事实，card_state 是当前投影。提交评分时，写 event 和更新
state 必须处于同一事务；Store 必须能从完整 review history 重新执行 FSRS，
校验事件链并事务性恢复 event-backed card projection。没有 review event 的新卡
保持原样。第一阶段不预建没有合同的 sync outbox。

采用 ts-fsrs 5.4.1。每个 review event 记录 schedulerVersion、parametersHash、
rating、reviewedAt、contentRevision 和前后状态，以便审计和重建。

默认 request retention 为 0.9，可配置。UI 可以限制单次会话数量，但不能隐藏
逾期总量或把未展示卡片误报为完成。

## Local Service Contract

- 浏览器只访问 loopback 本地服务，不直接访问文件系统和 SQLite。
- 服务启动时解析配置、发现 studies、打开需要的数据库并提供 JSON API。
- 文件写入使用临时文件 + fsync/rename 或等价原子替换。
- 所有 JSON 输入在边界使用 Zod 校验。
- SQLite 使用 prepared statement、foreign keys、defensive mode、事务和备份。
- node:sqlite 只能出现在 LearningStore adapter 内，业务层不能直接依赖。

## Web Information Architecture

第一版必须提供：

1. Today：下一课和到期卡片，直接进入学习动作。
2. Studies：study、source/UA 状态、正式 course/unit/lesson、证据、练习与卡片。

UA 图和 Tour 是 Studies 内的项目地图证据，不单独扩成第一版页面家族。图可视化、
历史、薄弱点分析、设置、导出和额外题型必须等三次真实学习会话后再评估。

共享组件和 token 来自 SwimmerUIKit；产品页面组合和教学内容留在本仓库。

## Swimmer Platform Boundaries

> Historical foundation note: the possible future sync lane below was closed by
> the owner's permanent local-only decision in ADR-0003. It must not be used as
> current implementation authority for UniversityLocal.

- SwimmerBackend 是唯一云端平台。
- 第一纵向切片不得依赖云端才能学习。
- 后续同步只考虑经批准的课程内容和学习事件；不上传 source path、源码、
  snapshot、UA 图和 intermediate。
- SwimmerBackend client 现有 Auth/Wallet 合同不覆盖同步。实现同步前必须形成
  单独后端变更计划、在 SwimmerBackend 落 migration/API，并通知所有者安排
  专用检查和部署。
- 第一阶段不需要运行时模型调用，因此 SwimmerAIKit 暂不安装。
- 第一阶段没有权威多人需求，因此 SwimmerGameServerKit 不安装。

## SupaLuv Migration Contract

1. 注册 studyId=supaluv，源路径只读。
2. 读取现有 UA meta，按其旧 commit 导入为 legacy analysis；复制而非移动。
3. 为 SupaLuv 当前 clean commit 创建 UniversityLocal-owned snapshot。
4. 使用固定 UA 2.9.4 生成新的 analysis。
5. 验证图 hash、计数、层、Tour、fingerprints 和源文件覆盖。
6. 生成 founder-engineer 最小课程、一个练习和一组卡片。
7. 验证 SupaLuv Git 状态在流程前后完全一致。
8. 只有获得用户再次明确授权，才处理 SupaLuv 原有 UA 目录。

## Acceptance

- UniversityLocal 完整 verify 通过。
- PGS portfolio 中只有 university-local 新身份，没有旧路径或重复条目。
- 默认 studiesRoot 和外置 studiesRoot 均有路径测试。
- source/studies 互相包含的危险配置被拒绝。
- clean snapshot 不修改 source repo，并固定 commit/tree。
- UA 数据只写入 study analysis 目录。
- 同一 commit 的两次不同 UA 配置拥有不同 analysisId，不能互相覆盖。
- 课程 evidence 能定位 source commit/path 和 UA graph/node。
- ts-fsrs 的四档评分、事务、重放和版本记录有确定性测试。
- 浏览器真实完成“课程 → 练习 → 卡片复习 → 重载保持”流程。
- SupaLuv 前后 Git 状态一致。
