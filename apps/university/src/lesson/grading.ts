/**
 * Tier one lives in `@pieai/university-core` now.
 *
 * It moved for two reasons that turned out to be the same reason. The rule for
 * what counts as a correct answer is a learning decision, not a delivery one,
 * so both shells have to be able to reach it — and the move is also what
 * stopped this shell shipping `expectedAnswer` in its lesson JSON, because the
 * answer is compiled to a fingerprint at import time and never reaches a
 * browser. See that file for what the fingerprint does and does not protect.
 *
 * This re-export exists so call sites keep reading `./grading`, which is where
 * a person looks for it.
 */
export { gradeDeterministically, normalise, type Verdict } from "@pieai/university-core";
