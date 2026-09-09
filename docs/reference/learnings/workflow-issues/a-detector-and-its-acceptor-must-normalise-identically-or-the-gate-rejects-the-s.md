---
id: REF-LEARNING-WORKFLOW-ISSUES-A-DETECTOR-AND-ITS-ACCEPTOR-MUST-NORMALISE-IDENTICALLY-OR-THE-GATE-REJECTS-THE-S
title: "A detector and its acceptor must normalise identically, or the gate rejects the shape it hunts for"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-09
last_reviewed: 2026-09-09
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

# A detector and its acceptor must normalise identically, or the gate rejects the shape it hunts for

## Guidance

check-proposal-shape.mjs analogy-order flags a term used before the analogy section without an inline explanation. definedTerms() deliberately matches only author-marked definitions, and one of the three shapes it matches is the bolded form (double-asterisk term, then a colon, then the explanation). That shape could never pass. definedTerms strips the asterisks to read the term, but the caller then runs indexOf(term) against the RAW text, landing the cursor on the closing asterisks, so hasInlineExplanation was handed asterisks-then-colon and its colon alternative never matched. The unbolded form passed all along. So the check rejected precisely the shape it was written to detect, and an author who wrote the definition correctly had two exits: unbold the term, or --skip-check. Fix: strip emphasis characters off both boundaries before testing, one line each side. Attack-tested both directions, which is what makes a loosening safe: (A) term used bare before the analogy and defined later stayed flagged before and after the fix; (B) term bolded with the explanation immediately after a colon went from flagged to ok. Generalise: when a gate has a DETECTOR deciding what counts as a violation candidate and an ACCEPTOR deciding what excuses it, both must normalise their input the same way. A mismatch surfaces as a false positive on exactly the well-formed case, which trains authors to reach for the skip flag and therefore silently disables the check. Symptom worth watching for: a gate whose failures cluster on your best-formatted content. After the fix, 9 of 10 course files went green with no content change, and the 3 findings remaining in the tenth were genuine and fixed in the prose.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
