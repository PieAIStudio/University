---
id: REF-LEARNING-WORKFLOW-ISSUES-VERCEL-SOURCE-DEPLOY-MUST-SKIP-GIT-ONLY-PREPARE-HOOKS
title: "Vercel source deploy must skip Git-only prepare hooks"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-30
last_reviewed: 2026-08-30
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

# Vercel source deploy must skip Git-only prepare hooks

## Guidance

When a Vercel project has Root Directory apps/university-grading, deploy source from the repository root with explicit VERCEL_ORG_ID and VERCEL_PROJECT_ID; never use a prebuilt deploy from that subdirectory because the path can be resolved twice and ship no lambda. A root source deploy can then fail with fatal: not a git repository under /vercel when the workspace prepare hook runs lefthook install. The proven fix is the service vercel.json installCommand pnpm install --frozen-lockfile --ignore-scripts, followed by a preview vercel inspect that contains the literal lambda api/grade line before any production deploy. Apply to manual Vercel source deployments from pnpm workspaces with Git-only lifecycle hooks.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
