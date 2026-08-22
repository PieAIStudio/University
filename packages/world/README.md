# @pieai/university-world

The 3D scene. One implementation, so both shells can stand on the same world.

## Responsible

The archipelago, the course path, the colour pipeline that draws them, and the
DOM labels that sit on top. A shell hands it course nodes, a `ProgressSource`,
and a click handler.

## Not responsible

Lesson prose, cards, evidence, account, payment, or any shell's store. No
fetch, no localStorage, no SQLite. `packages/ui` stays at zero `three`
(ADR-0004). Authoring does not depend on this package yet (SPEC-0003 step 2).

## Public API

The `exports` map in `package.json` is the list. Deep paths, no `"./*"`
wildcard. Start at `src/index.ts`.

## Check

```bash
pnpm --filter @pieai/university-world typecheck
pnpm --filter @pieai/university-world test
grep -rn "three" packages/ui/src --include='*.ts' --include='*.tsx'
```

A unit test of the lesson reader must not have to stand up a WebGL mock.

## Stability

evolving — SPEC-0003 step 1. Delivery already imports it. Authoring does not.
Reviewed 2026-08-22.
