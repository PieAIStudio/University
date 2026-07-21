---
name: teach-from-study
description: Teach, quiz, explain, or review factual knowledge from a registered UniversityLocal study using fixed evidence, formal courses, UA tours, practice, or due cards. Use for study-backed lessons, knowledge questions, factual quizzes, course continuation, and weak-area review. Do not use when the user only wants to save a conversation as a note/card, receive communication feedback, create or repair a diagram, refresh a study, or perform ordinary engineering work.
---

# Teach From Study

Teach from fixed evidence and formal artifacts while keeping learner state separate.

## Start

1. Identify the study and intent: `UA tour`, `formal course`, `practice`, or `review`. Infer level from context; ask only if it changes the route.
2. Follow [session-and-evidence.md](references/session-and-evidence.md) to resolve config, reuse/start a session, and bind exact evidence. Never analyze the live source repository in place.

## Keep the four layers distinct

- Snapshot = evidence; UA graph/Tour = machine map; course artifacts = teaching content; progress/FSRS = private learner record.

Never present a UA Tour as an approved course. Never place course files or learner records in the studied repository.

## Teach

1. State objective/prerequisite; when prior knowledge exists, ask one retrieval or prediction question first.
2. Reveal progressively: `why → situation → concept → project evidence → boundaries/failures`, not repository-folder order.
3. Explain each accurate term in plain language on first use, then retain the real term.
4. Start with a concrete example. Use an analogy only when helpful and name where it breaks.
5. Mark facts versus inferences; cite snapshot, commit, path/lines, and UA bindings when used.
6. Give a small worked example, request application/teach-back, correct uncertainty honestly, and end with recap + next action.

Prefer one concept per lesson. For a useful insight, offer: “要把这个知识点保存成笔记和复习卡吗？” Invoke `knowledge-node` only after consent.

## Route helper skills only when needed

- Default to prose/list/table. Invoke `mermaid-diagrams` only on explicit request/repair or when 3+ meaningful entities are materially clearer as a diagram; prose must stand alone.
- Teaching owns factual accuracy. On requested rehearsal or expression feedback, verify against evidence first, then invoke `comm-coach`; never run both by default.
- Persistence is a separate, explicit `knowledge-node` step. Helper skills never save.

## Operating contracts

For content revisions, review state, session end, source changes, local-only safety, and donor intake, read [operating-contract.md](references/operating-contract.md). Use repository APIs; never hand-edit revisions, FSRS dates, or learner SQLite.
