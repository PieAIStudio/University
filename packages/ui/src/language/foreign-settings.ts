/**
 * How the foreign-language layer behaves while reading.
 *
 * These are ways of reading, not facts about a course, so they live in the
 * browser beside the on/off switch rather than in the learner database.
 */

import { translate } from "../i18n/index.js";

/** How an annotated word is marked in the prose. */
export type WordMarkStyle = "underline" | "marker" | "plain";

export interface ForeignSettings {
  /**
   * Whether the replaced Chinese stays visible beside the English word.
   *
   * The single most consequential setting here, and the one that cannot be
   * satisfied for two goals at once. With it on, a reader is never stuck —
   * `event（事件日志）` is readable at a glance, which is what makes technical
   * prose survivable. With it on, there is also nothing to retrieve: the answer
   * is printed next to the question, and reading it produces almost no memory.
   * Retrieval — trying and failing before being told — is what does. So a
   * reader who wants both has to pick which one this lesson is for.
   */
  readonly showOriginal: boolean;
  readonly markStyle: WordMarkStyle;
  readonly showPhonetic: boolean;
  readonly showSpeak: boolean;
  /** The 认识 / 还不熟 / 暂不学 buttons that feed the review queue. */
  readonly showStageButtons: boolean;
  /** Example sentence in the card. */
  readonly showUsage: boolean;
}

export type ForeignPreset = "read" | "pronounce" | "remember" | "custom";

/**
 * Three ways of using the layer, because the three things a reader can want
 * from it pull in different directions.
 *
 * Presented as presets rather than six switches for a reason: the switches
 * interact, and asking someone to rediscover that `showOriginal` quietly
 * cancels the point of `showStageButtons` — every time they open the panel —
 * is asking them to redo the analysis themselves. A preset is that analysis,
 * already done, with the switches still there for anyone who disagrees.
 */
export const FOREIGN_PRESETS: Readonly<Record<Exclude<ForeignPreset, "custom">, ForeignSettings>> =
  {
    /** Least interruption. The word is legible in place and asks nothing. */
    read: {
      showOriginal: true,
      markStyle: "underline",
      showPhonetic: false,
      showSpeak: false,
      showStageButtons: false,
      showUsage: false,
    },
    /** Reading, plus what it sounds like. */
    pronounce: {
      showOriginal: true,
      markStyle: "underline",
      showPhonetic: true,
      showSpeak: true,
      showStageButtons: false,
      showUsage: true,
    },
    /**
     * The English stands alone, so meeting the word is an attempt rather than a
     * reading. The meaning is one hover away — the effort is meant to be brief,
     * not punishing — and the buttons that follow are what put the word into the
     * review queue.
     */
    remember: {
      showOriginal: false,
      markStyle: "marker",
      showPhonetic: true,
      showSpeak: true,
      showStageButtons: true,
      showUsage: true,
    },
  };

export const PRESET_LABELS: Readonly<Record<Exclude<ForeignPreset, "custom">, string>> = {
  get read() {
    return translate("reading.preset.read");
  },
  get pronounce() {
    return translate("reading.preset.pronounce");
  },
  get remember() {
    return translate("reading.preset.remember");
  },
};

export const PRESET_HINTS: Readonly<Record<Exclude<ForeignPreset, "custom">, string>> = {
  get read() {
    return translate("reading.preset.readHint");
  },
  get pronounce() {
    return translate("reading.preset.pronounceHint");
  },
  get remember() {
    return translate("reading.preset.rememberHint");
  },
};

const SETTINGS_KEY = "university-local.foreign-settings";

export const DEFAULT_FOREIGN_SETTINGS: ForeignSettings = FOREIGN_PRESETS.read;

/** Which preset these settings are, or `custom` when they match none. */
export function presetOf(settings: ForeignSettings): ForeignPreset {
  for (const [name, preset] of Object.entries(FOREIGN_PRESETS)) {
    if (
      preset.showOriginal === settings.showOriginal &&
      preset.markStyle === settings.markStyle &&
      preset.showPhonetic === settings.showPhonetic &&
      preset.showSpeak === settings.showSpeak &&
      preset.showStageButtons === settings.showStageButtons &&
      preset.showUsage === settings.showUsage
    ) {
      return name as ForeignPreset;
    }
  }
  return "custom";
}

const MARK_STYLES: readonly WordMarkStyle[] = ["underline", "marker", "plain"];

/**
 * Reads stored settings, field by field.
 *
 * Merged over the default rather than trusted wholesale: the stored value comes
 * from an older version of this app as often as not, and a missing field should
 * take the current default instead of turning into `undefined` somewhere in a
 * component.
 */
export function readForeignSettings(): ForeignSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_FOREIGN_SETTINGS;
    const stored = JSON.parse(raw) as Partial<ForeignSettings>;
    const markStyle =
      typeof stored.markStyle === "string" && MARK_STYLES.includes(stored.markStyle)
        ? stored.markStyle
        : DEFAULT_FOREIGN_SETTINGS.markStyle;
    const flag = (value: unknown, fallback: boolean) =>
      typeof value === "boolean" ? value : fallback;
    return {
      showOriginal: flag(stored.showOriginal, DEFAULT_FOREIGN_SETTINGS.showOriginal),
      markStyle,
      showPhonetic: flag(stored.showPhonetic, DEFAULT_FOREIGN_SETTINGS.showPhonetic),
      showSpeak: flag(stored.showSpeak, DEFAULT_FOREIGN_SETTINGS.showSpeak),
      showStageButtons: flag(stored.showStageButtons, DEFAULT_FOREIGN_SETTINGS.showStageButtons),
      showUsage: flag(stored.showUsage, DEFAULT_FOREIGN_SETTINGS.showUsage),
    };
  } catch {
    return DEFAULT_FOREIGN_SETTINGS;
  }
}

export function writeForeignSettings(settings: ForeignSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A browser with storage disabled still gets the panel, just not the memory.
  }
}
