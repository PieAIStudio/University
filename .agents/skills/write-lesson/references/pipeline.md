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

Working directory is the repo root.

**Writer / fixer — grok:**

```bash
grok -m grok-4.5 --effort high --always-approve --cwd <repo> --prompt-file <file>
```

**Detector — Antigravity CLI:**

```bash
agy -p "$(cat <file>)" --model gemini-3.6-flash-high --effort high --dangerously-skip-permissions
```

`agy` has no `--prompt-file`; pass the prompt through `-p`.

### `--effort` is not universal — this is a real trap

Verified 2026-08-10 by running each combination:

| model | `--effort` |
| --- | --- |
| `gemini-3.6-flash-high` | accepted |
| `gemini-3.1-pro-high` | accepted |
| `claude-sonnet-4-6` | **rejected — the run fails immediately** |
| `claude-opus-4-6-thinking` | **rejected — the run fails immediately** |

The gemini ids already carry their level as a suffix (`-high` / `-medium` /
`-low`); passing `--effort` as well is redundant but harmless. The Claude models
in Antigravity fail outright, with
`--effort is not supported for model "…"`.

**Drop `--effort` whenever the model is a Claude one.** Two judging runs were
lost to this before anyone read the error text.

## Fallback

If the Flash quota runs out, the detector falls back to:

```bash
agy -p "$(cat <file>)" --model claude-sonnet-4-6 --dangerously-skip-permissions
```

Note the missing `--effort`. Slower than Flash and at least as capable at this
job — detection is careful reading, which is what the bigger model is better at.

Do **not** fall back to `claude-opus-4-6-thinking` by default: it works (it was
the independent judge in the experiment), but the detector runs once per lesson
across hundreds of lessons and the extra capability is not what limits quality
here — the limit is that a detector may only report.

`gemini-3.1-pro-high` is a third option. It was the strongest voice in an earlier
head-to-head but wrote too thin a detail layer to pass the 60% floor, so it is a
better checker than a writer.

## Never

- Never let any model in this pipeline write into `studies/` except the final,
  intentional revision, landed through the `course` CLI.
- Never let a rewrite change a manifest's `evidence` array. Tokens may only point
  inside ranges it already cites.
- Never trust a self-reported "all checks pass". Run
  `node scripts/lint-lessons.mjs --study <id> --course <id>` yourself.
