"""Style tests for the 3D chibi patron: the owner's Mixamo character
(art/mixamo/walk.fbx) dressed and shaded several ways, rendered as stills
beside a drawn patron so the owner can pick a direction.

Run from the repo root with a Python that has bpy==4.5.4 and pillow:
    python art/blender/patron3d_looks.py OUT_DIR            # every look
    python art/blender/patron3d_looks.py OUT_DIR A C        # just some

Writes OUT_DIR/look_<key>.png (front and back, large) and
OUT_DIR/looks.png, a board of all of them with a drawn patron at the
same size for comparison.

What's added to the blank model:
  - shading: 'toon' (flat colour with one hard shadow tone, like drawn
    art), 'flat' (no shadow at all) or 'soft' (lit 3D)
  - hair built from separate pointed locks over a thin cap, so it has a
    spiky drawn silhouette with lines between the locks
  - a painted face with big eyes, in a few styles
  - clothes: body colour regions plus shells over them (an open jacket,
    a hoodie with a hood), a cap
  - the head lifted, as the Mixamo walk looks at the floor
"""
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_patron3d as P  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))

BASE = dict(skin='#f0b088', hair_color='#2a2230', eyes='sleepy', iris='#5a3420', brows=None,
            hair='spiky', cap=None, top='tee', top_color='#1fc6c9', inner=None,
            bottom_color='#262a3a', shoe_color='#f2f0f4', sole='#b9b4c4', shading='toon')
LOOKS = {
    'A': dict(title='A  Toon: street jacket', hair='spiky', top='jacket', top_color='#1d1a24',
              inner='#f2f0f4', bottom_color='#2a3550'),
    'B': dict(title='B  Toon: hoodie', skin='#fde0cb', hair='swept', hair_color='#6b4428', eyes='bright',
              iris='#3a7fe0', top='hoodie', top_color='#7a44d8', bottom_color='#1d1a24',
              shoe_color='#1d1a24', sole='#f2f0f4'),
    'C': dict(title='C  Toon: cap and tee', skin='#b77d55', hair='short', hair_color='#2a2230', cap='#ff3fa4',
              eyes='cool', iris='#4a2c1c', top='tee', top_color='#1fc6c9', bottom_color='#34303d'),
    'D': dict(title='D  Flat colour (A, no shadow)', hair='spiky', top='jacket', top_color='#1d1a24',
              inner='#f2f0f4', bottom_color='#2a3550', shading='flat'),
    'E': dict(title='E  Soft 3D (A, lit)', hair='spiky', top='jacket', top_color='#1d1a24',
              inner='#f2f0f4', bottom_color='#2a3550', shading='soft'),
}

HEAD_LIFT = math.radians(14)      # tip the head up from the walk's downward look
HEAD_C = Vector((0, 0.02, 1.27))  # rest-pose head ellipsoid
HEAD_R = Vector((0.385, 0.37, 0.385))
# Toon light: from the camera's upper left (world space, pointing at the light).
LIGHT = Vector((-0.25, -0.75, 0.62)).normalized()
SHADOW = (0.66, 0.58, 0.80)       # shadow tint (a cool purple, as in the reference)
OUTLINE_PX = 2.0                  # line width at the sprite's render size
ZOOM = 4                          # stills are rendered this much bigger, to look at closely


# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------

def make_material(name, hex_color, look, face=None, shine=1.12):
    """A material in the look's shading style. `face` is a painted face
    image laid over the colour through the FaceUV projection."""
    shading = look['shading']
    if shading == 'soft':
        return P.material(name, hex_color, skin=hex_color == look['skin'], face=face)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    out = nt.nodes['Material Output']
    base = nt.nodes.new('ShaderNodeRGB')
    base.outputs[0].default_value = (*P.linear(hex_color), 1)
    colour = base.outputs[0]
    if face:
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'FaceUV'
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(face)
        tex.extension = 'CLIP'
        tex.interpolation = 'Cubic'
        nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        nt.links.new(tex.outputs['Alpha'], mix.inputs['Factor'])
        nt.links.new(colour, mix.inputs['A'])
        nt.links.new(tex.outputs['Color'], mix.inputs['B'])
        colour = mix.outputs['Result']
    if shading == 'toon':
        # One hard shadow edge over the surface normal (N.L), like cel art.
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        dot = nt.nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = LIGHT
        nt.links.new(geo.outputs['Normal'], dot.inputs[0])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        els = ramp.color_ramp.elements
        els[0].position = 0.0
        els[0].color = (*SHADOW, 1)
        els[1].position = 0.5
        els[1].color = (1, 1, 1, 1)
        hl = els.new(0.93)
        hl.color = (shine, shine, shine, 1)
        hl.position = 0.9 if shine > 1.2 else 0.93
        remap = nt.nodes.new('ShaderNodeMapRange')   # -1..1 -> 0..1
        remap.inputs['From Min'].default_value = -1
        nt.links.new(dot.outputs['Value'], remap.inputs['Value'])
        nt.links.new(remap.outputs['Result'], ramp.inputs['Fac'])
        mul = nt.nodes.new('ShaderNodeMix')
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        mul.inputs['Factor'].default_value = 1
        nt.links.new(colour, mul.inputs['A'])
        nt.links.new(ramp.outputs['Color'], mul.inputs['B'])
        colour = mul.outputs['Result']
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(colour, em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


# --------------------------------------------------------------------------
# Face
# --------------------------------------------------------------------------

def hexa(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def paint_face(path, look):
    """Big anime eyes, readable at the game's size. Styles: 'sleepy'
    (heavy lids, like the drawn patrons), 'bright' (big round eyes, two
    glints), 'cool' (narrow, sharp brows)."""
    from PIL import Image, ImageDraw
    S = P.FACE_PX
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, z0, size = P.FACE_BOX

    def px(x, z):
        return (x - x0) / size * S, (1 - (z - z0) / size) * S

    def L(u):
        return u / size * S

    line = hexa('#1a1024')
    style = look['eyes']
    brow_col = hexa(look['brows'] or look['hair_color'])
    eye_z = 1.115
    w, h = {'sleepy': (0.14, 0.13), 'bright': (0.15, 0.16), 'cool': (0.15, 0.10)}[style]
    for side in (-1, 1):
        cx, cy = px(side * 0.15, eye_z)
        W, H = L(w), L(h)
        box = (cx - W / 2, cy - H / 2, cx + W / 2, cy + H / 2)
        d.ellipse(box, fill=(252, 250, 255, 255))
        ix = cx - side * W * 0.06
        iw, ih = W * 0.66, H * 0.92
        ibox = (ix - iw / 2, cy - ih / 2 + H * 0.06, ix + iw / 2, cy + ih / 2 + H * 0.06)
        d.ellipse(ibox, fill=hexa(look['iris']))
        d.ellipse((ix - iw * 0.26, cy - ih * 0.05, ix + iw * 0.26, cy + ih * 0.42), fill=line)
        g = iw * 0.2
        d.ellipse((ix - iw * 0.22 - g, cy - ih * 0.22 - g, ix - iw * 0.22 + g, cy - ih * 0.22 + g), fill=(255, 255, 255, 255))
        if style == 'bright':
            g2 = g * 0.55
            d.ellipse((ix + iw * 0.2 - g2, cy + ih * 0.22 - g2, ix + iw * 0.2 + g2, cy + ih * 0.22 + g2), fill=(255, 255, 255, 255))
        lid = {'sleepy': cy - H * 0.12, 'bright': cy - H * 0.46, 'cool': cy - H * 0.3}[style]
        if style != 'bright':
            d.rectangle((cx - W / 2 - 6, cy - H, cx + W / 2 + 6, lid), fill=hexa(look['skin']))
        # Thick upper lash line, flicked up at the outer corner.
        lw = int(H * (0.2 if style != 'cool' else 0.26))
        inner_x, outer_x = cx - side * W * 0.55, cx + side * W * 0.6
        d.line((inner_x, lid + H * 0.06, cx, lid - H * 0.02, outer_x, lid - H * 0.12), fill=line, width=lw, joint='curve')
        # Brows.
        by = lid - H * (0.42 if style != 'bright' else 0.3)
        tilt = {'sleepy': 0.0, 'bright': -0.08, 'cool': 0.16}[style]
        d.line((cx - side * W * 0.45, by + H * tilt, cx + side * W * 0.5, by - H * tilt * 0.6),
               fill=brow_col, width=int(H * 0.17))
    # Mouth.
    if style == 'bright':
        mx, my = px(0, 0.99)
        d.chord((mx - L(0.045), my - L(0.03), mx + L(0.045), my + L(0.035)), 0, 180, fill=hexa('#7a2a34'))
    else:
        mx0, my0 = px(-0.04, 0.995)
        mx1, my1 = px(0.045, 1.005 if style == 'sleepy' else 0.995)
        d.line((mx0, my0, mx1, my1), fill=hexa('#8a4040'), width=int(S * 0.007))
    img.save(path)


# --------------------------------------------------------------------------
# Body colours and clothing shells
# --------------------------------------------------------------------------

SLEEVE = {'tee': 0.22, 'jacket': 0.22, 'hoodie': 0.44}   # sleeve end, rest |x|
WRIST_X = 0.44


def face_bones(obj):
    names = [g.name for g in obj.vertex_groups]
    me = obj.data
    vb = [names[max(v.groups, key=lambda g: g.weight).group].replace('mixamorig:', '') if v.groups else 'Head'
          for v in me.vertices]
    out = []
    for p in me.polygons:
        counts = {}
        for vi in p.vertices:
            counts[vb[vi]] = counts.get(vb[vi], 0) + 1
        out.append(max(counts, key=counts.get))
    return out


def body_region(bone, c, sleeve_x):
    if bone.startswith(('LeftFoot', 'RightFoot', 'LeftToe', 'RightToe', 'LeftLeg', 'RightLeg', 'LeftUpLeg', 'RightUpLeg')):
        if c.z < 0.022:
            return 'sole'
        return 'shoe' if c.z < 0.09 else 'bottom'
    if bone == 'Hips' or bone.startswith('Spine'):
        return 'top' if c.z > 0.55 else 'bottom'
    if bone.endswith(('Shoulder', 'Arm')):
        return 'top' if abs(c.x) < sleeve_x else 'skin'
    return 'skin'


def colour_body(body, look, face_path):
    under = look['inner'] or look['top_color']
    mats = {
        'skin': make_material('Skin', look['skin'], look, face=face_path),
        'top': make_material('Top', under, look),
        'bottom': make_material('Bottom', look['bottom_color'], look),
        'shoe': make_material('Shoe', look['shoe_color'], look),
        'sole': make_material('Sole', look['sole'], look),
    }
    me = body.data
    me.materials.clear()
    order = list(mats)
    for k in order:
        me.materials.append(mats[k])
    mw = body.matrix_world
    bones = face_bones(body)
    sleeve = SLEEVE[look['top']]
    for p, b in zip(me.polygons, bones):
        p.material_index = order.index(body_region(b, mw @ p.center, sleeve))
        p.use_smooth = True
    skin_v = set()
    for p in me.polygons:
        if order[p.material_index] == 'skin':
            skin_v.update(p.vertices)
    x0, z0, size = P.FACE_BOX
    uv = me.uv_layers.new(name='FaceUV')
    for loop in me.loops:
        v = me.vertices[loop.vertex_index]
        w = mw @ v.co
        n = (mw.to_3x3() @ v.normal).normalized()
        front = loop.vertex_index in skin_v and w.z > 0.9 and w.y < 0 and n.y < -0.3
        uv.data[loop.index].uv = ((w.x - x0) / size, (w.z - z0) / size) if front else (-1, -1)


def shell(body, name, cover, offset, thickness, material):
    """Clothing worn over the body: a copy of it, pushed out along the
    normals where cover(rest position) is 1 and sunk just inside the body
    where it is 0, so hems and openings are smooth lines wherever the two
    surfaces cross, however coarse the mesh. It keeps the body's bone
    weights, so it moves with him."""
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = name
    obj.modifiers.clear()
    for m in body.modifiers:
        if m.type == 'ARMATURE':
            a = obj.modifiers.new('Armature', 'ARMATURE')
            a.object = m.object
    bpy.context.scene.collection.objects.link(obj)
    mw = body.matrix_world
    inv = mw.inverted()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    amount = {v: cover(mw @ v.co) for v in bm.verts}
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(amount[v] == 0 for v in f.verts)], context='FACES')
    bm.normal_update()
    for v in bm.verts:
        w = mw @ v.co
        c = amount.get(v, 0)
        v.co = inv @ (w + (mw.to_3x3() @ v.normal).normalized() * (c * offset - (1 - c) * 0.015))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for p in obj.data.polygons:
        p.material_index = 0
        p.use_smooth = True
    sol = obj.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness = thickness / mw.to_scale().x
    sol.offset = -1
    return obj


def add_top(body, look, arm):
    if look['top'] == 'jacket':
        mat = make_material('Jacket', look['top_color'], look)

        def cover(c):
            ss = P.smoothstep
            arm_part = abs(c.x) > 0.15
            if arm_part:            # sleeves to the wrist
                return 1 - ss(WRIST_X - 0.03, WRIST_X, abs(c.x))
            hem = ss(0.45, 0.49, c.z)
            collar = 1 - ss(0.85, 0.89, c.z)
            # Open down the front, widening a little toward the hem.
            gap = 0.075 + 0.02 * (1 - ss(0.5, 0.8, c.z))
            front = ss(gap, gap + 0.025, abs(c.x)) if c.y < 0 else 1
            return hem * collar * front
        shell(body, 'Jacket', cover, 0.022, 0.012, mat)
    elif look['top'] == 'hoodie':
        mat = make_material('Hood', look['top_color'], look)
        # The hood, bunched up behind the neck.
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1)
        bmesh.ops.scale(bm, vec=(0.2, 0.11, 0.085), verts=bm.verts)
        me = bpy.data.meshes.new('Hood')
        bm.to_mesh(me)
        bm.free()
        hood = bpy.data.objects.new('Hood', me)
        bpy.context.scene.collection.objects.link(hood)
        hood.data.materials.append(mat)
        for p in me.polygons:
            p.use_smooth = True
        back = max((body.matrix_world @ v.co).y for v in body.data.vertices
                   if 0.8 < (body.matrix_world @ v.co).z < 0.88 and abs((body.matrix_world @ v.co).x) < 0.05)
        hood.matrix_world = Matrix.Translation((0, back - 0.03, 0.87)) @ Matrix.Rotation(math.radians(-15), 4, 'X')
        attach(hood, arm, 'mixamorig:Spine2')


def attach(obj, arm, bone):
    """Parent obj to a bone, keeping where it is (armature in rest pose)."""
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


# --------------------------------------------------------------------------
# Hair and cap
# --------------------------------------------------------------------------

def on_head(u):
    return Vector((HEAD_C.x + u.x * HEAD_R.x, HEAD_C.y + u.y * HEAD_R.y, HEAD_C.z + u.z * HEAD_R.z))


def fib_dirs(n):
    out = []
    g = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        out.append(Vector((r * math.cos(g * i), r * math.sin(g * i), z)))
    return out


def theta_of(u):
    return math.atan2(u.x, -u.y)      # 0 at the face, +-pi at the back


def add_lock(bm, base, tip, radius, segments=7):
    axis = tip - base
    length = axis.length
    geom = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                                 radius1=radius, radius2=radius * 0.06, depth=length)
    rot = axis.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((base + tip) / 2) @ rot, verts=geom['verts'])


def hair_locks(style, rng):
    """(base, tip, radius) for every lock, in rest-pose world space."""
    locks = []
    if style == 'short':
        return locks
    n = {'spiky': 48, 'swept': 56}[style]
    for u in fib_dirs(n):
        th = theta_of(u)
        p = on_head(u)
        if p.z < P.hairline(th) + 0.02:
            continue
        a = abs(th) / math.pi
        base = HEAD_C + (p - HEAD_C) * 0.86
        down = Vector((0, 0, -1))
        tangent = (down - u * down.dot(u))
        tangent = tangent.normalized() if tangent.length > 1e-4 else Vector((0, 1, 0))
        if style == 'spiky':
            if u.z > 0.45:
                # Crown: spikes up and back.
                d = (u + Vector((0, 0.55, 0.2))).normalized()
                length = (0.12 + 0.08 * u.z) * (0.8 + 0.4 * rng.random())
            elif abs(th) < 1.4:
                continue            # nothing hanging over the face
            else:
                # Sides and back: locks lying down the head, tips flicking out.
                d = (tangent + u * 0.35).normalized()
                length = 0.13 * (0.8 + 0.4 * rng.random())
        else:
            # Swept over to his right and back, in long smooth locks.
            side = Vector((-1, 0.4, 0))
            t = side - u * side.dot(u)
            d = (t.normalized() + u * 0.25 + tangent * 0.3).normalized()
            length = 0.16 * (0.8 + 0.4 * rng.random())
        locks.append((base, p + d * length, 0.12 + 0.03 * rng.random()))
    # Fringe: locks hanging over the forehead.
    count = 7 if style == 'spiky' else 9
    spread = 1.4 if style == 'spiky' else 1.9
    for i in range(count):
        th = (i / (count - 1) - 0.5) * spread
        lean = -0.5 if style == 'spiky' else -1.0
        zf = P.hairline(th) + 0.06
        # Point on the head at that angle and height.
        u = Vector((math.sin(th), -math.cos(th), 0))
        uz = (zf - HEAD_C.z) / HEAD_R.z
        u = Vector((u.x * math.sqrt(max(0, 1 - uz * uz)), u.y * math.sqrt(max(0, 1 - uz * uz)), uz))
        p = on_head(u)
        if style == 'spiky':
            d = (Vector((0, 0, -1)) + u * 0.7 + Vector((math.sin(th) * 0.4, 0, 0))).normalized()
            length = 0.08 + 0.03 * rng.random()
        else:
            d = (Vector((lean, 0, -0.55)) + u * 0.45).normalized()
            length = 0.15 + 0.05 * rng.random()
        locks.append((HEAD_C + (p - HEAD_C) * 0.92, p + d * length, 0.07))
    return locks


def add_hair(body, look, arm):
    rng = random.Random(7)
    mat = make_material('Hair', look['hair_color'], look, shine=1.9)
    P.HAIR_THICKNESS = 0.018
    cap = P.add_hair(body)          # the thin shell under the locks fills any gaps
    cap.data.materials.clear()
    cap.data.materials.append(mat)
    if look['hair'] == 'short':
        return
    bm = bmesh.new()
    for base, tip, r in hair_locks(look['hair'], rng):
        add_lock(bm, base, tip, r)
    me = bpy.data.meshes.new('Locks')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new('Locks', me)
    bpy.context.scene.collection.objects.link(obj)
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    attach(obj, arm, 'mixamorig:Head')


def add_cap(look, arm):
    mat = make_material('Cap', look['cap'], look)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0.12], context='VERTS')
    bmesh.ops.scale(bm, vec=HEAD_R * 1.16, verts=bm.verts)
    # Brim: a thin oval slab sticking out in front (its back half is hidden
    # inside the crown).
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=1, radius2=1, depth=0.025)
    bmesh.ops.scale(bm, vec=(0.3, 0.26, 1), verts=geom['verts'])
    bmesh.ops.translate(bm, vec=(0, -0.36, 0.12 * HEAD_R.z * 1.16), verts=geom['verts'])
    me = bpy.data.meshes.new('Cap')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new('Cap', me)
    bpy.context.scene.collection.objects.link(obj)
    sol = obj.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness = 0.02
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    obj.matrix_world = Matrix.Translation(HEAD_C + Vector((0, 0.02, 0.0))) @ Matrix.Rotation(math.radians(-8), 4, 'X')
    attach(obj, arm, 'mixamorig:Head')


# --------------------------------------------------------------------------
# Scene
# --------------------------------------------------------------------------

def lift_head(action, angle):
    """Turn the head up by `angle` on every key of the walk."""
    path = 'pose.bones["mixamorig:Head"].rotation_quaternion'
    curves = sorted((fc for fc in action.fcurves if fc.data_path == path), key=lambda fc: fc.array_index)
    if len(curves) != 4:
        return
    tilt = Quaternion((1, 0, 0), -angle)
    for i in range(len(curves[0].keyframe_points)):
        q = Quaternion([fc.keyframe_points[i].co.y for fc in curves])
        q = q @ tilt
        for j, fc in enumerate(curves):
            k = fc.keyframe_points[i]
            delta = q[j] - k.co.y
            k.co.y += delta
            k.handle_left.y += delta
            k.handle_right.y += delta
    for fc in curves:
        fc.update()


def build(scene, look, tmpdir):
    objs = P.import_clip(os.path.join(P.FBX_DIR, 'walk.fbx'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH')
    action = arm.animation_data.action
    P.walk_in_place(action)
    lift_head(action, HEAD_LIFT)
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    face = os.path.join(tmpdir, f'face_{id(look)}.png')
    paint_face(face, look)
    colour_body(body, look, face)
    add_top(body, look, arm)
    add_hair(body, look, arm)
    if look['cap']:
        add_cap(look, arm)
    arm.data.pose_position = 'POSE'
    root = bpy.data.objects.new('Root', None)
    scene.collection.objects.link(root)
    arm.parent = root
    s = P.HEIGHT / body.dimensions.z
    root.scale = (s, s, s)
    return root, arm


def render_look(key, out_dir):
    look = dict(BASE, **LOOKS[key])
    scene = iso_rig.reset_scene()
    scene.cycles.samples = 32 if look['shading'] == 'soft' else 12
    if look['shading'] != 'soft':
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    root, arm = build(scene, look, out_dir)
    origin = iso_rig.check_projection(scene, cam)
    iso_rig.add_outlines(scene, root)
    # Toon colours are emission, which add_outlines() takes for neon and
    # leaves unlined; the character is all outlined.
    glow = bpy.data.collections.get('NoOutline')
    for o in list(glow.objects) if glow else []:
        glow.objects.unlink(o)
    ls = bpy.context.view_layer.freestyle_settings.linesets[0]
    ls.linestyle.thickness = OUTLINE_PX     # Blender scales it with the render size
    scene.render.resolution_percentage = 100 * ZOOM
    scene.render.use_freestyle = not os.environ.get('NOLINES')
    ls.select_material_boundary = look['shading'] != 'soft'
    ls.select_crease = False
    iso_rig.apply_model_scale(root)
    walk = arm.animation_data.action
    f0, f1 = walk.frame_range
    frame = f0 + (f1 - f0) * 0.25          # passing pose: feet together
    from PIL import Image
    shots = []
    for dname, turn in P.DIRECTIONS:
        root.rotation_euler = (0, 0, turn)
        scene.frame_set(int(frame), subframe=frame % 1)
        path = os.path.join(out_dir, f'look_{key}_{dname}.png')
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        shots.append(Image.open(path).convert('RGBA'))
    return look, shots, origin


def main():
    out_dir = os.path.abspath(sys.argv[1])
    keys = sys.argv[2:] or list(LOOKS)
    os.makedirs(out_dir, exist_ok=True)
    import json
    from PIL import Image
    for key in keys:
        look, shots, origin = render_look(key, out_dir)
        tops = [im.getchannel('A').getbbox() for im in shots]
        json.dump({'title': look['title'], 'origin': origin[:2] if hasattr(origin, '__len__') else list(origin),
                   'boxes': tops}, open(os.path.join(out_dir, f'look_{key}.json'), 'w'))
        print('rendered', key)


if __name__ == '__main__':
    main()
