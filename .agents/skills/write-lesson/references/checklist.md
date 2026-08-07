# Acceptance checklist

Run every item. Any "no" means rewrite, not patch. A lesson that fails item 6
(leakage) is worse than the wall-of-conclusions version it replaced, because it
spends the learner's curiosity and returns nothing.

**Tags for the parallel mechanical linter** (`scripts/lint-lessons.mjs` and
friends):

- `[machine]` — deterministic from the files alone; the linter should own these.
- `[judgment]` — needs a reader (or a strong model pass); do not pretend a regex
  is enough.
- `[process]` — about how the revision was written, not only the prose bytes.

An LLM running this skill still walks **all** items. The tags only mark which
failures a machine can catch before a human or model re-reads.

## Structure

1. `[machine]` New revision `manifest.json` has `"variant"` equal to exactly one
   of: `现象` | `对比` | `溯源` | `决策` | `术语`.
2. `[machine]` `content.md` contains **no** HTML comments (`<!-- ... -->`) and
   no `variant` marker of any kind.
3. `[judgment]` The title is a question an outsider would want answered.
   - Test: show the title alone to someone who has never programmed. Do they
     want to know? `id="root" 是什么` fails.
     `明明什么都没写，页面为什么是满的` passes.
4. `[machine]` Section headings match the chosen variant's shape **in order**,
   with those **exact** names (see `variants.md`). Optional `## 再想想` may
   appear only after the middle and before `## 自检`.
5. `[machine]` Mandatory extras present: `决策` → `## 什么时候该反过来`;
   `术语` → `## 它不是什么`.
6. `[machine]` No old-skeleton headings: `## 学习目标`, `## 先给结论`,
   `## 一个类比`, `## 工作示例`, `## 重点`.

## The prediction

7. `[machine]` Exactly one `## 先猜一下`.
8. `[machine]` Prediction is not multiple choice: no `A.`/`B.`/`C.` option
   lists, no `（ ）` fill-in with given choices, no「选一个」.
9. `[machine]` The prediction block includes the verbatim line
   `随便猜，猜错不影响任何进度。`
10. `[judgment]` It targets the lesson's **core**, not a side detail.
11. `[machine]` The next `##` heading after `## 先猜一下` is exactly `## 答案`
    (no suffix in the heading).
12. `[judgment]` `## 答案` answers the prediction in one or two sentences, with
    no preamble, and does not replace the middle teaching sections.

## Leakage

13. `[judgment]` Nothing before `## 先猜一下` states the answer — including the
    title and any heading.
    - Test: delete everything from `## 答案` down. Is the question still open?

## Evidence

14. `[judgment]` Every factual claim traces to a snapshot file and line you
    actually read.
15. `[machine]` Every fenced code block that presents project source is followed
    (before the next fence or `##` heading) by at least one
    `[[evidence:path:line]]` or `[[evidence:path:start-end]]` token.
16. `[machine]` `溯源`: every stop under `## 一站一站往回走` has its own
    `[[evidence:]]` token.
17. `[machine]` No `（位置：` / `**位置：**` used as a substitute for
    `[[evidence:]]` after a code block (prose may mention paths; it does not
    count as the anchor).
18. `[machine]` Every `[[evidence:]]` range is covered by this revision's
    manifest `evidence` (same `sourcePath`; lines inside a cited range, or any
    line when the citation has no line bounds).
19. `[judgment]` No invented file paths, line numbers, or output.

## Self-check

20. `[machine]` Exactly one `## 自检`.
21. `[machine]` Under `## 自检`, none of: `答案`, `**答：**`, `答：`, or a
    parenthetical solution glued to the question. Questions only.
22. `[judgment]` Each self-check question is answerable from this lesson's prose
    (and ideally aligned with the existing exercise prompt when one exists).

## Links

23. `[machine]` At most 3 `[[lesson:...]]` tokens (outside code fences).
24. `[machine]` No `[[lesson:...]]` inside the opening suspense section or
    `## 先猜一下`.
25. `[judgment]` Each target exists and genuinely goes deeper on something this
    lesson only gestured at.

## Voice

26. `[judgment]` Every term is explained in plain words on first use.
27. `[judgment]` No analogy introduces a term the reader does not have.
28. `[machine]` None of: `显然`, `简单来说`, `众所周知`, `显而易见`, `不言而喻`.
29. `[machine]` `## 一句话` is the last `##` section; its body is a single bold
    sentence (one `**…**` paragraph, one sentence).

## Rotation and process

30. `[judgment]` Not the third consecutive lesson in this unit with the same
    variant — or the agent report says why a forced alternative would have been
    worse.
31. `[process]` Written as a **new** revision; no existing revision's bytes
    changed.
32. `[process]` Card ids / exercise ids unchanged, unless the report explicitly
    calls out and justifies a change; revise proposals still list every existing
    card and exercise.
33. `[machine]` Markdown fences closed; no unclosed ` ``` `.
34. `[judgment]` Mermaid blocks (if any) are valid and not the only carrier of a
    fact the prose omits.

## Machine vs judgment — linter handoff

| Own with a linter first | Keep for model/human |
| --- | --- |
| variant enum; no HTML comments; exact section names/order; old-skeleton ban | title is a real question someone wants |
| one 先猜一下 / 答案 adjacency; disclaimer line; no MC markers | prediction targets the core |
| `[[evidence:]]` present after code; covered by manifest; no `（位置：` substitute | claim actually true on the snapshot |
| 自检 has no answer markers; link count/placement; banned phrases | link is a real invitation, not a maze |
| 一句话 last + bold; fence closure | voice, analogy quality, rotation exception quality |
| — | skip-rewrite when already compliant (progress thrash) |

If the linter and this checklist disagree on a `[machine]` item, **fix the
lesson or the linter** — do not weaken the product syntax to match a bad batch.
