import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Block, Disc } from "./parts.js";
import { TOY } from "./style.js";
import type { ToyMode } from "./material.js";

/** Shared finish, deliberately different architecture. None imports ToyGarden. */
export const PURPOSE_BACKGROUNDS: Record<ToyMode, number> = {
  invaders: 0xaad4e7,
  stack: 0xe8d8c8,
  "cloze-tetris": 0xc9d9d5,
};

export function Roller({
  position,
  length,
  color = TOY.blue,
  turn = 0,
}: {
  position: [number, number, number];
  length: number;
  color?: number;
  turn?: number;
}) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <Disc position={[0, 0, 0]} radius={0.26} height={length} color={color} />
      {[-1, 1].map((side) => (
        <group key={side} position={[0, side * (length / 2 + 0.08), 0]} rotation-y={turn}>
          <Disc position={[0, 0, 0]} radius={0.35} height={0.15} color={TOY.cream} />
          <Block size={[0.53, 0.16, 0.09]} color={TOY.bark} />
        </group>
      ))}
    </group>
  );
}

function Cloud({ x, y, z, scale = 1 }: { x: number; y: number; z: number; scale?: number }) {
  return (
    <group position={[x, y, z]} scale={scale}>
      <Ball position={[0, 0, 0]} size={[1.4, 0.43, 0.85]} color={0xf3f3e7} />
      <Ball position={[-0.65, 0.24, 0]} size={[0.65, 0.55, 0.64]} color={0xf3f3e7} />
      <Ball position={[0.32, 0.38, 0]} size={[0.82, 0.73, 0.65]} color={0xf3f3e7} />
    </group>
  );
}

function Airspace({ elapsed }: { elapsed: () => number }) {
  const markers = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!markers.current) return;
    markers.current.children.forEach((node, i) => {
      node.position.z = -5.5 + (((i % 7) * 1.6 + elapsed() * 0.65) % 11);
    });
  }, -1);
  return (
    <group name="scene-cloud-flight">
      {/* No ground under the flight corridor: silhouettes, air and navigation markers. */}
      <Cloud x={-5.5} y={-0.8} z={-2.8} scale={1.25} />
      <Cloud x={5.8} y={-1.5} z={1.3} scale={1.5} />
      <Cloud x={-4.6} y={-1.5} z={4.9} scale={0.8} />
      <Cloud x={4.7} y={-1.6} z={-5.4} scale={1.1} />
      <Cloud x={0} y={-2.7} z={-5.2} scale={1.1} />
      <group ref={markers}>
        {Array.from({ length: 14 }, (_, i) => (
          <Block
            key={i}
            position={[i < 7 ? -4.05 : 4.05, -0.28, (i % 7) * 1.6 - 5.5]}
            size={[0.15, 0.1, 0.45]}
            color={TOY.cream}
          />
        ))}
      </group>
      <Block position={[0, -0.2, 4.7]} size={[3.3, 0.45, 1.45]} color={0x718da7} />
      <Block position={[0, 0.07, 4.7]} size={[2.9, 0.08, 1.2]} color={TOY.cream} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.5, -0.45, 4.7]}>
          <Block size={[1.2, 0.6, 2]} color={TOY.coral} />
          <Ball position={[0, 0.45, 0]} size={[0.44, 0.32, 0.52]} color={TOY.blue} />
          <Disc position={[0, -0.5, 0]} radius={0.5} height={0.2} color={TOY.cream} />
        </group>
      ))}
    </group>
  );
}

function Factory({ elapsed }: { elapsed: () => number }) {
  const belts = useRef<THREE.Group>(null);
  useFrame(() => {
    belts.current?.children.forEach((node, i) => {
      node.position.z = 2.3 + (((i % 6) * 0.34 + elapsed() * 0.55) % 2);
    });
  }, -1);
  return (
    <group name="scene-sorting-factory">
      <Block position={[0, -0.4, 0.9]} size={[10.7, 0.72, 7.2]} color={0x769997} />
      <Block position={[0, 0, 0.9]} size={[10.3, 0.15, 6.8]} color={TOY.cream} />
      {[-4.7, 4.7].map((x) => (
        <group key={x}>
          <Block position={[x, 3, -1.5]} size={[0.48, 6.2, 0.55]} color={TOY.blue} />
          <Block position={[x, 0.15, -1.5]} size={[1, 0.28, 1]} color={TOY.coral} />
          <Ball position={[x, 6.3, -1.5]} size={[0.25, 0.25, 0.25]} color={TOY.gold} />
        </group>
      ))}
      <Block position={[0, 6.2, -1.5]} size={[9.8, 0.55, 0.8]} color={TOY.coral} />
      <Block position={[0, 6.3, 0.05]} size={[2.3, 0.55, 2.35]} color={TOY.gold} />
      <Block position={[0, 6.02, 0.5]} size={[1.5, 0.16, 1.3]} color={TOY.ink} />
      {[-1, 0, 1].map((i) => (
        <group key={i}>
          <Block position={[i * 2.7, 0.18, 3.25]} size={[2.15, 0.28, 2.15]} color={TOY.ink} />
          <Block
            position={[i * 2.7, 0.14, 4.55]}
            size={[1.95, 0.7, 0.55]}
            color={TOY.channels[i + 1]!}
          />
        </group>
      ))}
      <group ref={belts}>
        {Array.from({ length: 18 }, (_, i) => (
          <Block
            key={i}
            position={[(Math.floor(i / 6) - 1) * 2.7, 0.36, 2.3 + (i % 6) * 0.34]}
            size={[2, 0.08, 0.09]}
            color={0xa7b9b3}
          />
        ))}
      </group>
      <group position={[5.1, 1, 1.4]}>
        <Block size={[0.65, 1.8, 1.4]} color={TOY.coral} />
        {[0, 1, 2].map((i) => (
          <Ball
            key={i}
            position={[0, 0.45 - i * 0.4, 0.76]}
            size={[0.16, 0.16, 0.08]}
            color={i === 0 ? TOY.mint : TOY.cream}
          />
        ))}
      </group>
    </group>
  );
}

export function PressHousing({
  top,
  bottom,
  elapsed,
}: {
  top: number;
  bottom: number;
  elapsed: number;
}) {
  return (
    <group name="scene-sentence-press">
      <Block
        position={[0, (top + bottom) / 2, 2.1]}
        size={[9.8, top - bottom + 0.8, 0.65]}
        color={0x709b9a}
      />
      <Block
        position={[0, (top + bottom) / 2, 2.47]}
        size={[8.6, top - bottom - 0.4, 0.12]}
        color={0x425e65}
      />
      {[-4.7, 4.7].map((x) => (
        <Block
          key={x}
          position={[x, (top + bottom) / 2, 2.9]}
          size={[0.48, top - bottom, 0.7]}
          color={TOY.coral}
        />
      ))}
      <Roller position={[0, top - 0.05, 3.0]} length={8.7} turn={elapsed * 0.7} />
      <Roller
        position={[0, bottom + 0.35, 3.2]}
        length={8.7}
        color={TOY.coral}
        turn={-elapsed * 0.7}
      />
      <Block position={[0, bottom - 0.25, 3.5]} size={[9.9, 0.75, 2.2]} color={0x709b9a} />
      <Block position={[0, bottom + 0.17, 3.7]} size={[7.8, 0.12, 1.75]} color={TOY.cream} />
      {[0, 1, 2].map((i) => (
        <Ball
          key={i}
          position={[-3.8 + i * 0.44, top + 0.18, 3.45]}
          size={[0.12, 0.12, 0.08]}
          color={i === 0 ? TOY.gold : TOY.cream}
        />
      ))}
    </group>
  );
}

export function PurposeScenery({ mode, elapsed }: { mode: ToyMode; elapsed: () => number }) {
  if (mode === "invaders") return <Airspace elapsed={elapsed} />;
  if (mode === "stack") return <Factory elapsed={elapsed} />;
  // The press is framed by WordsScene, because its rails depend on readable row spacing.
  return null;
}
