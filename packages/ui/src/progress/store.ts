/**
 * How a browser shell constructs the shared progress port.
 *
 * `createProgressPort` is parameterized on Persistence so core never has to
 * know where the bytes go. This is the one assembly both shells are
 * supposed to call — not because the two-line wiring is hard, but because
 * a third way of building the port (a file, a fetch, a second key) is how
 * two documents that look the same start silently disagreeing.
 *
 * Each shell still owns its process singleton. 9998 and 9999 are different
 * origins, so a singleton in this package would not sync them anyway; the
 * shared remote merge is what joins those caches.
 */
import { createProgressPort, type ProgressPort } from "@pieai/university-core";
import { readLocalFavourites } from "../favourites/storage.js";
import { readLocalPracticeRecent } from "../practice/storage.js";
import { readDetailMode } from "../language/detail-mode.js";
import { readForeignSettings } from "../language/foreign-settings.js";
import { readForeignLanguageMode } from "../language/reading-mode.js";
import { readSharesPresence } from "../presence/shares-presence.js";
import { isSoundEnabled } from "../sound/sound.js";

import { createBrowserPersistence } from "./browser-persistence.js";

export { createBrowserPersistence } from "./browser-persistence.js";

export function createBrowserProgressPort(): ProgressPort {
  const port = createProgressPort({ persistence: createBrowserPersistence() });
  const current = port.accountData();
  const legacyFavourites = readLocalFavourites();
  if (current.favourites.items.length === 0 && legacyFavourites.items.length > 0) {
    port.setFavourites(legacyFavourites);
  }
  if (current.practiceRecent.ids.length === 0) {
    const legacyPractice = readLocalPracticeRecent();
    if (legacyPractice.ids.length > 0) port.setPracticeRecent(legacyPractice);
  }
  const preferences = current.preferences;
  port.setAccountPreferences({
    ...preferences,
    foreignSettings: Object.keys(preferences.updatedAt).includes("foreignSettings")
      ? preferences.foreignSettings
      : readForeignSettings(),
    foreignLanguageMode: preferences.updatedAt.foreignLanguageMode
      ? preferences.foreignLanguageMode
      : readForeignLanguageMode(),
    detailMode: preferences.updatedAt.detailMode ? preferences.detailMode : readDetailMode(),
    soundEnabled: preferences.updatedAt.soundEnabled ? preferences.soundEnabled : isSoundEnabled(),
    sharesPresence: preferences.updatedAt.sharesPresence
      ? preferences.sharesPresence
      : readSharesPresence(),
  });
  return port;
}
