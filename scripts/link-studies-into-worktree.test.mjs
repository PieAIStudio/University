import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseEnv } from "node:util";
import {
  linkMissing,
  projectPublicEnv,
  readWorktreeSettings,
  refreshE2EManifest,
  relocateNestedStudies,
  reservePorts,
} from "./link-studies-into-worktree.mjs";

const roots = [];
const temporary = () => {
  const root = mkdtempSync(join(tmpdir(), "university-worktree-"));
  roots.push(root);
  return root;
};
const put = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const marker = JSON.stringify({ schemaVersion: 1, product: "UniversityLocal" });
const publicEnv =
  "VITE_SWIMMER_BACKEND_SUPABASE_URL=https://example.invalid\n" +
  "VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY=sb_publishable_test\n";
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("links only missing paths without replacing tracked directories or user edits", () => {
  const root = temporary(),
    source = join(root, "source"),
    target = join(root, "target");
  put(join(source, "study/tracked.md"), "source");
  put(join(source, "study/private.md"), "private");
  put(join(source, "other/study.json"), "{}");
  put(join(target, "study/tracked.md"), "user edit");
  assert.equal(linkMissing(source, target), 2);
  assert.equal(readFileSync(join(target, "study/tracked.md"), "utf8"), "user edit");
  assert.equal(lstatSync(join(target, "study")).isDirectory(), true);
  assert.equal(readFileSync(join(target, "study/private.md"), "utf8"), "private");
  assert.equal(linkMissing(source, target), 0);
});

test("an existing broken study link is reported, not overwritten", () => {
  const root = temporary(),
    source = join(root, "source"),
    target = join(root, "target");
  put(join(source, "study.json"), "{}");
  mkdirSync(target);
  symlinkSync(join(root, "missing"), join(target, "study.json"));
  assert.throws(() => linkMissing(source, target), /Broken existing study link/);
  assert.equal(lstatSync(join(target, "study.json")).isSymbolicLink(), true);
});

test("projects only public browser fields, excluding deployment tokens, with private file mode", () => {
  const root = temporary(),
    source = join(root, "source.env"),
    target = join(root, "app/.env.local");
  put(source, publicEnv + "VERCEL_OIDC_TOKEN=do-not-copy\nOPENROUTER_API_KEY=do-not-copy\n");
  assert.equal(projectPublicEnv(source, target), true);
  assert.deepEqual(Object.keys(parseEnv(readFileSync(target, "utf8"))).sort(), [
    "VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY",
    "VITE_SWIMMER_BACKEND_SUPABASE_URL",
  ]);
  assert.equal(lstatSync(target).mode & 0o777, 0o600);
  assert.equal(readFileSync(source, "utf8").includes("do-not-copy"), true);
});

test("existing environment configuration is never replaced", () => {
  const root = temporary(),
    target = join(root, ".env.local");
  put(target, "OWNER_SETTING=keep\n");
  assert.equal(projectPublicEnv(join(root, "missing-source"), target), false);
  assert.equal(readFileSync(target, "utf8"), "OWNER_SETTING=keep\n");
});

test("missing public configuration fails before writing a misleading app env", () => {
  const root = temporary(),
    source = join(root, "source"),
    target = join(root, "target");
  put(source, "VERCEL_OIDC_TOKEN=not-public\n");
  assert.throws(() => projectPublicEnv(source, target), /Missing public app configuration/);
  assert.equal(existsSync(target), false);
});

test("a server key cannot masquerade as a browser publishable key", () => {
  const root = temporary(),
    source = join(root, "source"),
    target = join(root, "target");
  for (const key of [
    "sb_secret_test",
    "eyJ0eXAiOiJKV1QifQ." +
      Buffer.from('{"role":"service_role"}').toString("base64url") +
      ".signature",
  ]) {
    put(source, publicEnv.replace("sb_publishable_test", key));
    assert.throws(() => projectPublicEnv(source, target), /Refuse to project a server key/);
    assert.equal(existsSync(target), false);
  }
});

test("relocates a nested real isolation input intact and preserves its original access path", () => {
  const root = temporary(),
    nested = join(root, "apps/local/studies/studies");
  put(join(nested, ".university-local-root"), marker);
  put(join(nested, "fixture/study.json"), "isolated-input");
  const moved = relocateNestedStudies(root);
  assert.equal(moved, realpathSync(join(root, ".scratch/worktree-studies")));
  assert.equal(lstatSync(nested).isSymbolicLink(), true);
  assert.equal(readFileSync(join(nested, "fixture/study.json"), "utf8"), "isolated-input");
  assert.equal(relocateNestedStudies(root), moved);
});

test("conflicting isolation destinations preserve both originals", () => {
  const root = temporary(),
    nested = join(root, "apps/local/studies/studies");
  put(join(nested, ".university-local-root"), marker);
  put(join(root, ".scratch/worktree-studies/keep"), "another input");
  assert.throws(() => relocateNestedStudies(root), /relocation target exists/);
  assert.equal(lstatSync(nested).isDirectory(), true);
});

test("rebases only the generated E2E manifest and leaves captured evidence and canonical input intact", () => {
  const root = temporary(),
    canonical = join(root, "apps/university/src/content/imported.json");
  put(canonical, '{"studies":[{"studyId":"current"}]}');
  put(join(root, ".scratch/evidence2/e2e-imported.json"), '{"studies":["old","catalogue"]}');
  put(join(root, ".scratch/evidence2/receipt.json"), "original evidence");
  refreshE2EManifest(root);
  assert.equal(
    readFileSync(join(root, ".scratch/evidence2/e2e-imported.json"), "utf8"),
    readFileSync(canonical, "utf8"),
  );
  assert.equal(
    readFileSync(join(root, ".scratch/evidence2/receipt.json"), "utf8"),
    "original evidence",
  );
});

test("does not write through a symlinked E2E manifest", () => {
  const root = temporary(),
    outside = join(root, "owner-file");
  put(join(root, "apps/university/src/content/imported.json"), "current");
  put(outside, "keep");
  mkdirSync(join(root, ".scratch/evidence2"), { recursive: true });
  symlinkSync(outside, join(root, ".scratch/evidence2/e2e-imported.json"));
  assert.throws(() => refreshE2EManifest(root), /symlinked E2E manifest/);
  assert.equal(readFileSync(outside, "utf8"), "keep");
});

test("allocates four distinct ports, rejects occupied listeners, and releases its own reservations", async () => {
  const reservation = await reservePorts([0, 0, 0, 0]);
  try {
    assert.equal(new Set(reservation.ports).size, 4);
    await assert.rejects(reservePorts([reservation.ports[3]]), /is unavailable/);
  } finally {
    await reservation.release();
  }
  const second = await reservePorts(reservation.ports);
  await second.release();
});

test("rejects duplicate or invalid explicit ports before preparing anything", async () => {
  for (const ports of [[12345, 12345], [-1], [65536], [NaN]]) {
    await assert.rejects(reservePorts(ports), /distinct integers/);
  }
});

test("worktree settings are opt-in and read from the supplied checkout, not cwd", () => {
  const root = temporary();
  assert.deepEqual(readWorktreeSettings(root), {});
  const settings = { studiesRoot: "/explicit/source", ports: { E2E_GRADING_PORT: 21096 } };
  put(join(root, ".scratch/worktree.json"), JSON.stringify(settings));
  assert.deepEqual(readWorktreeSettings(root), settings);
});

test("every browser spec takes ports from the shared entry, including synthetic planet fixtures", () => {
  const directory = new URL("../e2e/", import.meta.url);
  const specs = readdirSync(directory, { recursive: true }).filter((name) =>
    name.endsWith(".spec.ts"),
  );
  assert.ok(specs.length > 0, "No browser specs were scanned");
  const ownPort =
    /process\.env(?:\.E2E_(?:ONLINE|LOCAL_WEB|LOCAL_API|GRADING)_PORT|\[["']E2E_(?:ONLINE|LOCAL_WEB|LOCAL_API|GRADING)_PORT["']\])|https?:\/\/(?:127\.0\.0\.1|localhost):1809[3-6]/;
  for (const spec of specs) {
    assert.doesNotMatch(readFileSync(new URL(spec, directory), "utf8"), ownPort, spec);
  }
});
