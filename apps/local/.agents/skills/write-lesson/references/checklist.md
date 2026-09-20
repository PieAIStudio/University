# Acceptance checklist — PRIMM and retained revisions

Use all applicable checks. `[machine]` needs an actual validator/test; `[judgment]`
needs a reader inspecting materials and the rendered path; `[process]` needs a
receipt. A regex cannot certify truth, clarity, fun, transfer or retention.

## Complete PRIMM (current)

The teaching rules are in [teaching-contract.md](teaching-contract.md); its F1–F15
table is the judgment checklist. These are the acceptance items around it.

- [judgment] The plan lists ≥5 real moments with elimination answers; practice and Make use different surviving moments; material fits the moment (F1).
- [judgment] The real case proves real use in plain words, then hands over to the learner's life; nothing later drills or examines the case (F2).
- [judgment] Read the teacher's lines in order (contract §3): one small job, each screen continuing from the last action, no line reusable in another lesson unchanged.
- [judgment] Reading level: an 8–9-year-old can read every sentence; no designer vocabulary or unexplained product names (F7, F9); adult content and tone (F13).
- [machine] `run.debrief`, `modify.debrief` present; the UI shows them only after an actual result, and `investigate.explanation` only after the operation.
- [judgment] Debriefs stay true for any plausible live output (F10); checked against at least one real sample run.
- [judgment] Predict targets a genuine beginner uncertainty and cannot be answered by reading the request (F3).
- [judgment] Investigate operates on this run's material, result or the gap between them; cards and choices do not print their answers (F5, F15).
- [machine] Native `primm` payload has all five phases, valid references, a bound explain exercise, different Make material, `experienceVersion: 2` operations.
- [process] Run executes the exact prepared input; Modify executes the visible edited input; unavailable/replay/live never conflated.
- [judgment] Make changes material and purpose; checklist and placeholder guide without giving the answer (F11).
- [machine] Practice material text sent to AI has no practice/fiction meta-note (F12).
- [process] Writer, different-family Detector, fixes with resolutions, actual Flash polish and translation receipts; every hand edit logged with the pipeline's `note`.
- [machine] Only current phase visible; no per-round sources, early exercise, read-confirm ritual, diagnostic receipt or next-lesson shortcut.
- [machine + judgment] Localization preserves the distinctions being taught; same visible card text never has conflicting answers.
- [machine] Async results and drafts isolated by account/lesson/revision; exit/cancel/retry/idempotency preserve actual work and evidence.
- [process] All five phases played in the real product on desktop and phone width, with keyboard, wrong prediction, failure/retry and exit/resume; screenshots inspected.
- [machine] Every locale the lesson ships carries a judgeable exercise: `planCheckpoint(localizeLearnerContent(lessons, locale)).unavailable` is empty in zh-CN and in en. A lesson assessable in one language only drops out of its block's checkpoint in the other, and the learner is told "not assessed yet" for work they did; four of `understanding-ai`'s twelve blocks were already in that state in English.
- [machine] At 320px the first choice of the first round is fully in view in **every** locale, not only Chinese. The same round runs about a hundred pixels longer in English, and the breadcrumb above it is the approved way out of a lesson, so it cannot give the space back: the copy has to fit.
- [judgment] The chosen Investigate act still meets its own precondition in the contract's table **in each locale**. `check-result` needs material this learner can actually read; a recording in a language they do not speak leaves them guessing, and the same lesson can satisfy the rule in one language and break it in another.
- [process] For a batch: record per lesson which parts the line produced unaided and which a person changed.

The V2-specific items below apply only to retained V2 revisions. Shared source,
truth, language, preservation and runtime checks continue to apply to PRIMM.

## Real material and learning

- [judgment] One useful core question and one learning action, not a list of topics.
- [process] Original lesson, latest revision, sources/assets/cards/exercises read.
- [process] Source primary content or pinned code actually inspected; no invented citation.
- [judgment] Preservation map accounts for every meaningful original fact/context/boundary.
- [judgment] Main path encounters a real application/event/material, not just an optional link.
- [judgment] Required context precedes the action; no unknown term is needed to guess.
- [judgment] Real material, teaching draft, simulated output and observed run are distinct.
- [machine] Images resolve to retained actual asset IDs/bytes, alt text and credits.
- [judgment] No fake image/code/quotation replaces an available real source.
- [judgment] Historical dates, event dates and publication dates are not mixed.
- [judgment] The source is relevant to the actual claim, not merely authoritative.

## Teaching and operations

- [judgment] Opening quickly reaches the beginner's intended AI use; a short case may precede it, but institutional history or citation trivia must not replace the purpose.
- [judgment] Title, opening task and first actionable question make the same promise; no unrelated first quiz.
- [judgment] Each new task has a concrete bridge before the question; needed examples are visible before the dependent choice.
- [judgment] A reader can follow the rendered sequence without teacher notes or an answer key; each operation advances useful AI use.
- [judgment] A boundary check is introduced by a practical need, not used as a substitute for teaching the actual skill.
- [machine] Valid five-variant name and explicit V2 path; a single path marker.
- [judgment] Prediction/feedback/practice/transfer/recap responsibilities fulfilled, not six obligatory games.
- [judgment] Different rounds advance the same task; objects retain names and useful continuity.
- [judgment] Explanations answer the actual action/misconception, not generic praise.
- [judgment] Reveal-only actions called observation, not independent understanding.
- [machine] Every source/material/asset reference resolves; URLs safe and evidence-backed.
- [machine] Experiment has all distinct 2^N combinations and no unknown controls.
- [judgment] Every experiment combination's output/feedback fits the selected conditions.
- [machine] A visited valid state cannot make a currently invalid state pass.
- [judgment] Selection does not reveal the answer prematurely through colour, placement or shape.
- [judgment] `决策` includes changed constraints/reverse choice; `术语` includes boundaries.
- [judgment] End condition applies the core idea to a new input/goal/condition without hints.
- [machine] Guided completion never sets independent exercise or learned-revision flags.
- [judgment] Recap is actual artifact/method, not unsupported “you mastered it”.

## Plain language and locales

- [machine] No 助手/助理 used as an AI alias in the new teaching text; human roles/quoted proper names reviewed separately.
- [judgment] Names and instructions understandable by ordinary adults without the author present.
- [judgment] Labels, not ambiguous left/right or it/that; complete short sentences.
- [judgment] Literal explanation before any marked analogy; no unexplained terminology chain.
- [machine] Every displayed string translated; rules/IDs/dates unchanged across locale.
- [judgment] No lost uncertainty, invented guarantees, current-availability or productivity claims.

## Independent assessment and revision

- [machine] Every existing card/exercise ID preserved in a new revision.
- [judgment] Independent task changes the condition; genuine choices do not demand hand-copying.
- [judgment] Distractors are credible mistakes, each feedback explains why; no guessing cues.
- [judgment] Card fronts concise (normally ≤40 Chinese characters), backs standalone (normally ≤120).
- [process] Writer, different-family Detector, substantive correction, actual Gemini Flash polish.
- [machine] Frozen IDs/URLs/rules/source bindings/numeric facts survive polish; hedge and shape gates pass.
- [process] Failed polish retained/rejected honestly, not hand-edited and relabelled accepted.
- [process] Native revise dry-run/apply, recovery/export/reactivation and guarded import receipts.
- [machine] Old revision bytes unchanged; source freshness and non-target package checks pass.

## Real browser acceptance

- [process] Correct worktree/server ownership and fresh route/content verified.
- [process] First action, wrong/retry, hint, current-state change, result, independent handoff actually operated.
- [process] Desktop and phone layouts, touch-sized controls, keyboard focus and reduced motion inspected.
- [machine] No horizontal overflow or blocked controls; source media and context render.
- [process] Independent visual critique checks screenshots, not merely test exit codes.
- [process] Focused tests, `pnpm verify`, default E2E have real receipts; no waived assertions.

## Compatibility

For non-V2 revisions use their existing schema/spine validator without changing
stored bytes. Legacy fixed headings and detail ratios do not apply to V2 merely
because their text is carried in the optional review. Keep the review coherent,
with complete original source links, but do not manufacture long detail blocks to
satisfy a ratio designed for a prose-first course.
