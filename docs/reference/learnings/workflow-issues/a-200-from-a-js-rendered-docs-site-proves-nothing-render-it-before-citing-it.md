---
id: REF-LEARNING-WORKFLOW-ISSUES-A-200-FROM-A-JS-RENDERED-DOCS-SITE-PROVES-NOTHING-RENDER-IT-BEFORE-CITING-IT
title: "A 200 from a JS-rendered docs site proves nothing; render it before citing it"
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

# A 200 from a JS-rendered docs site proves nothing; render it before citing it

## Guidance

While sourcing a general course, developer.apple.com/design/human-interface-guidelines/* returned HTTP 200 and looked like an ideal authority, but WebFetch came back with the page title and no body: Apple ships the HIG as a client-rendered SPA. The citation would have passed check-adoption --verify-urls, which only performs an HTTP request, so the gate would have been green over a page nobody had read. Fix: open it with the browser tools (navigate then get_page_text), which returned the full guidance and yielded quotable lines such as the statement that ideally people understand an app simply by experiencing it, and that instructional content referring to a specific interface area should be displayed near that area. Generalise three ways. (1) HTTP 200 says a server answered, not that a human-readable claim exists at that URL; treat empty or title-only WebFetch output as UNVERIFIED, never as verified. (2) The failure is silent and asymmetric: static doc sites (MDN, git-scm, npm, Stripe, Vercel, Supabase, PostgreSQL, Design Council, NN/g) all read fine through WebFetch, so a single SPA-based host hides among dozens of readable ones and only shows up if you notice the body is missing. (3) Record per-host verification requirements in the course's SOURCES.md so the next author does not rediscover it. Related failure mode already recorded: a live URL is not a supported claim. In the same pass a plausible nngroup.com/articles/jobs-to-be-done/ URL 404'd and a Design Council page turned out not to discuss the topic a planned lesson needed, so that lesson was dropped rather than sourced loosely.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
