import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

/** Small manufactured toy parts, not a second navigable terrain generator. */
function outline(width: number, depth: number, radius: number) {
  const p = new THREE.Shape();
  const x = width / 2,
    z = depth / 2;
  p.moveTo(-x + radius, -z);
  p.lineTo(x - radius, -z);
  p.quadraticCurveTo(x, -z, x, -z + radius);
  p.lineTo(x, z - radius);
  p.quadraticCurveTo(x, z, x - radius, z);
  p.lineTo(-x + radius, z);
  p.quadraticCurveTo(-x, z, -x, z - radius);
  p.lineTo(-x, -z + radius);
  p.quadraticCurveTo(-x, -z, -x + radius, -z);
  p.closePath();
  return p;
}

export function toySlab(width: number, depth: number, height: number, radius: number) {
  const geometry = new THREE.ExtrudeGeometry(outline(width, depth, radius), {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(0.1, height * 0.25),
    bevelThickness: Math.min(0.08, height * 0.25),
    curveSegments: 8,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
  return toCreasedNormals(geometry, Math.PI / 3);
}

/** A real opening: a word tile fits between the rim, not over a painted black rectangle. */
export function wordFrameGeometry() {
  const shape = outline(6.6, 2.25, 0.35);
  shape.holes.push(new THREE.Path(outline(2.04, 1.22, 0.18).getPoints(8)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 6,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
