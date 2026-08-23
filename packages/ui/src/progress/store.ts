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
 * remote merge will, once University has a schema.
 */
import { createProgressPort, type ProgressPort } from "@pieai/university-core";

import { createBrowserPersistence } from "./browser-persistence.js";

export { createBrowserPersistence } from "./browser-persistence.js";

export function createBrowserProgressPort(): ProgressPort {
  return createProgressPort({ persistence: createBrowserPersistence() });
}
