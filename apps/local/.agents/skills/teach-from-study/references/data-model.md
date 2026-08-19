# UniversityLocal learning data model

Use this reference when creating, revising, validating, or locating study artifacts.

## Study layout

```text
studies/<study-id>/
  study.json
  source/
    registration.json
    repository.git/
    snapshots/<snapshot-id>.json
  ua/<analysis-id>/
    manifest.json
    data/
    workspace/                         # preparing only; removed after finalize/failure cleanup
  courses/<course-id>/
    course.json
    units/<unit-id>/
      unit.json
      lessons/<lesson-id>/
        latest.json
        revisions/<revision>/
          manifest.json
          content.md
        exercises/<exercise-id>/
          latest.json
          revisions/<revision>/exercise.json
        cards/<card-id>/
          latest.json
          revisions/<revision>/card.json
  learner/
    learning.sqlite
    backups/
```

`source/repository.git` is a UniversityLocal-owned shallow bare Git repository. Snapshot manifests
bind an exact commit and tree; they do not keep a permanent checkout. UA gets a disposable Git
worktree whose `.ua` path maps into the analysis directory, then UniversityLocal removes that
worktree after finalization. The studied repository is never the storage location.

## Required evidence

Each teaching claim binds to:

- `kind`: `fact` or `inference`
- `snapshotId` and full `sourceCommit`
- normalized repository-relative `sourcePath`
- optional `lineStart` and `lineEnd`
- paired `analysisId` and `graphHash` when UA is used
- stable `nodeIds` when the claim depends on graph nodes

Do not use a branch name, mutable `HEAD`, live working tree, or UA node ID alone as durable evidence.

## Lifecycles

- Source snapshot: immutable `ready` manifest created only after the commit/tree is available
- UA analysis: `preparing → ready | failed`; `legacy-import` is historical input
- Teaching content: `draft → active → stale → active`, or `active|stale → retired`
- Learner events: append-only; card state is a projection updated in the same transaction

Course publication is bottom-up. Every declared unit and lesson must exist, all latest lesson/card/
exercise content must be `active`, hashes and evidence must still validate, then units and finally the
course may become `active`. Course and unit roots are created as `draft`; pre-activated containers are
rejected.

## Identity rules

- A `study` represents one studied project or durable subject.
- A study may contain multiple courses, but only one active course is its default at a time.
- A source commit may have multiple UA analyses because engine version, config, language, and generated result can differ.
- Course content and learner state are not UA output and must survive UA regeneration.
- Learner identities are scoped: `courseId/unitId/lessonId`, plus `cardId` or `exerciseId` where
  applicable. Never key learner data by a leaf ID alone.

## Write rules

- Use repository APIs; do not construct these paths with ad hoc writes.
- Course/unit creation and every revision use staging plus same-filesystem rename.
- `latest.json` is the only mutable content pointer. A committed revision is immutable.
- A retry may finish an interrupted pointer update only when manifest, content, and hash are exactly
  identical. Conflicts are rejected and never overwritten.
- An active or retired course/unit is not editable. Mark active parents `stale` before revising child
  content, then revalidate and reactivate.
