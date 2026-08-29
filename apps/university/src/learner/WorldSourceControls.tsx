import type { SourceAccessPort } from "@pieai/university-core";

import { UaDashboardButton } from "./UaDashboardButton.js";

/** Learner controls for the current study, rendered inside its context card. */
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
