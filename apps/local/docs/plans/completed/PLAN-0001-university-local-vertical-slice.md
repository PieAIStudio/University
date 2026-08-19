---
id: PLAN-0001
title: UniversityLocal Foundation And SupaLuv Vertical Slice
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-20
domain: execution
tags:
  - implementation
  - supaluv
  - ua
  - fsrs
pinned: true
related:
  - CANON-UNIVERSITY-LOCAL-MISSION
  - ADR-0001
  - SPEC-0001
---

# PLAN-0001: UniversityLocal Foundation And SupaLuv Vertical Slice

## Goal

把已确认的产品边界和存储模型实现成一个可验证的 SupaLuv 纵向切片，同时保持
源项目干净、学习数据私有、课程证据可追溯。

## Scope

本计划覆盖重命名、PGS 注册、studies 数据合同、本地服务、SQLite/FSRS、UA
适配、最小正式课程和 Web 学习闭环。云端同步、dirty snapshot、图可视化、
额外题型和多人能力均明确延期，不为将来能力预建空壳。

## Block 1 · Identity Migration

- [x] 检查 University 和 PGS 工作区及目标路径。
- [x] 建立改名前完整 verify 基线。
- [x] 将根目录改为 UniversityLocal。
- [x] 将 package 改为 @pieai/university-local。
- [x] 更新 README、AGENTS、政策、运行时文案和当前工作文档。
- [x] 将 PGS target 原位迁移为 university-local 和新路径。
- [x] 重建 node_modules，消除旧绝对路径。
- [x] 通过 portfolio check、assets-check、doctor 和 AI health。
- [x] 扫描 PieAI 受管文件，确认没有旧绝对路径。
- [x] 通过改名后的完整 pnpm verify。

## Block 2 · Study Shelf And Contracts

- [x] 创建根级 studies 和默认私有 Git 边界。
- [x] 完成 AnvilLocal、UA、PBMLS、FSRS、SQLite 和共享库研究。
- [x] 记录 Mission Brief、ADR、研究证据和 Spec。
- [x] 添加受控配置和本机 override 示例。
- [x] 实现 project root 和 studiesRoot 解析。
- [x] 实现 realpath、互相包含和危险路径校验。
- [x] 定义并测试 study/source/snapshot/analysis schema。
- [x] 定义并测试 course/unit/lesson/exercise/card schema。
- [x] 定义并测试 evidence、revision 和 stale 生命周期。

## Block 3 · Local Persistence

- [x] 固定并安装 Zod 和 ts-fsrs；Node 24 直编译，拒绝为 tsx 放宽安装脚本策略。
- [x] 建立 loopback Node API 和 Vite proxy。
- [x] 定义 LearningStore 接口。
- [x] 使用 node:sqlite 实现 migration runner。
- [x] 实现 card state、review event 和 transaction。
- [x] 实现 lesson progress、exercise attempt 和 learning session。
- [x] 删除没有同步合同的 outbox，只保存已被本地闭环使用的状态。
- [x] 实现数据库备份和恢复 smoke test。
- [x] 添加 in-memory 和 file-backed 确定性测试。

## Block 4 · Source Snapshot And UA Adapter

- [x] 实现 study 注册和只读 source 验证。
- [x] 实现 UniversityLocal-owned 浅层裸 Git 对象仓库，不镜像源仓库 refs。
- [x] 实现 clean commit/tree snapshot manifest，证据直接读取 immutable blob。
- [x] 明确第一阶段拒绝 dirty snapshot、submodule 和 LFS。
- [x] 实现 UA analysisId 和 manifest。
- [x] 实现临时 .ua 映射和 worktree redirect 禁用。
- [x] 实现 full-only、no-auto-update 的临时 UA worktree。
- [x] 校验 graph/meta/fingerprint/config 和 SHA-256。
- [x] 证明失败/取消不会在 source repo 留文件或 hook。

## Block 5 · Curriculum And Host Teaching

- [x] 将 track 合并为 course，并把 unit/lesson/exercise/card 收拢到课程树。
- [x] 实现 exercise/card 文件读写和 content revision。
- [x] 实现 source/UA evidence validator。
- [x] 实现 source commit 变化后的 stale 计算。
- [x] 创建 UniversityLocal 项目级教学 skill。
- [x] 教学 skill 明确区分 UA 导览、正式课程和学习记录。
- [x] 实现自底向上的 draft → active 激活门禁和 active 容器只读约束。

## Block 6 · Web Learning Experience

- [x] 建立 Today：下一课与到期卡片。
- [x] 建立 Studies：study/source/UA/course/unit/lesson 一体化入口。
- [x] 建立 Markdown lesson 与 commit/UA evidence 查看。
- [x] 建立先回答再揭晓的短答案练习。
- [x] 建立卡片尝试、揭晓和 FSRS 四档评分。
- [x] GET 不泄露 expectedAnswer/card back，写 API 使用 token/origin/idempotency。
- [x] 复用 SwimmerUIKit 共享组件/token。
- [x] 完成第一版键盘、移动布局、空状态和错误状态。
- [x] 使用真实 SupaLuv 课程完成桌面与移动端浏览器 QA。

## Block 7 · SupaLuv Vertical Slice

- [x] 记录 SupaLuv 迁移前 Git/UA receipt。
- [x] 注册 supaluv study。
- [x] 复制导入现有 UA 为 legacy analysis。
- [x] 创建当前 clean snapshot。
- [x] 使用固定 UA 2.9.4 完成 606 文件全量 analysis、终审与持久化。
- [x] 生成 founder-engineer 最小 course、lesson、exercise 和 4 cards。
- [x] 完成一次真实教学和一次 FSRS review。
- [x] 证明 SupaLuv Git 状态完全不变。
- [x] 保留原 UA，等待用户单独授权清理。

## Block 8 · Shared Platform Boundary

- [x] 审计 SwimmerBackend、SwimmerAIKit、SwimmerUIKit 和 SwimmerGameServerKit。
- [x] 第一阶段只采用 SwimmerUIKit 1.2.0；不安装无运行时职责的依赖。
- [x] 将云同步、运行时 AI provider 和多人服务器延期到有真实需求时。
- [x] 确认本纵向切片不需要修改或部署 SwimmerBackend。

## Block 9 · Verification And Closeout

- [x] 运行 typecheck、lint、format、unit、integration 和 build。
- [x] 运行 doc-gov 和 PGS portfolio 门禁。
- [x] 运行真实浏览器闭环并检查桌面、390px 移动端、重载和控制台。
- [x] 运行路径迁移、数据库备份和 UA 失败恢复测试。
- [x] 更新 README、用户指南、配置说明和数据备份说明。
- [x] 记录共享库/后端是否发生修改。
- [x] 完成可复用 learning 的显式 capture/skip 决定。
- [x] 将本计划移动到 completed 并填写最终 receipt。

## Progress Receipt · 2026-07-20

- 项目已从 `/Users/yuanfei/PieAI/University` 原位迁移为
  `/Users/yuanfei/PieAI/UniversityLocal`，PGS target 同步迁移且无重复注册。
- 默认私有资料根为可见的根目录 `studies/`（整体 Git ignored），可由 CLI、
  环境变量、本机配置和受控配置覆盖；
  realpath 与互相包含校验已覆盖 macOS `/var` 到 `/private/var` 情况。
- 本地持久化、快照、UA 适配、课程原子修订、激活门禁、证据、API 安全和
  FSRS 均有自动测试；最终数量以 closeout receipt 为准。
- SupaLuv 历史 UA 已绑定 commit `79c8e7bb4b606412392c974dbea92f9b865334e4`
  导入，共 1453 节点和 3256 边；当前 clean snapshot 固定在
  `feeb848f1e3b91ca13f6e222290b70a4ee74e11a`。
- 当前全量 UA analysis 为 `ua-feeb848f-v294-zh-full`，覆盖 606 个文件，ready
  manifest 记录 1,542 个节点、2,656 条边、9 个架构层、10 步中文 Tour 和
  graph hash `sha256:45275fe43a6fe2a82c5c88237e74d4a7801263af983ea53fe22abad973c5eca1`。
- `founder-engineer` 课程已激活，包含 1 个 unit、1 个 lesson、1 道练习和
  4 张卡片。浏览器已记录 1 次错误、1 次正确练习和 1 次 FSRS Good 评分，
  刷新后课程进度和调度状态保持。
- 桌面端和 390px 手机端均无横向溢出；控制台 0 warning、0 error。Studies
  显示 2 份源码快照、2 份 ready UA 分析，并明确 UA 导览不是正式课程。
- 未修改 SwimmerBackend、SwimmerAIKit、SwimmerUIKit 或
  SwimmerGameServerKit；项目只消费 SwimmerUIKit 1.2.0。为消除重复运行会
  丢失 JSON import 的风险，已对 UA 合并器实施最小上游修复与回归测试；为
  防止 ignored study 数据污染组合扫描，也修复了 PGS package manifest 发现器。

## Acceptance

- [x] SPEC-0001 全部 acceptance 可由自动测试或可检查 receipt 证明。
- [x] 用户能在 UniversityLocal 中完成 SupaLuv 的真实学习闭环。
- [x] 没有源项目污染、未经授权的共享库发布或生产部署。

## Closeout Receipt · 2026-07-20

- UniversityLocal 全仓门禁通过：typecheck、零 warning lint、format check、
  12 个测试文件中的 85 个测试、生产构建和全部 PGS/doc-gov 检查。
- 最新 19 仓 portfolio AI health 输出通过固定产物验证；UniversityLocal 的
  PGS/技术版本/host SSOT/skill 安装均一致，唯一 attention 是新仓库尚无首个
  commit，因而全部 93 个源码路径仍是 untracked。
- SupaLuv 的 HEAD、tree 和 Git status 与任务开始 receipt 完全相同；原 `.ua/`
  未删除。SwimmerBackend 与四个共享 kit 均未因本项目修改或部署。
- UA reviewer 批准当前图进入 Phase 7；5 类 enrichment warning 不阻断课程，
  包括孤立节点与部分文档/流水线关系可在后续分析质量迭代中补充。
- PGS scanner 和 UA import merge 的两个可复现共享缺陷均有回归测试；PGS
  scanner 经验已写入项目 learning。未执行 commit、push、发布或部署。
