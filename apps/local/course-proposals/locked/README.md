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
