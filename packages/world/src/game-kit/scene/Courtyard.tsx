import { useMemo } from "react";

import { Ball, Block, Disc, Donor, Flower, ToyLighting, Tree, wax } from "../../toy-play/parts.js";
import { TOY } from "../../toy-play/style.js";
import { toyRing, toySlab } from "../../toy-play/geometry.js";
import type { ArenaBox } from "./stage-fit.js";

/**
 * The courtyard arena (ADR-0011, scene layer): the garden edition's toy look,
 * rearranged so every piece has a job. A pond in the middle is the playfield
 * and nothing stands in it; boats enter under a red gate at the far end; the
 * avatar stands on a stone terrace at the near edge, with the round's baskets
 * behind it; trees, lanterns and a stall frame the sides only.
 *
 * Arena coordinates match `rules/intercept.ts`'s pond: x left–right, z from
 * the gate (negative) to the terrace (positive), y up from the grass.
 */
export const COURTYARD = {
  pond: { minX: -3.9, maxX: 3.9, minZ: -5, maxZ: 1.6, surface: 0.1 },
  terrace: { minZ: 1.6, maxZ: 4.4, top: 0.14 },
  hero: { x: 0, z: 2.35 },
  gateZ: -5.05,
  basketZ: 3.55,
} as const;

/**
 * What the camera must keep in view. A tall stage keeps the pond, the terrace
 * and the gate, and lets the trees and stalls at the sides run off the edge:
 * on a phone the play area is worth more than the frame around it.
 */
export function courtyardBox(aspect: number): ArenaBox {
  const half = aspect < 1 ? 4.35 : 5.4;
  return { min: [-half, 0, -5.8], max: [half, 1.4, 4.6] };
}

/** Where each of a round's baskets stands, left to right. */
export function basketSpots(count: number): readonly { x: number; z: number }[] {
  const xs = count >= 3 ? [-2.7, 0, 2.7] : [-1.9, 1.9];
  return xs.slice(0, Math.max(2, Math.min(3, count))).map((x) => ({ x, z: COURTYARD.basketZ }));
}

const island = toySlab(11.8, 11.6, 1.5, 1.8);
const islandGrass = toySlab(12, 11.8, 0.16, 1.85);

function Gate() {
  // The map's checkpoint gate, small: boats come from under it.
  return (
    <group name="courtyard-gate" position={[0, 0, COURTYARD.gateZ]}>
      {[-1.3, 1.3].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Disc position={[0, 0.8, 0]} radius={0.12} height={1.6} color={TOY.coral} />
          <Disc position={[0, 0.06, 0]} radius={0.2} height={0.12} color={TOY.ink} />
        </group>
      ))}
      <Block position={[0, 1.66, 0]} size={[3.4, 0.16, 0.3]} color={TOY.coral} />
      <Block position={[0, 1.36, 0]} size={[2.9, 0.1, 0.2]} color={TOY.coral} />
      <Block position={[0, 1.78, 0]} size={[3.7, 0.08, 0.36]} color={TOY.ink} />
    </group>
  );
}

const { minX, maxX, minZ, maxZ } = COURTYARD.pond;
/** Rounded, so the pond reads as water in a garden and not a tray. */
const water = toySlab(maxX - minX + 0.1, maxZ - minZ + 0.5, 0.08, 1);
const rim = toyRing(
  [maxX - minX + 0.5, maxZ - minZ + 0.9],
  [maxX - minX, maxZ - minZ + 0.4],
  0.22,
  1.2,
);

function Pond() {
  const { surface } = COURTYARD.pond;
  const cx = (minX + maxX) / 2,
    cz = (minZ + maxZ) / 2 + 0.2;
  return (
    <group name="courtyard-pond">
      {/* The water sits a little below the stone rim around it. */}
      <mesh
        geometry={rim}
        material={wax(TOY.cream)}
        position={[cx, 0.11, cz]}
        castShadow
        receiveShadow
        dispose={null}
      />
      <mesh
        geometry={water}
        material={wax(TOY.water)}
        position={[cx, surface - 0.04, cz]}
        receiveShadow
        dispose={null}
      />
      {/* Lily pads stay outside the lanes the boats use (|x| > 3). */}
      {(
        [
          [-3.45, -4.3, 0.34],
          [3.4, -3.2, 0.28],
          [-3.35, -0.6, 0.3],
          [3.45, 0.6, 0.24],
        ] as const
      ).map(([x, z, r]) => (
        <group key={`${x}/${z}`} position={[x, surface + 0.02, z]}>
          <Disc position={[0, 0, 0]} radius={r} height={0.03} color={TOY.leafLight} />
          {r > 0.3 ? (
            <Ball position={[0.08, 0.06, 0.05]} size={[0.07, 0.06, 0.07]} color={TOY.coral} />
          ) : null}
        </group>
      ))}
    </group>
  );
}

function Terrace({ baskets }: { baskets: number }) {
  const { minZ, maxZ, top } = COURTYARD.terrace;
  const d = maxZ - minZ,
    cz = (minZ + maxZ) / 2;
  return (
    <group name="courtyard-terrace">
      <Block position={[0, top / 2, cz]} size={[9.2, top, d]} color={TOY.cream} />
      {/* Paving joints, so the terrace reads as stones and not a slab. */}
      {[-3, -1, 1, 3].map((x) => (
        <Block
          key={x}
          position={[x, top + 0.004, cz]}
          size={[0.04, 0.01, d - 0.3]}
          color={0xe9d4ad}
        />
      ))}
      {/* The step the avatar stands on, at the water's edge. */}
      <Block
        position={[COURTYARD.hero.x, top + 0.05, COURTYARD.hero.z]}
        size={[1.3, 0.1, 1]}
        color={TOY.soil}
      />
      {/* Rails beside the baskets keep the edge readable at a glance. */}
      {basketSpots(baskets).map(({ x }) => (
        <Block
          key={x}
          position={[x, top + 0.02, COURTYARD.basketZ]}
          size={[1.3, 0.04, 1.1]}
          color={0xead7b3}
        />
      ))}
    </group>
  );
}

function Frame() {
  return (
    <group name="courtyard-frame">
      <Tree x={-4.85} z={-4.7} scale={1.1} />
      <Tree x={-4.05} z={-5.25} scale={0.7} />
      <Tree x={4.75} z={-4.5} scale={1} />
      <Tree x={4.95} z={-0.6} scale={0.62} />
      <Tree x={-4.95} z={-0.9} scale={0.58} />
      <Donor id="lantern" position={[-4.55, COURTYARD.terrace.top, 1.95]} height={0.86} />
      <Donor id="lantern" position={[4.55, COURTYARD.terrace.top, 1.95]} height={0.86} />
      <Donor id="stall" position={[-4.85, 0, -2.9]} height={1} rotation={Math.PI / 2} />
      <Donor id="cart" position={[4.8, 0, -2.6]} height={0.85} rotation={-Math.PI / 2} />
      <Donor id="rock_smallA" position={[-4.45, 0, -3.3]} height={0.32} />
      <Donor id="rock_smallA" position={[4.5, 0, 0.2]} height={0.26} />
      {(
        [
          [-4.6, -3.9],
          [-4.7, 0.6],
          [4.6, -3.3],
          [4.7, -0.5],
          [-2.2, -5.5],
          [2.3, -5.45],
        ] as const
      ).map(([x, z]) => (
        <Flower key={`${x}/${z}`} x={x} z={z} />
      ))}
    </group>
  );
}

export function Courtyard({ baskets }: { baskets: number }) {
  const soil = useMemo(() => wax(TOY.soil), []);
  const grass = useMemo(() => wax(TOY.grass), []);
  return (
    <group name="game-courtyard">
      <ToyLighting />
      <mesh
        geometry={island}
        material={soil}
        // The extrusion's bevel adds to its height; keep the soil's top under the grass.
        position={[0, -0.86, -0.3]}
        castShadow
        receiveShadow
        dispose={null}
      />
      <mesh
        geometry={islandGrass}
        material={grass}
        position={[0, -0.06, -0.3]}
        receiveShadow
        dispose={null}
      />
      <Block position={[0, -2.2, 0]} size={[260, 0.2, 260]} color={TOY.water} />
      <Pond />
      <Terrace baskets={baskets} />
      <Gate />
      <Frame />
    </group>
  );
}
