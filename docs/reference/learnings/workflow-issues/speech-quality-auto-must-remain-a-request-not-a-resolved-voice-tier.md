---
id: REF-LEARNING-WORKFLOW-ISSUES-SPEECH-QUALITY-AUTO-MUST-REMAIN-A-REQUEST-NOT-A-RESOLVED-VOICE-TIER
title: "Speech quality auto must remain a request, not a resolved voice tier"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-26
last_reviewed: 2026-08-26
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

# Speech quality auto must remain a request, not a resolved voice tier

## Guidance

When Web Speech exposes cloud voices, use localService only to classify local versus online after the shared novelty blacklist and ranking; the payload, not the transport, determines the privacy boundary. Persist auto in account preferences and resolve premium, then online, then local at read time because device capabilities and paid entitlement can change. Manual choices may only fall downward and must explain fallback. Apply this in the shared authoring and delivery speech path.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
