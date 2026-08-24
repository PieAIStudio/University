import { useRef, type CSSProperties, type ReactNode } from "react";

import { Controls, Flight, LabelProbe, WORLD_POLAR } from "./controls.js";
import { placeWorld, WorldScene, type Marker } from "./Maps.js";
import type { CourseNode } from "./course.js";
import { Stage } from "./Stage.js";

export type WorldMap = ReturnType<typeof placeWorld>;

/**
 * The shared world-map assembly.
 *
 * Both shells used to own this same Stage → controls → label projector →
 * WorldScene stack and then drifted whenever one side changed a camera or
 * keyboard affordance. Authoring and delivery still supply their own DOM
 * cards, presence layer and navigation, but the map itself has one producer.
 */
export function WorldMapCanvas({
  world,
  cameraFrom,
  lookAt,
  learnerAt,
  skyStudyId,
  focus,
  markers,
  followId,
  followNode,
  onPick,
  onHover,
  onSceneReady,
  onSceneBusy,
  onPointerMissed,
  stageChildren,
  overlay,
  hint,
  loading,
  className,
  paused = false,
}: {
  readonly className?: string;
  readonly world: WorldMap | null;
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly learnerAt: Parameters<typeof WorldScene>[0]["learnerAt"];
  readonly skyStudyId: string | null;
  readonly focus?: { readonly studyId: string; readonly courseIds: readonly string[] };
  readonly markers: readonly Marker[];
  readonly followId?: string | null;
  readonly followNode?: { readonly current: HTMLElement | null };
  readonly onPick: (node: CourseNode) => void;
  readonly onHover: (node: CourseNode | null) => void;
  readonly onSceneReady?: () => void;
  readonly onSceneBusy?: () => void;
  readonly onPointerMissed?: () => void;
  readonly stageChildren?: ReactNode;
  readonly overlay?: ReactNode;
  readonly hint?: ReactNode;
  readonly loading?: ReactNode;
  readonly paused?: boolean;
}) {
  const labelNodes = useRef(new Map<string, HTMLElement>());
  const draggedRef = useRef(false);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className={className ? `stagewrap ${className}` : "stagewrap"}
      onPointerDownCapture={(event) => {
        pointerOrigin.current = { x: event.clientX, y: event.clientY };
        draggedRef.current = false;
      }}
      onPointerMoveCapture={(event) => {
        const origin = pointerOrigin.current;
        if (!origin || draggedRef.current) return;
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) {
          draggedRef.current = true;
        }
      }}
      onPointerUpCapture={() => {
        pointerOrigin.current = null;
      }}
    >
      {world ? (
        <Stage
          cameraFrom={cameraFrom}
          lookAt={lookAt}
          onSceneReady={onSceneReady}
          onSceneBusy={onSceneBusy}
          onPointerMissed={onPointerMissed}
          paused={paused}
        >
          <Controls target={lookAt} polar={WORLD_POLAR} />
          <Flight to={cameraFrom} look={lookAt} />
          <LabelProbe
            markers={markers}
            limit={9}
            nodes={labelNodes.current}
            followId={followId}
            followNode={followNode}
          />
          <WorldScene
            placements={world.placements}
            extent={world.extent}
            learnerAt={learnerAt}
            skyStudyId={skyStudyId}
            focus={focus}
            onPick={onPick}
            onHover={onHover}
          />
          {stageChildren}
        </Stage>
      ) : null}

      <nav className="labels" aria-label="地图上的去处">
        {markers.map((marker) => {
          const content = (
            <>
              {marker.text}
              {marker.sub ? <small>{marker.sub}</small> : null}
            </>
          );
          const attach = (element: HTMLElement | null) => {
            if (element) labelNodes.current.set(marker.id, element);
            else labelNodes.current.delete(marker.id);
          };
          const className = [
            "label",
            `label--${marker.kind}`,
            marker.quiet ? "label--quiet" : "",
            marker.locked ? "is-locked" : "",
          ]
            .filter(Boolean)
            .join(" ");
          if (marker.kind === "icon") {
            return (
              <span
                key={marker.id}
                ref={attach}
                className={className}
                style={{ "--placed": 0 } as CSSProperties}
                role="img"
                aria-label={marker.label ?? marker.text}
              >
                {content}
              </span>
            );
          }
          return marker.activate ? (
            <button
              key={marker.id}
              ref={attach}
              type="button"
              className={className}
              style={{ "--placed": 0 } as CSSProperties}
              onClick={() => {
                if (draggedRef.current) return;
                marker.activate?.();
              }}
            >
              {content}
            </button>
          ) : (
            <div
              key={marker.id}
              ref={attach}
              className={className}
              style={{ "--placed": 0 } as CSSProperties}
            >
              {content}
            </div>
          );
        })}
      </nav>
      {overlay}
      {hint ? <p className="hint">{hint}</p> : null}
      {loading}
    </div>
  );
}
