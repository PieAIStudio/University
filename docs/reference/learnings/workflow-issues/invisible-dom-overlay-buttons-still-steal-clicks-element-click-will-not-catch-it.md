---
id: REF-LEARNING-WORKFLOW-ISSUES-INVISIBLE-DOM-OVERLAY-BUTTONS-STILL-STEAL-CLICKS-ELEMENT-CLICK-WILL-NOT-CATCH-IT
title: "Invisible DOM overlay buttons still steal clicks; element.click() will not catch it"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-22
last_reviewed: 2026-08-24
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

# Invisible DOM overlay buttons still steal clicks; element.click() will not catch it

## Guidance

Opacity 0 (or --placed driving opacity) does not remove an element from hit-testing. A real pointer at the unit-strip button opened nothing while element.click() opened the card, because quiet lesson-title buttons over the canvas kept pointer-events:auto. The previous instance of this class was course names as aria-hidden divs with pointer-events:none, so the only way into a course was clicking a polygon. Fix: the overlay layer stays pointer-events:none; only visible, activatable controls (button.label.is-visible, and :focus-visible) take the pointer back; HUD chrome sits at a higher z-index. Tests must dispatch a pointer/mouse sequence at the element's screen position and hit-test first — a test that calls .click() on the button would have stayed green the entire time.

The same failure can happen with a visible, opaque shell rail: a full-bleed
`.app-shell__main` can report an enabled submit button while the rail physically
covers its screen coordinates. Reserve the rail and context-panel widths for
non-canvas DOM surfaces in the shared shell content wrapper; keep only the
world-map surface full-bleed. Recheck both shells after changing the chrome,
because a shared DOM component can still be hidden by shell geometry.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
