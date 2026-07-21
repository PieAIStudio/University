---
name: knowledge-node
description: 将 AI 对话里一个值得保留的知识点保存为 UniversityLocal 原子笔记、证据和可选复习卡。用户说“记一下”“保存知识点”“做成卡片”“加入复习”“沉淀到 UniversityLocal”时使用；普通教学不自动保存。
---

# Knowledge Node

把一次追问整理成可验证、可复习的知识单元。只写 UniversityLocal，不写 Obsidian、PieVault、被学习仓库或云端。

## 不可违反的边界

1. 只有用户明确要求保存时才落盘；不得暗中记忆。
2. 一份笔记只回答一个核心问题；多个概念拆开，不能保存整段聊天。
3. `content` 是重新组织后的教学 Markdown，禁止粘贴原始对话、系统提示、宿主元数据或无关上下文。
4. 事实必须有固定源码快照证据；推论要明确标为推论；个人理解不能冒充项目事实。
5. 只通过 `pnpm university -- capture` 写入。不要直接编辑 `studies/**/notes` 或 `learning.sqlite`。
6. 同一次保存重试时复用同一个 proposal 文件、note ID 和 `captureId`。不得每次失败都生成新 ID。
7. UniversityLocal 永久纯本地；不要调用 SwimmerBackend，也不要上传内容。

## 工作流

### 1. 确定 study 与会话

优先用用户点名的 study，否则从教学上下文推断；仍不唯一时问一次，不要猜。

```bash
pnpm university -- status --study <study-id>
pnpm university -- session status --study <study-id>
```

无学习会话也可保存并省略 `origin.sessionId`；不要私自创建会话。

### 2. 先做信号与事实检查

先读取已有笔记的最小元数据：

```bash
pnpm university -- knowledge list --study <study-id>
```

用 `id/title/question/summary/tags` 做语义比较，再决定是新建还是修订：

- 核心问题与答案相同，且已有笔记为 `draft`、`active` 或 `stale`：复用原 note ID，读取最新 revision 后按生命周期追加修订，不要创建同义副本。
- 核心问题与答案相同，但已有笔记为 `retired`：停止写入并说明 `retired` 是终态；让用户明确选择跳过，或以新 ID 创建一份有意区分的新笔记。不得复活或修订已退役笔记。
- 主题相关但核心问题不同：保留为独立知识点。
- 信息不足以判断：先把候选和可能重复项展示给用户，不写入。

这是可解释的去重预检；不引入向量数据库，也不编造精确相似度。

- 高价值：反直觉原理、架构边界、设计取舍、踩坑原因、可复用工作流。直接整理。
- 低价值：一次性命令、临时变量名、已经显而易见的常识。若用户没有明确坚持，建议不保存。
- `source-fact`：必须找到当前 study 最新固定快照里的真实文件与行号，证据 `kind` 必须是 `fact`。
- `inference`：写清“这是基于哪些事实的推论”，证据 `kind` 使用 `inference`。
- `personal-understanding`：可无源码证据，但正文必须写明这是个人理解或记忆模型。
- 找不到可靠证据时使用 `status: "draft"`，不要生成进入复习队列的假事实。

源码证据必须绑定 `status` 返回的最新快照：`snapshotId` 与 `sourceCommit` 缺一不可。若使用 UA 节点，还必须同时填写 `analysisId`、`graphHash` 和至少一个 `nodeIds`；不确定时宁可只用源码证据。

### 3. 生成原子内容与检索卡

正文应尽量短，但至少包括：直接答案、首次出现的准确术语及白话解释、在当前项目中的真实锚点、容易误解之处。先用具体例子；类比只在确实有帮助时使用，并说明类比在哪个边界失效。

默认使用文字、列表或表格。仅在用户明确要求/修图，或至少三个实体关系用文字难讲清时调用 `mermaid-diagrams`。图不能是唯一信息载体，也不强制每篇都画。

生成 0–3 张需要主动回忆的 `basic` 卡片。草稿事实尚未验证、内容不适合客观判定，或一张卡也不会帮助复习时，可以生成 0 张：

- 正面问一个能独立回答的问题，不写“根据上文”。
- 背面给最小充分答案，并保留必要边界。
- 不随机挖空，不复制整段正文，不制作无法从证据判断对错的问题。

ID 使用小写 kebab-case。新建用 `contentRevision: 1`；修订先读最新、使用 `+1` 并保留 `createdAt`。新修订使用新 `captureId`；同一修订重试必须复用它。

### 批量整理模式

只有用户明确说“整理今天学的”“批量整理这次学习”之类的话时才进入批量模式：

1. 先列出候选知识点、理由、claim type、可能重复项（含其 `status`）和建议卡片数。
2. 用户选择或修正候选前，写入次数必须为零。
3. 确认后仍逐个执行本技能的去重、证据、dry-run 和正式 capture；批量模式不是绕过单条协议的第二套写入通道。
4. 某一条失败时保留其稳定 ID 和 proposal，继续与否由用户决定；不要重复生成其余已成功条目。

### 4. 写 proposal 文件

把 proposal 写到 `.scratch/captures/<capture-id-safe-name>.json`。第一次构造或修订 proposal 时读 [references/capture-proposal.md](references/capture-proposal.md)；不要提供 `contentHash`，系统会计算。文件一旦用于尝试就不要重新生成时间戳或 ID。

### 5. 先演习，再正式保存

```bash
pnpm university -- capture --study <study-id> --input .scratch/captures/<file>.json --dry-run
pnpm university -- capture --study <study-id> --input .scratch/captures/<file>.json
```

只有 dry-run 成功才执行第二条。正式结果若为 `reused`，说明重试安全完成，不要再造一份。如果 `status` 是 `active`，系统会把卡片加入同一个 FSRS 复习队列；`draft` 不会加入。

### 6. 给用户一张简短回执

报告：保存到哪个 study、笔记标题与 revision、事实/推论/个人理解、是否进入复习、主要证据。不要声称保存了原始聊天，也不要声称上传或云备份。
