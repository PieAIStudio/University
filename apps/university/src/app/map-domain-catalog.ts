/**
 * Explicit display taxonomy; course production and progress do not depend on it.
 * Keep classification out of the renderer and never infer it from course titles.
 * Unknown studies remain visible until their domain has been deliberately assigned.
 */
import { translate } from "@pieai/university-ui/i18n.js";
import type { PlanetStudy, PlanetStudyDomain } from "@pieai/university-world/planet.js";

export type MapDomain = PlanetStudyDomain;

/** These are declared learning domains, not unpublished courses on the shelf. */
export function mapDomainCatalog(): readonly MapDomain[] {
  return [
    {
      id: "programming",
      surfaceStyle: "meadow",
      title: translate("ui.world.domain.programming"),
      description: translate("ui.world.domain.programming.description"),
    },
    {
      id: "ai-foundations",
      surfaceStyle: "dawn",
      title: translate("ui.world.domain.aiFoundations"),
      description: translate("ui.world.domain.aiFoundations.description"),
    },
    {
      id: "ai-games",
      surfaceStyle: "lagoon",
      title: translate("ui.world.domain.aiGames"),
      description: translate("ui.world.domain.aiGames.description"),
    },
    {
      id: "ai-media",
      surfaceStyle: "iris",
      title: translate("ui.world.domain.aiMedia"),
      description: translate("ui.world.domain.aiMedia.description"),
    },
  ];
}

const STUDY_DOMAINS: Readonly<Record<string, "programming" | "ai-foundations" | "ai-games">> =
  Object.freeze({
    "turing-pact": "ai-games",
    "ai-foundations": "ai-foundations",
    "ai-literacy": "ai-foundations",
    general: "programming",
    "browser-ai": "programming",
  });

export function mapDomainForStudy(studyId: string): MapDomain {
  const id = Object.hasOwn(STUDY_DOMAINS, studyId) ? STUDY_DOMAINS[studyId]! : "unclassified";
  return (
    mapDomainCatalog().find((domain) => domain.id === id) ?? {
      id: "unclassified",
      title: translate("ui.world.domain.unclassified"),
    }
  );
}

/** Restore a valid selection in this domain before considering its first row.
 * Returning null for an empty domain preserves the shell's selected study;
 * it never installs a placeholder ID into learner navigation or progress.
 */
export function studyForMapDomain(
  domainId: string,
  studies: readonly PlanetStudy[],
  selectedStudyId: string | null,
  rememberedStudyId?: string,
): string | null {
  const own = studies.filter((study) => (study.domain?.id ?? "unclassified") === domainId);
  return (
    own.find((study) => study.id === selectedStudyId)?.id ??
    own.find((study) => study.id === rememberedStudyId)?.id ??
    [...own].sort((a, b) => a.id.localeCompare(b.id, "en"))[0]?.id ??
    null
  );
}
