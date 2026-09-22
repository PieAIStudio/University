import { activityDisplayStrings, primmFixture } from "@pieai/university-core";
import { createTranslator } from "../i18n/index.js";
import type { MessageKey } from "../i18n/types.js";
import type { LessonAssetView } from "../view/lesson-view.js";
import type { PrimmClassicActivity } from "./primm-types.js";

type Game = PrimmClassicActivity["investigate"]["game"];
export type PrimmGameKind = Game["kind"];

/**
 * Every investigate game a version-2 PRIMM lesson can hold, in one place a
 * person can play them. Four of the six had never been used by a shipped
 * lesson and so could not be seen at all, which made judging them impossible.
 */
export const PRIMM_GAME_KINDS = [
  "inspect-image",
  "sort",
  "layout",
  "edit",
  "check-result",
  "collect",
] as const satisfies readonly PrimmGameKind[];

// A game added to the schema without an example here stops the build, rather
// than leaving the one page meant to show every game quietly short of one.
const everyGameHasAnExample: [Exclude<PrimmGameKind, (typeof PRIMM_GAME_KINDS)[number]>] extends [
  never,
]
  ? true
  : never = true;
void everyGameHasAnExample;

/*
  A stored lesson is Chinese display text plus an English dictionary keyed by
  that text, and the schema refuses a dictionary entry the text does not use.
  These examples are built the same way — the Chinese from the source catalog
  becomes the body, the English catalog becomes the dictionary — so the lab
  shows exactly what a lesson would, and the copy still lives in the catalogs.
*/
const SOURCE = createTranslator("zh-CN");
const ENGLISH = createTranslator("en");

function collector() {
  const en: Record<string, string> = {};
  const copy = (key: MessageKey) => {
    const text = SOURCE.t(key);
    en[text] = ENGLISH.t(key);
    return text;
  };
  /** A proper name that reads the same in both languages. */
  const same = (text: string) => {
    en[text] = text;
    return text;
  };
  return { en, copy, same };
}

const APG = {
  label: "W3C ARIA Authoring Practices · Button Pattern",
  url: "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
};
const CONTRAST = {
  label: "W3C WCAG 2.2 · Understanding SC 1.4.3 Contrast (Minimum)",
  url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
};

/**
 * The inspect-image game needs a picture. Drawn here rather than borrowed from
 * a course, so the lab does not break when a course is rewritten or retired.
 */
function signupScreenshot(locale: string): string {
  const pictureCopy = (key: MessageKey) => createTranslator(locale).t(key);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" font-family="system-ui, 'PingFang SC', sans-serif">
<rect width="640" height="400" fill="#eef1f4"/>
<rect x="40" y="24" width="560" height="352" rx="14" fill="#ffffff" stroke="#d3d9e0"/>
<text x="72" y="78" font-size="26" font-weight="700" fill="#1f2a37">${pictureCopy("primm.lab.example.picture.text.1")}</text>
<text x="72" y="130" font-size="16" fill="#4b5563">${pictureCopy("primm.lab.example.picture.text.2")}</text>
<rect x="72" y="142" width="496" height="44" rx="8" fill="#ffffff" stroke="#c0392b" stroke-width="2"/>
<text x="86" y="170" font-size="16" fill="#1f2a37">lin.chen@</text>
<text x="72" y="210" font-size="14" fill="#c0392b">${pictureCopy("primm.lab.example.picture.text.3")}</text>
<rect x="72" y="240" width="190" height="48" rx="10" fill="#2563eb"/>
<text x="167" y="270" font-size="17" font-weight="600" fill="#ffffff" text-anchor="middle">${pictureCopy("primm.lab.example.picture.text.4")}</text>
<text x="72" y="344" font-size="13" fill="#2563eb" text-decoration="underline">${pictureCopy("primm.lab.example.picture.text.5")}</text>
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function shell(copy: (key: MessageKey) => string, same: (text: string) => string, game: Game) {
  return {
    ...primmFixture,
    sources: [
      {
        id: "apg-button",
        reference: { label: same(APG.label), url: APG.url },
        note: copy("primm.lab.example.shell.note.1"),
        summary: copy("primm.lab.example.shell.summary.1"),
        limitation: copy("primm.lab.example.shell.limitation.1"),
        date: copy("primm.lab.example.shell.date.1"),
      },
      {
        id: "wcag-contrast",
        reference: { label: same(CONTRAST.label), url: CONTRAST.url },
        note: copy("primm.lab.example.shell.note.2"),
        summary: copy("primm.lab.example.shell.summary.2"),
        limitation: copy("primm.lab.example.shell.limitation.2"),
        date: copy("primm.lab.example.shell.date.2"),
      },
    ],
    materials: [
      {
        id: "button-note",
        sourceId: "apg-button",
        kind: "source-summary",
        label: copy("primm.lab.example.shell.label.1"),
        text: copy("primm.lab.example.shell.text.1"),
      },
    ],
    investigate: { ...primmFixture.investigate, game },
  } satisfies PrimmClassicActivity;
}

export interface PrimmGameExample {
  readonly kind: PrimmGameKind;
  readonly activity: PrimmClassicActivity;
}

const SCREENSHOT_ID = "signup-screenshot";

/** The picture is the one part that cannot be a dictionary entry: its text is drawn. */
export function primmGameAssets(locale: string): readonly LessonAssetView[] {
  const pictureCopy = (key: MessageKey) => createTranslator(locale).t(key);
  return [
    {
      id: SCREENSHOT_ID,
      kind: "diagram",
      mime: "image/svg+xml",
      url: signupScreenshot(locale),
      alt: pictureCopy("primm.lab.example.asset.alt.1"),
    },
  ];
}

/** One playable example per game, all in one scenario: a club signup page's button. */
export function primmGameExamples(): readonly PrimmGameExample[] {
  const { en, copy, same } = collector();
  const games: Record<PrimmGameKind, Game> = {
    "inspect-image": {
      kind: "inspect-image",
      assetId: SCREENSHOT_ID,
      instruction: copy("primm.lab.example.inspect-image.instruction.1"),
      regions: [
        {
          id: "title",
          label: copy("primm.lab.example.inspect-image.label.1"),
          x: 0.1,
          y: 0.13,
          width: 0.42,
          height: 0.1,
          note: copy("primm.lab.example.inspect-image.note.1"),
        },
        {
          id: "email",
          label: copy("primm.lab.example.inspect-image.label.2"),
          x: 0.11,
          y: 0.35,
          width: 0.78,
          height: 0.12,
          note: copy("primm.lab.example.inspect-image.note.2"),
        },
        {
          id: "error",
          label: copy("primm.lab.example.inspect-image.label.3"),
          x: 0.11,
          y: 0.49,
          width: 0.34,
          height: 0.06,
          note: copy("primm.lab.example.inspect-image.note.3"),
        },
        {
          id: "submit",
          label: copy("primm.lab.example.inspect-image.label.4"),
          x: 0.11,
          y: 0.6,
          width: 0.3,
          height: 0.12,
          note: copy("primm.lab.example.inspect-image.note.4"),
        },
        {
          id: "privacy",
          label: copy("primm.lab.example.inspect-image.label.5"),
          x: 0.11,
          y: 0.82,
          width: 0.16,
          height: 0.06,
          note: copy("primm.lab.example.inspect-image.note.5"),
        },
      ],
    },
    sort: {
      kind: "sort",
      buckets: [
        { id: "action", label: copy("primm.lab.example.sort.label.1") },
        { id: "description", label: copy("primm.lab.example.sort.label.2") },
      ],
      cards: [
        {
          id: "press-enter",
          text: copy("primm.lab.example.sort.text.1"),
          bucketId: "action",
          why: copy("primm.lab.example.sort.why.1"),
        },
        {
          id: "press-space",
          text: copy("primm.lab.example.sort.text.2"),
          bucketId: "action",
          why: copy("primm.lab.example.sort.why.2"),
        },
        {
          id: "what-button",
          text: copy("primm.lab.example.sort.text.3"),
          bucketId: "description",
          why: copy("primm.lab.example.sort.why.3"),
        },
        {
          id: "button-colour",
          text: copy("primm.lab.example.sort.text.4"),
          bucketId: "description",
          why: copy("primm.lab.example.sort.why.4"),
        },
      ],
    },
    layout: {
      kind: "layout",
      instruction: copy("primm.lab.example.layout.instruction.1"),
      items: [
        {
          id: "focus",
          label: copy("primm.lab.example.layout.label.1"),
          text: copy("primm.lab.example.layout.text.1"),
        },
        {
          id: "activate",
          label: copy("primm.lab.example.layout.label.2"),
          text: copy("primm.lab.example.layout.text.2"),
        },
        {
          id: "confirm",
          label: copy("primm.lab.example.layout.label.3"),
          text: copy("primm.lab.example.layout.text.3"),
        },
      ],
      formats: [
        { id: "paragraph", label: copy("primm.lab.example.layout.label.4") },
        { id: "numbered", label: copy("primm.lab.example.layout.label.5") },
      ],
    },
    edit: {
      kind: "edit",
      targetId: "vague",
      instruction: copy("primm.lab.example.edit.instruction.1"),
      replacementHint: copy("primm.lab.example.edit.replacementHint.1"),
      sentences: [
        {
          id: "intro",
          text: copy("primm.lab.example.edit.text.1"),
        },
        { id: "vague", text: copy("primm.lab.example.edit.text.2") },
        {
          id: "confirm",
          text: copy("primm.lab.example.edit.text.3"),
        },
      ],
    },
    "check-result": {
      kind: "check-result",
      instruction: copy("primm.lab.example.check-result.instruction.1"),
      items: [
        {
          id: "enter",
          label: copy("primm.lab.example.check-result.label.1"),
          expected: copy("primm.lab.example.check-result.expected.1"),
          why: copy("primm.lab.example.check-result.why.1"),
        },
        {
          id: "space",
          label: copy("primm.lab.example.check-result.label.2"),
          expected: copy("primm.lab.example.check-result.expected.2"),
          why: copy("primm.lab.example.check-result.why.2"),
        },
        {
          id: "focus",
          label: copy("primm.lab.example.check-result.label.3"),
          expected: copy("primm.lab.example.check-result.expected.3"),
          why: copy("primm.lab.example.check-result.why.3"),
        },
      ],
    },
    collect: {
      kind: "collect",
      instruction: copy("primm.lab.example.collect.instruction.1"),
      cards: [
        {
          id: "space",
          label: copy("primm.lab.example.collect.label.1"),
          text: copy("primm.lab.example.collect.text.1"),
          sourceId: "apg-button",
          relevant: true,
          why: copy("primm.lab.example.collect.why.1"),
        },
        {
          id: "enter",
          label: copy("primm.lab.example.collect.label.2"),
          text: copy("primm.lab.example.collect.text.2"),
          sourceId: "apg-button",
          relevant: true,
          why: copy("primm.lab.example.collect.why.2"),
        },
        {
          id: "body-contrast",
          label: copy("primm.lab.example.collect.label.3"),
          text: copy("primm.lab.example.collect.text.3"),
          sourceId: "wcag-contrast",
          relevant: false,
          why: copy("primm.lab.example.collect.why.3"),
        },
        {
          id: "large-contrast",
          label: copy("primm.lab.example.collect.label.4"),
          text: copy("primm.lab.example.collect.text.4"),
          sourceId: "wcag-contrast",
          relevant: false,
          why: copy("primm.lab.example.collect.why.4"),
        },
      ],
    },
  };
  const inherited = primmFixture.locales?.en?.strings ?? {};
  return PRIMM_GAME_KINDS.map((kind) => {
    const body = shell(copy, same, games[kind]);
    const used = new Set(activityDisplayStrings(body));
    const strings = Object.fromEntries(
      Object.entries({ ...inherited, ...en }).filter(([zh]) => used.has(zh)),
    );
    return { kind, activity: { ...body, locales: { en: { strings } } } };
  });
}
