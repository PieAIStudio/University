import { useMemo } from "react";
import { NerveDetailsSchema } from "@pieai/swimmer-nerve-kit/details";
import { NerveDetailsPanel } from "@pieai/swimmer-nerve-kit/details-surface";
import { useI18n } from "@pieai/university-ui/i18n.js";

/**
 * What 涟 can and cannot do, in Settings (ADR-0012). SwimmerNerveKit's
 * `NerveDetailsPanel` is embeddable content, not another window; University
 * supplies the facts. Phase one has no model, no voice, no cost and nothing
 * remembered, so there is no appearance or memory store to embed — adding one
 * would be a second copy of settings the account already syncs.
 */
export function MapGuideDetails() {
  const interfaceTranslator = useI18n();
  const { locale } = interfaceTranslator;
  const information = useMemo(
    () =>
      NerveDetailsSchema.parse({
        hostLabel: "University",
        description: interfaceTranslator.t("map.guide.details.description"),
        scopeLabel: interfaceTranslator.t("map.guide.details.scope"),
        connection: {
          status: "disconnected",
          note: interfaceTranslator.t("map.guide.details.connection"),
        },
        costs: { notice: interfaceTranslator.t("map.guide.details.cost") },
        capabilities: [
          {
            id: "map-help",
            label: interfaceTranslator.t("map.guide.details.help"),
            state: "available",
            description: interfaceTranslator.t("map.guide.details.helpDetail"),
          },
          {
            id: "conversation",
            label: interfaceTranslator.t("map.guide.details.chat"),
            state: "unavailable",
            description: interfaceTranslator.t("map.guide.details.chatDetail"),
          },
          {
            id: "voice",
            label: interfaceTranslator.t("map.guide.details.voice"),
            state: "unavailable",
            description: interfaceTranslator.t("map.guide.details.voiceDetail"),
          },
        ],
        privacy: [
          interfaceTranslator.t("map.guide.details.privacyQuestions"),
          interfaceTranslator.t("map.guide.details.privacyProgress"),
        ],
      }),
    // The facts are translated copy; a new locale is a new set of facts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );
  return <NerveDetailsPanel information={information} />;
}
