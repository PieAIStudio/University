/**
 * The local shell's shared ProgressPort assembly.
 *
 * The browser cache is only the offline queue. Once the same account binding
 * used by the online shell is active, this port merges and writes the cloud
 * document through SwimmerBackend. SQLite remains the local content/host
 * workflow cache; it is no longer the cross-device source of truth.
 */
import type { ProgressRemoteStore } from "@pieai/university-core";
import { createBrowserProgressPort } from "@pieai/university-ui/progress/store.js";
import { progressRemoteStore } from "../account/identity.js";

export const progressPort = createBrowserProgressPort();
export const cloudProgressRemoteStore: ProgressRemoteStore | null = progressRemoteStore;
