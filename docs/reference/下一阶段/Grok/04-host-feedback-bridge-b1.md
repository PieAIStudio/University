---
id: REF-NEXT-GROK-HOST-FEEDBACK-BRIDGE-B1-2026-08-06
title: Host Feedback Bridge B1 (Copy Packet to New Session, Write-Back to Web)
type: reference
status: draft
canonical: false
owner: ai-assisted
created: 2026-08-06
last_reviewed: 2026-08-08
domain: research
tags:
  - next-stage
  - host-bridge
  - exercise-feedback
  - b1
  - host-agnostic
  - beginner-ux
  - host-grade
  - no-runtime-model-in-web
pinned: false
related:
  - REF-NEXT-GROK-EVOLUTION-INDEX-2026-08-06
  - REF-NEXT-GROK-META-STUDY-MACRO-2026-08-06
  - REF-CURRENT-WORK
  - REF-UNIVERSITY-LOCAL-LEARNING-DONOR-MAP-2026-07-20
---

# 路线 B1：宿主答疑桥（粘贴包 → 新 session → 写回 Web）

> 宏观 + 可执行边界说明。供业主与其它 AI 审阅。  
> **不是**实现规格（无最终 API 表、无强制 schema 冻结）。  
> 业主拍板（2026-08-06）：作为当前最优谨升级方向，与「Web 内嵌第二模型 / 先装 pi」区分。  
> **补充约束（同日）：**  
> 1）复制后必须有**初学者可读**的「复制到了什么、下一步怎么贴」指引；  
> 2）答疑包与指引必须**宿主无关**——Grok Build、Claude Code、Antigravity、Codex 等同一套，不得写成只服务某一家。

**交付状态（2026-08-06）：已交付。** 见 current-work。勿重做第二套 runtime 模型或宿主专用桥。

---

## 1. 要解决什么体验问题

学习者在 Web 完成 short-answer / explain 后，需要：

1. **智能启发**（不只是「这次还没答对」）  
2. **尽量不打断主教学会话**（任意 AI 宿主上的主对话可继续讲课）  
3. **结果呈现在 Web**（比只留在聊天窗口更整洁、可回顾）  
4. **暂不要求** Web server 直接持有 API key，也不要求安装 pi 作为批改引擎  
5. **初学者不迷路**：一点复制，就知道剪贴板里是什么、去哪个窗口、怎么粘贴、贴完期待什么  
6. **换宿主不换流程**：同一答疑包可贴进任何能读 Markdown/文本的 AI 宿主  

现状缺口：程序判分可复现，但语义理解与巩固讲解默认在宿主；人肉切窗成本高；若文案只写「打开 Grok」，用 Claude / Antigravity 的人会卡住。

---

## 2. 一句话方案

```text
Web「复制答疑包」+ 同屏三步说明（宿主无关）
  → 在你正在用的 AI 宿主里新开对话（建议不复用主教学会话）
  → 粘贴整包，直接发送（包内已含给 AI 的任务说明）
  → 宿主讲解；需要长期保留时 CLI 写回本地学习数据
  → Web 刷新后在辅导面板展示
```

| 角色 | 做什么 |
| --- | --- |
| Web | 生成**宿主无关**的包、**初学者三步**提示、展示落盘辅导 |
| AI 宿主（任选） | 读包、讲解；可选执行写回命令 |
| 本机学习数据 | **唯一真相源**（聊天不是） |
| 程序判分 | short-answer 门禁仍可复现；辅导默认不改分数规则 |

**硬约束：宿主无关（host-agnostic）**

| 允许 | 禁止 |
| --- | --- |
| 说「AI 宿主 / 编程助手 / 新对话」 | 剪贴板正文写死「请在 Grok Build 中…」 |
| 举例列表：Grok Build、Claude Code、Antigravity、Codex… | 只举一家，或按钮文案叫「发给 Grok」 |
| 包内任务用中性角色：「你是本地学习教练」 | 依赖某宿主专有 slash command 才能读懂 |
| 可选附录「各宿主怎么新开对话」放在 Web 提示里 | 把某宿主专有键位写进答疑包必填段 |

---

## 3. 为什么是 B1，不是 B2 / C / 「直接用当前 Grok 会话当引擎」

| 路线 | 含义 | 与本方案 |
| --- | --- | --- |
| **A** | 宿主教学 + Web 程序门禁 | 仍是底座；B1 减少切窗摩擦 |
| **B1** | 人粘贴一次 + 宿主写回 | **本文件** |
| **B2** | server RPC 调 pi 等可编程宿主 | 零粘贴；要新运行时与安全面 |
| **C** | server 内 SwimmerAIKit / Mastra 调模型 | 要凭证与 kit 合同；第一阶段未默认开启 |

**Grok Build 与 pi 都是宿主**，但：

- Grok Build **适合当老师**（已在用订阅会话）  
- Grok Build **当前会话不能**被 UL server 稳定 RPC 调用  
- 因此「用 Grok」在 B1 里的含义是：**人把包贴进新 session**，不是 server 直连该会话  

pi 的 SDK/RPC 属于 **B2** 候选，不是 B1 前提。

---

## 4. 体验流（业主目标对齐）

```mermaid
sequenceDiagram
  accTitle[B1 宿主答疑桥]
  participant U as 学习者
  participant Web as UL Web
  participant Clip as 剪贴板
  participant Host as 新宿主 session
  participant Data as 本地学习数据

  U->>Web: 提交练习（程序可先判分）
  U->>Web: 复制答疑包
  Web->>Clip: 结构化上下文
  U->>Host: 新 session 粘贴
  Host->>Host: 按 skill 思考
  Host->>Data: CLI 写回（capture / feedback）
  U->>Web: 刷新或自动拉取
  Web->>Data: 读辅导记录
  Web-->>U: 辅导面板展示
```

**文字等价：** 复制 → 任意宿主新对话粘贴 → 宿主写盘 → Web 读盘展示。聊天可丢；盘上记录可复习、可截图验收。

---

## 5. 复制之后：初学者必须看见什么（B1a 核心体验）

复制动作本身不够。**点完「复制答疑包」后**，同屏立刻出现短提示（toast + 可展开卡片二选一或组合），按初学者写，**简单、短、可照做**。

### 5.1 默认三步（主文案，宿主无关）

建议主标题（择一，保持一句）：

> **已复制「练习答疑包」**

正文固定三步（实现时可用有序列表，勿超过约 80 字/步）：

1. **打开你的 AI 助手**（Grok Build、Claude Code、Antigravity、Codex 等任一即可）。  
2. **新开一条对话**（不要贴进正在讲课的那条长会话，避免搅乱上下文）。  
3. **粘贴（⌘V / Ctrl+V）→ 发送**。包里已经写好要 AI 做什么，你不用再解释题意。

收尾一句：

> 看完讲解后回到本页；若助手已写回学习数据，刷新即可在下方看到「宿主辅导」。

### 5.2 辅助信息（可折叠，默认收起）

| 折叠标题 | 内容意图 |
| --- | --- |
| 剪贴板里到底是什么？ | 「一段给 AI 看的说明 + 本题题干 + 你的答案 + 机器判分结果。不是密码，也不是完整课本。」 |
| 为什么要新开对话？ | 「主会话继续学后面的课；答疑会话用完可关。」 |
| 各宿主怎么新开对话？（举例） | 中性举例，可随产品更新：见下表 |

**举例表（写在 Web UI，不要写死进答疑包正文）：**

| 宿主（举例） | 新开对话的常见做法 |
| --- | --- |
| Grok Build | 新建 Agent / 新会话 |
| Claude Code | 新开会话或新 terminal 会话 |
| Antigravity | 新 Chat / 新 Agent 线程 |
| Codex CLI / 其它 | 新 session / 新对话窗口 |

文案原则：**举例不是白名单**——未列出的宿主只要能粘贴文本即可。

### 5.3 何时出现复制入口

| 时机 | 建议 |
| --- | --- |
| 提交后判 **错** | 主推：按钮 + 自动展开三步说明 |
| 提交后判 **对** | 次要：「想加深理解？复制答疑包问宿主」 |
| 尚未提交 | 不提供（避免空包） |

提交反馈区与复制提示应挨在一起，避免「判完了却不知道旁边还能复制」。

### 5.4 初学者文案反模式

- 只闪「已复制」两个字，无下一步  
- 「请配置 API key / 打开 Mastra」  
- 假定用户知道 RPC、skill、session 等词而不解释  
- 只写「发给 Grok」  

---

## 6. 答疑包：宿主无关格式（设计意图）

### 6.1 设计原则

1. **一份包，多家宿主**：剪贴板内容不得点名单一产品为必选。  
2. **自带任务说明**：粘贴发送后，AI 无需用户再打字「请帮我看这题」。  
3. **纯文本 / Markdown**：任何聊天框可粘贴；不依赖富文本或专有附件。  
4. **机器段与人话段分离**：上面给 AI 的指令，下面给人类扫一眼的摘要（可选）。  
5. **写回命令用通用 CLI 语言**：`pnpm university …`，不写「在 Grok 终端面板点某某」。  

### 6.2 包结构草案（Markdown）

```markdown
# UniversityLocal 练习答疑包

## 给 AI 助手的任务（请直接执行）
你是本地学习教练。根据下面「题目上下文」帮助学习者：
1. 用白话说明程序判分结果意味着什么（对/错的原因类型）。
2. 纠正易混概念；短答题不要用「通融」改系统满分规则。
3. 给 1～3 条可记住的巩固点；不要一次性倾倒整课。
4. 若学习者环境在 UniversityLocal 仓库且需要落盘，再按文末写回说明操作；
   否则先口头讲清楚即可。

不要假设你是某一个品牌的 IDE；不要要求用户安装额外 agent。

## 题目上下文
- studyId: …
- courseId: …
- unitId: …
- lessonId: …
- exerciseId: …
- kind: short-answer | explain
- prompt: …
- learnerAnswer: …
- machineScore: …
- machinePassed: true|false
- referenceRevealed: true|false
- evidence: path:line (commit …)   # 可选多条

## 人类可读摘要（可忽略）
一句话：我在 UniversityLocal 做练习，请按上面任务辅导。

## 写回（可选，仅当需要出现在 Web 辅导面板时）
在 UniversityLocal 项目目录执行（命令以当时文档为准）：
pnpm university …   # 待规格冻结
然后回到浏览器刷新课程页。
```

### 6.3 字段意图（机器）

- study / course / unit / lesson / exercise 标识  
- 题干、题型  
- 学习者提交原文  
- 机器结果（对/错、分数、是否已揭参考答案）  
- 证据摘要（path:line、commit 短号；**版本钉在包内，勿并进「复制位置」编辑器 locator**）  
- 中性任务：启发 / 纠错因；**短答题默认不替代程序满分门禁**  

### 6.4 反模式

- 包内写「必须在 Grok Build 中打开」  
- 把整页 HTML、某宿主 system prompt、或私人路径假设写死成唯一机器  
- 要求修改 `expectedAnswer` 当通融  
- 无 study 标识导致写回写错书架  
- 依赖 Claude 的 `/foo`、某插件专有卡片格式才能解析  

---

## 7. 写回落点（呈现优先级）

| 优先级 | 落点 | 用途 |
| --- | --- | --- |
| 1（建议） | 挂在 **该次 exercise attempt** 上的宿主辅导记录 | Web 练习卡下方「来自宿主的辅导」 |
| 2 | `knowledge` 笔记（原子、可进 FSRS） | 值得长期记的纠偏点 |
| 3 | 仅聊天 | **不够**；不满足「呈现在 Web」 |

原则：

1. **聊天 ≠ 真相源**；**本地 DB / 笔记 = 真相源**。  
2. 辅导默认 **只增加解释**，不重写完成门禁公式。  
3. 主教学 session 继续讲课；答疑 session **短命可丢**。  

---

## 8. 宿主侧约定（任意宿主 + 可选 skill）

### 8.1 无 skill 时（最低线）

仅靠包内「给 AI 助手的任务」段，在 **任意** 对话产品中粘贴发送，应仍能得到可用讲解。  
验收：同一包分别贴进至少两家宿主（例如 Grok Build 与 Claude Code 或 Antigravity），任务理解不依赖品牌专有指令。

### 8.2 有 skill 时（增强，可选）

各宿主可安装**同名职责**的 skill（文案可略调，契约同一），例如 `exercise-host-feedback`：

1. 只根据答疑包上下文作答，不搅其它 study。  
2. short-answer：解释程序判错/对的原因类型；给可记忆区分。  
3. 落盘走 `capture` / 未来 `feedback write`，**dry-run 优先**。  
4. 不声称已改 Web 内存；写回后提示刷新浏览器。  

与现有 skills：`teach-from-study`、`knowledge-node` 分工不变；B1 skill 只吃答疑包。

---

## 9. Web 侧最小产品面（待规格）

| 步 | 范围 | 验收 |
| --- | --- | --- |
| **B1a** | 「复制答疑包」+ **§5 三步初学者提示**；包体宿主无关 | 初学者不读文档也能贴；同一包在 ≥2 个宿主可用 |
| **B1b** | CLI 写回 + Web「宿主辅导」只读面板 | 刷新可见；截图证据 |

刻意不做（本阶段）：

- 浏览器调模型 API  
- 嵌某一家宿主 iframe  
- 用模型分数替换 short-answer 完成条件  
- 解除 studies/source 路径分离守卫  
- 答疑包或主按钮绑定单一宿主品牌  

---

## 10. 与元学习教材的关系

仓外教材厂：`/Users/yuanfei/PieAI/UniversityLocal-SpecialStudies`

- Course A 第 1 课含分层图与 B1 预告  
- 本文件是 **产品方向**；SpecialStudies 是 **可学课文**  
- 答疑包样例可另存教材厂 `templates/`（实现 B1a 前可用手写样例演练）  

---

## 11. 风险

| 风险 | 缓解 |
| --- | --- |
| 初学者复制后不知道下一步 | §5 强制三步文案；错题后自动展示 |
| 文案/包体绑死 Grok | §2 硬约束 + B1a 验收「≥2 宿主」 |
| 写回污染错误 study | 包内强制 id；CLI 校验 |
| 宿主剧透参考答案过早 | 任务说明：仅在已揭晓或策略允许时给答案 |
| 完成度被模型通融 | 门禁仍程序化 |
| 与「三 session owner 证据」抢优先级 | 先 B1a（复制+文案）；B1b 后排 |

---

## 12. 成功标准（owner 可感）

1. 答错后：复制 → 任意宿主新对话粘贴发送 →（可选写回后）刷新 Web，步骤清晰可照做。  
2. **不**要求用户会说「session / RPC / skill」才能完成 B1a。  
3. 同一答疑包在 Grok Build **与** Claude Code 或 Antigravity 等至少一家「非 Grok」宿主可完成讲解。  
4. 主教学对话无需中断。  
5. 辅导可在 Web 回顾；无云同步依赖。  

---

## 13. 建议落地顺序

1. 冻结 **宿主无关** Markdown 答疑包样例 + §5 中文三步文案。  
2. 人工：复制样例 → 两家宿主粘贴 → 记录摩擦。  
3. Web **B1a**：复制按钮 + 初学者提示（不含写回也可先上）。  
4. **B1b**：写回命令 + 辅导面板。  
5. 再评估 B2/C。  

---

## 14. 实现回执（2026-08-06 · 部分已上线）

业主要求：**对错由 AI 判，并写回 Web**。已落地：

| 能力 | 状态 |
| --- | --- |
| short-answer 提交只记答案，**不再**字符串全等判过 | 已上 |
| 答疑包含 AI 判分任务 + `exercise host-grade` JSON 模板 | 已上 |
| CLI `pnpm university exercise host-grade --study … --input …` | 已上 |
| HTTP `POST …/exercises/:id/host-grade` | 已上 |
| Web 展示 AI 评估 / 引申；「刷新评估」 | 已上 |
| 课完成门禁认 host-grade 的 score | 已上 |
| explain 自评路径 | 仍保留（未改成宿主判） |

写回 JSON 字段：`commandId`, `contentRevision`, `passed`, `evaluation`, `extensions`, `learnerAnswer`, `host`, `courseId`, `unitId`, `lessonId`, `exerciseId`。

---

## 15. 非目标重申

- 不是 Mastra 默认上线。  
- 不是「某一家宿主会话 = server 引擎」无写回。  
- 不是拆掉 local-only 或引入 SwimmerBackend。  
- 不是 Grok Build 专属功能。  


