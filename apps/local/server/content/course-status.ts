import type { CourseManifest } from "@pieai/university-core/domain/schemas.js";

/** A course a learner may see and enter from the published shelf. */
export function isPublishableStatus(
  status: CourseManifest["status"],
): status is "active" | "stale" {
  return status === "active" || status === "stale";
}
