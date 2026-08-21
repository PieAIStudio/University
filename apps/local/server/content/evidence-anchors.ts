/**
 * Compatibility re-export. The resolver is a pure function and lives in
 * `@pieai/university-core`. Callers in this server keep importing from here
 * so the move does not churn every file that only needed the types.
 */
export {
  resolveEvidenceAnchors,
  type EvidenceCitation,
} from "@pieai/university-core/marks/evidence.js";
export type { EvidenceAnchorRange } from "@pieai/university-core/domain/lesson-marks.js";
