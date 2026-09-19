---
id: PLAN-INTERACTION-FIRST-EXPERIMENT
title: Interaction-first lesson experiment
type: plan
status: active
canonical: false
owner: ai-assisted
created: 2026-09-16
last_reviewed: 2026-09-18
domain: learning
tags:
  - lesson-reader
  - interaction
pinned: false
related:
  - SPEC-0001
---

# Interaction-first lesson experiment

## Current comparison lane: learner-value-first

Owner requested another `codex/` worktree to implement the learner-value discussion
in lessons 1–5. This checkout is `.worktrees/learner-value-first`, branch
`codex/learner-value-first`, based on committed `ca2c7d3f`. The original experiment
has another AI's ongoing edits: preserve its code, source corpus and services.
The preceding single-lane restrictions below are historical, not current authority.

- [x] Create one new lane and recover committed courses into independent storage.
- [x] Specify usable outcomes before PRIMM; update the same write-lesson skill.
- [x] Rewrite five bilingual lessons with actual Writer, Detector and Flash runs.
- [x] Retain source/asset/card identity; improve tasks and changed-input Make.
- [x] Play desktop/phone, fix findings, verify, and provide independent URLs.

No mainline merge, publication, payment, account change or analytics rollout.
Proposed user needs remain hypotheses, not user research. Receipts are under
`.scratch/learner-value-first/`; screenshots under `.devspace-visual/learner-value-first/`.
The other 31 lessons must remain unchanged. Earlier records below retain their
original meaning and are not acceptance of this lane.

The five current native revisions are 12/9/9/6/7. The first lesson now teaches
turning an authored practice poster into an outing reminder, then changes the
poster in Make. The third separates attendee and volunteer responsibilities;
Make changes the role rather than copying the attendee checklist. The remaining
lessons produce a voice-message reminder, a polite bounded edit and a visit
decision based on supplied official-source snapshots. Claims of user demand or
learning effectiveness remain untested hypotheses.

Grok preflight listed the model but its actual Writer request hit the usage limit.
The documented Codex fallback (`gpt-6-astra`, ultra) wrote all five. Two independent
Gemini teaching reviews, host substantive fixes and 17 successful bilingual Flash
polish batches are preserved; an additional Flash batch supplied missing-clock-time
feedback. The first polish assembler failed on an overbroad localization dictionary,
not a failed model run; it was repaired using the original saved responses.

Actual playback exposed two important issues. A tall diagram overflowed its grid
track and painted behind the editor; bounded grid tracks now retain the complete
image above its caption. Request-piece controls retain full accessible names but
use compact arrows/remove glyphs. Model grading also missed an absent meeting time
or rejected equivalent wording. The bounded preview now reviews criteria separately;
an optional author-declared missing-clock-time precheck handles that definite
omission before semantic review. It cannot itself produce a pass or certify that
a stated time is correct. The final missing/wrong/equivalent-time live probes pass;
earlier failed probes remain, and no general claim of model-grading reliability is
made. The correction was landed as a native audio revision, not a delivery edit.

The first broader browser run is not acceptance: 24 passed, one timed out during
accessibility analysis, one was interrupted and six did not run. Host load reached
357 and the run overlapped development edits; preserve its log and use final-code
checks below. The final course preservation check confirms the other 31 lessons,
original lesson-level sources/assets and assessment IDs are unchanged. The exact
served package is recorded in `.devspace-visual/learner-value-first/preservation.json`.

On resumption, the new lane already existed; it was reused rather than creating
another branch. A focused language check found that the optional time-presence
guard rejected ordinary English forms such as "2 in the afternoon" and "2 o’clock".
It now accepts those forms and 14h00, while quantities and durations still do not
stand in for a meeting time. The 35 related format/runtime tests pass. This change
does not validate the time's value or bypass semantic review. Final checks remain
sequential so rebuilding shared output cannot reload an in-flight browser lesson.

The final phone critic correctly identified a teaching mismatch in lesson three:
the stated ability was role-based filtering, but Investigate only rearranged four
preselected facts. The existing layout engine now optionally lets learners move
irrelevant items aside and restore missing ones while the artifact changes. Plain
layout tasks retain their contract. Nineteen changed/new text items were actually
Flash-polished and localized after independent teaching review, then landed as the
native third-lesson revision. Its explanatory recap appears only after a valid
selection; the learner cannot pass by only rearranging or removing everything.

`verify-final-selection.exit` is 0 for the selection implementation before the last
presentation corrections described below. The preceding
`verify-closeout` failed the stale-CSS guard when edits overlapped its build; that
failure is preserved rather than counted as acceptance. The final PRIMM and V1/V2
compatibility browser run passed all 32 cases. `accepted-desktop` and
`accepted-phone` each completed all five current revisions with real local runs,
changed requests, native Make evaluation, visible artifact repair, copy and map
return. The phone is a 390px touch-enabled browser simulation, not a physical-device
claim. Some raw outputs needed editing; generated output is not presumed correct.
The final visual review is separate from these behavior checks. Evidence and
local preview restart instructions are in the existing owner review brief.

The final screenshot pass confirmed role filtering and readable Markdown, and
disproved the missing-heading/static-badge findings with entry/interaction evidence.
It also caught an unclear boundary between the AI reply and the editable original
in lesson four; each now has its own heading. The director found that layout
previews dropped labels, leaving "move to the activity room" without its rain
condition. Previews now retain every item's label, and item panels use the brand
panel radius rather than the pill-shaped control radius. These last presentation
changes receive their own focused browser/live checks and a new full verification.
Manual comparison in Investigate and editable request fragments remain intentional
PRIMM scaffolding, not proven preferences of real learners. Review their usefulness
with the Owner; do not treat every critic's redesign preference as a factual bug.

Those last presentation corrections passed eight bilingual/both-mode browser
cases and four actual live walks (lessons three/four at 1440 and 390 touch widths).
The separate eight-image AfterCritic marked both the retained reminder labels and
the edit-target boundary fixed, with no new blocker in that scope. The final full
verification `verify-owner-ready` exited 0. On this continuation, no changed source
file was newer than that passing check. A fresh five-lesson desktop walk also
completed real Run/Modify/Make, native evaluation, copy and map return, with zero
browser page errors; see `resumed-owner-check/receipt.json`. Three raw results
needed visible learner edits before passing. Their original outputs and first
verdicts remain in the receipt; successful execution is not presumed correctness.

This comparison is ready for Owner trial at port 23650. The 32-case focused
browser run and eight final presentation cases are the verified browser scope,
not a claim that the whole default browser suite ran. Existing phone evidence is
390px touch simulation, not a physical-device or real-learner result. No mainline
merge, push, paid calls or publication occurred; preserve the original AI's lane.

## Historical scope: the original interaction-first lane

The sole experiment worktree is `.worktrees/interaction-first`, on
`codex/interaction-first`. Owner subsequently authorized bringing main into this
branch, absorbing all Claude research, and deleting that merged branch/worktree.
Those operations are complete: `0ebb0769` retains main `e66c0fa0`, and `f4d3773c`
retains Claude `c3c4f62f` and the original experiment. Both heads were verified as
ancestors. Eighty ignored research/evidence files were copied and hash-checked in
`.scratch/interaction-v2/claude-preserved/`; no process owned the retired path.
Ordinary `git worktree remove` and `git branch -d` removed the Claude lane without
force. Only main and this experiment remain. Main itself was not edited.

The current authorized task is a unified playable inventory, restrained game
presentation, canonical write-lesson V2 and native first-five sample revisions.
No new branch/worktree, push, production publication, merge into main or cloud
writes are authorized. Course writes stay in `.scratch/interaction-studies`.

## V2 execution

### Current task: case-led introduction, learner-led everyday practice

Owner's latest trial accepts the clean, linear shell but rejects using the
historical case as the compulsory subject of all five phases. The next native
revisions keep PRIMM. A brief verified case establishes a real use; a separately
labelled everyday practice establishes why this learner needs it. Neither is
passed off as the other. The prior pilot and its failed checks below are evidence,
not current acceptance.

- [x] Read Owner's `eli5` skill; fold audience calibration, purpose-first language
  and patient concrete transitions into the existing write-lesson contract.
- [x] Separate historical sources from authored practice data in typed payloads.
  Retain original immutable sources/assets and assessment IDs without forcing them
  into the main exercise. Source language, synthetic voices and practice notices
  must remain honestly labelled.
- [x] Give all five phases different operations: low-stakes prediction, material
  attachment and real execution, content-specific investigation, editable request
  construction and rerun, independent new-input artifact creation. No five-choice
  quiz, no renamed duplicate editor, no artificial score for clicking.
- [x] Rewrite all five in plain, warm adult language, independently review and
  actually Flash-polish, then use native revise/export/import only.
- [x] Play the actual final revisions, keyboard and phone, interrupted work,
  attachment/prompt/output identity, wrong attempts and independent work. Preserve
  validation failures; do not count old pilot receipts as new acceptance.

Practice designs: photo sharing (coffee photo, then a cat photo); an English
appointment message (synthetic practice audio, then a different message); a
fictional neighbourhood book-swap announcement (then a different notice); a
message whose rude middle sentence needs repair (then a new message); and a
museum visit question with clearly identified official records. Historical Be
My Eyes, Whisper, prompting, Canvas and Search sources introduce the capabilities,
not the subject matter the learner must memorize. The first four phase operations
prepare Make; Make changes the material or purpose and asks for a usable artifact.

Work remains in the existing worktree and isolated authoring storage. This task
does not authorize mainline changes, publication, paid calls or account changes.
Current process/evidence folders: `.scratch/everyday-five/` and
`.devspace-visual/everyday-five/`.

The current native revisions are 11/7/7/5/6. They were produced through the
existing CLI, not edited in delivery JSON. The independent teaching review and
31 actual Flash-polish jobs are in the current process folder. The preservation
check retains historical evidence/assets and assessment identities; the other
31 lessons are unchanged. The fifth lesson uses supplied official visit-information
snapshots, not a newly performed web search. Synthetic appointment clips are
explicitly labelled and actually recognized; their scripts are not ASR results.

The resumed walkthrough found a grading defect: an old generated draft was sent
alongside the learner's corrected artifact, and feedback blamed words already
removed. Evaluation now sees only the current artifact/request and relevant task
materials; the original run remains bound server-side. Internal feedback evidence
must quote current text or identify a missing requirement. A fabricated quote is
an unavailable evaluation, never a learner failure. This narrows the failure mode,
not a claim that model grading is infallible. Runtime regression covers it.

A delayed-image probe reproduced a 200px downward movement of the first prediction
while the photo loaded. The shared media frame now reserves its display space
without stretching the photograph; the same probe measures 0px movement. The
before/after screenshots and original 30-pass/1-failure browser run remain under
`everyday-five/`. Final desktop and 390px touch-browser walks each completed all
five lessons using real local execution, independent Make evaluation, copy and
return. The 32-case bilingual/two-mode/compatibility browser run passed. After
highlighting the edited sentence, the same relevant five cases also passed;
their earlier interrupted/restarted-view failure remains recorded rather than
being erased. No pointer, grading or screenshot assertion was weakened.

The independent closeout reviewer inspected 19 screenshots, including full-image
and full-comparison crops, and retained no blocker/high finding. Longer request
button labels and the mobile opening's natural scrolling remain observation items,
not claimed empirically settled. The final `VITEST_MAX_WORKERS=1 pnpm verify`
passed on this product code; receipt: `.scratch/everyday-five/verify-closeout.exit`.
The single Owner walkthrough is `.devspace-visual/everyday-five/owner-review-brief.md`.
This is a playable local prototype, not production deployment or proof of learning
retention. Existing native histories and previous failure evidence remain intact.

### Previous pilot: complete PRIMM and everyday relevance

Owner approved the full Predict → Run → Investigate → Modify → Make method,
not an invented alternative order. The first five lessons are the pilot. Their
openings must connect an ordinary person's concrete situation and unmet need to
the real case and the skill being practised. A real citation alone is not a reason
to learn. The original sources, image credits and useful boundaries stay intact.

Work list, in dependency order:

- [x] Update the one write-lesson skill: life situation → need → relevant skill,
  complete PRIMM, purposeful game selection, redundancy review, actual Flash polish.
- [x] Implement one linear PRIMM lesson surface in the shared reader: only the
  current phase, no early exercise, duplicated sources, per-round article or
  diagnostic history, no extra read-confirmation ritual or next-lesson shortcut.
- [x] Supply truthful execution for prepared input and modified requests. Distinguish
  live AI, captured real runs and authored simulation; never label a replay live.
  Existing provider configuration, safety and cost boundaries are prerequisites for
  live calls, not excuses to silently fabricate results.
- [x] Reuse/adapt appropriate visual, sorting, editing and source-collection mechanics;
  do not reduce Investigate/Modify/Make to five series of multiple-choice questions.
- [x] Write five new bilingual native revisions, retain source/asset and assessment
  identity, bind Make to the independent work rather than append a duplicate quiz.
- [x] Independently check teaching and plain language, run local Gemini Flash polish,
  then native revise/export/import. No edits to generated delivery JSON.
- [ ] Walk all five, wrong predictions, changes, interrupted execution, keyboard/phone,
  return/resume and completion; fix findings, run checks and independent screenshots.
- [ ] Verify exact served revisions, keep the experiment clean and give playable links.

This task remains in `codex/interaction-first`. No new branch, mainline merge,
public deployment, package publication, wallet debit or user-account mutation.
Process artifacts: `.scratch/primm-five/`; visual/acceptance: `.devspace-visual/primm-five/`.
The guided-five material below is the previous Owner-reviewed baseline, not proof
that the new PRIMM experience is finished.

The native pilot uses `primm`, not a renamed list of V2 choice questions. The
first five now have revisions 8/6/6/4/5. The current recovery package is
`sha256:42447d9a23eeb4301ce1fcdc21eec0ffaa76470e622aa0205ba63bb2b290f716`.
Original evidence, image bytes and card/exercise identities remain; Make is a
new native explain exercise revision. A pinned real English audio sample was
added for actual transcription. The other 31 lessons remain byte-identical.
Native receipts are in `.scratch/primm-five/native/` and `corrections/native/`.

Writer preflight found Grok unauthenticated; the attempted Codex writer ran out
of credits. The host wrote and substantively fixed the pilot under the recorded
fallback rather than claiming the writer succeeded. Independent Gemini teaching
checks and 21 accepted bilingual local Flash polish batches are retained.
English browser testing caught a real semantic localization bug: translating a
Chinese example entirely into English made two cards identical but gave them
different correct buckets. A new revision keeps the Chinese learning material
and adds an English gloss. A separate Flash-polished revision also removes the
patronizing “一个球、一片灰” assumption from the photo scenario. UI copy was
polished independently; no old polishing receipt stands in for these changes.

The opt-in owner preview uses installed local Qwen3-VL through the existing
SwimmerAIKit transport seam and local Whisper through a bounded generator.
Source search fetches only the approved official NASA pages, not arbitrary web
search. No credentials, paid model endpoint or public unlimited executor were
created. HTTP binds loopback with exact Origin/Host checks, fixed model/assets,
one concurrent operation, cancellation, time/byte/token bounds and 100 explicit
commands per preview session. The production build does not enable this adapter.
The preview-only `university-primm-local` alias uses the committed Modelfile;
unrelated models and global settings were not changed. Thinking-only output is
rejected; tagged reasoning is never displayed or graded as the final result.

The first focused browser run is retained as 28 passes / three failures, not a
green run. Two failures exposed the English card issue; another exposed a late
scroll on reloading Modify. Stage focus now happens before paint. A screenshot
critic also found a stretched zoom crop; its size now derives from the original
image aspect and normalized region. Static after-operation screenshots did not
prove several claimed missing-button or pre-generated-result defects; ordered
captures and actual run receipts must be used for those decisions.

The task also removes the old settlement-route race: native progress/cards are
still recorded, but PRIMM's one ending returns to the map rather than navigating
to the legacy `/done` page. Normal saved-local UI is quiet only for this focused
surface; failed persistence still appears. The final acceptance remains pending
the full checks and stable live five-lesson walkthrough below.

`verify-r3.exit` is 0: the complete verification command passed on the PRIMM
implementation. Earlier `verify-first` and `verify-r2` failures remain recorded:
the standalone-game lab expected the new course orchestrator to be a standalone
game, and the delivery boundary misclassified Investigate's optional teaching
explanation as an independent assessment answer. The corrected boundary permits
only the exact explanation strings in a schema-valid PRIMM activity; negative
tests still reject hidden Make answers, rubrics, malformed objects and author
routes. The independent exercise's answers remain server-only. The final default
browser run has started with 335 cases; its log is not yet a passing receipt.

Real browser playback exposed an unrelated-to-decoding asset-serving problem:
the WAV bytes were valid, but the dev server sent an unknown-length binary stream,
so the native player exposed an infinite duration. Correct MIME and length now
give the real 11-second duration. Run always performs fresh ASR; later text edits
may reuse those actually recognized words for identical clip bytes. No canonical
written transcript is substituted for recognition. Model stability is still
under review: changing the parser of thinking weights did not make them genuine
instruct weights, and a later Make failed. The run is retained as failed while
the actual official instruct variant is prepared and retested.

### Current Owner correction: guided first five

The Owner rejected the first-five teaching experience after trying lesson one:
the opening promised AI image use but the first question tested photographer
provenance. Earlier technical acceptance is not acceptance of instructional quality.
Continue in this same worktree. Rewrite all first five as teacher-led useful AI
tasks, retain real sources, add concrete bridges before dependent questions and
examples, independently read the actual learner sequence, and run local Flash polish.
Evidence belongs in `.scratch/guided-five/` and `.devspace-visual/guided-five/`.
No mainline merge, publication, account writes, or further branch creation.

The shorter rewrite hit the importer's preservation guard because that guard
also froze every card/question's prose. The native recovery format versions the
whole lesson and deliberately omits individual card/exercise revision numbers.
Keep both verified immutable packages, lesson/unit identities, source and image
bytes, assessment identities/kinds and choice IDs intact; allow their teaching
wording to change only within a newer lesson revision. Add negative loss and
in-place-mutation tests rather than padding prose, editing generated byte counts,
or bypassing the shrink gate.

- [x] Rebuild beginner task progression and check preservation and source claims.
- [x] Independently review, fix, Flash-polish, then land five native revisions.
- [x] Walk all five in the real reader, correct remaining blockers and verify.

The resumed run landed revisions 6/4/5/3/4 for the first five, in their existing
order and IDs. Their new recovery package is
`sha256:0d272333dc8cc6f8b01d2ae97ae6391174611607568a4f25df48573bfc05869f`.
The native CLI receipt is `.scratch/guided-five/native/cli-receipts.json`.
The ordinary guarded importer rebuilt delivery content; the live/source audit
proves matching preview bytes, unchanged source/image records, retained assessment
IDs and 31 untouched other lessons. No generated course JSON was hand-edited.

All learner strings passed actual local `gemini-3.8-flash-high` / `high` polish.
The speech lesson's accepted pass retained its already clear wording. Repeated
malformed large JSON outputs for the other lessons were rejected, not repaired by
hand and relabelled accepted. Smaller same-key batches from that same local model
were losslessly assembled and passed the original whole-lesson frozen-token,
hedge and schema gates. Each aggregate receipt lists the actual part receipts.
The Codex draft, different-family teaching Detector and substantive host fixes
remain recorded separately; no model name in a configuration counts as a run.

Fresh two-width walkthroughs reached all 30 round instances, wrong/retry paths,
four preview states, request composition/copy and independent-exercise entry.
They revealed misleading success explanations on wrong attempts and dark selected
review text. V2 now shows the selected error explanation until the round passes,
and uses the kit's neutral secondary buttons for submitted reading material while
retaining selection/check/cross semantics. Actual descendant text colour, not just
the button's outer colour, is covered. The rewritten five are ready for Owner's
next hands-on trial, not claimed to be empirically proven teaching. The single
current walkthrough is `.devspace-visual/guided-five/owner-review-brief.md`;
earlier V1/V2 walkthroughs below remain historical evidence.

The interrupted default run finished at 312 passes and 22 failures; its receipt
is retained, not reported as a green full run. Nineteen failures caught an actual
one-frame ink transition: the submitted secondary button already had its reading
background while a descendant still painted its previous primary ink, even under
the global 0.01ms reduced-motion rule. The scoped answer/piece text now has no
transition property when submitted. `trace-choice.json` and
`trace-choice-after.json` preserve before/after frame samples in both themes;
every submitted after-frame has the intended reading colour. The original direct
colour assertions were not delayed, removed or weakened.

`resume-e2e.exit` is 0: all 30 related cases passed, including all five lessons in
both languages and both modes, and the unchanged avatar/accessibility cases.
The three map failures passed without changing their code, deadlines or matrix
assertions; this does not certify the absence of machine-load-sensitive flakes.
The last independent seven-image review (`closeout-critic.json`) found no new
blocker; mobile introductory scrolling remains an explicit later observation.
`verify-closeout.exit` is 0: the complete `VITEST_MAX_WORKERS=1 pnpm verify`
passed on the final product code. No source/assessment loss, softened browser
assertion, new worktree, mainline merge, push or publication was used to close
this correction. Any later Owner finding starts from this playable revision,
not from another draft or another branch.
`compatibility-e2e.exit` is also 0: 13 retained-V1, keyboard/responsive-workbench,
catalogue and prototype-lifecycle cases passed after the same final code.
All 22 originally failing case names are accounted for in
`reconciled-results.json`; it does not relabel the original full run as green.

### Previous V2 implementation baseline

- [x] Preserve both histories; merge current main and all Claude work; remove the redundant lane.
- [x] Amend V5 for visible real context, continuous tasks and truthful simulation.
- [x] Preflight Writer/fixer, Detector and mandatory Gemini Flash Polisher. Grok is unauthenticated; use the declared Codex fallback.
- [x] Upgrade canonical write-lesson and its affected references/checks to V2.
- [x] Extend the shared path with real context/materials and exhaustive experiment states.
- [x] Provide one native/prototype inventory with actual playable entries; discard rejected retro skin.
- [x] Write and independently review first five lessons, retain real sources and boundaries, actually polish with local Gemini Flash.
- [x] Land native isolated revisions/recovery exports and rebuild content without editing generated lessons.
- [x] Fresh browser and independent screenshot critique, wrong-state regressions, full verify and default E2E with recorded failure reconciliation.
- [x] Update the single owner walkthrough and prepare the verified experiment for one local commit.

Evidence for this continuation belongs in `.devspace-visual/interaction-v2/` and
draft/process receipts in `.scratch/interaction-v2/`. The three-sample receipts
below describe the earlier V1 baseline, not acceptance of the new V2 code.

### V2 native sample baseline

The first five lessons in `ai-literacy/understanding-ai/first-useful-step` are
`ask-about-a-picture` r5, `sound-words-and-meaning` r3, `name-the-result` r4,
`edit-one-part` r2 and `answer-or-search` r3. Their indexed local package is
`sha256:ba3dce42a0e3378be07d051c0f20a42f35c05698208821d08b0417eff779b38e`.
The earlier `follow-a-claim` V1 sample remains at its existing address.
Only native open-for-edit, five dry runs, five revisions, reactivation and recovery
export wrote course storage; the importer rebuilt the public files. Receipts:
`.scratch/interaction-v2/native/cli-receipts.json` and `landed.json`.

Writer provenance is per lesson, not the incomplete preflight summary: local
Codex completed four drafts; the active reasoning host wrote the photo draft
after that worker's credit failure and corrected the five reviewed drafts.
Independent local Gemini Flash detectors reviewed them. Local
`gemini-3.8-flash-high` actually polished all visible activity/context/material/
feedback strings, review prose, cards and independent questions in both languages.
Two first polish outputs failed (one added a technical term, one removed a year);
both entire outputs were rejected and retained, then freshly re-polished by Flash.
All five accepted outputs pass the native hedge gate, frozen numeric/source/marker
checks and the activity schema. Receipts and maps: `.scratch/interaction-v2/polish/`.
Choice positions were reordered without changing polished text, stable IDs or answers.

The playable directory contains 13 native kinds, six lesson entries, 20 short
research examples, eight game prototypes and three retained historical demos.
These 50 entries are not 50 production engines. Prototype language/keyboard limits
and the distinction between multi-stage structure and measured play duration are
visible. A common UIKit-token presentation removes rejected prototype skins;
no upstream kit release, remote publication or production account write occurred.

V2 implementation acceptance is complete; the experiment is ready for Owner
trial, not approved for mainline integration or production publication. Legacy tests now drive real choice
buttons where the question changed type; typed-answer recovery remains separately
covered. Contrast attack coverage follows the actual on-task photo and caption.
The new path suite exhausts every experiment combination and checks that changing
a good result to a bad one removes certification. No old V1 full-run receipt is
used as evidence that the V2 implementation passed.

### V2 acceptance corrections

The first inventory checks incorrectly assumed every prototype began with a
visible button and one fixed sample sentence. Paint/drag surfaces and randomized
orders now receive their actual contracts, with all 28 registered entries mounted
in both modes. The iframe host also no longer sends a terminal stop during a
connected StrictMode effect replay; a DOM regression proves stop only on removal.
Chrome's post-scroll child-frame hit surface was separately measured: failed
presses reached the parent iframe, not its button. The pointer helper now checks
actual child hover after motion plus both hit targets before pressing, without
DOM clicks or forcing. Eight fresh starts reached the button and started the game.
Pausing is tested with a real blocked pointer, a frozen clock and unchanged data;
resuming permits a real mutation. Original failures and event traces are retained
in `.devspace-visual/interaction-v2/acceptance/`.

An independent seven-image lesson critique confirmed the real context, sources,
simulation boundaries and separate assessment, and identified first-question
placement before the photo. The unchanged, Flash-polished introduction and real
photo now precede that question. Context and citation styling stays shared after
the move. The result's current heading also receives explicit end-of-path scroll
alignment; normal text scrolling past the sticky toolbar is not a blocked task.
The eight screenshots for the revised prototype presentation include actual
desktop and mobile browser layouts. These checks do not measure human enjoyment
or certify research games for automatic course authoring.

The follow-up critic found the fourth defense slot colliding with its footer.
The scene and reserved footer now grow together while preserving slot spacing.
Both desktop and mobile probes measure separation and open the actual fourth
slot; the independent matching-image critic returned `fixed`. The catalog
regression includes the same geometry and live operation assertions.

A fresh source audit proves all five revisions retain byte-identical asset data,
unchanged source evidence records, and the original card/exercise identities.
All 31 other lessons in the retained course package are unchanged. The visible
context/steps still require editorial judgment; `source-preservation.json` also
keeps each draft's fact-to-teaching-position map. Live preview bytes match this
worktree's five V2 revisions (`live-preview.json`).

The default run finished at 331 passes and three failures, not a clean green:
an unchanged map-motion bound (543.5ms against 540ms), a settlement return that
remained on the done route, and a dynamic reduced-motion matrix assertion.
The first two passed an unchanged focused rerun. The third reproduced, so it
was not dismissed as machine load: a passive state subscription/reset left a
pulsed matrix briefly visible after the preference changed. The existing shared
hook now uses React's [browser-API subscription contract](https://react.dev/reference/react/useSyncExternalStore)
and the two matrix resets use [layout effects](https://react.dev/reference/react/useLayoutEffect),
before another paint. No scene technique, geometry, timing bound or assertion
was relaxed. The hook has subscription/lifecycle coverage, and the original
two-mode browser check is repeated before final acceptance. Source/library rules
stay in their existing owners; this is a scoped regression fix, not a 3D redesign.
First failures, focused receipts and matrix evidence remain in the acceptance
folder. V2/native-choice and prototype tests are separately identifiable.

### Final V2 acceptance

All receipts are in `.devspace-visual/interaction-v2/acceptance/`:

- `verified-release.exit` is 0: the complete `VITEST_MAX_WORKERS=1 pnpm verify`
  passed after the final product code changes, including the motion fix.
- `focused-final.exit` is 0: 25 focused lesson/catalog browser cases passed.
- `default-e2e.log` preserves the original 331 passes / three failures. It is
  not rewritten as a clean 334-case run.
- `motion-e2e.exit` is 0: both original matrix tests passed three consecutive
  runs per mode, with their exact comparisons and deadlines unchanged.
- `final-regression-e2e.exit` is 0: all 19 final avatar, accessibility,
  catalog and three-layer-navigation cases passed. The two unchanged transient
  failures also passed here; motion before/restored screenshots and exact
  matrix receipts accompany the assertions.
- The independent source-order and defense-slot AfterCritics returned `fixed`.
  The scoped interface detector returned no findings. Source/asset preservation
  and exact served-preview identity are verified separately.

The sole Owner brief is `owner-review-brief.md` in that folder; its gallery and
five lesson links point to the retained preview on 23150. No background author
or repair task remains. Test services are owned and stopped by their runner;
the Owner preview remains available. Existing skill/V5/test owners hold the
reusable guidance; no parallel learning-summary document was created. Human
enjoyment, delayed transfer, conversion and physical-device feel are still
unmeasured. Those are not implied by technical acceptance.

The resumed cleanup also removed the unused detached DevSpace checkout
`University-318d9d1f`: its commit was already an ancestor of this experiment,
there were no modified, untracked or ignored files, and no process had its cwd
there. Removal used ordinary `git worktree remove`, without force. At that earlier
checkpoint main, Claude and this Codex worktree remained; V2 consolidated them.

## Steps

- [x] Inspect routers, recall, source isolation and native recovery contract.
- [x] Amend V5 before implementation; publish the schema handoff in
      `.scratch/interaction-path-schema.md`.
- [x] Add typed path validation, deterministic rules and generic fixtures.
- [x] Add shared accessible round UI and isolated in-memory attempt evidence.
- [x] Add opt-in authoring checks; prove native isolated round trip.
- [x] Run focused checks, real browser evidence, `pnpm verify`, default `pnpm e2e`.
- [x] Integrate three real bilingual samples through native revision, recovery
      export, reactivation and the guarded content importer.

## V1 delivery baseline (before the current V2 work)

Ready for Owner's hands-on review of the three samples, not a mainline or
production release. Continue in this worktree only. The default browser suite
passed all **305 tests** after the final renderer change; a fresh full
`VITEST_MAX_WORKERS=1 pnpm verify` then passed on the same product code, including
type checks, tests, builds, source freshness, activity solvability and governance.
The final logs and exit codes live in
`.devspace-visual/interaction-first/final-closeout/` (`default-e2e` and
`verify-after-critic`). Earlier failed receipts below remain historical evidence,
not unfinished assignments.

The retained preview at `http://127.0.0.1:23150` belongs to this worktree. Its
served course JSON was byte-compared with this checkout's generated file;
`live-preview.json` records the match and all three direct lesson URLs. The
owner-facing screenshot brief is
`.devspace-visual/interaction-first/consolidated/owner-review-brief.md`.
The original independent exercises remain separate; human enjoyment, delayed
retention, transfer and physical-device feel have not been measured.

Learning skipped -> the verified branch boundary, visual hierarchy and feedback
rules already belong to this plan, V5 and their regression tests; no parallel
learning document is needed.

## Design basis

Keep one task and a visible work product, rather than adding compulsory taps.
Duolingo's [chess-course account](https://blog.duolingo.com/chess-course/) describes
progression from guided puzzles toward independent play. The SDT authors'
[PENS overview](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)
identifies usable controls, clear feedback and meaningful choice as relevant to
players' need satisfaction. These are design references, not evidence that these
three lessons improve retention or outperform Duolingo. No PENS questionnaire
was imported or administered.

## Design and reuse

Inherit SwimmerUIKit buttons, panels and tokens; extend LearningActivity and
LessonReader. Reuse existing activity localization and recovery/export paths.
Existing contrast and repair engines assume different tasks and result shapes;
the bounded semantic-piece rubric needs its own small pure evaluator. No new
dependencies, model calls, progress backend or canvas text. The path is guided
practice; first attempts and help survive retry/reset within this reader visit.
Leaving the lesson, revision, locale or account discards this in-memory draft.

## Evidence and closeout

Evidence: `.devspace-visual/interaction-first/`. Command receipts and outstanding
issues are recorded here when checks finish. Original sources remain read-only;
native recovery writes only to the worktree's `.scratch/interaction-studies`.

### Review iteration R2

The recovered implementation was not accepted merely because files existed.
Independent Gemini Flash review (`acceptance-r2/detector.md`) identified a
repeated fifth question after the artifact, a contradictory “format undecided”
tail, repeated date-selection between samples, and unlabeled comparison drafts.
The revision removes those tails, distinguishes source selection from locating
an unsupported draft sentence, and starts the third artifact from a real
prefilled teaching draft. These are teaching designs over verified public
records, not transcripts of live AI calls.

The first fresh mobile pass found the one-control tool row wasting a second
line and feedback scrolling its next button off screen. The scoped layout
keeps the existing feedback-control safety lane, uses a one-row toolbar, shows
the photo once with optional recall, and scrolls feedback and next action
together. An activity-definition change also resets its state even when its
occurrence slot remains the same. The legacy reader and thirteen games remain.

Focused tests passed: 20 core-rule cases, 5 UI cases, and 2 native pipeline
cases. Full verification initially stopped at formatting of the new
`lesson-spine.d.mts`; that was corrected, not waived. Full final verification
and browser acceptance are recorded in the current delivery status above. A separate review
also caught a formatter damaging the old evidence-token examples in the
authoring skill; the original examples and unrelated formatting were restored.

The native revisions shortened only `understanding-ai` by 8,427 served bytes;
all five other course byte counts and package hashes were unchanged. The old
aggregate byte guard incorrectly called this missing source evidence. The
importer now checks each course independently and allows a shorter public-source
revision only after verifying both immutable package hashes, unchanged lesson
identities, increased changed-lesson revisions, and identical sources, assets,
cards and exercises. Missing packages, code-evidence shrink, removed material
or same-hash shrink still fail; growth elsewhere cannot conceal shrink. No
`--allow-shrink`, evidence-mode switch or manifest reset is used.

The focused browser suite passed all 13 cases (three real lessons, two modes,
two languages, plus package coverage). The first default full-suite attempt
caught a real test-contract mismatch: the shared settlement helper still
searched only for “我读完了”, while the interaction design explicitly names
the same confirmation “我学过这一版了”. The run was stopped after preserving
its failure log; both valid visible labels are now accepted, and that helper
opens the actual full explanation before confirming. Grading, settlement and
avatar-location assertions are unchanged. The authoring smoke uses the same
expanded wording. No browser-test timeout or learner completion rule was relaxed.

The full unit/integration run later exposed a separate existing profile test's
5-second execution deadline: its full UIKit badge wall took 3.372 seconds alone,
10.226 seconds in the full run, and 5.147 seconds in an app-suite recheck. Its
lazy avatar is replaced only in that DOM test; real browser coverage retains
the renderer. The two whole-profile DOM cases now have an explicit 15-second
execution budget, with every assertion retained. This is not a claim that the
product got faster, nor a change to a browser performance threshold. The whole
app suite then passed 58 files / 305 cases and its two baked-grid checks.

All unit suites passed in the next full run. Its later brand-token gate then
caught two legacy prototype references to the nonexistent `--game-ui-border`;
both now use the kit's real `--game-ui-border-subtle`. The gate was retained.

The independent visual reviewer actually read four fresh mobile screenshots
and reported no Owner-trial blocker (`acceptance-r2/visual-critic.md`). The
director separately completed the source-check/repair flow, copied its output,
and verified that its handoff focuses an empty independent-answer field. The
scoped interface detector returned no findings. These establish operability,
not human motivation, delayed retention, independent mastery or conversion.

## R2 sample baseline (preserved before consolidation)

The indexed local package is
`sha256:b5fc23c79d23c5e9a595a4e5d41eae6ced144e6f226cacfdc134ef4cde1c2fc6`.
All three lessons are in `ai-literacy/understanding-ai`, with four rounds each:

| Position | Lesson | Revision | Distinct end task |
| --- | --- | --- | --- |
| 1 | `first-useful-step/ask-about-a-picture` | 4 | Build a photo request with separate evidence checks |
| 3 | `first-useful-step/name-the-result` | 3 | Assemble an explicit historical information-card request |
| 19 | `check-what-matters/follow-a-claim` | 3 | Repair a prefilled caption, retaining verified facts and its source |

The full original explanations, source records, card IDs and independent
exercise IDs remain. Old three-character checks are not represented as a
rigorous transfer evaluation. Production publication and mainline integration
are not part of this experiment. The old `c9be...` package and scratch drafts
are historical evidence, not additional live courses or queued work. The optional
scratch image-deletion proposal was not applied; the accepted source-check
lesson remains revision 3, including its first-round image.

The retained delivery preview is `http://127.0.0.1:23150`; append
`/ai-literacy/understanding-ai/` and a lesson path from the table. Its listener
was verified to belong to this worktree, not main; recheck ownership on resume.

## Consolidated workbench continuation

The short-lived `codex/interaction-gameplay` lane extended the same three
samples: live editable artifact, stable toggled piece bank, optional reorder,
choice-specific visual feedback, a real image beside the final caption, and a
scoped mobile toolbar position for the existing feedback control. It fixed a
duplicate React key that could leave stale image disclosure controls. The
other lane's explicit CSS package export/import, real brand border token, and
statically discoverable translation keys are retained, not overwritten.

The two native isolated source corpora were byte-identical. Both source versions
are preserved by local checkpoint commits and an ignored reconciliation snapshot
under `.scratch/interaction-consolidation/`. The original R2 records remain in
`.devspace-visual/interaction-first/`; gameplay before/after images, independent
review and interrupted full-run logs are preserved in `.devspace-visual/gameplay/`.
Those old images identify their original worktree/port; merged acceptance needs
fresh captures from the retained checkout.

No earlier partial full run is accepted as a green regression. The interrupted
parallel run reached a heavily loaded Mac (load average above 230) and a world
geometry timeout. Rerun verification sequentially with `VITEST_MAX_WORKERS=1`,
which the installed runner supports, without raising assertions or deadlines.
The independent screenshot critic's breadcrumb clipping finding is fixed with
real text ellipsis. A scrolled-away page title is not evidence that the current
question or recovery button is blocked; validate their measured bounds instead.
The sound button is not TTS, and reorder is keyboard/button operation, not drag.
Human enjoyment, retention, transfer and conversion remain unmeasured.

Consolidation is complete at `bd30456a`: both checkpoint commits are ancestors
of `codex/interaction-first`; `codex/interaction-gameplay` and its worktree were
removed without force after source/evidence preservation. No mainline or Claude
branch files were edited. Future execution stays in this checkout.

After consolidation, the retained preview exposed dimmed answer text after a
wrong submission. These labels are still the material needed to understand the
feedback, so the scoped choice styles now preserve full reading colour while
remaining disabled. The browser regression compares that colour with the lesson
text. Unsupported-claim rounds now say “核对草稿”, not “找出依据”. The first
merged `pnpm verify` completed successfully with one Vitest worker; the final UI
delta and both-mode bilingual browser checks are recorded at closeout.


### Merged browser/visual continuation

The first merged focused run passed all 12 bilingual/mode sample flows and the
catalog check, but the three new viewport probes failed. `is-away` was still
hiding the feedback control after the entry scroll. Its reserved toolbar slot
now stays visible. The initial follow-up critic additionally found the old
768px float overlapping a choice, so all interaction-path widths now use the
same reserved toolbar position; ordinary lessons remain unchanged. Matching
768px before/after captures and the independent follow-up confirm closure.

The latest focused run passes 17 cases, including stable keyboard selection at
320/390/768/1440. A test locator was corrected to retain piece identity after
aria-pressed changes, without relaxing its focus or mutation assertions.
Evidence and the Owner-facing walkthrough are in
`.devspace-visual/interaction-first/consolidated/owner-review-brief.md`.
At this checkpoint the default browser suite was still outstanding; the current
delivery status above records its final result. No gameplay branch or second
source corpus remains to reconcile.

### Final compatibility pass

The saved default run finished with 296 passes and six failures, not a green
acceptance. Three failures expected prose-section progress on the new round
surface; one inspected optional media before the asynchronous reader mounted;
two looked for reading controls in the old toolbar instead of the expanded
explanation. The updated checks retain the actual behavioral requirements:
typing an answer cannot complete a guided round, source captions remain visible
with a real contrast-regression attack, and every reading control must fit and
be hit-testable. Ordinary lessons are now exercised alongside the interactive
sample in both modes rather than dropping their coverage. All eight focused
compatibility cases passed. Evidence is in
`.devspace-visual/interaction-first/final-closeout/`.

The director's fresh 390px dark-mode walkthrough actually submitted a wrong
judgment, recovered, selected the unsupported draft sentence, rejected the
incorrect initial artifact, removed only that clause, and copied the corrected
artifact. It did not submit the separate graded exercise or create a cloud
account. The guided work remains distinct from independent mastery.

The final independent seven-image review found one high-priority hierarchy
problem: the teaching/provenance note appeared under the draft heading, where
it could be mistaken for the draft itself. The material renderer now places
that unchanged note and original-source link before the heading, and the
heading leads directly into the selectable sentences. A new DOM assertion and
the bilingual browser flow guard this ordering. The six focused UI tests pass;
the independent same-viewport before/after critic returned `fixed`, and the
scoped interface detector returned no findings. The screenshots and both
critic verdicts are preserved in `final-closeout/` rather than replacing the
first review. Normal vertical scrolling remains intentional; the horizontally
scrollable breadcrumb preserves the existing current-lesson-first behavior.
