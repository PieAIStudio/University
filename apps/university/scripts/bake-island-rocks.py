"""Bake three CC0 Kenney rocks, two plants and a mushroom to tiny Y-up CPU mesh data.

Run in Blender's own background process (does not open or save user scenes):
  blender --background --factory-startup --python-exit-code 1 --python bake-island-rocks.py -- \
    --donor-root /path/to/Kenney --output /path/to/kenney-rock-shapes.json

The originals remain untouched. No textures are loaded at runtime and no local
absolute path or Blender dependency is part of the application bundle.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bmesh
import bpy

parser = argparse.ArgumentParser()
parser.add_argument("--donor-root", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
selection = ["rock_largeA", "rock_largeD", "rock_largeF", "plant_flatShort", "plant_bush", "mushroom_tan"]
license_path = args.donor_root / "kenney_nature-kit/License.txt"
if "CC0" not in license_path.read_text():
    raise ValueError("Expected the reviewed Nature Kit CC0 license")
assets = []
for name in selection:
    source = args.donor_root / f"kenney_nature-kit/Models/GLTF format/{name}.glb"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    bm = bmesh.new()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        vertex_map = [bm.verts.new(obj.matrix_world @ v.co) for v in obj.data.vertices]
        for polygon in obj.data.polygons:
            try:
                face = bm.faces.new([vertex_map[i] for i in polygon.vertices])
                if name == "mushroom_tan":
                    material = obj.data.materials[polygon.material_index]
                    face.material_index = int(material is not None and "Tan" in material.name)
            except ValueError:
                pass  # duplicate shared material-boundary face
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00001)
    solid = name.startswith("rock_")
    repaired = solid and any(not e.is_manifold for e in bm.edges)
    if repaired:
        # A source intended only as a visible prop may omit its underside.
        # The owned support solid must be closed, so record an explicit hull.
        coordinates = [v.co.copy() for v in bm.verts]
        bm.free()
        bm = bmesh.new()
        for point in coordinates:
            bm.verts.new(point)
        result = bmesh.ops.convex_hull(bm, input=list(bm.verts), use_existing_faces=False)
        discarded = [v for v in result["geom_interior"] if isinstance(v, bmesh.types.BMVert)]
        if discarded:
            bmesh.ops.delete(bm, geom=discarded, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    if solid and any(not e.is_manifold for e in bm.edges):
        raise ValueError(f"Non-manifold donor after preparation: {name}")
    # glTF importer converts Y-up to Blender Z-up; convert back explicitly.
    points = [(v.co.x, v.co.z, -v.co.y) for v in bm.verts]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    radius = max(((x-cx)**2+(z-cz)**2)**0.5 for x, y, z in points)
    height = hi[1] - lo[1]
    vertices = [[round((x-cx)/radius, 7), round((y-lo[1])/height, 7), round((z-cz)/radius, 7)] for x, y, z in points]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    assets.append({"id": name, "source": str(source.relative_to(args.donor_root)),
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "adaptation": "welded, normalized, closed convex hull" if repaired else "welded, normalized original mesh",
        "vertices": vertices, "faces": faces,
        **({"faceMaterials": [f.material_index for f in bm.faces],
            "materialRoles": ["stem", "cap"]} if name == "mushroom_tan" else {})})
    print(f"{name}: {len(vertices)} vertices, {len(faces)} triangles, hull={repaired}")
    bm.free()
output = {"schemaVersion": 1, "license": "CC0-1.0", "author": "Kenney",
    "sourceUrl": "https://kenney.nl/assets/nature-kit",
    "licenseSha256": hashlib.sha256(license_path.read_bytes()).hexdigest(),
    "palette": "University mineral/leaf vertex colours replace the source palette; no texture copied",
    "assets": assets}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
