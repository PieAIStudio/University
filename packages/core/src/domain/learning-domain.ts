/** Explicit catalogue membership shared by display and published metadata.
 * No name guessing: a new study stays unclassified until deliberately added.
 */
export type LearningDomainId =
  | "programming"
  | "ai-foundations"
  | "ai-games"
  | "ai-media"
  | "unclassified";
const STUDY_DOMAINS: Readonly<Record<string, LearningDomainId>> = Object.freeze({
  "turing-pact": "ai-games", // Retired study: historical records and isolated fixtures only.
  "ai-foundations": "ai-foundations", // Retired study; distinct from the active domain with this name.
  "ai-literacy": "ai-foundations",
  general: "programming", // Retired study: historical records only, not catalogue membership.
  "browser-ai": "programming", // Retired study: historical records and isolated fixtures only.
});
export function learningDomainOfStudy(studyId: string): LearningDomainId {
  return Object.hasOwn(STUDY_DOMAINS, studyId) ? STUDY_DOMAINS[studyId]! : "unclassified";
}
