/**
 * The authoring shell's presence singleton.
 *
 * Same factory the delivery shell calls. A second in-memory bus here would
 * be two implementations of "who is with me", and the shells would then
 * disagree about the switch.
 */
import { createBrowserPresencePort } from "@pieai/university-ui/presence.js";

export const presencePort = createBrowserPresencePort();
