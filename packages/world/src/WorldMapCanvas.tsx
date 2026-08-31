import { useRef, type CSSProperties, type ReactNode } from "react";
import type { AuthoringFocus } from "@pieai/university-core";

import { Controls, Flight, LabelProbe, WORLD_POLAR } from "./camera/controls.js";
import { placeWorld, WorldScene, type Marker } from "./Maps.js";
import type { AvatarRecipe } from "./avatar/index.js";
import type { CourseNode } from "./course/course.js";
import type { IslandLookCameraPose, IslandLookSceneSource } from "./island/island-look.js";
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
  avatarRecipe,
  avatarSignedIn,
  skyStudyId,
  authoringFocus,
  markers,
  followId,
  followNode,
  assetRevision = 0,
  onPick,
  onHover,
  onInteract,
  onSceneReady,
  onSceneBusy,
  onContextLost,
  onContextRestored,
  onRendererUnavailable,
  onPointerMissed,
  stageChildren,
  underlay,
  overlay,
  hoverHint,
  controlsHint,
  controlsHintVisible = true,
  entryHint,
  entryHintVisible = true,
  loading,
  className,
  paused = false,
  hidden = false,
  polar = WORLD_POLAR,
  fixedCamera = null,
  postProcessing = true,
  lookSource = null,
}: {
  readonly className?: string;
  readonly world: WorldMap | null;
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly learnerAt: Parameters<typeof WorldScene>[0]["learnerAt"];
  readonly avatarRecipe: AvatarRecipe | null;
  readonly avatarSignedIn: boolean;
  readonly skyStudyId: string | null;
  readonly authoringFocus?: AuthoringFocus;
  readonly markers: readonly Marker[];
  readonly followId?: string | null;
  readonly followNode?: { readonly current: HTMLElement | null };
  readonly assetRevision?: number;
  readonly onPick: (node: CourseNode) => void;
  readonly onHover: (node: CourseNode | null) => void;
  /** Called once a learner starts manipulating the map. */
  readonly onInteract?: () => void;
  readonly onSceneReady?: () => void;
  readonly onSceneBusy?: () => void;
  readonly onContextLost?: () => void;
  readonly onContextRestored?: () => void;
  readonly onRendererUnavailable?: () => void;
  readonly onPointerMissed?: () => void;
  readonly stageChildren?: ReactNode;
  /**
   * DOM that sits on the map but **beneath** its labels.
   *
   * The labels are the only way into a course without a mouse, so anything
   * that covers one takes that away. A panel pinned to the side of the map is
   * this: at a desk it sits clear of the labels, and on a phone it overlaps
   * them, and when it does the label has to win. `overlay` is the other
   * answer — a popover attached to the thing you just picked, which is meant
   * to be on top and is dismissed by looking away.
   */
  readonly underlay?: ReactNode;
  readonly overlay?: ReactNode;
  /** A transient island/course name shown while the pointer is over a node. */
  readonly hoverHint?: ReactNode;
  /** Pan and zoom instructions, retired after the first map manipulation. */
  readonly controlsHint?: ReactNode;
  readonly controlsHintVisible?: boolean;
  /** The conversion cue, kept until the learner picks an island once. */
  readonly entryHint?: ReactNode;
  readonly entryHintVisible?: boolean;
  readonly loading?: ReactNode;
  readonly paused?: boolean;
  /**
   * Off-screen, but still mounted and still holding its WebGL context.
   *
   * Not the same as not rendering it. The delivery shell used to swap between
   * two Stage assemblies — one for the map, one for a course path — so every
   * step between them tore down a WebGL context and built another, on the one
   * transition a learner makes most. `paused` stops the frames; this stops the
   * pixels; the context survives both.
   */
  readonly hidden?: boolean;
  /**
   * Camera pitch. A course path is read at a shallower angle than a world of
   * islands, which is the only thing the two scenes disagree about.
   */
  readonly polar?: number;
  readonly fixedCamera?: IslandLookCameraPose | null;
  readonly postProcessing?: boolean;
  readonly lookSource?: IslandLookSceneSource | null;
}) {
  const labelNodes = useRef(new Map<string, HTMLElement>());
  const draggedRef = useRef(false);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className={className ? `stagewrap ${className}` : "stagewrap"}
      hidden={hidden}
      onPointerDownCapture={(event) => {
        onInteract?.();
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
      {/*
        One Stage, mounted for as long as the shell is. `world` decides whether
        there is a world in it — a course path arrives through `stageChildren`
        and wants the same camera, the same label projector and the same
        context. Mounting per scene is what made stepping from the map into a
        course cost a context teardown.
      */}
      <Stage
        cameraFrom={cameraFrom}
        lookAt={lookAt}
        onSceneReady={onSceneReady}
        onSceneBusy={onSceneBusy}
        onContextLost={onContextLost}
        onContextRestored={onContextRestored}
        onRendererUnavailable={onRendererUnavailable}
        onPointerMissed={onPointerMissed}
        fixedCamera={fixedCamera}
        paused={paused}
        lookSource={lookSource}
        postProcessing={postProcessing}
      >
        <Controls target={lookAt} polar={polar} fixedCamera={fixedCamera} onInteract={onInteract} />
        <Flight to={cameraFrom} look={lookAt} fixed={fixedCamera !== null} />
        <LabelProbe
          markers={markers}
          limit={9}
          nodes={labelNodes.current}
          followId={followId}
          followNode={followNode}
        />
        {world ? (
          <WorldScene
            placements={world.placements}
            extent={world.extent}
            learnerAt={learnerAt}
            avatarRecipe={avatarRecipe}
            avatarSignedIn={avatarSignedIn}
            skyStudyId={skyStudyId}
            authoringFocus={authoringFocus}
            assetRevision={assetRevision}
            onPick={onPick}
            onHover={onHover}
          />
        ) : null}
        {stageChildren}
      </Stage>

      {underlay}

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
            if (marker.activate) {
              return (
                <button
                  key={marker.id}
                  ref={attach}
                  type="button"
                  className={className}
                  style={{ "--placed": 0 } as CSSProperties}
                  aria-label={marker.label ?? marker.text}
                  aria-haspopup="dialog"
                  onClick={() => {
                    if (draggedRef.current) return;
                    marker.activate?.();
                  }}
                >
                  {content}
                </button>
              );
            }
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
      {hoverHint !== null && hoverHint !== undefined ? (
        <p className="hint hint--hover" data-game-ui-tone="glass">
          {hoverHint}
        </p>
      ) : null}
      {controlsHint !== null && controlsHint !== undefined ? (
        <p
          className={`hint hint--controls${controlsHintVisible ? "" : " hint--dismissed"}`}
          data-game-ui-tone="glass"
        >
          {controlsHint}
        </p>
      ) : null}
      {entryHint !== null && entryHint !== undefined ? (
        <p
          className={`hint hint--entry${entryHintVisible ? "" : " hint--dismissed"}`}
          data-game-ui-tone="glass"
        >
          {entryHint}
        </p>
      ) : null}
      {loading}
    </div>
  );
}
