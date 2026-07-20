---
name: knowledge-node
description: 把 Grok、Codex 或 Claude Code 对话中值得长期保留的一个知识点，保存为 UniversityLocal 的原子 Markdown 笔记、来源证据和 FSRS 复习卡片。用户说“记一下”“保存这个知识点”“把刚才内容做成卡片”“加入复习”“沉淀到 UniversityLocal”时必须使用；普通提问只教学，不自动保存。
---

# Knowledge Node

把一次有价值的追问整理成一个可验证、可复习的知识单元。UniversityLocal 是唯一写入目标；不要写 Obsidian、PieVault、被学习仓库或任何云端服务。

## 不可违反的边界

1. 只有用户明确要求保存时才落盘。普通教学结束可以询问是否保存，但不得暗中记忆。
2. 一份笔记只回答一个核心问题。多个概念拆成多个 proposal，不能保存整段聊天记录。
3. `content` 是重新组织后的教学 Markdown，禁止粘贴原始对话、系统提示、宿主元数据或无关上下文。
4. 事实必须有固定源码快照证据；推论要明确标为推论；个人理解不能冒充项目事实。
5. 只通过 `pnpm university -- capture` 写入。不要直接编辑 `studies/**/notes` 或 `learning.sqlite`。
6. 同一次保存重试时复用同一个 proposal 文件、note ID 和 `captureId`。不得每次失败都生成新 ID。
7. UniversityLocal 永久纯本地；不要调用 SwimmerBackend，也不要上传内容。

## 工作流

### 1. 确定 study 与会话

优先使用用户点名的 study；否则从当前教学上下文推断。仍不唯一时只问一个简短问题，不要猜。

```bash
pnpm university -- status --study <study-id>
pnpm university -- session status --study <study-id>
```

如果用户还未开始学习会话，可以继续保存，但 `origin.sessionId` 省略。不要为了保存笔记私自创建第二个会话。

### 2. 先做信号与事实检查

- 高价值：反直觉原理、架构边界、设计取舍、踩坑原因、可复用工作流。直接整理。
- 低价值：一次性命令、临时变量名、已经显而易见的常识。若用户没有明确坚持，建议不保存。
- `source-fact`：必须找到当前 study 最新固定快照里的真实文件与行号，证据 `kind` 必须是 `fact`。
- `inference`：写清“这是基于哪些事实的推论”，证据 `kind` 使用 `inference`。
- `personal-understanding`：可无源码证据，但正文必须写明这是个人理解或记忆模型。
- 找不到可靠证据时使用 `status: "draft"`，不要生成进入复习队列的假事实。

源码证据必须绑定 `status` 返回的最新快照：`snapshotId` 与 `sourceCommit` 缺一不可。若使用 UA 节点，还必须同时填写 `analysisId`、`graphHash` 和至少一个 `nodeIds`；不确定时宁可只用源码证据。

### 3. 生成原子内容与检索卡

正文应尽量短，但至少包括：直接答案、初学者类比、在当前项目中的真实锚点、容易误解之处。图只有在能显著解释关系时才使用，不强制每篇都画。

生成 1–3 张需要主动回忆的 `basic` 卡片：

- 正面问一个能独立回答的问题，不写“根据上文”。
- 背面给最小充分答案，并保留必要边界。
- 不随机挖空，不复制整段正文，不制作无法从证据判断对错的问题。

稳定 ID 使用小写 kebab-case。第一次创建用 `contentRevision: 1`；修改既有笔记时先读取最新 revision，使用 `+1`，并保持原 `createdAt`。真正的新修订使用新的 `captureId`；同一修订的重试必须复用旧 `captureId`。

### 4. 写 proposal 文件

把 proposal 写到 `.scratch/captures/<capture-id-safe-name>.json`。文件一旦用于尝试就不要重新生成时间戳或 ID。结构如下：

```json
{
  "note": {
    "schemaVersion": 1,
    "id": "auth-state-boundary",
    "title": "认证状态边界",
    "question": "认证状态为什么必须由会话模块统一管理？",
    "summary": "一句话答案",
    "claimType": "source-fact",
    "status": "active",
    "contentRevision": 1,
    "tags": ["architecture", "auth"],
    "evidence": [
      {
        "kind": "fact",
        "snapshotId": "snapshot-id",
        "sourceCommit": "40-character-commit",
        "sourcePath": "src/auth/session.ts",
        "lineStart": 10,
        "lineEnd": 28
      }
    ],
    "origin": {
      "kind": "ai-conversation",
      "host": "grok-build",
      "capturedAt": "2026-07-20T12:00:00.000Z",
      "sessionId": "optional-open-session-id",
      "captureId": "grok:session-or-date:auth-state-boundary-v1"
    },
    "cards": [
      {
        "id": "auth-state-owner",
        "kind": "basic",
        "front": "认证状态应由哪个边界负责？为什么？",
        "back": "最小充分答案",
        "tags": ["architecture", "auth"]
      }
    ],
    "createdAt": "2026-07-20T12:00:00.000Z",
    "updatedAt": "2026-07-20T12:00:00.000Z"
  },
  "content": "# 认证状态边界\n\n重新组织后的教学内容。"
}
```

不要提供 `contentHash`，系统会计算。

### 5. 先演习，再正式保存

```bash
pnpm university -- capture --study <study-id> --input .scratch/captures/<file>.json --dry-run
pnpm university -- capture --study <study-id> --input .scratch/captures/<file>.json
```

只有 dry-run 成功才执行第二条。正式结果若为 `reused`，说明重试安全完成，不要再造一份。如果 `status` 是 `active`，系统会把卡片加入同一个 FSRS 复习队列；`draft` 不会加入。

### 6. 给用户一张简短回执

报告：保存到哪个 study、笔记标题与 revision、事实/推论/个人理解、是否进入复习、主要证据。不要声称保存了原始聊天，也不要声称上传或云备份。
