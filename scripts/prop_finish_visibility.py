"""Geometry-derived visibility stored in a padded scalar atlas, not extra faces.
Import from Blender's embedded Python. The caller supplies its exact source BVH.
No sun, ground plane or screenshot participates in this object-space bake.
"""
import math
import struct
import zlib
from mathutils import Vector

TILE, PAD, INTERIOR = 16, 2, 12


def write_png(path, size, pixels):
    def chunk(kind, data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    raw=b''.join(b'\x00'+bytes(pixels[y*size*3:(y+1)*size*3]) for y in range(size))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))


def bake_atlas(parts, tree, radius, visibility):
    triangle_count=sum(len(p['geometry']['index'])//3 for p in parts)
    size=2**math.ceil(math.log2(max(TILE,math.ceil(math.sqrt(triangle_count))*TILE)))
    pixels=bytearray([255,0,0])*(size*size)
    outputs,values=[],[]
    tile_index=0
    edge_faces={}
    def vertex_key(p): return tuple(round(v,5) for v in p)
    def edge_key(a,b): return tuple(sorted((vertex_key(a),vertex_key(b))))
    for part in parts:
        if part.get('transparent') or part.get('opacity',1)<1: continue
        g=part['geometry']; points=[Vector(g['position'][i:i+3]) for i in range(0,len(g['position']),3)]
        for k in range(0,len(g['index']),3):
            a,b,c=[points[i] for i in g['index'][k:k+3]]
            n=(b-a).cross(c-a).normalized();center=(a+b+c)/3
            for p,q in [(a,b),(b,c),(c,a)]: edge_faces.setdefault(edge_key(p,q),[]).append((n,center))
    convex=set()
    for edge,faces in edge_faces.items():
        if len(faces)==2:
            (n1,c1),(n2,c2)=faces
            if n1.dot(n2)<0.94 and n1.dot(c2-c1)<-0.00001:convex.add(edge)
    for part in parts:
        data=part['geometry']
        pos=[Vector(data['position'][i:i+3]) for i in range(0,len(data['position']),3)]
        normals=[Vector(data['normal'][i:i+3]) for i in range(0,len(data['normal']),3)]
        out={'position':[],'normal':[],'index':[],'visibilityUv':[],'grainAxis':[]}
        # Each existing connected shell gets its real longest dimension as wood
        # direction: upright posts are not textured like horizontal rails.
        parent=list(range(len(pos)))
        def root(i):
            while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
            return i
        def unite(a,b):parent[root(a)]=root(b)
        coincident={}
        for i,p in enumerate(pos):
            k=vertex_key(p)
            if k in coincident:unite(i,coincident[k])
            else:coincident[k]=i
        for offset in range(0,len(data['index']),3):
            a,b,c=data['index'][offset:offset+3];unite(a,b);unite(a,c)
        groups={}
        for i,p in enumerate(pos):groups.setdefault(root(i),[]).append(p)
        directions={key:max(range(3),key=lambda axis:max(p[axis] for p in points)-min(p[axis] for p in points)) for key,points in groups.items()}
        for key in ['uv','color']:
            if data.get(key):out[key]=[]
        transparent=part.get('transparent') or part.get('opacity',1)<1
        for offset in range(0,len(data['index']),3):
            ids=data['index'][offset:offset+3]
            tx=(tile_index%(size//TILE))*TILE
            ty=(tile_index//(size//TILE))*TILE
            tile_index+=1
            a,b,c=[pos[i] for i in ids]
            flat=(b-a).cross(c-a).normalized()
            polished=[(p,q) for p,q in [(a,b),(b,c),(c,a)] if edge_key(p,q) in convex]
            def edge_factor(point):
                nearest=1e6
                for e0,e1 in polished:
                    delta=e1-e0;t=max(0,min(1,(point-e0).dot(delta)/max(delta.length_squared,1e-10)))
                    nearest=min(nearest,(point-(e0+delta*t)).length)
                return max(0,1-nearest/0.028)**2
            cache={}
            for y in range(TILE):
                for x in range(TILE):
                    v=max(0,min(1,(x-PAD)/(INTERIOR-1)))
                    w=max(0,min(1,(y-PAD)/(INTERIOR-1)))
                    if v+w>1:
                        total=v+w;v/=total;w/=total
                    key=(round(v,5),round(w,5))
                    if key not in cache:
                        u=1-v-w
                        p=a*u+b*v+c*w
                        n=flat if part.get('flatShading') else (normals[ids[0]]*u+normals[ids[1]]*v+normals[ids[2]]*w).normalized()
                        cache[key]=1 if transparent else visibility(p,n,tree,radius)
                    value=cache[key]
                    pixel=((ty+y)*size+tx+x)*3
                    pixels[pixel]=round(value*255)
                    pixels[pixel+1]=0 if transparent else round(edge_factor(a*(1-v-w)+b*v+c*w)*255)
                    if PAD<=x<TILE-PAD and PAD<=y<TILE-PAD:values.append(value)
            for i,(u,v) in zip(ids,[(0,0),(1,0),(0,1)]):
                out['index'].append(len(out['index']))
                out['position'].extend(data['position'][i*3:i*3+3])
                out['normal'].extend(data['normal'][i*3:i*3+3])
                out['grainAxis'].append(directions[root(i)])
                out['visibilityUv'].extend([(tx+PAD+0.5+u*(INTERIOR-1))/size,(ty+PAD+0.5+v*(INTERIOR-1))/size])
                for key,width in [('uv',2),('color',3)]:
                    if key in out:out[key].extend(data[key][i*width:i*width+width])
        outputs.append(out)
    return outputs,size,pixels,values
