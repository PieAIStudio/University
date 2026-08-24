# Studies

`studies/` is UniversityLocal's default private learning-data shelf. Each
studied subject gets one stable container:

```text
studies/
  <study-id>/
    study.json
    source/
    ua/
    courses/
    notes/
    learner/
```

The default root is this directory, matching AnvilLocal's `books/` mental
model. A local configuration may point the runtime at another studies root,
but it must preserve the same `<configured-studies-root>/<study-id>/` contract.

Personal study containers are ignored by the UniversityLocal source
repository. Do not commit source snapshots, UA artifacts, lessons, cards,
review history, or learner data here by accident. The product's application
code, schemas, skills, and governed architecture remain in the main repository.

External repositories are read-only study subjects by default. UniversityLocal
must not place `.ua`, lessons, cards, or notes into them without explicit user
authorization.

`courses/` is the reviewed textbook shelf. `notes/` is the owner's class notebook:
one useful follow-up question becomes one atomic Markdown note and may derive a
small number of cards. Both use the same evidence rules and learner scheduler.

This shelf is local authoring and study-source storage, not the learner
account's cross-device source of truth. Course prose, source snapshots, UA
artifacts, notes, and other authoring material remain here by design. Learner
progress, answers, marks, review state, vocabulary, favourites, practice
history, and settings use the shared SwimmerBackend account document; any
SQLite/browser copy here is only a cache, migration source, or offline outbox.
