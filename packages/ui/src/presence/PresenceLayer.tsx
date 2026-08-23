import { useSyncExternalStore } from "react";
import type { PresencePort } from "@pieai/university-core";

import { CompanionCursors, CompanionMarkers } from "./CompanionOverlay.js";
import type { PresenceSurface } from "./anchors.js";

export function PresenceLayer({
  port,
  surface,
  viewKey,
  attach,
}: {
  readonly port: PresencePort;
  readonly surface: PresenceSurface;
  readonly viewKey: string;
  readonly attach: (userId: string, element: HTMLElement | null) => void;
}) {
  const snapshot = useSyncExternalStore(port.subscribe, port.snapshot, port.snapshot);
  return (
    <>
      <CompanionMarkers peers={snapshot.peers} surface={surface} attach={attach} />
      <CompanionCursors peers={snapshot.peers} viewKey={viewKey} />
    </>
  );
}
