import { StrictMode, forwardRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { NerveI18nProvider } from "@pieai/swimmer-nerve-kit/i18n/react";
import { NerveUIProvider, type NerveUIComponents } from "@pieai/swimmer-nerve-kit/ui";
import {
  GameButton,
  GameField,
  GameIconButton,
  GameInput,
  GameModal,
  GameOtpInput,
  GameSelect,
  GameTabs,
  GameTextArea,
} from "@pieai/swimmer-ui-kit";
import {
  AuthUIProvider,
  type AuthButtonProps,
  type AuthControls,
} from "@pieaistudio/swimmer-auth-kit/react";

// Brand tokens first, product layout second: the kit defines the custom
// properties everything below reads.
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/swimmer-ui-kit/liquid-presence.css";
// 涟's entry and its settings section (ADR-0012), drawn over UIKit's tokens.
import "@pieai/swimmer-nerve-kit/interaction.css";
import "@pieai/swimmer-nerve-kit/details.css";
import "@pieai/university-ui/catalog/catalog.css";
import "@pieai/university-ui/cosmetics/cosmetics.css";
import "@pieai/university-ui/house/house.css";
import "@pieai/university-ui/capability/capability.css";
import "@pieai/university-ui/cta/liquid-cta.css";
import { App } from "./app/composition/App";
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
import "@pieai/university-ui/navigation/screens/weekly-boss-records.css";
import "@pieai/university-ui/onboarding/welcome-experience.css";
import "@pieai/university-ui/path/course-route-quiz.css";
import "@pieai/university-ui/path/path-cards.css";
import "@pieai/university-ui/map-nodes/map-nodes.css";
import "@pieai/university-ui/game-frame/game-frame.css";
import "@pieai/university-ui/practice/practice.css";
import "@pieai/university-ui/learning-play/learning-play.css";
import "@pieai/university-ui/play-catalog/play-catalog.css";
import "@pieai/university-ui/learning-play/primm.css";
import "@pieai/university-ui/learning-play/sort.css";
import "@pieai/university-ui/learning-play/play-usability.css";

import "@pieai/university-ui/practice/mistakes.css";
import "@pieai/university-ui/presence/presence.css";
import "@pieai/university-ui/reference/knowledge-notes.css";
import "@pieai/university-ui/reference/reference-panel.css";
import "@pieai/university-ui/reference/term-index.css";
import "@pieai/university-ui/review/choice-block.css";
import "@pieai/university-ui/notifications/review-reminders.css";
import "@pieai/university-ui/shell/app-shell.css";
import "@pieai/university-ui/world-style.css";
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
import "@pieai/university-ui/path/chest-rewards.css";
import "@pieai/university-ui/path/weekly-boss-fight.css";
import "@pieai/university-ui/shell/map-shell.css";
import "@pieai/university-world/overlay.css";
import "./styles.css";
import {
  InterfaceLanguageProvider,
  localeNavigationUrl,
  useI18n,
} from "@pieai/university-ui/i18n.js";
import { applyThemePreference, applyUiStylePreference } from "@pieai/university-ui/theme.js";
import { localeDemandPort, recordLocaleRequest } from "./analytics/locale-demand";
import { initProductAnalytics, trackEvent } from "./analytics/productAnalytics";
import { progressPort } from "./progress/store";
import { nerveLanguage } from "./nerve-language";

// Resolve the cached account preference before React paints the learner surface.
const initialResolvedTheme = applyThemePreference(progressPort.accountData().preferences.theme);
applyUiStylePreference(progressPort.accountData().preferences.uiStyle);
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

const nerveUI = {
  Button: GameButton,
  IconButton: GameIconButton,
  TextArea: GameTextArea,
  Tabs: GameTabs,
  Modal: GameModal,
} satisfies NerveUIComponents;

const authButton = forwardRef<HTMLButtonElement, Omit<AuthButtonProps, "ref">>(function AuthButton(
  { children, ...props },
  ref,
) {
  return (
    <GameButton {...(props as any)} ref={ref}>
      {children}
    </GameButton>
  );
});

const authControls = {
  Button: authButton,
  Input: GameInput,
  Field: GameField,
  Select: GameSelect,
  OtpInput: GameOtpInput,
} satisfies AuthControls;

function UniversityApplication() {
  const { locale } = useI18n();
  // One expression per locale: a new value only when the language changes.
  const nerve = useMemo(() => nerveLanguage(locale), [locale]);
  return (
    <NerveI18nProvider value={nerve}>
      <NerveUIProvider components={nerveUI}>
        <AuthUIProvider controls={authControls} captchaTheme={initialResolvedTheme}>
          <App />
          <LiquidCtaTransitionLayer />
        </AuthUIProvider>
      </NerveUIProvider>
    </NerveI18nProvider>
  );
}

createRoot(container).render(
  <StrictMode>
    <InterfaceLanguageProvider>
      <UniversityApplication />
    </InterfaceLanguageProvider>
  </StrictMode>,
);
