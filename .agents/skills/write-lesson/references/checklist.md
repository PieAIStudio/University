# Acceptance checklist

Run every item. Any "no" means rewrite, not patch. A lesson that fails item 2
is worse than the wall-of-conclusions version it replaced, because it spends
the learner's curiosity and returns nothing.

## Structure

1. The revision's `manifest.json` has `"variant"` set to one of the five names,
   and `content.md` contains **no** `<!-- variant … -->` comment — that renders
   as visible text at the top of the lesson.
2. The title is a question, and an outsider would want the answer.
   - Test: show the title alone to someone who has never programmed. Do they
     want to know? "id=\"root\" 是什么" fails. "明明什么都没写，页面为什么是满的"
     passes.
3. Sections match the chosen variant's shape, in order, with those exact names.
4. The variant's mandatory sections are present (`决策` → `什么时候该反过来`,
   `术语` → `它不是什么`).

## The prediction

5. Exactly one `## 先猜一下`.
6. It is open-ended, not multiple choice.
7. It carries 「随便猜，猜错不影响任何进度。」 verbatim.
8. It targets the lesson's **core**, not a side detail.
9. `## 答案` is the very next section, and answers it in one or two sentences
   without preamble.

## Leakage

10. Nothing before `## 先猜一下` states the answer — including the title, the
    variant comment, and any heading.
    - Test: delete everything from `## 答案` down. Is the question still open?

## Evidence

11. Every factual claim traces to a file and line you actually read.
12. Every real code block is followed by an inline evidence anchor.
13. `溯源` lessons: every stop has its own anchor.
14. No invented file paths, line numbers, or output. If you could not verify
    it, it does not go in.

## Self-check

14b. `## 自检` contains questions only — no 「**答：**」, no answer sentence,
    no answer in parentheses.
    - The graded exercises render below the prose. A question with its answer
      printed underneath is not a self-check, it is a paragraph.

## Links

15. At most 3 `[[lesson:...]]`.
16. None in `## 现象` / `## 先猜一下`.
17. Each target exists, and genuinely goes deeper on something this lesson
    only gestured at.

## Voice

18. Every term is explained in plain words on first use.
19. No analogy introduces a term the reader does not have.
20. No 显然 / 简单来说 / 众所周知.
21. `## 一句话` is exactly one sentence, bold.

## Rotation

22. Not the third consecutive lesson in this unit with the same variant — or
    the report says why a forced alternative would have been worse.

## Mechanical

23. Written as a **new revision**; no existing revision's bytes changed.
24. `manifest.json` evidence / card ids / exercise ids unchanged, unless the
    report explicitly calls out and justifies a change.
25. Markdown parses; fences closed; Mermaid blocks (if any) valid.
