/**
 * The delivery shell's presence singleton.
 *
 * Memory, not Realtime: the adapter in `account/presence.ts` is written and
 * deliberately not called. See that file for what has to happen first.
 */
import { createBrowserPresencePort } from "@pieai/university-ui/presence.js";

export const presencePort = createBrowserPresencePort();
