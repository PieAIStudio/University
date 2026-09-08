import type { PlanetStudy, PlanetStudyDomain } from "./planet-copy.js";

export interface DomainPlanGroup extends PlanetStudyDomain {
  readonly studies: readonly PlanetStudy[];
}

/**
 * Groups studies into stable, id-sorted domain buckets.
 *
 * Requirements:
 * - Stably sorted by domain id (ASCII/en order).
 * - Studies within each domain are stably sorted by study id.
 * - Missing or undefined domain defaults to id: "unclassified", title: "未分类".
 * - Never guesses titles: if domain is omitted, title is strictly "未分类".
 * - Duplicate study IDs across the input list are rejected.
 * - Conflicting domain titles for the same domain ID are rejected.
 */
export function buildDomainPlan(
  studies: readonly PlanetStudy[],
  declaredDomains: readonly PlanetStudyDomain[] = [],
): readonly DomainPlanGroup[] {
  const seenStudyIds = new Set<string>();
  for (const study of studies) {
    if (seenStudyIds.has(study.id)) {
      throw new Error(`Duplicate study ID: "${study.id}"`);
    }
    seenStudyIds.add(study.id);
  }

  const domainGroups = new Map<
    string,
    {
      title: string;
      description?: string;
      surfaceStyle?: PlanetStudyDomain["surfaceStyle"];
      studies: PlanetStudy[];
    }
  >();

  // A declared, empty domain is real metadata, not a synthetic course/study.
  // Callers without a separate catalogue retain the existing study-only API.
  for (const domain of declaredDomains) {
    if (domainGroups.has(domain.id)) throw new Error(`Duplicate domain ID: "${domain.id}"`);
    domainGroups.set(domain.id, {
      title: domain.title,
      ...(domain.description === undefined ? {} : { description: domain.description }),
      ...(domain.surfaceStyle === undefined ? {} : { surfaceStyle: domain.surfaceStyle }),
      studies: [],
    });
  }

  for (const study of studies) {
    const domainId = study.domain?.id ?? "unclassified";
    const domainTitle = study.domain?.title ?? "未分类";
    const description = study.domain?.description;
    const surfaceStyle = study.domain?.surfaceStyle;

    const existing = domainGroups.get(domainId);
    if (existing) {
      if (existing.title !== domainTitle) {
        throw new Error(
          `Conflicting domain title for domain ID "${domainId}": "${existing.title}" vs "${domainTitle}"`,
        );
      }
      if (description !== undefined) {
        if (existing.description !== undefined && existing.description !== description) {
          throw new Error(`Conflicting domain description for domain ID "${domainId}"`);
        }
        existing.description = description;
      }
      if (surfaceStyle !== undefined) {
        if (existing.surfaceStyle !== undefined && existing.surfaceStyle !== surfaceStyle) {
          throw new Error(`Conflicting domain surface style for domain ID "${domainId}"`);
        }
        existing.surfaceStyle = surfaceStyle;
      }
      existing.studies.push(study);
    } else {
      domainGroups.set(domainId, {
        title: domainTitle,
        ...(description === undefined ? {} : { description }),
        ...(surfaceStyle === undefined ? {} : { surfaceStyle }),
        studies: [study],
      });
    }
  }

  const result: DomainPlanGroup[] = Array.from(domainGroups.entries())
    .map(([id, group]) => ({
      id,
      title: group.title,
      ...(group.description === undefined ? {} : { description: group.description }),
      ...(group.surfaceStyle === undefined ? {} : { surfaceStyle: group.surfaceStyle }),
      studies: Object.freeze([...group.studies].sort((a, b) => a.id.localeCompare(b.id, "en"))),
    }))
    .sort((a, b) => a.id.localeCompare(b.id, "en"));

  return Object.freeze(result);
}
