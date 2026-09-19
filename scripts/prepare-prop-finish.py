"""Offline derived assets; run with Blender --background --python this-file -- input output.

Sources are exports of University's actual map adapters, not hand-made substitutes.
No source model or texture is written. Each method starts from the same input.
B: angle-limited bevel + weighted corner normals (Blender mesh modifiers).
C: finite-radius cosine hemisphere visibility and convex-edge masks against the
   original object; padded atlas coordinates preserve its triangle count.
References and accepted/rejected parameter trials live in the prop-finish README.
"""
import bpy
import bmesh
import json
import math
import sys
import hashlib
import struct
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from prop_finish_visibility import bake_atlas, write_png

args = sys.argv[sys.argv.index('--')+1:]
if len(args) < 2:
    raise SystemExit('Need exported input JSON and output directory')
source_path, destination = Path(args[0]), Path(args[1])
destination.mkdir(parents=True, exist_ok=True)
content = json.loads(source_path.read_text())
SAMPLES = 96


def triples(values, width):
    return [tuple(values[i:i+width]) for i in range(0, len(values), width)]


def build_mesh(part, name):
    data = part['geometry']
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(triples(data['position'], 3), [], triples(data['index'], 3))
    mesh.update()
    if data.get('uv'):
        uv = mesh.uv_layers.new(name='sourceUV')
        for loop in mesh.loops:
            uv.data[loop.index].uv = data['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
    if data.get('color'):
        color = mesh.color_attributes.new(name='sourceColor', type='FLOAT_COLOR', domain='CORNER')
        for loop in mesh.loops:
            i = loop.vertex_index*3
            color.data[loop.index].color = (*data['color'][i:i+3], 1)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    # Preserve per-loop UV/colors while making actual shared edges recognizable.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    # Remove coplanar triangulation, not intentional corners or UV/color borders.
    bmesh.ops.dissolve_limit(bm, angle_limit=0.0001, verts=list(bm.verts), edges=list(bm.edges), delimit={'UV'})
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return mesh


def emit_mesh(mesh):
    mesh.calc_loop_triangles()
    out = {'position': [], 'normal': [], 'index': []}
    uv = mesh.uv_layers.get('sourceUV')
    color = mesh.color_attributes.get('sourceColor')
    if uv: out['uv'] = []
    if color: out['color'] = []
    corner_normals = mesh.corner_normals
    for tri in mesh.loop_triangles:
        for loop_idx in tri.loops:
            v = mesh.vertices[mesh.loops[loop_idx].vertex_index]
            out['index'].append(len(out['index']))
            out['position'].extend(round(x, 8) for x in v.co)
            out['normal'].extend(round(x, 8) for x in corner_normals[loop_idx].vector)
            # Blender bevel interpolation can differ by one Float32 ULP between runs.
            # Canonicalize DERIVED UVs at 1e-5; max 5e-6 UV error, far below one
            # texel in these palette maps. Original and non-bevel UVs stay exact.
            if uv: out['uv'].extend(round(x, 5) for x in uv.data[loop_idx].uv)
            if color: out['color'].extend(round(x, 8) for x in color.data[loop_idx].color[:3])
    return out


def bevel_part(part, width):
    if part.get('transparent') or part.get('opacity', 1) < 1:
        return part['geometry']
    mesh = build_mesh(part, 'prop-source')
    obj = bpy.data.objects.new('prop-derived', mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    # A tiny axle in a merged GLTF part must not clamp every large wooden rail.
    # Separate existing disconnected shells only; never move or add a shell.
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    shells=list(bpy.context.selected_objects)
    results=[]
    try:
        for shell in shells:
            bpy.context.view_layer.objects.active=shell
            for p in shell.data.polygons:p.use_smooth=True
            extent=[max(v.co[i] for v in shell.data.vertices)-min(v.co[i] for v in shell.data.vertices) for i in range(3)]
            positive=[x for x in extent if x>0.0001]
            mod=shell.modifiers.new('bounded-edge-rounding','BEVEL')
            mod.width=min(width,min(positive)*0.23) if positive else width
            mod.segments=3
            mod.limit_method='ANGLE'
            mod.angle_limit=math.radians(24)
            mod.use_clamp_overlap=True
            mod.harden_normals=True
            mod.face_strength_mode='FSTR_ALL'
            bpy.ops.object.modifier_apply(modifier=mod.name)
            weighted=shell.modifiers.new('panel-weighted-normals','WEIGHTED_NORMAL')
            weighted.keep_sharp=True
            weighted.weight=50
            weighted.use_face_influence=True
            bpy.ops.object.modifier_apply(modifier=weighted.name)
            results.append(emit_mesh(shell.data))
        result={key:[] for key in results[0]}
        for item in results:
            offset=len(result['position'])//3
            for key,values in item.items():
                result[key].extend([i+offset for i in values] if key=='index' else values)
        return result
    finally:
        for shell in shells:
            final_mesh=shell.data
            bpy.data.objects.remove(shell,do_unlink=True)
            if final_mesh.users==0:bpy.data.meshes.remove(final_mesh)


def scene_bvh(parts):
    vertices, polygons = [], []
    for part in parts:
        if part.get('transparent') or part.get('opacity', 1) < 1: continue
        data = part['geometry']
        offset = len(vertices)
        vertices.extend(triples(data['position'], 3))
        polygons.extend(tuple(offset+i for i in tri) for tri in triples(data['index'], 3))
    return BVHTree.FromPolygons(vertices, polygons, all_triangles=True, epsilon=0.000001)


def visibility(point, normal, tree, radius):
    n = normal.normalized()
    axis = Vector((0, 1, 0)) if abs(n.y) < 0.9 else Vector((1, 0, 0))
    tangent = n.cross(axis).normalized()
    bitangent = n.cross(tangent)
    start = point + n * 0.0012
    blocked = 0.0
    # Deterministic cosine-weighted Fibonacci disk, no random re-roll.
    for i in range(SAMPLES):
        r = math.sqrt((i+0.5)/SAMPLES)
        angle = i*2.399963229728653
        direction = tangent*(r*math.cos(angle)) + bitangent*(r*math.sin(angle)) + n*math.sqrt(1-r*r)
        loc, hitnormal, face, distance = tree.ray_cast(start, direction, radius)
        if loc is not None:
            blocked += max(0, 1-distance/radius)
    return round(max(0, min(1, 1-blocked/SAMPLES)), 6)


def pack_geometries(groups):
    """Only numeric buffers are binary; human-readable recipe/provenance stays JSON."""
    payload=bytearray()
    descriptions={}
    for group,parts in groups.items():
        descriptions[group]=[]
        for part in parts:
            attributes={}
            for channel,values in part.items():
                attributes[channel]={'offset':len(payload),'length':len(values)}
                kind='I' if channel=='index' else 'f'
                payload.extend(struct.pack('<'+kind*len(values),*values))
            descriptions[group].append(attributes)
    return descriptions,payload

reports=[]
for entry in content['objects']:
    sample,parts=entry['sample'],entry['parts']
    print('Preparing', sample['id'], flush=True)
    bevel_width=sample['bevel'] * (1.2 if sample.get('tree') else 2.5)
    bevel=[bevel_part(p,bevel_width) for p in parts]
    tree=scene_bvh(parts)
    ao,atlas_size,pixels,vals=bake_atlas(parts,tree,sample['aoDistance'],visibility)
    image=destination/(sample['id']+'-visibility.png')
    write_png(image,atlas_size,pixels)
    packed,payload=pack_geometries({'bevel':bevel,'occlusion':ao})
    binary=destination/(sample['id']+'.bin')
    binary.write_bytes(payload)
    result={'version':3,'id':sample['id'],'source':sample['source'],'consumer':sample['consumer'],
            'sourceSignatures':entry['sourceSignatures'], **packed,'visibilitySize':atlas_size,
            'bufferBytes':len(payload),'bufferSha256':hashlib.sha256(payload).hexdigest(),
            'recipe':{'blender':bpy.app.version_string,'bevelWidth':bevel_width,'segments':3,'samples':SAMPLES,'radius':sample['aoDistance']}}
    path=destination/(sample['id']+'.json')
    path.write_text(json.dumps(result,separators=(',',':')))
    reports.append({'id':sample['id'],'originalTriangles':sum(len(p['geometry']['index'])//3 for p in parts),
                    'bevelTriangles':sum(len(p['index'])//3 for p in bevel),
                    'aoTriangles':sum(len(p['index'])//3 for p in ao),'visibilityMin':min(vals),'visibilityMean':sum(vals)/len(vals),
                    'bytes':path.stat().st_size,'geometryBytes':len(payload),'visibilityBytes':image.stat().st_size,
                    'visibilitySize':atlas_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                    'bufferSha256':hashlib.sha256(payload).hexdigest(),'visibilitySha256':hashlib.sha256(image.read_bytes()).hexdigest()})
(destination/'manifest.json').write_text(json.dumps({'version':1,'sourceExportSha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'objects':reports},indent=2))
print(json.dumps(reports),flush=True)
