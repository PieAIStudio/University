import { describe, expect, it } from "vitest";
import {
  ActivitySourceSchema,
  LessonActivitySchema,
  LessonManifestSchema,
  PrimmPayloadSchema,
  interactionLessonIssues,
} from "../domain/schemas.js";
import legacy from "../../fixtures/interaction-path.json";
import v2 from "../../fixtures/interaction-path-v2.json";
import { primmFixture, primmLessonFixture } from "./fixtures/primm.js";
import {
  activityDisplayStrings,
  activityTranslationIssues,
  localizeActivity,
} from "./localization.js";
import {
  PRIMM_PHASES,
  canContinuePrimmPrediction,
  isPrimmGameComplete,
  placePrimmSortCard,
  primmIssues,
  type PrimmActivity,
  type PrimmGame,
  type PrimmGameState,
} from "./primm.js";
import { createSortState } from "./sort.js";

const games = {
  "inspect-image": {
    kind: "inspect-image",
    assetId: "photo",
    instruction: "观察图片",
    regions: [
      { id: "left", label: "左侧", x: 0, y: 0.25, width: 0.5, height: 0.75, note: "描述可见细节" },
      { id: "right", label: "右侧", x: 0.5, y: 0, width: 0.5, height: 1, note: "写下观察" },
    ],
  },
  sort: primmFixture.investigate.game,
  layout: {
    kind: "layout",
    instruction: "调整段落顺序",
    items: [
      { id: "focus", label: "焦点", text: "先让按钮获得焦点。" },
      { id: "activate", label: "触发", text: "按 Enter 或空格。" },
    ],
    formats: [
      { id: "list", label: "列表" },
      { id: "paragraph", label: "段落" },
    ],
  },
  edit: {
    kind: "edit",
    targetId: "unsupported",
    instruction: "改掉无依据的句子",
    replacementHint: "只保留有依据的操作",
    sentences: [
      { id: "supported", text: "聚焦按钮。" },
      { id: "unsupported", text: "按任意键都会触发。" },
    ],
  },
  collect: {
    kind: "collect",
    instruction: "收集本任务的材料",
    cards: [
      {
        id: "relevant",
        label: "按钮记录",
        text: "按钮键盘操作",
        sourceId: "button-source",
        relevant: true,
        why: "是当前对象",
      },
      {
        id: "distractor",
        label: "另一个对象",
        text: "链接导航记录",
        sourceId: "button-source",
        relevant: false,
        why: "对象不同",
      },
    ],
  },
} satisfies Record<PrimmGame["kind"], PrimmGame>;

function candidate(kind: PrimmGame["kind"] = "sort"): PrimmActivity {
  const activity = structuredClone(primmFixture);
  activity.investigate.game = structuredClone(games[kind]);
  // Test-only copy for game variants; the exported UI fixture has hand-written bilingual copy.
  activity.locales = {
    en: {
      strings: Object.fromEntries(
        activityDisplayStrings(activity).map((text) => [text, `English: ${text}`]),
      ),
    },
  };
  return activity;
}

describe("PRIMM wire contract", () => {
  it("requires role-relevant content, not merely moving a prefiltered layout", () => {
    const activity = candidate("layout");
    if (activity.investigate.game.kind !== "layout") throw Error();
    const game = activity.investigate.game;
    game.selection = { keep: "保留", remove: "移开", check: "检查", ready: "已留好" };
    game.items = [
      ...game.items.map((item) => ({ ...item, relevant: true, why: "这项不能漏" })),
      {
        id: "other-role",
        label: "其他人的安排",
        text: "不属于我的任务",
        relevant: false,
        why: "不是你的任务",
      },
    ];
    const state = {
      kind: "layout" as const,
      itemIds: game.items.map((item) => item.id),
      formatId: "list",
    };
    expect(primmIssues(activity)).toEqual([]);
    expect(isPrimmGameComplete(game, state)).toBe(false);
    for (const includedItemIds of [
      state.itemIds,
      [],
      ["focus"],
      ["focus", "activate", "missing"],
      ["focus", "focus"],
    ])
      expect(isPrimmGameComplete(game, { ...state, includedItemIds })).toBe(false);
    expect(isPrimmGameComplete(game, { ...state, includedItemIds: ["activate", "focus"] })).toBe(
      true,
    );
    delete game.items[0]!.why;
    expect(primmIssues(activity)).toContain(
      "PRIMM selected layout needs explained relevant and irrelevant items",
    );
  });
  it("accepts a bilingual typed activity and a short recap with one marker", () => {
    expect(LessonActivitySchema.safeParse(primmFixture).success).toBe(true);
    expect(primmIssues(PrimmPayloadSchema.parse(primmFixture))).toEqual([]);
    expect(interactionLessonIssues(primmLessonFixture)).toEqual([]);
    expect(PRIMM_PHASES).toEqual(["predict", "run", "investigate", "modify", "make"]);
    expect(
      Object.keys(PrimmPayloadSchema.shape).filter((key) => PRIMM_PHASES.includes(key as never)),
    ).toEqual(PRIMM_PHASES);
    expect(primmFixture.make).not.toHaveProperty("rubric");
    expect(primmFixture.run).not.toHaveProperty("output");
  });

  it.each(PRIMM_PHASES)("requires the named %s phase", (phase) => {
    const input: Record<string, unknown> = structuredClone(primmFixture);
    delete input[phase];
    expect(LessonActivitySchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["method", (p: any) => (p.method = "primm")],
    ["reordered phase array", (p: any) => (p.phases = [...PRIMM_PHASES].reverse())],
    ["recursive steps", (p: any) => (p.investigate.steps = [primmFixture])],
    ["unknown root field", (p: any) => (p.content = "<html>")],
    ["preset run", (p: any) => (p.run.output = "fake result")],
    ["prefilled Make", (p: any) => (p.make.prompt = "whole solution")],
    ["Make rubric duplication", (p: any) => (p.make.rubric = "duplicated")],
    ["graded prediction", (p: any) => (p.predict.correctOptionId = "two-tips")],
    ["one prediction option", (p: any) => p.predict.options.pop()],
    [
      "five prediction options",
      (p: any) =>
        (p.predict.options = Array.from({ length: 5 }, (_, i) => ({
          id: `op-${i}`,
          label: "选项",
        }))),
    ],
    ["duplicate prediction ID", (p: any) => (p.predict.options[1].id = p.predict.options[0].id)],
    ["duplicate source ID", (p: any) => p.sources.push(p.sources[0])],
    ["duplicate material ID", (p: any) => p.materials.push(p.materials[0])],
    ["missing sources", (p: any) => (p.sources = [])],
    ["missing materials", (p: any) => (p.materials = [])],
    ["unknown material source", (p: any) => (p.materials[0].sourceId = "missing")],
    ["unknown starter material", (p: any) => (p.starter.materialIds = ["missing"])],
    ["unknown Make material", (p: any) => (p.make.materialIds = ["missing"])],
    ["source-free starter", (p: any) => (p.starter.materialIds = [])],
    ["source-free Make", (p: any) => (p.make.materialIds = [])],
    ["duplicate starter material", (p: any) => p.starter.materialIds.push("button-note")],
    ["duplicate Make material", (p: any) => p.make.materialIds.push("button-note")],
    ["duplicate starter asset", (p: any) => (p.starter.assetIds = ["photo", "photo"])],
    ["duplicate Make asset", (p: any) => (p.make.assetIds = ["photo", "photo"])],
    ["missing original reference", (p: any) => delete p.sources[0].reference],
    ["unsafe source URL", (p: any) => (p.sources[0].reference.url = "javascript:alert(1)")],
    ["unknown operation", (p: any) => (p.starter.operation = "shell")],
    ["empty raw prompt", (p: any) => (p.starter.prompt = "  ")],
    ["oversized raw prompt", (p: any) => (p.starter.prompt = "p".repeat(2001))],
    ["difficulty family", (p: any) => (p.family = "another-method")],
  ] as const)("rejects %s", (_, change) => {
    const activity = structuredClone(primmFixture);
    change(activity);
    expect(LessonActivitySchema.safeParse(activity).success).toBe(false);
  });

  it("uses the shared source schema, including pinned repository spans", () => {
    const activity = candidate();
    const reference = {
      label: activity.source.label,
      path: "src/button.ts",
      line: 2,
      lineEnd: 8,
      commit: "a".repeat(40),
    };
    expect(ActivitySourceSchema.safeParse(reference).success).toBe(true);
    activity.sources[0]!.reference = reference;
    expect(LessonActivitySchema.safeParse(activity).success).toBe(true);
    activity.sources[0]!.reference = { ...reference, lineEnd: 1 };
    expect(LessonActivitySchema.safeParse(activity).success).toBe(false);
  });

  it("does not depend on JSON property order and has no authored phase ordering override", () => {
    const reversed = Object.fromEntries(Object.entries(primmFixture).reverse());
    expect(LessonActivitySchema.safeParse(reversed).success).toBe(true);
    expect(PRIMM_PHASES.at(-1)).toBe("make");
  });

  it("retains legacy V1/V2 contracts without adding PRIMM requirements", () => {
    for (const path of [legacy, v2])
      expect(LessonActivitySchema.safeParse(path).success).toBe(true);
    expect(interactionLessonIssues({ content: "ordinary legacy lesson" })).toEqual([]);
    expect(
      LessonActivitySchema.safeParse({ ...primmFixture, kind: "interaction-path" }).success,
    ).toBe(false);
  });
});

describe("PRIMM game structure and references", () => {
  it.each(Object.keys(games) as PrimmGame["kind"][])(
    "accepts %s without inventing an MCQ",
    (kind) => {
      const activity = candidate(kind);
      expect(LessonActivitySchema.safeParse(activity).success).toBe(true);
      expect(primmIssues(activity)).toEqual([]);
    },
  );

  it.each([
    ["inspect-image", "duplicate region", (g: any) => g.regions.push(g.regions[0])],
    ["inspect-image", "negative x", (g: any) => (g.regions[0].x = -0.1)],
    ["inspect-image", "percent rather than fraction", (g: any) => (g.regions[0].x = 20)],
    ["inspect-image", "zero width", (g: any) => (g.regions[0].width = 0)],
    ["inspect-image", "zero height", (g: any) => (g.regions[0].height = 0)],
    ["inspect-image", "right overflow", (g: any) => (g.regions[0].x = 0.8)],
    ["inspect-image", "bottom overflow", (g: any) => (g.regions[0].y = 0.8)],
    ["inspect-image", "NaN", (g: any) => (g.regions[0].x = NaN)],
    ["inspect-image", "Infinity", (g: any) => (g.regions[0].height = Infinity)],
    ["sort", "duplicate bucket", (g: any) => g.buckets.push(g.buckets[0])],
    ["sort", "duplicate card", (g: any) => g.cards.push(g.cards[0])],
    ["sort", "unknown bucket", (g: any) => (g.cards[0].bucketId = "missing")],
    ["sort", "empty bucket", (g: any) => (g.cards[1].bucketId = g.cards[0].bucketId)],
    ["sort", "one bucket", (g: any) => g.buckets.pop()],
    ["layout", "duplicate item", (g: any) => g.items.push(g.items[0])],
    ["layout", "duplicate format", (g: any) => g.formats.push(g.formats[0])],
    ["edit", "duplicate sentence", (g: any) => g.sentences.push(g.sentences[0])],
    ["edit", "unknown target", (g: any) => (g.targetId = "missing")],
    ["collect", "duplicate card", (g: any) => g.cards.push(g.cards[0])],
    ["collect", "unknown source", (g: any) => (g.cards[0].sourceId = "missing")],
    ["collect", "only relevant", (g: any) => (g.cards[1].relevant = true)],
    ["collect", "only distractors", (g: any) => (g.cards[0].relevant = false)],
  ] as const)("rejects %s: %s", (kind, _, change) => {
    const activity = candidate(kind);
    change(activity.investigate.game);
    expect(primmIssues(activity).length).toBeGreaterThan(0);
    expect(LessonActivitySchema.safeParse(activity).success).toBe(false);
  });
});

describe("PRIMM lesson source, asset and Make bindings", () => {
  it.each([
    ["missing source evidence", (l: any) => (l.evidence = [])],
    ["changed source identity", (l: any) => (l.evidence[0].sourceUrl += "other")],
    ["no exercise", (l: any) => (l.exercises = [])],
    ["duplicate exercise ID", (l: any) => l.exercises.push(l.exercises[0])],
    ["wrong Make ID", (l: any) => (l.exercises[0].id = "other")],
    ["non-explain exercise", (l: any) => (l.exercises[0].kind = "choice")],
    ["exercise omits source", (l: any) => (l.exercises[0].evidence = [])],
    ["exercise changes source", (l: any) => (l.exercises[0].evidence[0].sourceUrl += "other")],
    ["manifest/body disagreement", (l: any) => (l.exerciseIds = ["different"])],
    ["duplicated activity", (l: any) => l.activities.push(l.activities[0])],
    ["unknown starter asset", (l: any) => (l.activities[0].starter.assetIds = ["unknown"])],
    ["unknown Make asset", (l: any) => (l.activities[0].make.assetIds = ["unknown"])],
    ["unknown material asset", (l: any) => (l.activities[0].materials[0].assetId = "unknown")],
    ["vision without image", (l: any) => (l.activities[0].starter.operation = "vision")],
    ["transcribe without media", (l: any) => (l.activities[0].make.operation = "transcribe")],
    ["missing marker", (l: any) => (l.content = "recap")],
    ["duplicate marker", (l: any) => (l.content += "\n::play{#button-primm}")],
    ["wrong marker ID", (l: any) => (l.content = "::play{#another}")],
    ["wrong marker spelling", (l: any) => (l.content = "::play{id=button-primm}")],
    ["inline extra marker", (l: any) => (l.content += "\ntext ::play{#extra}")],
  ] as const)("rejects %s", (_, change) => {
    const lesson = structuredClone(primmLessonFixture);
    change(lesson);
    expect(interactionLessonIssues(lesson).length).toBeGreaterThan(0);
  });

  it("requires every named source even if the primary source is present", () => {
    const lesson = structuredClone(primmLessonFixture);
    lesson.activities[0]!.sources.push({
      ...lesson.activities[0]!.sources[0]!,
      id: "another",
      reference: { ...primmFixture.source, url: "https://example.org/another" },
    });
    expect(interactionLessonIssues(lesson).join()).toContain("absent from lesson evidence");
  });

  it("accepts IDs-only manifests while binding the exact single Make ID", () => {
    const { exercises, ...lesson } = primmLessonFixture;
    expect(interactionLessonIssues({ ...lesson, exerciseIds: [exercises[0]!.id] })).toEqual([]);
    expect(interactionLessonIssues({ ...lesson, exerciseIds: ["another"] }).join()).toContain(
      "one independent exercise ID",
    );
    const manifest = {
      ...lesson,
      evidence: [
        {
          kind: "fact",
          sourceUrl: "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
          sourceTitle: "Button Pattern",
          sourceAuthority: "w3c",
        },
      ],
      schemaVersion: 1,
      id: "button-lesson",
      title: "Buttons",
      courseId: "course-id",
      unitId: "unit-id",
      exerciseIds: [exercises[0]!.id],
      contentRevision: 2,
      contentHash: `sha256:${"a".repeat(64)}`,
      status: "active",
      createdAt: "2026-09-18T00:00:00Z",
      updatedAt: "2026-09-18T00:00:00Z",
    };
    const { content: _, ...stored } = manifest;
    expect(LessonManifestSchema.safeParse(stored).success).toBe(true);
    expect(LessonManifestSchema.safeParse({ ...stored, exerciseIds: ["missing"] }).success).toBe(
      false,
    );
  });

  it("checks exact pinned repository identity and the complete cited line range", () => {
    const lesson = structuredClone(primmLessonFixture);
    const reference = {
      label: primmFixture.source.label,
      path: "src/button.ts",
      commit: "a".repeat(40),
      line: 5,
      lineEnd: 8,
    };
    lesson.activities[0]!.sources[0]!.reference = reference;
    const pinned = {
      sourcePath: reference.path,
      sourceCommit: reference.commit,
      lineStart: 2,
      lineEnd: 10,
    };
    const evidence = [...lesson.evidence, pinned];
    const exercises = [{ ...lesson.exercises[0]!, evidence }];
    expect(interactionLessonIssues({ ...lesson, evidence, exercises })).toEqual([]);
    expect(
      interactionLessonIssues({
        ...lesson,
        evidence: [...lesson.evidence, { ...pinned, lineEnd: 6 }],
        exercises,
      }).join(),
    ).toContain("absent");
    expect(
      interactionLessonIssues({
        ...lesson,
        evidence,
        exercises: [{ ...exercises[0]!, evidence: [{ ...pinned, sourceCommit: "b".repeat(40) }] }],
      }).join(),
    ).toContain("omits source identity");
  });

  it("resolves inspection/material assets and requires media appropriate to the operation", () => {
    const activity = candidate("inspect-image");
    activity.starter = { ...activity.starter, operation: "vision", assetIds: ["photo"] };
    activity.make = { ...activity.make, assetIds: ["photo"] };
    activity.materials[0]!.assetId = "photo";
    const lesson = {
      ...primmLessonFixture,
      activities: [activity],
      assets: [{ id: "photo", mime: "image/jpeg" }],
    };
    expect(interactionLessonIssues(lesson)).toEqual([]);
    expect(interactionLessonIssues({ ...lesson, assets: [] }).join()).toContain(
      "Unknown PRIMM lesson asset",
    );
    expect(
      interactionLessonIssues({ ...lesson, assets: [{ id: "photo", mime: "audio/wav" }] }).join(),
    ).toContain("requires an image");
    expect(
      interactionLessonIssues({ ...lesson, assets: [...lesson.assets, ...lesson.assets] }).join(),
    ).toContain("Duplicate");
    activity.starter.assetIds = [];
    expect(interactionLessonIssues(lesson).join()).toContain("omits material asset");
    expect(interactionLessonIssues(lesson).join()).toContain("absent from starter");
  });
});

describe("PRIMM localization is display-only", () => {
  it.each(activityDisplayStrings(primmFixture))("requires English display text: %s", (text) => {
    const activity = structuredClone(primmFixture);
    const strings = { ...activity.locales!.en!.strings };
    delete strings[text];
    expect(
      LessonActivitySchema.safeParse({ ...activity, locales: { en: { strings } } }).success,
    ).toBe(false);
  });

  it.each(Object.keys(games) as PrimmGame["kind"][])(
    "translates all %s copy and preserves IDs/rules",
    (kind) => {
      const activity = candidate(kind);
      const translated = localizeActivity(activity, "en-US");
      expect(activityDisplayStrings(translated).every((text) => text.startsWith("English: "))).toBe(
        true,
      );
      expect(translated.starter).toEqual({
        ...activity.starter,
        prompt: `English: ${activity.starter.prompt}`,
      });
      expect(translated.make.exerciseId).toBe(activity.make.exerciseId);
      expect(translated.materials[0]!.sourceId).toBe(activity.materials[0]!.sourceId);
      expect(translated.sources[0]!.reference).toMatchObject({
        url: "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
      });
      const copy = structuredClone(translated);
      copy.investigate.game = activity.investigate.game;
      expect(primmIssues(copy)).toEqual([]);
      for (const text of activityDisplayStrings(activity)) {
        const strings = { ...activity.locales!.en!.strings };
        delete strings[text];
        expect(
          LessonActivitySchema.safeParse({ ...activity, locales: { en: { strings } } }).success,
        ).toBe(false);
      }
    },
  );

  it("localizes the authored starter but never rewrites runtime text with a matching dictionary key", () => {
    const activity = structuredClone(primmFixture);
    const prompt = activity.starter.prompt;
    expect(activityDisplayStrings(activity)).toContain(prompt);
    expect(
      activityTranslationIssues({
        ...activity,
        locales: { en: { strings: { [prompt]: "translated request" } } },
      }),
    ).toEqual([]);
    activity.starter.prompt = activity.title;
    delete activity.locales!.en!.strings![prompt];
    const withOutput = {
      ...activity,
      runtime: { text: activity.title, title: activity.title },
      run: { ...activity.run, output: activity.title },
    };
    const translated = localizeActivity(withOutput, "en");
    expect(translated.title).not.toBe(activity.title);
    expect(translated.starter.prompt).toBe(translated.title);
    expect(translated.runtime).toEqual(withOutput.runtime);
    expect(translated.run.output).toBe(activity.title);
  });

  it("accepts optional suggestion absence and rejects missing/blank locale dictionaries", () => {
    const activity = candidate();
    delete activity.modify.suggestion;
    activity.locales = {
      en: {
        strings: Object.fromEntries(activityDisplayStrings(activity).map((text) => [text, text])),
      },
    };
    expect(LessonActivitySchema.safeParse(activity).success).toBe(true);
    expect(LessonActivitySchema.safeParse({ ...activity, locales: undefined }).success).toBe(false);
    expect(
      LessonActivitySchema.safeParse({
        ...activity,
        locales: { en: { strings: { [activity.title]: " " } } },
      }).success,
    ).toBe(false);
  });
});

describe("PRIMM pure game-state validation", () => {
  it("allows every prediction to continue without a grade", () => {
    for (const option of primmFixture.predict.options)
      expect(canContinuePrimmPrediction(primmFixture.predict, option.id)).toBe(true);
    expect(canContinuePrimmPrediction(primmFixture.predict, "")).toBe(false);
    expect(canContinuePrimmPrediction(primmFixture.predict, "missing")).toBe(false);
  });

  it.each([
    [
      "inspect-image",
      { kind: "inspect-image", selectedRegionIds: ["left"] },
      [[], ["left", "left"], ["missing"]].map((selectedRegionIds) => ({
        kind: "inspect-image",
        selectedRegionIds,
      })),
    ],
    [
      "sort",
      { kind: "sort", placed: { "press-key": "action", "button-name": "description" } },
      [
        { kind: "sort", placed: {} },
        { kind: "sort", placed: { "press-key": "description", "button-name": "action" } },
        {
          kind: "sort",
          placed: { "press-key": "action", "button-name": "description", extra: "action" },
        },
      ],
    ],
    [
      "layout",
      { kind: "layout", itemIds: ["activate", "focus"], formatId: "paragraph" },
      [
        { kind: "layout", itemIds: ["focus"], formatId: "list" },
        { kind: "layout", itemIds: ["focus", "focus"], formatId: "list" },
        { kind: "layout", itemIds: ["focus", "missing"], formatId: "list" },
        { kind: "layout", itemIds: ["focus", "activate"], formatId: "missing" },
      ],
    ],
    [
      "edit",
      { kind: "edit", targetId: "unsupported", replacement: "按 Enter 或空格。" },
      [
        { kind: "edit", targetId: "supported", replacement: "new" },
        { kind: "edit", targetId: "unsupported", replacement: " " },
        { kind: "edit", targetId: "unsupported", replacement: "按任意键都会触发。" },
      ],
    ],
    [
      "collect",
      { kind: "collect", decisions: { relevant: true, distractor: false } },
      [
        { kind: "collect", decisions: {} },
        { kind: "collect", decisions: { relevant: true } },
        { kind: "collect", decisions: { relevant: true, distractor: true } },
        { kind: "collect", decisions: { relevant: true, distractor: false, extra: false } },
      ],
    ],
  ] as const)(
    "checks current %s state and rejects stale/partial/unknown state",
    (kind, valid, invalid) => {
      const game = games[kind];
      expect(isPrimmGameComplete(game, valid as PrimmGameState)).toBe(true);
      for (const state of invalid)
        expect(isPrimmGameComplete(game, state as PrimmGameState)).toBe(false);
      expect(
        isPrimmGameComplete(game, { kind: "edit", targetId: "missing", replacement: "new" }),
      ).toBe(false);
    },
  );

  it("reuses native sorting feedback without mutating prior state", () => {
    const game = games.sort;
    if (game.kind !== "sort") throw new Error("fixture");
    const initial = createSortState();
    expect(placePrimmSortCard(game, initial, "press-key", "description")).toMatchObject({
      kind: "wrong",
      state: { placed: {}, misses: 1 },
    });
    const right = placePrimmSortCard(game, initial, "press-key", "action");
    expect(right).toMatchObject({ kind: "right", state: { placed: { "press-key": "action" } } });
    expect(initial).toEqual(createSortState());
    expect(placePrimmSortCard(game, initial, "missing", "action").kind).toBe("unknown-item");
    expect(placePrimmSortCard(game, initial, "press-key", "missing").kind).toBe("unknown-bucket");
    if (right.kind === "right")
      expect(placePrimmSortCard(game, right.state, "press-key", "action").kind).toBe(
        "already-placed",
      );
  });
});
