import {
  mapDomainCatalog,
  mapDomainForStudy,
} from "../../apps/university/src/app/map-domain-catalog.js";
import { CATALOGUE_ROLES, SECONDARY_STUDY, SHIPPED_CATALOGUE } from "./catalogue.js";

/** Domain interaction probes choose roles from the release, not from a memory
 * that AI foundations was empty. W independently asserts the new placement. */
export const PRIMARY_DOMAIN_ID = mapDomainForStudy(CATALOGUE_ROLES.settlement.study.id).id;
export const RELEASED_DOMAIN_STUDIES = mapDomainCatalog().map((domain) => ({
  id: domain.id,
  studies: SHIPPED_CATALOGUE.filter((study) => mapDomainForStudy(study.id).id === domain.id),
}));
const empty = RELEASED_DOMAIN_STUDIES.find((domain) => domain.studies.length === 0);
if (!empty)
  throw new Error("e2e catalogue: empty-domain probes need an explicit empty-domain fixture now");
export const EMPTY_DOMAIN_ID = empty.id;
export const SECONDARY_START_COURSE =
  SECONDARY_STUDY?.courses.find((course) => course.prerequisiteCourseIds.length === 0) ??
  CATALOGUE_ROLES.settlement.course;
export const SECONDARY_DOMAIN_ID = mapDomainForStudy(SECONDARY_START_COURSE.studyId).id;
