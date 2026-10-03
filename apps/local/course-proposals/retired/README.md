# Retired course archive

Owner T1 on 2026-10-02 retired all old courses and retained only the accepted
first three V3 lessons. Task 13 applied that decision on 2026-10-03. This area
is never an input to delivery; all ordinary import, catalogue and freshness
commands still read `../recovery/` alone.

`task13-20261003/ai-literacy/recovery/` and `browser-ai/recovery/` hold the full
native exports from immediately before retirement, including their hash-verified
indices. Each adjacent `receipt.json` names the exact removed lesson identities
and original hashes. The three retained lessons are exported by the native CLI
into the active recovery area without changing their revision or lesson bytes.
The new task 12 fourth lesson is isolated, unpublished and absent from this
archive and the active export; its old predecessor is archived.

`task13-20261003/history/recovery/` preserves every previously tracked recovery
object and both original indices. `task13-20261003/locked/` preserves the former
locked `turing-pact`, `general` and `ai-foundations` packages intact. These studies
and all four `browser-ai` courses are retired, not pending restoration.

Recovery uses the existing native CLI in a scratch authoring project:

```sh
UNIVERSITY_LOCAL_STUDIES_ROOT=/absolute/path/to/marked/scratch/studies \
pnpm --filter @pieai/university-local university course recovery import \
  --study ai-literacy --input /absolute/path/to/retired/task13-20261003/ai-literacy/recovery \
  --dry-run
```

Use an isolated, configured studies root for the real import, then re-export and
compare course hashes. Public-source AI-literacy courses need no external source
checkout. Repository-backed recovery retains its original evidence requirements:
use its exact registered source commits, not an invented substitute. Ignored
`native/` backups beside the two new receipts preserve the original local course,
source mirror and language files for rollback; they exclude learner databases.
Git-tracked immutable recovery packages are the portable course archive.
Learner progress, answers and review history stay in their original stores;
retirement changes availability, never those records. Moving this content tree
out of the product repository belongs to task 14.

`task13-20261003/native-local/` also preserves the complete retired local
course trees for `turing-pact`, `general` and `ai-foundations`. Their source
snapshots and learner stores were not moved. The 67 formerly tracked native
files remain tracked at their archive paths; other private native files stay
ignored. Recovery packages above remain the portable restore entry.
