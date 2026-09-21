import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { Stage } from "../Stage.js";
import { Ball, Block, Disc, ToyLighting, wax } from "./parts.js";
import { TOY } from "./style.js";
import { boardPoint } from "./board-projection.js";
import { layoutTargetLabels } from "./label-layout.js";
import { CATEGORIES, word, type ToyLocale } from "./material.js";
import { CLAIMS } from "./arcade-content.js";
import {
  PROCESS_TASKS,
  WIRING_ROUNDS,
  WorkshopSession,
  type WorkshopState,
  type WorkshopAction,
  type Capsule,
} from "./workshop-engine.js";
import { assertEveryThreeGameIsRendered } from "./three-game-lock.js";

interface Props {
  session: WorkshopSession;
  snapshot: WorkshopState;
  locale: ToyLocale;
  frozen: boolean;
  ready: boolean;
  onReady: () => void;
  onFailure: () => void;
  act: (action: WorkshopAction) => void;
}
type V3 = [number, number, number];
class SceneBoundary extends Component<
  { children: ReactNode; fail: () => void },
  { failed: boolean }
> {
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
function Clock({ session, frozen }: Pick<Props, "session" | "frozen">) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (session.mode === "slice") {
      camera.position.set(0, 7.2, Math.max(18, (18 * 0.72) / (size.width / size.height)));
      camera.lookAt(0, 2.7, 0);
    } else {
      camera.position.set(0, 5, 20);
      camera.lookAt(0, 1.5, 0);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, size.width, size.height, session.mode]);
  useFrame((_, dt) => {
    if (!frozen) session.advance(dt);
  }, -2);
  return null;
}

/** Pixel-sized semantic faces on actual lit meshes, not a painted screenshot. */
function useBoardProjection() {
  const { camera, size } = useThree();
  const project = (x: number, y: number, z = 0): V3 =>
    boardPoint(camera, size.width, size.height, x, y, z);
  const a = project(0, size.height / 2),
    b = project(100, size.height / 2);
  return { camera, size, project, unit: (b[0] - a[0]) / 100 };
}
function Face({
  at,
  width,
  height,
  color = TOY.cream,
  children,
  name,
}: {
  at: V3;
  width: number;
  height: number;
  color?: number;
  children?: ReactNode;
  name: string;
}) {
  const { camera } = useThree();
  const node = useRef<THREE.Group>(null);
  useFrame(() => {
    node.current?.quaternion.copy(camera.quaternion);
  }, -1);
  return (
    <group ref={node} position={at} quaternion={camera.quaternion.clone()} name={name}>
      <Block position={[0, 0, -0.12]} size={[width + 0.12, height + 0.12, 0.36]} color={TOY.bark} />
      <Block size={[width, height, 0.28]} color={color} />
      {children ? (
        <Html center position={[0, 0, 0.2]} zIndexRange={[5, 0]}>
          {children}
        </Html>
      ) : null}
    </group>
  );
}

function Cable({ from, to, color, active }: { from: V3; to: V3; color: number; active: boolean }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(...from),
      new THREE.Vector3(from[0] + 1, from[1], 1.2),
      new THREE.Vector3(to[0] - 1, to[1], 1.2),
      new THREE.Vector3(...to),
    );
    return new THREE.TubeGeometry(curve, 28, 0.06, 6, false);
  }, [...from, ...to]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} material={wax(active ? TOY.gold : color)} castShadow dispose={null} />
  );
}
function Wiring({ session, snapshot: s, locale, act, frozen }: Props) {
  const gl = useThree((state) => state.gl);
  const { size, project, unit, camera } = useBoardProjection();
  const cards = WIRING_ROUNDS[s.round]!;
  const left = size.width * 0.24,
    right = size.width * 0.81;
  const ys = cards.map((_, i) => 115 + i * 107);
  const outYs = [159, 290, 421];
  const faceWidth = Math.min(175, size.width * 0.42);
  const from = (i: number) => project(left + faceWidth / 2 + 6, ys[i]!);
  const to = (i: number) => project(right - 25, outYs[i]!);
  const active = s.phase === "running" || s.phase === "round" || s.phase === "won";
  const held = useRef<{ source: number; pointer: number; x: number; y: number } | null>(null);
  const [loose, setLoose] = useState<V3 | null>(null);
  const enabled = !frozen && s.phase === "playing";
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!held.current || e.pointerId !== held.current.pointer || !enabled) return;
      const root = gl.domElement.getBoundingClientRect();
      setLoose(project(e.clientX - root.x, e.clientY - root.y, 0.5));
    };
    const end = (e: PointerEvent) => {
      const h = held.current;
      if (!h || e.pointerId !== h.pointer) return;
      if (
        enabled &&
        e.type !== "pointercancel" &&
        Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8
      ) {
        const target = document
          .elementsFromPoint(e.clientX, e.clientY)
          .map((el) => el.closest<HTMLElement>("[data-wire-target]"))
          .find(Boolean);
        if (target && gl.domElement.closest(".workshop")?.contains(target))
          act({ type: "connect", index: Number(target.dataset.wireTarget) });
      }
      held.current = null;
      setLoose(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    if (!enabled) {
      held.current = null;
      setLoose(null);
    }
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [enabled, act, camera, gl, size.width, size.height]);
  return (
    <group name="scene-evidence-wiring">
      <Face
        at={project(size.width / 2, 295, -0.6)}
        width={(size.width - 22) * unit}
        height={520 * unit}
        color={0x84b7b1}
        name="wire-case"
      />
      <Face
        at={project(size.width / 2, 64)}
        width={(size.width - 64) * unit}
        height={35 * unit}
        color={0x355a61}
        name="wire-instrument-header"
      />
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          position={project(size.width / 2 - 25 + i * 25, 64, 0.2)}
          quaternion={camera.quaternion}
        >
          <Ball
            position={[0, 0, 0]}
            size={[0.1, 0.1, 0.08]}
            color={active ? TOY.gold : TOY.cream}
          />
        </group>
      ))}
      {cards.map((card, i) => (
        <group key={i}>
          <Face
            at={project(left, ys[i]!)}
            width={faceWidth * unit}
            height={78 * unit}
            name={`wire-claim-${i}`}
            color={s.selected === i ? TOY.gold : TOY.cream}
          >
            <GameButton
              static
              sound={false}
              className="workshop__face-button"
              style={{ width: faceWidth - 8, minHeight: 65 }}
              disabled={frozen || s.phase !== "playing"}
              aria-pressed={s.selected === i}
              onClick={() => act({ type: "pick", index: i })}
              onPointerDown={(e) => {
                if (!enabled) return;
                held.current = { source: i, pointer: e.pointerId, x: e.clientX, y: e.clientY };
                act({ type: "pick", index: i });
              }}
              data-testid={`wire-source-${i}`}
            >
              {word(CLAIMS[card]!.prompt, locale)}
            </GameButton>
          </Face>
          <group position={from(i)} quaternion={camera.quaternion}>
            <Ball
              position={[0, 0, 0]}
              size={[0.16, 0.16, 0.11]}
              color={[TOY.coral, TOY.blue, TOY.gold, TOY.mint][i]!}
            />
          </group>
          {s.links[i]! >= 0 ? (
            <Cable
              from={from(i)}
              to={to(s.links[i]!)}
              color={[TOY.coral, TOY.blue, TOY.gold, TOY.mint][i]!}
              active={active}
            />
          ) : null}
        </group>
      ))}
      {CATEGORIES.map((c, i) => (
        <group key={i}>
          <Face
            at={project(right, outYs[i]!)}
            width={Math.min(94, size.width * 0.23) * unit}
            height={65 * unit}
            name={`wire-socket-${i}`}
            color={TOY.cream}
          >
            <GameButton
              static
              sound={false}
              className="workshop__face-button"
              style={{ width: Math.min(90, size.width * 0.23), minHeight: 58 }}
              disabled={frozen || s.phase !== "playing" || s.selected === null}
              onClick={() => act({ type: "connect", index: i })}
              data-testid={`wire-target-${i}`}
              data-wire-target={i}
            >
              {word(c, locale)}
            </GameButton>
          </Face>
          <group position={to(i)} quaternion={camera.quaternion}>
            <Ball position={[0, 0, 0]} size={[0.14, 0.14, 0.1]} color={TOY.ink} />
          </group>
        </group>
      ))}
      {s.checked
        ? cards.map((c, i) => (
            <group
              key={i}
              position={project(left + faceWidth / 2 - 8, ys[i]! - 30, 0.4)}
              quaternion={camera.quaternion}
            >
              <Ball
                position={[0, 0, 0]}
                size={[0.1, 0.1, 0.08]}
                color={s.links[i] === CLAIMS[c]!.answer ? TOY.mint : TOY.coral}
              />
            </group>
          ))
        : null}
      <Html center position={project(size.width / 2, 528, 0.5)} zIndexRange={[5, 0]}>
        <span className="workshop__small-caption">
          {locale === "en" ? "Connect claims to checking methods" : "把说法接到对应的核对方法"}
        </span>
      </Html>
      <SignalPulse session={session} project={project} />
      {loose && held.current ? (
        <Cable from={from(held.current.source)} to={loose} color={TOY.gold} active={false} />
      ) : null}
    </group>
  );
}
function SignalPulse({
  session,
  project,
}: {
  session: WorkshopSession;
  project: (x: number, y: number, z?: number) => V3;
}) {
  const light = useRef<THREE.Group>(null);
  const { size } = useThree();
  useFrame(() => {
    if (!light.current) return;
    const s = session.getState();
    light.current.visible = s.phase === "running";
    light.current.position.set(
      ...project(size.width * 0.43 + (Math.sin(s.elapsed * 8) + 1) * size.width * 0.1, 530, 0.8),
    );
  }, -1);
  return (
    <group ref={light}>
      <Ball position={[0, 0, 0]} size={[0.12, 0.12, 0.12]} color={TOY.gold} />
    </group>
  );
}

function Locomotive() {
  return (
    <group>
      <Block size={[1.15, 0.7, 1.5]} color={TOY.coral} />
      <Block position={[0, 0.55, -0.32]} size={[0.95, 0.7, 0.65]} color={TOY.blue} />
      <Block position={[0, 0.9, -0.32]} size={[1.2, 0.16, 0.9]} color={TOY.cream} />
      <Ball position={[0, 0.3, 0.63]} size={[0.35, 0.3, 0.12]} color={TOY.gold} />
      {[-0.62, 0.62].flatMap((x) =>
        [-0.5, 0.5].map((z) => (
          <group key={`${x}:${z}`} position={[x, -0.3, z]} rotation-z={Math.PI / 2}>
            <Disc position={[0, 0, 0]} radius={0.26} height={0.15} color={TOY.ink} />
          </group>
        )),
      )}
    </group>
  );
}
function Railway({ session, snapshot: s, locale, act, frozen }: Props) {
  const { size, project, unit, camera } = useBoardProjection();
  const engine = useRef<THREE.Group>(null);
  const x = size.width * 0.55;
  const width = Math.min(340, size.width * 0.69);
  const ys = [169, 273, 377, 481];
  useFrame((_, dt) => {
    if (!engine.current) return;
    const st = session.getState();
    const p = project(size.width * 0.12, st.train < 0 ? 74 : ys[st.train]!, 1.1);
    engine.current.position.lerp(new THREE.Vector3(...p), 1 - Math.exp(-dt * 10));
  }, -1);
  return (
    <group name="scene-process-railway">
      <Face
        at={project(x, 295, -0.7)}
        width={width * 1.13 * unit}
        height={535 * unit}
        color={0x819d9d}
        name="railway-depot-base"
      />
      <Face
        at={project(size.width * 0.12, 295, -0.7)}
        width={Math.min(85, size.width * 0.16) * unit}
        height={510 * unit}
        color={TOY.cream}
        name="locomotive-track"
      />
      {[-1, 1].map((side) => (
        <Face
          key={side}
          at={project(size.width * 0.12 + side * 12, 295, -0.25)}
          width={0.04}
          height={490 * unit}
          color={TOY.blue}
          name={`locomotive-rail-${side}`}
        />
      ))}
      {[x - width * 0.29, x + width * 0.29].map((rx, i) => (
        <Face
          key={i}
          at={project(rx, 301, -0.1)}
          width={0.055}
          height={490 * unit}
          color={TOY.cream}
          name={`rail-${i}`}
        />
      ))}
      {Array.from({ length: 15 }, (_, i) => (
        <Face
          key={i}
          at={project(x, 92 + i * 29, -0.15)}
          width={width * 0.8 * unit}
          height={9 * unit}
          color={0x71888b}
          name={`sleeper-${i}`}
        />
      ))}
      <group
        ref={engine}
        position={project(size.width * 0.12, 74, 1.1)}
        rotation={[0.5, 0, 0]}
        scale={unit * 34}
        name="process-locomotive"
      >
        <Locomotive />
      </group>
      {s.order.map((id, i) => {
        const success =
          (s.phase === "running" && i <= s.train) || s.phase === "round" || s.phase === "won";
        return (
          <group key={`${i}:${id}`}>
            <Face
              at={project(x, ys[i]!)}
              width={width * unit}
              height={81 * unit}
              color={success ? TOY.mint : s.selected === i ? TOY.gold : TOY.cream}
              name={`process-car-${i}`}
            >
              <GameButton
                static
                sound={false}
                className="workshop__face-button"
                style={{ width: width - 12, minHeight: 70 }}
                disabled={frozen || s.phase !== "playing"}
                aria-pressed={s.selected === i}
                onClick={() => act({ type: "swap", index: i })}
                data-testid={`train-car-${i}`}
              >
                <span>
                  {i + 1} · {word(PROCESS_TASKS[s.round]!.steps[id]!.text, locale)}
                </span>
              </GameButton>
            </Face>
            {[-1, 1].flatMap((side) =>
              [-1, 1].map((end) => (
                <group
                  key={`${side}:${end}`}
                  position={project(x + side * (width / 2 + 4), ys[i]! + end * 24, -0.02)}
                  quaternion={camera.quaternion.clone()}
                >
                  <Ball position={[0, 0, 0]} size={[unit * 8, unit * 11, 0.14]} color={TOY.ink} />
                  <Ball
                    position={[0, 0, 0.13]}
                    size={[unit * 3, unit * 4, 0.045]}
                    color={TOY.gold}
                  />
                </group>
              )),
            )}
            {i < 3 ? (
              <Face
                at={project(x, ys[i]! + 52, -0.02)}
                width={unit * 15}
                height={unit * 22}
                color={TOY.coral}
                name={`coupler-${i}`}
              />
            ) : null}
          </group>
        );
      })}
      <Html center position={project(x, 68, 0.4)} zIndexRange={[5, 0]}>
        <span className="workshop__station-title">
          {word(PROCESS_TASKS[s.round]!.title, locale)}
        </span>
      </Html>
      <Html center position={project(size.width / 2, 582, 0.4)} zIndexRange={[5, 0]}>
        <span className="workshop__small-caption">
          {locale === "en" ? "Select two cars to swap their places" : "点两节车厢，交换它们的位置"}
        </span>
      </Html>
    </group>
  );
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay,
    d = dx * dx + dy * dy;
  const t = d ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / d)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function FlyingCapsule({ capsule: c, session }: { capsule: Capsule; session: WorkshopSession }) {
  const group = useRef<THREE.Group>(null);
  const halves = useRef<THREE.Group>(null);
  useFrame(() => {
    const current = session.getState().capsules.find((f) => f.id === c.id);
    if (!group.current) return;
    group.current.visible = Boolean(current);
    if (!current) return;
    group.current.position.set(current.x, current.y, 0);
    if (halves.current)
      halves.current.children.forEach((n, i) => {
        const t = current.cutAt === null ? 0 : session.getState().elapsed - current.cutAt;
        n.position.x = (i ? 1 : -1) * t * 2.2;
        n.rotation.z = (i ? 1 : -1) * t;
        n.position.y = -t * t * 2;
      });
  }, -1);
  return (
    <group ref={group} position={[c.x, c.y, 0]} name={`slice-capsule-${c.id}`}>
      <group ref={halves}>
        {[-1, 1].map((side, i) => (
          <group key={side}>
            <Block position={[side * 0.35, 0, 0]} size={[0.68, 0.72, 0.67]} color={TOY.coral} />
            <Block position={[side * 0.35, 0, 0.38]} size={[0.66, 0.66, 0.11]} color={TOY.cream} />
            <Ball position={[side * 0.64, 0, 0]} size={[0.16, 0.33, 0.29]} color={TOY.coral} />
            <Disc
              position={[side * 0.32, 0.4, 0]}
              radius={0.1}
              height={0.07}
              color={i ? TOY.gold : TOY.blue}
            />
          </group>
        ))}
      </group>
    </group>
  );
}
/** Reuse the flight game's measured label placement, not its scenery or rules.
 * Two ballistic capsules can cross at the same height on a 320px screen. */
function CapsuleLabels({
  session,
  snapshot,
  locale,
}: Pick<Props, "session" | "snapshot" | "locale">) {
  const { camera, size } = useThree();
  const labels = useRef(new Map<number, HTMLSpanElement>());
  const leaders = useRef(new Map<number, SVGLineElement>());
  const projection = useRef(new THREE.Vector3());
  useFrame(() => {
    const active = session.getState().capsules.filter((c) => c.cutAt === null);
    const items = active.flatMap((c) => {
      const label = labels.current.get(c.id);
      if (!label?.offsetWidth) return [];
      const p = projection.current.set(c.x, c.y + 0.18, 0.45).project(camera);
      return [
        {
          id: c.id,
          targetX: ((p.x + 1) * size.width) / 2,
          targetY: ((1 - p.y) * size.height) / 2,
          width: label.offsetWidth,
          height: label.offsetHeight,
          priority: c.age,
        },
      ];
    });
    for (const [id, label] of labels.current) {
      if (!active.some((c) => c.id === id)) {
        label.style.visibility = "hidden";
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
  const active = snapshot.capsules.filter((c) => c.cutAt === null);
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
        {active.map((c) => (
          <line
            key={c.id}
            data-capsule-leader={c.id}
            ref={(node) => {
              if (node) leaders.current.set(c.id, node);
              else leaders.current.delete(c.id);
            }}
          />
        ))}
      </svg>
      {active.map((c) => (
        <span
          key={c.id}
          data-capsule-id={c.id}
          className="workshop__capsule-label workshop__capsule-label--tracked"
          ref={(node) => {
            if (node) labels.current.set(c.id, node);
            else labels.current.delete(c.id);
          }}
        >
          {word(CLAIMS[c.card]!.prompt, locale)}
        </span>
      ))}
    </Html>
  );
}
type CutTrace = { a: THREE.Vector3; b: THREE.Vector3; born: number };
const traceGeometry = new THREE.SphereGeometry(1, 8, 6);
function CuttingTrail({
  segments,
  session,
}: {
  segments: RefObject<CutTrace[]>;
  session: WorkshopSession;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null),
    matrix = useRef(new THREE.Object3D());
  const up = useRef(new THREE.Vector3(0, 1, 0)),
    direction = useRef(new THREE.Vector3());
  useFrame(() => {
    if (!mesh.current) return;
    const active = segments.current
      .filter((p) => session.getState().elapsed - p.born < 0.45)
      .slice(-20);
    mesh.current.count = active.length;
    active.forEach((p, i) => {
      direction.current.subVectors(p.b, p.a);
      const len = direction.current.length();
      matrix.current.position.copy(p.a).lerp(p.b, 0.5);
      matrix.current.position.z = 0.6;
      matrix.current.quaternion.setFromUnitVectors(up.current, direction.current.normalize());
      matrix.current.scale.set(0.035, Math.max(0.02, len / 2), 0.035);
      matrix.current.updateMatrix();
      mesh.current!.setMatrixAt(i, matrix.current.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, -1);
  return (
    <instancedMesh
      ref={mesh}
      args={[traceGeometry, wax(TOY.gold), 20]}
      name="slice-gesture-trail"
      frustumCulled={false}
      dispose={null}
    />
  );
}
function Slicing({ session, snapshot: s, locale, act, frozen }: Props) {
  const last = useRef<THREE.Vector3 | null>(null);
  const segments = useRef<CutTrace[]>([]);
  const point = useRef(new THREE.Vector3());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const move = (e: ThreeEvent<PointerEvent>, start = false) => {
    if (frozen || s.phase !== "playing" || (!start && !last.current)) return;
    e.stopPropagation();
    if (!e.ray.intersectPlane(plane.current, point.current)) return;
    const a = last.current ?? point.current,
      b = point.current;
    if (a.distanceToSquared(b) > 0.0001) {
      segments.current.push({ a: a.clone(), b: b.clone(), born: session.getState().elapsed });
      segments.current = segments.current.slice(-20);
    }
    for (const c of session.getState().capsules)
      if (c.cutAt === null && segmentDistance(c.x, c.y, a.x, a.y, b.x, b.y) < 0.62)
        act({ type: "cut", id: c.id });
    last.current = point.current.clone();
  };
  useEffect(() => {
    if (frozen) last.current = null;
  }, [frozen]);
  return (
    <group name="scene-information-slice">
      <CapsuleLabels session={session} snapshot={s} locale={locale} />
      <CuttingTrail segments={segments} session={session} />
      <Block position={[0, -1.5, 0]} size={[8.5, 0.75, 3.3]} color={0x729c9b} />
      <Block position={[0, -1.04, 0]} size={[8.2, 0.16, 3.15]} color={TOY.cream} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.7, -0.8, 0]}>
          <Disc position={[0, 0, 0]} radius={0.78} height={0.35} color={TOY.coral} />
          <Disc position={[0, 0.19, 0]} radius={0.58} height={0.05} color={TOY.ink} />
          <Disc position={[0, 0.23, 0]} radius={0.43} height={0.04} color={TOY.blue} />
        </group>
      ))}
      <Block position={[0, -0.8, -1.2]} size={[8, 0.22, 0.24]} color={TOY.gold} />
      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, -0.7, 0]}>
          <Disc position={[0, 0, 0]} radius={0.25} height={0.5} color={TOY.blue} />
          <Ball position={[0, 0.35, 0]} size={[0.22, 0.22, 0.22]} color={TOY.gold} />
        </group>
      ))}
      {s.capsules.map((c) => (
        <FlyingCapsule key={c.id} capsule={c} session={session} />
      ))}
      <mesh
        position={[0, 3, 1]}
        onPointerDown={(e) => {
          move(e, true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => move(e)}
        onPointerUp={(e) => {
          last.current = null;
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          last.current = null;
        }}
      >
        <planeGeometry args={[10, 12]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
export function WorkshopScene(props: Props) {
  return (
    <SceneBoundary fail={props.onFailure}>
      <Stage
        cameraFrom={[0, 5, 20]}
        lookAt={[0, 1.5, 0]}
        cameraFar={160}
        paused={
          (props.frozen || !["playing", "running"].includes(props.snapshot.phase)) && props.ready
        }
        onSceneReady={props.onReady}
        onRendererUnavailable={props.onFailure}
        onContextLost={props.onFailure}
      >
        <color
          attach="background"
          args={[
            props.session.mode === "slice"
              ? 0xe2c9dc
              : props.session.mode === "rank"
                ? 0xd5e5e5
                : 0xc6ddd8,
          ]}
        />
        <ToyLighting />
        <Clock session={props.session} frozen={props.frozen} />
        {props.session.mode === "slice" ? (
          <Slicing {...props} />
        ) : props.session.mode === "wire" ? (
          <Wiring {...props} />
        ) : props.session.mode === "rank" ? (
          <Railway {...props} />
        ) : (
          // Was a bare `else`, which quietly drew the railway for anything it
          // did not recognise. See three-game-lock.ts.
          assertEveryThreeGameIsRendered(props.session.mode)
        )}
      </Stage>
    </SceneBoundary>
  );
}
