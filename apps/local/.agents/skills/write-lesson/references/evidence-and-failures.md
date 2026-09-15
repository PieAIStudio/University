# Evidence anchors and known failure modes

Read for either repository or no-repository lessons, and when a batch has bad anchors.

## Product syntax

For repository code (and each repository 溯源 stop), emit a token the app parses.
The token renders the source; do not hand-copy the source into a preceding fence:

```text
[[evidence:index.html:30]]
[[evidence:index.html:29-31]]
```

- Path = studied project root path = manifest `sourcePath`.
- Lines are 1-based; `start-end` for a range.
- Range must be **covered** by this revision's manifest `evidence` (same path;
  lines inside a cited range; or any line if the citation has no line bounds).
- Anchors inside fenced code stay literal and do not resolve — put them in prose.
- Expanding coverage means updating `evidence` on the **new** revision and
  reporting that change. Do not cite lines nobody verified on the snapshot.

## Without a repository

Use the same five variants and lesson spine; only evidence changes:

- `溯源`: follow real systems or documented operations, identifying what each
  stop receives/does/produces. Support each stop with an appropriate primary
  source or reproducible observation; do not invent file/line anchors.
- `术语`: use three situations the reader can encounter, explained in plain
  language. Primary documentation supports the claim; pasted official wording
  is not a substitute for the explanation or for a real use case.
- `现象`: show a reproducible observation or concrete task. Record the setup
  and relevant conditions; a hypothetical teaching example must be labeled as
  an example, not reported as an observed event.

Use the existing URL evidence fields (`sourceUrl`, `sourceTitle`,
`sourceAuthority`, `kind`, `note`). Put a normal Markdown source link beside the
relevant explanation (`[来源标题](sourceUrl)`); the URL must be visible/clickable,
not merely stored in metadata or quoted inside a code fence. Read the source and check the claim;
HTTP 200 alone proves neither truth nor relevance. Official documentation may
support a typical flow, not prove that this particular run followed it. Keep
fact, inference, and constructed examples distinct. No fake repository,
snapshot, commit, or `[[evidence:undefined:…]]` is needed for a no-repository lesson.

### Real-world sources (Owner direction, 2026-09-14)

The subject may be an actual product case, original reporting, research,
public records/data, a rights-holder's image/video, or a recorded observation.
It does not have to be source code. Use the existing URL evidence contract,
not a second source database and not a fabricated repository pin.

New categories (`first-party`, `research`, `public-record`, `news-report`,
`open-data`, `rights-holder`) carry `provenance`: `type`, `publisher`, an
optional verified `publishedOn`, required actual `accessedOn`, an optional
`locator`, the specific claim `supports`, and `limitations`. The date format
is YYYY-MM-DD. Do not manufacture publication dates for undated pages. Hosts
are admitted only after inspecting the relevant source; admission alone does
not approve another page or another claim on that host.

Original reporting can establish what was reported about an event, not an
unverified technical explanation. Vendor claims remain vendor claims. A
research finding carries its sample, task and relevant limits; it does not
prove that a different learner or product will obtain the same result.
Clearly label inference and constructed practice variants. If a source cannot
support the planned lesson, change the lesson or find adequate material;
never fill the gap with an invented quotation, image, result or metric.

The source footer exposes these boundaries to readers. Inline source links
still belong beside the claim, not hidden only in metadata. External media
need permission/licence and accessible alternatives; prefer a link over
copying material whose reuse rights are unknown.

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
| Useful task discarded for lacking surprise | Treating anomaly as admission | Ground a real task; split only separate learning goals; keep five variants |
| 自检 unanswerable / unrelated to exercises | Questions written for show | Change a condition/example but stay answerable from this prose; feedback belongs to the exercise |
