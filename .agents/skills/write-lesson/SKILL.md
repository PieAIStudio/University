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
5. **Every real project code block** is followed by a product evidence token:
   `[[evidence:path:line]]` or `[[evidence:path:start-end]]`, covered by this
   revision's manifest evidence. Details and banned substitutes:
   [references/evidence-and-failures.md](references/evidence-and-failures.md).
6. **`## 自检` questions only** — no `答案：`, `**答：**`, or parenthetical
   solutions. Graded exercises render below the prose.
7. **Last section is `## 一句话`**: exactly one bold sentence.
8. **No old-skeleton headings:** `## 学习目标` / `## 先给结论` / `## 一个类比` /
   `## 工作示例` / `## 重点`.
9. **No HTML comments in `content.md`.** Variant lives only in `manifest.json`.
10. **Warming an already-shaped lesson may not grow it past 115%.** If the
    previous revision has no `variant`, this is a structural rewrite and the
    lesson will roughly double — that is the new shape needing room, and the
    rule does not apply. Once a lesson is in shape, warmth is phrasing, not
    extra material. See 语气 below.
11. **Talk to the reader**: at least 2 occurrences of 「你」 per 1000 characters.
    A lesson with none is a lecture delivered to an empty room.

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

## Voice

- Never-shipped-software reader, not stupid.
- Plain words on first use, then the real term.
- Daily-life analogies only; a new term inside an analogy means it failed.
- Name the thing before naming the name.
- Ban: 显然 / 简单来说 / 众所周知 / 显而易见 / 不言而喻.

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
