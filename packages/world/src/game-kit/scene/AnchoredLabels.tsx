import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { layoutTargetLabels } from "../../toy-play/label-layout.js";

/**
 * Readable text for things in a game's scene (ADR-0011, scene layer): DOM
 * labels that follow 3D anchors, make room for each other and point back with
 * a thin leader. Text never shrinks and never hides to avoid an overlap; the
 * label moves instead. Clickable labels are real buttons, so a learner can aim
 * with a keyboard or a screen reader as well as a finger.
 */
export interface AnchoredLabel {
  readonly id: number;
  readonly content: ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
  readonly selected?: boolean;
  readonly onPick?: () => void;
  /** Higher is placed first and keeps its natural spot. */
  readonly priority: number;
}

export function AnchoredLabels({
  labels,
  anchor,
  inset,
}: {
  labels: readonly AnchoredLabel[];
  /** Write the label's world anchor into `out`; return false to hide it this frame. */
  anchor: (id: number, out: THREE.Vector3) => boolean;
  inset: { readonly top: number; readonly bottom: number };
}) {
  const { camera, size } = useThree();
  const nodes = useRef(new Map<number, HTMLElement>());
  const leaders = useRef(new Map<number, SVGLineElement>());
  const point = useMemo(() => new THREE.Vector3(), []);
  const byId = useRef(new Map<number, AnchoredLabel>());
  byId.current = new Map(labels.map((label) => [label.id, label]));

  useFrame(() => {
    const items = [];
    for (const [id, node] of nodes.current) {
      const label = byId.current.get(id);
      if (!label || !node.offsetWidth || !anchor(id, point)) {
        node.style.visibility = "hidden";
        leaders.current.get(id)?.setAttribute("visibility", "hidden");
        continue;
      }
      const p = point.project(camera);
      if (p.z > 1) continue;
      items.push({
        id,
        targetX: ((p.x + 1) * size.width) / 2,
        targetY: ((1 - p.y) * size.height) / 2,
        width: node.offsetWidth,
        height: node.offsetHeight,
        priority: label.priority,
      });
    }
    for (const placed of layoutTargetLabels(items, size.width, size.height, inset)) {
      const node = nodes.current.get(placed.id)!;
      node.style.visibility = "visible";
      node.style.transform = `translate3d(${placed.x}px,${placed.y}px,0)`;
      const line = leaders.current.get(placed.id);
      if (!line) continue;
      line.setAttribute("x1", String(placed.targetX));
      line.setAttribute("y1", String(placed.targetY));
      line.setAttribute("x2", String(placed.x + placed.width / 2));
      line.setAttribute("y2", String(placed.y + placed.height));
      line.setAttribute("visibility", "visible");
    }
  }, 1);

  return (
    <Html
      fullscreen
      calculatePosition={(_object, _camera, viewport) => [viewport.width / 2, viewport.height / 2]}
      zIndexRange={[2, 0]}
      style={{ pointerEvents: "none" }}
    >
      <svg
        className="game-label-leaders"
        width={size.width}
        height={size.height}
        aria-hidden="true"
      >
        {labels.map((label) => (
          <line
            key={label.id}
            ref={(node) => {
              if (node) leaders.current.set(label.id, node);
              else leaders.current.delete(label.id);
            }}
          />
        ))}
      </svg>
      {labels.map((label) => {
        const register = (node: HTMLElement | null) => {
          if (node) nodes.current.set(label.id, node);
          else nodes.current.delete(label.id);
        };
        const className = `game-label ${label.className ?? ""}`.trim();
        return label.onPick ? (
          <button
            key={label.id}
            ref={register}
            type="button"
            className={className}
            style={{ pointerEvents: "auto" }}
            data-target={label.selected ? "true" : undefined}
            aria-label={label.ariaLabel}
            aria-pressed={label.selected ?? false}
            onClick={label.onPick}
          >
            {label.content}
          </button>
        ) : (
          <div key={label.id} ref={register} className={className} aria-label={label.ariaLabel}>
            {label.content}
          </div>
        );
      })}
    </Html>
  );
}
