# Frozen browser-test catalogue

This is test input, not a published course shelf or an authoring backup. Neither
`pnpm content` nor a delivery build consumes this directory. Default and timing
Playwright projects both restore it through `e2e/prepare-catalogue.mjs`.

## What is frozen and why

Five courses retain 89 lessons and the bilingual, source, route and native-workflow assertions.
Task 17 R3 removed retired action payloads and their exclusive browser cases on
2026-10-05; lesson IDs, text outside those markers, assets and source evidence remain. Existing IDs keep
route, terrain-seed and historical case identities stable; course descriptions
carry `UNIVERSITY_E2E_FROZEN_CATALOGUE` as an explicit non-release marker.

| Course                       | Required coverage                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `understanding-ai`           | Longest course, V3 PRIMM, native sort/connect, bilingual reader and all 36-lesson X audit cases.      |
| `ai-for-real-life`           | Alternate course in the same study, bilingual connect, classic/media and all 30-lesson X audit cases. |
| `run-a-real-project-with-ai` | Settlement/default entry (1/8), second study, baked repository evidence and complete-lesson.          |
| `make-the-cutout-app-yours`  | Prerequisite chain and repository-source reader.                                                      |
| `search-your-own-photos`     | Exactly-five-lesson unit used by skip tests/weekly boss, its prerequisites, tune interaction.         |

Dropping either AI course loses asserted bilingual/course coverage. The five-question
course requires both predecessor courses. The sixth former course adds none of
these roles or activity kinds and is not copied. No screenshots, learner stores,
accumulated recovery history, or uncited source project files are retained.

`manifest.json` records the originating University commit, each original and frozen
package hash, and compressed artifact size/hash. The original capture occupied 2,881,582 bytes; current artifact sizes are in
`manifest.json`; decompressed recovery JSON is generated only in scratch.
Assets remain in the two bilingual courses exercised lesson-by-lesson by X,
including source/media rendering checks. The minimal source archive contains six
cited source files plus their LICENSE (23,613 JSON bytes; 8,492 compressed bytes),
not the original 47.9 MB checkout. Its contents retain exact source-file bytes.

The small Git fixture gets its **own** deterministic commit. Repository evidence
references are rewritten only in test copies to that real fixture commit and
snapshot ID. `manifest.json` and `source.json.gz` retain the original commit for
provenance. Recovery, evidence range validation and snippet baking are unchanged
production implementations; no fake snippet server or parallel course writer exists.

## Boundaries and maintenance

`catalogue-paths.mjs` is the one path authority. Every run recreates an owned,
port-scoped authoring project, so personal config, progress and source-root
variables cannot enter its API. Cleanup refuses an unmarked or symlinked root.
Changing the release shelf does not refresh or shrink these test specimens.
The browser launcher and manual `pnpm e2e:prepare` use the same preparation code.

W1 retains its full bilingual/private-to-public projection assertions against these
frozen inputs. Real release inventory is additionally checked by
`published-catalogue.spec.ts`: manifest/shelf/package lesson identity and revisions
must agree, and frozen recovery hashes/markers must never enter delivery files.
That check has no historical course IDs or minimum old-course counts, and remains
a real-release check during the three-lesson rehearsal.

Refresh only deliberately, after reviewing changed coverage and source licensing:

```sh
node e2e/fixtures/catalogue/freeze.mjs --capture-current
pnpm e2e:prepare
pnpm e2e --list
pnpm e2e:all
```

`freeze.mjs` alone reads the current production recovery indices and the existing
browser-ai source mirror. It is a maintainer capture operation, never a startup
step. Future retirement does not require keeping those inputs available to tests.
Review the recorded provenance/date, role selection, case count, assets and diff
when refreshing. Never regenerate a snapshot merely to make a regression green.
To inspect an archive, use `gzip -dc e2e/fixtures/catalogue/<name>.json.gz`.
