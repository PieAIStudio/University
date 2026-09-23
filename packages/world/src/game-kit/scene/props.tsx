import * as THREE from "three";

import { Block, Disc, wax } from "../../toy-play/parts.js";
import { TOY } from "../../toy-play/style.js";

/**
 * Small props a learning game carries its content on (ADR-0011, scene layer).
 * Each is a toy part in the shared wax finish; none carries text — the words
 * ride above them as DOM labels.
 */

function hullGeometry() {
  // A folded-paper hull: a trapezoid profile, extruded across the beam.
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, 0.26);
  shape.lineTo(0.62, 0.26);
  shape.lineTo(0.36, 0);
  shape.lineTo(-0.36, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -0.21);
  return geometry;
}

function sailGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.3, 0);
  shape.lineTo(0.3, 0);
  shape.lineTo(0, 0.52);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelSize: 0.02,
    bevelThickness: 0.02,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -0.025);
  return geometry;
}

const hull = hullGeometry();
const sail = sailGeometry();

/** A paper boat. `sail` is cream until the boat is shown its right bin. */
export function PaperBoat({ sailColour }: { sailColour: number }) {
  return (
    <group name="paper-boat">
      <mesh geometry={hull} material={wax(TOY.cream)} castShadow receiveShadow dispose={null} />
      <mesh
        geometry={sail}
        material={wax(sailColour)}
        position={[0, 0.26, 0]}
        castShadow
        dispose={null}
      />
    </group>
  );
}

/** A basket in a bin's colour, holding up to six collected notes. */
export function Basket({ colour, notes }: { colour: number; notes: number }) {
  return (
    <group name="basket">
      <Disc position={[0, 0.26, 0]} radius={0.5} height={0.52} color={0xc99a62} />
      <Disc position={[0, 0.3, 0]} radius={0.53} height={0.16} color={colour} />
      <Disc position={[0, 0.54, 0]} radius={0.55} height={0.06} color={0xb88450} />
      {Array.from({ length: Math.min(6, notes) }, (_, i) => (
        <Block
          key={i}
          position={[((i % 3) - 1) * 0.16, 0.56 + Math.floor(i / 3) * 0.06, (i % 2) * 0.1 - 0.05]}
          size={[0.34, 0.03, 0.24]}
          rotation={(i * 0.7) % 1}
          color={TOY.cream}
        />
      ))}
    </group>
  );
}

/** A paper note, flying from a boat into a basket. */
export function Note() {
  return <Block size={[0.34, 0.03, 0.24]} color={TOY.cream} />;
}
