import type { ActivityBase } from "./types.js";
import type { PrimmPayload } from "./primm.js";

export interface PrimmLessonContract {
  readonly activities?: readonly unknown[];
  readonly evidence?: readonly unknown[];
  readonly content?: string;
  readonly exerciseIds?: readonly string[];
  readonly exercises?: readonly unknown[];
  readonly assets?: readonly { readonly id: string; readonly mime?: string }[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function supports(source: ActivityBase["source"], evidence: unknown): boolean {
  if (!record(evidence)) return false;
  if ("url" in source) return evidence.sourceUrl === source.url;
  return (
    evidence.sourcePath === source.path &&
    !!source.commit &&
    evidence.sourceCommit === source.commit &&
    (source.line === undefined ||
      (typeof evidence.lineStart === "number" &&
        evidence.lineStart <= source.line &&
        typeof evidence.lineEnd === "number" &&
        evidence.lineEnd >= (source.lineEnd ?? source.line)))
  );
}

/** Checks only supplied exercise bodies; manifests carry IDs, recovery/proposals carry bodies. */
export function primmLessonIssues(
  payload: PrimmPayload,
  activity: Pick<ActivityBase, "id" | "source">,
  lesson: PrimmLessonContract,
): string[] {
  const issues: string[] = [];
  if (lesson.activities?.length !== 1) issues.push("A PRIMM lesson has exactly one activity");
  const exerciseIds =
    lesson.exerciseIds ??
    (lesson.exercises ?? []).map((exercise) => (record(exercise) ? exercise.id : undefined));
  if (exerciseIds.length !== 1 || exerciseIds[0] !== payload.make.exerciseId)
    issues.push("PRIMM Make must bind the lesson's one independent exercise ID");
  for (const source of [activity.source, ...payload.sources.map((source) => source.reference)]) {
    if (!(lesson.evidence ?? []).some((evidence) => supports(source, evidence)))
      issues.push(`PRIMM source is absent from lesson evidence: ${source.label}`);
  }
  if (lesson.exercises !== undefined) {
    const exercise = lesson.exercises[0];
    if (
      lesson.exercises.length !== 1 ||
      !record(exercise) ||
      exercise.id !== payload.make.exerciseId ||
      exercise.kind !== "explain"
    ) {
      issues.push("PRIMM Make requires exactly one bound explain exercise");
    } else {
      const evidence = Array.isArray(exercise.evidence) ? exercise.evidence : [];
      const sourceIds = new Set(
        payload.materials
          .filter((material) => payload.make.materialIds.includes(material.id))
          .map((material) => material.sourceId),
      );
      for (const source of payload.sources.filter((source) => sourceIds.has(source.id))) {
        if (!evidence.some((item) => supports(source.reference, item)))
          issues.push(`PRIMM Make exercise omits source identity: ${source.id}`);
      }
    }
  }
  const assets = lesson.assets ?? [];
  if (new Set(assets.map((asset) => asset.id)).size !== assets.length)
    issues.push("Duplicate PRIMM lesson asset ID");
  const assetIds = new Set([
    ...payload.starter.assetIds,
    ...payload.make.assetIds,
    ...payload.materials.flatMap((material) => (material.assetId ? [material.assetId] : [])),
    ...(payload.investigate.game.kind === "inspect-image"
      ? [payload.investigate.game.assetId]
      : []),
  ]);
  for (const id of assetIds) {
    if (!assets.some((asset) => asset.id === id)) issues.push(`Unknown PRIMM lesson asset: ${id}`);
  }
  for (const [name, input] of [
    ["starter", payload.starter],
    ["make", payload.make],
  ] as const) {
    for (const material of payload.materials.filter((material) =>
      input.materialIds.includes(material.id),
    )) {
      if (material.assetId && !input.assetIds.includes(material.assetId))
        issues.push(`PRIMM ${name} omits material asset: ${material.assetId}`);
    }
    if (
      input.operation === "vision" &&
      !input.assetIds.some((id) =>
        assets.some((asset) => asset.id === id && asset.mime?.startsWith("image/")),
      )
    )
      issues.push(`PRIMM ${name} vision requires an image asset`);
    if (
      ["transcribe", "audio-text"].includes(input.operation) &&
      !input.assetIds.some((id) =>
        assets.some((asset) => asset.id === id && /^(audio|video)\//.test(asset.mime ?? "")),
      )
    )
      issues.push(`PRIMM ${name} transcription requires an audio/video asset`);
  }
  if (payload.investigate.game.kind === "inspect-image") {
    const id = payload.investigate.game.assetId;
    if (!assets.some((asset) => asset.id === id && asset.mime?.startsWith("image/")))
      issues.push(`PRIMM inspection requires an image asset: ${id}`);
    if (!payload.starter.assetIds.includes(id))
      issues.push(`PRIMM inspection image is absent from starter inputs: ${id}`);
  }
  if (lesson.content !== undefined) {
    const markers = [...lesson.content.matchAll(/^\s*::play\{#([a-z0-9-]+)\}\s*$/gm)];
    const allMarkers = lesson.content.match(/::play\{/g) ?? [];
    if (markers.length !== 1 || allMarkers.length !== 1 || markers[0]?.[1] !== activity.id)
      issues.push("PRIMM prose must reference its activity exactly once using ::play{#id}");
  }
  return issues;
}
