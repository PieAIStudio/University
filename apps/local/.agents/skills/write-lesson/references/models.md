# Which models, and how to call them

**Read this before any writing or checking run.** It contains the preflight
gate, the role routing, and the call shapes. The preflight is required even
when the current agent is doing the writing itself: no Writer/fixer, Detector,
or Polisher prompt goes out before the gate has been settled and recorded.

It is a separate file from `pipeline.md` on purpose: the pipeline's *shape* —
who writes, who checks, who may not write — was settled by experiment and
rarely changes, while the models that fill those roles change every few weeks.
Keeping them apart means updating a model does not mean re-reading the
reasoning behind the pipeline, and re-reading the reasoning does not surface a
stale version number.

## Preflight: before dispatching any work

Run both model-list commands before dispatching **any** writing or checking
task. Capture both stdout and stderr, because a CLI can print a misleading
partial result and still exit successfully:

```bash
grok_output="$(grok models 2>&1)"
grok_status=$?
agy_output="$(agy models 2>&1)"
agy_status=$?

printf '%s\n' '--- grok models ---' "$grok_output"
printf '%s\n' '--- agy models ---' "$agy_output"
```

The checks are:

| Check | Pass condition | Failure action |
| --- | --- | --- |
| `grok models` | Exit status is zero, the output contains a usable model list with at least one model entry, **and** the output does not contain the exact text `You are not authenticated.` | Mark Grok unavailable even if model names were printed; preflight the Codex Writer/fixer fallback. |
| `agy models` | Exit status is zero and the output contains at least one model entry, not only a fetching/status line. | Stop and report. There is no substitute CLI for both Detector and Polisher. |

`grok models` is a special hard check. It can print `You are not
authenticated.` and still list model names, so “the command printed
something”, “the list has a default”, and even a zero exit status are not
enough. Reject the Grok arm whenever that exact authentication sentence
appears:

```bash
case "$grok_output" in
  *"You are not authenticated."*)
    echo "Grok preflight: FAIL — authentication is required" >&2
    ;;
  *)
    echo "Grok preflight: inspect the model list and exit status" >&2
    ;;
esac
```

Do not send a prompt until the preflight has recorded the selected arm and the
reason. A failed check must either take the explicit fallback below or stop
with the failure in the run report. Never silently use a different family.

If Grok fails, run this additional fallback preflight before using Codex:

```bash
codex --version
codex debug models
```

Use the current eligible Codex model id and its highest supported reasoning
effort from that output. If the Codex CLI is unavailable or its model list has
no eligible Writer/fixer model, stop and report; do not send the job to an
unlisted id.

Family availability does not erase role boundaries:

- Writer/fixer uses Grok when the Grok preflight passes, otherwise the Codex
  reasoning family after its own preflight.
- Detector uses Gemini Flash when available, otherwise Claude Sonnet through
  `agy`.
- Polisher uses Gemini Flash. It has no declared Claude or Codex fallback; if
  Gemini Flash is unavailable, stop the full run or explicitly report a
  no-polish run before shipping it. Do not silently substitute Claude for the
  Polisher.
- Writer/fixer and Detector must remain different model families. If the
  preflight leaves only one family that could fill both jobs, stop and report;
  never let a writer check its own work.

## Never hardcode a version

Model ids in this project go stale faster than anything else written down. A
skill that names a particular Grok id keeps naming it long after something
better ships, and the run silently gets worse than it needed to be.

**So this file names roles and families, not current versions.** Before each
run, ask the CLI what it currently has:

```bash
grok models      # Writer / fixer
agy models       # Detector and Polisher
codex debug models  # only when the Writer / fixer fallback is selected
```

Then pick, for each role:

- the **newest** model in the required family, and
- the **highest** reasoning effort that model accepts.

There is no budget reason to do otherwise here. A lesson is written once and
read many times, and the cheap-model arm of the 2026-08-10 experiment lost on
correctness, not on cost — see `pipeline.md`.

If a required family no longer exists under any version, that is a real change
to the pipeline: take the declared fallback or stop and say so in the run
report. Do not silently substitute a nearby family.

## The roles

| Role | Family | CLI |
| --- | --- | --- |
| **Writer / fixer (preferred)** | Grok | `grok` |
| **Writer / fixer (fallback)** | Codex CLI reasoning family | `codex exec` |
| **Detector (preferred)** | Gemini Flash | `agy` (Antigravity) |
| **Detector (fallback)** | Claude Sonnet | `agy` |
| **Polisher** | Gemini Flash | `agy` |

The 2026-08-10 blind experiment measured the Grok Writer/fixer arm. The
Codex Writer/fixer fallback has **not** run that blind evaluation. Choosing it
changes a variable that the experiment held fixed; it is an operational escape
hatch, not a measured quality result. The fallback is not free: it buys
continuity at the cost of experimental comparability and an unmeasured quality
profile.

That is the first debugging clue, not a disclaimer: when a run's lesson
quality drops, check the run report's `writer_arm` first. If it says the
fallback was used, inspect that route before blaming the lesson prompt,
Detector, or Polisher.

The Detector and Polisher are separate jobs even when they use the same family:

- The **Detector** only reports where a beginner stops. It must not propose
  wording, titles, or replacement prose.
- The **Writer/fixer** writes and fixes prose. It is not the Detector.
- The **Polisher** may change wording for spoken register only. It must not
  change structure, facts, evidence anchors, or the meaning of a hedge.

Shapes of the calls — substitute the current ids selected by the preflight:

```bash
# Writer / fixer — preferred arm
grok -m <newest-grok> --effort <highest> --always-approve --cwd <repo> --prompt-file <file>

# Writer / fixer — fallback arm
# This concrete id is today's family example only; it will expire. Query
# `codex debug models` before using a current id.
codex exec -m gpt-5.6-luna -c 'model_reasoning_effort="max"' -c 'service_tier="fast"' --dangerously-bypass-approvals-and-sandbox "<prompt>"

# Codex may also read the prompt from stdin. `codex exec` has no --prompt-file.
cat <file> | codex exec -m <current-codex-id> -c 'model_reasoning_effort="max"' -c 'service_tier="fast"' --dangerously-bypass-approvals-and-sandbox -

# Detector — Gemini Flash
# `agy` has no --prompt-file; the prompt goes through -p.
agy -p "$(cat <file>)" --model <newest-gemini-flash> --effort <highest> --dangerously-skip-permissions

# Detector fallback — Claude Sonnet; deliberately no --effort
agy -p "$(cat <file>)" --model <newest-claude-sonnet> --dangerously-skip-permissions

# Polisher — Gemini Flash, wording only
agy -p "$(cat <file>)" --model <newest-gemini-flash> --effort <highest> --dangerously-skip-permissions
```

The example Codex model above accepts `low`, `medium`, `high`, `xhigh`, and
`max` in the current model listing; it does **not** accept `ultra`. Therefore
`max` is the highest effort for that example. Query the listing again when the
fallback is used; do not carry today's id or effort assumptions into a later
run.

## Traps that survive any version change

**`grok models` output is not proof of authentication.** The exact sentence
`You are not authenticated.` invalidates the Grok arm even when the same output
also contains model names.

**Codex `exec` has no `--prompt-file`.** Grok's `--prompt-file` shape cannot be
copied to the fallback. Pass the prompt as the positional argument, or pipe
the prompt to `codex exec -` through stdin.

**`--effort` is not universal.** Gemini models accept it; **Claude models under
`agy` reject it and the run fails immediately** with
`--effort is not supported for model "…"`. Two judging runs were lost to this
before anyone read the error text. So: drop `--effort` whenever the model is a
Claude one, including when falling back.

Gemini ids have historically carried their level as a suffix (`-high`,
`-medium`, `-low`). Where that is still true, choosing the `-high` id *is*
choosing the effort, and passing `--effort` as well is redundant but harmless.

**The Polisher will absolutise unless told not to.** Measured, not suspected:
across three lessons an unbounded polish removed ten of the author's 23 hedges
and invented ten absolutes that were not in the source, while leaving every
anchor and code span perfectly intact — so nothing structural caught it. The
two rules that stop it, and the checker that verifies them, are in
`pipeline.md`.

**The Detector may not write.** This is not a model property and no version
changes it — it is the reason the pipeline wins. Give it the lesson, ask only
where a beginner stops, and forbid proposed wording. A suggestion from the
Detector becomes the Writer's answer instead of the best answer, and a model
asked "what is missing?" will always find something. The full argument is in
`pipeline.md`.

## Reporting

Every run report must record the preflight result and the route that actually
ran. At minimum, name:

- `writer_arm`: `grok` or `codex`, plus the reason for any fallback;
- the exact Writer/fixer model id and exact effort;
- the exact Detector model id and exact effort; for Claude, write
  `omitted — agy/Claude rejects --effort`;
- the exact Polisher model id and exact effort, or `not run` with the explicit
  reason;
- whether Grok and agy preflights passed, and whether the writer/detector
  families remained distinct.

Do not write "the newest Grok" or "Gemini Flash" as the run result. Those are
selection rules, not evidence of what actually ran. If the fallback was used,
make that fact prominent: it is the first thing to investigate after a quality
regression because its arm has not been covered by the 2026-08-10 blind eval.
