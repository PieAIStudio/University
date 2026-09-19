import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Brand tokens first, product layout second: the kit defines the custom
// properties everything below reads.
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/catalog/catalog.css";
import "@pieai/university-ui/capability/capability.css";
import "@pieai/university-ui/cta/liquid-cta.css";
import { App } from "./app/App";
import { LiquidCtaTransitionLayer } from "@pieai/university-ui/cta/LiquidCtaTransition.js";
/*
  Every stylesheet `packages/ui` ships, in both shells, always.

  Three of them were reaching neither: `choice-block.css` and `practice.css`
  were not even in the exports map, and `loading-trivia.css` was exported and
  imported by nobody. The answer options on the practice screen were therefore
  raw `<button>` elements wearing the user agent's 1px padding and centred
  text — on the screen where the learning actually happens, in both shells,
  with the correct stylesheet sitting in the repository the whole time.

  So the rule is not "import what you need". A shell either wears the shared
  package's look or that look does not exist, and a few kilobytes of unused
  CSS is a much smaller cost than one more screen that is styled in one shell
  and bare in the other. `check-shared-styles.mjs` enforces it.
*/
import "@pieai/university-ui/entry/entry-page.css";
import "@pieai/university-ui/entry/style-sample.css";
import "@pieai/university-ui/evidence/evidence.css";
import "@pieai/university-ui/feedback/feedback-note.css";
import "@pieai/university-ui/favourites/favourites.css";
import "@pieai/university-ui/language/word-layer.css";
import "@pieai/university-ui/lesson/lesson-reader.css";
import "@pieai/university-ui/lesson/lesson-toolbar.css";
import "@pieai/university-ui/loading/loading-trivia.css";
import "@pieai/university-ui/loading/recovery-state.css";
import "@pieai/university-ui/markdown/markdown-content.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "@pieai/university-ui/onboarding/welcome-experience.css";
import "@pieai/university-ui/path/course-route-quiz.css";
import "@pieai/university-ui/path/path-cards.css";
import "@pieai/university-ui/practice/practice.css";
import "@pieai/university-ui/learning-play/learning-play.css";
import "@pieai/university-ui/learning-play/hunt.css";
import "@pieai/university-ui/learning-play/sort.css";
import "@pieai/university-ui/learning-play/contrast.css";
import "@pieai/university-ui/learning-play/weigh.css";
import "@pieai/university-ui/learning-play/dispatch.css";
import "@pieai/university-ui/learning-play/program.css";
import "@pieai/university-ui/learning-play/ai-play.css";
import "@pieai/university-ui/learning-play/ai-workflow.css";
import "@pieai/university-ui/learning-play/ai-quality.css";
import "@pieai/university-ui/learning-play/ai-context-play.css";
import "@pieai/university-ui/learning-play/ai-agent-play.css";
import "@pieai/university-ui/learning-play/play-usability.css";
import "@pieai/university-ui/learning-play/quality-usability.css";
import "@pieai/university-ui/learning-play/workflow-usability.css";

import "@pieai/university-ui/practice/mistakes.css";
import "@pieai/university-ui/presence/presence.css";
import "@pieai/university-ui/reference/knowledge-notes.css";
import "@pieai/university-ui/reference/reference-panel.css";
import "@pieai/university-ui/reference/term-index.css";
import "@pieai/university-ui/review/choice-block.css";
import "@pieai/university-ui/notifications/review-reminders.css";
import "@pieai/university-ui/shell/app-shell.css";
import "@pieai/university-ui/sound/sound-toggle.css";
import "@pieai/university-ui/today/today.css";
import "@pieai/university-ui/markdown/markdown-body.css";
import "@pieai/university-ui/review/host-grade.css";
import "@pieai/university-ui/evidence/evidence-item.css";
import "@pieai/university-ui/evidence/evidence-inline-source.css";
import "@pieai/university-ui/evidence/source-sheet.css";
import "@pieai/university-ui/lesson/margin-note.css";
import "@pieai/university-ui/lesson/word-list.css";
import "@pieai/university-ui/lesson/mark-list.css";
import "@pieai/university-ui/navigation/location-breadcrumbs.css";
import "@pieai/university-ui/path/map-entry-action.css";
import "@pieai/university-ui/shell/map-shell.css";
import "@pieai/university-world/overlay.css";
import "./styles.css";
import { I18nProvider, localeNavigationUrl } from "@pieai/university-ui/i18n.js";
import { applyThemePreference } from "@pieai/university-ui/theme.js";
import { localeDemandPort, recordLocaleRequest } from "./analytics/locale-demand";
import { initProductAnalytics, trackEvent } from "./analytics/productAnalytics";
import { progressPort } from "./progress/store";

// Resolve the cached account preference before React paints the learner surface.
applyThemePreference(progressPort.accountData().preferences.theme);
recordLocaleRequest(localeDemandPort, typeof navigator === "undefined" ? null : navigator.language);

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container in index.html");

// Some shared navigation tables are assembled once at module evaluation.
// Start a fresh, consistently localized view after an explicit settings action;
// preserve the route and use the URL as a fallback when storage is unavailable.
window.addEventListener("university:locale-change", (event) => {
  const locale = (event as CustomEvent<string>).detail;
  if (locale === "en" || locale === "zh-CN") {
    window.location.replace(localeNavigationUrl(window.location.href, locale));
  }
});

void initProductAnalytics().then(() => trackEvent({ name: "app_open" }));

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <LiquidCtaTransitionLayer />
    </I18nProvider>
  </StrictMode>,
);
