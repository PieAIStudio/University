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

Update 2026-09-09, from a second wrapper that hit this: "split at the first
Markdown H1" is right, but **do not anchor the split to a line start**. Grok
returned 385 characters of progress narration glued to the front of the title on
one line, so a `/^# /m` search found nothing and the stage produced an empty
draft while exiting zero. Match the first single `#` heading wherever it sits
(`/(?<!#)# (?!#)/`) and never a `##` section. Two further traps in the same
wrapper, both silent: a prompt path passed relative while the child ran with a
different `cwd`, so the model read nothing; and zsh not word-splitting an
unquoted variable, so a `set -- $spec` loop passed an empty second argument to
three dispatches in a row. In all three the process exited zero — read the
error text, never the exit code.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
