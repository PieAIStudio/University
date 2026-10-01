---
id: REF-KNOWLEDGE-CARD-AUTHORING-REQUEST
title: Authored Concept Links for the Knowledge Album
type: reference
status: active
canonical: true
owner: ai-assisted
created: 2026-09-29
last_reviewed: 2026-10-01
domain: course-authoring
tags:
  - v7
  - knowledge-cards
  - authoring
related:
  - PLAN-V7-05-BADGES-AND-CARDS
  - SPEC-0001
---

# Request to the write-lesson workflow: name the concepts actually taught

V7 task 05 now projects explicit `[[concept:<id>]]` links from authored prose
into both shelves, then derives the album and road sets from those same links.
It does not infer concepts from a title, an exercise answer or a card tag.
There is no second mapping file in the browser and no knowledge-card write.

## Measured publication gap

The delivery shelf generated on 2026-09-29 contains **93 lessons in six
courses; none carries an explicit concept link**. This is broader than task
05's original observation about 认识 AI alone:

| Study / course | Lessons | With concept links |
| --- | ---: | ---: |
| ai-literacy / understanding-ai | 36 | 0 |
| ai-literacy / ai-for-real-life | 30 | 0 |
| browser-ai / run-a-real-project-with-ai | 8 | 0 |
| browser-ai / make-the-cutout-app-yours | 9 | 0 |
| browser-ai / search-your-own-photos | 6 | 0 |
| browser-ai / when-a-project-is-too-big-to-read | 4 | 0 |

Reproduce by running the existing content import and reading `conceptIds` in
`apps/university/content/shelf.json`. This is a count of the published packages,
not every local draft. The normal lesson still earns its real XP, review cards
and badges. The album starts with its two existing head-start gifts, but finishing these
published lessons cannot truthfully announce a newly collected concept yet.
An unmarked road segment has no invented six-card set or fake complete 2/2 set.

Rechecked after integrating `1f3e7a1f` and rebuilding content on 2026-10-01:
the new first three lessons preserve their original identities, but still add
no explicit concept links. The table remains 0 linked lessons out of 93.
Completing that course revision is not evidence that this separate request is done.

The same 2026-10-01 source check also found a distinct version handoff gap:
all **213 review cards** in the six generated delivery packages lack an explicit
card `contentRevision`. The recovery package's card shape already omits it,
and the public-card allowlist does not carry it. Consequently the shelf's
`reviewCardRevisions` maps are empty. This must not be repaired by substituting
the lesson version or inferring mastery from an unversioned review record.
The exact per-course count is retained in
`SCRATCH/v7-execution/v7-content-card-audit.json`.

Before accepting earned album frames from revised course content, the owning
export/recovery and public projection contracts must carry each card's actual
declared revision, and the reader/scheduler must consume that same identity.
Adding concept links alone does not complete this boundary. Existing scheduler
cards remain usable; an empty version map deliberately supplies no album-memory
proof. This is a remaining contract/authoring dependency, not a claim that the
new first three lessons already satisfy task 05's earned-card acceptance.

The existing gift ids are `prompt` and `ai-basics`. The latter's current
catalogue title is **AI 应用基础**, and its description is about putting an AI
into a site/tool, rather than V7's introductory **AI 是什么**. Resolve that
semantic mismatch through the catalogue's authoring review; do not merely
print a new title over an unrelated definition or invent a 282nd unlocked
concept in the application.

## Requested authoring work

Use `apps/local/.agents/skills/write-lesson/SKILL.md`, its teaching contract and
native revision pipeline. For each revised lesson, link only the concepts the
learner actually encounters or applies. Resolve ids against the existing
concept catalogue; keep links readable in context, avoid padding a lesson with
unrelated glossary references, and preserve every existing source, card and
exercise identity. Introduce a missing concept through the catalogue's normal
authoring/review lane rather than a made-up id.

The source is the authored revision, not generated shelf JSON. Preserve
`SPEC-0001`: revision proposal, review and exact recovery-package publication
are separate acts. This request does not authorize paid model work or publish
new lesson versions. Task 05 did not edit any lesson bytes.

After a marked version is properly published, verify in both modes that its
actual links appear on the shelf; a failed/incomplete reading does not collect
them; completion shows the same ids in the chest and album; repeat completion
does not duplicate XP or scheduler cards. A completed road set may be shown
from these facts; its cosmetic grant still belongs to task 06's authoritative
server contract.

## Memory meaning

The current source links concepts to **lessons**, not one independently tested
concept per scheduler card. Album frames therefore summarize current-revision
course-review records from completed lessons that name the concept. The
current revision here is the review card's own declared version, not the
lesson's independent version; old or removed card records are excluded. The UI
states this limitation and calls 21-day stability an estimate. A future
per-concept assessment requires authored evidence and a reviewed contract, not
an opportunistic match of card ids, wording or tags.
