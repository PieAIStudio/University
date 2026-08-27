/**
 * The three permitted differences, chosen once, at build time.
 *
 * The learner surface is one implementation. The only questions the two
 * builds answer differently are where the AI comes from, where the lesson
 * material comes from, and whether this side can reach the repository behind
 * the lesson. Keeping all three choices here prevents a UI component from
 * growing an `AUTHORING ? ... : null` branch when a capability is missing.
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
import type {
  GradingPort,
  ReaderPort,
  ReviewReminderPort,
  SourceAccessPort,
} from "@pieai/university-core";
import type { ContentPort } from "@pieai/university-ui/content/port.js";

import { identityPort } from "../account/identity";
import { AUTHORING } from "../mode.js";
import { progressPort } from "../progress/store.js";
import { createLocalContentPort } from "./local/content.js";
import { createLocalGradingPort } from "./local/grading.js";
import { createLocalReaderPort } from "./local/reader.js";
import { createLocalSourceAccessPort } from "./local/source-access.js";
import { createOnlineContentPort } from "./online/content.js";
import { createOnlineGradingPort } from "./online/grading.js";
import { createOnlineReaderPort } from "./online/reader.js";
import { createOnlineSourceAccessPort } from "./online/source-access.js";
import { createBrowserReviewReminderPort } from "./notifications.js";

/** One shelf per document. Both implementations are stateless above their caches. */
export const contentPort: ContentPort = AUTHORING
  ? createLocalContentPort({ progress: progressPort })
  : createOnlineContentPort();

export const readerPort: ReaderPort = AUTHORING
  ? createLocalReaderPort({ progress: progressPort })
  : createOnlineReaderPort({ progress: progressPort });

export const gradingPort: GradingPort = AUTHORING
  ? createLocalGradingPort({ progress: progressPort })
  : createOnlineGradingPort({
      progress: progressPort,
      readAccessToken: () => identityPort.readAccessToken(),
    });

/** Repository access is the third boundary: action locally, explanation in delivery. */
export const sourceAccessPort: SourceAccessPort = AUTHORING
  ? createLocalSourceAccessPort()
  : createOnlineSourceAccessPort();

const vapidPublicKey = import.meta.env.VITE_UNIVERSITY_VAPID_PUBLIC_KEY;

export const reviewReminderPort: ReviewReminderPort = createBrowserReviewReminderPort({
  progress: progressPort,
  vapidPublicKey,
});

/**
 * Whether anything can actually deliver a reminder, and therefore whether the
 * settlement may spend the browser's permission moment on one.
 *
 * The public VAPID key is the honest signal: it is the sender's identity, so
 * configuring it is the deliberate act of saying a sender exists. Without it
 * `pushManager.subscribe` still succeeds and still stores a subscription that
 * nothing in the world can push to.
 *
 * That matters because notification permission is a one-shot, effectively
 * irreversible resource — Chrome remembers a denial and stops asking, and the
 * settlement is documented never to re-ask after one. Spending it on a
 * known-zero return, in the minute after someone finishes a lesson, is a bad
 * trade no matter how honest the copy is. The settings toggle stays available
 * the whole time: a learner who goes looking is asking on their own behalf.
 *
 * When SwimmerBackend grows the sender, set the key and the pre-prompt comes
 * back on its own. Nothing about it needs rewriting.
 */
export const REVIEW_REMINDER_SENDER_CONFIGURED = Boolean(vapidPublicKey?.trim());
