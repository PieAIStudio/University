/**
 * The together-learning overlay: names beside a stone, pointers when online.
 *
 * Readable text is DOM, never geometry — Web3D baseline rule 7, and the
 * reason this file lives in `packages/ui` rather than inside the canvas.
 * The 3D probe in `packages/world` only writes a transform; it does not
 * draw a letter.
 *
 * Avatars on this overlay are initials, not `AvatarChip`. That chip opens
 * its own WebGL context, and its own comment says a second context next to
 * the world map is a real cost. Two group-mates do not justify two extra
 * renderers on the map that already has one.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import type { PresencePeer } from "@pieai/university-core";

import { presenceAnchorId, type PresenceSurface } from "./anchors.js";
import { stepCursor } from "./interpolate.js";

export function CompanionMarkers({
  peers,
  surface,
  attach,
}: {
  readonly peers: readonly PresencePeer[];
  readonly surface: PresenceSurface;
  readonly attach: (userId: string, element: HTMLElement | null) => void;
}) {
  return (
    <div className="companions" aria-label="一起学的同伴" style={{ pointerEvents: "none" }}>
      {peers.map((peer) => {
        const anchor = presenceAnchorId(peer, surface);
        if (!anchor) return null;
        const where =
          surface === "course" && peer.relation === "group" && peer.location?.lessonId
            ? "在这关"
            : peer.location?.courseId
              ? "在这门课"
              : null;
        return (
          <div
            key={peer.userId}
            ref={(element) => attach(peer.userId, element)}
            className={[
              "companion",
              peer.relation === "group" ? "companion--group" : "companion--friend",
              peer.online ? "is-online" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-anchor={anchor}
            style={{ "--placed": 0 } as CSSProperties}
          >
            <span className="companion__dot" aria-hidden="true">
              {initialOf(peer.displayName)}
            </span>
            <span className="companion__name">{peer.displayName}</span>
            {where ? <small className="companion__where">{where}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

export function CompanionCursors({
  peers,
  viewKey,
}: {
  readonly peers: readonly PresencePeer[];
  readonly viewKey: string;
}) {
  const visible = peers.filter(
    (peer) =>
      peer.relation === "group" && peer.online && peer.cursor && peer.cursor.viewKey === viewKey,
  );
  if (visible.length === 0) return null;
  return (
    <div className="companion-cursors" aria-hidden="true" style={{ pointerEvents: "none" }}>
      {visible.map((peer) => (
        // Remount when the view changes so we snap instead of dragging a
        // pointer across the map from a screen the peer is not on.
        <InterpolatedCursor key={`${peer.userId}:${peer.cursor?.viewKey ?? ""}`} peer={peer} />
      ))}
    </div>
  );
}

function InterpolatedCursor({ peer }: { readonly peer: PresencePeer }) {
  const node = useRef<HTMLDivElement>(null);
  const cursor = peer.cursor;
  const target = useRef({ x: cursor?.x ?? 0, y: cursor?.y ?? 0 });
  const display = useRef({ x: cursor?.x ?? 0, y: cursor?.y ?? 0 });

  if (cursor) target.current = { x: cursor.x, y: cursor.y };

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      display.current = stepCursor(display.current, target.current, dt);
      const el = node.current;
      if (el) {
        el.style.transform = `translate(${display.current.x * 100}vw, ${display.current.y * 100}vh)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={node}
      className="companion-cursor"
      aria-hidden="true"
      style={
        {
          transform: `translate(${(cursor?.x ?? 0) * 100}vw, ${(cursor?.y ?? 0) * 100}vh)`,
        } as CSSProperties
      }
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M2 1.5 14 8.2 8.4 9.6 6.6 15Z" fill="currentColor" />
      </svg>
      <span className="companion-cursor__name">{peer.displayName}</span>
    </div>
  );
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? [...trimmed][0]! : "?";
}
