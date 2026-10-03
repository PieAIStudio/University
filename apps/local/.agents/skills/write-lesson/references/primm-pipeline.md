# The PRIMM production line

`apps/local/scripts/primm-pipeline.mjs` turns one outline entry into a native
version-3 step-lesson revision proposal. It is a drafting tool: it never writes a course revision
except by handing the finished proposal to the native course CLI. Run it from
`apps/local`. Everything for a lesson lands in
`<repo>/.scratch/primm-engine/<lesson>/` (gitignored), including each model's
prompt, raw output, parsed result and receipt, and `log.md`.

```bash
cd apps/local
node scripts/primm-pipeline.mjs packet   --lesson <unit>/<lesson> [--mode new|revise] [--owner-notes <file>]
node scripts/primm-pipeline.mjs run      --lesson <unit>/<lesson> [--rounds 2]
node scripts/primm-pipeline.mjs polish   --lesson <unit>/<lesson>
node scripts/primm-pipeline.mjs polish   --lesson <unit>/<lesson> --fixed-title "Owner-agreed title"
node scripts/primm-pipeline.mjs check    --lesson <unit>/<lesson> --final # real runs of the polished draft
node scripts/primm-pipeline.mjs assemble --lesson <unit>/<lesson>          # native dry-run
node scripts/primm-pipeline.mjs assemble --lesson <unit>/<lesson> --apply  # open-for-edit + revise
node scripts/primm-pipeline.mjs note     --lesson <unit>/<lesson> --text "what a person changed by hand"
node scripts/primm-pipeline.mjs review   --lesson <unit>/<lesson> --version N --text "a person's finding"
node scripts/primm-pipeline.mjs fix      --lesson <unit>/<lesson> --from N
node scripts/primm-pipeline.mjs status   # every lesson: versions, writer, scores, best, manual notes
# Explicitly manual import; this is not evidence that the line wrote a lesson:
node scripts/primm-pipeline.mjs assemble-steps --lesson <unit>/<lesson> --input <file.json> [--replace] [--apply]
```

Individual stages (`write`, `check`, `detect`, `fix`, `research`) can be run on
their own; each reads the latest `draft.vN.json`.

## Unpublished Owner reading

Build the native dependencies first: `pnpm --filter @pieai/university-core build`
and `pnpm --filter @pieai/university-local build`. Run the model preflight in
[models.md](models.md), retain its stdout, stderr and exit codes, and explicitly
select the available Writer and Detector IDs. An unauthenticated Grok listing
is not a pass; use the declared Claude-through-agy fallback, without `--effort`.
Never send a writing request to a family that did not pass its preflight.

For a lesson that must remain unpublished, choose an empty absolute
`PRIMM_PROJECT_ROOT` and a durable `PRIMM_RUN_ROOT`. These are an authoring data
project and its receipts, not a Git branch or worktree. All packet reads, live
samples and native CLI writes use that project's one configured studies root.

```bash
# Keep these same values for every stage, including later review → fix.
export PRIMM_PROJECT_ROOT=<absolute-empty-authoring-directory>
export PRIMM_RUN_ROOT=<absolute-run-receipt-directory>
node scripts/primm-pipeline.mjs prepare-unpublished --lesson <unit>/<lesson>
node scripts/primm-pipeline.mjs packet --lesson <unit>/<lesson>
# Then run/check/detect/fix/polish/assemble as above.
node scripts/primm-pipeline.mjs preview --lesson <unit>/<lesson>
```

`prepare-unpublished` restores through the native recovery-import dry-run and
import, then opens the course for edit. It refuses to overwrite an existing
authoring project. Resume that same project; do not prepare it again.
`assemble` performs the real native dry-run without applying; `--apply` also
creates the new native revision. Missing translations or mismatched packet roots
block it. `preview` reactivates only this unpublished project, exports through
the same native recovery CLI, and imports a separate preview generation. Neither
the formal recovery, delivery content, imported catalogue nor lexicon is replaced.

The preview stage prints `UNIVERSITY_PRIMM_PREVIEW_ROOT=<generation> pnpm primm:preview`.
Run that command from the repository root. Both App catalogue and model execution
resolve that same checked generation. The listener is on `127.0.0.1`; alternate
ports use `UNIVERSITY_PRIMM_APP_PORT` and `UNIVERSITY_PRIMM_API_PORT`. Do not use
`pnpm dev` or shortened canned replies for Owner reading. Preserve the full
answers and measure their characters/bytes. Preview is not publication.

The task stays active while the Owner reads. His feedback enters `review` → `fix`;
hand changes to lesson prose are recorded with `note` and are not counted as a
lesson written by the line. Task 14 must move this authoring location along with
the content repository, using the same native root configuration.

## Stages

| Stage | Who | What it does | Output |
| --- | --- | --- | --- |
| packet | script | Reads native storage: outline, unit objective and siblings, earlier units and earlier lessons of this unit, the first preceding V3 form example, verified sources, assets, operations, card/exercise IDs and Owner notes. Examples teach structure, never reusable stories or sentences. Binds the exact authoring root. | `packet.json` |
| write | Writer (Grok, highest effort) | Plans first (five real moments with elimination tests, case choice, uncertainty, investigate act, teacher thread), then writes the whole lesson as typed JSON derived from the native zod schema. | `draft.v1.json` |
| check | script + local AI | Native V3 shape + `primmIssues`; checks the three source placements, review dates, 8–12 screens, one 3–6-item round, and text/material signals. Really runs every selectable or matched request, the native-built Modify request and an independent Make sample. Renders the actual steps with complete answers, not a fixed six-screen V2 story. Invalid structures do not run; failed samples block the Detector. | `lint.vN.json`, `samples.vN.json`, `render.vN.md` |
| detect | Detector (Gemini Flash, different family) | Walks the rendered lesson as a 55-year-old first-time user and, for wording only, as a 9-year-old reader. Reports F1–F15 findings with severity and exact quotes; proposes no wording. | `detector.vN.json` |
| research | Researcher (Gemini Pro via agy, search only) | When the plan found no fitting case or called its case weak. Proposes primary sources with an exact quote; the script fetches each page and keeps only those whose quote is really there. | `research.checked.json`, `research.accepted.json` |
| fix | Writer family | Returns the whole revised lesson plus a resolution for every finding (fixed, or rejected with a reason). | `draft.vN+1.json` |
| polish | Polisher (Gemini Flash) | Only after a ready independent review and passing structural/runtime checks: spoken wording, then faithful English. IDs and rule references never enter the map. Chinese requests, build pieces and find targets already run/reviewed stay frozen. Numbers, hedges, absolutes, growth and quotations are checked; a rejected key retains the Writer's wording. | `final.json`, `polish.vN.acceptance.json` |
| assemble | script + native CLI | Builds and schema-validates the `CourseRevisionProposal`: activity with `locales.en.strings`, all prior evidence plus newly used verified sources, preserved card/exercise IDs, explain exercise with rubric, recap content. `--apply` opens the course for edit if needed, runs the native dry-run, then `course revise`. | `proposal.json`, `native-*.json` |
| assemble-steps | person + native CLI | Lands a version-3 step lesson written by hand: `{ activity, exercise, cards }` with every display string already in English. Same evidence, card/exercise identities and native dry-run → revise path as `assemble` (both call one `nativeApply`). `--replace` lands new content in an old lesson's identities: only its own sources, and the old media it no longer uses retired by name (`retireAssetIds`). Logged as `MANUAL`. | `proposal.json`, `native-apply.json` |
| finish | native CLI | Once per batch after every `--apply`: reactivate the course, export the recovery package. Then `pnpm content` at the repository root. | `native-finish.json` |

`run` loops check → detect → fix until the Detector returns `ready` with no
blocker/major and no shape errors, or the round limit is reached. It stops
before polish so a person can read the render first.

After polish, `check --final` revalidates and actually runs the final draft,
retaining `lint.final.json`, `samples.final.json` and `render.final.md` separately
from the Writer's versioned evidence. A failed real response is not replaced or
shortened to manufacture acceptance.

After landing all lessons of a batch through `assemble --apply`, run `finish`
once only when that formal export is separately authorized, then `pnpm content` at the repository root. For unpublished Owner reading use `preview`, not `finish`. Reactivate last: a stale course does not open in the reader, and every check
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
- **A source is admitted by its page, not its host.** `research` keeps a
  candidate whose quote is really on the fetched page, on any https host except
  the adopted-course sites in `url-evidence-hosts.json`. There is no host list to
  approve; whether the page supports the claim is its provenance, reviewed with
  the lesson.
- **Render annotations.** Everything the learner does not see (sample prompts,
  failed sample runs, interaction types) is marked `〔检查者注〕` in the render,
  or the Detector reviews pipeline artefacts as lesson content.
  State which chosen-request branch the sample followed, label a build hint as
  visible only after a failed assembly, and distinguish a raw Make response from
  the learner-edited, independently graded final work. An ungraded self-check is
  not a second exam. Changing a review projection keeps the original draft,
  model answers, review and score; it never rerolls an inconvenient answer.
  List every native-valid build alternative, including shorter accepted forms;
  showing only the sample's first answer can misreport an optional tile as a
  mandatory one.

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

- New drafts use V3's existing step schema. Source-review metadata lives in
  `plan.realWorld` and binds the native `intro.sourceIds`, `send.wait` and
  `finish.didYouKnow`; it does not invent a second product payload. New material
  interactions unsupported by that schema cannot be silently emitted.

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
