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

interface HslColor {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

function hslFromHex(hex: number): HslColor {
  const red = ((hex >> 16) & 0xff) / 255;
  const green = ((hex >> 8) & 0xff) / 255;
  const blue = (hex & 0xff) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (maximum === red) hue = ((green - blue) / delta) % 6;
  else if (maximum === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  hue /= 6;
  return { hue: hue < 0 ? hue + 1 : hue, saturation, lightness };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1;
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
 * The same five words also carry a small silhouette recipe at the course
 * scale. Numbers live beside the vocabulary so a renderer never grows a
 * second shape list or decides that `wide` means something else.
 */
export interface StudyClusterSilhouette {
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
}

const STUDY_CLUSTER_SILHOUETTES: Readonly<Record<StudyClusterShape, StudyClusterSilhouette>> = {
  wide: { width: 1.36, depth: 0.66, rotation: -0.12 },
  compact: { width: 0.88, depth: 1.06, rotation: 0.02 },
  elongated: { width: 0.66, depth: 1.34, rotation: 0.12 },
  faceted: { width: 1.18, depth: 0.78, rotation: 0.3 },
  tall: { width: 0.72, depth: 1.32, rotation: -0.16 },
};

export function studyClusterSilhouette(shape: StudyClusterShape): StudyClusterSilhouette {
  return STUDY_CLUSTER_SILHOUETTES[shape];
}

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
 * Give a course a profile from the study's existing five-word vocabulary.
 * Passing a namespaced id through `studyClusterStyle` deliberately reuses its
 * hash assignment instead of introducing a course-only shape hash.
 */
export function courseClusterStyle(studyId: string, courseId: string): StudyClusterStyle {
  const profileStyle = studyClusterStyle(`${studyId}/course/${courseId}`);
  const marker = studyMarkerColor(studyId);
  return {
    studyId,
    profile: profileStyle.profile,
    shape: profileStyle.shape,
    accentHex: marker.hex,
    outlineHex: marker.outlineHex,
  };
}

/** The single candidate knob: more hue means proportionally less silhouette. */
export const COURSE_IDENTITY_HUE_SHARE = 0.46;
export const COURSE_IDENTITY_HUE_MAX_DEGREES = 18;
export const COURSE_IDENTITY_SATURATION_SPREAD = 0.055;
export const COURSE_IDENTITY_LIGHTNESS_SPREAD = 0.05;
export const COURSE_IDENTITY_SILHOUETTE_VARIATION = 0.6;
export const COURSE_IDENTITY_ROTATION_VARIATION = 0.52;

export interface CourseIslandStyle {
  readonly studyId: string;
  readonly courseId: string;
  readonly profile: number;
  readonly shape: StudyClusterShape;
  readonly hueShiftDegrees: number;
  readonly saturationShift: number;
  readonly lightnessShift: number;
  readonly hueShare: number;
  readonly silhouetteShare: number;
  /** Full course colour, before the candidate balance is applied to terrain. */
  readonly courseHex: number;
  /** Course colour moved partway from the study hue for the terrain uniform. */
  readonly surfaceHex: number;
  /** Warm, dark value break; deliberately not the study's near-black outline. */
  readonly underbodyHex: number;
  /** One saturated point, derived from the course hue. */
  readonly accentHex: number;
  readonly surfaceStrength: number;
  readonly silhouette: StudyClusterSilhouette;
  /** Normalised ellipse coordinates, resolved against a blueprint by IslandRender. */
  readonly accentPosition: { readonly x: number; readonly z: number };
}

function signedHash(key: string, span: number): number {
  return (hash(key) * 2 - 1) * span;
}

function blendHsl(from: HslColor, to: HslColor, amount: number): HslColor {
  const hueDelta = ((to.hue - from.hue + 0.5) % 1) - 0.5;
  return {
    hue: wrapUnit(from.hue + hueDelta * amount),
    saturation: from.saturation + (to.saturation - from.saturation) * amount,
    lightness: from.lightness + (to.lightness - from.lightness) * amount,
  };
}

function normaliseIdentityShare(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("course island identity hue share must be between 0 and 1");
  }
  return value;
}

/**
 * Derive course identity from the study marker, without making the study a
 * rainbow. The same bounded hue/saturation/lightness data drives both the
 * terrain uniform and the single world accent; only the balance knob changes
 * how much of it is visible versus the shared shape profile.
 */
export function courseIslandStyle(
  studyId: string,
  courseId: string,
  hueShare = COURSE_IDENTITY_HUE_SHARE,
): CourseIslandStyle {
  const share = normaliseIdentityShare(hueShare);
  const silhouetteShare = 1 - share;
  const study = studyMarkerColor(studyId);
  const studyHsl = hslFromHex(study.hex);
  const hueShiftDegrees = signedHash(
    `course-island-hue:${studyId}:${courseId}`,
    COURSE_IDENTITY_HUE_MAX_DEGREES,
  );
  const saturationShift = signedHash(
    `course-island-saturation:${studyId}:${courseId}`,
    COURSE_IDENTITY_SATURATION_SPREAD,
  );
  const lightnessShift = signedHash(
    `course-island-lightness:${studyId}:${courseId}`,
    COURSE_IDENTITY_LIGHTNESS_SPREAD,
  );
  const courseHsl: HslColor = {
    hue: wrapUnit(studyHsl.hue + hueShiftDegrees / 360),
    saturation: clamp01(studyHsl.saturation + saturationShift),
    lightness: clamp01(studyHsl.lightness + lightnessShift),
  };
  const surfaceHsl = blendHsl(studyHsl, courseHsl, share);
  const accentHsl: HslColor = {
    hue: courseHsl.hue,
    saturation: Math.min(0.9, Math.max(0.62, courseHsl.saturation + 0.25)),
    lightness: Math.min(0.68, Math.max(0.42, courseHsl.lightness + 0.02)),
  };
  const cluster = courseClusterStyle(studyId, courseId);
  const profileSilhouette = studyClusterSilhouette(cluster.shape);
  const courseSilhouette = {
    width:
      profileSilhouette.width *
      (1 +
        signedHash(
          `course-island-silhouette-width:${studyId}:${courseId}`,
          COURSE_IDENTITY_SILHOUETTE_VARIATION,
        )),
    depth:
      profileSilhouette.depth *
      (1 +
        signedHash(
          `course-island-silhouette-depth:${studyId}:${courseId}`,
          COURSE_IDENTITY_SILHOUETTE_VARIATION,
        )),
    rotation:
      profileSilhouette.rotation +
      signedHash(
        `course-island-silhouette-bearing:${studyId}:${courseId}`,
        COURSE_IDENTITY_ROTATION_VARIATION,
      ),
  };
  const silhouette = {
    width: 1 + (courseSilhouette.width - 1) * silhouetteShare,
    depth: 1 + (courseSilhouette.depth - 1) * silhouetteShare,
    rotation: silhouetteShare === 0 ? 0 : courseSilhouette.rotation * silhouetteShare,
  };
  const accentAngle = hash(`course-island-accent-angle:${studyId}:${courseId}`) * Math.PI * 2;
  const accentRadius = 0.18 + hash(`course-island-accent-radius:${studyId}:${courseId}`) * 0.18;
  return {
    studyId,
    courseId,
    profile: cluster.profile,
    shape: cluster.shape,
    hueShiftDegrees,
    saturationShift,
    lightnessShift,
    hueShare: share,
    silhouetteShare,
    courseHex: hslToHex(courseHsl.hue, courseHsl.saturation, courseHsl.lightness),
    surfaceHex: hslToHex(surfaceHsl.hue, surfaceHsl.saturation, surfaceHsl.lightness),
    underbodyHex: hslToHex(
      courseHsl.hue,
      Math.min(0.62, courseHsl.saturation * 0.78),
      Math.max(0.24, courseHsl.lightness * 0.55),
    ),
    accentHex: hslToHex(accentHsl.hue, accentHsl.saturation, accentHsl.lightness),
    surfaceStrength: 0.72 + share * 0.28,
    silhouette,
    accentPosition: {
      x: Math.cos(accentAngle) * accentRadius,
      z: Math.sin(accentAngle) * accentRadius,
    },
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
