import { readFileSync, realpathSync, statSync } from "node:fs";
import { z } from "zod";
import type { LessonAsset } from "@pieai/university-core/domain/schemas.js";
import { sha256 } from "../storage/serialization.js";
import { matchesAssetMime, sniffAssetMime } from "./asset-bytes.js";

/** Explicit local CLI input, never inferred from a URL or accepted by a public API. */
export const LessonAssetFileProposalSchema = z
  .object({
    path: z.string().min(1),
    sourcePath: z
      .string()
      .min(1)
      .refine((path) => !path.includes("\0"), "NUL is not a file path"),
  })
  .strict();

export type LessonAssetFileProposal = z.infer<typeof LessonAssetFileProposalSchema>;

/** One birth/revision/recovery byte contract, checked before writing a revision. */
export function validateLessonAssetInputs(
  assets: readonly LessonAsset[],
  files: readonly LessonAssetFileProposal[],
): readonly LessonAssetFileProposal[] {
  if (
    new Set(assets.map((asset) => asset.id)).size !== assets.length ||
    new Set(assets.map((asset) => asset.path)).size !== assets.length
  ) {
    throw new Error("Lesson asset IDs and paths must be unique");
  }
  if (new Set(files.map((file) => file.path)).size !== files.length) {
    throw new Error("Lesson asset input paths must be unique");
  }
  const declared = new Set(assets.map((asset) => asset.path));
  for (const file of files) {
    if (!declared.has(file.path)) throw new Error(`Asset file is not declared: ${file.path}`);
  }
  const byPath = new Map(files.map((file) => [file.path, file]));
  return assets.map((asset) => {
    const file = byPath.get(asset.path);
    if (!file) throw new Error(`Missing source file for lesson asset: ${asset.id}`);
    const sourcePath = realpathSync(file.sourcePath);
    const stat = statSync(sourcePath);
    if (!stat.isFile() || stat.size !== asset.bytes || stat.size > 25 * 1024 * 1024) {
      throw new Error(`Lesson asset file/size mismatch: ${asset.id}`);
    }
    const bytes = readFileSync(sourcePath);
    if (sha256(bytes) !== asset.sha256) throw new Error(`Lesson asset hash mismatch: ${asset.id}`);
    if (!matchesAssetMime(bytes, asset.mime)) {
      throw new Error(
        `Lesson asset ${asset.id} declares ${asset.mime} but bytes are ${sniffAssetMime(bytes)}`,
      );
    }
    return { path: asset.path, sourcePath };
  });
}
