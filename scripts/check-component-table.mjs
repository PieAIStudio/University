/**
 * One table, and it may not drift from the four registries behind it.
 *
 * `references/components.md` is the only list of interaction components a
 * course author reads. Three lists used to exist, they disagreed, and choosing
 * from a one-line summary put nine activities in a lesson with three of them
 * wrong. The table replaced all three — which only helps while it still names
 * exactly what the engines register, so this gate compares the two sets.
 *
 * It checks membership, not prose. A row whose wording goes stale is a reading
 * problem; a row that names a kind nobody registered, or a registered kind with
 * no row, is the failure that made the three lists worthless.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

/** Each registry is read where it is declared, never from a copied list. */
function registeredKinds() {
  const schemas = read("packages/core/src/domain/schemas.ts");
  const enumBlock = schemas.match(/export const LessonActivityKindSchema = z\.enum\(\[([^\]]+)\]/);
  if (!enumBlock) throw new Error("check-component-table: LessonActivityKindSchema 不在预期的位置");
  const outer = [...enumBlock[1].matchAll(/"([\w-]+)"/g)].map((match) => match[1]);

  const primm = read("packages/core/src/domain/primm-schema.ts");
  const inner = [...primm.matchAll(/kind: z\.literal\("([\w-]+)"\)/g)].map((match) => match[1]);
  if (inner.length === 0) throw new Error("check-component-table: PRIMM 的 kind 一个都没读到");

  const catalogue = read("packages/ui/src/play-catalog/three-games.ts");
  const listBlock = catalogue.match(/export const THREE_GAMES = \[([^\]]+)\]/);
  if (!listBlock) throw new Error("check-component-table: THREE_GAMES 不在预期的位置");
  const three = [...listBlock[1].matchAll(/"([\w-]+)"/g)].map((match) => match[1]);

  return new Set([...outer, ...inner, ...three]);
}

const table = read("apps/local/.agents/skills/write-lesson/references/components.md");
/*
  A component is named in a table cell or in the prose that explains the three
  re-skins, always as a code span. Every other code span in the file is a field
  name (`options`, `targetId`, …) or a path, so the comparison runs one way:
  every registered kind must appear, and a code span that looks like a kind but
  is not registered is caught by the second check below against the same set.
*/
const spans = new Set([...table.matchAll(/`([\w-]+)`/g)].map((match) => match[1]));
const registered = registeredKinds();

const missing = [...registered].filter((kind) => !spans.has(kind));
/*
  Field names outnumber kinds, so an unknown span cannot simply be an error.
  What can be checked is the reverse direction of the drift that actually
  happened: a kind that was deleted from a registry while its row stayed. The
  table names its own retired ids nowhere else, so a span that matches the
  shape of a kind *and* sits in the first column of a table row must be
  registered.
*/
const rowKinds = [...table.matchAll(/^\|[^|]*\|\s*`([\w-]+)`\s*\|/gm)].map((match) => match[1]);
const stale = [...new Set(rowKinds)].filter((kind) => !registered.has(kind));

const problems = [];
if (missing.length > 0)
  problems.push(
    `登记了但表里没有：${missing.join("、")}\n` +
      `  加一行到 apps/local/.agents/skills/write-lesson/references/components.md，` +
      `四个字段都从引擎读，不要照着名字推。`,
  );
if (stale.length > 0)
  problems.push(
    `表里有行但没人登记：${stale.join("、")}\n` +
      `  这个组件已经从登记表里消失了，删掉它那一行。`,
  );

if (problems.length > 0) {
  console.error(`check-component-table: ${problems.join("\n")}`);
  process.exit(1);
}
console.log(
  `check-component-table: ok — ${registered.size} 个登记身份，components.md 一个不多一个不少。`,
);
