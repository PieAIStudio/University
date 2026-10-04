import { describe, expect, it } from "vitest";
import {
  ActivitySourceSchema,
  LessonActivitySchema,
  LessonManifestSchema,
  interactionLessonIssues,
} from "../domain/schemas.js";
import { primmLessonIssues } from "./primm-lesson.js";
import { primmStepsFixture } from "./fixtures/primm-steps.js";
import { activityDisplayStrings, localizeActivity } from "./localization.js";

const activity = structuredClone(primmStepsFixture);
const evidence = activity.sources.map((source) => ({
  kind: "fact",
  sourceUrl: "url" in source.reference ? source.reference.url : undefined,
  sourceTitle: source.reference.label,
  sourceAuthority: "first-party",
  provenance: {
    type: "official-document",
    publisher: source.reference.label,
    accessedOn: "2026-10-05",
    supports: source.summary,
    limitations: source.limitation,
  },
}));
const fixture = {
  activities: [activity],
  evidence,
  content: `# A question?\n\n::play{#${activity.id}}\n`,
  assets: ["everyday-coffee", "everyday-cat"].map((id) => ({
    id,
    kind: "diagram",
    path: `${id}.png`,
    sha256: `sha256:${"a".repeat(64)}`,
    mime: "image/png",
    bytes: 1,
    alt: id,
  })),
  exercises: [{ id: activity.make.exerciseId, kind: "explain", evidence }],
};
type Fixture = typeof fixture;
const withActivity = (next: unknown) => ({ ...fixture, activities: [next] });

// These native bindings and localization guards survived the V1/V2 retirement.
// Their fixture now uses the same V3 wire contract as the delivered lessons.
describe("PRIMM lesson source, asset and Make bindings", () => {
  it.each<[string, (lesson: Fixture) => unknown]>([
    ["missing source evidence", (l) => ({ ...l, evidence: [] })],
    [
      "changed source identity",
      (l) => ({
        ...l,
        evidence: l.evidence.map((e) => ({ ...e, sourceUrl: `${e.sourceUrl}other` })),
      }),
    ],
    ["no exercise", (l) => ({ ...l, exercises: [] })],
    ["duplicate exercise ID", (l) => ({ ...l, exercises: [...l.exercises, ...l.exercises] })],
    ["wrong Make ID", (l) => ({ ...l, exercises: [{ ...l.exercises[0], id: "other" }] })],
    ["non-explain exercise", (l) => ({ ...l, exercises: [{ ...l.exercises[0], kind: "choice" }] })],
    ["exercise omits source", (l) => ({ ...l, exercises: [{ ...l.exercises[0], evidence: [] }] })],
    [
      "exercise changes source",
      (l) => ({
        ...l,
        exercises: [
          {
            ...l.exercises[0],
            evidence: l.evidence.map((e) => ({ ...e, sourceUrl: `${e.sourceUrl}other` })),
          },
        ],
      }),
    ],
    ["manifest/body disagreement", (l) => ({ ...l, exerciseIds: ["different"] })],
    ["duplicated activity", (l) => ({ ...l, activities: [...l.activities, ...l.activities] })],
    [
      "unknown starter asset",
      () => withActivity({ ...activity, starter: { ...activity.starter, assetIds: ["unknown"] } }),
    ],
    [
      "unknown Make asset",
      () => withActivity({ ...activity, make: { ...activity.make, assetIds: ["unknown"] } }),
    ],
    [
      "unknown material asset",
      () =>
        withActivity({
          ...activity,
          materials: activity.materials.map((m) => ({ ...m, assetId: "unknown" })),
        }),
    ],
    [
      "vision without image",
      (l) => ({ ...l, assets: l.assets.map((a) => ({ ...a, mime: "text/plain" })) }),
    ],
    [
      "transcribe without media",
      () => withActivity({ ...activity, make: { ...activity.make, operation: "transcribe" } }),
    ],
    ["missing marker", (l) => ({ ...l, content: "recap" })],
    ["duplicate marker", (l) => ({ ...l, content: `${l.content}\n::play{#${activity.id}}` })],
    ["wrong marker ID", (l) => ({ ...l, content: "::play{#another}" })],
    ["wrong marker spelling", (l) => ({ ...l, content: `::play{id=${activity.id}}` })],
    ["inline extra marker", (l) => ({ ...l, content: `${l.content}\ntext ::play{#extra}` })],
  ])("rejects %s", (_, change) => {
    expect(interactionLessonIssues(change(fixture) as Fixture).length).toBeGreaterThan(0);
  });

  it("requires every named source even if the primary source is present", () => {
    const extra = {
      ...activity.sources[0]!,
      id: "another",
      reference: {
        label: activity.sources[0]!.reference.label,
        url: "https://example.org/another",
      },
    };
    expect(
      interactionLessonIssues(
        withActivity({ ...activity, sources: [...activity.sources, extra] }),
      ).join(),
    ).toContain("absent from lesson evidence");
  });

  it("accepts IDs-only manifests while binding the exact single Make ID", () => {
    const { exercises, ...lesson } = fixture;
    const manifest = {
      ...lesson,
      schemaVersion: 1,
      id: "photo-lesson",
      title: "Photo",
      courseId: "course-id",
      unitId: "unit-id",
      exerciseIds: [exercises[0]!.id],
      contentRevision: 2,
      contentHash: `sha256:${"a".repeat(64)}`,
      status: "active",
      createdAt: "2026-10-04T00:00:00Z",
      updatedAt: "2026-10-04T00:00:00Z",
    };
    expect(interactionLessonIssues(manifest)).toEqual([]);
    const { content: _content, ...stored } = manifest;
    const parsed = LessonManifestSchema.safeParse(stored);
    expect(parsed.success, parsed.error?.message).toBe(true);
    expect(LessonManifestSchema.safeParse({ ...stored, exerciseIds: ["missing"] }).success).toBe(
      false,
    );
  });

  it("checks exact pinned repository identity and the complete cited line range", () => {
    const reference = {
      label: activity.sources[0]!.reference.label,
      path: "src/button.ts",
      commit: "a".repeat(40),
      line: 5,
      lineEnd: 8,
    };
    const next = {
      ...activity,
      sources: activity.sources.map((source, index) =>
        index === 0 ? { ...source, reference } : source,
      ),
    };
    const pinned = {
      sourcePath: reference.path,
      sourceCommit: reference.commit,
      lineStart: 2,
      lineEnd: 10,
    };
    const linked = [...evidence, pinned];
    const lesson = {
      ...withActivity(next),
      evidence: linked,
      exercises: [{ ...fixture.exercises[0]!, evidence: linked }],
    };
    expect(ActivitySourceSchema.safeParse(reference).success).toBe(true);
    expect(interactionLessonIssues(lesson)).toEqual([]);
    expect(
      interactionLessonIssues({
        ...lesson,
        evidence: [...evidence, { ...pinned, lineEnd: 6 }],
      }).join(),
    ).toContain("absent");
    expect(
      interactionLessonIssues({
        ...lesson,
        exercises: [
          { ...fixture.exercises[0]!, evidence: [{ ...pinned, sourceCommit: "b".repeat(40) }] },
        ],
      }).join(),
    ).toContain("omits source identity");
  });

  it("resolves inspected/material assets and requires media appropriate to the operation", () => {
    expect(interactionLessonIssues(fixture)).toEqual([]);
    expect(interactionLessonIssues({ ...fixture, assets: [] }).join()).toContain(
      "Unknown PRIMM lesson asset",
    );
    expect(
      interactionLessonIssues({
        ...fixture,
        assets: fixture.assets.map((a) => ({ ...a, mime: "audio/wav" })),
      }).join(),
    ).toContain("requires an image");
    expect(
      interactionLessonIssues({
        ...fixture,
        assets: [...fixture.assets, ...fixture.assets],
      }).join(),
    ).toContain("Duplicate");
    const next = { ...activity, starter: { ...activity.starter, assetIds: [] } };
    expect(primmLessonIssues(next, next, withActivity(next)).join()).toContain(
      "omits material asset",
    );
    expect(primmLessonIssues(next, next, withActivity(next)).join()).toContain(
      "absent from starter",
    );
  });
});

describe("PRIMM localization is display-only", () => {
  it.each(activityDisplayStrings(activity))("requires English display text: %s", (text) => {
    const strings = { ...activity.locales!.en!.strings };
    delete strings[text];
    expect(
      LessonActivitySchema.safeParse({ ...activity, locales: { en: { strings } } }).success,
    ).toBe(false);
  });

  it("localizes authored requests while preserving identifiers, rules and unknown runtime output", () => {
    const wire = { ...activity, runtime: { text: activity.title, title: activity.title } };
    const translated = localizeActivity(wire, "en");
    expect(translated.title).not.toBe(activity.title);
    expect(translated.starter.prompt).not.toBe(activity.starter.prompt);
    expect(translated.make.exerciseId).toBe(activity.make.exerciseId);
    expect(translated.materials[0]!.sourceId).toBe(activity.materials[0]!.sourceId);
    expect(translated.runtime).toEqual(wire.runtime);
  });

  it("rejects missing or blank locale dictionaries", () => {
    expect(LessonActivitySchema.safeParse({ ...activity, locales: undefined }).success).toBe(false);
    expect(
      LessonActivitySchema.safeParse({
        ...activity,
        locales: { en: { strings: { [activity.title]: " " } } },
      }).success,
    ).toBe(false);
  });
});
