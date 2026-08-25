# How a lesson gets produced

This file is for whoever **dispatches** the work. `SKILL.md` tells a model how to
write; this says who writes, who checks, and what to run.

## The pipeline

```
grok writes  →  a second model reports where a beginner stops  →  grok fixes
             →  gemini flash polishes for spoken register (bounded, see below)
             →  scripts/lint-lessons.mjs + scripts/check-lesson-hedges.mjs
             →  a human reads one lesson per course
```

The measured path above uses Grok for both Writer/fixer jobs. If the models
preflight says Grok is unavailable, the Codex CLI may replace that Writer/fixer
arm only, after its own model-list preflight. The Detector and Polisher keep
their declared families, and the Writer/fixer and Detector must remain
different families. If preflight leaves only one family that could fill both
jobs, stop and report; never let the writer check its own work. The Codex arm
has not been included in the blind experiment below, so its use changes a
measured variable and must be visible in the run report.

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

## The polish pass, and the one thing it will do to you

Added 2026-08-20, after a second controlled experiment. Grok and Claude reason
well and write like documentation; Gemini Flash reasons less well and writes
like a person talking. The question was whether the second thing can be bought
without losing the first.

It can, but only with two rules the model does not follow unasked.

**What an unbounded polish does.** Three lessons — short, median and long, from
`turing-pact/foundations-before-zero` — polished by `gemini-3.7-flash-high`
with instructions to change wording only. It kept every evidence anchor, every
code span, every heading and every fence. It also, across those three lessons:

- removed 10 of the author's 23 hedges, and
- manufactured 10 absolutes where the originals had **zero**, and
- grew every lesson by 7–9% while being told not to grow, and
- wrote 「只要平台不是 `web`，哈希路由**才**会打开」 — 「只要」 pairs with
  「就」, 「只有」 pairs with 「才」 — in the sentence that states a boolean.

「通常能照着清单重新装」 became 「随时都能重新装」. For a beginner those are
different claims, and the second one teaches them that the day the network is
down, the failure is theirs. Both blind judges found this class of defect and
found it **only** in the polished version.

**With the two rules added** — no absolutising, no growth — the same model on
the same three lessons restored every hedge (23 → 25), produced **zero**
absolutes, and came out 1.6% shorter.

**Scored blind, both orderings, two judges** (`claude-sonnet-4-6` and
`gemini-3.1-pro-high`, neither of which wrote either version):

| | verdict |
| --- | --- |
| current output vs **unbounded** polish | judges split: Gemini Pro preferred the current output 3/3, Sonnet preferred the polish 3/3 |
| current output vs **bounded** polish | **bounded polish wins 11 of 12** |

The first row is why the rules are not optional; the second is why the pass is
worth running. Position was swapped and re-judged because the first
randomisation happened to put one version first every time.

**The rules, in the polish prompt:**

1. Every hedge in the source is deliberate. `通常 / 常常 / 往往 / 一般 / 多数 /
   可能 / 倾向于` must survive. Never introduce `绝不 / 绝对 / 必然 / 从不 /
   全都是 / 根本不 / 压根 / 随时都能 / 完全可以`. 「只要」 takes 「就」;
   「只有」 takes 「才」.
2. The output may not be longer than the input. Spoken language is *shorter*
   sentences, not more words.

Both are checked mechanically afterwards, which is what makes the pass safe to
run at volume:

```bash
node scripts/check-lesson-hedges.mjs --before <original.md> --after <polished.md>
```

It fails on a lost hedge, a new absolute, or a new 「只要…才」.

**Polish once, not twice.** The first instinct is to add a second Flash pass at
the end to apply the fixes Grok finds. Do not: every pass is another chance to
absolutise, and running two doubles a risk that has been measured rather than
guessed. Grok finds the errors and Grok fixes them.

**The honesty note.** This experiment is a quarter the size of the 2026-08-10
one — 3 lessons, 2 model judges, one course, against 3 pipelines × 6 lessons
scored by two human readers. It supports "run this on the next batch and look",
not "this is settled". Re-evaluate after about 10 lessons.

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

**Which models, how to preflight them, and how to invoke them:
[models.md](models.md). Read it before dispatching a run. Its preflight is a
hard gate: no writing or checking prompt is sent before both model listings
have been inspected and the selected arm has been recorded.**

It is a separate file because model ids go stale every few weeks while the
pipeline's shape does not, and a version number buried in this argument is a
version number nobody updates. It names roles rather than versions, and says to
ask `grok models` / `agy models` for what is current — plus `codex debug models`
when the Writer/fixer fallback is selected — always the newest in the family,
always the highest effort it accepts.

Two things there are worth knowing before you read it: `--effort` makes Claude
models under `agy` fail outright, and the detector may never propose wording.

## Never

- Never let any model in this pipeline write into `studies/` except the final,
  intentional revision, landed through the `course` CLI.
- Never let a rewrite change a manifest's `evidence` array. Tokens may only point
  inside ranges it already cites.
- Never trust a self-reported "all checks pass". Run
  `node scripts/lint-lessons.mjs --study <id> --course <id>` yourself.
