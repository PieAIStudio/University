/**
 * Tier one lives in `@pieai/university-core` now.
 *
 * It moved for two reasons that turned out to be the same reason. The rule for
 * what counts as a correct answer is a learning decision, not a delivery one,
 * so both shells have to be able to reach it — and the move is also what
 * stopped this shell using `expectedAnswer` in its normal lesson read model,
 * because the answer would be visible before the learner typed anything.
 * Grading uses the compiled fingerprint; the mistake book has a separate
 * post-attempt ContentPort read for the reference answer.
 *
 * This re-export exists so call sites keep reading `./grading`, which is where
 * a person looks for it.
 */
export { normalise } from "@pieai/university-core";
