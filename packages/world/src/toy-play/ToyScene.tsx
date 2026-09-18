import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Ball, Block, Disc, Parcel, Socket, Star, ToyGarden, WordFrame } from "./parts.js";
import {
  CATEGORIES,
  toyDeck,
  word,
  type ToyEvent,
  type ToyLocale,
  type ToyState,
} from "./rules.js";
import { TOY } from "./style.js";

type Position = [number, number, number];
interface Props {
  state: ToyState;
  locale: ToyLocale;
  paused: boolean;
  interactive: boolean;
  timed: boolean;
  dispatch: (event: ToyEvent) => void;
  onReady: () => void;
  onFailure: () => void;
}
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Same camera/framing rule across the three samples, including portrait. */
function ToyCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const distance = Math.max(0.9, 0.95 / aspect);
    camera.position.set(7.6 * distance, 11.8 * distance, 17.6 * distance);
    camera.lookAt(0, 0.4, 0.7);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** Ground-plane drag on real geometry; tap and semantic DOM paths share resolve. */
function Movable({
  children,
  position,
  targets,
  onDrop,
  onSelect,
  enabled,
  settled,
  rejected,
  name,
}: {
  children: ReactNode;
  position: Position;
  targets: readonly Position[];
  onDrop: (index: number) => void;
  onSelect: () => void;
  enabled: boolean;
  settled: Position | null;
  rejected: boolean;
  name: string;
}) {
  const group = useRef<THREE.Group>(null);
  const drag = useRef(false);
  const pointer = useRef<number | null>(null);
  const started = useRef<[number, number]>([0, 0]);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.75));
  const point = useRef(new THREE.Vector3());
  const destination = useRef(new THREE.Vector3());
  const reduced = usePrefersReducedMotion();
  const time = useRef(0);
  useEffect(() => {
    time.current = 0;
  }, [rejected]);
  useEffect(() => {
    if (!enabled) drag.current = false;
  }, [enabled]);
  useFrame((_, dt) => {
    if (!group.current || drag.current) return;
    time.current += Math.min(dt, 0.05);
    const target = settled ?? position;
    const alpha = reduced ? 1 : 1 - Math.exp(-dt * 9);
    group.current.position.lerp(destination.current.set(...target), alpha);
    group.current.rotation.z =
      rejected && !reduced && time.current < 0.45 ? Math.sin(time.current * 30) * 0.06 : 0;
  });
  const down = (e: ThreeEvent<PointerEvent>) => {
    if (!enabled || drag.current) return;
    e.stopPropagation();
    started.current = [e.clientX, e.clientY];
    drag.current = true;
    pointer.current = e.pointerId;
    (e.target as HTMLElement | null)?.setPointerCapture(e.pointerId);
    onSelect();
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!enabled || !drag.current || pointer.current !== e.pointerId || !group.current) return;
    e.stopPropagation();
    if (e.ray.intersectPlane(plane.current, point.current)) {
      group.current.position.set(
        THREE.MathUtils.clamp(point.current.x, -4, 4),
        0.9,
        THREE.MathUtils.clamp(point.current.z, -2.8, 3.4),
      );
    }
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current || pointer.current !== e.pointerId) return;
    e.stopPropagation();
    drag.current = false;
    pointer.current = null;
    (e.target as HTMLElement | null)?.releasePointerCapture(e.pointerId);
    if (
      !enabled ||
      !group.current ||
      Math.hypot(e.clientX - started.current[0], e.clientY - started.current[1]) < 6
    )
      return;
    const p = group.current.position;
    const index = targets.findIndex((t) => Math.hypot(t[0] - p.x, t[2] - p.z) < 1.25);
    if (index >= 0) onDrop(index);
  };
  return (
    <group
      name={name}
      ref={group}
      position={position}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        drag.current = false;
        pointer.current = null;
      }}
    >
      {children}
    </group>
  );
}

function SceneLabel({
  children,
  position,
  onClick,
  disabled,
  selected,
  testId,
  compact,
}: {
  children: ReactNode;
  position: Position;
  onClick: () => void;
  disabled: boolean;
  selected?: boolean;
  testId?: string;
  compact?: string;
}) {
  const width = useThree((s) => s.size.width);
  const small = width < 620;
  return (
    <Html position={position} center zIndexRange={[8, 0]}>
      <GameButton
        static
        sound={false}
        variant={selected ? "primary" : "secondary"}
        className={`toy-label${small ? " toy-label--compact" : ""}`}
        disabled={disabled}
        aria-pressed={selected}
        onClick={onClick}
        data-testid={testId}
      >
        {small && compact ? (
          <>
            <span aria-hidden="true">{compact}</span>
            <span className="toy-label__accessible">{children}</span>
          </>
        ) : (
          children
        )}
      </GameButton>
    </Html>
  );
}

function SortingScene({ state, locale, interactive, dispatch }: Props) {
  const targets: Position[] = [
    [-3.2, 0.88, 1.8],
    [0, 0.88, 1.8],
    [3.2, 0.88, 1.8],
  ];
  const landed = state.phase === "feedback" && state.correct && state.lastChoice !== null;
  return (
    <group name="toy-sorting-workstation">
      <Block position={[0, 0.36, -0.5]} size={[1.7, 0.4, 2.1]} color={TOY.bark} />
      <Block position={[0, 0.58, -0.5]} size={[1.6, 0.12, 2.0]} color={TOY.cream} />
      <Movable
        name="toy-parcel"
        key={state.cursor}
        position={[0, 1.2, -0.65]}
        targets={targets}
        enabled={interactive}
        settled={landed ? targets[state.lastChoice!]! : null}
        rejected={state.phase === "feedback" && !state.correct}
        onSelect={() => dispatch({ type: "select", index: 0 })}
        onDrop={(index) => dispatch({ type: "submit", index })}
      >
        <Parcel selected={state.selected !== null && state.phase === "playing"} />
      </Movable>
      {targets.map(([x, , z], i) => (
        <group key={i} name={`toy-sort-target-${i}`} position={[x, 0.14, z]}>
          <Socket index={i} color={TOY.channels[i]!} active={landed && state.lastChoice === i} />
          {state.history
            .filter((a) => a === i)
            .slice(-3)
            .map((_, j) => (
              <Block
                key={j}
                position={[0, 0.55 + j * 0.23, -0.13]}
                size={[0.65, 0.21, 0.5]}
                color={TOY.channels[i]!}
              />
            ))}
          <SceneLabel
            position={[0, 0.33, 1.16]}
            disabled={!interactive}
            onClick={() => dispatch({ type: "submit", index: i })}
            testId={`toy-target-${i}`}
            compact={String(i + 1)}
          >
            {word(CATEGORIES[i]!, locale)}
          </SceneLabel>
        </group>
      ))}
    </group>
  );
}

function GateScene({ state, locale, interactive, timed, dispatch }: Props) {
  const passed = state.phase === "feedback" && state.correct && state.lastChoice !== null;
  const gateX = [-2.0, 2.0];
  const ship = useRef<THREE.Group>(null);
  const reduced = usePrefersReducedMotion();
  const animTime = useRef(0);
  const destination = useRef(new THREE.Vector3());
  const travel = useRef(0);
  useEffect(() => {
    travel.current = 0;
  }, [state.cursor, passed]);
  useFrame((_, dt) => {
    if (!ship.current) return;
    animTime.current += Math.min(dt, 0.05);
    travel.current = passed ? Math.min(1, travel.current + Math.min(dt, 0.05) * 0.8) : 0;
    const progress = reduced && passed ? 1 : travel.current;
    const turn = THREE.MathUtils.smoothstep(progress, 0, 0.48);
    const x = passed ? gateX[state.lastChoice!]! * turn : 0;
    const z = passed
      ? -0.15 + progress * 3.2
      : timed
        ? -2.4 + ((25 - state.seconds) / 25) * 2.3
        : -1.2;
    ship.current.position.lerp(
      destination.current.set(x, 0.52 + (reduced ? 0 : Math.sin(animTime.current * 2) * 0.05), z),
      reduced ? 1 : 1 - Math.exp(-dt * 4),
    );
    ship.current.rotation.z = reduced ? 0 : Math.sin(animTime.current * 2.4) * 0.025;
  });
  return (
    <group name="toy-evidence-gates">
      <Block position={[0, 0.18, -0.8]} size={[2.2, 0.12, 5.5]} color={TOY.water} />
      <Block position={[0, 0.18, 0.75]} size={[6.4, 0.12, 2.0]} color={TOY.water} />
      {gateX.map((x) => (
        <Block key={x} position={[x, 0.18, 2.0]} size={[1.95, 0.12, 3.3]} color={TOY.water} />
      ))}
      <group ref={ship} name="toy-boat" position={[0, 0.52, -1.2]}>
        <Block size={[1.1, 0.3, 1.65]} color={TOY.coral} />
        <Block position={[0, 0.26, -0.2]} size={[0.75, 0.3, 0.75]} color={TOY.cream} />
        <Block position={[0, 0.68, -0.45]} size={[0.08, 1.05, 0.08]} color={TOY.bark} />
        <Block position={[0.19, 1.01, -0.45]} size={[0.45, 0.28, 0.045]} color={TOY.gold} />
      </group>
      {gateX.map((x, i) => (
        <group key={i} position={[x, 0.15, 1.6]}>
          {[-0.79, 0.79].map((side) => (
            <group key={side}>
              <Disc position={[side, 0.1, 0]} radius={0.31} height={0.17} color={TOY.cream} />
              <Block position={[side, 0.7, 0]} size={[0.36, 1.4, 0.4]} color={TOY.channels[i]!} />
              <Ball position={[side, 1.51, 0]} size={[0.24, 0.21, 0.24]} color={TOY.gold} />
            </group>
          ))}
          <group
            position={[-0.68, 1.03, 0]}
            rotation-z={passed && state.lastChoice === i ? Math.PI / 2.5 : 0}
          >
            <Block
              position={[0.68, 0, 0]}
              size={[1.5, 0.2, 0.22]}
              color={state.selected === i ? TOY.gold : TOY.cream}
            />
          </group>
          <SceneLabel
            position={[0, 0.36, 1.25]}
            disabled={!interactive}
            selected={state.selected === i}
            onClick={() => dispatch({ type: "select", index: i })}
            testId={`toy-tool-${i}`}
            compact={String(i + 1)}
          >
            {word(CATEGORIES[i]!, locale)}
          </SceneLabel>
        </group>
      ))}
      {state.history.map((_, i) => (
        <Disc
          key={i}
          position={[-3.7 + i * 0.42, 0.22, -2.45]}
          radius={0.14}
          height={0.15}
          color={TOY.gold}
        />
      ))}
    </group>
  );
}

function WordScene({ state, locale, interactive, dispatch }: Props) {
  const card = toyDeck(state.mode)[Math.min(state.cursor, toyDeck(state.mode).length - 1)]!;
  const target: Position = [0, 0.9, 1.8];
  const won = state.phase === "feedback" && state.correct;
  return (
    <group name="toy-word-workshop">
      <Block position={[0, 0.4, 1.8]} size={[6.5, 0.55, 2.2]} color={TOY.bark} />
      <WordFrame position={[0, 0.72, 1.8]} />
      <Block position={[0, 0.68, 1.8]} size={[1.94, 0.1, 1.1]} color={won ? TOY.mint : TOY.ink} />
      {[0, 1, 2].map((i) => (
        <Block
          key={i}
          position={[-2.15, 0.84, 1.38 + i * 0.36]}
          size={[1.25, 0.055, 0.09]}
          color={TOY.soil}
        />
      ))}
      <Block position={[2.15, 0.84, 1.8]} size={[1.3, 0.05, 0.09]} color={TOY.soil} />
      {card.options!.map((option, i) => (
        <group key={`${card.id}-${i}`}>
          <Movable
            name={`toy-word-tile-${i}`}
            position={[(i - 1) * 3.05, 0.73, -0.9]}
            targets={[target]}
            enabled={interactive}
            settled={won && state.lastChoice === i ? target : null}
            rejected={state.phase === "feedback" && !state.correct && state.lastChoice === i}
            onSelect={() => dispatch({ type: "select", index: i })}
            onDrop={() => dispatch({ type: "submit", index: i })}
          >
            <Block size={[1.8, 0.4, 1.05]} color={state.selected === i ? TOY.gold : TOY.blue} />
            <Ball position={[0.65, 0.25, 0]} size={[0.075, 0.03, 0.075]} color={TOY.cream} />
          </Movable>
          {!(won && state.lastChoice === i) ? (
            <SceneLabel
              position={[(i - 1) * 3.05, 1.48, -1.25]}
              onClick={() => dispatch({ type: "select", index: i })}
              disabled={!interactive}
              selected={state.selected === i}
              testId={`toy-word-${i}`}
              compact={String(i + 1)}
            >
              {word(option, locale)}
            </SceneLabel>
          ) : null}
        </group>
      ))}
      <SceneLabel
        position={[0, 0.5, 3.7]}
        disabled={!interactive || state.selected === null}
        onClick={() =>
          state.selected !== null && dispatch({ type: "submit", index: state.selected })
        }
        testId="toy-slot"
        compact={word(["放入", "Fit"], locale)}
      >
        {won
          ? word(card.options![card.answer]!, locale)
          : word(["嵌入词块", "Fit the tile"], locale)}
      </SceneLabel>
      {Array.from({ length: Math.min(4, state.cursor) }, (_, i) => (
        <Block
          key={i}
          position={[-3.25, 0.4 + i * 0.16, -2.1]}
          size={[1.3, 0.14, 0.7]}
          color={TOY.mint}
        />
      ))}
      {Array.from({ length: Math.min(3, state.mistakes) }, (_, i) => (
        <Block
          key={i}
          position={[3.6, 0.26 + i * 0.19, 1.9]}
          size={[0.65, 0.17, 0.55]}
          color={TOY.coral}
        />
      ))}
    </group>
  );
}

function SuccessMoment({ state }: { state: ToyState }) {
  const group = useRef<THREE.Group>(null);
  const time = useRef(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    time.current = 0;
  }, [state.cursor, state.correct]);
  const complete = state.phase === "complete";
  useFrame((_, dt) => {
    if (!group.current) return;
    time.current += Math.min(dt, 0.05);
    group.current.visible = complete || (state.correct && time.current < 1.25);
    group.current.children.forEach((child, i) => {
      const a = (i / 5) * Math.PI * 2;
      const t = Math.min(time.current, 1.25);
      const radius = reduced ? 0.55 : 0.22 + t * 0.82;
      child.position.set(
        Math.cos(a) * radius,
        reduced ? 0.2 : Math.sin(a) * radius + 1.4 * t - 0.9 * t * t,
        0,
      );
      child.rotation.z = reduced ? 0 : -a + t * 0.6;
      child.scale.setScalar(complete ? 1 : reduced ? 0.8 : Math.max(0.05, 1 - t * 0.72));
    });
  });
  const index = state.lastChoice ?? 1;
  const x =
    complete || state.mode === "cloze-tetris"
      ? 0
      : state.mode === "stack"
        ? (index - 1) * 2.5
        : index
          ? 2
          : -2;
  return (
    <group
      ref={group}
      position={[x, complete ? 2.4 : 1.5, 1.8]}
      visible={false}
      name="toy-success-moment"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i}>
          <Star scale={complete ? 0.3 : 0.17} />
        </group>
      ))}
    </group>
  );
}

export function ToyScene(props: Props) {
  const [epoch, setEpoch] = useState(0);
  return (
    <SceneBoundary key={epoch} onFailure={props.onFailure}>
      <Stage
        cameraFrom={TOY.camera}
        lookAt={[0, 0.4, 0.7]}
        cameraFar={130}
        paused={props.paused}
        ambientOcclusion
        postProcessing={
          !(import.meta.env.DEV && new URLSearchParams(location.search).get("toy-post") === "off")
        }
        onSceneReady={props.onReady}
        onRendererUnavailable={props.onFailure}
        onContextLost={props.onFailure}
        onContextRestored={() => setEpoch((e) => e + 1)}
      >
        <color attach="background" args={[TOY.sky]} />
        <fog attach="fog" args={[TOY.sky, 40, 100]} />
        <ToyCamera />
        <ToyGarden />
        {props.state.mode === "stack" ? (
          <SortingScene {...props} />
        ) : props.state.mode === "invaders" ? (
          <GateScene {...props} />
        ) : (
          <WordScene {...props} />
        )}
        <SuccessMoment state={props.state} />
      </Stage>
    </SceneBoundary>
  );
}
