---
id: REF-LEARNING-WORKFLOW-ISSUES-A-TYPE-LEVEL-GUARD-WRITTEN-IN-A-TEST-FILE-IS-NOT-A-WEAK-GUARD-IT-IS-NO-GUARD
title: "A type-level guard written in a test file is not a weak guard, it is no guard"
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

# A type-level guard written in a test file is not a weak guard, it is no guard

## Guidance

Symptom: a compile-time assertion added to hold two lists in sync passes unchanged when the thing it guards is deleted. Root cause, two independent causes stacked: packages/core/tsconfig.json (and its siblings) set exclude: [src/**/*.test.ts], so tsc -p never reads test files at all, and vitest transpiles with esbuild without typechecking — so nothing ever evaluates a type written there. Second cause, even in checked source a conditional type is not an error when it evaluates to never: 'type X = Exactly<A,B> extends true ? true : never' compiles silently whether the lists agree or not. Proven fix: put the guard in checked source beside the thing it guards, and make it violate a constraint — 'type AssertTrue<T extends true> = T; export type ActivityKindsAgree = AssertTrue<Exactly<z.infer<typeof KindSchema>, ActivityKind>>' now fails tsc with TS2344 in both directions. Prevention: attack-test every guard by deleting or corrupting what it protects and watching it go red before trusting it green — this one passed two separate mutations before the third attempt actually bit. Applies to any type-level invariant in this repo (schema enum versus engine union, exhaustive registries, DTO field lists).

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
