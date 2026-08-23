/**
 * Publishes where I am and, while I agree to be seen, where the pointer is.
 *
 * The port already no-ops `publishCursor` after the switch is off. This
 * component still unhooks the listener, because capturing every mousemove
 * just to throw it away is how a "hidden" implementation keeps broadcasting
 * in spirit. Unhooking is the UI half of "关掉就真的看不见".
 */
import { useEffect, useSyncExternalStore } from "react";
import type { PresenceLocation, PresencePort } from "@pieai/university-core";

export function PresenceSession({
  port,
  location,
  viewKey,
}: {
  readonly port: PresencePort;
  readonly location: PresenceLocation | null;
  readonly viewKey: string;
}) {
  const snapshot = useSyncExternalStore(port.subscribe, port.snapshot, port.snapshot);

  useEffect(() => {
    port.publishLocation(location);
  }, [port, location, location?.studyId, location?.courseId, location?.lessonId]);

  useEffect(() => {
    if (!snapshot.sharesPresence) {
      port.publishCursor(null);
      return;
    }
    const onMove = (event: PointerEvent) => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      port.publishCursor({
        x: event.clientX / width,
        y: event.clientY / height,
        viewKey,
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [port, viewKey, snapshot.sharesPresence]);

  return null;
}
