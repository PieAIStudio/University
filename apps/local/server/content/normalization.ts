import { createHash } from "node:crypto";

import {
  CardContentSchema,
  ExerciseSchema,
  type CardContent,
  type Exercise,
} from "@pieai/university-core/domain/schemas.js";

const EMPTY_SHA256 = `sha256:${"0".repeat(64)}`;

export type ExerciseWithoutHash = Exercise extends infer Item
  ? Item extends { contentHash: string }
    ? Omit<Item, "contentHash">
    : never
  : never;

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((child) => (child === undefined ? "null" : canonicalJson(child))).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

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
