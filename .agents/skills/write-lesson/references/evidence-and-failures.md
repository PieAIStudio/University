# Evidence anchors and known failure modes

Read when writing code-heavy lessons, or when a prior batch produced bad anchors.

## Product syntax

After each real code block (and at each 溯源 stop), emit a token the app parses:

```text
[[evidence:index.html:30]]
[[evidence:index.html:29-31]]
```

- Path = studied project root path = manifest `sourcePath`.
- Lines are 1-based; `start-end` for a range.
- Range must be **covered** by this revision's manifest `evidence` (same path;
  lines inside a cited range; or any line if the citation has no line bounds).
- Anchors inside fenced code stay literal and do not resolve — put them in prose
  immediately after the fence.
- Expanding coverage means updating `evidence` on the **new** revision and
  reporting that change. Do not cite lines nobody verified on the snapshot.

## Not anchors (do not count)

These already appeared in a shipped batch and look like citations to authors,
but the reader cannot jump and the linter must treat them as failures when they
replace a real token after a code block:

- `（位置：`path:line`）`
- `**位置：** `path:line``
- bare `path:line` in parentheses
- HTML comments

## Defects that already shipped

| Defect | Wrong move | Right move |
| --- | --- | --- |
| Visible garbage at top of lesson | `<!-- variant: 现象 -->` in `content.md` | `"variant"` only in `manifest.json` |
| Self-check with answer printed | `## 自检` then `答案：…` under the question | Questions only; graded exercises below |
| Non-clickable "anchors" | prose `位置` lines after code | `[[evidence:path:line]]` covered by manifest |
| Answer heading drift | `## 答案（他们选了什么）` | Always exact `## 答案`; nuance in the first sentence |
| Progress thrash | Rewrite already-compliant prose | Skip minting a revision |

## Defects likely at 475× if unstated

| Risk | Why it happens | Guard |
| --- | --- | --- |
| Dump whole lesson into `## 答案` | Agent resolves suspense and keeps explaining | 答案 = 1–2 sentences; middle holds teaching |
| Disguised multiple-choice prediction | A/B bullets feel "open" | Ban option lists and「选一个」 |
| Explain in the opening section | 现象 becomes mechanism summary | Leakage delete-test |
| `## 再想想` missing when links needed, or links in 现象 | Templates used to omit 再想想 inconsistently | Optional but only after middle, before 自检 |
| Invented `[[lesson:]]` targets | "web of knowledge" impulse | Max 3; target must exist |
| Silent card/exercise edits or drops | Revise requires full list | Report changes; never drop ids |
| Hand-edit old revision bytes | Faster than open-for-edit cycle | New revision only |
| `variant` missing after `course revise` | Proposal schema may not carry `variant` | Verify new manifest has it; set on new revision only |
| Two concepts in one lesson | Content does not fit any variant | Split; do not invent a sixth shape |
| 自检 unanswerable / unrelated to exercises | Questions written for show | Answerable from this prose; prefer align with existing exercise |
