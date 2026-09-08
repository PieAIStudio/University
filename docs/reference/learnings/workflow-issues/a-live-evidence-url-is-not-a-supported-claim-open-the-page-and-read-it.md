---
id: REF-LEARNING-WORKFLOW-ISSUES-A-LIVE-EVIDENCE-URL-IS-NOT-A-SUPPORTED-CLAIM-OPEN-THE-PAGE-AND-READ-IT
title: "A live evidence URL is not a supported claim; open the page and read it"
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

# A live evidence URL is not a supported claim; open the page and read it

## Guidance

check-adoption --verify-urls only proves the URL answers. It cannot prove the page supports the sentence it is cited for, so an AI-written course passes every automated gate while carrying false citations. Three real failures found in one AI course, all green under --verify-urls: (1) a NIST COMPETE Act page cited for 'two AI winters in the 1970s and 1990s' never mentions AI winters at all; (2) a NIST manufacturing-project page cited for the symbolic-vs-neural split does contain the words 'top-down and bottom-up strategies', but about how that research project is organised, not about schools of AI — keyword match, not claim match, which a human skim also passes; (3) a seminar announcement cited for the Turing test does define it in one sentence, so it is weak rather than false. Two citations that looked equally suspicious were correct: a TensorFlow blog post matched its note sentence for sentence, and NIST AMS 100-75 states in Table 1 'Narrow (Weak) AI: Task-specific' vs 'General AI (Strong AI): Human-level intelligence', plus 'Knowledge-based AIs are rule-based systems that utilize logic and reasoning ... predominantly symbolic AI'. WebFetch returned that PDF as unreadable; pdftotext extracted it fine, so a PDF that a fetch tool cannot read must be extracted locally before being judged false. Practice: for every evidence entry whose note asserts a conceptual or historical fact — definitions, taxonomies, dates, named schools of thought — open the page and confirm the sentence, and prefer replacing a wrong citation with one already verified elsewhere in the same proposal over hunting for a new link. Highest risk hosts are seminar or programme announcement pages and PDFs; lowest are API reference and tutorial pages, which documented what they were cited for in every case checked.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
