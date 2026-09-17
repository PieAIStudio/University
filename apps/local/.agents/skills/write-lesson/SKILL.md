---
name: write-lesson
description: Write or rewrite a real-source University lesson using the V2 material-first interactive teaching contract. Use when authoring a new lesson, rewriting a wall-of-conclusions lesson, reviewing lesson prose against the five variants, or when the user says 读不进去, 重写这节课, 重写课文, 改写成能读的, 太干, or 语气再循循善诱一些. Also use when beginner Chinese is vague, shorthand, jargon-heavy, or mixes literal explanation with analogy. Covers real-world material continuity, meaningful interaction, short explanations, changed-condition application, plain-language beginner scaffolding, literal-first explanations, clearly marked analogies, inline [[evidence:]] anchors, and cross-lesson links. It may be invoked by refresh-study for a stale lesson, but it is never the refresh entry point. Do not use for course/unit planning, card/exercise scheduling alone, UA analysis, refresh-study orchestration, knowledge-node saves, teach-from-study tutoring, or ordinary app engineering.
metadata:
  version: "2.0.0"
---

# Write a lesson — V2

Version 2 is the canonical authoring contract. One real-world material set supports
one useful learning task. The learner encounters real context, makes meaningful
choices, sees their consequences, receives short explanations, and tries a changed
condition. Preserve the five variants, not six compulsory screens or games.

V2 is an explicit new-revision choice, not a bulk migration. Existing ordinary
prose and V1 interaction revisions remain valid under their stored contracts.
Their historical heading rules live in the validator and Git history; they do not
force a new V2 lesson to become an article with games appended.

## Before writing

1. Read the project/module routers, current lesson, manifest and independent
   exercises. Record latest revision and every card, exercise, source and asset ID.
2. Run both CLI/model preflights in [models.md](references/models.md). Record the
   actual Writer/fixer, independent Detector and **Gemini Flash Polisher** before
   dispatch. Grok authentication failure selects the declared Codex fallback;
   it does not waive the separate Detector or Flash polish.
3. Read the actual cited primary sources or pinned code, not just source URLs.
   Follow [evidence-and-failures.md](references/evidence-and-failures.md) and
   [media.md](references/media.md). Source reachability is not support.
4. Write a small **material-preservation map** in the run receipt: original
   meaningful fact/context/boundary → first encounter, just-in-time explanation,
   or optional depth. Missing core facts require a reason and correction.
5. Choose the main learning action and [variant](references/variants.md), then
   its [interactions](references/activities.md). Brief the writer with what the
   learner already knows, what this lesson adds, and what not to re-explain.

## What cannot disappear

Every lesson uses real-world material: a real product/case, event, public record,
research, authorized image/recording/screenshot, reproducible observation or pinned
repository code. Main-path learners must encounter its identity and the context
that explains why this is worth learning. Keeping a link or original article in a
closed drawer alone does not preserve the experience.

Keep three things distinct: **source fact**, **teaching adaptation**, **observed AI
run**. A task over a real announcement may be designed for teaching. A fabricated
bad draft may illustrate an error only when clearly labelled a teaching draft;
never call it a transcript, quote or measured model failure. A deterministic
simulation is not a live AI call and does not prove that a prompt will work.

A real image cannot be replaced with a decorative approximation. Its credit, alt
text, source identity and historical date remain accessible. Do not hide rightful
credit to create an artificial guessing game; ask where the fact comes from.
The current task's necessary source excerpt stays nearby. Other material can be
reopened without losing the task. Do not force half a phone screen to stay fixed.

## Design the learning, not six boxes

Keep these responsibilities, combining them wherever the task supports it:

| Responsibility | Valid form |
| --- | --- |
| Encounter a real thing and a reason to use it | Real image/record/code plus a short, clear introduction; reading is allowed |
| Form a grounded first judgment | Prediction, comparison, selection or small attempt; no prior unfamiliar prerequisite |
| Understand what happened | Immediate result and explanation tied to the chosen misconception; not another compulsory game |
| Learn the method | Modify, compare, locate or repair the same material; a short worked example when needed |
| Apply with less help | Changed goal/input/condition, without preselected answers; not repetition of the revealed answer |
| Take away the method or result | Actual resulting artifact OR a justified decision plus a short recap; not a forced extra quiz |

The five variants govern learning needs; [variants.md](references/variants.md)
explains their boundaries. Do not impose a beat count, seconds-per-click, fixed
text ratio or compulsory standalone game at every responsibility. A few good
operations can span several responsibilities. Longer session games are usually
practice/consolidation choices, not mandatory additions to every small lesson.

A reveal button may guide observation but does not prove a judgment. Repeating a
skill with a different condition can be valuable; changing hand motion alone does
not create new learning. Content must still be understandable when help is closed.
Required background comes before the decision that needs it; extra detail comes
where the learner is likely to need it.

## Write for ordinary people

- Use **AI** to mean AI. Do not substitute 助手、助理、处理器 or vague “它” when
  the referent is unclear. Actual human volunteers remain human volunteers.
- Name the visible object: “NASA 的照片记录”“你的请求”“改后的文字”. Avoid
  “前者”“形成闭环”“证据链路”“交付物” when “前一种”“检查一遍”“来源”“要做的东西” works.
- Say what to do, to what, and what change to inspect. Do not write “操作材料”“完成
  校准” and expect a beginner to infer the action. Use labels rather than 左边/上面
  when responsive layout can move them.
- Short, complete sentences. Keep necessary context, facts and uncertainty; remove
  repeated explanations, not meaningful source material. Speak to “你”.
- Explain literally first. Mark a useful analogy as an analogy; it cannot supply
  factual evidence. Never “显然”“众所周知” or blame the user for needing help.
- Do not call blind clicking “你自己查出来的”. Do not call feedback exposure “你会了”.
  Describe observed practice accurately and leave mastery to independent evidence.

## Payload and single producer

Use existing `LessonActivitySchema` kind `interaction-path` with
`pedagogyVersion: 2`; see the typed schema and the shared component contract.
It holds the visible real-world context, named source materials and a bounded
sequence of `decision`, `evidence`, `assemble` and `experiment` actions. A lesson
has one path, not several incompatible embedded course engines.

The first release supports boolean experiment controls, each with an explicit
result for **every** combination. Every combination's text, feedback and current
accepted status must agree. No “all toggles on” shortcut unless all are truly
needed; include meaningful alternative or boundary conditions. Prior visits do
not make a wrong current result correct. Never invent numeric budgets or physical
mechanisms simply to fit a game engine.

The reader's main path uses those same authored fields. `content.md` remains a
coherent optional review: question title, concise connected explanation, all
source links, meaningful optional details, and exactly one `::play{#path-id}`.
Do not reproduce all the path's questions and answers in a second course script.
Do not hand-copy studied repository code into fences; use `[[evidence:path:lines]]`
covered by the snapshot. Cross-lesson links remain bounded and target real lessons.

All learner text has the supported locale versions, including context, materials,
choices, feedback, source limits, cards and exercises. Translation must not alter
rules, identifiers, dates, qualifiers, answer meaning or evidence bindings.

## Independent exercise and cards

Use [cards-and-exercises.md](references/cards-and-exercises.md). Existing IDs
remain stable. A guided path never silently marks an independent exercise passed
or a revision learned. A last guided transfer round is still guided evidence;
keep the structured independent exercise and the real completion/confirmation
pipeline. Do not add a duplicate verbal quiz merely to recheck an identical task.

Choose assessment by the required act: a supported native choice for a bounded
choice, a short answer for a genuinely short result, an explain rubric when the
learner must explain. Never make someone type an option solely because the storage
union cannot represent a choice. Land a needed native capability or report its
concrete missing boundary, rather than disguising it with a hidden textarea.

## Writer → Detector → fix → Gemini Flash polish

Follow [pipeline.md](references/pipeline.md), keeping model roles distinct.
Inline the relevant contract, exact facts and source mapping in model briefs;
forbid broad file exploration for draft-only stages. Structured activity/card
output uses direct JSON calls, not an H1-only Markdown parser.

The Detector names concrete beginner/correctness/material-loss problems, without
rewriting. The Writer fixes substantive content first. **Then actually call the
local Gemini Flash Polisher** on all learner-facing wording, not just the hidden
review prose. Use [polish-prompt.md](references/polish-prompt.md).

Freeze IDs, URLs, numeric facts, rules, booleans, option sets, source/asset mapping
and locale structure. Compare before/after strings for lost qualifiers, new
absolutes, terminology/meaning changes, and vanished real-world context. Run
`check-lesson-hedges.mjs` plus the schema, source-preservation and shape checks.
If polish changes facts or logic, reject that output. Do not silently hand-repair
a compromised polish and claim it was accepted. Keep the raw output and decision.

## Acceptance and landing

Walk [checklist.md](references/checklist.md). Validate schema/references and every
experiment combination. Actually try wrong choices, hints, correction, changed
conditions, copy/hand-off and mobile/keyboard. Read fresh screenshots; successful
builds alone do not prove a good lesson. Do not report AI-simulated reactions as
human enjoyment, transfer, retention or revenue.

Land only through native course CLI: open-for-edit, revise dry-run/apply, recovery
export/reactivation, guarded importer. Read current CLI help; never guess flags.
Existing revision bytes are immutable; same IDs get new revisions. Publishing is
separate and not granted by this skill. Do not write generated delivery JSON.

The report records: selected variant and reason, preservation map, all changed
IDs/revisions, native receipts, actual model preflights/roles/efforts, raw polish
and acceptance, focused/full checks, browser evidence and concrete remaining
limitations. Already valid lessons do not need revisions merely to churn words.
