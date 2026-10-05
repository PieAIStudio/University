import { CardContentSchema, ExerciseSchema, } from "@pieai/university-core/domain/schemas.js";
import { canonicalJson, sha256 } from "../storage/serialization.js";
const EMPTY_SHA256 = `sha256:${"0".repeat(64)}`;
export function normalizeCard(candidate) {
    const parsed = CardContentSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
    const { contentHash: _ignored, ...content } = parsed;
    return CardContentSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}
export function normalizeExercise(candidate) {
    const parsed = ExerciseSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
    const { contentHash: _ignored, ...content } = parsed;
    return ExerciseSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}
//# sourceMappingURL=normalization.js.map