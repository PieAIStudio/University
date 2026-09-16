---
id: PLAN-INTERACTION-FIRST-EXPERIMENT
title: Interaction-first lesson experiment
type: plan
status: active
canonical: false
owner: ai-assisted
created: 2026-09-16
last_reviewed: 2026-09-16
domain: learning
tags:
  - lesson-reader
  - interaction
pinned: false
related:
  - SPEC-0001
---

# Interaction-first lesson experiment

## Scope

The sole worktree for this session is `.worktrees/interaction-first`, on
`codex/interaction-first`. Owner explicitly authorized consolidation of the two
Codex experiment branches. Local preservation commits and their merge are part
of that consolidation; no mainline merge, push, production publication or cloud
writes are authorized. Do not open another worktree for this lesson experiment.
Other sessions' branches, including `claude/interaction-research`, remain outside
this task. Course writes stay in the isolated authoring corpus.

The resumed cleanup also removed the unused detached DevSpace checkout
`University-318d9d1f`: its commit was already an ancestor of this experiment,
there were no modified, untracked or ignored files, and no process had its cwd
there. Removal used ordinary `git worktree remove`, without force. The repository
now contains main, the separate Claude lane, and this single Codex worktree.

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

## Current delivery status

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
