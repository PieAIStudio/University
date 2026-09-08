/**
 * Explicit display taxonomy; course production and progress do not depend on it.
 * Keep classification out of the renderer and never infer it from course titles.
 * Unknown studies remain visible until their domain has been deliberately assigned.
 */
import { translate } from "@pieai/university-ui/i18n.js";

export interface MapDomain {
  readonly id: string;
  readonly title: string;
}

const STUDY_DOMAINS: Readonly<Record<string, "programming">> = Object.freeze({
  "turing-pact": "programming",
  buzz: "programming",
  supaluv: "programming",
  general: "programming",
});

export function mapDomainForStudy(studyId: string): MapDomain {
  const id = Object.hasOwn(STUDY_DOMAINS, studyId) ? STUDY_DOMAINS[studyId]! : "unclassified";
  return {
    id,
    title: translate(
      id === "programming" ? "ui.world.domain.programming" : "ui.world.domain.unclassified",
    ),
  };
}
