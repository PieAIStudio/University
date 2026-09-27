/**
 * What each rank and badge emblem looks like (V7 station 10, decision M1).
 *
 * Only the look lives here. Which badges exist, what earns them and what they
 * are called belong to `badgesFor` and `LEAGUE_TIERS` in university-core; a
 * test holds these tables to that list, so a badge added there without a look
 * here fails rather than drawing someone else's.
 */

export interface RankLook {
  readonly burst: number;
  readonly ring: number;
  readonly face: number;
  readonly gem: number;
  readonly ribbon: number;
  /** Stars lit on the banner, one per step up the ladder. */
  readonly stars: number;
  readonly wings?: number;
  readonly crown?: number;
  /** The top rank's gem glows. */
  readonly glow?: number;
}

/** Keyed by `LEAGUE_TIERS` id: the ranks are cut on long-term cards. */
export const RANK_LOOKS: Readonly<Record<string, RankLook>> = {
  stone: {
    burst: 0xa8adb6,
    ring: 0x6f7682,
    face: 0xd4d8de,
    gem: 0xeef2f6,
    ribbon: 0x7c8491,
    stars: 1,
  },
  bronze: {
    burst: 0xdb9152,
    ring: 0x9a5427,
    face: 0xf1b27a,
    gem: 0xffe0b8,
    ribbon: 0xb8672e,
    stars: 2,
  },
  silver: {
    burst: 0xdfe7f2,
    ring: 0x7f95b5,
    face: 0xb9cbe6,
    gem: 0xf2f8ff,
    ribbon: 0x6f8fc0,
    stars: 3,
  },
  gold: {
    burst: 0xffc93a,
    ring: 0xc9791a,
    face: 0xffb52e,
    gem: 0xfff4c2,
    ribbon: 0xf08a24,
    stars: 4,
    wings: 0xfff1d0,
  },
  obsidian: {
    burst: 0x4a2474,
    ring: 0xff5ec8,
    face: 0x7b3fc4,
    gem: 0xe8c8ff,
    ribbon: 0x6a2fb0,
    stars: 5,
    wings: 0xffd6f4,
    crown: 0xffc93a,
    glow: 0xc77dff,
  },
};

export type BadgeMetal = "bronze" | "silver" | "gold" | "special";
export type BadgeFrame = "coin" | "shield" | "hex" | "crest" | "star";
/** The five families on the wall; each has its own face colour. */
export type BadgeFamily = "path" | "streak" | "memory" | "course" | "special";
export type BadgeIcon =
  | "flag"
  | "flame"
  | "loop"
  | "cards"
  | "check"
  | "bubble"
  | "island"
  | "island3"
  | "fork"
  | "star"
  | "pennant"
  | "up"
  | "n10"
  | "n50"
  | "n100";

export interface BadgeLook {
  readonly family: BadgeFamily;
  readonly metal: BadgeMetal;
  readonly frame: BadgeFrame;
  readonly icon: BadgeIcon;
  /** A number plate under the icon, for the streak shields. */
  readonly plate?: string;
}

export const METALS: Readonly<
  Record<BadgeMetal, { rim: number; rimDark: number; iridescent?: true }>
> = {
  bronze: { rim: 0xd08a4a, rimDark: 0x8e4e22 },
  silver: { rim: 0xdfe6f0, rimDark: 0x8394ad },
  gold: { rim: 0xffc93a, rimDark: 0xc07a14 },
  special: { rim: 0xf1e6ff, rimDark: 0x8f6fd0, iridescent: true },
};

export const FAMILY_FACES: Readonly<Record<BadgeFamily, number>> = {
  path: 0x2fb5a8,
  streak: 0xff6b3d,
  memory: 0x4a7dff,
  course: 0x35c27a,
  special: 0x8a5cff,
};

/** Keyed by `badgesFor` id. */
export const BADGE_LOOKS: Readonly<Record<string, BadgeLook>> = {
  "first-lesson": { family: "path", metal: "bronze", frame: "coin", icon: "flag" },
  "ten-lessons": { family: "path", metal: "bronze", frame: "coin", icon: "n10" },
  "fifty-lessons": { family: "path", metal: "silver", frame: "coin", icon: "n50" },
  "hundred-lessons": { family: "path", metal: "gold", frame: "coin", icon: "n100" },
  "streak-7": { family: "streak", metal: "bronze", frame: "shield", icon: "flame", plate: "7" },
  "streak-30": { family: "streak", metal: "silver", frame: "shield", icon: "flame", plate: "30" },
  "streak-100": { family: "streak", metal: "gold", frame: "shield", icon: "flame", plate: "100" },
  "first-review": { family: "memory", metal: "bronze", frame: "hex", icon: "loop" },
  "long-term-50": { family: "memory", metal: "silver", frame: "hex", icon: "cards" },
  "mistakes-cleared": { family: "memory", metal: "silver", frame: "hex", icon: "check" },
  "own-words": { family: "memory", metal: "bronze", frame: "hex", icon: "bubble" },
  "first-course": { family: "course", metal: "gold", frame: "crest", icon: "island" },
  "three-courses": { family: "course", metal: "special", frame: "crest", icon: "island3" },
  "both-paths": { family: "course", metal: "special", frame: "crest", icon: "fork" },
  "perfect-lesson": { family: "special", metal: "gold", frame: "star", icon: "star" },
  challenger: { family: "special", metal: "silver", frame: "star", icon: "pennant" },
  "skip-test": { family: "special", metal: "silver", frame: "star", icon: "up" },
};
