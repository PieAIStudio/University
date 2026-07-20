---
id: REPLACE-ME
title: Replace Me Donor Map
type: reference
status: draft
canonical: false
owner: ai-assisted
created: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
domain: architecture
tags:
  - donor-map
  - provenance
pinned: false
related: []
---

# REPLACE-ME: Replace Me Donor Map

This reference isolates what this product may reuse from the donor repository.
The donor is a source of parts, not a product template: research broadly,
isolate a donor map, and promote only current-phase needs.

## Donor Ref

- Source repository: `https://github.com/replace-me/replace-me`
- Intake commit (immutable pin for copied files): `<full 40-char SHA>`
- Research branch/ref: `main`
- Research commit: `<full 40-char SHA>`
- Latest stable tag observed during intake: `vX.Y.Z`

Copied files stay pinned to their original intake commit and hashes. Updating
the research pin never silently re-sources copied files.

## License And Provenance Readout

State the donor's code license, the license of every asset family taken, and
where each claim comes from (`LICENSE`, `CREDITS`, `README`). Explicitly name
anything that is not portable: paid packs, account-bound purchases, or
trademarked content.

## Direct Reuse

Immutable files copied byte-for-byte from the pinned intake commit. One row
per file.

| Id | Donor source path | Target path | License | SHA-256 | Bytes | Provenance |
| --- | --- | --- | --- | --- | ---: | --- |
| `replace-me` | `path/in/donor` | `path/in/product` | CC0-1.0 | `<sha256>` | 0 | `<claim source>` |

## Adapted And Pattern Reuse

Donor code rewritten for this product, and donor disciplines adopted without
copying code. One row per item.

| Donor source | Reuse class | Local adaptation |
| --- | --- | --- |
| `path/in/donor` | adapted code / adapted pattern / pattern | What this product keeps, changes, and rejects. |

## Not Available From The Donor

Product responsibilities the donor does not solve. Listing them prevents false
confidence that the donor already handles them.

## Future Candidates, Not Promoted

Observed in the donor, deliberately not taken in the current phase, plus the
condition that would revisit each item.

## Rejected Donor Items

What must not cross into this product, and why: license risk, product-identity
mismatch, scale mismatch, or wholesale-transplant risk.

## Verification Contract

The command that re-verifies pinned commit, source paths, licenses, per-file
SHA-256, byte sizes, and manifest coverage after any donated-file change:

```bash
replace-me-verifier
```
