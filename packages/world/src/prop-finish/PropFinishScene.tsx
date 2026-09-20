import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Html, OrthographicCamera } from "@react-three/drei";

import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Stage } from "../Stage.js";
import { PROP_SAMPLES, type PropFinish, type PropId } from "./catalog.js";
import {
  MapPropSource,
  encodeGeometry,
  type SourceModel,
  type SourcePart,
} from "./source-models.js";
import {
  prepareModel,
  geometrySignature,
  unpackDerivative,
  type PreparedModel,
  type PackedDerivative,
} from "./derivatives.js";

export interface PropCost {
  id: PropId;
  triangles: Record<PropFinish, number>;
}
export interface FinishSceneProps {
  labels: Readonly<Record<PropId, string>>;
  finish: PropFinish;
  selected: PropId;
  gallery: boolean;
  rotation: number;
  tilt: number;
  zoom: number;
  post: boolean;
  active: boolean;
  diagnostic: boolean;
  onReady: (costs: PropCost[]) => void;
  onFailure: (message: string) => void;
}
class Boundary extends Component<
  { children: ReactNode; onError: (s: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function ModelParts({ parts }: { parts: readonly SourcePart[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          material={p.material}
          castShadow
          receiveShadow
          dispose={null}
        />
      ))}
    </>
  );
}
const floorGeometry = new THREE.CylinderGeometry(1.12, 1.17, 0.1, 64);
function Collection(props: FinishSceneProps) {
  const { size, gl, scene, camera, clock, advance } = useThree();
  const [sources, setSources] = useState<ReadonlyMap<PropId, SourceModel>>(new Map());
  const [models, setModels] = useState<ReadonlyMap<PropId, PreparedModel>>(new Map());
  const latest = useRef(props);
  latest.current = props;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const modelRef = useRef(models);
  modelRef.current = models;
  const loaded = useCallback(
    (model: SourceModel) => setSources((old) => new Map(old).set(model.sample.id, model)),
    [],
  );
  const floor = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.88 }),
    [],
  );
  useEffect(() => () => floor.dispose(), [floor]);
  useEffect(() => {
    if (sources.size !== 10) return;
    const abort = new AbortController();
    let dead = false;
    const owned: PreparedModel[] = [];
    Promise.all(
      PROP_SAMPLES.map(async (sample) => {
        const response = await fetch(`/art/prop-finish/${sample.id}.json`, {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error(`Missing prepared object: ${sample.id}`);
        const metadata = (await response.json()) as PackedDerivative;
        const binary = await fetch(`/art/prop-finish/${sample.id}.bin`, { signal: abort.signal });
        if (!binary.ok) throw new Error(`Missing prepared geometry: ${sample.id}`);
        const data = await unpackDerivative(metadata, await binary.arrayBuffer());
        if (dead) return null;
        const visibility = await new THREE.TextureLoader().loadAsync(
          `/art/prop-finish/${sample.id}-visibility.png`,
        );
        if (
          visibility.image.width !== data.visibilitySize ||
          visibility.image.height !== data.visibilitySize
        ) {
          visibility.dispose();
          throw new Error(`Mismatched visibility map: ${sample.id}`);
        }
        visibility.flipY = false;
        visibility.colorSpace = THREE.NoColorSpace;
        visibility.name = `${sample.id}-local-visibility`;
        visibility.generateMipmaps = true;
        visibility.minFilter = THREE.LinearMipmapLinearFilter;
        if (dead) {
          visibility.dispose();
          return null;
        }
        try {
          const model = prepareModel(sources.get(sample.id)!, data, visibility);
          owned.push(model);
          return model;
        } catch (error) {
          visibility.dispose();
          throw error;
        }
      }),
    )
      .then((values) => {
        if (dead) return;
        setModels(
          new Map(
            values.filter((v): v is PreparedModel => !!v).map((v) => [v.source.sample.id, v]),
          ),
        );
        latest.current.onReady(
          values
            .filter((v): v is PreparedModel => !!v)
            .map((model) => ({
              id: model.source.sample.id,
              triangles: Object.fromEntries(
                Object.entries(model.parts).map(([method, parts]) => [
                  method,
                  parts.reduce(
                    (sum, p) =>
                      sum +
                      (p.geometry.index?.count ?? p.geometry.getAttribute("position").count) / 3,
                    0,
                  ),
                ]),
              ) as Record<PropFinish, number>,
            })),
        );
      })
      .catch((e) => {
        if (!dead) {
          if (!import.meta.env.DEV || !new URLSearchParams(location.search).has("export"))
            latest.current.onFailure(String(e));
        }
      });
    return () => {
      dead = true;
      abort.abort();
      owned.forEach((m) => m.dispose());
    };
  }, [sources]);
  useLayoutEffect(() => {
    for (const model of models.values())
      for (const part of model.parts.crafted) {
        const uniform = part.material.userData.propFinishDiagnostic as
          | { value: number }
          | undefined;
        if (uniform) uniform.value = props.diagnostic ? 1 : 0;
      }
  }, [models, props.diagnostic]);
  // A static inspection canvas stops completely off-screen; controls request
  // one frozen-time frame instead of restarting a background loop.
  const draw = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (props.active || models.size < 10) return;
    draw.current = requestAnimationFrame(() => {
      draw.current = null;
      advance(clock.elapsedTime, true);
    });
    return () => {
      if (draw.current !== null) cancelAnimationFrame(draw.current);
    };
  }, [
    props.active,
    props.finish,
    props.gallery,
    props.selected,
    props.rotation,
    props.tilt,
    props.zoom,
    props.post,
    props.diagnostic,
    models,
    advance,
    clock,
  ]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const canvas = gl.domElement as HTMLCanvasElement & {
      __propFinish?: () => unknown;
      __exportMapProps?: () => unknown;
    };
    const inspect = () => ({
      finish: latest.current.finish,
      selected: latest.current.selected,
      gallery: latest.current.gallery,
      rotation: latest.current.rotation,
      tilt: latest.current.tilt,
      zoom: latest.current.zoom,
      active: latest.current.active,
      ready: modelRef.current.size === 10,
      loaded: sourcesRef.current.size,
      scene: scene.uuid,
      camera: camera.matrixWorld.toArray(),
      memory: { ...gl.info.memory, programs: gl.info.programs?.length ?? 0 },
      frame: (globalThis as unknown as { __stageFrameMetrics?: unknown }).__stageFrameMetrics,
      objects: [...sourcesRef.current.values()].map((s) => ({
        id: s.sample.id,
        source: s.sample.source,
        original: s.parts.map((p) => ({
          geometry: p.geometry.uuid,
          material: p.material.uuid,
          signature: geometrySignature(p.geometry),
        })),
        variants: modelRef.current.get(s.sample.id)
          ? Object.fromEntries(
              Object.entries(modelRef.current.get(s.sample.id)!.parts).map(([k, parts]) => [
                k,
                {
                  triangles: parts.reduce(
                    (sum, p) =>
                      sum +
                      (p.geometry.index?.count ?? p.geometry.getAttribute("position").count) / 3,
                    0,
                  ),
                  geometries: parts.map((p) => p.geometry.uuid),
                  materials: parts.map((p) => p.material.uuid),
                },
              ]),
            )
          : null,
      })),
    });
    const exportSources = () =>
      PROP_SAMPLES.map((sample) => {
        const s = sourcesRef.current.get(sample.id);
        if (!s) throw new Error(`Source not ready: ${sample.id}`);
        return {
          sample,
          sourceSignatures: s.parts.map((p) => geometrySignature(p.geometry)),
          parts: s.parts.map((p) => ({
            geometry: encodeGeometry(p.geometry),
            name: p.name,
            transparent: p.material.transparent,
            opacity: p.material.opacity,
            flatShading: p.material.flatShading,
          })),
        };
      });
    canvas.__propFinish = inspect;
    canvas.__exportMapProps = exportSources;
    return () => {
      delete canvas.__propFinish;
      delete canvas.__exportMapProps;
    };
  }, [gl, scene, camera]);
  const cols = size.width < 650 ? 2 : 5;
  const rows = Math.ceil(10 / cols);
  const boardWidth = props.gallery ? cols * 2.7 : 6.4;
  // Row spacing is measured at the feet, not the crown. Reserve headroom for
  // the two real trees at the default gallery zoom; do not crop their silhouettes.
  const boardHeight = props.gallery ? rows * 2.8 + 0.8 : 3.7;
  const cameraZoom = Math.min(size.width / boardWidth, size.height / boardHeight) * props.zoom;
  const shown = props.gallery ? PROP_SAMPLES : PROP_SAMPLES.filter((p) => p.id === props.selected);
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 25]} zoom={cameraZoom} near={0.1} far={80} />
      <color attach="background" args={[0xcbdad8]} />
      <hemisphereLight args={[0xf3f5ef, 0x938a78, 1.15]} />
      <directionalLight
        position={[-5, 9, 8]}
        intensity={2.6}
        color={0xffefdc}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={props.gallery ? -10 : -5}
        shadow-camera-right={props.gallery ? 10 : 5}
        shadow-camera-top={props.gallery ? 14 : 5}
        shadow-camera-bottom={props.gallery ? -14 : -5}
        shadow-camera-near={0.1}
        shadow-camera-far={45}
        shadow-bias={-0.00015}
        shadow-normalBias={0.012}
        shadow-intensity={0.5}
      />
      <directionalLight position={[5, 4, -5]} intensity={0.65} color={0xc4e2ed} />
      {PROP_SAMPLES.map((sample) => (
        <MapPropSource key={sample.id} sample={sample} onReady={loaded} />
      ))}
      {shown.flatMap((sample, i) => {
        const model = models.get(sample.id),
          source = sources.get(sample.id);
        if (!source) return [];
        const bounds = new THREE.Box3();
        source.parts.forEach((p) => {
          p.geometry.computeBoundingBox();
          bounds.union(p.geometry.boundingBox!);
        });
        const dimensions = bounds.getSize(new THREE.Vector3());
        // Both copies get the SAME fit, derived from the untouched original.
        // Wide low rocks must not overflow or overlap merely because normalization used height.
        const displayScale = Math.min(
          2.15 / dimensions.y,
          2.6 / Math.hypot(dimensions.x, dimensions.z),
        );
        const versions: PropFinish[] = props.gallery ? [props.finish] : ["original", props.finish];
        return versions.map((version, column) => {
          const x = props.gallery ? ((i % cols) - (cols - 1) / 2) * 2.7 : column ? 1.55 : -1.55;
          const y = props.gallery
            ? ((rows - 1) / 2 - Math.floor(i / cols)) * 2.8 - 0.7
            : -Math.min(0.95, dimensions.y * displayScale * 0.52);
          const parts = model?.parts[version] ?? source.parts;
          return (
            <group
              key={`${sample.id}-${column}`}
              name={`display-${sample.id}-${column}`}
              position={[x, y, 0]}
              rotation={[props.tilt, props.rotation, 0]}
            >
              <group scale={displayScale}>
                <ModelParts parts={parts} />
              </group>
              {props.gallery ? (
                <Html
                  center
                  position={[0, -0.32, 0]}
                  zIndexRange={[2, 0]}
                  style={{ pointerEvents: "none" }}
                >
                  <span className="prop-finish__gallery-label">
                    {i + 1}. {props.labels[sample.id]}
                  </span>
                </Html>
              ) : null}
              <mesh
                geometry={floorGeometry}
                material={floor}
                position={[0, -0.06, 0]}
                receiveShadow
                dispose={null}
              />
            </group>
          );
        });
      })}
    </>
  );
}
export function PropFinishScene(props: FinishSceneProps) {
  return (
    <Boundary onError={props.onFailure}>
      <Stage
        cameraFrom={[0, 0, 25]}
        lookAt={[0, 0, 0]}
        paused={!props.active}
        ambientOcclusion={false}
        postProcessing={props.post}
        onRendererUnavailable={() => props.onFailure("WebGL unavailable")}
        onContextLost={() => props.onFailure("WebGL interrupted")}
      >
        <Collection {...props} />
      </Stage>
    </Boundary>
  );
}
export { PROP_SAMPLES, PROP_IDS, FINISH_IDS, parsePropId, parsePropFinish } from "./catalog.js";
export type { PropId, PropFinish } from "./catalog.js";
