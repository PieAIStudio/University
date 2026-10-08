import { createRoot } from "react-dom/client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import blueprints from "./render-dist/render-blueprints.json";
import {
  AerialWorldPlate,
  DEFAULT_WORLD_ENVIRONMENT_STOPS,
  DeepSea,
  ISLAND_LOOK_CONTRACT,
  MapLighting,
  SwimInAIIslandRender,
  SkyDome,
  WORLD_GRADE,
  WorldEnvironment,
  assertWorldGradePipeline,
  createGradePass,
  islandLookSceneSource,
  measureIslandCodeMetrics,
  measureIslandLookInBrowser,
  measureKeyToFillRatio,
} from "../../packages/world/src/island/swiminai-island-render.js";
import type { IslandBlueprint } from "../../packages/world/src/island/swiminai-island-render.js";

const VIEWPORT = { width: 1440, height: 900, dpr: 1 } as const;
const CAMERA = {
  position: [10, 9, 16] as const,
  target: [0, 0, 0] as const,
  fov: 34,
};
const detail =
  new URLSearchParams(window.location.search).get("detail") === "course" ? "course" : "world";
const blueprint = blueprints.uni as IslandBlueprint;
const source = islandLookSceneSource(detail, [blueprint], blueprint.nodes);

type RenderCounters = {
  readonly calls: number;
  readonly triangles: number;
  readonly lines: number;
  readonly points: number;
};

type ReferenceInspect = {
  readonly ready: boolean;
  readonly detail: typeof detail;
  readonly blueprint: {
    readonly seed: string;
    readonly courseId: string;
    readonly recipeId?: string;
  };
  readonly camera: {
    readonly position: readonly number[];
    readonly target: typeof CAMERA.target;
    readonly fov: number;
    readonly aspect: number;
    readonly viewport: typeof VIEWPORT;
  };
  readonly lights: readonly {
    readonly type: string;
    readonly name: string;
    readonly intensity: number;
    readonly color: string;
    readonly castShadow: boolean;
    readonly shadowMapSize?: readonly number[];
  }[];
  readonly render: {
    readonly sceneAndShadow: RenderCounters;
    readonly post: RenderCounters;
    readonly full: RenderCounters;
    readonly shadowLightCount: number;
  };
  readonly look: ReturnType<typeof measureIslandCodeMetrics>;
  readonly grade: {
    readonly source: "WORLD_GRADE";
    readonly contrast: number;
    readonly keyToFillRatio: number | null;
    readonly contract: typeof ISLAND_LOOK_CONTRACT;
  };
  readonly assets: readonly string[];
};

declare global {
  interface Window {
    __swiminaiReferenceInspect?: () => ReferenceInspect | null;
    measureSwimInAIReferenceLook?: () => ReturnType<typeof measureIslandLookInBrowser>;
  }
}

function counters(info: THREE.WebGLInfo): RenderCounters {
  return {
    calls: info.render.calls,
    triangles: info.render.triangles,
    lines: info.render.lines,
    points: info.render.points,
  };
}

function colorHex(color: THREE.Color): string {
  return `#${color.getHexString()}`;
}

function sceneLights(scene: THREE.Scene): ReferenceInspect["lights"] {
  const lights: Array<ReferenceInspect["lights"][number]> = [];
  scene.traverse((object) => {
    if (!(object as THREE.Object3D).isLight) return;
    const light = object as THREE.Light;
    const directional = light as THREE.DirectionalLight;
    lights.push({
      type: light.type,
      name: light.name,
      intensity: light.intensity,
      color: colorHex(light.color),
      castShadow: light.castShadow,
      ...(light.castShadow && directional.shadow
        ? { shadowMapSize: directional.shadow.mapSize.toArray() }
        : {}),
    });
  });
  return lights;
}

function ReferenceFrame() {
  const { camera, gl, scene, size } = useThree();
  const pass = useMemo(() => createGradePass(), []);
  const inspect = useRef<ReferenceInspect | null>(null);

  useEffect(() => () => pass.dispose(), [pass]);
  useEffect(() => {
    gl.info.autoReset = false;
    pass.resize(Math.round(size.width), Math.round(size.height));
    assertWorldGradePipeline(gl);
    const inspectLook = () => measureIslandLookInBrowser({ canvas: gl.domElement, scene, source });
    window.measureSwimInAIReferenceLook = inspectLook;
    window.__swiminaiReferenceInspect = () => inspect.current;
    return () => {
      delete window.measureSwimInAIReferenceLook;
      delete window.__swiminaiReferenceInspect;
    };
  }, [gl, pass, scene, size.height, size.width]);

  useFrame(() => {
    gl.info.reset();
    gl.setRenderTarget(pass.target);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    const sceneAndShadow = counters(gl.info);
    pass.render(gl, pass.target.texture);
    const full = counters(gl.info);
    const post = {
      calls: full.calls - sceneAndShadow.calls,
      triangles: full.triangles - sceneAndShadow.triangles,
      lines: full.lines - sceneAndShadow.lines,
      points: full.points - sceneAndShadow.points,
    };
    const lights = sceneLights(scene);
    inspect.current = {
      ready: scene.getObjectByName("remote-island-terrain") !== null,
      detail,
      blueprint: {
        seed: blueprint.seed,
        courseId: blueprint.courseId,
        recipeId: blueprint.themeSelection.recipeId,
      },
      camera: {
        position: camera.position.toArray(),
        target: CAMERA.target,
        fov: (camera as THREE.PerspectiveCamera).fov,
        aspect: camera.aspect,
        viewport: VIEWPORT,
      },
      lights,
      render: {
        sceneAndShadow,
        post,
        full,
        shadowLightCount: lights.filter((light) => light.castShadow).length,
      },
      look: measureIslandCodeMetrics(source, measureKeyToFillRatio(scene)),
      grade: {
        source: "WORLD_GRADE",
        contrast: WORLD_GRADE.contrast,
        keyToFillRatio: measureKeyToFillRatio(scene),
        contract: ISLAND_LOOK_CONTRACT,
      },
      assets: [
        "packages/world/src/assets/generated/aerial-world-plate-2k.webp",
        "packages/world/src/assets/generated/aerial-world-plate-4k.webp",
        "tools/swiminai-islands/render-dist/render-blueprints.json",
      ],
    };
  }, 1);

  return null;
}

function ReferenceScene() {
  return (
    <Canvas
      dpr={VIEWPORT.dpr}
      camera={{ position: CAMERA.position, fov: CAMERA.fov, near: 0.5, far: 1200 }}
      shadows="percentage"
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(...CAMERA.target);
        gl.setClearColor(new THREE.Color(0x0d1019), 1);
        (window as Window & { three?: unknown }).three = { camera, gl };
      }}
    >
      <WorldEnvironment>
        <color attach="background" args={[DEFAULT_WORLD_ENVIRONMENT_STOPS.zenith]} />
        <SkyDome stops={{ ...DEFAULT_WORLD_ENVIRONMENT_STOPS, sunProfile: "course" }} />
        <MapLighting
          groundRadius={blueprint.bounds.maxHalf}
          skyMid={DEFAULT_WORLD_ENVIRONMENT_STOPS.mid}
          sunProfile="course"
          shadows
        />
        <Suspense fallback={<DeepSea extent={90} level={-5.2} />}>
          <AerialWorldPlate extent={90} level={-5.2} visible />
        </Suspense>
        <DeepSea extent={90} level={-5.2} />
        <SwimInAIIslandRender
          blueprint={blueprint}
          detail={detail}
          targetRadius={3.2}
          display={{ id: "uni", name: "University" }}
        />
        <ReferenceFrame />
      </WorldEnvironment>
    </Canvas>
  );
}

function App() {
  return (
    <>
      <ReferenceScene />
      <div className="reference-status">
        University source reference · uni · {detail} · 1440×900 · dpr 1 · WORLD_GRADE
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
