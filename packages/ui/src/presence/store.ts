/**
 * How a browser shell constructs the shared presence port.
 *
 * Core owns the port and the in-memory bus; this file is the one assembly
 * both shells call, the same reason `createBrowserProgressPort` exists.
 * Today that assembly is the memory bus — `university.study_groups` is not
 * deployed, and constructing a Realtime channel against a missing table
 * would look like a broken feature rather than an unbuilt one.
 *
 * `?presence-fixture` seeds two group-mates so a screenshot or a local
 * walkthrough has something to look at. It is a development/test-only
 * query-param seam, not a fake backend: the production build does not read it,
 * and the Supabase adapter stays unwired regardless.
 */
import { translate } from "../i18n/index.js";
import {
  createMemoryPresencePort,
  type PresencePort,
  type PresenceSelf,
} from "@pieai/university-core";

import { readSharesPresence } from "./shares-presence.js";

const FIXTURE_ADA = { userId: "fixture-ada", displayName: "Ada" };
const FIXTURE_LIN = { userId: "fixture-lin", displayName: "Lin" };
const FIXTURE_LESSON = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonId: "you-already-know-apps",
};

export function createBrowserPresencePort(self?: PresenceSelf): PresencePort {
  const me = self ?? { userId: "local-guest", displayName: translate("ui.presence.store.copy.我") };
  const port = createMemoryPresencePort({
    self: me,
    sharesPresence: readSharesPresence(),
    seeAs: fixtureRequested()
      ? { [FIXTURE_ADA.userId]: "group", [FIXTURE_LIN.userId]: "friend" }
      : undefined,
  });

  if (fixtureRequested()) {
    const ada = createMemoryPresencePort({
      self: FIXTURE_ADA,
      bus: port.bus,
      seeAs: { [me.userId]: "group" },
    });
    ada.publishLocation(FIXTURE_LESSON);
    ada.publishCursor({ x: 0.46, y: 0.42, viewKey: "world" });
    const lin = createMemoryPresencePort({
      self: FIXTURE_LIN,
      bus: port.bus,
      seeAs: { [me.userId]: "group" },
    });
    lin.publishLocation({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonId: null,
    });
  }

  return port;
}

function fixtureRequested(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("presence-fixture");
  } catch {
    return false;
  }
}
