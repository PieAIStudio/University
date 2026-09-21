---
name: write-lesson
description: Write or revise a real-source University lesson with complete PRIMM (Predict, Run, Investigate, Modify, Make), for ordinary adults new to AI. Use for lesson authoring from a course outline, beginner guidance and teacher voice, everyday relevance, interaction choice, confusing or redundant lesson copy, rewrites, and batch generation through the PRIMM production line. Owns sources, teaching, learner text, cards, independent Make assessment, review, actual Gemini Flash polish and native revision proposals. Not course planning, ordinary coding, refresh orchestration or publication.
metadata:
  version: "4.0.0"
---

# Write a lesson — a teacher's PRIMM, produced at scale

University needs hundreds of lessons that no one will hand-tune. This skill is
the teaching engine: given an outline entry, real verified material and a
learner, it must produce a lesson an ordinary adult understands, wants to
finish, and can use in their own life the same day. The measure is the next
**unseen** outline entry, not the pilot lessons.

## Where the rules live

| File | What it decides |
| --- | --- |
| [teaching-contract.md](references/teaching-contract.md) | **The** teaching rules: audience and reading level, need-first design, the real case's role, the teacher's thread, each PRIMM phase, materials, hard rejections F1–F15. Every model role receives it verbatim. Change a rule here and nowhere else. |
| [components.md](references/components.md) | **The** interaction components — one table, all of them: lesson activities, PRIMM steps, PRIMM investigate games and the 3D games. Which one to pick, where it may go, what actually counts as passing it, and the material it needs. Three lists used to disagree; `pnpm check:components` now keeps this one and the registries failing together. |
| [teaching-principles.md](references/teaching-principles.md) | Why those rules exist: the research they come from, and what it does not prove. |
| [primm-pipeline.md](references/primm-pipeline.md) | How to run the production line, what is automated, what a person still does, receipts. |
| [models.md](references/models.md) | Which model family fills which role; preflight before any call. |
| [evidence-and-failures.md](references/evidence-and-failures.md), [media.md](references/media.md) | Source verification, provenance, licensed media. |
| [cards-and-exercises.md](references/cards-and-exercises.md) | Card and independent-exercise contracts. |
| [checklist.md](references/checklist.md) | Acceptance before an Owner sees it. |
| [pipeline.md](references/pipeline.md), [activities.md](references/activities.md), [variants.md](references/variants.md), [polish-prompt.md](references/polish-prompt.md) | Retained prose/V1/V2 history; `activities.md` is how a lesson activity is placed, written into the prose, tiered and sourced — which component to pick is in `components.md`. Read only for those revisions. |

## The five decisions a teacher makes before writing

The Owner's standing complaint about machine-written lessons is not length or
accuracy. It is that the lesson is written from the **designer's** chair: the
steps are logical to the author, the need is invented to fit available
material, and nobody tells the learner why this step, now. So every lesson is
designed in this order, and the plan is kept for review:

1. **A real need.** Five or more moments when an ordinary adult would actually
   want this capability, each tested: would they meet it this month; is there a
   simpler way that needs no AI at all? Practice and Make use two different
   surviving moments. Material follows the moment, never the reverse.
2. **The real case's job.** It proves that real people use this, then hands the
   stage back to the learner's life. It is a door, not the house.
3. **One genuine uncertainty for Predict**, one thing to figure out in
   Investigate, one change in Modify, one changed purpose in Make.
4. **The teacher's thread.** One small job told from start to end; every
   screen opens by continuing from what the learner just did; the teacher
   explains *after* the learner acts (`run.debrief`, `investigate.explanation`,
   `modify.debrief`).
5. **Language an 8–9-year-old can read; content and respect for an adult.**

The contract spells each out; the Detector checks them as F1–F15.

## PRIMM as the lesson skeleton

Predict → Run → Investigate → Modify → Make, one screen and one main action
each, 8–12 minutes in all. The skeleton never changes, which keeps the path
predictable for learners and checkable at scale. Variety comes first from a
different real-life job in every lesson, then from the action chosen inside a
phase for what the learner must figure out — never from reskinned buttons.
The contract lists the actions that exist today and those that do not yet.

PRIMM's authors allow phases to span lessons; completing all five in one lesson
is our product choice. Adult AI self-study is an application of a programming
method; classroom effect sizes do not transfer automatically. Lessons whose
capability cannot or should not run live (voice cloning, account actions) need
a clearly labelled demonstration in Run, which the product does not support
yet — report such an outline entry rather than faking a live run.

## Truth and honesty (unchanged, non-negotiable)

- Every lesson carries meaningful real-world material: a verified case, record,
  image, recording, code or reproducible observation, cited beside where it
  matters. Only verified sources; a new one is researched, its quote checked
  against the page, and its evidence recorded before any writer may use it.
- Keep source fact, authored practice, authored simulation, captured real run
  and current live run distinct. Practice material is labelled as practice in
  its label, never inside the text sent to AI.
- Run executes exactly the visible request and material. A failed live run
  keeps the learner's work and allows retry; it never falls back to a canned
  answer. Debriefs are written to stay true for any plausible live output.
- Make is the one independent task, bound to the existing exercise identity
  with a semantic rubric; pass, fail and undecided stay distinct. No extra quiz.
- Keep every existing source, asset, card and exercise identity; new revisions
  only, through the native CLI. Never hand-edit generated delivery JSON or old
  revision bytes. Publication is separate and not authorized by this skill.

## Production

Use the production line in [primm-pipeline.md](references/primm-pipeline.md):
packet → Writer → machine checks with real local runs → independent beginner
Detector → Fixer (≤2 rounds) → Gemini Flash polish and translation → native
dry-run → land → browser play. Writer/Fixer and Detector are different model
families. A person may still intervene, but every hand edit is logged with the
pipeline's `note` stage; an unlogged edit makes the run a manual lesson.

After a batch, promote each new failure class the Detector found into the
contract as a rule (with the lesson that exposed it in the principles file),
so the next batch avoids it unaided. When a run reports only classes the
contract already names, the Detector's job is shrinking as designed.

## Acceptance

[checklist.md](references/checklist.md) governs. In short: play every phase in
the real product at desktop and phone width, with keyboard, a wrong
prediction, a failed and retried run, exit and resume; read the teacher's lines
in order; confirm the case, practice and Make roles are distinct; keep model,
source, native and verification receipts. Tests and model reviews prove
behaviour and plausibility, not that a real person learned. Say so.

The pilot lessons (`first-useful-step`) are regression samples. Their stories,
materials and sentences are never templates for another lesson.
