# The PRIMM production line

`apps/local/scripts/primm-pipeline.mjs` turns one outline entry into a native
revision proposal. It is a drafting tool: it never writes a course revision
except by handing the finished proposal to the native course CLI. Run it from
`apps/local`. Everything for a lesson lands in
`<repo>/.scratch/primm-engine/<lesson>/` (gitignored), including each model's
prompt, raw output, parsed result and receipt, and `log.md`.

```bash
cd apps/local
node scripts/primm-pipeline.mjs packet   --lesson <unit>/<lesson> [--mode new|revise] [--owner-notes <file>]
node scripts/primm-pipeline.mjs run      --lesson <unit>/<lesson> [--rounds 2]
node scripts/primm-pipeline.mjs polish   --lesson <unit>/<lesson>
node scripts/primm-pipeline.mjs assemble --lesson <unit>/<lesson>          # native dry-run
node scripts/primm-pipeline.mjs assemble --lesson <unit>/<lesson> --apply  # open-for-edit + revise
node scripts/primm-pipeline.mjs note     --lesson <unit>/<lesson> --text "what a person changed by hand"
node scripts/primm-pipeline.mjs review   --lesson <unit>/<lesson> --version N --text "a person's finding"
node scripts/primm-pipeline.mjs fix      --lesson <unit>/<lesson> --from N
node scripts/primm-pipeline.mjs status   # every lesson: versions, writer, scores, best, manual notes
```

Individual stages (`write`, `check`, `detect`, `fix`, `research`) can be run on
their own; each reads the latest `draft.vN.json`.

## Stages

| Stage | Who | What it does | Output |
| --- | --- | --- | --- |
| packet | script | Reads native storage: outline (old title/content, or the current PRIMM activity in revise mode), unit objective and sibling titles, what earlier units taught, the study's **verified-evidence library**, lesson assets, runnable operations, card and exercise IDs, optional Owner notes. | `packet.json` |
| write | Writer (Grok, highest effort) | Plans first (five real moments with elimination tests, case choice, uncertainty, investigate act, teacher thread), then writes the whole lesson as typed JSON derived from the native zod schema. | `draft.v1.json` |
| check | script + local AI | zod + `primmIssues` on the assembled payload; lint for banned words, UI narration, long sentences, material meta-leaks, reused Make material, card lengths, sort-card giveaways, edit sentences absent from the run material. Then **really runs** the starter request, a fully scaffolded modify request and a beginner-style Make request through the same PRIMM runtime the product uses, and renders the lesson screen by screen with those outputs. | `lint.vN.json`, `samples.vN.json`, `render.vN.md` |
| detect | Detector (Gemini Flash, different family) | Walks the rendered lesson as a 55-year-old first-time user and, for wording only, as a 9-year-old reader. Reports F1–F15 findings with severity and exact quotes; proposes no wording. | `detector.vN.json` |
| research | Researcher (Gemini Pro via agy, search only) | When the plan found no fitting case or called its case weak. Proposes primary sources with an exact quote; the script fetches each page and keeps only those whose quote is really there and whose host is on the authority list. | `research.checked.json`, `research.accepted.json` |
| fix | Writer family | Returns the whole revised lesson plus a resolution for every finding (fixed, or rejected with a reason). | `draft.vN+1.json` |
| polish | Polisher (Gemini Flash) | Spoken, 8–9-year-old-readable wording for every displayed string, with the rendered lesson as context; then faithful English. Gates: numbers, hedges, new absolutes, AI alias, growth, quoted text. A key failing a gate keeps the fixed wording; it is never hand-repaired and called polished. | `final.json`, `polish.vN.acceptance.json` |
| assemble | script + native CLI | Builds and schema-validates the `CourseRevisionProposal`: activity with `locales.en.strings`, all prior evidence plus newly used verified sources, preserved card/exercise IDs, explain exercise with rubric, recap content. `--apply` opens the course for edit if needed, runs the native dry-run, then `course revise`. | `proposal.json`, `native-*.json` |
| finish | native CLI | Once per batch after every `--apply`: reactivate the course, export the recovery package. Then `pnpm content` at the repository root. | `native-finish.json` |

`run` loops check → detect → fix until the Detector returns `ready` with no
blocker/major and no shape errors, or the round limit is reached. It stops
before polish so a person can read the render first.

After landing all lessons of a batch through `assemble --apply`, run `finish`
once, then `pnpm content` at the repository root. Reactivate last: a stale course does not open in the reader, and every check
stays green regardless (see `activities.md`).

## Operating rules learned on the first batch (2026-09-19)

- **More rounds are not better.** The Detector is noisy and every fix can add
  new faults. Each version is scored (blocker×10 + major×3 + minor + shape×10,
  person-added findings excluded); `polish` defaults to the best-scoring version,
  `fix` starts from it (or `--from N`), and `run` stops when a fix scores worse.
  Across 8 lessons, most codex fixes scored worse than the version they fixed.
- **Fixes are surgical.** The fixer changes what was flagged and what must change
  with it; a whole-lesson rewrite fixes old faults and introduces new ones.
- **Truth outranks score.** A factual over-claim beyond the source is decided by a
  person over a lower-scoring version; log that choice with `note`.
- **A person's reading enters the same loop.** `review --text …` appends a
  `HUMAN` finding to a version's report; the next `fix --from` addresses it.
- **Writer chain.** `PRIMM_WRITER_CLI=auto` (default) uses Grok, then Claude via
  agy, then Codex, marking an exhausted family for an hour. Claude via agy is
  capped at 4 concurrent calls (`PRIMM_WRITER_SLOTS`). A result hidden by a late
  429 is recovered with `reparse --name writer.v1` before paying for a rewrite.
- **Sources pass the authority-host list.** `research` keeps a quote-verified
  candidate only when its host is on `url-evidence-hosts.json`; any other host
  waits for a person to admit it under that file's policy.
- **Render annotations.** Everything the learner does not see (sample prompts,
  failed sample runs, interaction types) is marked `〔检查者注〕` in the render,
  or the Detector reviews pipeline artefacts as lesson content.

## What is automated, what a person still does

Automated: need-first design, case choice from verified sources, case research
with quote verification, writing, machine checks, real sample runs, beginner
review, fixing, polish, translation, proposal assembly, dry-run.

A person still: chooses which outline entries to run; reads `render.vN.md` and
the Detector report before polish; decides when a round limit was hit with
findings left; plays the landed lesson in the browser; and adds licensed images
or audio when a lesson needs media the study does not have. Any hand edit to a
draft is recorded with `note`; the batch report counts those edits.

## Known limits

- The runnable operations are those of the PRIMM runtime: text, vision (with a
  study image), transcription (with a study recording). A capability that cannot
  or should not run live needs a labelled demonstration phase that does not
  exist yet; the Writer is told to report such a lesson, not fake it.
- Modify can only edit request text; it cannot take old material out of the
  conversation. A lesson whose simplest answer is "start a clean conversation"
  therefore teaches the in-conversation wording and only mentions the clean start
  (seen on `start-a-new-context`). Needs a Modify action that changes materials.
- Media limit what needs a lesson can honestly serve. The pilot study has two
  CC0 photos and two synthetic English clips; the contract's honest-practice rule
  covers this, but a stronger lesson needs media from the learner's real life.
- The Detector is a model imitating a beginner. It is a plausibility filter,
  not learner evidence.
- Sample runs use the local model; production grading uses the metered AI source.
  Lesson copy must hold for both, which is why debriefs never assert output content.
- The local 4B model sometimes returns nothing on a long answer (two of three
  attempts on `answer-or-search`'s modify run in the browser, while the pipeline's
  sample run had succeeded). The product keeps the learner's text and retries;
  a passing sample run does not prove the live run is reliable.
