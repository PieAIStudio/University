---
id: CANON-UNIVERSITY-LOCAL-MISSION
title: UniversityLocal Mission Brief
type: canon
status: stable
canonical: true
owner: human
created: 2026-07-20
last_reviewed: 2026-07-20
domain: product
tags:
  - mission
  - product-boundary
  - learning
pinned: true
related:
  - ADR-0001
  - SPEC-0001
  - PLAN-0001
---

# UniversityLocal Mission Brief

## Mission

UniversityLocal 是 Pie 的个人 AI 宿主驱动研究与教学系统。用户从本仓库
启动 Grok Build、Codex、Claude Code 或兼容的编码宿主，选择一个外部项目作为学习对象，AI
宿主依据真实源码、配置、测试和项目证据进行研究、授课、出题和复习。

学习资料属于 UniversityLocal，不属于被研究的项目。默认数据书架位于根级
studies 目录；用户可以通过配置把整套书架迁移到其他目录。

## Product Role

UniversityLocal 在所有者的项目组合中与 HQ、Project Governance System 具有
并列的战略重要性，是个人使用的教学基础设施，不是当前 Pie 消费级 AI 产品线。
它在 PGS 中仍应注册为 target，因为它消费 PGS 治理；target 描述治理关系，
不代表产品级别较低。

本地端和在线端现在是同一个学习产品的两个壳，而不是两套数据产品。两端
都使用 SwimmerBackend 账号和同一份云端学习文档，进度、答案、批注、复习、
词汇、收藏、练习历史和设置可以跨 Windows、macOS 与网页继续使用。

本地端仍保留作者工作流：被研究仓库、源码快照、UA 图谱、课程原稿和笔记
留在本地书架，不进入学习账户同步文档。两端唯一允许的运行时差异是 AI
判定来源：本地端走 AI 编码宿主/剪贴板，在线端走计量的在线 AI 适配器。

## Mental Model

- 被研究仓库是工厂。
- 源码快照是大学保存的实验样本。
- Understand Anything 是测绘队，生成项目地图和原生导览。
- UniversityLocal 是大学，依据地图、源码和学习目标设计正式课程。
- 练习和卡片是训练材料。
- 云端学习文档是学生成绩册；SQLite/browser 只做缓存、迁移来源或离线 outbox。

UA 导览、正式课程和个人学习记录是三个不同层级，不是两套互相竞争的
课程。

## First Proof

第一个纵向切片使用 SupaLuv，必须证明：

1. UniversityLocal 能以只读方式注册 SupaLuv。
2. 默认分析干净、固定 commit 的 UniversityLocal 自有快照。
3. UA 原生数据只写入 UniversityLocal。
4. AI 宿主能基于源码与 UA 图生成正式课程、练习和卡片。
5. Web UI 以 Today 和 Studies 两个入口完成正式课程与个人学习闭环，并在
   Studies 内清楚标识 UA 原生地图不是正式课程。
6. FSRS 能持久化复习事件并正确安排下一次复习。
7. SupaLuv 原仓库在全过程中不产生新的学习副产物。

## Non-goals For The First Proof

- 不建设消费级 University。
- 不内置第二套自主 AI agent 代替 Grok Build、Codex 或 Claude Code。
- 不把源码快照、UA 图谱或中间文件上传到云端；学习账户数据仍然同步到云端。
- 不实现多人课堂或权威游戏服务器。
- 不把源码快照、UA 图谱或中间文件上传到云端。
- 不删除 SupaLuv 现有的 UA 数据，直到导入和新分析均完成验收。

## Success Condition

所有者能在一次真实学习会话中，从 SupaLuv 的项目地图进入正式课程，完成
一个练习和一组到期卡片；所有课程结论都能追溯到固定源码版本，并在源码
变化后得到明确的过期提示。
