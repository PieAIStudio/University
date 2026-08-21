---
id: REF-LEARNING-WORKFLOW-ISSUES-EVIDENCE-WIKI-TOKENS-CANNOT-RENDER-AS-BLOCK-SOURCE-INSIDE-A-PARAGRAPH
title: "Evidence wiki tokens cannot render as block source inside a paragraph"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-21
last_reviewed: 2026-08-21
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

# Evidence wiki tokens cannot render as block source inside a paragraph

## Guidance

A resolved [[evidence:]] used to become EvidenceInlineSource (a div with a pre). Markdown wraps the token in a p, so the page emitted p>div>pre, which browsers repair by closing the paragraph early and silently regrouping nearby prose. The old fix was hoistEvidenceAnchors, splitting the paragraph around the token. Once the in-prose mark is an inline button that opens a shared side panel, the snippet lives in the panel, the button is valid phrasing content, and hoisting would wrongly split sentences. Adding a third kind of [[kind:target]] token does not need a new parser: parseLessonLinks is kind-agnostic; tokenKind plus a resolver that returns broken instead of throwing is the existing contract.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
