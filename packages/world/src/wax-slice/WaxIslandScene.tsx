import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { Stage } from "../Stage.js";
import { CourseScene, type LessonPlacement } from "../Maps.js";
import { guestAvatarRecipe, type AvatarRecipe } from "../avatar/index.js";
import { WaxSliceOwner } from "./wax-owner.js";

export type WaxView = "island" | "detail" | "avatar";
interface Props {
  lessons: readonly LessonPlacement[];
  recipe: AvatarRecipe | null;
  signedIn: boolean;
  selected: string | null;
  wax: boolean;
  strength: number;
  soften: boolean;
  scattering: boolean;
  paused: boolean;
  ready: boolean;
  post: boolean;
  view: WaxView;
  reset: number;
  onPick: (lesson: LessonPlacement) => void;
  onReady: () => void;
  onFailure: () => void;
}
class Boundary extends Component<{ children: ReactNode; fail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.fail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function Slice(props: Props) {
  const { scene, camera, gl, clock, advance, size } = useThree();
  const root = useRef<THREE.Group>(null);
  const orbit = useRef<OrbitControlsImpl>(null);
  const owner = useRef<WaxSliceOwner | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const task = props.lessons.find((l) => l.lessonId === props.selected) ?? props.lessons[0]!;
  const extent = props.lessons[0]!.blueprint.bounds.maxHalf;
  const draw = useRef<number | null>(null);
  const rendering = useRef(false);
  const requestDraw = useCallback(() => {
    // OrbitControls can emit change from its update inside a render callback.
    // Queue one frozen-time frame, never recursively advance from that callback.
    if (
      !latest.current.paused ||
      !latest.current.ready ||
      rendering.current ||
      draw.current !== null
    )
      return;
    draw.current = requestAnimationFrame(() => {
      draw.current = null;
      rendering.current = true;
      try {
        advance(clock.elapsedTime, true);
      } finally {
        rendering.current = false;
      }
    });
  }, [advance, clock]);
  useEffect(
    () => () => {
      if (draw.current !== null) cancelAnimationFrame(draw.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!root.current) return;
    const instance = new WaxSliceOwner(root.current);
    owner.current = instance;
    return () => {
      instance.dispose();
      if (owner.current === instance) owner.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    owner.current?.reconcile(props.wax, props.strength, props.soften, props.scattering);
    const id = requestAnimationFrame(requestDraw);
    return () => cancelAnimationFrame(id);
  }, [
    props.wax,
    props.strength,
    props.soften,
    props.scattering,
    props.paused,
    props.ready,
    props.post,
    requestDraw,
  ]);
  useLayoutEffect(() => {
    const target =
      props.view === "island"
        ? new THREE.Vector3(0, -extent * 0.2, 0)
        : task.position.clone().add(new THREE.Vector3(0, props.view === "avatar" ? 0.9 : 0.3, 0));
    const offset =
      props.view === "island"
        ? new THREE.Vector3(extent * 1.8, extent * 2, extent * 2.8).multiplyScalar(
            1 / Math.min(1, (size.width / size.height) * 1.1),
          )
        : props.view === "avatar"
          ? new THREE.Vector3(2.6, 1.8, 5.4)
          : new THREE.Vector3(6.5, 7, 10);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    orbit.current?.target.copy(target);
    orbit.current?.update();
    const id = requestAnimationFrame(requestDraw);
    return () => cancelAnimationFrame(id);
    // Appearance controls deliberately do not participate in camera framing.
  }, [camera, extent, props.view, props.reset, task, requestDraw, size.width, size.height]);
  useFrame(
    () =>
      owner.current?.reconcile(
        latest.current.wax,
        latest.current.strength,
        latest.current.soften,
        latest.current.scattering,
      ),
    -0.25,
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const canvas = gl.domElement as HTMLCanvasElement & { __waxSlice?: () => unknown };
    const inspect = () => {
      const meshes: unknown[] = [];
      root.current?.traverse((node) => {
        const m = node as THREE.Mesh;
        if (!m.isMesh) return;
        meshes.push({
          id: m.uuid,
          name: m.name,
          geometry: m.geometry.uuid,
          positions: m.geometry.getAttribute("position")?.count ?? 0,
          materials: (Array.isArray(m.material) ? m.material : [m.material]).map((material) => ({
            id: material.uuid,
            source: material.userData.waxSlice?.source ?? material.uuid,
            role: material.userData.waxSlice?.role ?? null,
            roughness: (material as THREE.MeshStandardMaterial).roughness,
            map: (material as THREE.MeshStandardMaterial).map?.uuid ?? null,
          })),
        });
      });
      return {
        scene: scene.uuid,
        camera: camera.matrixWorld.toArray(),
        projection: camera.projectionMatrix.toArray(),
        recipe: JSON.stringify(
          latest.current.signedIn && latest.current.recipe
            ? latest.current.recipe
            : guestAvatarRecipe(),
        ),
        selected: latest.current.selected,
        paused: latest.current.paused,
        time: clock.elapsedTime,
        scattering: latest.current.scattering,
        seed: props.lessons[0]!.blueprint.seed,
        course: `${props.lessons[0]!.studyId}/${props.lessons[0]!.courseId}`,
        nodes: props.lessons.map((l) => ({ id: l.lessonId, position: l.position.toArray() })),
        avatarPosition: scene
          .getObjectByName("university-avatar-occlusion-target")
          ?.getWorldPosition(new THREE.Vector3())
          .toArray(),
        style: latest.current.wax ? "wax" : "classic",
        strength: latest.current.strength,
        ...owner.current?.report,
        meshes,
        memory: { ...gl.info.memory, programs: gl.info.programs?.length ?? 0 },
        frame: (globalThis as unknown as { __stageFrameMetrics?: unknown }).__stageFrameMetrics,
      };
    };
    canvas.__waxSlice = inspect;
    return () => {
      if (canvas.__waxSlice === inspect) delete canvas.__waxSlice;
    };
  }, [camera, gl, scene, clock, props.lessons]);

  return (
    <>
      <OrbitControls
        ref={orbit}
        makeDefault
        enableDamping={false}
        minDistance={2.5}
        maxDistance={extent * 6}
        maxPolarAngle={Math.PI * 0.49}
        onChange={requestDraw}
      />
      <group ref={root} name="wax-island-slice">
        <CourseScene
          lessons={props.lessons}
          avatarRecipe={props.recipe}
          avatarSignedIn={props.signedIn}
          avatarLessonId={props.selected}
          onPick={props.onPick}
          onHover={() => {}}
        />
      </group>
    </>
  );
}
export function WaxIslandScene(props: Props) {
  const extent = props.lessons[0]!.blueprint.bounds.maxHalf;
  const cameraFrom = useMemo<[number, number, number]>(
    () => [extent * 1.25, extent * 1.4 + 1.5, extent * 1.85],
    [extent],
  );
  return (
    <Boundary fail={props.onFailure}>
      <Stage
        cameraFrom={cameraFrom}
        lookAt={[0, 1.5, 0]}
        cameraFar={1200}
        paused={props.paused && props.ready}
        postProcessing={props.post}
        onSceneReady={props.onReady}
        onContextLost={props.onFailure}
        onRendererUnavailable={props.onFailure}
      >
        <Slice {...props} />
      </Stage>
    </Boundary>
  );
}
