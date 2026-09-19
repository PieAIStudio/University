import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { translate } from "@pieai/university-ui/i18n.js";
import type { AuthoringFocus } from "@pieai/university-core";

import { Controls, Flight, LabelProbe, WORLD_POLAR } from "./camera/controls.js";
import { placeWorld, WorldScene, type Marker } from "./Maps.js";
import type { AvatarRecipe } from "./avatar/index.js";
import type { CourseNode } from "./course/course.js";
import type { IslandLookCameraPose, IslandLookSceneSource } from "./island/island-look.js";
import { Stage } from "./Stage.js";
import { CourseOverviewContext, CourseOverviewProbe } from "./camera/CourseOverview.js";
import type { CourseOverviewFrame } from "./camera/course-overview.js";

export type WorldMap = ReturnType<typeof placeWorld>;

export interface MapViewportCommands {
  overview(): void;
  learningView(): void;
  /** Frame an explicitly chosen real destination without navigating into it. */
  focus(point: readonly [number, number, number]): void;
}

/**
 * The shared world-map assembly.
 *
 * Both shells used to own this same Stage → controls → label projector →
 * WorldScene stack and then drifted whenever one side changed a camera or
 * keyboard affordance. Authoring and delivery still supply their own DOM
 * cards, presence layer and navigation, but the map itself has one producer.
 */
export function WorldMapCanvas({
  commandsRef,
  world,
  cameraFrom,
  lookAt,
  learnerAt,
  avatarRecipe,
  avatarSignedIn,
  selectedCourseKey,
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
  courseViewKey = null,
}: {
  readonly className?: string;
  readonly commandsRef?: RefObject<MapViewportCommands | null>;
  readonly world: WorldMap | null;
  readonly cameraFrom: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly learnerAt: Parameters<typeof WorldScene>[0]["learnerAt"];
  readonly avatarRecipe: AvatarRecipe | null;
  readonly avatarSignedIn: boolean;
  readonly selectedCourseKey?: string | null;
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
  /** A learner course route; absent on the reader, catalogue and diagnostic shots. */
  readonly courseViewKey?: string | null;
}) {
  const labelNodes = useRef(new Map<string, HTMLElement>());
  const draggedRef = useRef(false);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const [overviewKey, setOverviewKey] = useState<string | null>(null);
  const [overview, setOverview] = useState<{ key: string; frame: CourseOverviewFrame } | null>(
    null,
  );
  const [overviewError, setOverviewError] = useState(false);
  const [frameRequest, setFrameRequest] = useState(0);
  const frameKey = courseViewKey ?? skyStudyId ?? "world";
  const [focusRequest, setFocusRequest] = useState<{
    key: string;
    point: readonly [number, number, number];
  } | null>(null);
  useEffect(() => {
    if (!commandsRef) return;
    const commands: MapViewportCommands = {
      overview() {
        setFocusRequest(null);
        setOverviewError(false);
        setOverview(null);
        setOverviewKey(frameKey);
        setFrameRequest((n) => n + 1);
      },
      learningView() {
        setFocusRequest(null);
        setOverviewError(false);
        setOverviewKey(null);
        setFrameRequest((n) => n + 1);
      },
      focus(point) {
        if (!point.every(Number.isFinite)) return;
        setOverviewKey(null);
        setOverviewError(false);
        setFocusRequest({ key: frameKey, point: [...point] });
        setFrameRequest((n) => n + 1);
      },
    };
    commandsRef.current = commands;
    return () => {
      if (commandsRef.current === commands) commandsRef.current = null;
    };
  }, [commandsRef, courseViewKey, frameKey]);
  const overviewEnabled =
    (courseViewKey !== null || world !== null) && overviewKey === frameKey && fixedCamera === null;
  const activeOverview = overviewEnabled && overview?.key === frameKey ? overview.frame : null;
  const acceptOverview = useCallback(
    (frame: CourseOverviewFrame) => {
      setOverview({ key: frameKey, frame });
    },
    [frameKey],
  );
  const rejectOverview = useCallback(() => {
    setOverviewKey(null);
    setOverviewError(true);
  }, []);
  const focus = focusRequest?.key === frameKey ? focusRequest.point : null;
  const framedFrom =
    activeOverview?.cameraFrom ??
    (focus
      ? ([
          cameraFrom[0] - lookAt[0] + focus[0],
          cameraFrom[1] - lookAt[1] + focus[1],
          cameraFrom[2] - lookAt[2] + focus[2],
        ] as const)
      : cameraFrom);
  const framedLook = activeOverview?.lookAt ?? focus ?? lookAt;

  return (
    <div
      className={className ? `stagewrap ${className}` : "stagewrap"}
      hidden={hidden}
      data-map-surface="true"
      data-map-framing={activeOverview ? "overview" : "learning"}
      tabIndex={0}
      aria-label={translate("product.navigation.mapHeading")}
      onKeyDown={(event) => {
        const action = followNode?.current;
        if (event.key !== "Tab" || !followId || !action?.classList.contains("is-visible")) return;
        const marker = labelNodes.current.get(followId);
        if (!event.shiftKey && event.target === marker) {
          event.preventDefault();
          action.querySelector<HTMLButtonElement>("button")?.focus();
        } else if (event.shiftKey && action.contains(event.target as Node)) {
          event.preventDefault();
          marker?.focus();
        }
      }}
      data-map-view={courseViewKey ? (activeOverview ? "overview" : "learning") : undefined}
      // Retiring a hint can move a DOM control. Wait for its complete click,
      // rather than moving it between pointerdown and pointerup. Real drags
      // retire the hint as soon as their intent is known below.
      onClickCapture={() => onInteract?.()}
      onPointerDownCapture={(event) => {
        if (event.target instanceof HTMLCanvasElement)
          event.currentTarget.focus({ preventScroll: true });
        pointerOrigin.current = { x: event.clientX, y: event.clientY };
        draggedRef.current = false;
      }}
      onPointerMoveCapture={(event) => {
        const origin = pointerOrigin.current;
        if (!origin || draggedRef.current) return;
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) {
          draggedRef.current = true;
          onInteract?.();
        }
      }}
      onPointerUpCapture={() => {
        pointerOrigin.current = null;
      }}
      onPointerCancelCapture={() => {
        pointerOrigin.current = null;
        draggedRef.current = true;
      }}
      onLostPointerCapture={() => {
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
      <div className="map-viewport">
        <Stage
          cameraFrom={framedFrom}
          cameraFar={activeOverview?.far}
          lookAt={framedLook}
          onSceneReady={onSceneReady}
          onSceneBusy={onSceneBusy}
          onContextLost={onContextLost}
          onContextRestored={onContextRestored}
          onRendererUnavailable={onRendererUnavailable}
          onPointerMissed={() => {
            if (!draggedRef.current) onPointerMissed?.();
          }}
          fixedCamera={fixedCamera}
          paused={paused}
          lookSource={lookSource}
          postProcessing={postProcessing}
        >
          <CourseOverviewContext.Provider value={activeOverview}>
            <Controls
              target={framedLook}
              polar={polar}
              fixedCamera={fixedCamera}
              onInteract={onInteract}
              distanceRange={activeOverview?.distanceRange}
            />
            <Flight
              key={frameRequest}
              to={framedFrom}
              look={framedLook}
              fixed={fixedCamera !== null}
            />
            {overviewEnabled ? (
              <CourseOverviewProbe
                key={`${frameKey}:${frameRequest}`}
                surface={courseViewKey ? "course" : "world"}
                onFrame={acceptOverview}
                onError={rejectOverview}
                eyeDirection={[
                  cameraFrom[0] - lookAt[0],
                  cameraFrom[1] - lookAt[1],
                  cameraFrom[2] - lookAt[2],
                ]}
              />
            ) : null}
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
                selectedCourseKey={selectedCourseKey}
                skyStudyId={skyStudyId}
                authoringFocus={authoringFocus}
                assetRevision={assetRevision}
                onPick={onPick}
                onHover={onHover}
              />
            ) : null}
            {stageChildren}
          </CourseOverviewContext.Provider>
        </Stage>
      </div>

      {underlay}

      <nav className="labels" aria-label={translate("map.destinations")}>
        {markers.map((marker) => {
          const isCourseRewriteMarker = marker.kind === "course" && marker.sub !== undefined;
          const courseState = marker.courseState
            ? translate(`ui.world.courseState.${marker.courseState}`)
            : undefined;
          const content = (
            <>
              {marker.kind === "course" ? (
                <span className="label__course-title">{marker.text}</span>
              ) : (
                marker.text
              )}
              {courseState ? (
                <small className="label__course-progress" aria-hidden="true">
                  {marker.courseState === "done" ? "✓ " : ""}
                  {courseState}
                </small>
              ) : null}
              {marker.sub ? (
                <small className={isCourseRewriteMarker ? "label__course-status" : undefined}>
                  {marker.sub}
                </small>
              ) : null}
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
                  data-map-marker={marker.id}
                  data-lesson-state={marker.lessonState}
                  style={{ "--placed": 0 } as CSSProperties}
                  data-course-rewrite-marker={isCourseRewriteMarker ? "true" : undefined}
                  aria-label={marker.label ?? marker.text}
                  aria-pressed={followId === marker.id}
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
                data-map-marker={marker.id}
                data-lesson-state={marker.lessonState}
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
              data-map-marker={marker.id}
              data-lesson-state={marker.lessonState}
              data-course-state={marker.courseState}
              aria-description={marker.label ?? courseState}
              aria-pressed={followId === marker.id}
              style={{ "--placed": 0 } as CSSProperties}
              data-course-rewrite-marker={isCourseRewriteMarker ? "true" : undefined}
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
              data-map-marker={marker.id}
              data-lesson-state={marker.lessonState}
              style={{ "--placed": 0 } as CSSProperties}
              data-course-rewrite-marker={isCourseRewriteMarker ? "true" : undefined}
            >
              {content}
            </div>
          );
        })}
      </nav>
      {overlay}
      <div className="map-tools">
        {overviewError ? <p role="status">{translate("ui.world.overview.unavailable")}</p> : null}
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
      </div>
      {loading}
    </div>
  );
}
