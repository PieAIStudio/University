# Which models, and how to call them

**Read this before dispatching any writing or checking run.** It is a separate
file from `pipeline.md` on purpose: the pipeline's *shape* — who writes, who
checks, who may not write — was settled by experiment and rarely changes, while
the models that fill those roles change every few weeks. Keeping them apart
means updating a model does not mean re-reading the reasoning behind the
pipeline, and re-reading the reasoning does not surface a stale version number.

## Never hardcode a version

Model ids in this project go stale faster than anything else written down. A
skill that names `grok-4.5` keeps naming it long after something better ships,
and the run silently gets worse than it needed to be.

**So this file names roles, not versions.** Before a run, ask the CLI what it
currently has:

```bash
grok models      # writer / fixer
agy models       # detector
```

Then pick, for each role:

- the **newest** model in the family named below, and
- the **highest** reasoning effort that model accepts.

There is no budget reason to do otherwise here. A lesson is written once and
read many times, and the cheap-model arm of the 2026-08-10 experiment lost on
correctness, not on cost — see `pipeline.md`.

If a family below no longer exists under any version, that is a real change to
the pipeline: say so in the run report rather than silently substituting
something from another family.

## The roles

| Role | Family | CLI |
| --- | --- | --- |
| **Writer / fixer** | Grok | `grok` |
| **Detector** | Gemini Flash | `agy` (Antigravity) |
| **Detector fallback** | Claude Sonnet | `agy` |
| **Polisher** | Gemini Flash | `agy` |

The polisher and the detector are the same family for the same reason — it
writes and hears Chinese the way a person speaks it — but they are different
jobs under different rules. The detector may not propose wording at all. The
polisher may only change wording, and is bounded by two rules it will otherwise
break every time. Both arguments are in `pipeline.md`; do not run a polish pass
without reading them.

Shapes of the calls — substitute the current ids:

```bash
# Writer / fixer
grok -m <newest-grok> --effort <highest> --always-approve --cwd <repo> --prompt-file <file>

# Detector — `agy` has no --prompt-file; the prompt goes through -p
agy -p "$(cat <file>)" --model <newest-gemini-flash> --effort <highest> --dangerously-skip-permissions
```

## Two traps that survive any version change

**`--effort` is not universal.** Gemini models accept it; **Claude models under
`agy` reject it and the run fails immediately** with
`--effort is not supported for model "…"`. Two judging runs were lost to this
before anyone read the error text. So: drop `--effort` whenever the model is a
Claude one, including when falling back.

```bash
# Fallback — note the absent --effort
agy -p "$(cat <file>)" --model <newest-claude-sonnet> --dangerously-skip-permissions
```

Gemini ids have historically carried their level as a suffix (`-high`,
`-medium`, `-low`). Where that is still true, choosing the `-high` id *is*
choosing the effort, and passing `--effort` as well is redundant but harmless.

**The polisher will absolutise unless told not to.** Measured, not suspected:
across three lessons an unbounded polish removed ten of the author's hedges and
invented ten absolutes that were not in the source, while leaving every anchor
and code span perfectly intact — so nothing structural caught it. The two rules
that stop it, and the checker that verifies them, are in `pipeline.md`.

**The detector may not write.** This is not a model property and no version
changes it — it is the reason the pipeline wins. Give it the lesson, ask only
where a beginner stops, and forbid proposed wording. A suggestion from the
detector becomes the writer's answer instead of the best answer, and a model
asked "what is missing?" will always find something. The full argument is in
`pipeline.md`.

## Reporting

Every run report must name the exact model ids and efforts actually used. A
report that says "the newest Grok" is unreproducible six weeks later, which
defeats the point of having run a controlled experiment at all.
