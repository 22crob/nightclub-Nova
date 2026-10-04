"""Club Nova's modular character: a base body plus swappable appearance
parts, in Nightclub City's cartoon clubgoer style (an original design).

Run from the repo root with a Python that has bpy==4.5.4 and pillow:
    python art/blender/build_character.py OUT_DIR            # build + previews
    python art/blender/build_character.py OUT_DIR --fbx      # also export FBX

Writes OUT_DIR/character_female.blend, preview PNGs, and (with --fbx)
character_female.fbx for rigging in Mixamo.

Everything is built in code (this runs without Blender's window):
  - The body is ONE connected mesh: a stick skeleton given thickness with
    Blender's Skin modifier, then smoothed (Subdivision Surface), so
    torso, limbs and mitten hands flow into each other.
  - The head is a sphere reshaped into the style's wide, round head with
    a small chin; the face (eyes, lids, brows, mouth) is shaped onto its
    surface by casting rays at the head.
  - Hair is metaballs (soft blobs that melt together) converted to a
    mesh: chunky sculpted curls rather than strands.
  - Clothes are shells of the body: copies pushed out where the garment
    covers, sunk inside where it doesn't, so hems are clean curves.
  - Shading: soft two-tone cartoon (a lit colour and a softer shadow,
    blended over a narrow band), muted colours, and dark outlines from an
    inflated "inverted hull" copy of each part.

Parts are separate objects in collections named by slot (Body, Head,
Face, Hair, Top, Jacket, Bottom, Shoes, Hat), so another hair or outfit
can be swapped in by hiding one object and showing another. The base
body proportions live in BASES; only 'female' is built so far.

Proportions are in Blender units with the character standing on z = 0,
facing -Y: about 1.5 tall (the game's patron height), head about 40% of
that.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------
# Base bodies
# --------------------------------------------------------------------------

BASES = {
    'female': dict(
        head_c=(0, 0.0, 1.17), head_r=(0.33, 0.29, 0.32), chin=0.42,
        # Skin skeleton: name -> (position, (radius x, radius y))
        joints={
            'pelvis': ((0, 0, 0.54), (0.085, 0.062)),
            'waist': ((0, 0, 0.635), (0.066, 0.05)),
            'chest': ((0, -0.004, 0.735), (0.078, 0.056)),
            'neck0': ((0, 0, 0.83), (0.034, 0.034)),
            'neck1': ((0, 0, 0.93), (0.03, 0.03)),
            'shoulderL': ((0.085, 0, 0.81), (0.035, 0.035)),
            'elbowL': ((0.2, 0, 0.7), (0.026, 0.026)),
            'wristL': ((0.29, -0.01, 0.6), (0.021, 0.021)),
            'handL': ((0.335, -0.015, 0.545), (0.032, 0.022)),
            'hipL': ((0.058, 0, 0.5), (0.052, 0.052)),
            'kneeL': ((0.062, 0, 0.3), (0.036, 0.038)),
            'ankleL': ((0.064, 0.005, 0.1), (0.028, 0.03)),
        },
        bones=[('pelvis', 'waist'), ('waist', 'chest'), ('chest', 'neck0'), ('neck0', 'neck1'),
               ('chest', 'shoulderL'), ('shoulderL', 'elbowL'), ('elbowL', 'wristL'), ('wristL', 'handL'),
               ('pelvis', 'hipL'), ('hipL', 'kneeL'), ('kneeL', 'ankleL')],
    ),
}

# Muted club palette for the first look.
LOOK = dict(
    skin='#efc3a0', hair='#5b3226', top='#d9cfc2', jacket='#6c5b74', bottom='#3a3e49',
    shoe='#e7e1d6', sole='#8d8781', cap='#7b6b57', eye='#5b3a2a', lines='#1d1420', lips='#b9625a',
)
OUTLINE = '#1a1220'
LIGHT = Vector((-0.35, -0.75, 0.6)).normalized()
HULL = 0.009  # outline thickness, Blender units


def linear(h):
    h = h.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------

def toon(name, hex_color, shadow=0.72, warm=True):
    """Soft cartoon shading: the colour where lit, a softer darker tone in
    shadow, blended over a narrow band (not a hard cel edge), plus a faint
    rim of light. Emission-based, so it looks the same in any lighting."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    base = linear(hex_color)
    tint = (0.92, 0.85, 1.0) if warm else (0.9, 0.9, 1.0)
    dark = tuple(c * shadow * t for c, t in zip(base, tint))
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    dot = nt.nodes.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    dot.inputs[1].default_value = LIGHT
    nt.links.new(geo.outputs['Normal'], dot.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE'
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.36, (*dark, 1)
    e[1].position, e[1].color = 0.5, (*base, 1)
    hi = e.new(0.92)
    hi.color = (*[min(1, c * 1.08) for c in base], 1)
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.inputs['From Min'].default_value = -1
    nt.links.new(dot.outputs['Value'], rng.inputs['Value'])
    nt.links.new(rng.outputs['Result'], ramp.inputs['Fac'])
    # A faint rim light from behind (Fresnel-like), as in the reference.
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.25
    rim = nt.nodes.new('ShaderNodeMath')
    rim.operation = 'MULTIPLY'
    rim.inputs[1].default_value = 0.12
    nt.links.new(lw.outputs['Facing'], rim.inputs[0])
    add = nt.nodes.new('ShaderNodeMix')
    add.data_type = 'RGBA'
    add.blend_type = 'ADD'
    nt.links.new(rim.outputs['Value'], add.inputs['Factor'])
    nt.links.new(ramp.outputs['Color'], add.inputs['A'])
    add.inputs['B'].default_value = (1, 0.95, 1, 1)
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(add.outputs['Result'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    return m


def flat(name, hex_color):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*linear(hex_color), 1)
    nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    return m


def outline_mat():
    m = bpy.data.materials.get('Outline')
    if m:
        return m
    m = bpy.data.materials.new('Outline')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    path = nt.nodes.new('ShaderNodeLightPath')
    seen = nt.nodes.new('ShaderNodeMath')
    seen.operation = 'MULTIPLY'
    nt.links.new(geo.outputs['Backfacing'], seen.inputs[0])
    nt.links.new(path.outputs['Is Camera Ray'], seen.inputs[1])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*linear(OUTLINE), 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(seen.outputs['Value'], mix.inputs['Fac'])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[1])
    nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], nt.nodes['Material Output'].inputs['Surface'])
    return m


# --------------------------------------------------------------------------
# Scene helpers
# --------------------------------------------------------------------------

def collection(name):
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def new_object(name, me, col, material=None, smooth=True):
    obj = bpy.data.objects.new(name, me)
    collection(col).objects.link(obj)
    if material:
        me.materials.append(material)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return obj


def apply_modifiers(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    obj.modifiers.clear()
    old = obj.data
    obj.data = me
    bpy.data.meshes.remove(old)


def bm_to_object(bm, name, col, material=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return new_object(name, me, col, material)


# --------------------------------------------------------------------------
# Body
# --------------------------------------------------------------------------

def mirrored_joints(joints):
    out = {}
    for name, (pos, rad) in joints.items():
        out[name] = (pos, rad)
        if name.endswith('L'):
            out[name[:-1] + 'R'] = ((-pos[0], pos[1], pos[2]), rad)
    return out


def build_body(base):
    joints = mirrored_joints(base['joints'])
    names = list(joints)
    me = bpy.data.meshes.new('Body')
    verts = [joints[n][0] for n in names]
    edges = []
    for a, b in base['bones']:
        edges.append((names.index(a), names.index(b)))
        if a.endswith('L') or b.endswith('L'):
            a2 = a[:-1] + 'R' if a.endswith('L') else a
            b2 = b[:-1] + 'R' if b.endswith('L') else b
            edges.append((names.index(a2), names.index(b2)))
    me.from_pydata(verts, edges, [])
    obj = new_object('Body_Female', me, 'Body', toon('Skin', LOOK['skin']), smooth=False)
    skin = obj.modifiers.new('Skin', 'SKIN')
    skin.use_smooth_shade = True
    skin.branch_smoothing = 0.6
    for i, n in enumerate(names):
        sv = me.skin_vertices[0].data[i]
        sv.radius = joints[n][1]
        if n == 'pelvis':
            sv.use_root = True
    sub = obj.modifiers.new('Smooth', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    apply_modifiers(obj)
    me = obj.data
    me.materials.append(toon('Skin', LOOK['skin']))
    for p in me.polygons:
        p.use_smooth = True
    # A slightly fuller seat and a hint of a bust, kept compact.
    for v in me.vertices:
        c = v.co
        if 0.66 < c.z < 0.79 and c.y < 0 and abs(c.x) < 0.075:
            k = math.sin(math.pi * (c.z - 0.66) / 0.13) * (1 - abs(c.x) / 0.075)
            c.y -= 0.012 * k
        if 0.46 < c.z < 0.6 and c.y > 0:
            k = math.sin(math.pi * (c.z - 0.46) / 0.14)
            c.y += 0.01 * k
    return obj


# --------------------------------------------------------------------------
# Head and face
# --------------------------------------------------------------------------

def build_head(base):
    cx, cy, cz = base['head_c']
    rx, ry, rz = base['head_r']
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1)
    for v in bm.verts:
        x, y, z = v.co
        if z < 0:
            # Narrow to a small chin and a softer jaw.
            t = -z
            v.co.x = x * (1 - base['chin'] * t ** 1.6)
            v.co.y = y * (1 - 0.2 * t ** 2)
            if y < 0:
                v.co.z = z * (1 - 0.06 * t)
        # Flatter face, fuller cranium.
        if v.co.y < 0:
            v.co.y *= 0.92
        else:
            v.co.y *= 1.04
        v.co = Vector((v.co.x * rx + cx, v.co.y * ry + cy, v.co.z * rz + cz))
    obj = bm_to_object(bm, 'Head_Female', 'Head', toon('Skin', LOOK['skin']))
    sub = obj.modifiers.new('Smooth', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    apply_modifiers(obj)
    # Ears: small, low, mostly under the hair.
    for side in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1)
        bmesh.ops.scale(bm, vec=(0.03, 0.045, 0.055), verts=bm.verts)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(-15 * side), 3, 'Z'))
        bmesh.ops.translate(bm, vec=(side * (rx * 0.97), cy + 0.03, cz - 0.07), verts=bm.verts)
        bm_to_object(bm, f'Ear_{"L" if side > 0 else "R"}', 'Head', toon('Skin', LOOK['skin']))
    return obj


def project(head, x, z, out=0.0):
    """The point on the front of the head at screen position (x, z), pushed
    `out` along the surface normal."""
    origin = Vector((x, -2.0, z))
    ok, loc, normal, _ = head.ray_cast(origin, Vector((0, 1, 0)))
    if not ok:
        return None, None
    return loc + normal * out, normal


def surface_disc(head, name, cx, cz, w, h, out, material, segments=32):
    """A flat oval laid onto the face (an eye white, an iris...)."""
    bm = bmesh.new()
    pts = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        p, _ = project(head, cx + w / 2 * math.cos(a), cz + h / 2 * math.sin(a), out)
        if p is None:
            bm.free()
            return None
        pts.append(bm.verts.new(p))
    c, _ = project(head, cx, cz, out)
    center = bm.verts.new(c)
    for i in range(segments):
        bm.faces.new((center, pts[i], pts[(i + 1) % segments]))
    return bm_to_object(bm, name, 'Face', material)


def surface_stroke(head, name, pts2d, out, width, material, taper=True):
    """A tapered ink stroke laid along the face (a lash line, a brow, a
    mouth): a thin ribbon following the head's surface."""
    bm = bmesh.new()
    n = len(pts2d)
    rows = []
    for i, (x, z) in enumerate(pts2d):
        p, normal = project(head, x, z, out)
        if p is None:
            continue
        # Width across the stroke, in the face plane.
        j0, j1 = max(0, i - 1), min(n - 1, i + 1)
        dx, dz = pts2d[j1][0] - pts2d[j0][0], pts2d[j1][1] - pts2d[j0][1]
        L = math.hypot(dx, dz) or 1
        nx, nz = -dz / L, dx / L
        t = i / (n - 1)
        wv = width * (math.sin(math.pi * t) ** 0.6 if taper else 1)
        wv = max(wv, width * 0.15)
        a, _ = project(head, x + nx * wv / 2, z + nz * wv / 2, out)
        b, _ = project(head, x - nx * wv / 2, z - nz * wv / 2, out)
        if a is None or b is None:
            continue
        rows.append((bm.verts.new(a), bm.verts.new(b)))
    for (a0, b0), (a1, b1) in zip(rows, rows[1:]):
        bm.faces.new((a0, b0, b1, a1))
    return bm_to_object(bm, name, 'Face', material)


def build_face(head, base):
    cx, cy, cz = base['head_c']
    rx, ry, rz = base['head_r']
    white = flat('EyeWhite', '#fbf8f6')
    iris = toon('Iris', LOOK['eye'], shadow=0.8)
    ink = flat('Ink', LOOK['lines'])
    glint = flat('Glint', '#ffffff')
    lips = flat('Lips', LOOK['lips'])
    ez = cz - 0.06
    for side in (-1, 1):
        s = 'L' if side > 0 else 'R'
        ex = side * 0.112
        surface_disc(head, f'EyeWhite_{s}', ex, ez, 0.105, 0.128, 0.002, white)
        ix = ex - side * 0.008
        surface_disc(head, f'Iris_{s}', ix, ez - 0.012, 0.072, 0.098, 0.004, iris)
        surface_disc(head, f'Pupil_{s}', ix, ez - 0.012, 0.038, 0.054, 0.005, ink)
        surface_disc(head, f'Glint_{s}', ix - side * 0.013 + 0.0, ez + 0.012, 0.022, 0.026, 0.006, glint)
        surface_disc(head, f'Glint2_{s}', ix + side * 0.016, ez - 0.034, 0.011, 0.011, 0.006, glint)
        # Upper lid: a thick lash line over the eye, flicking out and up
        # at the outer corner (the attitude).
        lid = []
        for k in range(13):
            t = k / 12
            x = ex + 0.057 * math.cos(math.pi * (1 - t)) * side
            z = ez + 0.06 * math.sin(math.pi * t) * 0.9 + 0.006
            lid.append((x, z))
        lid.append((ex + side * 0.075, ez + 0.045))
        surface_stroke(head, f'Lid_{s}', lid, 0.007, 0.016, ink, taper=False)
        # Brow: a short, slightly arched stroke, a little lowered toward
        # the nose (a hint of attitude).
        brow = [(ex + side * (-0.045 + 0.095 * t), ez + 0.1 + 0.018 * math.sin(math.pi * t) + 0.012 * t) for t in [i / 8 for i in range(9)]]
        surface_stroke(head, f'Brow_{s}', brow, 0.007, 0.012, ink)
    # Mouth: a small, lopsided smile.
    mouth = [(-0.03 + 0.065 * t, cz - 0.215 + 0.012 * (t - 0.5) ** 2 * 4 - 0.006 * t) for t in [i / 10 for i in range(11)]]
    mouth = [(x, z - 0.012 * math.sin(math.pi * (x + 0.03) / 0.065)) for x, z in mouth]
    surface_stroke(head, 'Mouth', mouth, 0.006, 0.01, lips)
    # Nose: just a tiny tick of shading.
    surface_stroke(head, 'Nose', [(0.004, cz - 0.15), (0.012, cz - 0.158), (0.004, cz - 0.163)], 0.005, 0.006, flat('NoseTick', '#c98f75'), taper=False)


# --------------------------------------------------------------------------
# Hair (metaballs)
# --------------------------------------------------------------------------

def metaball_mesh(family, balls, resolution=0.011):
    """Melts a list of blobs into one smooth mesh. balls: (x, y, z, r) or
    (x, y, z, r, sx, sy, sz) for an ellipsoid, r being the size wanted (a
    metaball's surface sits at about 60% of its radius, so it's scaled)."""
    mb = bpy.data.metaballs.new(family)
    mb.resolution = mb.render_resolution = resolution
    mb.threshold = 0.5
    obj = bpy.data.objects.new(family, mb)  # its own family: it only melts with itself
    bpy.context.scene.collection.objects.link(obj)
    for b in balls:
        e = mb.elements.new()
        e.co = b[:3]
        e.radius = b[3] / 0.61
        e.stiffness = 2.0
        if len(b) > 4:
            e.type = 'ELLIPSOID'
            e.size_x, e.size_y, e.size_z = b[4:7]
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(obj)
    bpy.data.metaballs.remove(mb)
    return me


def build_hair_curls(base):
    """Long, chunky waves, built as separate clumps (top, side-swept fringe,
    each side, the back) that each melt smooth on their own; their outlines
    where they overlap give the sculpted, chunky look. Joined into one
    object, Hair_Curls."""
    cx, cy, cz = base['head_c']
    rx, ry, rz = base['head_r']
    W = lambda k: 0.03 * (1 if k % 2 else -1)  # alternate a wave in and out
    clumps = {
        # Over the cranium, stopping above the face.
        'Top': [(cx, cy + 0.035, cz + 0.07, 0.3, rx * 1.05 / 0.3, ry * 1.05 / 0.3, rz * 1.0 / 0.3)],
        # A side-swept fringe: from her left temple, across and down to the right.
        'Fringe': [(cx + 0.2, cy - ry * 0.7, cz + 0.2, 0.085), (cx + 0.1, cy - ry * 0.76, cz + 0.205, 0.095),
                   (cx - 0.02, cy - ry * 0.8, cz + 0.18, 0.095), (cx - 0.13, cy - ry * 0.78, cz + 0.13, 0.09),
                   (cx - 0.22, cy - ry * 0.66, cz + 0.06, 0.08)],
        # Each side: waves falling to the shoulders.
        'SideL': [(rx * 0.9 + W(k), cy + 0.07 + 0.04 * k / 3, cz - 0.02 - 0.13 * k, 0.095 - 0.006 * k) for k in range(4)],
        'SideR': [(-rx * 0.9 - W(k), cy + 0.07 + 0.04 * k / 3, cz - 0.04 - 0.13 * k, 0.095 - 0.006 * k) for k in range(4)],
        # The back: a mass to mid-back with a wavy hem.
        'Back': [(cx, cy + ry * 0.75, cz - 0.12, 0.15, 1.4, 0.8, 1.7)]
        + [(x + W(k + int(x * 20)), cy + ry * 0.72 + 0.02 * k, cz - 0.3 - 0.1 * k, 0.085 - 0.008 * k) for k in range(3) for x in (-0.13, 0.0, 0.13)],
    }
    bm = bmesh.new()
    for name, balls in clumps.items():
        me = metaball_mesh(f'HairClump{name}', balls)
        part = bmesh.new()
        part.from_mesh(me)
        bpy.data.meshes.remove(me)
        if name != 'Fringe':
            # Keep the face clear: hair in front of the face, below the
            # brow, sinks back inside the head (eased off toward the sides),
            # leaving a smooth curved hairline instead of a flat cut.
            plane = cy - ry * 0.45
            centre = Vector((cx, cy, cz))
            for v in part.verts:
                if v.co.y < plane and v.co.z < cz + 0.12:
                    k = (1 - smoothstep(rx * 0.6, rx * 0.98, abs(v.co.x))) * (1 - smoothstep(cz + 0.07, cz + 0.12, v.co.z))
                    k *= smoothstep(0, 0.04, plane - v.co.y)
                    v.co = v.co.lerp(centre + (v.co - centre) * 0.8, k)
        tmp = bpy.data.meshes.new('tmp')
        part.to_mesh(tmp)
        part.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    return bm_to_object(bm, 'Hair_Curls', 'Hair', toon('Hair', LOOK['hair'], shadow=0.66))


# --------------------------------------------------------------------------
# Clothes (shells of the body)
# --------------------------------------------------------------------------

def shell(body, name, col, cover, offset, material, thickness=0.006):
    """A garment: the body copied, pushed out by `offset` where cover(p) is
    1 and sunk inside where it is 0 (clean hem lines)."""
    bm = bmesh.new()
    bm.from_mesh(body.data)
    amount = {v: cover(v.co) for v in bm.verts}
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(amount[v] == 0 for v in f.verts)], context='FACES')
    bm.normal_update()
    for v in bm.verts:
        c = amount.get(v, 0)
        v.co = v.co + v.normal * (c * offset - (1 - c) * 0.006)
    obj = bm_to_object(bm, name, col, material)
    sol = obj.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = -1
    return obj


def is_arm(p):
    # Arms hang out and down in the A-pose: lower down, only further out
    # counts as arm (so the hips don't).
    return abs(p.x) > 0.075 + max(0.0, 0.72 - p.z) * 0.9 and p.z > 0.5


def build_top(body):
    ss = smoothstep

    def cover(p):
        if is_arm(p):
            return 0.0
        neck = 1 - ss(0.775, 0.79, p.z + (0.025 if p.y < 0 else 0))  # a scoop neck at the front
        strap = 1.0
        return ss(0.6, 0.615, p.z) * neck * strap
    return shell(body, 'Top_Tank', 'Top', cover, 0.013, toon('Top', LOOK['top']))


def build_jacket(body):
    ss = smoothstep

    def cover(p):
        if is_arm(p):
            # Long sleeves to just above the wrist.
            reach = math.hypot(p.x, p.z - 0.8)
            return 1 - ss(0.33, 0.345, reach)
        hem = ss(0.655, 0.67, p.z)        # cropped
        collar = 1 - ss(0.83, 0.845, p.z)
        open_front = ss(0.03, 0.045, abs(p.x)) if p.y < 0 else 1
        return hem * collar * open_front
    return shell(body, 'Jacket_Cropped', 'Jacket', cover, 0.026, toon('Jacket', LOOK['jacket']), thickness=0.012)


def build_bottom(body):
    ss = smoothstep

    def cover(p):
        if is_arm(p):
            return 0.0
        return (1 - ss(0.615, 0.63, p.z)) * ss(0.12, 0.135, p.z)
    return shell(body, 'Bottom_Slim', 'Bottom', cover, 0.014, toon('Bottom', LOOK['bottom']))


def rounded_box(name, col, center, size, bevel, material, segments=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, affect='EDGES', profile=0.5)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    return bm_to_object(bm, name, col, material)


def build_shoes():
    """Chunky sneakers: a thick sole and a rounded upper, toes forward."""
    up = toon('Shoe', LOOK['shoe'], shadow=0.8)
    sole = toon('Sole', LOOK['sole'], shadow=0.8)
    for side in (-1, 1):
        s = 'L' if side > 0 else 'R'
        x = side * 0.066
        rounded_box(f'Shoe_Sole_{s}', 'Shoes', (x, -0.025, 0.02), (0.1, 0.19, 0.04), 0.018, sole)
        upper = rounded_box(f'Shoe_Upper_{s}', 'Shoes', (x, -0.018, 0.075), (0.092, 0.17, 0.085), 0.035, up, segments=4)
        sub = upper.modifiers.new('Smooth', 'SUBSURF')
        sub.levels = sub.render_levels = 2
        # Toe cap rounder and lower.
        for v in upper.data.vertices:
            if v.co.y < -0.05:
                t = (-0.05 - v.co.y) / 0.06
                v.co.z -= 0.022 * min(1, t) * max(0, (v.co.z - 0.05) / 0.07)


def build_hat_newsboy(base):
    """A slouchy newsboy cap: a soft, full crown tilted back over the hair,
    a short stiff brim at the front, and a button on top."""
    cx, cy, cz = base['head_c']
    rx, ry, rz = base['head_r']
    mat = toon('Cap', LOOK['cap'])
    band = cz + rz * 0.42          # where the cap meets the head
    me = metaball_mesh('HatCrown', [
        (cx, cy + 0.02, band + 0.1, 0.2, 1.65, 1.75, 0.95),
        (cx + 0.04, cy - 0.03, band + 0.14, 0.18, 1.5, 1.55, 0.75),
        # Front panel: fills the crown down to the brim, over the fringe.
        (cx, cy - ry * 0.62, band + 0.0, 0.13, 2.3, 1.0, 0.75),
    ], resolution=0.01)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    # The cut dips at the front so the cap comes down over the fringe.
    front = band - 0.05
    def cut(v):
        t = max(0.0, min(1.0, (cy - v.co.y) / ry))
        return band - 0.01 + (front - band + 0.01) * t * t
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut(v)], context='VERTS')
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(cx, cy, band), matrix=Matrix.Rotation(math.radians(-8), 3, 'X'))
    # Puffed out a little so no curl pokes through.
    bmesh.ops.scale(bm, vec=(1.05, 1.04, 1.04), space=Matrix.Translation((-cx, -cy, -cz)), verts=bm.verts)
    crown = bm_to_object(bm, 'Hat_Newsboy', 'Hat', mat)
    sol = crown.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness = 0.012
    # Brim: a short half-disc out front, angled down a little.
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=1, radius2=1, depth=0.028)
    for v in bm.verts:
        v.co.x *= rx * 0.82
        v.co.y *= 0.17
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0.0, 0),
                           plane_no=(0, 1, 0), clear_outer=True)
    bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(16), 3, 'X'))
    bmesh.ops.translate(bm, vec=(cx, cy - ry * 1.02, band - 0.045), verts=bm.verts)
    brim = bm_to_object(bm, 'Hat_Newsboy_Brim', 'Hat', mat)
    sub = brim.modifiers.new('Smooth', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    rounded_box('Hat_Newsboy_Button', 'Hat', (cx + 0.02, cy - 0.02, band + 0.255), (0.03, 0.03, 0.016), 0.007, mat)


# --------------------------------------------------------------------------
# Outlines, scene, previews
# --------------------------------------------------------------------------

def add_outlines():
    mat = outline_mat()
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH' or obj.name.endswith('_hull'):
            continue
        if any(c.name == 'Face' for c in obj.users_collection):
            continue  # the face is already drawn in ink
        hull = obj.copy()
        hull.data = obj.data.copy()
        hull.name = obj.name + '_hull'
        for c in obj.users_collection:
            c.objects.link(hull)
        hull.data.materials.clear()
        hull.data.materials.append(mat)
        for p in hull.data.polygons:
            p.material_index = 0
        d = hull.modifiers.new('Inflate', 'DISPLACE')
        d.direction = 'NORMAL'
        d.mid_level = 0
        d.strength = HULL


def setup_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.cycles.transparent_max_bounces = 64
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    return scene


def camera(scene, name, rot_z, elev=0.0, ortho=1.75, target=(0, 0, 0.78)):
    cd = bpy.data.cameras.new(name)
    cd.type = 'ORTHO'
    cd.ortho_scale = ortho
    cam = bpy.data.objects.new(name, cd)
    scene.collection.objects.link(cam)
    a = math.radians(rot_z)
    e = math.radians(elev)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = Vector(target) + d * 10
    cam.rotation_euler = (math.radians(90) - e, 0, a)
    return cam


def render_views(scene, out_dir, tag):
    from PIL import Image
    views = [('front', 0, 0), ('side', 90, 0), ('back', 180, 0), ('threequarter', 35, 12)]
    shots = []
    for name, rz, el in views:
        cam = camera(scene, f'Cam_{name}', rz, el)
        scene.camera = cam
        path = os.path.join(out_dir, f'{tag}_{name}.png')
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        shots.append(Image.open(path).convert('RGBA'))
    w, h = shots[0].size
    board = Image.new('RGBA', (w * len(shots), h), (236, 233, 240, 255))
    for i, im in enumerate(shots):
        board.alpha_composite(im, (i * w, 0))
    board = board.resize((board.width // 2, board.height // 2), Image.LANCZOS)
    board.save(os.path.join(out_dir, f'{tag}_board.png'))


def show_only(slots_on):
    """Shows the parts in `slots_on` (collection names), hides the rest."""
    for col in bpy.context.scene.collection.children:
        col.hide_render = col.name not in slots_on


def main():
    out_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else '.')
    os.makedirs(out_dir, exist_ok=True)
    base = BASES['female']
    scene = setup_scene()
    body = build_body(base)
    head = build_head(base)
    build_face(head, base)
    build_hair_curls(base)
    build_top(body)
    build_jacket(body)
    build_bottom(body)
    build_shoes()
    build_hat_newsboy(base)
    add_outlines()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'character_female.blend'))
    show_only({'Body', 'Head', 'Face', 'Hair', 'Top', 'Jacket', 'Bottom', 'Shoes'})
    render_views(scene, out_dir, 'female_outfit')
    show_only({'Body', 'Head', 'Face', 'Hair', 'Top', 'Jacket', 'Bottom', 'Shoes', 'Hat'})
    render_views(scene, out_dir, 'female_hat')
    show_only({'Body', 'Head', 'Face'})
    render_views(scene, out_dir, 'female_base')
    if '--fbx' in sys.argv:
        show_only({'Body', 'Head', 'Face', 'Hair', 'Top', 'Jacket', 'Bottom', 'Shoes'})
        bpy.ops.export_scene.fbx(filepath=os.path.join(out_dir, 'character_female.fbx'), use_selection=False)
    print('done', out_dir)


if __name__ == '__main__':
    main()
