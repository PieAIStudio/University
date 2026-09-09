---
id: REF-LEARNING-WORKFLOW-ISSUES-A-STRIPPING-REGEX-DECIDES-WHAT-A-GATE-CAN-SEE-SO-BOUND-IT-TO-A-LINE
title: "A stripping regex decides what a gate can see, so bound it to a line"
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

# A stripping regex decides what a gate can see, so bound it to a line

## Guidance

check-verbatim.mjs normalised source with .replace(/`[^`]*`/g,' ') to drop inline code. Because that pattern crosses newlines, a single unpaired backtick in the source pairs with the next one thousands of lines away and deletes everything between. Against datawhalechina/easy-vibe one such span was 129,021 characters; the gate compared the proposal against 213k of the source's 948k Chinese characters and reported '0 longest verbatim run, 0.0% overlap'. Attack test: injecting 124 characters copied verbatim out of the swallowed region made the old gate print the pass line while the fixed gate reported a 115-character verbatim run. Fix is /`[^`\\n]*`/g, which is also what Markdown means by inline code; coverage went 213k -> 563k Han, the remainder being fenced code that is deliberately excluded. Generalise: whenever a gate normalises input before comparing, the stripping step silently sets the gate's field of view, so measure how much input survives normalisation and attack-test with material taken from the part that gets stripped. A gate that quietly stops reading is worse than no gate because its number gets quoted in a commit message. Re-checked the previously landed ai-for-kids course with the fixed script: numbers identical (28 chars, 0.7%), because its English source had no unpaired backticks - so verify blast radius rather than assuming past results are also wrong.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
