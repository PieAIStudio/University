import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { createMiniatureAsset } from "./miniature-assets.js";
import { createCourseRuinGeometry } from "./course-ruin-geometry.js";
import { buildCourseSpringGeometry } from "./course-spring-geometry.js";
import { createCourseStallGeometry } from "./course-stall-geometry.js";
import { prepareCraftSurface } from "./craft-surface.js";
import { createCourseAcademyGeometry } from "./course-academy-geometry.js";
import {
  COURSE_ROCK_BANK_POINTS,
  COURSE_ROCK_BANK_FACES,
  courseRockTopPoints,
} from "./course-rock-profile.js";
import {
  COURSE_LANDSCAPE_LIMITS,
  type CourseLandscapePlan,
  type CourseOutcrop,
} from "./course-landscape-plan.js";

/** Three closed donor-derived stone masses, rigidly seated on the terrain.
 * Their complete volume stays inside the original non-walkable reserve;
 * ground, route, collision/lesson targets are not raised in a shader.
 */
export function createCourseOutcropGeometry(site: CourseOutcrop): THREE.BufferGeometry {
  if (
    site.groundHeights &&
    (site.groundHeights.length !== COURSE_ROCK_BANK_POINTS.length ||
      !site.groundHeights.every(Number.isFinite))
  ) {
    throw new Error("Rock bank ground samples must match the model profile");
  }
  const top = courseRockTopPoints(site).map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const stone = new THREE.Color(0x8896a5),
    turf = new THREE.Color(0x8fba51).lerp(new THREE.Color(0xacc967), site.meadow * 0.3);
  const topFaces = COURSE_ROCK_BANK_FACES;
  // Smooth only the causal material mask, not the actual cliff normals. A
  // different grass colour per triangle made the previous bank a checkerboard.
  const maskNormals = top.map(() => new THREE.Vector3());
  for (const [a, b, c] of topFaces) {
    const normal = top[b]!.clone().sub(top[a]!).cross(top[c]!.clone().sub(top[a]!));
    for (const i of [a, b, c]) maskNormals[i]!.add(normal);
  }
  const topColours = maskNormals.map((n, i) =>
    stone
      .clone()
      .lerp(new THREE.Color(0xc2bfac), COURSE_ROCK_BANK_POINTS[i]!.lift * 0.32)
      .lerp(
        turf,
        THREE.MathUtils.smoothstep(n.normalize().y, 0.48, 0.78) * COURSE_ROCK_BANK_POINTS[i]!.turf,
      ),
  );
  const emit = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    shades: readonly THREE.Color[] = [stone, stone, stone],
  ) => {
    const start = positions.length / 3;
    for (const [i, p] of [a, b, c].entries()) {
      const colour = shades[i]!;
      positions.push(p.x, p.y, p.z);
      colors.push(colour.r, colour.g, colour.b);
    }
    indices.push(start, start + 1, start + 2);
  };
  for (const [a, b, c] of topFaces) {
    emit(top[a]!, top[b]!, top[c]!, [topColours[a]!, topColours[b]!, topColours[c]!]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function mergedOwned(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!parts.length) return null;
  try {
    const geometry = mergeBufferGeometries(parts, false);
    if (!geometry) throw new Error("Course landscape attributes must share one material contract");
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  } finally {
    for (const part of parts) part.dispose();
  }
}

export function buildCourseLandscapeGeometry(plan: CourseLandscapePlan) {
  const spring = plan.spring ? buildCourseSpringGeometry(plan.spring) : null;
  const rockParts: THREE.BufferGeometry[] = spring ? [spring.bank] : [];
  // Presentation may round standalone stones, never water seats or ruins.
  // Ranges carry semantic ownership through the existing single merged draw.
  const sculptable = new Set<THREE.BufferGeometry>();
  let rock: THREE.BufferGeometry | null;
  try {
    for (const site of plan.outcrops) {
      const part =
        site.feature === "ruin"
          ? createCourseRuinGeometry(site)
          : createCourseOutcropGeometry(site);
      rockParts.push(part);
      if (site.feature !== "ruin") sculptable.add(part);
    }
    const stoneSource = createMiniatureAsset("stone");
    try {
      const colours = stoneSource.getAttribute("color"),
        normals = stoneSource.getAttribute("normal");
      const pigment = new THREE.Color(),
        sunlitMoss = new THREE.Color(0xa7b394),
        mineral = new THREE.Color(0x9caa9e);
      for (let i = 0; i < colours.count; i++) {
        pigment
          .fromBufferAttribute(colours, i)
          .lerp(normals.getY(i) > 0.6 ? sunlitMoss : mineral, 0.22);
        colours.setXYZ(i, pigment.r, pigment.g, pigment.b);
      }
      for (const p of plan.stones ?? []) {
        const part = stoneSource
          .clone()
          .scale(p.size, p.size, p.size)
          .rotateY(p.turn)
          .translate(p.x, p.y, p.z);
        rockParts.push(part);
        sculptable.add(part);
      }
    } finally {
      stoneSource.dispose();
    }
    // Transfer ownership once. Failed builders release pending pieces; the
    // merger owns/disposes the transferred set even when attributes disagree.
    let offset = 0;
    const ranges = rockParts.flatMap((part) => {
      const count = part.index?.count ?? part.getAttribute("position").count;
      const range = { start: offset, count };
      offset += count;
      return sculptable.has(part) ? [range] : [];
    });
    rock = mergedOwned(rockParts.splice(0));
    if (rock) {
      rock.userData.clayStoneRanges = ranges;
      // Plants already rooted on the bank retain that exact supporting plane.
      rock.userData.clayStoneContacts = [
        ...(plan.canopy ?? []).map((p) => ({ x: p.x, z: p.z, radius: p.size * 0.12 + 0.04 })),
        ...plan.flora
          .filter((p) => p.supportId)
          .map((p) => ({ x: p.x, z: p.z, radius: p.radius + 0.04 })),
      ];
    }
  } catch (error) {
    rockParts.forEach((part) => part.dispose());
    spring?.water.dispose();
    throw error;
  }
  const matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  const position = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  const sources = {
    fir: createMiniatureAsset("fir", "course"),
    broadleaf: createMiniatureAsset("broadleaf", "course"),
    flowers: createMiniatureAsset("flowers"),
    grass: createMiniatureAsset("grass"),
    fern: createMiniatureAsset("fern"),
    leafy: createMiniatureAsset("leafy"),
    mushroom: createMiniatureAsset("mushroom"),
    fence: createMiniatureAsset("fence"),
  };
  let flora: THREE.BufferGeometry | null = null;
  try {
    // Natural vegetation keeps role 0; no new material response is applied.
    for (const source of Object.values(sources)) prepareCraftSurface(source);
    flora = mergedOwned([
      ...[
        ...(plan.canopy ?? []),
        ...plan.flora,
        ...(plan.borders ?? []).map((p) => ({ ...p, asset: "fence" as const })),
      ].map((p) =>
        sources[p.asset]
          .clone()
          .applyMatrix4(
            matrix.compose(
              position.set(p.x, p.y, p.z),
              quaternion.setFromAxisAngle(up, p.turn),
              scale.setScalar(p.size),
            ),
          ),
      ),
      ...(plan.stalls ?? []).map((p) =>
        createCourseStallGeometry(p.feet)
          .scale(p.size, p.size, p.size)
          .rotateY(p.turn)
          .translate(p.x, p.y, p.z),
      ),
      ...(plan.academies ?? []).map((p) =>
        createCourseAcademyGeometry(p.foundationY)
          .scale(p.size, p.size, p.size)
          .rotateY(p.turn)
          .translate(p.x, p.y, p.z),
      ),
    ]);
  } catch (error) {
    rock?.dispose();
    spring?.water.dispose();
    throw error;
  } finally {
    for (const source of Object.values(sources)) source.dispose();
  }
  const triangles =
    (rock?.index?.count ?? 0) / 3 +
    (flora?.index?.count ?? 0) / 3 +
    (spring?.water.index?.count ?? 0) / 3;
  if (triangles > COURSE_LANDSCAPE_LIMITS.triangles) {
    rock?.dispose();
    flora?.dispose();
    spring?.water.dispose();
    throw new Error("Course landscape geometry exceeds its bounded budget");
  }
  return {
    rock,
    flora,
    water: spring?.water ?? null,
    triangles,
    dispose: () => {
      rock?.dispose();
      flora?.dispose();
      spring?.water.dispose();
    },
  };
}
