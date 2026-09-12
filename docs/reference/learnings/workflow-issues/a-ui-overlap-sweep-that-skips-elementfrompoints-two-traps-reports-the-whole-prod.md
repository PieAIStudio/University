---
id: REF-LEARNING-WORKFLOW-ISSUES-A-UI-OVERLAP-SWEEP-THAT-SKIPS-ELEMENTFROMPOINTS-TWO-TRAPS-REPORTS-THE-WHOLE-PROD
title: "A UI overlap sweep that skips elementFromPoint's two traps reports the whole product as broken"
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

# A UI overlap sweep that skips elementFromPoint's two traps reports the whole product as broken

## Guidance

Symptom: an automated 'is this control covered by something?' sweep across a component library reported 44 covered controls; every one was a false positive, and the sweep never found the real defect it was written to find.

Two traps, both cheap to fall into:

1. elementFromPoint(cx, cy) at a button's centre normally returns that button's own child (a <span> holding the label). That is correct nesting, not an overlap. The check must be 'is the hit inside this element's subtree' — el.contains(hit) || hit.contains(el) — not 'is the hit this exact element'. Without it, every labelled button in the product reports as covered.

2. elementFromPoint means nothing for a point outside the viewport; it does not report what is at y=935 on a 720-tall screen. A sweep that walks the whole DOM at one scroll position asks about mostly-offscreen coordinates and gets garbage. Either skip elements outside the viewport, or scroll each one to block:'center' first — and scrolling first is the better semantic anyway, because a fixed bottom bar covers something at every scroll position and the reader's real question is whether they can get to the control at all.

Verified: after adding both, the same sweep across 8 games x 3 tiers x 2 widths went from 44 findings (0 real) to 0 false positives and surfaced three genuine defects — a phone layout whose first pressable control was below the fold, touch targets at 22-40px against a documented 44px rule, and a nav row silently scrolling two entries out of view.

Prevention: when an agent or script reports a large uniform batch of UI findings, check the geometry of a few before acting. A finding class that fires on every instance of a common pattern is usually measuring the pattern, not a defect.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
