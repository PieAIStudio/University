import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { z } from "zod";
import { localizeActivity, type PrimmActivity } from "@pieai/university-core";
import { LessonActivitySchema } from "@pieai/university-core/domain/schemas.js";
import { PreviewFailure } from "./errors.js";

// Any lesson of this course may be run, but only when its canonical package
// carries a native PRIMM activity; the resolver below enforces that, so a new
// generated lesson needs no second allow-list to become playable.
const LessonId = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const LessonRefSchema = z
  .object({
    studyId: z.literal("ai-literacy"),
    courseId: z.literal("understanding-ai"),
    unitId: LessonId,
    lessonId: LessonId,
  })
  .strict();
export const RunSchema = z
  .object({
    lessonRef: LessonRefSchema,
    contentRevision: z.number().int().positive(),
    phase: z.enum(["run", "modify", "make"]),
    prompt: z
      .string()
      .min(1)
      .max(2000)
      .refine((s) => s.trim().length > 0),
    commandId: z.string().uuid(),
    locale: z.enum(["zh-CN", "en"]),
  })
  .strict();
export type RunInput = z.infer<typeof RunSchema>;
export interface ApprovedAsset {
  id: string;
  mime: string;
  bytes: Buffer;
}
export interface CanonicalPrimm {
  activity: PrimmActivity;
  contentRevision: number;
  exercise: { id: string; prompt: string; rubric: string[] };
  exerciseRevision: number;
  assets: ApprovedAsset[];
  /** Hash of the actual canonical lesson including its server-only rubric/assets. */
  fingerprint: string;
}
export type ResolvePrimm = (input: RunInput) => Promise<CanonicalPrimm>;
export const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const inputHash = (input: RunInput) =>
  digest(JSON.stringify({ ...input, commandId: undefined }));
const ExerciseSchema = z
  .object({
    id: z.string(),
    kind: z.literal("explain"),
    prompt: z.string(),
    rubric: z.array(z.string().min(1)).min(1),
  })
  .passthrough();
const AssetSchema = z
  .object({
    metadata: z
      .object({
        id: z.string(),
        mime: z.string(),
        bytes: z
          .number()
          .int()
          .positive()
          .max(5 * 1024 * 1024),
        sha256: z.string(),
      })
      .passthrough(),
    dataBase64: z.string().max(7_000_000),
  })
  .passthrough();
const LessonSchema = z
  .object({
    id: z.string(),
    contentRevision: z.number().int(),
    activities: z.array(z.unknown()),
    exercises: z.array(z.unknown()),
    assets: z.array(AssetSchema).default([]),
  })
  .passthrough();
const PackageSchema = z
  .object({
    course: z
      .object({
        id: z.string(),
        units: z.array(z.object({ id: z.string(), lessons: z.array(LessonSchema) }).passthrough()),
      })
      .passthrough(),
  })
  .passthrough();

async function boundedRead(root: string, path: string, maxBytes: number) {
  const canonicalRoot = await realpath(root);
  const canonicalPath = await realpath(resolve(root, path));
  const rel = relative(canonicalRoot, canonicalPath);
  if (!rel || rel.startsWith("..") || (await stat(canonicalPath)).size > maxBytes)
    throw new PreviewFailure("rejected");
  return readFile(canonicalPath);
}

/** Fixed local packages. Browser paths/URLs cannot reach this resolver. Reload on each explicit command. */
export function createCanonicalPrimmResolver(options: {
  contentRoot: string;
  recoveryRoot: string;
}): ResolvePrimm {
  return async (input) => {
    RunSchema.parse(input);
    const index = z
      .object({
        courses: z.array(z.object({ courseId: z.string(), file: z.string(), sha256: z.string() })),
      })
      .passthrough()
      .parse(
        JSON.parse((await boundedRead(options.recoveryRoot, "index.json", 64 * 1024)).toString()),
      );
    const entry = index.courses.find((course) => course.courseId === "understanding-ai");
    if (!entry || !/^understanding-ai\.[a-f0-9]{64}\.recovery\.json$/.test(entry.file))
      throw new PreviewFailure("unavailable", 503);
    const recoveryBytes = await boundedRead(options.recoveryRoot, entry.file, 32 * 1024 * 1024);
    if (`sha256:${digest(recoveryBytes)}` !== entry.sha256) throw new PreviewFailure("stale", 409);
    const recovery = PackageSchema.parse(JSON.parse(recoveryBytes.toString()));
    const generated = PackageSchema.omit({ course: true })
      .extend({
        course: z
          .object({
            units: z.array(
              z
                .object({
                  id: z.string(),
                  lessons: z.array(
                    z
                      .object({
                        id: z.string(),
                        contentRevision: z.number(),
                        activities: z.array(z.unknown()),
                      })
                      .passthrough(),
                  ),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      })
      .parse(
        JSON.parse(
          (
            await boundedRead(
              options.contentRoot,
              "ai-literacy/understanding-ai.json",
              32 * 1024 * 1024,
            )
          ).toString(),
        ),
      );
    const lesson = recovery.course.units
      .find((unit) => unit.id === input.lessonRef.unitId)
      ?.lessons.find((l) => l.id === input.lessonRef.lessonId);
    const publicLesson = generated.course.units
      .find((unit) => unit.id === input.lessonRef.unitId)
      ?.lessons.find((l) => l.id === input.lessonRef.lessonId);
    if (
      !lesson ||
      !publicLesson ||
      lesson.contentRevision !== input.contentRevision ||
      publicLesson.contentRevision !== input.contentRevision
    )
      throw new PreviewFailure("stale", 409);
    const rawActivity = lesson.activities.find((a: any) => a?.kind === "primm");
    const publicActivity = publicLesson.activities.find((a: any) => a?.kind === "primm");
    if (
      !rawActivity ||
      !publicActivity ||
      digest(JSON.stringify(rawActivity)) !== digest(JSON.stringify(publicActivity))
    )
      throw new PreviewFailure("stale", 409);
    const activity = localizeActivity(
      LessonActivitySchema.parse(rawActivity) as unknown as PrimmActivity,
      input.locale,
    );
    const exercise = ExerciseSchema.parse(
      lesson.exercises.find((exercise: any) => exercise?.id === activity.make.exerciseId),
    );
    const spec = input.phase === "make" ? activity.make : activity.starter;
    if (input.phase === "run" && input.prompt !== activity.starter.prompt)
      throw new PreviewFailure("rejected");
    const assets = spec.assetIds.map((id) => {
      const asset = lesson.assets.find((a) => a.metadata.id === id);
      if (!asset) throw new PreviewFailure("rejected");
      const bytes = Buffer.from(asset.dataBase64, "base64");
      if (
        bytes.length !== asset.metadata.bytes ||
        `sha256:${digest(bytes)}` !== asset.metadata.sha256
      )
        throw new PreviewFailure("rejected");
      return { id, mime: asset.metadata.mime, bytes };
    });
    // Recovery versions the containing lesson. Read the learner-facing exercise
    // revision separately; it need not equal the lesson revision.
    const publicExercises = z
      .array(
        z
          .object({ id: z.string(), contentRevision: z.number().int().positive().optional() })
          .passthrough(),
      )
      .parse(publicLesson.exercises);
    const publicExercise = publicExercises.find((item) => item.id === exercise.id);
    if (!publicExercise) throw new PreviewFailure("stale", 409);
    return {
      activity,
      contentRevision: lesson.contentRevision,
      exercise,
      exerciseRevision: publicExercise.contentRevision ?? lesson.contentRevision,
      assets,
      fingerprint: digest(JSON.stringify(lesson)),
    };
  };
}
