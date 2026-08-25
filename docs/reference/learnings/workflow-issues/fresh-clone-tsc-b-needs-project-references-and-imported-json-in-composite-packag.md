---
id: REF-LEARNING-WORKFLOW-ISSUES-FRESH-CLONE-TSC-B-NEEDS-PROJECT-REFERENCES-AND-IMPORTED-JSON-IN-COMPOSITE-PACKAG
title: "Fresh-clone tsc -b needs project references and imported JSON in composite packages"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-25
last_reviewed: 2026-08-25
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

# Fresh-clone tsc -b needs project references and imported JSON in composite packages

## Guidance

Symptom: on a fresh clone, pnpm verify failed in packages/ui tsc -b with Module '@pieai/university-core' has no exported member errors because packages/core/dist did not exist and the package resolved through node_modules. Root cause: the UI project had no TypeScript project reference, so typecheck did not build core first. Verified fix: set packages/core tsconfig composite true, add packages/ui reference ../core, and make pnpm content build @pieai/university-core before importing courses. Composite validation then exposed TS6307 for packages/core/src/domain/url-evidence-hosts.json; include src/**/*.json in the core project. Prevention: test the UI typecheck with packages/core/dist temporarily absent and keep both the project reference and the explicit content build ordering.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
