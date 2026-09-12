import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("./check-lesson-activities.mjs", import.meta.url));

/*
  The difficulty family, checked on both copies of a lesson.

  The rules landed on the walk over `studies/` and not on the walk over the
  delivery package, so the first lesson ever to author three levels passed on
  disk and failed on delivery: to the only copy a customer holds, the two extra
  levels looked like activities the prose never references. A feature that
  cannot ship is not shipped, and the gate said so at the far end of the pipe,
  after the content had already been written and exported.

  Both walks call one function now. These tests are what keeps that true — they
  drive the script the way CI does, against a studies root and a delivery root
  built for the occasion, and every failure case is asserted on the delivery
  side, because that is the side that was blind.
*/

const NODES = [
  { id: "x", label: "X", note: "n", x: 20, y: 20 },
  { id: "y", label: "Y", note: "n", x: 80, y: 20 },
];

function level(id: string, difficulty: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: "connect",
    role: "apply",
    family: "fam",
    difficulty,
    title: "t",
    brief: "b",
    goal: "g",
    takeaway: "k",
    hint: "h",
    nodes: NODES,
    edges: [{ from: "x", to: "y", why: "w" }],
    probes: [{ label: "p", path: ["x", "y"] }],
    ...overrides,
  };
}

const CONTENT = "# t\n\n## 答案\n\nx\n\n::play{#a-intro}\n\n## 自检\n\ny\n";

/** A studies root and its delivery projection, both carrying the same levels. */
function campus(activities: readonly Record<string, unknown>[], delivered = activities) {
  const root = mkdtempSync(join(tmpdir(), "university-activities-"));
  const studies = join(root, "apps", "local", "studies");
  const lesson = join(studies, "s", "courses", "c", "units", "u", "lessons", "l");
  mkdirSync(join(lesson, "revisions", "1"), { recursive: true });
  writeFileSync(
    join(lesson, "latest.json"),
    JSON.stringify({ schemaVersion: 1, id: "l", contentRevision: 1 }),
  );
  writeFileSync(join(lesson, "revisions", "1", "content.md"), CONTENT);
  writeFileSync(
    join(lesson, "revisions", "1", "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "l",
      title: "t",
      courseId: "c",
      unitId: "u",
      exerciseIds: [],
      cardIds: [],
      contentRevision: 1,
      contentHash: "sha256:0",
      status: "active",
      evidence: [],
      sections: [],
      assets: [],
      activities,
      variant: "现象",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
  );

  const delivery = join(root, "apps", "university", "content", "s");
  mkdirSync(delivery, { recursive: true });
  writeFileSync(
    join(delivery, "c.json"),
    JSON.stringify({
      units: [{ id: "u", lessons: [{ id: "l", content: CONTENT, activities: delivered }] }],
    }),
  );
  return { root, studies };
}

function check(
  activities: readonly Record<string, unknown>[],
  delivered?: Record<string, unknown>[],
) {
  const { root, studies } = campus(activities, delivered);
  try {
    const result = spawnSync(process.execPath, [SCRIPT, studies], { encoding: "utf8" });
    return { status: result.status, out: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("check-lesson-activities · difficulty families", () => {
  const healthy = [level("a-intro", "intro"), level("a-practice", "practice")];

  it("accepts a family the prose references once, on disk and in delivery", () => {
    const result = check(healthy);
    expect(result.out).toContain("交付包里另核对 1 节");
    expect(result.status).toBe(0);
  });

  /*
    The exact regression. A level whose `family` went missing is no longer part
    of the set, so nothing in the prose can reach it — and before both walks
    shared one implementation, only the studies walk said so.
  */
  it("catches a level that lost its family in the delivery package", () => {
    const result = check(healthy, [
      healthy[0]!,
      level("a-practice", "practice", { family: undefined }),
    ]);
    expect(result.status).toBe(1);
    expect(result.out).toContain("交付包里有组件 a-practice");
  });

  it("catches two levels at the same difficulty in the delivery package", () => {
    const result = check(healthy, [healthy[0]!, level("a-practice", "intro")]);
    expect(result.status).toBe(1);
    expect(result.out).toContain("难度组 fam 里有两个组件难度相同");
  });

  /*
    One engine carries all three levels — that is what makes them one activity.
    A set that changed engine between levels would swap a connect board for a
    sort board when the learner moved the picker, which reads as a fault.
  */
  it("catches a family that changed engine between levels", () => {
    const result = check(healthy, [healthy[0]!, level("a-practice", "practice", { kind: "sort" })]);
    expect(result.status).toBe(1);
    expect(result.out).toContain("混了 connect、sort");
  });

  it("catches a marker pointing at an id the delivery package does not carry", () => {
    const result = check(healthy, [level("a-renamed", "intro"), healthy[1]!]);
    expect(result.status).toBe(1);
    expect(result.out).toContain("正文引用了 ::play{#a-intro}，交付包里没有它");
  });
});
