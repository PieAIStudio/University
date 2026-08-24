/** The local shell uses the same SwimmerBackend/Auth assembly as online. */
import { createUniversityBackend, type BrowserEnv } from "@pieai/university-backend/browser.js";

const backend = createUniversityBackend(import.meta.env as unknown as BrowserEnv);

export const swimmerCoreClient = backend.client;
export const identityPort = backend.identityPort;
export const progressRemoteStore = backend.progressRemoteStore;
