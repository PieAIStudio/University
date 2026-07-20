import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  STUDIES_ROOT_MARKER,
  assertSeparatedRoots,
  initializeExternalStudiesRoot,
  loadUniversityLocalConfig,
} from "./load-config.js";

function makeProject(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "university-local-config-"));
  mkdirSync(join(projectRoot, "studies"));
  writeFileSync(
    join(projectRoot, "university-local.config.json"),
    JSON.stringify({ schemaVersion: 1, studiesRoot: "./studies" }),
  );
  return projectRoot;
}

describe("UniversityLocal config", () => {
  it("resolves the default studies root relative to the project, not cwd", () => {
    const projectRoot = makeProject();
    const config = loadUniversityLocalConfig({ projectRoot, env: {} });
    expect(config.studiesRoot).toBe(join(realpathSync(projectRoot), "studies"));
  });

  it("applies env, local file, tracked file and default precedence", () => {
    const projectRoot = makeProject();
    writeFileSync(
      join(projectRoot, "university-local.config.local.json"),
      JSON.stringify({ schemaVersion: 1, studiesRoot: "./local-studies" }),
    );
    const external = mkdtempSync(join(tmpdir(), "university-local-external-studies-"));
    writeFileSync(
      join(external, STUDIES_ROOT_MARKER),
      '{"schemaVersion":1,"product":"UniversityLocal"}\n',
    );
    const config = loadUniversityLocalConfig({
      projectRoot,
      env: { UNIVERSITY_LOCAL_STUDIES_ROOT: external },
    });
    expect(config.studiesRoot).toBe(realpathSync(external));
  });

  it("rejects a filesystem root and a root that contains the project", () => {
    const projectRoot = makeProject();
    expect(() =>
      loadUniversityLocalConfig({
        projectRoot,
        env: { UNIVERSITY_LOCAL_STUDIES_ROOT: "/" },
      }),
    ).toThrow(/dedicated directory/);
    expect(() =>
      loadUniversityLocalConfig({
        projectRoot,
        env: { UNIVERSITY_LOCAL_STUDIES_ROOT: tmpdir() },
      }),
    ).toThrow(/contain the project checkout/);
  });

  it("rejects project-internal aliases, uninitialized external roots and unknown keys", () => {
    const projectRoot = makeProject();
    expect(() =>
      loadUniversityLocalConfig({
        projectRoot,
        env: { UNIVERSITY_LOCAL_STUDIES_ROOT: "./src" },
      }),
    ).toThrow(/default studies directory/);

    const external = mkdtempSync(join(tmpdir(), "university-local-unmarked-studies-"));
    expect(() =>
      loadUniversityLocalConfig({
        projectRoot,
        env: { UNIVERSITY_LOCAL_STUDIES_ROOT: external },
      }),
    ).toThrow(/missing .university-local-root/);

    writeFileSync(
      join(projectRoot, "university-local.config.local.json"),
      JSON.stringify({ schemaVersion: 1, studyRoot: "./typo" }),
    );
    expect(() => loadUniversityLocalConfig({ projectRoot, env: {} })).toThrow();
  });

  it("initializes only an empty external data root", () => {
    const projectRoot = makeProject();
    const container = mkdtempSync(join(tmpdir(), "university-local-init-container-"));
    const external = join(container, "campus-data");
    expect(initializeExternalStudiesRoot(projectRoot, external)).toBe(realpathSync(external));
    expect(
      loadUniversityLocalConfig({
        projectRoot,
        env: { UNIVERSITY_LOCAL_STUDIES_ROOT: external },
      }).studiesRoot,
    ).toBe(realpathSync(external));

    const occupied = join(container, "occupied");
    mkdirSync(occupied);
    writeFileSync(join(occupied, "unrelated.txt"), "do not adopt\n");
    expect(() => initializeExternalStudiesRoot(projectRoot, occupied)).toThrow(/non-empty/);
  });

  it("rejects source and studies roots that overlap after symlink resolution", () => {
    const projectRoot = makeProject();
    const studiesRoot = join(projectRoot, "studies");
    const sourceRoot = join(studiesRoot, "source");
    mkdirSync(sourceRoot);
    expect(() => assertSeparatedRoots(studiesRoot, sourceRoot)).toThrow(/must be separate/);

    const external = mkdtempSync(join(tmpdir(), "university-local-source-"));
    const alias = join(projectRoot, "source-alias");
    symlinkSync(external, alias);
    expect(() => assertSeparatedRoots(studiesRoot, alias)).not.toThrow();

    const sourceContainer = mkdtempSync(join(tmpdir(), "university-local-containing-source-"));
    const nestedStudiesRoot = join(sourceContainer, "private-studies");
    mkdirSync(nestedStudiesRoot);
    expect(() => assertSeparatedRoots(nestedStudiesRoot, sourceContainer)).toThrow(
      /must be separate/,
    );
  });
});
