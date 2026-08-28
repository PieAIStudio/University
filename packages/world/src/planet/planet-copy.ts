import { hash } from "../island/random.js";

/**
 * The only "introduction" a study is allowed to have on this page.
 *
 * `imported.json` carries `studyId` / `title` / `defaultCourseId` / `courses`
 * and nothing else — there is no summary field. A slogan written here would
 * be fiction, and fiction on a course picker is how a page starts lying
 * about a library it has not read.
 *
 * The long-term fix is an authored `summary` on the study, written in
 * `apps/local` and published with the rest of the package. Until that
 * exists, the intro is a fold of counts and the course titles already in
 * the graph, in teaching order.
 */

export interface PlanetStudy {
  readonly id: string;
  readonly title: string;
  readonly courseCount: number;
  readonly lessonCount: number;
  readonly lessonsDone: number;
  /** Course names in teaching order. Used as the introduction, not decoration. */
  readonly courseTitles: readonly string[];
}

export interface StudyMarkerColor {
  readonly hex: number;
  readonly css: string;
  readonly outlineHex: number;
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

/** Convert the one stable id-derived hue into the hex shape the renderer needs. */
function hslToHex(hue: number, saturation: number, lightness: number): number {
  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return (channel << 16) | (channel << 8) | channel;
  }
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const red = hueToRgb(p, q, hue + 1 / 3);
  const green = hueToRgb(p, q, hue);
  const blue = hueToRgb(p, q, hue - 1 / 3);
  return (Math.round(red * 255) << 16) | (Math.round(green * 255) << 8) | Math.round(blue * 255);
}

function cssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

const FALLBACK_MARKER_COLORS: readonly StudyMarkerColor[] = [
  { hex: 0xd49a62, css: "#d49a62", outlineHex: 0x4c352a },
  { hex: 0x7d9a62, css: "#7d9a62", outlineHex: 0x30432b },
  { hex: 0x5c9b99, css: "#5c9b99", outlineHex: 0x294c4d },
  { hex: 0xa77768, css: "#a77768", outlineHex: 0x4c302d },
];

/**
 * The published study shape has no `theme` field yet. Keep the four existing
 * authored marker colours byte-for-byte stable; only the missing fifth study
 * and future studies use this deterministic id-derived hue. The saturation
 * and lightness are deliberately muted so this remains a continuation of the
 * existing identity system, not a second neon palette invented by the planet.
 */
function markerColorFromStudyId(studyId: string): StudyMarkerColor {
  const hue = hash(`study-marker-hue:${studyId}`);
  const saturation = 0.28 + hash(`study-marker-saturation:${studyId}`) * 0.1;
  const lightness = 0.49 + hash(`study-marker-lightness:${studyId}`) * 0.08;
  const hex = hslToHex(hue, saturation, lightness);
  const outlineHex = hslToHex(hue, saturation * 0.78, lightness * 0.46);
  return { hex, css: cssHex(hex), outlineHex };
}

const MARKER_COLORS_BY_STUDY: Readonly<Record<string, StudyMarkerColor>> = {
  // 通用课 was added after the first four-study marker table. There is no
  // stored study-level hue to reuse, so its stable id is the source of truth.
  general: markerColorFromStudyId("general"),
  "turing-pact": FALLBACK_MARKER_COLORS[0]!,
  buzz: FALLBACK_MARKER_COLORS[1]!,
  supaluv: FALLBACK_MARKER_COLORS[2]!,
  "university-local": FALLBACK_MARKER_COLORS[3]!,
};

/** One project colour shared by the canvas beacon and the DOM list swatch. */
export function studyMarkerColor(studyId: string): StudyMarkerColor {
  const known = MARKER_COLORS_BY_STUDY[studyId];
  if (known) return known;
  return markerColorFromStudyId(studyId);
}

export type StudyClusterShape = "wide" | "compact" | "elongated" | "faceted" | "tall";

export interface StudyClusterStyle {
  readonly studyId: string;
  readonly profile: number;
  readonly shape: StudyClusterShape;
  readonly accentHex: number;
  readonly outlineHex: number;
}

const STUDY_CLUSTER_SHAPES: readonly StudyClusterShape[] = [
  "wide",
  "compact",
  "elongated",
  "faceted",
  "tall",
];

/**
 * Shape is a named identity cue, not a hand-tuned island layout. The five
 * known studies get one stable profile each; an unlisted study hashes into
 * the same small vocabulary, so content order can never reshuffle a cluster.
 */
const STUDY_CLUSTER_PROFILE_BY_ID: Readonly<Record<string, number>> = {
  general: 0,
  buzz: 1,
  supaluv: 2,
  "turing-pact": 3,
  "university-local": 4,
};

export function studyClusterStyle(studyId: string): StudyClusterStyle {
  const profile =
    STUDY_CLUSTER_PROFILE_BY_ID[studyId] ??
    Math.floor(hash(`study-cluster-shape:${studyId}`) * STUDY_CLUSTER_SHAPES.length);
  const marker = studyMarkerColor(studyId);
  return {
    studyId,
    profile,
    shape: STUDY_CLUSTER_SHAPES[profile]!,
    accentHex: marker.hex,
    outlineHex: marker.outlineHex,
  };
}

/**
 * How big a series is. Size only — where you stand in it is `studyStage`.
 *
 * This used to end with 「没开始」 or 「学了 3/60 节」 as well, and once the row
 * grew a stage chip and a progress bar the same fact was on screen three times
 * in three shapes. A row that says one thing three times reads as a row with
 * nothing to say.
 */
export function studyCounts(study: PlanetStudy): string {
  return `${study.courseCount} 门课 · ${study.lessonCount} 节`;
}

/**
 * Where a series stands, in one word.
 *
 * The list used to say only how many courses and lessons a series holds, so
 * five rows of very similar numbers were the entire basis for choosing one —
 * and the one fact that actually decides it, whether you are already partway
 * into a series, was the one fact missing. Three states, because a fourth
 * ("nearly done") would be a judgement about a number the reader can already
 * see on the bar beside it.
 */
export type StudyStage = "not-started" | "learning" | "done";

export function studyStage(study: PlanetStudy): StudyStage {
  if (study.lessonCount > 0 && study.lessonsDone >= study.lessonCount) return "done";
  return study.lessonsDone > 0 ? "learning" : "not-started";
}

export const STUDY_STAGE_LABEL: Record<StudyStage, string> = {
  "not-started": "没开始",
  learning: "学习中",
  done: "已学完",
};

/** Whole percent, floored, so 99.6% never reads as a finished series. */
export function studyPercent(study: PlanetStudy): number {
  if (study.lessonCount <= 0) return 0;
  return Math.floor((study.lessonsDone / study.lessonCount) * 100);
}

export function studyCourseList(
  study: PlanetStudy,
  visible = 4,
): {
  readonly shown: readonly string[];
  readonly rest: number;
  readonly restLabel: string | null;
} {
  const shown = study.courseTitles.slice(0, visible);
  const rest = Math.max(0, study.courseTitles.length - shown.length);
  return {
    shown,
    rest,
    restLabel: rest > 0 ? `还有 ${rest} 门` : null,
  };
}
