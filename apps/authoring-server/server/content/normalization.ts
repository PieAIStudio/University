import {
  CardContentSchema,
  ExerciseSchema,
  type CardContent,
  type Exercise,
} from "@pieai/university-core/domain/schemas.js";
import { canonicalJson, sha256 } from "../storage/serialization.js";

const EMPTY_SHA256 = `sha256:${"0".repeat(64)}`;

export type ExerciseWithoutHash = Exercise extends infer Item
  ? Item extends { contentHash: string }
    ? Omit<Item, "contentHash">
    : never
  : never;

export function normalizeCard(candidate: Omit<CardContent, "contentHash">): CardContent {
  const parsed = CardContentSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
  const { contentHash: _ignored, ...content } = parsed;
  return CardContentSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}

export function normalizeExercise(candidate: ExerciseWithoutHash): Exercise {
  const parsed = ExerciseSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
  const { contentHash: _ignored, ...content } = parsed;
  return ExerciseSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}
