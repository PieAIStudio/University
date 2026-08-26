---
id: REF-LEARNING-WORKFLOW-ISSUES-KEEP-CANONICAL-HASHING-SEPARATE-FROM-OPTIONAL-VALUE-COMPARISON
title: "Keep canonical hashing separate from optional-value comparison"
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

# Keep canonical hashing separate from optional-value comparison

## Guidance

Verified in apps/local/server/storage/serialization.ts and content/evidence.ts: canonicalJson feeds sha256 identity bytes, so a top-level value without a JSON representation must throw TypeError instead of receiving a fabricated identity. Callers comparing values that may be absent must handle the missing side explicitly before canonicalizing; otherwise a disappeared target node can throw instead of being reported stale. Apply this split whenever one canonical serializer serves both hashing and semantic comparison.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
