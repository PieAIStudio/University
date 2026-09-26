import { useMemo } from "react";
import { NerveDetailsSchema } from "@pieai/swimmer-nerve-kit/details";
import { NerveDetailsPanel } from "@pieai/swimmer-nerve-kit/details-surface";
import { translate as t, useI18n } from "@pieai/university-ui/i18n.js";

/**
 * What 涟 can and cannot do, in Settings (ADR-0012). SwimmerNerveKit's
 * `NerveDetailsPanel` is embeddable content, not another window; University
 * supplies the facts. Phase one has no model, no voice, no cost and nothing
 * remembered, so there is no appearance or memory store to embed — adding one
 * would be a second copy of settings the account already syncs.
 */
export function MapGuideDetails() {
  const { locale } = useI18n();
  const information = useMemo(
    () =>
      NerveDetailsSchema.parse({
        hostLabel: "University",
        description: t("map.guide.details.description"),
        scopeLabel: t("map.guide.details.scope"),
        connection: { status: "disconnected", note: t("map.guide.details.connection") },
        costs: { notice: t("map.guide.details.cost") },
        capabilities: [
          {
            id: "map-help",
            label: t("map.guide.details.help"),
            state: "available",
            description: t("map.guide.details.helpDetail"),
          },
          {
            id: "conversation",
            label: t("map.guide.details.chat"),
            state: "unavailable",
            description: t("map.guide.details.chatDetail"),
          },
          {
            id: "voice",
            label: t("map.guide.details.voice"),
            state: "unavailable",
            description: t("map.guide.details.voiceDetail"),
          },
        ],
        privacy: [t("map.guide.details.privacyQuestions"), t("map.guide.details.privacyProgress")],
      }),
    // The facts are translated copy; a new locale is a new set of facts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );
  return <NerveDetailsPanel information={information} />;
}
