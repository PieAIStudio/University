# Provenance

This package copies the Gloss procedural character generator from
[kindergrimm](https://github.com/albertobeiz/kindergrimm).

- Repository: `https://github.com/albertobeiz/kindergrimm.git`
- License: Unlicense (public domain). The original `LICENSE` is Unlicense;
  the software may be copied, modified, and used commercially.
- Cloned: 2026-08-22
- Commit: `811214c6dd5de18cc20335cd3d4ab0a06e45ffd4`

Copied verbatim (original filenames and comments kept):

- `src/gloss/**` → `packages/avatar/src/gloss/`
- `src/rng.js` → `packages/avatar/src/rng.js`

`rng.js` is not inside `src/gloss/`, but `grig.js` and `gtexture.js` import it
as `../rng.js`. It is copied as a sibling so those imports keep working
without rewriting the generator.
