---
id: REF-USING-UNIVERSITY-LOCAL-WITH-GROK
title: Using UniversityLocal With Grok Build
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-20
domain: operations
tags:
  - grok-build
  - learning
  - beginner-guide
pinned: true
related:
  - SPEC-0002
  - PLAN-0002
---

# 用 Grok Build 使用 UniversityLocal

## 先记住一个比喻

UniversityLocal 是你的本地大学，不是被学习项目的一部分：

- `SupaLuv` 是工厂；
- 固定 Git commit 是盖章后的工厂图纸；
- Understand Anything（UA）是测绘队画的地图；
- `courses/` 是大学审核后的课本；
- `notes/` 是你和 AI 追问后形成的课堂笔记；
- `learner/learning.sqlite` 是成绩册和复习日历。

地图不是课本，课本也不是成绩册。把这几层分开，项目更新时才能知道“哪张地图旧了、哪节课要重审”，而不会一键覆盖掉过去学过的内容。

## 最简单的日常入口

这里的 Grok 指 **Grok Build CLI**，不是浏览器里的普通 Grok 聊天网页。

```bash
cd /Users/yuanfei/PieAI/UniversityLocal
grok
```

第一次或项目规则变化后，可先在另一个终端检查宿主看到了什么：

```bash
grok inspect --json
```

然后直接用自然语言：

```text
用 teach-from-study 带我继续学习 SupaLuv。先用生活类比，再结合真实代码问我一个问题。
```

Grok 应先查看 study 状态，开始或沿用一段本地学习 session，再从固定快照、正式课程和证据教学。不要让它直接扫描 SupaLuv 的实时工作区来冒充教材。

## 三种最常用的动作

### 学习一节课

对 Grok 说：

```text
继续学习 SupaLuv，今天只讲一个最重要的概念，讲完检查我是否真的理解。
```

AI 对话适合解释、追问和苏格拉底式教学。Web UI 适合看课程、做固定练习、查看源码证据和完成 FSRS 复习：

```bash
pnpm dev
```

两者不是竞争关系：AI 像老师，Web UI 像课本、题册和复习桌。

### 把追问保存为知识点

理解了一个值得长期保留的内容后，对 Grok 说：

```text
把刚才“作者主线和 AI 支线的边界”记一下，保存成 UniversityLocal 知识笔记，并做成复习卡片。
```

`knowledge-node` 技能会把对话重新整理成一个原子知识点，先校验证据，再通过 UniversityLocal CLI 写入 `studies/<study-id>/notes/`。它不会保存整段聊天，也不会写到 Obsidian、SupaLuv 或云端。

如果 AI 找不到可靠源码证据，它应保存为 `draft`，而不是把猜测放入复习队列。事实、推论、个人理解三者必须明确区分。

### 被学习项目更新后刷新

先在被学习项目完成并提交你希望学习的代码：

```bash
git -C /Users/yuanfei/PieAI/SupaLuv status
git -C /Users/yuanfei/PieAI/SupaLuv log -1 --oneline
```

然后在 UniversityLocal 的 Grok 中说：

```text
SupaLuv 已经有新的本地 commit。用 refresh-study 刷新 UA，并检查课程和知识笔记哪些需要更新。
```

只需要本地 commit，**不需要 push 到 GitHub**。commit 像给图纸盖章，push 只是把盖章图纸寄一份到远端。

如果 SupaLuv 还有未提交文件，默认刷新会停止。只有你明确说“只学习当前 commit，排除这些未提交文件”，AI 才能使用对应确认开关。那些未提交内容不会进入快照，也不会被 UniversityLocal 删除或修改。

刷新过程应当是：

1. 固定新 commit 快照；
2. 只在 UniversityLocal 受管 workspace 跑 UA；
3. 对比旧证据并把受影响内容标为 stale；
4. 重新研究后追加课程/笔记 revision；
5. 全部证据重新通过 freshness gate 后才恢复 active。

“刷新”不是把旧教材全部覆盖；更像教材出新版，旧版仍留在档案室。

## 可以直接使用的本地命令

```bash
pnpm university -- status --study supaluv
pnpm university -- session status --study supaluv
pnpm university -- learner backup --study supaluv
```

重置学习记录是少数危险操作，必须精确确认 study ID，并先产生可验证备份：

```bash
pnpm university -- learner reset --study supaluv --confirm supaluv
```

它只重置 `learner` 成绩册，不删除源码快照、UA、课程或知识笔记。

## 初学者最容易忽略的事

1. **Grok Build 与 Grok 网页不是同一个工作方式。** 必须从 UniversityLocal 根目录启动 CLI，宿主才能自动读取 `AGENTS.md` 和项目技能。
2. **commit 不等于 push。** 学习只需要本地 commit；push 是远端协作/备份选择。
3. **未提交代码不在教材里。** 屏幕上刚改完但没 commit 的内容，就像白板草稿，不应该被长期课程引用。
4. **UA Tour 不是正式课程。** 它是机器地图，可以帮助老师研究，但没有自动获得“正确教材”的资格。
5. **AI 回答不会自动变成知识。** 只有你明确说“记一下”，系统才保存经过整理的笔记和卡片。
6. **同机备份不是灾难备份。** `learner/backups/` 能防误重置和数据库损坏，但电脑硬盘损坏时可能一起丢失。UniversityLocal 永不上传；完整 `studies/` 应由你放进 Time Machine 或明确选择的外部备份方案。
7. **本地文件不等于模型不接收上下文。** Grok Build 读取文件后，相关上下文可能发送给所选模型服务。学习私有项目之前先查看 Grok Build 的 `/privacy` 与当前企业/账号政策，不要把“资料不写入我们的后端”误解为“模型提供商绝不会接收提示内容”。

## 这个版本故意没有做什么

- 不接 SwimmerBackend；UniversityLocal 永久纯本地。
- 不做账号、云同步、移动端或多人协作。
- 不安装 Obsidian/黑曜石插件作为必需运行时。
- 不自制第二套记忆曲线；统一使用 `ts-fsrs`。
- 不用关键词比例假装自动判分，不显示没有足够数据支撑的掌握度和热力图。

未来商业产品 `University` 若存在，应是另一个仓库和边界；不能通过给 UniversityLocal 偷偷加后端来“顺便商业化”。
