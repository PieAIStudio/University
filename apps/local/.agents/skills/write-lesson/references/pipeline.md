# How a lesson gets produced

This file is for whoever **dispatches** the work. `SKILL.md` tells a model how to
write; this says who writes, who checks, and what to run.

## The pipeline

```
grok writes  →  a second model reports where a beginner stops  →  grok fixes
             →  scripts/lint-lessons.mjs  →  a human reads one lesson per course
```

Chosen by a controlled experiment on 2026-08-10, not by preference. Three
pipelines, three rewrites and three new lessons each, scored blind by two
independent readers whose scores agreed almost exactly:

| Pipeline | total | **lowest single lesson** |
| --- | --- | --- |
| **grok → detector → grok** | 29/30 | **9** |
| cheap model drafts → grok repairs | 25/30 | 7 |
| grok alone | 22/30 | 6 |

The winning pipeline's **floor** equals the other two's **ceiling**. That is the
property worth having across hundreds of lessons — not a better average.

The cheap-model-drafts pipeline also produced a **fabricated claim about real
code** (`install-git-hooks.mjs:3-10` described as "checks the working tree is
clean"; it actually runs `git rev-parse --is-inside-work-tree`). Every citation
in every arm resolved to a real path and a real line range, so **no linter can
catch this class of defect** — only a second model actually reading the source.
That alone rules out letting the cheap model draft.

## The detector is not allowed to write

Give it the lesson and ask only where a beginner stops. It must not propose
wording, titles, or replacement prose.

A suggestion from the detector becomes the writer's answer instead of the best
answer — and a model asked "what is missing?" will always find something, which
is how lessons get padded with material that measurably hurts retention (see
「暖，是换说法，不是加内容」 in SKILL.md).

Its two most valuable findings are shapes a writer misses on its own:

- **too late** — the term *is* explained, but after the sentence that needs it.
  The fix is to move the explanation earlier or reword the sentence, never to add
  another block.
- **a block nobody needed** — an explanation of something that was not confusing.

## Retiring the detector

Every new defect class it finds gets promoted into `SKILL.md` as a rule, after
which the writer avoids that class unaided. The "too late" rule came from this
loop and is already in the skill.

So the detector's yield **falls over time by design**. Re-evaluate after about 40
lessons: if a run reports only defects the skill already names, stop running it.

## Commands

**Which models, and how to invoke them: [models.md](models.md). Read it before
dispatching a run.**

It is a separate file because model ids go stale every few weeks while the
pipeline's shape does not, and a version number buried in this argument is a
version number nobody updates. It names roles rather than versions, and says to
ask `grok models` / `agy models` for what is current — always the newest in the
family, always the highest effort it accepts.

Two things there are worth knowing before you read it: `--effort` makes Claude
models under `agy` fail outright, and the detector may never propose wording.

## Never

- Never let any model in this pipeline write into `studies/` except the final,
  intentional revision, landed through the `course` CLI.
- Never let a rewrite change a manifest's `evidence` array. Tokens may only point
  inside ranges it already cites.
- Never trust a self-reported "all checks pass". Run
  `node scripts/lint-lessons.mjs --study <id> --course <id>` yourself.
