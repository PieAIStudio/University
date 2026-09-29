/** Browser-only presentation fixture, not imported by the product entry. */
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  createProgressPort,
  type IdentityStatus,
  type PaymentPort,
  type ProgressPort,
  type View,
} from "@pieai/university-core";
import { InterfaceLanguageProvider, useI18n } from "@pieai/university-ui/i18n.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { NerveI18nProvider } from "@pieai/swimmer-nerve-kit/i18n/react";
import { nerveLanguage } from "../src/nerve-language.js";
import { MapGuide } from "../src/guide/MapGuide.js";
import { useJourney } from "../src/app/use-journey.js";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/swimmer-ui-kit/liquid-presence.css";
import "@pieai/swimmer-nerve-kit/interaction.css";
import "@pieai/university-world/overlay.css";

const kind = new URL(location.href).searchParams.get("state");
const owner = "synthetic-journey-owner";
const identity = {
  kind: "signed_in",
  user: { id: owner, email: "synthetic@example.test" },
} as IdentityStatus;
const locator = { studyId: "fixture", courseId: "fixture", unitId: "one", lessonId: "one" };
const course = {
  id: "fixture",
  title: "Synthetic lesson",
  units: [
    {
      id: "one",
      objective: "",
      lessons: [
        {
          id: "one",
          title: "Synthetic completed lesson",
          contentRevision: 1,
          exerciseCount: 0,
          exerciseIds: [],
          contentChars: 100,
          cardCount: 0,
          progress: null,
        },
      ],
    },
  ],
} as unknown as CourseView;
const local = createProgressPort({ persistence: { read: () => null, write: () => {} } });
// Test data only; this port has no browser persistence or remote transport.
local.snapshot().lessons["fixture/fixture/one"] = {
  progress: 1,
  completedAt: Date.now(),
  attempts: 0,
  readConfirmed: true,
  readConfirmedRevision: 1,
};
const progress: ProgressPort = {
  ...local,
  syncState: () => ({
    ...local.syncState(),
    userId: owner,
    remoteAvailable: true,
    dirty: false,
    status: "idle",
    lastSyncedAt: Date.now(),
  }),
};
const writes: string[] = [];
(window as any).__journeyFixtureWrites = writes;
const payment = {
  readEntitlements: async () => ({
    kind: "value",
    value: { source: "remote", planId: kind === "member" ? "member" : "free" },
  }),
} as unknown as PaymentPort;
const courseOf = () => course;

function Fixture() {
  const t = useI18n();
  const [view, setView] = useState<View>({ kind: "settled", ...locator });
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  const journey = useJourney({
    view,
    identity,
    progress,
    document,
    payment,
    courseOf,
    onMap: () => setView({ kind: "course", studyId: locator.studyId, courseId: locator.courseId }),
    onLesson: () => {},
    onAccount: () => writes.push("account"),
    onMember: () => writes.push("membership"),
    onReview: () => writes.push("review"),
  });
  return (
    <NerveI18nProvider value={nerveLanguage(t.locale)}>
      <main className="stagewrap" style={{ height: "100dvh" }}>
        <header style={{ position: "absolute", top: 12, left: 12 }}>
          <h1 style={{ fontSize: 16 }}>Synthetic account presentation</h1>
          <p>Not a live account or cloud-save receipt.</p>
          <span data-fixture-ready>Ready</span>
          {view.kind === "settled" ? (
            <button data-fixture-finish onClick={() => journey.afterLesson(locator)}>
              Show completion
            </button>
          ) : (
            <button data-fixture-again onClick={() => setView({ kind: "settled", ...locator })}>
              Another completion
            </button>
          )}
        </header>
        {view.kind === "course" ? (
          <MapGuide
            ready
            map={{
              view: "course",
              scope: "synthetic-journey-course",
              markers: [],
              lessonTitle: () => "",
              courseProgress: () => null,
            }}
            journey={journey.opening}
            onShortcuts={() => {}}
          />
        ) : null}
      </main>
    </NerveI18nProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <InterfaceLanguageProvider>
    <Fixture />
  </InterfaceLanguageProvider>,
);
