---
name: write-lesson
description: Write or rewrite a UniversityLocal lesson content.md into the house teaching shape so a beginner can finish it. Use when authoring a new lesson, rewriting a wall-of-conclusions lesson, reviewing lesson prose against the five variants, or when the user says 读不进去, 重写这节课, 重写课文, or 改写成能读的. Covers question-first titles, one prediction, immediate answer, inline [[evidence:]] anchors, and cross-lesson links. Do not use for course/unit planning, card/exercise scheduling alone, UA analysis, refresh-study, knowledge-node saves, teach-from-study tutoring, or ordinary app engineering.
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
