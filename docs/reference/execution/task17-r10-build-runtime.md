---
id: REF-TASK17-R10-BUILD-RUNTIME
title: Task 17 R10 Build and Runtime Budgets
type: reference
status: active
canonical: true
owner: ai-assisted
created: 2026-10-05
last_reviewed: 2026-10-05
domain: execution
tags:
  - task-17/r10/build
  - runtime-budget
related:
  - PLAN-17-DEEP-REFACTOR
  - REF-CURRENT-WORK
  - REF-WORK-QUEUE
---

# Task 17 R10: build and runtime budgets

## Evidence

The delivery build was run with the chunk census enabled after the R9 commit:

```text
ANALYZE=1 pnpm --filter @pieai/university-app exec vite build --mode delivery
```

The raw receipt is `.scratch/overnight-20261003/task17-r10-vite-build.log` and
the module census is `SCRATCH/chunk-modules.json`. The delivery output contains
600 files and 26,680,979 bytes (25.44 MiB). JavaScript is 12,122,628 bytes,
CSS is 525,705 bytes, and copied content is 118,893 bytes. JavaScript and CSS
together are 11.26 MiB raw and 3.08 MiB gzip. The largest emitted assets are:

| Asset | Raw bytes | Gzip bytes | Why it is loaded |
| --- | ---: | ---: | --- |
| `catalogue-*.js` | 1,529,121 | 480,506 | The 281-entry concept bodies used by the lazy library, concept-entry and settlement routes |
| `WorldAppearance-*.js` | 906,128 | 240,380 | Shared procedural world appearance for the map surface |
| `Maps-*.js` | 812,731 | 182,252 | The map projection, lesson placement and map interaction surface |
| `chunk-KEIR6QF5-*.js` | 662,084 | 141,692 | Mermaid parser used by authored diagrams |
| `index-*.js` | 551,568 | 174,250 | Application entry and shared route composition |
| `i18n-*.js` | 542,267 | 165,700 | The two learner interface catalogues and ICU parser |
| `index-*.css` | 510,388 | 85,340 | Shared learner shell and route styles |

The census shows the first three large chunks are route or map dependencies;
none is an unused import that can be removed by moving it to another file.
The catalogue is reached only through lazy library, concept-entry and settlement
surfaces. Maps and WorldAppearance are the same map pipeline, and the parser,
interface catalogues and shell CSS are used by the lesson and navigation
surfaces. No route-only code was found sitting in the initial entry merely
because of the refactor. R10 therefore does not add a speculative dynamic
import or raise `chunkSizeWarningLimit` to hide the measurement.

Vite still prints its standard warning that chunks over 500 kB should be split.
This is an explained warning with the exact emitted sizes above, not an
unreported warning or a weakened build gate. A future bundle task can split
the Mermaid language set or the concept bodies after measuring a real route
benefit; that would be a separate change with its own browser evidence.

## Runtime receipt

The complete R9 timing receipt remains `.scratch/overnight-20261003/task17-r9-timing.log`:
**40 passed (5.7m)**. The slowed-phone lesson budget was ready in 4,161 ms
with a 18.0 ms frame p95 over 121 frames. The R10 build did not change runtime
code or budgets, so these are the before and after values for the stage.

The R9 complete browser receipt is `.scratch/overnight-20261003/task17-r9-e2e.log`:
**338 passed (18.7m)**. R10 keeps the same test set and does not remove a
learner assertion.

## Judgment

R10 is complete as a measurement and explanation stage. There was no safe
route-level split justified by the census, and no runtime budget regression.
The remaining chunk-size warning is documented here with its ownership and
raw evidence; it is not silently suppressed.
