---
name: write-lesson
description: Write or rewrite a UniversityLocal lesson content.md into the house teaching shape so a beginner can finish it. Use when authoring a new lesson, rewriting a wall-of-conclusions lesson, reviewing lesson prose against the five variants, or when the user says 读不进去, 重写这节课, 重写课文, 改写成能读的, 太干, or 语气再循循善诱一些. Covers question-first titles, one prediction, immediate answer, inline [[evidence:]] anchors, and cross-lesson links. Do not use for course/unit planning, card/exercise scheduling alone, UA analysis, refresh-study, knowledge-node saves, teach-from-study tutoring, or ordinary app engineering.
---

# Write a lesson

A lesson that opens with 学习目标 and 先给结论 is a detective novel that names
the murderer on page one. Nobody finishes it. This skill is the shape that
fixes that, and the rules that keep hundreds of lessons from all sounding
identical.

Why this shape (research, rejected alternatives):
[docs/reference/lesson-pedagogy.md](../../../docs/reference/lesson-pedagogy.md).
Read once; never restate it inside a lesson.

Dispatching the work — which model writes, which one checks, and the CLI flags
that silently fail: [references/pipeline.md](references/pipeline.md). Not needed
if you are the one writing.

## Start

1. Read current `content.md` and `manifest.json` (evidence, card/exercise ids,
   `contentRevision`, `variant`).
2. **Read the cited evidence in the study snapshot.** No invented paths or lines.
3. Pick a variant → [references/variants.md](references/variants.md).
4. Write. Run [references/checklist.md](references/checklist.md).
5. Land only as a **new revision**. Never rewrite existing revision bytes.

If the current revision already matches the spine, invariants, and checklist,
**do not mint a revision** just to rephrase. A new revision resets completion
and knocks that lesson's cards out of the review queue.

## The invariants

Break one → rewrite.

1. **Title is a question** an outsider wants answered — not a noun phrase, not
   "X 的作用".
2. **No answer before `## 先猜一下`** (title, body, or heading).
3. **Exactly one** open-ended prediction on the lesson core. Never multiple
   choice (including A/B/C bullets or「选一个」). Include the line
   **随便猜，猜错不影响任何进度。** on its own line.
4. **Next section is exactly `## 答案`** (no heading suffix) and resolves the
   prediction in one or two sentences. Middle sections teach; do not dump the
   lesson into `## 答案`.
5. **Project source appears only as an `[[evidence:path:line]]` token**, covered
   by this revision's manifest evidence. Never hand-type the source into a
   fence. See 源码从快照来 below. Banned substitutes:
   [references/evidence-and-failures.md](references/evidence-and-failures.md).
6. **`## 自检` questions only** — no `答案：`, `**答：**`, or parenthetical
   solutions. Graded exercises render below the prose.
7. **Last section is `## 一句话`**: exactly one bold sentence.
8. **No old-skeleton headings:** `## 学习目标` / `## 先给结论` / `## 一个类比` /
   `## 工作示例` / `## 重点`.
9. **No HTML comments in `content.md`.** Variant lives only in `manifest.json`.
10. **Warming an already-shaped lesson may not grow its standard prose past
    115%.** Measured on the body **with all `:::detail` blocks removed** —
    adding a detail layer is new structure, not padding, and is not counted
    here. If the previous revision has no `variant`, this is a structural
    rewrite and the standard prose will roughly double; the rule does not
    apply. Once a lesson is in shape, warmth is phrasing, not extra material.
    See 语气 below.
11. **Talk to the reader**: at least 2 occurrences of 「你」 per 1000 characters.
    A lesson with none is a lecture delivered to an empty room.
12. **Never narrate the teaching apparatus.** The reader does not know this app
    exists. See 不许讲教学装置 below.
13. **Detail blocks carry the second reading level.** Every lesson ships
    `:::detail` blocks; each answers one named question. See 详细讲解层 below.
14. **Never hand-copy project source into a fence.** The `[[evidence:]]` token
    renders the real pinned source itself.

One prediction + immediate answer is research-backed: benefit lands on what was
asked; unguided struggle overloads beginners.

## Variants (pick by content)

| Variant | Use when | Middle |
| --- | --- | --- |
| `现象` | Observable surprise | `## 为什么是这样` |
| `对比` | Two things confused | `## 逐条对照` + `## 什么时候用哪个` |
| `溯源` | Value/call crosses files | `## 一站一站往回走` |
| `决策` | A tradeoff was made | `## 代价和收益` + `## 什么时候该反过来` |
| `术语` | A word is misread | `## 三个真实用例` + `## 它不是什么` |

Full shapes: [references/variants.md](references/variants.md).

**Rotation:** ≤ two consecutive lessons in a unit may share a variant. If a
third is honest, say so in the **agent report** — do not force a bad fit.

New revision `manifest.json` must set `"variant"` to one of the five Chinese
names. Never put it in `content.md`.

## Cross-lesson links

`[[lesson:lesson-id]]` or `[[lesson:course-id/unit-id/lesson-id]]`, optional
`|label`.

- Max **3** per lesson.
- Prefer `## 再想想`; also allowed in the middle. Never in the opening suspense
  section or `## 先猜一下`.
- Target must exist and go deeper on something this lesson only gestured at.

`## 再想想` is optional; if present, after the middle and before `## 自检`.

## 源码从快照来，不要手抄

`[[evidence:]]` 会把固定快照里的真实源码直接渲染出来，带行号和高亮。所以：

~~~markdown
坏 —— 手抄一份，再指一次：

```markdown
# Turing Pact / 图灵密约
```

[[evidence:README.md:1-4]]

好 —— 只指：

[[evidence:README.md:1-4]]
~~~

手抄那份等于同一段代码存了两份，而手抄的那份**没有任何东西校验**——打错一个字符，
从出生就是错的，而且永远不会被发现。

正文照常在 token 前后讲「这几行在说什么」「第 3 行为什么重要」。只是不要自己
把代码再打一遍。

例外：**不是**被学项目源码的代码块照旧写——你临时编的示例、命令行、伪代码、
对比用的反例，都跟快照无关，正常用 fence。这条只管真实项目源码。

## 详细讲解层（`:::detail`）

一节课**只有一份**课文。标准正文照常写；需要展开的地方插 `:::detail` 块。读者切到
「详细讲解」时全部展开，切回「标准讲解」时全部收起。

不要写两份课文。同一件事存两份，今天改一份、明天另一份就开始撒谎，而且没有任何
检查能发现——它们本来就该长得不一样。

~~~markdown
第二件事看起来也和「App」有关：有人打开项目文件夹，改里面的文字文件，
再让工具把文件变成能运行的程序。

:::detail[什么叫「项目文件夹」？]
你手机上那个图标，是别人做完、打包好、送到你手上的成品。在做它的人的电脑上，
它不长这样——它只是一个普通文件夹，跟你放照片的那个文件夹没有区别，只是里面
装的不是照片，是一堆写满文字的文件。
:::
~~~

### 规则

1. **标题必须是读者真的会问的问句**，写在 `[…]` 里，以「？」结尾。
   好：`什么叫「项目文件夹」？` / `为什么不直接改那个 App？`
   坏：`补充说明` / `关于文件夹` / `延伸阅读`
2. **块里只回答标题那一个问题。** 不塞轶事、名人故事、"有意思的题外话"。
   判定：这句删掉，读者对**标题那个问题**的理解会变差吗？不会，就删掉。
3. **标准正文必须自己站得住。** 把所有 `:::detail` 删光之后，正文仍然是一篇完整、
   连贯、读得下去的课——它同时就是这节课的复习版。detail 是补充，不是把一句话
   劈成两半。
4. **紧跟在引发疑问的那句话之后。** 不要攒到章节末尾。疑问在哪，答案就在哪。

   **硬线：`## 先猜一下` 和 `## 答案` 里出现的每一个词，必须在它们之前就已经
   解释过。** 让读者对着一个不认识的词做预测，是这套形状最坏的一种失败——
   预测本来是要调动他已有的直觉，一个陌生词直接把这件事变成瞎猜。
   块放在后面「反正也讲了」不算数：讲晚了等于没讲。
   如果发现预测题依赖一个还没解释的词，正确的修法是**把解释挪到前面**，
   或者**把那句话改成不需要那个词**——不是再加一块。
5. **总量下限：所有 detail 正文加起来 ≥ 标准正文字数的 60%。** 达不到说明该展开的
   没展开。这是下限不是目标——靠灌水凑数会被规则 2 判死。
6. 一节课最多 8 块。超过说明这节课想讲的太多，该拆课。
7. **块里适用 Voice 全部规则。** 块不是词条，不是百科。同样用「你」，同样
   口语，同样不许在解释里引入新术语。
   坏（词典腔）：「仓库」（Repository）是指集中保存一个项目所有文件、代码历史
   修改记录和配置信息的总文件夹。
   好（对人说话）：你可以把它想成一间还没装修完的房子的施工资料柜——不是你
   住进去之后看到的客厅。
8. **标准正文不要抢着下定义。** 把定义留给块。标准正文里塞一个括号解释，
   等于两边都写了，而且句子变长变难读。
   坏：有人打开一个装满文字文件的文件夹（做的人叫它**项目文件夹**），改里面
   的字，再靠电脑上的程序把这些文件整理成你能点开的成品。
   好：有人打开项目文件夹，改里面的文字文件，再让工具把文件变成能运行的程序。
   （定义在紧跟其后的块里）

### 哪里该开块（按顺序自查）

- 一个词第一次出现，而它不在日常生活里：项目文件夹、仓库、运行、部署、依赖
- 一句话跳过了一步：「再让工具把文件变成能运行的程序」——什么工具？怎么变？
- 一个结论对新手不显然：「会用的人可以一辈子不打开 README.md」——为什么？
- 一个只有写过代码的人才会觉得自然的说法

### 按课程层级调块量

- `foundations-*`：读者可能从没写过代码，平时甚至只用手机。凡是日常生活之外的词，
  第一次出现就该有块。
- 其余课程：读者已经读完 foundations。只给**这门课真正新的**东西开块。

## Voice

- Never-shipped-software reader, not stupid.
- Plain words on first use, then the real term.
- Daily-life analogies only; a new term inside an analogy means it failed.
- Name the thing before naming the name.
- Ban: 显然 / 简单来说 / 众所周知 / 显而易见 / 不言而喻.

### 不许讲教学装置

读者不知道 UniversityLocal 存在。他打开的是一节课，不是一个软件的功能界面。

**课文里禁止出现这套系统自己的内部词汇。**

> 坏：先把「界面」当成证据。下面是真实 Turing Pact Web `/daily` 在固定快照
> `3b402e06…` 上的结果画面：对话、选择和答案留在同一个页面里。
>
> 好：先看看图灵密约跑起来是什么样。这是它每天出一道题的那个页面——聊天记录、
> 你选的人、最后的答案，全在同一屏里：

正文禁用这些**搭配**：**固定快照 / 本课依据 / 当成证据 / 这节课的证据 /
阅读层级 / 细讲模式 / 标准模式 / 内容修订**。另外 **本课** 一律写成
**这节课**——前者是公文腔。

裸词 `证据`、`快照`、`revision` **不禁**。被学项目自己可能就有这些概念——
`AiBudgetSnapshot`、「机器证据写到哪」都是那门课的正常内容。禁的是**我们这套
系统对读者说自己的事**，不是这三个字本身。分不清的时候用那句判定：念给一个
不知道这个 App 存在的人听，他会不会问「你在说什么」？

判定：把这句话念给一个不知道这个 App 存在的人听。他会不会问「你在说什么」？

这条和「暖」是同一件事的两面：暖是**对着读者说话**，这条是**别对读者说系统的事**。
读者要的是「这个游戏长什么样」，不是「我现在向你出示一份证据」。

### 暖，是换说法，不是加内容

对着读者说话，别对着空气讲课：

- 用「你」。「你打开这个文件」胜过「用户打开该文件」；「我们」只在真的一起动手时用。
- 用口语句式。写完念一遍，不像人话就改。
- 难的地方明说难：「这里第一次看会绕，绕的是这一点：……」。承认难比假装简单更让人读下去。
- 提问式过渡：「那问题来了——为什么不直接……？」

**同时，绝不为了亲切加内容。** 有趣但与机制无关的小故事、趣闻、名人轶事、可爱的题外话，会把读者的注意力和脑容量抢走，实测让记忆和迁移**变差**。这不是风格偏好，是这一条与个人化语气强度相当的反向效应。

判定方法很简单：**删掉这一句，读者对机制的理解会变差吗？** 不会，就删掉。

因此改写有一条硬线：**当上一版已经是新形状（manifest 里有 `variant`）时，改写后正文不得超过上一版的 115%。** 语气变暖不需要更多字；变长了，说明加的是内容不是语气。

上一版还是旧骨架（没有 `variant`）时不受这条约束——那是结构重写，新形状本来就需要地方装「先猜一下」和「答案」，实测长度会翻一倍左右，属正常。

配套的下限：**每 1000 字至少 2 个「你」**。这条不是凑数，是个人化原则的可测代理。已经写好的课里有 5 节一个「你」都没有，读起来就是对着空气讲课。

### 扶手要递减（同一单元内）

一直扶着，读者永远学不会自己走。同一单元里：

- **前 1/3 的课**：新词第一次出现给白话解释；`## 答案` 可以先复述一下情境再回答；`## 自检` 可以带一句提示。
- **后 1/3 的课**：本单元已经解释过的词直接用，不再重讲；`## 答案` 一句话收；`## 自检` 不给提示。
- 同一个词在同一单元里不要解释第二次。第二次解释等于告诉读者「我不指望你记住」。

### 按课程层级调温

同一种写法，对新手有效，对已经懂的人反而**有害**——过度解释会拖慢已经建立起理解的读者。

- `foundations-*` 课程：读者可能从没写过代码，全套扶手。
- 其余课程：读者已经读完 foundations。少铺垫，别把已知当未知；术语直接用，把篇幅花在这门课真正新的东西上。

## Output contract

**Done** means:

1. **New revision only** (prefer `course open-for-edit` → `course revise`
   dry-run/apply → later `course reactivate`). Older `revisions/<n>/` bytes
   untouched. `contentHash` matches the new body.
2. Checklist passes.
3. New manifest has `"variant"`, correct `contentRevision`, and `evidence`
   covering every `[[evidence:]]` token.
4. Card/exercise ids unchanged unless the report justifies a change. A revise
   proposal still lists every existing card and exercise (add only; never drop).

**Agent report every run:** variant + why; rotation exception if any; checklist
result; evidence list changes; card/exercise changes; wrote a revision or left
alone.

Known and predicted defects:
[references/evidence-and-failures.md](references/evidence-and-failures.md).
