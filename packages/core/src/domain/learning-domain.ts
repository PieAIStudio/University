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
  "turing-pact": "ai-games",
  "ai-foundations": "ai-foundations",
  "ai-literacy": "ai-foundations",
  general: "programming",
  "browser-ai": "programming",
});
export function learningDomainOfStudy(studyId: string): LearningDomainId {
  return Object.hasOwn(STUDY_DOMAINS, studyId) ? STUDY_DOMAINS[studyId]! : "unclassified";
}
