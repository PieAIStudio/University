/** Retained image-renderer regression, not a published lesson or a model run.
 * New course prose may be text-only; that must not retire the photo-layout guard. */
import { createRoot } from "react-dom/client";
import { localizeActivity } from "@pieai/university-core";
import { PrimmLesson } from "@pieai/university-ui/learning-play/PrimmLesson.js";
import { InterfaceLanguageProvider, setInterfaceLocale } from "@pieai/university-ui/i18n.js";
import { primmStepsFixture } from "../../../packages/core/src/learning-play/fixtures/primm-steps.js";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "@pieai/university-ui/learning-play/primm.css";

setInterfaceLocale("en");
createRoot(document.getElementById("root")!).render(
  <InterfaceLanguageProvider locale="en">
    <main className="shell-screen">
      <p data-synthetic-photo-layout>
        Isolated renderer check. The delayed image is synthetic; no lesson, account or AI call.
      </p>
      <PrimmLesson
        activity={localizeActivity(primmStepsFixture, "en")}
        assets={[
          {
            id: "everyday-coffee",
            kind: "authorized-external",
            mime: "image/svg+xml",
            url: "/e2e-fixtures/primm-layout-image.svg",
            alt: "Synthetic tall image for a layout regression",
          },
        ]}
      />
    </main>
  </InterfaceLanguageProvider>,
);
