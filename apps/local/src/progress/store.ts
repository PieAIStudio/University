/**
 * This shell's ProgressPort, assembled from the shared browser adapter.
 *
 * The bytes used to live only in the delivery shell. Copying
 * `browserPersistence` here would have compiled, and it would have been two
 * implementations of the same try/catch — the next private-browsing fix
 * would land in one campus and not the other. The adapter is in
 * `packages/ui` because that is already where both shells keep their
 * localStorage stores; this file is just the process singleton the campus
 * subscribes to.
 *
 * Completing a lesson in the authoring SQLite store still does not write
 * here. That is the next seam, not an omission of this one: the screens can
 * now ask the document a question. Teaching the reader to answer it is a
 * second change to the completion path.
 */
import { createBrowserProgressPort } from "@pieai/university-ui/progress/store.js";

export const progressPort = createBrowserProgressPort();
