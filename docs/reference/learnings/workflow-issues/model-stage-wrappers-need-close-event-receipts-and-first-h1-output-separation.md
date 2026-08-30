---
id: REF-LEARNING-WORKFLOW-ISSUES-MODEL-STAGE-WRAPPERS-NEED-CLOSE-EVENT-RECEIPTS-AND-FIRST-H1-OUTPUT-SEPARATION
title: "Model stage wrappers need close-event receipts and first-H1 output separation"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-30
last_reviewed: 2026-08-30
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

# Model stage wrappers need close-event receipts and first-H1 output separation

## Guidance

Symptom: a lesson model stage can report the wrong exit result under zsh, mix progress into the Markdown draft, and lose evidence from a transport retry. Root cause: a shell wrapper used a reserved status variable, treated combined stdout as final content, and kept no per-attempt transport receipt. Verified fix: spawn the provider directly with shell false, resolve from the child close event, split stdout at the first Markdown H1 while forwarding progress separately, and retain raw stdout, raw stderr, timeout/signal, exitCode, sessionResult, and retry metadata for every bounded Grok attempt. Prevention: keep model stages draft-only and make the structured receipt the postmortem seam before wiring them into the course revision workflow.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
