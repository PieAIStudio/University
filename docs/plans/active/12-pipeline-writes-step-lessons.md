---
id: PLAN-12-PIPELINE-STEP-LESSONS
title: "12 · The production line writes version-3 step lessons"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-03
domain: execution
tags:
  - write-lesson
  - primm
  - content-production
related:
  - REF-WORK-QUEUE
supersedes: []
superseded_by: null
---

# Task 12 · The production line writes version-3 step lessons

**Owner-fixed fourth-lesson title:** `只想改一句，怎么让 AI 别动整条？`.
Continue from the existing first draft through Fixer; do not generate a replacement
first draft. All resumed model, validation and reading evidence stays under
`.scratch/primm-engine/task12-20261003/`. The lesson stays unpublished until the
Owner has read and accepted it; the content-repository lane owns its position as
lesson four in the learning line.

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`. Queue rules are in
  [the work queue](../../reference/execution/work-queue.md).
- **Order (Owner 2026-10-03): immediately after `11-test-catalogue.md` is pushed.**
  The writing pipeline is the beta bottleneck; the Owner must be able to read its
  fourth lesson early. Do not wait for tasks `13-`, `14-`, `16-` or `17-`.
  This replaces the earlier instruction to wait for the refactor.
- Before using the course-authoring skills, read `apps/local/AGENTS.md`.
- **Where things stand.** The first three lessons of `ai-literacy` /
  `understanding-ai`, unit `first-useful-step`, are version-3 step lessons. They
  were written by hand from the Owner-approved prototype and landed with
  `primm-pipeline.mjs assemble-steps`. The Owner accepted them as samples on
  2026-10-01. The production line itself still writes only version 2: see "Known
  limits" in
  [`primm-pipeline.md`](../../../apps/local/.agents/skills/write-lesson/references/primm-pipeline.md)
  and §4 of
  [`teaching-contract.md`](../../../apps/local/.agents/skills/write-lesson/references/teaching-contract.md).
- **Design authority.** §11 of the
  [execution spec](../../reference/interaction-components/spec.html), together with
  the design for lessons 1–3 (`lesson-1.html`, `lesson-2.html`, `lesson-3.html`,
  `first-level.html` in the same folder) and
  [V7 amendment one](../../reference/player-journey/v7/lesson-steps-amendment.html).
  §11 names what changes:
  - `activities.md` lists only the components that stay, plus the materials list;
    the sections for retired components are removed outright, with no "may be
    added later" note;
  - `teaching-contract.md` §2 "real case" becomes §7's three-places rule:
    door / wait / after, `relatesTo`, a first-hand source and a review date;
  - §5 adds the labelling rule for `runLog`, `code` and `town` materials;
  - §4 adds the "small round" rule (one kind, 3–6 items, at most one per lesson)
    and the four things a finished lesson leaves behind;
  - the line learns to write version 3, using the new lesson 1 as its model.
- **Models and cost.** In the authoring mode the AI comes from the machine's own
  hosts, never a product API key.
  - Writer chain: Grok, then Claude through `agy`, then Codex.
  - Detector and Polisher: Gemini Flash through `agy`.
  - Claude through `agy` is capped at four concurrent calls. Once it pasted its own
    report into lesson fields; check the output shape before trusting it.
- **How the Owner reads a lesson.** Use `pnpm primm:preview`, which runs a real
  local model; `pnpm dev` has no AI. Open it on `127.0.0.1`, because the server
  checks the origin. Short or placeholder answers hide length problems; the Owner
  once found truncated answers that no fixture had shown.

## 1 Outcome

Given the next outline entry, the production line writes a version-3 step
lesson that passes its own machine checks. The Owner reads it in the real
preview and judges it usable without major edits.

## 2 What the Owner said

> 「三门手手工的课，呃，把它变成。这个技能并且反复打磨，然后让AI能够写出第四门，而不是手工写的。」 (2026-10-02)

On 2026-09-30 he chose **D2**: change the writing rules only after lessons 1–3
have been finished by hand. They were accepted on 2026-10-01, so the rules
change now.

Interpretation:
- The acceptance lesson is the **fourth** lesson of the same unit, written by the
  line rather than by hand. Its outline entry is the current fourth lesson of
  `first-useful-step`.
- The samples teach the line the *shape* of a step lesson. Per the skill, their
  stories, materials and sentences are never templates.

## 3 Out of scope

- Publishing anything. The lesson lands in authoring through the native CLI
  (dry run, then revise) and stays unpublished.
- Editing lessons 1–3. They are the accepted samples and regression fixtures.
- Retiring old lessons or courses (task `13-`), and deleting component code
  (spec §10, a separate batch decision).
- Raising model budgets or swapping model families to make a run pass.

## 4 How it is judged

| Gate | Command | Baseline measured 2026-10-02 on `26a296fe` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | must stay green |
| complete | `pnpm e2e` (also run by `pre-push`) | 430 passed | must pass; count may not fall |
| timing | `pnpm e2e:timing` | 40 passed | must pass; count may not fall |

Standing floor: **pass counts may rise, never fall.**

The line's own evidence, kept under `.scratch/primm-engine/<lesson>/` and
summarised in the commit body:

- the packet, every model's raw output and receipt, and the detector report for
  each round;
- the native dry-run output, then the revise output;
- the line's own score for the version it chose, and why it chose it.

**Final acceptance is the Owner's reading, not a score.**
- Record his verdict verbatim in this document.
- If he asks for changes, they go back through the line's `review` → `fix` loop.
  Hand edits are logged with `note`, and a lesson with hand edits does not count as
  written by the line.
- If lesson four is ready but the Owner has not read it yet, pass the required
  gates, commit and push the line's changes, and keep this task in `active/` marked
  **"awaiting the Owner's reading / 等 Owner 阅读"**. Keep the fourth lesson
  unpublished, provide the real preview, then proceed to task `13-`.
  Return here for `review` → `fix` when the Owner's feedback arrives; neither
  retiring old courses nor refactoring may stand in for his reading.

Not acceptable as proof: the detector returning `ready`; a lesson read only with
short or placeholder answers.

## 5 Delivery discipline

- One task, one commit, one push; the push runs the complete gate.
- If the complete gate cannot go green: stop, keep the work committed locally,
  and write down what blocked it.
- Never force-push or rewrite history.

## 6 Report back

- Gate numbers verbatim.
- What changed in the rules, the line, and their tests.
- How many rounds the lesson took, and the line's score history.
- The Owner's verdict, verbatim, or the explicit awaiting-reading state.
- A directly openable `127.0.0.1` reading URL served by `pnpm primm:preview`,
  with actual full-length model answers and their measured lengths, not short
  placeholder answers. State clearly that the fourth lesson is unpublished.
- Failure classes the detector found that the contract does not name yet, as
  candidates for the next rule change.

## 7 Execution checkpoint · 2026-10-03

**Awaiting the Owner's reading / 等 Owner 阅读.** The unpublished native r7
is ready to inspect; Owner acceptance has not occurred. The latest continuation is at the end of this
section. Earlier tool stops and intermediate checks below are dated history,
not requests to replay their commands.

### Earlier stop before the Writer

**Not accepted and not awaiting Owner reading yet.** Task 11 and the queue-document
change are delivered on `main`: `73a8b587` and `9c55e73f`. This task's implementation
is uncommitted. No Writer, Detector or Polisher prompt has run; no new fourth
lesson, native lesson revision, published package or Owner preview is claimed.

The canonical fourth lesson is `first-useful-step/edit-one-part`, currently r6
and version 2. Accepted samples remain `ask-about-a-picture` r15,
`sound-words-and-meaning` r9 and `name-the-result` r9. The intended new revision
retains the existing activity, two card identities and independent exercise.

### Implemented locally, with limited verification

The line now has a native-schema-derived V3 draft shape, step sample planning and
full-answer rendering for the independent Detector. Source placements are audited
in the writing plan and use existing native display fields, not unread product
fields. Structural step/request/answer IDs are excluded from language polishing.
Malformed payloads and failed real sample runs stop before the Detector; native
assembly now requires a real dry-run and complete translations before applying.

The optional personal configuration file is absent on this machine. Packet reads
and native CLI writes now use the same existing configuration resolver, including
its root safety rules. A new explicit unpublished authoring project is restored
through the existing recovery importer, rather than changing the formal course
and exporting its unaccepted revision merely to pass export freshness.
An isolated preview projection and trusted-host source selection have been added
locally; their whole-product integration is not yet verified.

The teaching contract and activities guide have begun converging on V3, the
three source placements, a single 3–6-item small round and four finish outcomes.
The pipeline reference and remaining end-to-end checks still need completion.
No old component product code has been deleted.

Observed focused results, not substitutes for full acceptance:

```text
Test Files  2 passed (2)
     Tests  9 passed (9)
```

Command: `pnpm --filter @pieai/university-local test:primm-pipeline`. The seven
step-support checks and two native-authoring checks passed. Earlier synthetic
fixture errors and native temporary-root handling failures were corrected without
weakening the native schema or test assertions. A separate source-selection test
returned:

```text
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Command: `node --test scripts/primm-preview-source.test.mjs`.
The latter proves source selection and path/hash rejection, not a browser preview.
No task-12 `pnpm verify`, complete browser gate, timing gate, final format pass or
final documentation gate has run on the current working tree.

### Model preflight and unpublished native preparation

`grok models` returned exit 0 but said `You are not authenticated.` It is not a
usable Writer preflight. `agy models` returned a real catalogue containing
`claude-opus-4-6-thinking` and `gemini-3.8-flash-high`, matching the authorized
Claude Writer fallback and separate Flash Detector/Polisher roles. No effort flag
was added to Claude. `ollama list` showed `university-primm-local:latest` already
installed; no model was downloaded or substituted. Logs are under
`.scratch/task12/preflight/`.

These native commands completed, with the same explicit project and run roots:

```text
PRIMM_PROJECT_ROOT=/Users/yuanfei/PieAI/University/.scratch/primm-engine/task12-20261003/unpublished-authoring
PRIMM_RUN_ROOT=/Users/yuanfei/PieAI/University/.scratch/primm-engine/task12-20261003
node apps/local/scripts/primm-pipeline.mjs prepare-unpublished --lesson first-useful-step/edit-one-part
node apps/local/scripts/primm-pipeline.mjs packet --lesson first-useful-step/edit-one-part
```

Their outputs were:

```text
prepared unpublished native authoring: /Users/yuanfei/PieAI/University/.scratch/primm-engine/task12-20261003/unpublished-authoring/studies
packet: edit-one-part (new)
```

Preparation uses recovery-import dry-run, actual native recovery import and
open-for-edit in that isolated project. It does not apply a new lesson proposal.
`unpublished-authoring/primm-unpublished.json` and
`edit-one-part/unpublished-authoring.json` retain source hashes and native receipts;
`edit-one-part/packet.json` is the prepared input. Do not run preparation over this
existing project again. Resume with this project/root and preserve its receipts.

`.scratch/task12/protected-before.json` records the formal recovery tree, delivery
content, accepted first-three lesson trees and imported/lexicon hashes before
preparing the isolated project. The implemented native writes targeted only the
unpublished project. A final after-state comparison remains required before any
acceptance claim.

### Exact tool interruption and stop

While reading only the prepared packet's source metadata, the following request
was rejected before a result was returned. It is retained as a record, **not a
command to replay or move to another tool**:

```json
{
  "tool": "run_script",
  "arguments": {
    "project": "agent:device-c7e3c2df3e0d49e0:university-95b71956",
    "session_id": "wc_sess_pOUdWikESH1-Hlo0",
    "language": "javascript",
    "purpose": "diagnostic",
    "timeout_secs": 60,
    "script": "import fs from 'node:fs';\nconst p=JSON.parse(fs.readFileSync('.scratch/primm-engine/task12-20261003/edit-one-part/packet.json','utf8'));\nconsole.log(JSON.stringify({lesson:p.lesson,storage:p.storage,cards:p.cardIds,exerciseIds:p.exerciseIds,library:p.library.map(s=>({id:s.id,title:s.title,sourceAuthority:s.sourceAuthority,publisher:s.publisher,accessedOn:s.accessedOn,supports:s.supports,limitations:s.limitations}))},null,2));"
  }
}
```

Exact rejection:

```text
This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.
```

The Owner's stop-on-tool-rejection rule was followed. The request was not retried,
translated into another execution path or used to claim a source review. Only this
stop record and workflow handoff were added afterward. No further source fix,
model call, validation run, commit, push, task 13 work or preview launch followed.

Resume still requires finishing and verifying the generic pipeline, real model
writing/check/detection/fixing/polishing, native dry-run and revision, byte-for-byte
protection checks, and an actual full-length-answer Owner preview. The existing
successful task-11 and queue-document pushes are unaffected by this task's stop.

### Resumed implementation and real Writer

Both plugins reached this same checkout. WebCodex's direct Session-resume schema
rejects the existing hyphenated Session ID, while its ordinary reads work; DS
uses workspace `ws_b4dd57394f`. This is a parameter-schema issue, not permission
to replay the prior safety-blocked packet-summary request. That request was not
replayed in either plugin.

The formal recovery, delivery content, accepted lesson 1–3 trees and imported
catalogue/lexicon all matched the earlier hashes byte-for-byte. Receipt:
`.scratch/task12/protected-after-resume.json`; the reproducible check is
`.scratch/task12/check-protected.mjs`.

The new packet includes earlier lessons from the same unit and the accepted
first V3 lesson as a form example, explicitly forbidding reuse of its story,
materials or sentences. The previous packet is retained at
`.scratch/task12/packet-before-sample-shape.json`.

The model lists were checked again. Grok still reported the exact unauthenticated
message; agy listed `claude-opus-4-6-thinking` and `gemini-3.8-flash-high`.
The explicit Claude Writer / Flash Detector and Polisher route is recorded in
`.scratch/task12/preflight/selected-route.json`, beside both raw model listings.
The first real Writer call has been dispatched through the existing pipeline;
`.scratch/task12/write.log` and the run directory retain its outputs when complete.
This is not a claim that a lesson or review has finished.

The real pipeline schema/projection/polish map now have tests, not only support
helpers. A native test also dry-runs and applies a synthetic revision, then
builds the unpublished projection and checks its revision and unchanged source.
It exposed an incorrect demand for repository-baked evidence on a public-source
study. Preview now follows the canonical export's actual source type: repository
sources still require baking; a public-source study gets no invented Git source.
The existing formal delivery and browser gates were not changed.

The first native-preview attempt recorded `1 failed | 10 passed (11)`;
after that fix it recorded `11 passed (11)`. Source-admission and exact image
coordinate regressions then recorded `2 failed | 8 passed (10)` before the
corresponding implementation fix. Complete verification and lesson acceptance
are still required; these focused totals do not stand in for them.

The subsequent full `pnpm verify` completed with exit 0 on the current source.
It included `primm-pipeline-step-support.test.mjs (10 tests)` and
`primm-pipeline-authoring.test.mjs (2 tests)`, both passing. Document checks:
`175 docs`, `165 current files, 338 local links`, zero audit/doctor warnings.
Log: `.scratch/task12/verify-integration.log`. A second protected-content comparison
also passed: `.scratch/task12/protected-after-after-verify.json`.
This is code verification, not the browser/push gate or Owner lesson acceptance.

### Native projection correction and second complete fast gate

The actual importer writes `studies[].studyId`, not `studies[].id`. The first
preview selector and its synthetic test had repeated that same incorrect field.
A test using the real generated projection exposed the mistake. The corrected
source-selection test first recorded `3 pass / 1 fail`, then `4 pass / 0 fail`;
the complete native pipeline integration recorded `12 passed (12)`.
Logs are `.scratch/task12/native-manifest-source-red.log`,
`native-manifest-source-green.log` and `native-full-projection-green.log`.

The corresponding `pnpm verify` completed with exit 0, including the unchanged
document gates (`175 docs`, `165 current files, 338 local links`, zero warnings).
Log: `.scratch/task12/verify-final-source.log`. Browser listing still contains
`Total: 431 tests in 70 files`; timing listing contains `Total: 40 tests in 9 files`.
These are listings, not a browser or timing execution.

### First actual Writer result and the interrupted duplicate

The Claude-through-agy Writer's first call ended with exit 3 after 1,796,965 ms.
Its retained receipt says `parsed: true`; the transport stderr says:

```text
error: There was a network issue connecting to the server, please try again. (response may be truncated)
agent executor error: generating and executing: stream reading error: unexpected EOF
```

The existing caller had already started its automatic second attempt. On reading
the first receipt, the executor stopped only its own process group (88938,
including its agy child 52215 and node child 52237), rather than continuing to pay
for a duplicate while a structured result was available. PID/parent/group evidence:
`.scratch/task12/writer-interrupted-retry-processes.log`. The process ended by
SIGTERM; the interrupted retry has no accepted output or success claim.

The existing `reparse --name writer.v1` stage recovered the actual first draft
from its raw response. Its source was the model output, not a hand-written
replacement. The old reparse log said `schema-valid`, but its implementation
checked only the top-level shape. The subsequent real `check` disproved that
wording: `activity.steps[3].terms` is missing. It recorded
`check v1: invalid authored structure; no live sample executed`.

The candidate is at
`.scratch/primm-engine/task12-20261003/edit-one-part/draft.v1.json`; the raw
response, exit-3 receipt, stderr and rejected-attempt record are beside it.
The recovered draft is NOT a completed fourth lesson. No native lesson revision
was applied; no independent Detector, Polisher or real sample run has accepted it.

A small failure-path repair now allows a machine-invalid draft to go back to the
Writer without inventing an independent review. Runtime failures still stop;
valid drafts still require a real independent review. A regression first recorded
`1 failed | 10 passed (11)` and its subsequent execution exited 0. The fixer now
receives the full draft and its selected sources, not another copy of every old
lesson and unused source. Reparse logs now distinguish an unvalidated recovered
shape from a schema-valid result. A parsed result with a nonzero transport exit
now stops for inspection before an automatic duplicate call.

These last failure-path changes were made AFTER the successful complete fast
gate above. They have only the focused regression result so far; complete
verification must run again before delivery. No Fixer call has yet been sent.

### New tool stop · 2026-10-03

The next request was `DS-Mac-V3.exec_command` in workspace `ws_b4dd57394f`, with
`yield_time_ms: 1000` and `max_output_tokens: 1400`. Its exact command was:

```sh
cp .scratch/primm-engine/task12-20261003/edit-one-part/lint.v1.json .scratch/task12/lint-v1-before-complete-diagnostics.json && env PRIMM_PROJECT_ROOT="$PWD/.scratch/primm-engine/task12-20261003/unpublished-authoring" PRIMM_RUN_ROOT="$PWD/.scratch/primm-engine/task12-20261003" PRIMM_WRITER_CLI=agy PRIMM_WRITER_MODEL=claude-opus-4-6-thinking node apps/local/scripts/primm-pipeline.mjs check --lesson first-useful-step/edit-one-part > .scratch/task12/check-v1-complete.log 2>&1; result=$?; cat .scratch/task12/check-v1-complete.log; exit $result
```

The host rejected it before any execution result was returned:

```text
This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.
```

No other plugin or entry point replayed that request. No result is claimed for
the proposed lint copy or repeated check. New implementation, model calls,
validation, commits and pushes stopped; only the already-running focused test
was observed to its terminal exit 0 and this required stop record was written.

Task 12 remains uncommitted on `main`, after the already-delivered `9c55e73f`.
Its first real draft and all available receipts remain on disk. The unpublished
authoring project still holds the original target revision; the formal first
three lessons and formal delivery packages have not been intentionally written.
The last completed byte comparison is `protected-after-after-verify.json`; a
fresh final comparison is still required after the remaining authoring work.
There is no Owner-reading preview or new task-12 commit, and task 13 has not begun.

### Authorized single retry and continuation from v1

On the Owner's next instruction, the prior interrupted intent was retried once
through the same DS-Mac-V3 plugin as two separate commands. `cp -n` preserved
`lint.v1.json` as `lint.v1.attempt-01.json`; exit code 0. The standalone native
pipeline `check` also exited 0 and retained the missing `steps[3].terms` finding.
There was no fallback to another plugin and no new Writer call.

The renewed model listings and explicit route are in `resume-preflight.json`,
`grok-models-resume.log` and `agy-models-resume.log` in the run root. Grok remains
unauthenticated. Fixer uses the listed `claude-opus-4-6-thinking` through agy,
without an effort flag; independent Detector and Polisher use the listed
`gemini-3.8-flash-high`. `fix --from 1` now continues the recovered first draft.

An optional `polish --fixed-title` constraint preserves the Owner's exact title
through the ordinary per-key acceptance gate; it does not hand-edit a generated
lesson or disable other polishing. Its regression first recorded
`1 failed | 11 passed (12)`, then `12 passed (12)`. Logs are `title-lock-red.log`
and `title-lock-green.log` under the run root. Native lesson revision, real
preview and complete task delivery are not yet claimed at this checkpoint.

### Structural fix, actual runs and correcting the independent reading view

The first Fixer call (`fixer.v2`) kept every learner sentence and added only
`terms: ["YT9088763421"]` plus its resolution. Its provider exited 3 after
850,857 ms with `unexpected EOF`, but a complete structured response survived.
The pipeline stopped before a duplicate call; native `reparse` recovered that
same response and reported a valid schema. Raw output, stderr and the nonzero
receipt remain beside the draft. This is recovered model output, not a hand edit.

The real `check v2` then returned `0 machine findings (0 shape); samples run=ok
modify=ok`, exit 0. All five distinct local-model requests completed: the three
selectable Run requests, Modify and Make. Their full answers are preserved in
`samples.v2.json`, with Unicode-character/UTF-8-byte counts of 146/382, 126/316,
126/330, 125/313 and 135/379 respectively. No output was shortened or substituted.

The first independent Flash report found `blocker=1 major=5 minor=2`, score 27.
Some findings accurately described teaching problems; others were caused by the
review renderer omitting real product rules. Source inspection confirmed:
`PrimmSteps.tsx` resolves the chosen request, `primm-steps/build.tsx` shows hints
only after failed assembly, and `primm-steps/make.tsx` permits editing the raw
answer and requires a native `pass` before continuing. The review text had not
identified its sample branch or distinguished the raw Make answer from a graded
final work. These omissions must not prompt the Writer to repair nonexistent UI
defects.

A regression first returned `1 failed | 12 passed (13)`. The renderer now labels
the sample branch, conditional feedback, failed-only hint, raw ungraded answer,
native grading gate and ungraded post-pass self-check. This changes only the
review projection, not the lesson or UI. The teaching contract clarifies the
ungraded self-check already present in the approved samples; it does not allow a
second examination. The subsequent pipeline suite returned `15 passed (15)`.

`review-attempt-01/` retains the first report, raw output, receipt, render, samples,
lint and unchanged draft. `review-projection-correction.json` proves the draft and
sample hashes stayed identical. Re-reading that corrected projection with the
same answers returned `blocker=0 major=2 minor=4`, score 10. This score change is
attributed to a corrected reading view, not a claimed improvement to the lesson.
The second unmodified report is preserved in `review-attempt-02/`.

The remaining major findings concern the real need in the independent task and
the Predict option prematurely giving the complete Modify request. The report's
minor findings concern plain wording, the Run-to-sort transition, the limited
fact-checking action and the opening's dense product names. Its estimates of
manual-edit time and relative effort are model judgments, not measured facts;
they are not evidence to quote into lesson content. The Owner's actual title
instruction was added through `review`; its `HUMAN` entry is excluded from the
independent score. `fix --from 2` continues the same draft as v3.

### Second Fixer result, complete real answers, and the next stop

`fixer.v3` continued v2, preserving the Owner-fixed title. The model simplified
the Predict request, changed the too-easy independent task to a longer landlord
repair message, removed the trivial tracking-number click, improved some wording
and recorded seven resolutions including the actual Owner title instruction.
These changes came from the Fixer response. No draft/lesson prose was hand edited.

The provider receipt records 853,657 ms, `exitCode: 3`, `parsed: true`, and:

```text
error: Your AI credits balance is too low to continue. (response may be truncated)
AGY_ERROR: {"short_error":"RESOURCE_EXHAUSTED (code 429): Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED","error_code":429,"code_kind":"http","retryable":true,"error_id":"58179aaf-53ea-4ed2-9184-65afe04f024f-10-2008"}
```

The pipeline stopped instead of paying for a duplicate. Existing `reparse`
recovered the same saved response with `schema=valid, no veto`. The next native
`check` had already started and was allowed to finish; it returned, verbatim:

```text
check v3: 0 machine findings (0 shape); samples run=ok modify=ok
```

That command exited 0. The five distinct local-model outputs in `samples.v3.json`
are 141, 19 and 130 Unicode characters for the Run options, 127 for Modify and
641 for Make (367, 57, 328, 319 and 1,759 UTF-8 bytes respectively). These are
complete, actual answers, including poor answers. In particular the 19-character
response merely repeats the original angry sentence, and the Make response has
multiple versions with factual drift. A successful request is not a correct
answer or a passing independent task. None of those outputs was replaced,
shortened or promoted to a graded final work.

The first two independent reading scores remain 27 (incorrect review projection)
and 10 (corrected projection, same v2 bytes/answers). V3 has no independent score
yet. `round-summary.json` records this distinction. No third Fixer, v3 Detector,
Polisher, native lesson dry-run/revise or actual preview has run.

After reading the credit-failure receipt, the executor attempted only to discover
which status commands the CLI supports. The exact host request was:

```json
{
  "tool": "DS-Mac-V3.exec_command",
  "arguments": {
    "workspace_id": "ws_b4dd57394f",
    "cmd": "agy --help",
    "max_output_tokens": 3600
  }
}
```

Exact rejection:

```text
This tool call was blocked by OpenAI because we couldn't determine the safety status of the request.
```

The help request was not retried, split again or moved to another plugin. No model
route, account, credits or budget was changed. Whether the same credit limit also
affects the required Flash roles was not established. Only the already-running
local check was observed to terminal exit 0, its existing output read, and this
stop record saved afterward.

Before this interruption the final pipeline code had passed `pnpm verify`, exit
0, in `verify-review-projection.log`: `175 docs`, `165 current files, 338 local
links`, zero audit/doctor warnings. Its focused pipeline suite returned
`15 passed (15)`. Only documentation and ignored acceptance helpers changed after
that source check. The latest protected-formal-content comparison was also green
at `.scratch/task12/protected-after-resume-title-verify.json`; no later native
write to the formal or unpublished lesson revisions occurred. A fresh final
comparison is still needed after the remaining authoring work.

Current handoff: use the existing `draft.v3.json`, `samples.v3.json`, `render.v3.md`
and `lint.v3.json` for the next independent reading; do not rerun Writer or either
completed Fixer. The first title is still `只想改一句，怎么让 AI 别动整条？`.
Task 12 remains uncommitted after `9c55e73f`, unpublished and not yet ready for
Owner reading. No task-12 browser/timing gate, commit, push, actual preview or
task-13 work is claimed. The screenshot/reading helpers are prepared but have not
produced evidence; no reading URL or screenshot set is claimed to exist.

### Desktop continuation: independent v3 review and Codex fallback

The Owner authorized continuation from the retained third draft and confirmed
that Flash works while Claude has exhausted its credits. Fresh listings are in
`desktop-resume/`: Grok still says `You are not authenticated.`; agy lists
`gemini-3.8-flash-high`. The independent Detector ran on the original v3 render
and original real answers, without another Writer or repeated Fixer. Its result:

```text
detect v3: gemini-3.8-flash-high verdict=revise blocker=0 major=2 minor=3
```

Score: 9. The two major findings concern the opening disclosing the strategy
before Predict and the transition from Run to the sentence classification.
The report and receipt remain `edit-one-part/detector.v3.*`.

The needed new Fixer uses Codex, after `codex --version` returned
`codex-cli 0.157.0` and `codex debug models` listed `gpt-6-astra` with `ultra`.
`desktop-resume/route.json` records that exact arm and effort. No exhausted Claude
call was retried. The pipeline now accepts `PRIMM_WRITER_EFFORT` so the current
listed effort can be selected instead of silently keeping a historical default.
`fix --from 3` returned v4 successfully, without editing the practice or Make
material. Its machine check returned zero findings, but independent review
returned `blocker=1 major=2 minor=2`, score 18, worse than v3's 9. The new blocker
is a fourth mandatory build tile absent from the three-part teacher hint.
`fix --from 4` produced v5, whose real machine/runtime check again passed with
zero findings. Its independent review returned `blocker=1 major=1 minor=2`,
score 15: the new refund lookup matched only a full literal phrase, and the
Modify teacher asked for editing on a send screen with no editor. `fix --from 5`
now addresses that report. These explicit continuations preserve every regression
and are not reruns of completed Fixers. No polish or native revision is claimed
yet. Exhausted-credit and recovered-transport regressions
now prove no duplicate model call; the focused suite passed `17 passed (17)`, and
`protected-after-desktop-resume.json` confirms formal content stayed byte-identical.

V6 again passed the real check with zero findings. Its independent report returned
`blocker=1 major=1 minor=3`, score 16, but the blocker incorrectly treated the
fourth build tile as mandatory. Actual `primmBuildVerdict` accepts all four
configured forms, including both three-tile forms. The review renderer had shown
only its first sample. The corrected projection lists every native-valid form;
`review-v6-before-build-alternatives/` preserves the original report and render,
and `desktop-resume/build-alternatives-projection.json` proves draft, answers and
lint bytes did not change. No new answers or lesson hand edits were made.

The valid title issue remains: the Modify screen asked for comparing both runs
but displays only the current result. `fix --from 6` addresses the current report
with the corrected projection available, without a redundant Detector rerun while
that known major still remains. The alternative-build regression and all earlier
pipeline cases passed: `18 passed (18)`. No polish or native revision is claimed yet.

V7 passed the real check with zero machine/shape findings. The corrected
independent view returned `ready`, `blocker=0 major=0 minor=2`, score 2. The Fixer
rejected the false mandatory-tile finding with the actual three-tile identities
and corrected the title to compare the original message. V7 is selected because
it has the lowest score and is independently ready. The remaining minor findings
are a duplicated character in the authored practice message and a suggestion to
add positive-case feedback to an already conditional explanation. Neither is
silently erased from the review history.

### Native r7 and the Owner reading handoff

Flash polish accepted all 92 display keys, rejected zero keys and supplied 94
English display strings. The Owner-fixed title stayed exact. `check --final`
returned zero machine/shape findings with complete real answers. Native dry-run
validated, then `assemble --apply` revised the isolated lesson to r7. Both exited
0; no lesson text was hand edited. The line has used one Writer and six Fixers
in total, four new Codex Fixers during this continuation; the two earlier Fixers
were not repeated. Scores are 27 → 10 (same v2, corrected projection), v3 9,
v4 18, v5 15, v6 16 (false blocker retained), and v7 2. The selected v7 is the
lowest independently ready result, not an Owner acceptance.

`preview.json` retains the native unpublished export/import receipt for
`unpublished-authoring/previews/2026-10-03T11-31-52-918Z`. The formal recovery,
delivery content, accepted lessons 1–3, imported catalogue and lexicon remained
byte-identical in `protected-after-desktop-native-final.json`. No formal package
was published, replaced or promoted. Task 13 must preserve this entire run and
the isolated r7; it is not an accepted fourth lesson to ship.

From the repository root, one command opens the correct unpublished source:

```sh
UNIVERSITY_PRIMM_PREVIEW_ROOT="$PWD/.scratch/primm-engine/task12-20261003/unpublished-authoring/previews/2026-10-03T11-31-52-918Z" pnpm primm:preview
```

Then open
`http://127.0.0.1:23150/ai-literacy/understanding-ai/first-useful-step/edit-one-part?lang=zh-CN`.
The server is already running for this handoff; do not start a second instance
on the same ports. `pnpm dev` does not provide these real model interactions.
The reading gallery is `owner-reading-1280-complete/index.html` under the run root,
with 50 desktop screenshots, viewport shots at 1280 × 844, ordered scroll
segments, every step and complete real answers. This final desktop set contains
Run/Modify/Make outputs of 156/117/182 Unicode characters and a 192-character
learner-edited final work; none is a short fixture answer. Original desktop and phone walks stay in
`owner-reading-1280/` and `owner-reading-390/`; their Run/Modify/Make answer lengths
are respectively 141/120/166 and 155/116/182 Unicode characters. All responses are
native `kind=live`, with full text, prompts, request IDs and receipts retained.
The walks exercised offline-error/retry, a wrong sort, the valid three-tile
build, reload/resume, Make grading, finish and return to map.

**Reading limitation, not concealed acceptance:** the first desktop Make answer
omitted the photos, this-week deadline and the one-month delay, yet the real local
preview grader returned `pass`. Its recovery package contains all four correct
rubric entries; the mismatch is a local-model verdict, not a fabricated receipt
or an absent requirement. The original bad answer and verdict are retained.
The later desktop walk demonstrates learner editing of the independent work
before grading, preserving the other four original paragraphs and restoring the
missing facts. That is learner work, not a hand edit to lesson prose. It cannot
turn the earlier false-positive verdict into correct evidence.
`owner-review-brief.md` records this High AI-behavior finding and the remaining
minor duplicated character in the authored practice message. It is review-only;
no generic grader or UI redesign was added to this pipeline task.

All gate evidence for this continuation is in `desktop-resume/`. Final fast
verification and the complete/timing gates run before ordinary push; the push
receipt/log retain the exact commit, exit status, load and pass counts. This task
stays active as **等 Owner 阅读** regardless of a successful code push. Return
through `review` → `fix` for actual Owner feedback. No new unclassified teaching
failure is promoted to a contract rule from this run.


Final desktop `pnpm verify` exited 0 (`desktop-resume/verify-final.log`):
`175 docs`, `165 current files, 338 local links`, audit/doctor `0 warning(s)`.
Focused pipeline regressions: `18 passed (18)`; final normal local test run:
`53 passed (53)` files / `512 passed (512)` tests. The fresh protected comparison
at `desktop-resume/protected-after-desktop-delivery-final.json` is unchanged.
The reading gallery has 50 images and zero missing image files. One ordinary
commit saves the pipeline plus this awaiting-reading record; normal pre-push
must still pass the standing 431 complete and 40 timing cases. Before invoking
push, require one-minute load <20 and no other Playwright run. Exact delivery
results belong to `push-receipt.json` and `push.log` in the retained run root;
no delivery pass is claimed before they exist.
