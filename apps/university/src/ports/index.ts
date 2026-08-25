/**
 * The two permitted differences, chosen once, at build time.
 *
 * V4 states the law: where the AI comes from is the only thing the two campuses
 * may disagree about. Counting the code found a second — where a lesson's text
 * comes from — and this file is both of them, in one place, so a third cannot
 * be added by accident. Everything above these three ports is one
 * implementation.
 *
 * `AUTHORING` is a build-time constant, so Rollup keeps one branch and drops
 * the other along with everything it imports. A runtime capabilities object
 * would read the same here and put the whole authoring campus in the customer's
 * bundle.
 *
 * Nothing here takes a callback. Finishing a lesson used to be announced by
 * whichever port noticed first — the reader in one campus, the grader in the
 * other — and the two campuses then did different things with the news. It is
 * read off the shared document now, by the one screen that owns the reward.
 */
import type { GradingPort, ReaderPort } from "@pieai/university-core";
import type { ContentPort } from "@pieai/university-ui/content/port.js";

import { AUTHORING } from "../mode.js";
import { progressPort } from "../progress/store.js";
import { createLocalContentPort } from "./local/content.js";
import { createLocalGradingPort } from "./local/grading.js";
import { createLocalReaderPort } from "./local/reader.js";
import { createOnlineContentPort } from "./online/content.js";
import { createOnlineGradingPort } from "./online/grading.js";
import { createOnlineReaderPort } from "./online/reader.js";

/** One shelf per document. Both implementations are stateless above their caches. */
export const contentPort: ContentPort = AUTHORING
  ? createLocalContentPort({ progress: progressPort })
  : createOnlineContentPort();

export const readerPort: ReaderPort = AUTHORING
  ? createLocalReaderPort({ progress: progressPort })
  : createOnlineReaderPort({ progress: progressPort });

export const gradingPort: GradingPort = AUTHORING
  ? createLocalGradingPort({ progress: progressPort })
  : createOnlineGradingPort({ progress: progressPort });
