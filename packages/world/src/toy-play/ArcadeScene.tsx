import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Ball, Block, Disc, Parcel, Socket, Star, ToyGarden, wax } from "./parts.js";
import { TOY } from "./style.js";
import { layoutTargetLabels } from "./label-layout.js";
import { CATEGORIES, word, type ToyLocale } from "./material.js";
import { CLAIMS, FLIGHT_CARDS, SENTENCES, VOCABULARY } from "./arcade-content.js";
import { ArcadeSession, type ArcadeAction, type ArcadeState, type Foe } from "./arcade-engine.js";

interface SceneProps {
  session: ArcadeSession;
  snapshot: ArcadeState;
  locale: ToyLocale;
  frozen: boolean;
  onReady: () => void;
  onFailure: () => void;
  booting: boolean;
  act: (action: ArcadeAction) => void;
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
function CameraAndClock({ session, frozen }: Pick<SceneProps, "session" | "frozen">) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const d = Math.max(0.96, 1.02 / aspect);
    camera.position.set(0, 12.8 * d, 17.5 * d);
    camera.lookAt(0, session.mode === "cloze-tetris" ? 4 * d : 1.1, 0.15);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, session.mode]);
  useFrame((_, dt) => {
    if (!frozen) session.advance(dt);
  }, -2);
  return null;
}
function Aircraft({ tool }: { tool: number }) {
  return (
    <group name="arcade-aircraft-body">
      <Ball position={[0, 0, 0]} size={[0.34, 0.27, 0.68]} color={TOY.coral} />
      <Block position={[0, -0.05, 0.08]} size={[1.45, 0.13, 0.48]} color={TOY.cream} />
      <Ball position={[0, 0.23, -0.12]} size={[0.23, 0.15, 0.3]} color={TOY.blue} />
      <Block position={[0, 0.2, 0.48]} size={[0.1, 0.35, 0.25]} color={TOY.cream} />
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, -0.04, 0.1]}>
          <Block size={[0.19, 0.22, 0.78]} color={TOY.channels[tool]!} />
          <Ball position={[0, 0, 0.46]} size={[0.08, 0.08, 0.16]} color={TOY.gold} />
        </group>
      ))}
    </group>
  );
}
const shotGeometry = new THREE.SphereGeometry(1, 8, 6);
const shotColors = [new THREE.Color(TOY.mint), new THREE.Color(TOY.blue)];
function Shots({ session }: { session: ArcadeSession }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const transform = useRef(new THREE.Object3D());
  useFrame(() => {
    if (!mesh.current) return;
    const shots = session.getState().shots;
    mesh.current.count = shots.length;
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i]!;
      transform.current.position.set(s.x, 0.8, s.z);
      transform.current.scale.set(s.kind === 0 ? 0.09 : 0.055, 0.07, s.kind === 0 ? 0.16 : 0.33);
      transform.current.updateMatrix();
      mesh.current.setMatrixAt(i, transform.current.matrix);
      mesh.current.setColorAt(i, shotColors[s.kind]!);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, -1);
  return (
    <instancedMesh
      ref={mesh}
      name="arcade-projectiles"
      args={[shotGeometry, wax(TOY.cream), 32]}
      frustumCulled={false}
      dispose={null}
    />
  );
}
function FoeView({ foe, session }: { foe: Foe; session: ArcadeSession }) {
  const group = useRef<THREE.Group>(null);
  const id = foe.id;
  const card = FLIGHT_CARDS[foe.card]!;
  const reduced = usePrefersReducedMotion();
  useFrame(() => {
    const f = session.getState().enemies.find((e) => e.id === id);
    if (!group.current) return;
    group.current.visible = Boolean(f);
    if (f) {
      group.current.position.set(f.x, 0.8, f.z);
      group.current.rotation.z = reduced ? 0 : -f.vx * 0.06;
    }
  }, -1);
  return (
    <group ref={group} name={`arcade-foe-${id}`} position={[foe.x, 0.8, foe.z]}>
      <Block size={[1.4, 0.36, 0.78]} color={foe.revealed ? TOY.channels[card[2]]! : TOY.cream} />
      <Ball position={[-0.48, -0.16, 0.18]} size={[0.14, 0.12, 0.14]} color={TOY.bark} />
      <Ball position={[0.48, -0.16, 0.18]} size={[0.14, 0.12, 0.14]} color={TOY.bark} />
      {foe.diving ? <Star scale={0.17} /> : null}
    </group>
  );
}
function TargetLabels({
  session,
  snapshot,
  locale,
}: Pick<SceneProps, "session" | "snapshot" | "locale">) {
  const { camera, size } = useThree();
  const labels = useRef(new Map<number, HTMLDivElement>());
  const leaders = useRef(new Map<number, SVGLineElement>());
  const projection = useRef(new THREE.Vector3());
  useFrame(() => {
    const state = session.getState();
    const items = state.enemies.flatMap((f) => {
      const label = labels.current.get(f.id);
      if (!label || !label.offsetWidth) return [];
      const p = projection.current.set(f.x, 0.95, f.z).project(camera);
      return [
        {
          id: f.id,
          targetX: ((p.x + 1) * size.width) / 2,
          targetY: ((1 - p.y) * size.height) / 2,
          width: label.offsetWidth,
          height: label.offsetHeight,
          priority: f.z,
        },
      ];
    });
    for (const [id, node] of labels.current) {
      if (!state.enemies.some((f) => f.id === id)) {
        node.style.visibility = "hidden";
        leaders.current.get(id)?.setAttribute("visibility", "hidden");
      }
    }
    for (const item of layoutTargetLabels(items, size.width, size.height)) {
      const label = labels.current.get(item.id)!;
      label.style.visibility = "visible";
      label.style.transform = `translate3d(${item.x}px,${item.y}px,0)`;
      const line = leaders.current.get(item.id);
      if (line) {
        line.setAttribute("x1", String(item.targetX));
        line.setAttribute("y1", String(item.targetY));
        line.setAttribute("x2", String(item.x + item.width / 2));
        line.setAttribute("y2", String(item.y + item.height));
        line.setAttribute("visibility", "visible");
      }
    }
  }, -1);
  return (
    <Html
      fullscreen
      calculatePosition={(_object, _camera, viewport) => [viewport.width / 2, viewport.height / 2]}
      zIndexRange={[5, 0]}
      style={{ pointerEvents: "none" }}
    >
      <svg
        className="arcade3d__label-leaders"
        width={size.width}
        height={size.height}
        aria-hidden="true"
      >
        {snapshot.enemies.map((f) => (
          <line
            key={f.id}
            ref={(node) => {
              if (node) leaders.current.set(f.id, node);
              else leaders.current.delete(f.id);
            }}
          />
        ))}
      </svg>
      {snapshot.enemies.map((f) => {
        const card = FLIGHT_CARDS[f.card]!;
        return (
          <div
            key={f.id}
            ref={(node) => {
              if (node) labels.current.set(f.id, node);
              else labels.current.delete(f.id);
            }}
            className="arcade3d__foe-label arcade3d__foe-label--tracked"
            data-foe-id={f.id}
            data-diving={f.diving}
          >
            {locale === "en" ? card[1] : card[0]}
            {f.revealed ? <small>{word(CATEGORIES[card[2]]!, locale)}</small> : null}
          </div>
        );
      })}
    </Html>
  );
}
function Flight({ session, snapshot, locale, act, frozen }: SceneProps) {
  const ship = useRef<THREE.Group>(null);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8));
  const point = useRef(new THREE.Vector3());
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (frozen || snapshot.phase !== "playing") return;
    event.stopPropagation();
    if (event.ray.intersectPlane(plane.current, point.current))
      act({ type: "aim", x: point.current.x });
  };
  useFrame(() => {
    if (ship.current) ship.current.position.x = session.getState().shipX;
  }, -1);
  return (
    <group name="arcade-flight">
      <Block position={[0, 0.23, -0.2]} size={[8.8, 0.2, 7.7]} color={TOY.water} />
      {[-4.4, 4.4].map((x) => (
        <Block key={x} position={[x, 0.4, -0.2]} size={[0.13, 0.2, 7.7]} color={TOY.cream} />
      ))}
      {[0, 1].map((i) => (
        <Block
          key={i}
          position={[(i ? 1 : -1) * 2.15, 0.4, 3.3]}
          size={[4.18, 0.15, 0.65]}
          color={TOY.channels[i]!}
        />
      ))}
      <mesh
        name="arcade-flight-input"
        rotation-x={-Math.PI / 2}
        position={[0, 0.42, -0.2]}
        onPointerMove={move}
        onPointerDown={(e) => {
          move(e);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => (e.target as HTMLElement).releasePointerCapture(e.pointerId)}
      >
        <planeGeometry args={[9, 8.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <group ref={ship} position={[snapshot.shipX, 0.8, 3.35]} name="arcade-player">
        <Aircraft tool={snapshot.shipX < 0 ? 0 : 1} />
      </group>
      <Shots session={session} />
      {snapshot.enemies.map((f) => (
        <FoeView key={f.id} foe={f} session={session} />
      ))}
      <TargetLabels session={session} snapshot={snapshot} locale={locale} />
    </group>
  );
}
function FallingParcel({ session, locale }: { session: ArcadeSession; locale: ToyLocale }) {
  const group = useRef<THREE.Group>(null);
  const s = session.getState();
  const card = s.falling ? CLAIMS[s.falling.card]! : null;
  useFrame(() => {
    const state = session.getState();
    if (!group.current) return;
    group.current.visible = Boolean(state.falling);
    group.current.position.set((state.lane - 1) * 2.7, state.falling?.y ?? 6, 0.5);
  }, -1);
  return (
    <group ref={group} name="arcade-falling-parcel">
      <Parcel />
      {card ? (
        <Html center position={[0, 0.85, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div className="arcade3d__fall-label">{word(card.prompt, locale)}</div>
        </Html>
      ) : null}
    </group>
  );
}
function Stack({ session, snapshot, locale, act, frozen }: SceneProps) {
  return (
    <group name="arcade-stack">
      {[0, 1, 2].map((i) => (
        <group key={i} position={[(i - 1) * 2.7, 0.14, 0.5]}>
          <Socket index={i} color={TOY.channels[i]!} active={snapshot.lane === i} />
          <Block position={[0, 3.1, -1]} size={[0.06, 5.8, 0.06]} color={TOY.cream} />
          {[0, 1, 2, 3].map((k) => (
            <Block
              key={k}
              position={[0, 0.8 + k * 0.7, -1]}
              size={[0.38, 0.06, 0.09]}
              color={TOY.channels[i]!}
            />
          ))}
          {snapshot.piles[i]!.map((card, k) => (
            <group key={k} position={[0, 0.75 + k * 0.7, 0]} name={`arcade-stack-brick-${i}-${k}`}>
              <Parcel color={TOY.coral} />
              <Disc position={[0.2, 0.36, 0]} radius={0.09} height={0.025} color={TOY.cream} />
            </group>
          ))}
          <Html position={[0, 0.3, 1.7]} center zIndexRange={[5, 0]}>
            <GameButton
              static
              sound={false}
              variant="secondary"
              className="arcade3d__lane-label"
              disabled={frozen || snapshot.phase !== "playing"}
              aria-pressed={snapshot.lane === i}
              onClick={() => act({ type: "lane", index: i })}
            >
              {word(CATEGORIES[i]!, locale)}
            </GameButton>
          </Html>
        </group>
      ))}
      <FallingParcel session={session} locale={locale} />
    </group>
  );
}
function RackRow({
  position,
  children,
  name,
}: {
  position: [number, number, number];
  children: ReactNode;
  name: string;
}) {
  const node = useRef<THREE.Group>(null);
  const start = useRef<[number, number, number]>([position[0], position[1] - 0.6, position[2]]);
  const reduced = usePrefersReducedMotion();
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    if (!node.current) return;
    const alpha = reduced ? 1 : 1 - Math.exp(-dt * 12);
    node.current.position.y += (position[1] - node.current.position.y) * alpha;
    node.current.quaternion.copy(camera.quaternion);
  }, -1);
  return (
    <group ref={node} position={start.current} name={name}>
      {children}
    </group>
  );
}
function WordsScene({ session, snapshot, locale, act, frozen }: SceneProps) {
  const { size, camera, gl } = useThree();
  // A vertical toy rack has a readable screen-space spacing contract. Project
  // those centers onto its z=0 plane; actual shelves AND their DOM labels move
  // together. A narrow canvas must not squeeze 80px sentences into 20px gaps.
  const rackPoint = (pixelY: number): [number, number, number] => {
    const ray = new THREE.Vector3(0, 1 - (2 * pixelY) / size.height, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    const position = camera.position.clone().addScaledVector(ray, (3 - camera.position.z) / ray.z);
    return [0, position.y, 3];
  };
  const spacing = size.width < 620 ? 105 : 76;
  const rowPositions = snapshot.rows.map((_, i) =>
    rackPoint(size.height - 180 - (snapshot.rows.length - 1 - i + snapshot.junk * 0.5) * spacing),
  );
  const rackTop = Math.max(3.5, rackPoint(62)[1]);
  const rackBottom = 0.3;
  const drag = useRef<{ word: number; pointer: number; x: number; y: number } | null>(null);
  const [heldWord, setHeldWord] = useState<number | null>(null);
  const heldPoint = useRef<[number, number]>([0, 0]);
  const tokenGroups = useRef(new Map<number, THREE.Group>());
  const point = useRef(new THREE.Vector3());
  const enabled = !frozen && snapshot.phase === "playing";
  useFrame(() => {
    // The inventory chips are genuine lit meshes in a camera-facing foreground
    // plane. DOM supplies their words/semantics; the mesh and label share the
    // same 3-column screen datums, including after a camera or viewport change.
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 34;
    const halfHeight = Math.tan((fov * Math.PI) / 360) * 5;
    const unit = (halfHeight * 2) / size.height;
    const cellWidth = (size.width - 42) / 3;
    session.getState().bag.forEach((w, i) => {
      const node = tokenGroups.current.get(w);
      if (!node) return;
      const px =
        drag.current?.word === w
          ? heldPoint.current[0]
          : 12 + cellWidth / 2 + (i % 3) * (cellWidth + 9);
      const py =
        drag.current?.word === w
          ? heldPoint.current[1]
          : size.height - 12 - 54 * 2 - 9 + 27 + Math.floor(i / 3) * 63;
      point.current
        .set((px - size.width / 2) * unit, (size.height / 2 - py) * unit, -5)
        .applyQuaternion(camera.quaternion)
        .add(camera.position);
      node.position.copy(point.current);
      node.quaternion.copy(camera.quaternion);
      node.scale.set(cellWidth * unit, 54 * unit, 1);
    });
  }, -1);
  const resetToken = () => {
    const held = drag.current;
    if (!held) return;
    drag.current = null;
    setHeldWord(null);
  };
  useEffect(() => {
    if (!enabled) resetToken();
    const move = (e: PointerEvent) => {
      if (!drag.current || e.pointerId !== drag.current.pointer || !enabled) return;
      const r = gl.domElement.getBoundingClientRect();
      heldPoint.current = [e.clientX - r.left, e.clientY - r.top];
    };
    const up = (e: PointerEvent) => {
      const held = drag.current;
      if (!held || e.pointerId !== held.pointer) return;
      if (
        e.type !== "pointercancel" &&
        enabled &&
        Math.hypot(e.clientX - held.x, e.clientY - held.y) > 8
      ) {
        // Each target has a real DOM label over its physical board. Both X and Y
        // must hit this specific row; the old prototype's x-only drop is not copied.
        const target = document
          .elementsFromPoint(e.clientX, e.clientY)
          .map((el) => el.closest<HTMLElement>("[data-arcade-row]"))
          .find(Boolean);
        if (target && gl.domElement.closest(".arcade3d")?.contains(target))
          act({ type: "fit", rowId: Number(target.dataset.arcadeRow), word: held.word });
      }
      resetToken();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      resetToken();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [enabled, session, act, gl, camera]);
  const grab = (
    wordId: number,
    e: {
      pointerId: number;
      clientX: number;
      clientY: number;
      preventDefault?: () => void;
      stopPropagation: () => void;
    },
  ) => {
    if (!enabled) return;
    e.preventDefault?.();
    e.stopPropagation();
    drag.current = { word: wordId, pointer: e.pointerId, x: e.clientX, y: e.clientY };
    const rect = gl.domElement.getBoundingClientRect();
    heldPoint.current = [e.clientX - rect.left, e.clientY - rect.top];
    setHeldWord(wordId);
    act({ type: "word", index: wordId });
  };
  return (
    <group name="arcade-word-well">
      <Block position={[0, 0.28, 2.5]} size={[8.6, 0.28, 2.4]} color={TOY.bark} />
      {[-4.25, 4.25].map((x) => (
        <Block
          key={x}
          position={[x, (rackTop + rackBottom) / 2, 2.4]}
          size={[0.16, rackTop - rackBottom, 0.25]}
          color={TOY.cream}
        />
      ))}
      <Block position={[0, rackTop, 2.4]} size={[8.5, 0.1, 0.15]} color={TOY.coral} />
      {Array.from({ length: Math.min(snapshot.junk, 8) }, (_, i) => (
        <Block
          key={i}
          position={[4.6, 0.55 + i * 0.36, 2.8]}
          size={[0.72, 0.34, 0.7]}
          color={TOY.coral}
        />
      ))}
      {snapshot.rows.map((r, i) => {
        const card = SENTENCES[r.card]!;
        const content = word(card.text, locale).split("____");
        const p = rowPositions[i]!;
        const center = new THREE.Vector3(...p).project(camera);
        const right = new THREE.Vector3(p[0] + 1, p[1], p[2]).project(camera);
        const pixelsPerUnit = Math.max(1, ((right.x - center.x) * size.width) / 2);
        const labelWidth = Math.min(size.width * 0.8, 430);
        const width = (labelWidth + 18) / pixelsPerUnit;
        const height = (spacing - 8) / pixelsPerUnit;
        return (
          <RackRow key={r.id} position={p} name={`arcade-row-${r.id}`}>
            <Block size={[width + 0.16, height + 0.12, 0.32]} color={TOY.bark} />
            <Block
              position={[0, 0, 0.18]}
              size={[width, height, 0.22]}
              color={r.filled ? TOY.gold : TOY.cream}
            />
            <Html position={[0, 0, 0.32]} center zIndexRange={[5, 0]}>
              <div
                className="arcade3d__sentence"
                style={{ width: labelWidth }}
                data-arcade-row={r.id}
                data-filled={r.filled}
              >
                <span>{content[0]}</span>
                <button
                  type="button"
                  disabled={!enabled || r.filled || snapshot.selectedWord === null}
                  onClick={() => act({ type: "fit", rowId: r.id })}
                  data-testid={`arcade-gap-${r.id}`}
                  aria-label={word(card.text, locale)}
                >
                  {r.filled ? word(card.answer, locale) : "⋯"}
                </button>
                <span>{content[1]}</span>
              </div>
            </Html>
          </RackRow>
        );
      })}
      {snapshot.bag.map((w, i) => (
        <group
          key={`${i}:${w}`}
          ref={(node) => {
            if (node) tokenGroups.current.set(w, node);
            else tokenGroups.current.delete(w);
          }}
          name={`arcade-word-${w}`}
        >
          <group onPointerDown={(e) => grab(w, e)}>
            <Block position={[0, 0, -0.05]} size={[1.02, 1.04, 0.16]} color={TOY.bark} />
            <Block size={[1, 1, 0.16]} color={snapshot.selectedWord === w ? TOY.gold : TOY.cream} />
          </group>
          {heldWord === w ? (
            <Html
              center
              position={[0, 0, 0.16]}
              zIndexRange={[9, 0]}
              style={{ pointerEvents: "none" }}
            >
              <span className="arcade3d__drag-word">{word(VOCABULARY[w]!, locale)}</span>
            </Html>
          ) : null}
        </group>
      ))}
      <Html
        fullscreen
        calculatePosition={(_object, _camera, viewport) => [
          viewport.width / 2,
          viewport.height / 2,
        ]}
        zIndexRange={[6, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="arcade3d__word-tray">
          {snapshot.bag.map((w, i) => (
            <GameButton
              key={`${i}:${w}`}
              static
              sound={false}
              variant="secondary"
              className="arcade3d__word"
              disabled={!enabled}
              aria-pressed={snapshot.selectedWord === w}
              data-testid={`arcade-word-${w}`}
              onPointerDown={(e) => grab(w, e)}
              onClick={() => act({ type: "word", index: w })}
            >
              <span aria-hidden="true">{i + 1} · </span>
              {word(VOCABULARY[w]!, locale)}
            </GameButton>
          ))}
        </div>
      </Html>
    </group>
  );
}
function Sparks({ session, snapshot }: Pick<SceneProps, "session" | "snapshot">) {
  const groups = useRef(new Map<number, THREE.Group>());
  const reduced = usePrefersReducedMotion();
  useFrame(() => {
    for (const [id, node] of groups.current) {
      const spark = session.getState().sparks.find((p) => p.id === id);
      node.visible = Boolean(spark) && !reduced;
      if (!spark) continue;
      node.children.forEach((child, i) => {
        const a = (i / 3) * Math.PI * 2;
        child.position.set(Math.cos(a) * spark.age, spark.age * 1.7, Math.sin(a) * spark.age);
        child.scale.setScalar(Math.max(0.01, 1 - spark.age));
      });
    }
  }, -1);
  return (
    <group name="arcade-hit-feedback">
      {snapshot.sparks.map((p) => (
        <group
          key={p.id}
          ref={(node) => {
            if (node) groups.current.set(p.id, node);
            else groups.current.delete(p.id);
          }}
          position={[p.x, p.y, p.z]}
        >
          {[0, 1, 2].map((i) => (
            <group key={i}>
              {p.good ? (
                <Star scale={0.2} />
              ) : (
                <Block size={[0.14, 0.14, 0.14]} color={TOY.coral} />
              )}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
export function ArcadeScene(props: SceneProps) {
  return (
    <Boundary fail={props.onFailure}>
      <Stage
        cameraFrom={[0, 12.8, 17.5]}
        lookAt={[0, 1.1, 0.15]}
        cameraFar={160}
        paused={props.frozen && !props.booting}
        onSceneReady={props.onReady}
        onRendererUnavailable={props.onFailure}
        onContextLost={props.onFailure}
        postProcessing={
          !(import.meta.env.DEV && new URLSearchParams(location.search).get("toy-post") === "off")
        }
      >
        <color attach="background" args={[TOY.sky]} />
        <CameraAndClock session={props.session} frozen={props.frozen} />
        <group scale={[1.22, 1, 1.15]}>
          <ToyGarden />
        </group>
        {props.snapshot.mode === "invaders" ? (
          <Flight {...props} />
        ) : props.snapshot.mode === "stack" ? (
          <Stack {...props} />
        ) : (
          <WordsScene {...props} />
        )}
        <Sparks session={props.session} snapshot={props.snapshot} />
      </Stage>
    </Boundary>
  );
}
