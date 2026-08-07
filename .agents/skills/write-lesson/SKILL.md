---
name: write-lesson
description: Write or rewrite a UniversityLocal lesson content.md so a beginner can actually read it. Use when authoring a new lesson, rewriting one that reads as a wall of conclusions, or reviewing lesson prose against the house teaching structure. Covers the question-first shape, the five lesson variants, prediction exercises, inline evidence anchors, and cross-lesson links. Do not use for course/unit planning, card or exercise scheduling, UA analysis, or ordinary engineering work.
---

# Write a lesson

A lesson that opens with 学习目标 and 先给结论 is a detective novel that names
the murderer on page one. Nobody finishes it. This skill is the shape that
fixes that, and the rules that keep 481 lessons from all sounding identical.

Research grounding, effect sizes, and the alternatives that were rejected:
[docs/reference/lesson-pedagogy.md](../../../docs/reference/lesson-pedagogy.md).
Read it once; do not restate it in lessons.

## Start

1. Read the lesson's current `content.md` and its `manifest.json` (evidence
   list, card ids, exercise ids).
2. **Read the cited evidence in the snapshot.** Every factual claim must come
   from a real file and line. Never write a fact you have not looked at.
3. Pick a variant → [references/variants.md](references/variants.md).
4. Write. Then run the checklist → [references/checklist.md](references/checklist.md).

## The invariants

These hold in every variant. A lesson that breaks one gets rewritten.

1. **The title is a question** an outsider would want answered. Not a noun
   phrase. Not "X 的作用".
2. **No answer leaks before `## 先猜一下`** — not in the title, not in an
   earlier section, not in a heading.
3. **Exactly one prediction question**, open-ended, low-stakes, aimed at the
   lesson's core. Never multiple choice: the options carry the answer. Always
   carries the line **「随便猜，猜错不影响任何进度。」**
4. **The answer arrives immediately after it.** A suspense you do not resolve
   is not teaching, it is a hostage situation.
5. **Every real code block gets an inline evidence anchor** right after it, so
   the reader can jump to that line without hunting the sidebar.
6. **The last section is one sentence**, bold, the single thing worth keeping.

Why one prediction question and not three: the measured benefit lands on the
content that was asked about, so a scattergun spends the learner's willingness
on things that will not pay. Why the answer must be immediate: unguided
struggle overloads beginners rather than teaching them.

## The variants

Pick by what is actually being taught, not by rotation-for-its-own-sake. Full
shapes and worked openings in [references/variants.md](references/variants.md).

| Variant | Use when | Middle section |
| --- | --- | --- |
| `现象` | There is an observable surprise | `## 为什么是这样` |
| `对比` | Two things get confused | `## 逐条对照` + `## 什么时候用哪个` |
| `溯源` | A value or call crosses files | `## 一站一站往回走` |
| `决策` | A tradeoff was made | `## 代价和收益` + `## 什么时候该反过来` |
| `术语` | A word keeps being misread | `## 三个真实用例` + `## 它不是什么` |

**Rotation rule:** within one unit, no more than **two consecutive** lessons
may use the same variant. If the content genuinely wants a third, say so in the
commit message rather than forcing a bad fit — a contrived 对比 is worse than a
third honest 现象.

Record the chosen variant as an HTML comment on line 1:
`<!-- variant: 现象 -->`. The checker reads it.

## Cross-lesson links

Syntax: `[[lesson:lesson-id]]` or `[[lesson:course-id/unit-id/lesson-id]]`,
optional label after `|`.

- Maximum **3 per lesson**. More than that is not a web, it is a maze.
- Allowed in `## 再想想` (preferred) and the middle section.
- **Never** in `## 现象` or `## 先猜一下`. Those two sections exist to build
  suspense; sending the reader away there abandons the lesson.
- A link must be a real invitation — the target genuinely goes deeper on
  something this lesson only gestured at. Not "related, vaguely".

## Voice

- Write for someone who has never shipped software and is not stupid.
- Explain a term in plain words on first use, then use the real term.
- Analogies come from daily life. **A new term inside an analogy means the
  analogy failed.**
- Say what something *is* before what it is *called*.
- No "显然", "简单来说", "众所周知".

## Output

Rewrite `content.md` in place at a **new revision** — never edit an existing
revision's bytes. Completion and review scheduling are pinned to the revision
they were earned on.

Do not touch `manifest.json` evidence, card ids, or exercise ids unless the
rewrite genuinely needs a new prediction exercise; if it does, say so
explicitly in your report rather than silently adding one.
