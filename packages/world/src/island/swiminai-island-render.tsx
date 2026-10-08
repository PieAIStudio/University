/**
 * Pure island rendering entry for external R3F hosts.
 *
 * The host supplies one already-authored IslandBlueprint and chooses a detail
 * tier. This module owns no course records, Maps state, account state or UI;
 * it only composes the University's existing terrain/material, dressing,
 * miniature atlas and grass projections.
 */
import { useMemo } from "react";
import * as THREE from "three";

import { IslandDressing } from "./island-dressing-render.js";
import { IslandGrass } from "./island-grass-render.js";
import { IslandRender, type IslandRenderProps } from "./island-render.js";
import { RemoteIslandField } from "./remote-island-render.js";
import type { RemoteIslandPlacement } from "./remote-island-field.js";
import type { IslandBlueprint } from "./island-blueprint.js";

export interface SwimInAIIslandDisplay {
  /** Optional host label, kept as metadata rather than canvas text. */
  readonly id?: string;
  readonly name?: string;
  readonly dimmed?: boolean;
}

export interface SwimInAIIslandRenderProps extends Pick<
  IslandRenderProps,
  "onClick" | "onPointerOver" | "onPointerOut"
> {
  readonly blueprint: IslandBlueprint;
  readonly detail: "course" | "world";
  readonly targetRadius?: number;
  readonly display?: SwimInAIIslandDisplay;
  readonly showDressing?: boolean;
  readonly showGrass?: boolean;
}

function remotePlacement(
  blueprint: IslandBlueprint,
  targetRadius: number | undefined,
  display: SwimInAIIslandDisplay | undefined,
): RemoteIslandPlacement {
  const scale = targetRadius === undefined ? 1 : targetRadius / blueprint.bounds.maxHalf;
  return {
    id: display?.id ?? `${blueprint.studyId}/${blueprint.courseId}`,
    blueprint,
    position: new THREE.Vector3(),
    radius: blueprint.bounds.maxHalf,
    scale,
    dimmed: display?.dimmed ?? false,
  };
}

/**
 * Render one island without importing Maps, course data, UI, or page state.
 *
 * `course` mounts the full close projection: University terrain material with
 * course surface atlas, dressing and instanced grass. `world` uses the shared
 * remote miniature projection and its miniature surface atlas plus remote
 * dressing. The caller owns the Canvas, lights, camera, grade and disposal of
 * the host scene; every child projection owns only resources it creates.
 */
export function SwimInAIIslandRender({
  blueprint,
  detail,
  targetRadius,
  display,
  showDressing = true,
  showGrass = true,
  onClick,
  onPointerOver,
  onPointerOut,
}: SwimInAIIslandRenderProps) {
  const placement = useMemo(
    () => remotePlacement(blueprint, targetRadius, display),
    [blueprint, targetRadius, display],
  );

  if (detail === "world") {
    return (
      <group
        name="swiminai-island-world"
        userData={{
          renderer: "@pieai/university-world/swiminai-island-render",
          detail,
          blueprintSeed: blueprint.seed,
          displayId: display?.id,
        }}
        onClick={
          onClick
            ? (event) => {
                event.stopPropagation();
                onClick();
              }
            : undefined
        }
        onPointerOver={
          onPointerOver
            ? (event) => {
                event.stopPropagation();
                onPointerOver();
              }
            : undefined
        }
        onPointerOut={
          onPointerOut
            ? (event) => {
                event.stopPropagation();
                onPointerOut();
              }
            : undefined
        }
      >
        <RemoteIslandField
          islands={[placement]}
          showProps={showDressing}
          onPick={() => onClick?.()}
          onHover={(index) => {
            if (index === null) onPointerOut?.();
            else onPointerOver?.();
          }}
        />
      </group>
    );
  }

  return (
    <group
      name="swiminai-island-course"
      userData={{
        renderer: "@pieai/university-world/swiminai-island-render",
        detail,
        blueprintSeed: blueprint.seed,
        displayId: display?.id,
      }}
    >
      <IslandRender
        blueprint={blueprint}
        detail="course"
        targetRadius={targetRadius}
        dimmed={display?.dimmed}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      {showGrass ? (
        <IslandGrass blueprint={blueprint} detail="course" targetRadius={targetRadius} />
      ) : null}
      {showDressing ? (
        <IslandDressing blueprint={blueprint} detail="course" targetRadius={targetRadius} />
      ) : null}
    </group>
  );
}

export const SWIMINAI_ISLAND_RENDER_EXTERNALS = [
  "three",
  "react",
  "react-dom",
  "@react-three/fiber",
  "@react-three/drei",
  "@pieai/swimmer-render-kit",
] as const;

export const SWIMINAI_ISLAND_RENDER_ALIGNMENT = {
  three: "0.185.1",
  react: "19.2.8",
  reactDom: "19.2.8",
  fiber: "9.6.1",
  drei: "10.7.8",
  swimmerRenderKit: "0.5.0",
} as const;

// The website owns Canvas and the one frame blit, but it must consume the
// University's already-validated scene contract. These are direct source
// re-exports; Maps, Stage and page state remain outside this pure entry.
export { MapLighting } from "../sky/lighting.js";
export type { MapLightingProps } from "../sky/lighting.js";
export {
  WorldEnvironment,
  WORLD_ENVIRONMENT,
  DEFAULT_WORLD_ENVIRONMENT_STOPS,
} from "../sky/environment.js";
export type { EnvironmentTextureMemory } from "../sky/environment.js";
export {
  SkyDome,
  createSkyDomeUniforms,
  SKY_DOME_FRAGMENT_SHADER,
  SKY_DOME_NAME,
  SKY_DOME_STOPS_KEY,
  SKY_DOME_VERTEX_SHADER,
} from "../sky/skydome.js";
export type { SkyDomeStops } from "../sky/skydome.js";
export { AerialWorldPlate, DeepSea, SEA_COLORS } from "../sky/horizon-sea.js";
export {
  CATALOGUE_SUN,
  GARDEN_SUN,
  WORLD_SUN,
  mapSunStyle,
  mapSunStyle as worldSunStyle,
  worldKeyToFillRatio,
  worldShadowFrustum,
  worldShadowNormalBias,
  worldSunDirection,
  worldSunPosition,
  worldTotalFill,
} from "../sky/sun.js";
export type { MapSunProfile, WorldShadowFrustum } from "../sky/sun.js";
export {
  assertWorldGradePipeline,
  createGradePass,
  WORLD_GRADE,
  WORLD_GRADE_FRAGMENT,
  WORLD_GRADE_PIVOT_SRGB8,
} from "./grade.js";
export type { GradePass } from "./grade.js";
export {
  ISLAND_LOOK_CONTRACT,
  islandLookCameraForShot,
  islandLookSceneSource,
} from "./island-look.js";
export type {
  IslandLookBounds,
  IslandLookCameraPose,
  IslandLookSceneSource,
  IslandLookSceneSourceOptions,
  IslandLookViewport,
} from "./island-look.js";
export {
  measureIslandCodeMetrics,
  measureIslandImageData,
  measureIslandLookInBrowser,
  measureKeyToFillRatio,
} from "./look-metrics.js";
export type {
  DomLabelContrastSample,
  IslandLookBrowserReport,
  IslandLookCodeMetrics,
  IslandLookLayerDistribution,
  IslandLookPixelMetrics,
} from "./look-metrics.js";
