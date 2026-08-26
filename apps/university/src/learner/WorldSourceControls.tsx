import type { SourceAccessPort } from "@pieai/university-core";

import { UaDashboardButton } from "./UaDashboardButton.js";

/** Learner controls that sit beside the world, not inside WebGL geometry. */
export function WorldSourceControls({
  studyId,
  sourceAccess,
}: {
  readonly studyId: string | null;
  readonly sourceAccess: SourceAccessPort;
}) {
  if (!studyId) return null;
  return (
    <div className="world-source-controls">
      <UaDashboardButton studyId={studyId} sourceAccess={sourceAccess} />
    </div>
  );
}
