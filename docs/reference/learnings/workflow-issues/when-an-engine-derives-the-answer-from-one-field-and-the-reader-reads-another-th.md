---
id: REF-LEARNING-WORKFLOW-ISSUES-WHEN-AN-ENGINE-DERIVES-THE-ANSWER-FROM-ONE-FIELD-AND-THE-READER-READS-ANOTHER-TH
title: "When an engine derives the answer from one field and the reader reads another, they can disagree"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-10
last_reviewed: 2026-09-10
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "PGS learning capture"
capture_mode: pgs-native
---

# When an engine derives the answer from one field and the reader reads another, they can disagree

## Guidance

Symptom: a contrast board's case 「把第一家的安装命令原样贴给第二家」 was scored 分开 while its own explanation opened 「两边都提醒你不要混用安装行」. A reader who read that sentence and predicted 同 was reading correctly and was marked wrong. Every gate was green: isValidContrastActivity passed, the prose referenced the board, the citation was real, lint-lessons was clean. Root cause: contrastCaseAgrees derives 同/分开 by comparing the two outcome strings after whitespace normalisation, so agreement is a fact about outcomes[a] === outcomes[b]. The 'why' field is free prose written separately, and nothing ties the two together. An author who writes two differently-worded sentences that mean the same thing produces a case the engine calls 分开 and the reader calls 同 — the payload is valid and the board is the right game for the lesson; only the content contradicts itself. This is not the same defect as an activity being the wrong game (see 'An activity can pass every engine check and still be the wrong game for the lesson'), and it is not detectable by a keyword rule: 「两边都…」 in a 分开 case is sometimes legitimate. Verified fix: the case also duplicated the point of the case two rows above, so it was removed rather than reworded; three cases still satisfy the engine's 'at least one agree and one disagree' rule, and every other board on the shelf has three. Guidance: whenever an engine derives a verdict from data rather than reading a declared answer, dump every item as 'derived verdict + the author's explanation' side by side and read the pairs. That sweep over 17 contrast cases, 3 weigh boards and 7 sort boards took minutes and found exactly one contradiction. Do it once per batch of authored payloads; the cost scales with items, not with kinds.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
