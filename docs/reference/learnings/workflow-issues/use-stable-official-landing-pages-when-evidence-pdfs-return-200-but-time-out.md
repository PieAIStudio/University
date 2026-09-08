---
id: REF-LEARNING-WORKFLOW-ISSUES-USE-STABLE-OFFICIAL-LANDING-PAGES-WHEN-EVIDENCE-PDFS-RETURN-200-BUT-TIME-OUT
title: "Use stable official landing pages when evidence PDFs return 200 but time out"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-09-08
last_reviewed: 2026-09-08
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

# Use stable official landing pages when evidence PDFs return 200 but time out

## Guidance

When adding course evidence, a large official PDF can make curl or check-adoption --verify-urls show HTTP 200 but exit 28 after a transfer timeout, so the URL is not reliably verifiable. If the claim is also documented on an official HTML page, use that page as sourceUrl, keep sourceTitle and note scoped to what it supports, curl the replacement, then rerun the adoption, verbatim, shape, and dry-run gates. Apply this to every new course proposal with verified evidence URLs.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
