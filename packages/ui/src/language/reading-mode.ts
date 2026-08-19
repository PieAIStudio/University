/**
 * Whether lessons are read with the foreign-language layer turned on.
 *
 * This is a way of reading, not a fact about the course, so the preference
 * lives in the browser rather than in the learner database. Default off: a
 * lesson has to read exactly as it did before anybody opts in.
 */

/**
 * The stored key still says `english-mode` although the feature is now called
 * 外语模式. The name in storage is a contract with every browser that already
 * has a value under it; renaming it would silently switch the layer back off
 * for anyone who had turned it on.
 */
const READING_MODE_KEY = "university-local.english-mode";

export function readForeignLanguageMode(): boolean {
  try {
    return window.localStorage.getItem(READING_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeForeignLanguageMode(enabled: boolean): void {
  try {
    window.localStorage.setItem(READING_MODE_KEY, enabled ? "on" : "off");
  } catch {
    // A browser with storage disabled still gets the toggle, just not the memory.
  }
}
