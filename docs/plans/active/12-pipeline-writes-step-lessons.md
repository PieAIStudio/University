---
id: PLAN-12-PIPELINE-STEP-LESSONS
title: "12 · The production line writes version-3 step lessons"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-02
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

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`. Queue rules are in
  [the work queue](../../reference/execution/work-queue.md).
- Depends on: none. This task is independent of `11-`, `13-` and `14-`.
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
- If the Owner has not read it yet, commit the line's changes, keep this task in
  `active/` with "awaiting the Owner's reading", and step over it.

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
- The Owner's verdict, verbatim.
- Failure classes the detector found that the contract does not name yet, as
  candidates for the next rule change.
