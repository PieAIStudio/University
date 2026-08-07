---
id: REF-USING-UNIVERSITY-LOCAL-WITH-GROK
title: Using UniversityLocal With Grok Build
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-08-05
domain: operations
tags:
  - grok-build
  - claude-code
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

## 可以用哪些宿主

这份教程的示例用 Grok Build 写成，但**三个宿主的用法完全一样**：Grok Build、
Claude Code、Codex 都从 `AGENTS.md` 读到同一套项目规则，也都能看到同一批学习技能。

技能只有一份，放在 `.agents/skills/`，各宿主通过符号链接看到它
（`.claude/skills` → `../.agents/skills`）。换宿主**不需要换任何说法**，
下面所有的自然语言指令原样可用。

| 宿主 | 从项目根目录启动 |
| --- | --- |
| Grok Build | `grok` |
| Claude Code | `claude` |
| Codex | `codex` |

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

宿主应先查看 study 状态，开始或沿用一段本地学习 session，再从固定快照、正式课程和证据教学。不要让它直接扫描 SupaLuv 的实时工作区来冒充教材。

目前已注册两个 study：`supaluv` 和 `turing-pact`。把上面那句话里的名字换掉即可切换学习对象。

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

### 决定「今日学习」先给你哪一门

书架上有多个 study 时，「今日学习」默认给出它遇到的第一节未完成课程——那个顺序和你
实际想主攻什么没有关系。设定主攻方向：

```bash
pnpm university focus set --study turing-pact
```

想连课程顺序一起钉住——`--course` 收一串用逗号分隔的课程 ID，**顺序就是你要走的顺序**：

```bash
pnpm university focus set --study turing-pact --course foundations-terrain,foundations-reading-code,foundations-logic
```

这一串里的课排在最前面，走完第一门自然接到第二门；没被点名的课保持原来的次序留在后面。
只写一门也可以，那就是一条长度为 1 的路线。

查看和清除：

```bash
pnpm university focus show
pnpm university focus clear
```

它写进 `university-local.config.local.json`（这个文件不进版本管理，因为它讲的是你此刻在
干什么，不是项目本身），下次启动自动读取。

两个刻意的行为：

- **只排序，不过滤。** 主攻的 study 学完了，会自然接到下一个，而不是告诉你「没课了」。
- **复习卡片仍然来自全部 study。** 卡片是你已经学过的东西，主攻别处的时候把它忘掉，
  正是间隔重复要防止的事。

「今日学习」页面顶部会显示当前主攻的是谁——否则那个顺序看起来就是随机的。

### 一个 study 可以有多门课

`学习项目` 页会列出该 study 下**全部** active 课程；`defaultCourseId` 只决定校园先打开哪一门，以及「今日学习」优先从哪一门里取下一节课。它不限制其余课程可不可以学。

改变起点：

```bash
pnpm university course set-default --study <study-id> --course <course-id>
```

只有 active 课程能成为默认课程。

### 课程的先后顺序从哪来

书架上的顺序**不是手工排的**，是从每门课声明的先修关系算出来的：

```bash
pnpm university course set-prerequisites --study <study-id> --course <course-id> [--requires <course-id>[,<course-id>...]]
```

- 没有未满足先修的课排在前面；同一层里按创建时间、再按 id 决定先后。
- 省略 `--requires` 等于清空——这门课成为一个新起点。
- 拒绝自我依赖，也拒绝会形成环的设置（A 依赖 B、B 又依赖 A）。
- 先修课如果不在当前列表里（已退休、或不属于这次排序的范围），**不会**挡住这门课。

**为什么要有这个机制。** 在它之前，排序是「默认课优先，其余按 id 字母序」。新写一门课，它会落在名字碰巧排到的位置——一门比《认识地形》更靠前的入门课，因为 id 以 f 开头，被排到了第二位。而且 `defaultCourseId` 是很久以前设的，早就不是最该先学的那门了。

关键在于**新增课程不需要重排任何已有课程**。作者只回答一个问题：「这门课假设读者已经会什么？」——和填 `objectives` 是同一类工作。顺序自己会变对。没声明先修的新课默认排到最前，是「这是个新起点」的意思；这是安全的降级，不会把书架搞乱。

### 卡片是怎么进入复习队列的

这是最容易误解的一环：**课程建好时卡片就已经写在磁盘上，但它们还没有被排进 FSRS。**

排期发生在**你完成那节课的时候**——课时里的练习全部答对，该课时的全部卡片才一次性进入复习队列。所以：

- 只读课文、不做练习，卡片永远不会出现在「今日学习」。
- 一节课如果带卡片却没有练习，卡片就永远排不进去。`course create` 会直接拒绝这种提案。

练习有两种：

- **short-answer**：对着参考答案判对错。
- **explain**：没有参考答案。你先写完整解释，然后点「写完了，看评分标准」，系统才返回评分要点；对照勾选你真的答到的点，全部答到才算通过。答案在评分标准出现后会被锁定，改不了——先想再看，是这套系统的一贯规矩。

### 课程被修订之后

`course revise` 会把内容 revision +1。此时：

- 你在旧 revision 上的完成记录**仍然保留**，但不再算作「已完成」，课时会显示「课文已更新 · 需重做」；
- 那节课的卡片会暂时退出复习队列，直到你在新 revision 上重新完成这节课。

这是刻意的：卡片的正面背面可能已经变了，让旧记忆继续按旧内容复习，比让你重做一次代价更大。

### 想改一门正在用的课

active 课程的内容是锁住的——`course revise` 只接受 `stale` 的课程与单元。以前只有「被学习项目更新了、刷新审计判定过期」才会产生 `stale`，所以一门证据依然新鲜的课，反而完全改不了。

现在有对称的两步：

```bash
pnpm university course open-for-edit --study <study-id> --course <course-id>
```

改完之后用原来那条命令关上，它仍然会跑完整的新鲜度审计：

```bash
pnpm university course reactivate --study <study-id> --course <course-id> --snapshot <snapshot-id> --analysis <analysis-id>
```

`open-for-edit` 重复执行是安全的，中断的编辑可以接着做。

### 给已有课时加卡片和练习

`course revise` 的提案里，每个卡片和练习都带 `expectedRevision`——那是乐观并发校验。**省略它就表示「这是新增的」。**

- 已存在的条目必须带 `expectedRevision`，漏了会被拒绝；
- 不存在的条目必须不带，带了也会被拒绝。

提案里的顺序就是课时里的顺序。提案必须仍然列出该课时现有的全部卡片和练习——**只能加，不能少**。想去掉一个条目要走退役流程，因为直接省略会让它已经排好的复习状态指向课时不再声明的内容。

### 给已有课程加课时和单元

`course revise` 只能改已经存在的东西。要让课程长出新的一节课，用 `add-lessons`：

```bash
pnpm university course add-lessons --study <study-id> --input <proposal.json> --dry-run
```

提案的形状和 `course create` 里的课时一模一样（同一份 schema，所以规则完全一致），外面套一层「加到哪」：

```json
{
  "schemaVersion": 1,
  "proposalId": "add-retry-safety-lesson",
  "targetSnapshotId": "git-...",
  "targetAnalysisId": "ua-...",
  "courseId": "testing-strategy",
  "unit": { "id": "degraded-design" },
  "lessons": [ { "id": "...", "title": "...", "content": "...", "evidence": [...], "cards": [...], "exercises": [...] } ]
}
```

- **加到已有单元**：`unit` 只写 `id`。多写 `title`/`objective` 会被拒绝——免得你以为改了标题其实没改。
- **顺便建新单元**：`unit` 写全 `id` + `title` + `objective`（可选 `prerequisiteUnitIds`）。新单元以 `draft` 落地，由 `reactivate` 激活。
- 课时 ID 在**整门课范围内**唯一，不只是单元内——它们都是同一个课程目录下的文件夹名。
- 同样要先 `open-for-edit`，改完 `reactivate`。

### 完整的编辑循环

不管是改内容、加卡片还是加课时，都是同一个三步：

```bash
pnpm university course open-for-edit --study <study-id> --course <course-id>
# …… revise / add-lessons，可以连着做很多次 ……
pnpm university course reactivate --study <study-id> --course <course-id> --snapshot <snapshot-id> --analysis <analysis-id>
```

**真正把关的是第三步。** 它会把课程里每一条证据重新对着快照验一遍，有一条不新鲜就拒绝激活，课程停在 `stale` 上。所以中途出错不可怕——课程不会以半成品的样子被发布出去，把出错的地方修好再 `reactivate` 就行。

写入顺序是「先声明、后内容」：课程声明单元 → 单元声明课时 → 才写课时。这样任何读取方都能从上往下走而不会遇到断掉的引用。代价是中断时会留下一个「声明了但内容还没写」的状态——它会让 `reactivate` 明确报错，而不是让课程看起来是完整的。重跑同一份提案即可补齐。

### 把追问保存为知识点

理解了一个值得长期保留的内容后，对 Grok 说：

```text
把刚才“作者主线和 AI 支线的边界”记一下，保存成 UniversityLocal 知识笔记，并做成复习卡片。
```

`knowledge-node` 技能会把对话重新整理成一个原子知识点，先校验证据，再通过 UniversityLocal CLI 写入 `studies/<study-id>/notes/`。它不会保存整段聊天，也不会写到 Obsidian、SupaLuv 或云端。

如果 AI 找不到可靠源码证据，它应保存为 `draft`，而不是把猜测放入复习队列。事实、推论、个人理解三者必须明确区分。

### 沟通教练怎么用

AI 像老师，但有时你要的不是「说得对不对」，而是「这句话听的人能不能接住」。那是沟通教练的工作，不是教学技能的工作。

它是 `.agents/skills/comm-coach`，一条指向 PGS 共享技能库的符号链接，和别的共享技能一样集中管理。三种模式，选最轻的一种就够，不要一次全开：

- **表达门诊**：手里有一段现成文字，只评这一段。
- **角色扮演**：短回合对练，对方是你指定的角色。
- **复述教学**：事实已经核实过了，只评清晰度、结构和表达缺口。

**顺序是硬的。** 事实归 `teach-from-study`，表达归 `comm-coach`。事实还没过关就谈表达，会把错误说得更顺——那是误导，不是辅导。`teach-from-study` 的契约写得很清楚：需要排练或表达反馈时，先对着证据核实，过关了再调沟通教练；两边默认不同时跑。事实错误不是表达问题。

它**默认不自动落盘**，这是刻意设计不是缺陷——一个会自动存你写的东西的教练，会让你写的时候开始自我审查。要保存走 `knowledge-node` / `capture`。

它**不扫描整段对话**，只看你明确交给它的那一段。没有选中、没有贴上，就等于没交给它。

三个可直接复制的调用示例：

```text
用 comm-coach 做表达门诊。
目标：让读者三秒内知道我要他做什么。
受众：同组的工程师。
约束：不超过 5 行，不要客套，不要开头寒暄。
这段话：
「改完之后记得跑 pnpm verify，绿了再提 PR。」
```

```text
用 comm-coach 角色扮演。
目标：向同事说清为什么先 commit 再改下一处。
受众：刚接手仓库、习惯本地攒一大包再提交的同学。
约束：每轮只回一两句；你来扮演那个同学，先问我一个具体问题。
我先开口：
「我想先把边界修好再一起提交，不然 diff 里分不清哪次改坏的。」
```

```text
teach-from-study 已经核实过我对「snapshot 与 live 源码边界」的复述，事实没问题。
现在用 comm-coach 做复述教学：只评清晰度与结构，不要再查事实。
目标：讲给下周才进组的人听懂。
受众：新人。
约束：先说一个具体优点，再给最多两条改法，并让我重说一遍。
我的复述：
「快照是盖过章的图纸；编辑器里没提交的改动还在白板上，不能当教材引用。」
```

产品侧只负责**准备素材**，不自己点评——Web 端没有模型，也不该有：

- 课程页练习经宿主批改后，按钮「让 AI 点评我这段表达」会把点评包复制到剪贴板；
- 命令行同样只产出可粘贴的包：

```bash
pnpm university express review --study <study-id> [--limit <n>] [--goal <text>]
```

把包贴进任意 AI 宿主，由 `comm-coach` 接手。它评的是你怎么说，不改判对错。

### 英文模式怎么用

读课文时顺带认词。默认**关闭**。开关在课程页顶部，**只在这节课有标注时才出现**——没标注的课不显示空开关，免得你点了什么都没有。

它是**旁注层**，不改课文一个字节。标注按 `contentRevision` + 内容哈希绑定；哈希对不上就当没标注渲染，绝不拿旧位置去标新课文。因此开关英文模式**永远不会**影响课程完成状态和复习排期——完成与排期绑在课文 revision 上，旁注不进那条账。

点词看到：音标、词性、中文释义、用法、朗读。**朗读只用本机语音**（`localService === true`）。系统里没装英语语音时按钮置灰并说明原因，不联网合成——这和课程内容里外部图片被拦是同一条边界：页面自己不往外送要渲染的字。

词库按**词义**索引，不按拼写：`commit` 在 Git 和在数据库里是两条不同的词（例如 `commit.git`），一份拼写对上两套释义只会教错一半。

怎么给课加标注：

```bash
pnpm university language annotate --study <study-id> --input <overlay.json>
```

`overlay.json` 的形状：

```json
{
  "schemaVersion": 1,
  "language": "en",
  "lessons": [
    {
      "courseId": "foundations-terrain",
      "unitId": "reading-code",
      "lessonId": "snapshot-vs-live",
      "anchors": [
        { "quote": "commit", "occurrence": 1, "senseId": "commit.git" }
      ]
    }
  ]
}
```

`occurrence` 是第几次出现（从 1 起）；`senseId` 必须已在词表里。落在**代码块、行内代码、链接、HTML 标签、表格**里的锚点会被拒绝——防止标注弄坏代码。写不进去的锚点会在回执里标 `rejected`，不会静默假装标上了。

**定位只按纯字符串查找，不做分词。** 这意味着 `quote: "文件"` 可能落进「文件夹」的前两个字，显示成破碎的结果，而系统**不会报错**——它只确认这个字符串存在。写锚点时要么用足够长的词（「运行时」而不是「运行」，runtime 和 run 是两个概念），要么把 `occurrence` 指向真正独立出现的那次。

### 词汇复习：点了「不熟」之后

弹窗里三个按钮各自的含义不一样：

- **不熟 · 加入复习** —— 进入复习队列，会在「今日学习」里被问。
- **认识** —— 是「少烦我」，不是「已掌握」。它让这个词安静下来，不进队列。
- **暂不学这个** —— 永久静音，即使之前排过期也不再出现。

到期的词出现在「今日学习」，用和卡片一样的「先想 → 看释义 → 四档评分」。**自评而不是打字**：要测的是认不认识这个词，打字测的是拼写。

两条刻意的设计：

- **课文里出现一个词，不产生任何进度。** 只被记录，且按「词 × 课 × 天」去重——否则刷新页面就能刷出「接触次数」。真正推进状态的只有你的显式动作。
- **当天答对不算掌握。** 读完释义几秒后答对是短期记忆；只有隔天再答对才升到 `stable`。这正是间隔重复要防的那件事。

词汇状态**不按 study 分**，存在 `studies/.vocabulary/`。在 TuringPact 学会的词，换个书架仍然是学过的——按 study 存会把同一个词问四遍，再把答案平均掉。

### 学这个项目自己（airlock）

想把 UniversityLocal 自己注册成 study 会直接失败：`assertSeparatedRoots` 不允许学习数据目录和被学项目目录互相包含。本仓的 `studies/` 就在仓库里，源和成绩册叠在同一棵树上，守卫会拒绝。

**这条守卫不能放松。** 它守的是真实的数据边界——分析跑过的源码不能和成绩册、笔记缠在一起；缠在一起之后，刷新、归档、误删都会波及另一边。

解法是 airlock：仓外一份封存的、只读的、钉在某个确切提交上的副本。提升、体检、看状态（命令形状与 CLI HELP 一致）：

```bash
pnpm university airlock promote --airlock <绝对路径> --upstream <绝对路径> [--ref <git-ref>] [--acknowledge-dirty-excluded]
pnpm university airlock doctor --airlock <绝对路径> [--study <study-id>]
pnpm university airlock status --airlock <绝对路径> [--study <study-id>]
```

`--upstream` 只在 `promote` 上需要。加上 `--study` 会多出**第三只钟**：前两只是「上游走到哪」和「airlock 钉在哪」，第三只是「这个 study 的课程用的是哪个快照、跟 airlock 对不对得上」。只看前两只会漏掉一种情况——封条完好、上游也不远，但课程还挂在两次提升之前的快照上。同样的三只钟也显示在 Web 的 study 页面上。通过后用 **airlock 路径**（不是 live 仓库路径）注册 study：

```bash
pnpm university study create --study <study-id> --title <text> --source <airlock 绝对路径> [--ref <git-ref>]
```

**airlock 落后于 live 是特性不是缺陷。** 教材讲的永远是「上一次提交」，不是你编辑器里那份。使用纪律：改代码 → commit → `airlock promote` → 再走 `refresh-study`；不要把手伸进 airlock 直接改，改了 `doctor` 会判 blocked，只能重新 promote 还原。

磁盘上几个名字相近的目录分别是什么、哪些该留哪些是历史遗留，见
[what-lives-where.md](./what-lives-where.md)。

导入门禁是**拒绝**不是跳过：仓库里真跟踪了密钥、`.env`、sqlite 等，工具不会绕开接着导——因为 `.gitignore` 对已跟踪文件无效。先把它们从跟踪中拿掉并提交，再重新提升。

### 讲历史的课：pin 住它

有的课**故意**讲旧代码——某个 bug 修好之前长什么样、某次重构之前架构是怎么分层的。这种课永远追不上最新提交，而 `refresh audit` 每跑一次就会把它判成 stale。一个永远清不掉的警告，最后的效果是让人把所有警告都当没看见。

所以课程有一个「当前性」声明：

```bash
pnpm university course pin --study <study-id> --course <course-id>
pnpm university course follow --study <study-id> --course <course-id>
```

- `follow`（默认）：这门课教的是当前的代码，落后了就该被判 stale、该被修订。
- `pin`：这门课讲的是历史，审计不再动它的状态。

**pin 不是用来堵嘴的。** 已经 stale 的课不能直接 pin——那等于给一门确实烂掉的课贴一张「这是故意的」标签。先修订或退休，再 pin。

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
3. **验收这张新地图的质量**（见下一节）；
4. 对比旧证据并把受影响内容标为 stale；
5. 重新研究后追加课程/笔记 revision；
6. 全部证据重新通过 freshness gate 后才恢复 active。

“刷新”不是把旧教材全部覆盖；更像教材出新版，旧版仍留在档案室。

### 为什么第 3 步不能省

UA 是机器测绘队，它也会画出废图。已经发生过两次：一次 85% 的函数摘要是套模板凑的
（"实现该模块内业务逻辑片段，约 18 行" 这种，信息量为零）；另一次静默漏掉了 766 个文件里的 56 个。
**两次都通过了当时的全部结构校验**——因为节点唯一、没有悬空边、每个文件都归了层，
结构上挑不出毛病，坏的是内容。

现在 `refresh finalize` 内置了两道内容门禁，废图进不来。你也可以随时自己查：

```bash
pnpm university -- refresh verify --study supaluv --analysis <analysis-id>
```

它会自动判断阶段：UA 还在逐批分析时读中间结果，报每批的文件覆盖；合并出完整地图后
自动切换成整图检查。**跑到一半就能查，不用等一小时跑完才发现白跑了。**

看 `failures` 字段：

- `UA batch <i> incomplete` —— 那一批漏了文件，得补
- `UA template collapse` —— 摘要在套模板，这张地图不能当教材

确认旧地图作废时（比如质量不合格、或已被新版取代）：

```bash
pnpm university -- refresh retire --study supaluv --analysis <旧的> --superseded-by <新的> --reason "说明为什么"
```

作废是状态变更，不删数据；如果还有 active 课程绑在它上面，命令会拒绝并告诉你是哪几门。

## 课程变成 stale 了怎么办

刷新之后课程转 `stale` 是**正常且正确的**，不是出错——它在说"教材依据的地图换版了，
需要重新审一遍"。旧内容不会被删，学习记录也不受影响。

先看清楚到底什么过期了：

```bash
pnpm university -- refresh audit --study supaluv --snapshot <新快照-id> --analysis <新分析-id>
```

不加 `--apply` 只出报告。报告里每个条目会给出过期原因，两类要分开看：

- **`UA node changed`** —— 只是地图上那个节点的描述变了，源码没动。这种最轻，
  重新绑定即可，课文和行号都不用改。
- **源码层面的原因** —— 文件真的改了或没了，那才需要重写课文。

确认之后再加 `--apply` 落实状态，最后重新绑定到新证据：

```bash
pnpm university -- course reactivate --study supaluv --course <course-id> --snapshot <新快照-id> --analysis <新分析-id>
```

所有证据重新通过 freshness gate，课程才会回到 `active`。

## 可以直接使用的本地命令

```bash
pnpm university -- status --study supaluv
pnpm university -- session status --study supaluv
pnpm university -- learner backup --study supaluv
```

`status` 是最常用的一条，它一次给出：源仓库当前状态、有哪些快照、每个 UA 分析处于
什么状态（`preparing` / `ready` / `superseded` / `failed`）、课程和笔记各有多少、
学习数据库多大。**开始学习前先跑一次，就知道手上有什么。**

想看完整命令表：

```bash
pnpm university -- --help
```

重置学习记录是少数危险操作，必须精确确认 study ID，并先产生可验证备份：

```bash
pnpm university -- learner reset --study supaluv --confirm supaluv
```

它只重置 `learner` 成绩册，不删除源码快照、UA、课程或知识笔记。

## 初学者最容易忽略的事

1. **Grok Build 与 Grok 网页不是同一个工作方式。** 必须从 UniversityLocal 根目录启动 CLI，宿主才能自动读取 `AGENTS.md` 和项目技能。换成 Claude Code 或 Codex 也是同一条规矩：从项目根目录启动。
2. **commit 不等于 push。** 学习只需要本地 commit；push 是远端协作/备份选择。
3. **未提交代码不在教材里。** 屏幕上刚改完但没 commit 的内容，就像白板草稿，不应该被长期课程引用。
4. **UA Tour 不是正式课程。** 它是机器地图，可以帮助老师研究，但没有自动获得“正确教材”的资格。地图甚至可能是废的——所以刷新之后要跑 `refresh verify`。
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
