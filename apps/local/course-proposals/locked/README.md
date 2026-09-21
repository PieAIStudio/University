# Locked course packages

These are exported course packages that are deliberately **not** in delivery.
`recovery/` is what the product bakes and ships — `import-courses.mjs`,
`check-published-catalog.mjs`, `check-export-freshness.mjs`,
`check-content-revisions.mjs`, `pull-taxonomy.mjs` and the Vercel build command
all read that directory and nothing else. A package sitting here is therefore
invisible to a learner while staying under version control.

## Why not simply delete them

`apps/local/studies/*/study.json` is gitignored, and so is most of what sits
beside it. Only one of `turing-pact`'s 31 courses has its source tracked; the
other thirty exist as tracked files **only** in the 8.5 MB package here. Deleting
this directory would mean a fresh clone of this repository no longer contains
those courses in any form. `archived` status on the study is a local authoring
state that stops a re-export; it is not a way to move content out of delivery,
because it never leaves this machine.

## What is here and why

Locked on 2026-09-12. Everything except `browser-ai`「学会用 AI 做应用」 was
written before the teaching contract that requires an interactive activity in
every lesson, and all 29 activities in the product live in `browser-ai`. Rather
than ship several hundred lessons at the older standard, they come back one at a
time as each is rewritten.

| Package | Courses | Title |
| --- | --- | --- |
| `turing-pact` | 31 | 学会用 AI 做游戏 |
| `general` | 1 | 学会用 AI 做网站 |
| `ai-foundations` | 1 | 认识 AI，从这里开始 |

## Why nothing was locked on 2026-09-22

The Owner asked for `browser-ai` and `ai-literacy/ai-for-real-life` to be
retired: both were written before the interaction standard the product now
holds, and `understanding-ai` — whose first lesson
`first-useful-step/ask-about-a-picture` is the one that standard was written
from — was to stay. It was attempted, measured and rolled back, because the
browser suite's content fixtures **are** the shipped courses, and moving a
package is not a content decision the suite can absorb.

`browser-ai` cannot go at all. `e2e/harness/catalogue.ts` resolves roles out of
the catalogue at **module load** and throws when one has no course, so every
spec importing it dies together — not red assertions, a suite that will not
start. The roles name content properties, not just any course: "a series' real
starting course with one deterministically gradable opening exercise", "a course
carrying a prerequisite", "a course with a unit of exactly five lessons that all
have exercises", "a second real course in the settlement study". All of them live
in `browser-ai`, and `understanding-ai` cannot take the first, because its
opening lesson's only exercise is an open `explain` that a model grades.

`ai-for-real-life` alone — the smallest retirement available — keeps the suite
loading and still failed four tests in the gate:

| Test | Why |
| --- | --- |
| `lesson-activity.spec.ts:88`, `:152` | Both enumerate lessons from `apps/local/studies` on disk and never consult a course's status, so they walked a course the browser no longer serves and read the "课程资料没有打开" page. This one is simply a defect: the walk should honour `isPublishableStatus` the way `course-recovery.ts` does. |
| `lesson-activity.spec.ts:285` | Needs a published **bilingual** `connect` task to exercise long-label layout in both locales. `ai-for-real-life` held the only one: `browser-ai` ships Chinese only, and `understanding-ai` has no `connect` at all. |
| `island-pick.spec.ts:461` | `pickRightEdgeIsland` drags the map up to 440px to bring the rightmost island against the frame edge. With `ai-literacy` down to a single course the study has a single island, and that drag carries the archipelago out of the viewport. The product draws one island correctly; the step is calibrated for a fuller map. |

Three of those are the same shape: a spec that assumes the catalogue keeps
providing something. Which courses ship is a product decision, and it should not
be able to disarm the browser gate — so the work that unblocks this is giving
the suite its own fixture study, after which retiring a package is a directory
move again. The findings above are the specification for it.

The slugs do not describe their content; `turing-pact` and `general` say nothing
about games or websites. Renaming them was deliberately **not** done here: a
study id is part of `lessonKey` (`studyId/courseId/lessonId`) and therefore part
of every progress, answer, review-card and reader-mark row, and no alias layer
exists. The cheapest moment to rename is the rewrite that unlocks a package,
which touches the content anyway.

## Unlocking one

1. `git mv apps/local/course-proposals/locked/<study> apps/local/course-proposals/recovery/<study>`
2. `pnpm --filter @pieai/university-local university -- study unarchive --study <study>`
3. `pnpm content`
4. `node apps/university/scripts/check-published-catalog.mjs` — additions need no
   permission, so this passes on its own.
5. Re-run the browser suite. The catalogue size assertions in
   `apps/university/src/catalog/listing.test.ts` and the fixtures in `e2e/` are
   written against the shipped set and move with it.
