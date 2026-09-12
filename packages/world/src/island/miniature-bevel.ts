import * as THREE from "three";

/** Closed 44-triangle chamfered solid. Six face panels, twelve edge strips,
 * eight corner triangles share exact datums. Bevels do not inflate the box.
 * The miniature kit merges this vertex-colour geometry into its existing draw.
 */
export function miniatureBevelBox(
  size: readonly [number, number, number],
  bevel = Math.min(...size) * 0.16,
): THREE.BufferGeometry {
  if (
    !size.every((v) => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(bevel) ||
    bevel <= 0 ||
    bevel >= Math.min(...size) / 2
  )
    throw new RangeError("A miniature bevel must fit inside its solid");
  const half = size.map((v) => v / 2);
  const positions: number[] = [];
  const point = (axis: number, signs: readonly number[]) =>
    new THREE.Vector3(
      ...(half.map((h, i) => signs[i]! * (h - (i === axis ? 0 : bevel))) as [
        number,
        number,
        number,
      ]),
    );
  const polygon = (vertices: THREE.Vector3[]) => {
    const normal = vertices[1]!
      .clone()
      .sub(vertices[0]!)
      .cross(vertices[2]!.clone().sub(vertices[0]!));
    const centre = vertices.reduce((s, p) => s.add(p), new THREE.Vector3());
    if (normal.dot(centre) < 0) vertices.reverse();
    for (let i = 1; i < vertices.length - 1; i++)
      for (const p of [vertices[0]!, vertices[i]!, vertices[i + 1]!]) positions.push(p.x, p.y, p.z);
  };
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      const others = [0, 1, 2].filter((i) => i !== axis);
      polygon(
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) => {
          const signs = [0, 0, 0];
          signs[axis] = sign;
          signs[others[0]!] = u!;
          signs[others[1]!] = v!;
          return point(axis, signs);
        }),
      );
    }
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 3; b++) {
      const c = 3 - a - b;
      for (const sa of [-1, 1])
        for (const sb of [-1, 1]) {
          const signs = [0, 0, 0];
          signs[a] = sa;
          signs[b] = sb;
          signs[c] = -1;
          const loA = point(a, signs),
            loB = point(b, signs);
          signs[c] = 1;
          polygon([loA, loB, point(b, signs), point(a, signs)]);
        }
    }
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) polygon([0, 1, 2].map((axis) => point(axis, [x, y, z])));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
