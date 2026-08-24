import {
  EMPTY_FAVOURITES,
  parseFavourites,
  type Favourite,
  type FavouritesState,
} from "../favourites/model.js";
import {
  EMPTY_PRACTICE_RECENT,
  parsePracticeRecent,
  type PracticeRecentState,
} from "../practice/recent.js";

/** The settings that follow the learner between browser profiles. */
export interface AccountForeignSettings {
  readonly showOriginal: boolean;
  readonly markStyle: "underline" | "marker" | "plain";
  readonly showPhonetic: boolean;
  readonly showSpeak: boolean;
  readonly showStageButtons: boolean;
  readonly showUsage: boolean;
}

export type AccountPreferenceKey =
  | "foreignSettings"
  | "foreignLanguageMode"
  | "detailMode"
  | "soundEnabled"
  | "sharesPresence";

export interface AccountPreferences {
  readonly version: 1;
  readonly foreignSettings: AccountForeignSettings;
  readonly foreignLanguageMode: boolean;
  readonly detailMode: "standard" | "all";
  readonly soundEnabled: boolean;
  readonly sharesPresence: boolean;
  /** Per-field timestamps make two devices' independent setting changes merge. */
  readonly updatedAt: Partial<Record<AccountPreferenceKey, string>>;
}

export interface FavouriteChange {
  readonly senseId: string;
  readonly favourite: Favourite | null;
  readonly changedAt: string;
}

/** Account-owned data that is not course content or scheduler state. */
export interface AccountData {
  readonly favourites: FavouritesState;
  readonly favouriteChanges: Record<string, FavouriteChange>;
  readonly practiceRecent: PracticeRecentState;
  readonly preferences: AccountPreferences;
}

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  version: 1,
  foreignSettings: {
    showOriginal: true,
    markStyle: "underline",
    showPhonetic: false,
    showSpeak: false,
    showStageButtons: false,
    showUsage: false,
  },
  foreignLanguageMode: false,
  detailMode: "standard",
  soundEnabled: true,
  sharesPresence: true,
  updatedAt: {},
};

export const emptyAccountData = (): AccountData => ({
  favourites: EMPTY_FAVOURITES,
  favouriteChanges: {},
  practiceRecent: EMPTY_PRACTICE_RECENT,
  preferences: cloneAccountPreferences(DEFAULT_ACCOUNT_PREFERENCES),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function timestampMs(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function parseForeignSettings(value: unknown): AccountForeignSettings {
  const input = isRecord(value) ? value : {};
  const markStyle = input.markStyle;
  return {
    showOriginal: typeof input.showOriginal === "boolean" ? input.showOriginal : true,
    markStyle:
      markStyle === "underline" || markStyle === "marker" || markStyle === "plain"
        ? markStyle
        : "underline",
    showPhonetic: typeof input.showPhonetic === "boolean" ? input.showPhonetic : false,
    showSpeak: typeof input.showSpeak === "boolean" ? input.showSpeak : false,
    showStageButtons: typeof input.showStageButtons === "boolean" ? input.showStageButtons : false,
    showUsage: typeof input.showUsage === "boolean" ? input.showUsage : false,
  };
}

export function parseAccountPreferences(value: unknown): AccountPreferences {
  if (!isRecord(value)) return cloneAccountPreferences(DEFAULT_ACCOUNT_PREFERENCES);
  const updatedAt: Partial<Record<AccountPreferenceKey, string>> = {};
  if (isRecord(value.updatedAt)) {
    for (const key of [
      "foreignSettings",
      "foreignLanguageMode",
      "detailMode",
      "soundEnabled",
      "sharesPresence",
    ] as const) {
      const timestamp = value.updatedAt[key];
      if (validTimestamp(timestamp)) updatedAt[key] = timestamp;
    }
  }
  return {
    version: 1,
    foreignSettings: parseForeignSettings(value.foreignSettings),
    foreignLanguageMode:
      typeof value.foreignLanguageMode === "boolean" ? value.foreignLanguageMode : false,
    detailMode: value.detailMode === "all" ? "all" : "standard",
    soundEnabled: typeof value.soundEnabled === "boolean" ? value.soundEnabled : true,
    sharesPresence: typeof value.sharesPresence === "boolean" ? value.sharesPresence : true,
    updatedAt,
  };
}

export function cloneAccountPreferences(value: AccountPreferences): AccountPreferences {
  return {
    ...value,
    foreignSettings: { ...value.foreignSettings },
    updatedAt: { ...value.updatedAt },
  };
}

export function mergeAccountPreferences(
  left: AccountPreferences,
  right: AccountPreferences,
): AccountPreferences {
  const leftForeign = timestampMs(left.updatedAt.foreignSettings);
  const rightForeign = timestampMs(right.updatedAt.foreignSettings);
  const leftLanguage = timestampMs(left.updatedAt.foreignLanguageMode);
  const rightLanguage = timestampMs(right.updatedAt.foreignLanguageMode);
  const leftDetail = timestampMs(left.updatedAt.detailMode);
  const rightDetail = timestampMs(right.updatedAt.detailMode);
  const leftSound = timestampMs(left.updatedAt.soundEnabled);
  const rightSound = timestampMs(right.updatedAt.soundEnabled);
  const leftPresence = timestampMs(left.updatedAt.sharesPresence);
  const rightPresence = timestampMs(right.updatedAt.sharesPresence);
  const newer = (leftAt: number, rightAt: number) => rightAt >= leftAt;
  const updatedAt = { ...left.updatedAt };
  const result: AccountPreferences = {
    ...left,
    foreignSettings: newer(leftForeign, rightForeign)
      ? { ...right.foreignSettings }
      : { ...left.foreignSettings },
    foreignLanguageMode: newer(leftLanguage, rightLanguage)
      ? right.foreignLanguageMode
      : left.foreignLanguageMode,
    detailMode: newer(leftDetail, rightDetail) ? right.detailMode : left.detailMode,
    soundEnabled: newer(leftSound, rightSound) ? right.soundEnabled : left.soundEnabled,
    sharesPresence: newer(leftPresence, rightPresence) ? right.sharesPresence : left.sharesPresence,
    updatedAt,
  };
  for (const key of [
    "foreignSettings",
    "foreignLanguageMode",
    "detailMode",
    "soundEnabled",
    "sharesPresence",
  ] as const) {
    if (
      right.updatedAt[key] &&
      newer(timestampMs(left.updatedAt[key]), timestampMs(right.updatedAt[key]))
    ) {
      updatedAt[key] = right.updatedAt[key];
    }
  }
  return result;
}

export function parseFavouriteChanges(value: unknown): Record<string, FavouriteChange> {
  if (!isRecord(value)) return {};
  const changes: Record<string, FavouriteChange> = {};
  for (const [senseId, raw] of Object.entries(value)) {
    if (!isRecord(raw) || raw.senseId !== senseId || !validTimestamp(raw.changedAt)) continue;
    const favourite =
      raw.favourite === null
        ? null
        : (parseFavourites({ version: 1, items: [raw.favourite] }).items[0] ?? null);
    changes[senseId] = { senseId, favourite, changedAt: raw.changedAt };
  }
  return changes;
}

export function changesFromFavourites(state: FavouritesState): Record<string, FavouriteChange> {
  return Object.fromEntries(
    state.items.map((item) => [
      item.senseId,
      { senseId: item.senseId, favourite: item, changedAt: item.updatedAt },
    ]),
  );
}

export function materializeFavourites(
  changes: Record<string, FavouriteChange>,
  fallback: FavouritesState = EMPTY_FAVOURITES,
): FavouritesState {
  const items = Object.values(changes)
    .filter((change) => change.favourite !== null)
    .map((change) => change.favourite!);
  return items.length > 0 ? parseFavourites({ version: 1, items }) : fallback;
}

export function mergeFavouriteChanges(
  left: Record<string, FavouriteChange>,
  right: Record<string, FavouriteChange>,
): Record<string, FavouriteChange> {
  const merged: Record<string, FavouriteChange> = { ...left };
  for (const [senseId, change] of Object.entries(right)) {
    const current = merged[senseId];
    if (!current || timestampMs(change.changedAt) >= timestampMs(current.changedAt)) {
      merged[senseId] = { ...change, favourite: change.favourite ? { ...change.favourite } : null };
    }
  }
  return merged;
}

export function parseAccountData(value: unknown): AccountData {
  if (!isRecord(value)) return emptyAccountData();
  const favourites = parseFavourites(value.favourites);
  const parsedChanges = parseFavouriteChanges(value.favouriteChanges);
  const favouriteChanges = mergeFavouriteChanges(changesFromFavourites(favourites), parsedChanges);
  return {
    favourites:
      Object.keys(favouriteChanges).length > 0
        ? materializeFavourites(favouriteChanges)
        : favourites,
    favouriteChanges,
    practiceRecent: parsePracticeRecent(value.practiceRecent),
    preferences: parseAccountPreferences(value.preferences),
  };
}

export function cloneAccountData(value: AccountData): AccountData {
  return {
    favourites: parseFavourites(value.favourites),
    favouriteChanges: Object.fromEntries(
      Object.entries(value.favouriteChanges).map(([key, change]) => [
        key,
        { ...change, favourite: change.favourite ? { ...change.favourite } : null },
      ]),
    ),
    practiceRecent: parsePracticeRecent(value.practiceRecent),
    preferences: cloneAccountPreferences(value.preferences),
  };
}
