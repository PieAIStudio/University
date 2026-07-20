---
id: REF-UNIVERSITY-LOCAL-LEARNING-DONOR-MAP-2026-07-20
title: UniversityLocal Learning Donor Map 2026-07-20
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-07-20
last_reviewed: 2026-07-20
domain: architecture
tags:
  - donor-map
  - learning
  - open-source
  - pbmls
pinned: false
related:
  - ADR-0004
  - SPEC-0002
  - PLAN-0002
---

# UniversityLocal Learning Donor Map 2026-07-20

This map records pattern intake only. No donor source or asset is copied into
UniversityLocal by this decision.

## Promoted Now

| Capability | Donor evidence | Reuse class | UniversityLocal adaptation |
| --- | --- | --- | --- |
| Atomic conversation notes | Foam, MIT, active TypeScript project | pattern | One concept per Markdown note with stable identity; no VS Code runtime |
| Local content truth | SilverBullet, MIT, active local-first project | pattern | Markdown content is durable truth; indexes and review projections are derived |
| Spaced repetition | ts-fsrs 5.4.1, MIT | direct dependency | Keep one scheduler and its learning/relearning steps; no second relearn queue |
| Source presentation | Shiki, MIT, active TypeScript project | direct dependency candidate | Highlight bounded snippets read from immutable Git blobs, not live worktrees |
| Project map | Understand Anything 2.9.4 | direct tool plus adapter | Run only in UniversityLocal's isolated commit workspace and record exact engine provenance |

Primary sources:

- Foam: https://github.com/foambubble/foam
- SilverBullet: https://github.com/silverbulletmd/silverbullet
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
- Shiki: https://shiki.style/guide/ and https://shiki.style/guide/bundles
- Understand Anything: https://github.com/Egonex-AI/Understand-Anything

## PBMLS And PBMLS-old Pattern Intake

| Old idea | Decision | Corrected local form |
| --- | --- | --- |
| Try before reveal / prediction interceptor | promote | Persist the learner's real pre-reveal answer, time, optional confidence, hint use, content revision, and session |
| Output prediction | defer until the core loop has three owner sessions | Fixed evidence-bound snippet and normalized exact output; never keyword scoring or unknown-code execution |
| Micro-Parsons | defer until the core loop has three owner sessions | One-dimensional 4–8 block ordering, deterministic shuffle, accessible move controls and live feedback |
| Explain with rubric | defer until the core loop has three owner sessions | Reveal a human-authored rubric and persist self-check; do not invent an NLP grader |
| Wrong-item relearning | promote only through ts-fsrs | Preserve the real content ID and scheduler due time; never create `-relearn` pseudo cards |
| Evidence panel | promote | Read bounded context from the bound commit's regular Git blob |
| Prerequisite and interleaving ideas | research backlog | Respect course prerequisites and FSRS due order; require enough event data before recommendations |
| Heatmaps, streaks, confidence dashboards | reject for current phase | Do not display empty activity or fake precision as learning insight |

The second source pass confirmed why pattern intake is safer than code transfer:

- `PredictionInterceptor` had the right “answer before reveal” teaching move, but
  only enforced a minimum character count. UniversityLocal preserves the actual
  answer, duration, hint/confidence fields, content revision, idempotency key, and
  session before reveal.
- `MicroParsons` used `sort(() => Math.random() - 0.5)` and inferred an FSRS rating
  from move count. The interaction idea remains useful, but a future version must
  use deterministic shuffling, keyboard/live-region feedback, and an explicit
  learner rating.
- `EvidencePanel` exposed useful source context, but some evidence was a live URL,
  free-form quote, or embedded context string. UniversityLocal resolves a bounded
  regular Git blob from the exact commit and rejects symlinks, binary/oversized
  files, trees, and gitlinks.
- `ReviewPanel` still contained resource and micro-task stubs. UniversityLocal does
  not count placeholders as shipped capabilities or rebuild the surrounding
  Supabase/native-shell architecture.

The old implementations are not imported because they combine disconnected demo
components, browser-local truth, hand-written scheduling, weak keyword grading,
and unsafe or misleading heuristics. Useful teaching intent is reimplemented on
UniversityLocal's evidence, event, and accessibility contracts.

## Future Candidates

### Micro-Parsons interaction

- Parsons problem semantics: https://github.com/js-parsons/js-parsons and
  https://runestone.academy/ns/books/published/authorguide/directives/parsons.html
- Accessible ordering implementation candidate:
  https://github.com/atlassian/pragmatic-drag-and-drop
- Accessibility contract:
  https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines/
- Learning evidence: https://doi.org/10.1145/3501385.3543977 and
  https://doi.org/10.1145/3769994.3770032

The mature educational pattern is retained, but old jQuery-era donor code is not
a dependency. Direct drag-and-drop adoption requires a current version/license
pin and a complete keyboard alternative.

### Sandboxed execution

QuickJS Emscripten remains a research candidate only:
https://github.com/justjake/quickjs-emscripten. Its own security caveat and
pre-1.0 contract do not justify runtime code execution in the current phase.

## Rejected

- wholesale PBMLS or PBMLS-old transplantation;
- their hand-written FSRS variants and two-button inferred ratings;
- 30 percent keyword grading, random cloze deletion, and fake `-relearn` IDs;
- Gemini/Supabase integrations, sync queues, native shells, and account systems;
- H5P as an entire plugin platform for a small personal workflow;
- Logseq or Obsidian as a required runtime;
- Mem0, Letta, or LangMem as an invisible memory source of truth;
- Monaco, Sandpack, online judges, or direct `eval` for the first code questions;
- hard-coded streaks, empty heatmaps, and two-attempt “weak knowledge” labels.

## Revalidation Gate

Before promoting a deferred donor, update this map with an immutable release or
commit, current license, maintenance/security evidence, bundle/runtime cost,
accessibility proof, and one concrete UniversityLocal acceptance test.
