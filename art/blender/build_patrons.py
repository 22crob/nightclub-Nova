"""Builds Club Nova's chibi patrons in Blender and renders their spritesheets.

Run from the repo root with a Python that has the `bpy` module:
    python art/blender/build_patrons.py            # all characters
    python art/blender/build_patrons.py 0 3        # only characters 0..2
    python art/blender/build_patrons.py preview    # quick lineup of stills

Each character is assembled from simple shapes in the style of the
reference game's chibis (big round head, small body, stubby limbs, big
cartoon eyes, dark outline) from a seeded random mix of skin tone, hair,
outfit and accessories. It is posed frame by frame (no armature: limbs hang
from pivot empties) and rendered through the game's 2:1 camera.

Output, in game/src/assets/sprites/patrons/:
    patron_NN.png   one spritesheet per character, 16 columns x 6 rows:
                    idle, walk and dance, each facing front then back
    patrons.json    frame size, anchor point (between the feet), row layout
Front means facing screen down-left; the game mirrors it for down-right,
and mirrors the back row for up-left / up-right.
"""

import json
import math
import os
import random
import sys
import tempfile

import bpy
import bmesh  # noqa: E402  (only importable after bpy)
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(REPO, 'game', 'src', 'assets', 'sprites', 'patrons')

FRAME_W, FRAME_H = 112, 176
PX_PER_UNIT = 76            # render pixels per Blender unit, measured on screen
AIM_Z = 1.02                # height the camera centres on
ANIMS = (('idle', 4), ('walk', 8), ('dance', 16))
# Front faces screen down-left (Blender -Y), turned 25 degrees toward the
# camera so the face reads better; back faces up-right, turned the same way.
TURN = math.radians(25)
DIRECTIONS = (('front', TURN), ('back', math.pi + TURN))
COLUMNS = max(n for _, n in ANIMS)
CHARACTER_COUNT = 12  # len(CAST)

SKIN = ['#f6d2b5', '#e8b995', '#d09a70', '#b07a52', '#8a5a3b', '#5e3b26']
HAIR = {'black': '#17131a', 'darkbrown': '#2f1d13', 'brown': '#5a3a22', 'auburn': '#7a3320',
        'blonde': '#f2d27a', 'platinum': '#f4ecd8'}
EYES = {'blue': '#3f86e0', 'brown': '#6a4125', 'green': '#3d8f5a', 'grey': '#7f8fa3'}
# Club colours: mostly dark and neutral, plus one bright accent per outfit.
CLOTH = {'black': '#1c1b21', 'white': '#eeeeee', 'grey': '#6f6f79', 'purple': '#5c2a8c',
         'burgundy': '#6e1f2e', 'navy': '#243252', 'olive': '#474a2c', 'denim': '#2c3f63',
         'darkdenim': '#1f2a40'}
ACCENT = {'pink': '#ff2d95', 'cyan': '#23c4ff', 'yellow': '#ffd23f', 'violet': '#a855f7',
          'lime': '#56e36b', 'red': '#e8312f'}

# The cast: hand-picked so every character reads as a distinct clubgoer.
#   build: 'm', 'f' or 'bouncer' (stocky, wide chest, thick arms)
#   top: tee, tank, hoodie, jacket (open, over `inner`), crop, dress
#   bottom: jeans, pants, skirt (dress tops bring their own skirt)
#   shoes: sneakers, boots, heels
CAST = [
    dict(build='m', skin=1, hair='emo', hair_color='black', streak='yellow', eyes='blue',
         top='tee', top_color='black', bottom='jeans', bottom_color='darkdenim', shoes='sneakers', shoe_color='black'),
    dict(build='bouncer', skin=3, hair='shaved', hair_color='black', eyes='brown', shades=True,
         top='tee', top_color='black', bottom='pants', bottom_color='black', shoes='boots', shoe_color='black'),
    dict(build='m', skin=0, hair='sideswept', hair_color='blonde', eyes='blue',
         top='tank', top_color='white', bottom='pants', bottom_color='grey', shoes='sneakers', shoe_color='white'),
    dict(build='f', skin=2, hair='long', hair_color='black', eyes='brown', lips='#a3243f',
         top='dress', top_color='purple', shoes='heels', shoe_color='black'),
    dict(build='m', skin=2, hair='quiff', hair_color='darkbrown', eyes='green', chain=True,
         top='jacket', top_color='black', inner='white', bottom='jeans', bottom_color='denim', shoes='sneakers', shoe_color='white'),
    dict(build='f', skin=0, hair='ponytail', hair_color='blonde', eyes='blue', lips='#c2185b',
         top='crop', top_color='black', bottom='skirt', bottom_color='burgundy', shoes='heels', shoe_color='black'),
    dict(build='m', skin=4, hair='fauxhawk', hair_color='black', eyes='brown',
         top='hoodie', top_color='burgundy', bottom='pants', bottom_color='black', shoes='sneakers', shoe_color='white'),
    dict(build='f', skin=1, hair='bob', hair_color='platinum', streak='pink', eyes='grey', lips='#8e1b3a',
         top='tank', top_color='white', bottom='jeans', bottom_color='black', shoes='boots', shoe_color='black'),
    dict(build='m', skin=5, hair='buzz', hair_color='black', eyes='brown', shades=True, chain=True,
         top='tee', top_color='white', bottom='pants', bottom_color='olive', shoes='sneakers', shoe_color='black'),
    dict(build='f', skin=3, hair='long', hair_color='auburn', eyes='green', lips='#b02a45',
         top='jacket', top_color='black', inner='pink', bottom='jeans', bottom_color='darkdenim', shoes='heels', shoe_color='red'),
    dict(build='m', skin=1, hair='beanie', hair_color='brown', hat='grey', eyes='blue',
         top='hoodie', top_color='navy', bottom='jeans', bottom_color='denim', shoes='sneakers', shoe_color='white'),
    dict(build='bouncer', skin=5, hair='shaved', hair_color='black', eyes='brown', shades=True, chain=True,
         top='tank', top_color='black', bottom='pants', bottom_color='black', shoes='boots', shoe_color='black'),
]

HEAD_C = Vector((0, 0, 1.36))
HEAD_R = 0.42
HEAD_SCALE = (1.0, 0.96, 1.0)  # a touch narrower than a ball, less baby-faced


# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------

def linear(hex_color):
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


_mat_cache = {}


def mat(hex_color, rough=0.65, glow=0.55):
    """Soft cartoon material: mostly diffuse, lifted by a little emission of
    its own colour so shadows stay colourful like hand-drawn art."""
    key = (hex_color, rough, glow)
    if key in _mat_cache:
        return _mat_cache[key]
    m = bpy.data.materials.new(f'M{hex_color}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = linear(hex_color)
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = 0.25
    b.inputs['Emission Color'].default_value = (*c, 1)
    b.inputs['Emission Strength'].default_value = glow
    _mat_cache[key] = m
    return m


def outline_mat():
    """Black where the inflated, inside-out shell faces the camera (only
    visible around the silhouette), transparent elsewhere."""
    if 'outline' in _mat_cache:
        return _mat_cache['outline']
    m = bpy.data.materials.new('Outline')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.02, 0.015, 0.03, 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(geo.outputs['Backfacing'], mix.inputs['Fac'])
    nt.links.new(em.outputs['Emission'], mix.inputs[1])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], nt.nodes['Material Output'].inputs['Surface'])
    _mat_cache['outline'] = m
    return m


# --------------------------------------------------------------------------
# Shape helpers. Objects are created in the rest pose in world space, then
# parented (keeping their transform) to a pivot empty.
# --------------------------------------------------------------------------

def _finish(obj, material, parent, outline=True, smooth=True):
    obj.data.materials.append(material)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if outline:
        obj.data.materials.append(outline_mat())
        mod = obj.modifiers.new('Outline', 'SOLIDIFY')
        mod.thickness = 0.018
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.material_offset = 1
        mod.use_rim = False
    bpy.context.view_layer.update()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def sphere(loc, radius, scale, material, parent, outline=True, segments=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.scale = scale
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    return _finish(obj, material, parent, outline)


def hemisphere(loc, radius, scale, material, parent, outline=True):
    """Upper half of a sphere (for caps and hats)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=radius, location=loc)
    obj = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, material, parent, outline)


def capsule(top, bottom, radius, material, parent, outline=True):
    """A cylinder with rounded ends from `top` down to `bottom`."""
    top, bottom = Vector(top), Vector(bottom)
    length = (top - bottom).length
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=length, location=(top + bottom) / 2)
    obj = bpy.context.active_object
    direction = (top - bottom).normalized()
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
    mod = obj.modifiers.new('Round', 'BEVEL')
    mod.width = radius * 0.9
    mod.segments = 4
    mod.limit_method = 'ANGLE'
    return _finish(obj, material, parent, outline)


def rounded_box(center, size, bevel, material, parent, outline=True, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.active_object
    obj.scale = size
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    mod = obj.modifiers.new('Round', 'BEVEL')
    mod.width = bevel
    mod.segments = 4
    return _finish(obj, material, parent, outline)


def cone(base, tip, radius, material, parent, outline=True):
    base, tip = Vector(base), Vector(tip)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=0.0, depth=(tip - base).length,
                                    location=(base + tip) / 2)
    obj = bpy.context.active_object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((tip - base).normalized())
    return _finish(obj, material, parent, outline)


def pivot(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    if parent:
        bpy.context.view_layer.update()
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


def head_surface_y(x, z, lift=0.0):
    """Front (-Y) surface of the head at (x, z), for placing face parts."""
    sx, sy, sz = HEAD_SCALE[0] * HEAD_R, HEAD_SCALE[1] * HEAD_R, HEAD_SCALE[2] * HEAD_R
    u = 1 - (x / sx) ** 2 - ((z - HEAD_C.z) / sz) ** 2
    return -sy * math.sqrt(max(u, 0.0)) - lift


# --------------------------------------------------------------------------
# Character
# --------------------------------------------------------------------------

def look_for(index):
    return CAST[index % len(CAST)]


def build_character(look):
    """Builds one clubgoer and returns the rig: pivot empties the posing
    code moves."""
    build = look['build']
    skin = mat(SKIN[look['skin']])
    top = mat(CLOTH[look['top_color']])
    shoe = mat(CLOTH.get(look['shoe_color'], ACCENT.get(look['shoe_color'], '#1c1b21')), rough=0.35)
    dark = mat('#120e16', rough=0.3, glow=0)
    bottom_hex = CLOTH[look['bottom_color']] if 'bottom_color' in look else CLOTH[look['top_color']]
    bottom = mat(bottom_hex)
    bouncer = build == 'bouncer'
    fem = build == 'f'

    root = pivot('Root', (0, 0, 0))
    body = pivot('Body', (0, 0, 0), root)

    # Torso: a broad chest for the bouncers, a waist for the women.
    chest_w = 0.46 if bouncer else (0.3 if fem else 0.36)
    if look['top'] == 'crop':
        rounded_box((0, 0, 0.84), (chest_w, 0.22, 0.24), 0.08, top, body)
        rounded_box((0, 0, 0.68), (chest_w * 0.85, 0.19, 0.14), 0.06, skin, body)
    else:
        rounded_box((0, 0, 0.76), (chest_w, 0.25 if bouncer else 0.22, 0.44), 0.09, top, body)
    if look['top'] == 'jacket':
        inner_hex = ACCENT.get(look['inner'], CLOTH.get(look['inner']))
        rounded_box((0, -0.112, 0.76), (0.12, 0.02, 0.4), 0.01, mat(inner_hex), body, outline=False)
        for x in (0.075, -0.075):  # lapels
            rounded_box((x, -0.122, 0.88), (0.05, 0.015, 0.16), 0.01, mat('#2a2930'), body, outline=False,
                        rot=(0, 0.35 if x > 0 else -0.35, 0))
    if look['top'] == 'hoodie':
        sphere((0, 0.1, 0.98), 0.17, (1.1, 0.7, 0.5), top, body)  # hood bunched at the back of the neck
        for x in (0.05, -0.05):
            capsule((x, -0.115, 0.9), (x, -0.118, 0.78), 0.008, mat('#dddddd'), body, outline=False)
    if look['top'] == 'tank':
        for x in (0.1, -0.1):
            sphere((x * (chest_w / 0.36), 0, 0.98), 0.07, (1, 1, 0.7), skin, body)  # bare shoulders
    if look.get('chain'):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.012, location=(0, -0.07, 0.93),
                                         rotation=(math.radians(70), 0, 0))
        _finish(bpy.context.active_object, mat('#e8b64a', rough=0.2, glow=0.3), body, outline=False)
    capsule((0, 0, 1.02), (0, 0, 0.9), 0.075 if bouncer else 0.065, skin, body, outline=False)  # neck

    # Hips: a skirt, or the top of the trousers.
    if look['top'] == 'dress' or look.get('bottom') == 'skirt':
        skirt = top if look['top'] == 'dress' else bottom
        cone((0, 0, 0.3), (0, 0, 0.9), 0.25, skirt, body)
    else:
        rounded_box((0, 0, 0.52), (chest_w * 0.92, 0.22, 0.16), 0.06, bottom, body)

    # Legs hang from hip pivots.
    legs = []
    bare_legs = look['top'] == 'dress' or look.get('bottom') == 'skirt'
    leg_r = 0.075 if bouncer else (0.055 if fem else 0.065)
    for side, x in (('L', 0.085), ('R', -0.085)):
        hip = pivot(f'Hip{side}', (x, 0, 0.5), body)
        capsule((x, 0, 0.5), (x, 0, 0.1), leg_r, skin if bare_legs else bottom, hip)
        if look['shoes'] == 'heels':
            rounded_box((x, -0.04, 0.06), (0.08, 0.17, 0.06), 0.025, shoe, hip)
            rounded_box((x, 0.03, 0.02), (0.035, 0.035, 0.05), 0.008, shoe, hip)
        elif look['shoes'] == 'boots':
            rounded_box((x, -0.03, 0.08), (0.13, 0.2, 0.16), 0.04, shoe, hip)
        else:
            rounded_box((x, -0.035, 0.05), (0.12, 0.21, 0.1), 0.04, shoe, hip)
            rounded_box((x, -0.035, 0.012), (0.125, 0.215, 0.025), 0.01, mat('#f2f2f2'), hip, outline=False)
        legs.append(hip)

    # Arms hang from shoulder pivots.
    arms = []
    arm_r = 0.075 if bouncer else (0.045 if fem else 0.055)
    shoulder_x = chest_w / 2 + arm_r * 0.6
    for side, x in (('L', shoulder_x), ('R', -shoulder_x)):
        sh = pivot(f'Shoulder{side}', (x, 0, 0.9), body)
        long_sleeve = look['top'] in ('hoodie', 'jacket')
        upper = skin if look['top'] in ('tank', 'crop', 'dress') else top
        lower = top if long_sleeve else skin
        capsule((x, 0, 0.93), (x, 0, 0.72), arm_r, upper, sh)
        capsule((x, 0, 0.75), (x, 0, 0.58), arm_r * 0.9, lower, sh)
        sphere((x, 0, 0.53), arm_r * 1.15, (1, 1, 1), skin, sh)
        arms.append(sh)

    # Head.
    neck = pivot('Neck', (0, 0, 0.98), body)
    sphere(HEAD_C, HEAD_R, HEAD_SCALE, skin, neck, segments=32)
    for x in (0.415, -0.415):
        sphere((x, 0.02, 1.33), 0.07, (0.6, 1, 1), skin, neck)
    build_face(look, neck, skin, dark)
    build_hair(look, neck)
    return {'root': root, 'body': body, 'neck': neck, 'legs': legs, 'arms': arms}


def build_face(look, neck, skin, dark):
    """Half-lidded almond eyes with coloured irises under heavy, angled
    brows, a small nose and a straight mouth: the cool, unimpressed look of
    the reference game's clubgoers."""
    matte = mat(SKIN[look['skin']], rough=1.0, glow=0.55)
    matte.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0.0
    white = mat('#f4f1ea', glow=0.15)
    iris = mat(EYES[look['eyes']], glow=0.25)
    fem = look['build'] == 'f'
    brow = mat(HAIR[look['hair_color']] if look['hair'] not in ('shaved',) else '#2a1d16', glow=0.1)
    for side in (1, -1):
        x, z = 0.14 * side, 1.37
        y = head_surface_y(x, z)
        # Eye white, a big coloured iris with a pupil and a glint.
        sphere((x, y + 0.02, z), 0.095, (1.0, 0.25, 0.62), white, neck, outline=False)
        sphere((x - 0.01 * side, y + 0.004, z - 0.01), 0.058, (1.0, 0.25, 1.0), iris, neck, outline=False)
        sphere((x - 0.01 * side, y - 0.002, z - 0.01), 0.028, (1.0, 0.25, 1.0), dark, neck, outline=False)
        sphere((x + 0.012, y - 0.006, z + 0.01), 0.013, (1, 0.4, 1), mat('#ffffff', glow=1.0), neck, outline=False)
        # Upper eyelid in skin tone over the top of the eye, with a thick
        # dark lash line along its lower edge: half-closed, cool eyes
        # instead of wide, childlike ones.
        sphere((x, y + 0.0, z + 0.048), 0.1, (1.02, 0.28, 0.4), matte, neck, outline=False)
        sphere((x, y - 0.006, z + 0.022), 0.1, (1.0, 0.22, 0.13 if not fem else 0.18), dark, neck, outline=False,
               rot=(0, -0.1 * side, 0))
        # Heavy brow, lower at the inner end: a cool, confident look.
        bx, bz = 0.14 * side, 1.49
        rounded_box((bx, head_surface_y(bx, bz) - 0.005, bz), (0.17, 0.03, 0.04), 0.014, brow, neck,
                    outline=False, rot=(0, -0.3 * side, 0))
    # Nose and mouth.
    sphere((0, head_surface_y(0, 1.3) - 0.01, 1.3), 0.03, (0.8, 1, 0.9), matte, neck, outline=False)
    lips = mat(look.get('lips', '#6b3a34'), glow=0.2)
    sphere((0.01, head_surface_y(0.01, 1.2) + 0.004, 1.2), 0.05, (1.2, 0.25, 0.2 if not fem else 0.32), lips,
           neck, outline=False, rot=(0, 0.1, 0))
    if look.get('shades'):
        shades = mat('#0c0c10', rough=0.15, glow=0)
        for side in (1, -1):
            x = 0.135 * side
            rounded_box((x, head_surface_y(x, 1.4) - 0.025, 1.4), (0.18, 0.03, 0.1), 0.035, shades, neck)
        rounded_box((0, head_surface_y(0, 1.42) - 0.025, 1.42), (0.12, 0.02, 0.02), 0.005, shades, neck, outline=False)


def build_hair(look, neck):
    style = look['hair']
    hair = mat(HAIR[look['hair_color']], rough=0.35, glow=0.25)
    c = HEAD_C
    if style == 'shaved':
        return
    if style == 'buzz':
        sphere((0, 0.03, c.z + 0.03), HEAD_R * 1.015, (1.02, 0.99, 0.99), hair, neck)
        return

    def cap(lift=0.12):
        sphere((0, 0.1, c.z + lift), HEAD_R, (1.06, 1.02, 0.98), hair, neck)

    streak = mat(ACCENT[look['streak']], glow=0.4) if look.get('streak') else None
    if style == 'emo':
        cap()
        # A long fringe swept across the forehead and over one eye.
        sphere((0.06, -0.3, c.z + 0.2), 0.3, (1.25, 0.38, 0.55), hair, neck, rot=(0, -0.45, 0.15))
        sphere((-0.1, -0.2, c.z + 0.34), 0.22, (1.1, 0.6, 0.45), hair, neck, rot=(0, -0.3, 0))
        if streak:
            sphere((0.12, -0.38, c.z + 0.22), 0.2, (1.3, 0.25, 0.3), streak, neck, outline=False, rot=(0, -0.45, 0.15))
        for x in (0.2, -0.2):
            cone((x, 0.25, c.z + 0.2), (x * 1.6, 0.52, c.z + 0.08), 0.13, hair, neck)
    elif style == 'sideswept':
        cap()
        for i, x in enumerate((-0.18, 0.0, 0.18)):
            sphere((x + 0.04, -0.26, c.z + 0.32 + i * 0.02), 0.17, (1.3, 0.55, 0.5), hair, neck, rot=(0, -0.35, 0))
        sphere((0.3, -0.1, c.z + 0.24), 0.16, (0.8, 1.0, 0.7), hair, neck)
    elif style == 'quiff':
        cap(0.08)
        sphere((0, -0.2, c.z + 0.42), 0.24, (1.15, 0.95, 0.75), hair, neck, rot=(-0.5, 0, 0))
        sphere((0, -0.02, c.z + 0.44), 0.24, (1.0, 1.0, 0.7), hair, neck)
    elif style == 'fauxhawk':
        cap(0.06)
        for y, h in ((-0.22, 0.3), (-0.06, 0.36), (0.1, 0.32), (0.24, 0.22)):
            cone((0, y, c.z + 0.34), (0, y + 0.16, c.z + 0.34 + h), 0.12, hair, neck)
    elif style == 'long':
        cap()
        # Side part: a fringe swept to one side, curtains down past the
        # shoulders and a long back.
        sphere((0.1, -0.28, c.z + 0.28), 0.22, (1.3, 0.5, 0.5), hair, neck, rot=(0, -0.3, 0))
        rounded_box((0, 0.2, 1.12), (0.78, 0.26, 0.86), 0.14, hair, neck)
        for x in (0.37, -0.37):
            capsule((x, -0.08, 1.5), (x * 1.05, 0.02, 0.84), 0.1, hair, neck)
    elif style == 'ponytail':
        cap(0.1)
        sphere((0, -0.26, c.z + 0.3), 0.2, (1.4, 0.45, 0.45), hair, neck)
        sphere((0, 0.36, c.z + 0.3), 0.07, (1, 1, 1), mat('#1c1b21'), neck)
        capsule((0, 0.44, c.z + 0.34), (0, 0.5, c.z - 0.3), 0.1, hair, neck)
    elif style == 'bob':
        cap()
        sphere((0, -0.3, c.z + 0.27), 0.24, (1.5, 0.4, 0.45), hair, neck)  # straight fringe
        for x in (0.33, -0.33):
            rounded_box((x, 0.02, c.z - 0.06), (0.14, 0.62, 0.46), 0.07, hair, neck)
        rounded_box((0, 0.26, c.z - 0.02), (0.72, 0.18, 0.5), 0.08, hair, neck)
        if streak:
            rounded_box((-0.34, -0.08, c.z - 0.06), (0.15, 0.3, 0.44), 0.06, streak, neck, outline=False)
    elif style == 'beanie':
        beanie = mat(CLOTH[look['hat']], rough=0.8, glow=0.2)
        for x in (0.34, -0.34):
            sphere((x, -0.08, c.z + 0.02), 0.12, (0.6, 1, 1.2), hair, neck)
        hemisphere((0, 0.04, c.z + 0.1), HEAD_R * 1.08, (1.02, 1.0, 1.05), beanie, neck)
        bpy.ops.mesh.primitive_torus_add(major_radius=HEAD_R * 1.08, minor_radius=0.05, location=(0, 0.04, c.z + 0.12))
        band = bpy.context.active_object
        band.scale = (1.02, 1.0, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        _finish(band, beanie, neck)


# --------------------------------------------------------------------------
# Posing
# --------------------------------------------------------------------------

def pose(rig, anim, t, facing):
    """Sets the rig for animation `anim` at cycle time t in [0, 1)."""
    root, body, neck = rig['root'], rig['body'], rig['neck']
    legL, legR = rig['legs']
    armL, armR = rig['arms']
    for o in (body, neck, legL, legR, armL, armR):
        o.rotation_euler = (0, 0, 0)
    root.rotation_euler = (0, 0, facing)
    root.location = (0, 0, 0)
    tau = 2 * math.pi

    if anim == 'idle':
        root.location.z = 0.012 * math.sin(tau * t)
        armL.rotation_euler.y = -0.12 - 0.04 * math.sin(tau * t)
        armR.rotation_euler.y = 0.12 + 0.04 * math.sin(tau * t)
        neck.rotation_euler.y = 0.04 * math.sin(tau * t)
    elif anim == 'walk':
        s = math.sin(tau * t)
        legL.rotation_euler.x = 0.6 * s
        legR.rotation_euler.x = -0.6 * s
        armL.rotation_euler.x = -0.55 * s
        armR.rotation_euler.x = 0.55 * s
        armL.rotation_euler.y = -0.1
        armR.rotation_euler.y = 0.1
        root.location.z = 0.04 * abs(math.cos(tau * t))
        body.rotation_euler.z = 0.08 * s
    elif anim == 'dance':
        beat = t * 4                      # four beats per cycle
        bounce = abs(math.sin(math.pi * beat))
        root.location.z = 0.07 * bounce
        pump = 0.5 + 0.5 * math.sin(math.pi * beat)   # alternates each beat
        # Short chibi arms vanish behind the head if raised straight up, so
        # they pump out to the sides and forward instead.
        armL.rotation_euler.y = -(0.4 + 1.5 * pump)
        armR.rotation_euler.y = 0.4 + 1.5 * (1 - pump)
        armL.rotation_euler.x = -0.9 * pump
        armR.rotation_euler.x = -0.9 * (1 - pump)
        body.rotation_euler.y = 0.14 * math.sin(math.pi * beat)
        body.rotation_euler.z = 0.2 * math.sin(tau * t)
        neck.rotation_euler.x = 0.12 * bounce
        neck.rotation_euler.y = -0.1 * math.sin(math.pi * beat)
        legL.rotation_euler.x = 0.18 * math.sin(math.pi * beat)
        legR.rotation_euler.x = -0.18 * math.sin(math.pi * beat)
        legL.rotation_euler.y = -0.08
        legR.rotation_euler.y = 0.08


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

def setup_scene():
    scene = iso_rig.reset_scene()
    scene.render.resolution_x = FRAME_W
    scene.render.resolution_y = FRAME_H
    scene.cycles.samples = 24
    cam = iso_rig.add_camera(scene)
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.ortho_scale = FRAME_H / PX_PER_UNIT
    forward = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    cam.location = Vector((0, 0, AIM_Z)) - forward * 30
    iso_rig.add_lighting(scene)
    for name, factor in (('Key', 1.4), ('Fill', 1.6), ('Rim', 1.3)):
        bpy.data.objects[name].data.energy *= factor
    # Bright, neutral fill and a plain view transform, so colours stay
    # clean and saturated like the reference game's flat cartoon art.
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.55, 0.55, 0.6, 1)
    bg.inputs['Strength'].default_value = 2.3
    # AgX rolls off bright highlights instead of clipping them to white
    # (small upward-facing bumps like eyelids and noses face the key light
    # head-on); the Punchy look keeps colours saturated.
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    return scene, cam


def clear_character():
    keep = {'IsoCam', 'Key', 'Fill', 'Rim'}
    for obj in list(bpy.data.objects):
        if obj.name not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def render_character(scene, index, tmp):
    from PIL import Image

    look = look_for(index)
    rig = build_character(look)
    sheet = Image.new('RGBA', (FRAME_W * COLUMNS, FRAME_H * len(ANIMS) * len(DIRECTIONS)), (0, 0, 0, 0))
    row = 0
    for anim, count in ANIMS:
        for _, facing in DIRECTIONS:
            for f in range(count):
                pose(rig, anim, f / count, facing)
                path = os.path.join(tmp, 'frame.png')
                scene.render.filepath = path
                bpy.ops.render.render(write_still=True)
                sheet.paste(Image.open(path).convert('RGBA'), (f * FRAME_W, row * FRAME_H))
            row += 1
    out = os.path.join(OUT_DIR, f'patron_{index:02d}.png')
    save_compact(sheet, out)
    clear_character()
    return look


def save_compact(sheet, path):
    """Flat cartoon colours survive a 256-colour palette with no visible
    change, and the file comes out a fraction of the size."""
    from PIL import Image
    sheet.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)


def preview(scene, cam, path):
    """One standing still per character, front and back, at double size:
    a quick lineup for reviewing designs before the full render."""
    from PIL import Image

    scene.render.resolution_x, scene.render.resolution_y = FRAME_W * 2, FRAME_H * 2
    cam.data.ortho_scale = FRAME_H / PX_PER_UNIT
    scene.cycles.samples = 32
    w, h = FRAME_W * 2, FRAME_H * 2
    sheet = Image.new('RGBA', (w * 6, h * 4), (72, 72, 82, 255))
    with tempfile.TemporaryDirectory() as tmp:
        for index in range(CHARACTER_COUNT):
            rig = build_character(look_for(index))
            for k, (_, facing) in enumerate(DIRECTIONS):
                pose(rig, 'idle', 0, facing)
                scene.render.filepath = os.path.join(tmp, 'p.png')
                bpy.ops.render.render(write_still=True)
                col, row = index % 6, (index // 6) * 2 + k
                sheet.alpha_composite(Image.open(scene.render.filepath).convert('RGBA'), (col * w, row * h))
            clear_character()
            print('previewed', index, flush=True)
    sheet.save(path)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        scene, cam = setup_scene()
        preview(scene, cam, sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'patrons_preview.png'))
        return
    first = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    last = int(sys.argv[2]) if len(sys.argv) > 2 else CHARACTER_COUNT
    os.makedirs(OUT_DIR, exist_ok=True)
    scene, cam = setup_scene()

    v = world_to_camera_view(scene, cam, Vector((0, 0, 0)))
    rows = {}
    r = 0
    for anim, _ in ANIMS:
        for direction, _ in DIRECTIONS:
            rows[f'{anim}_{direction}'] = r
            r += 1
    meta = {
        'frameWidth': FRAME_W,
        'frameHeight': FRAME_H,
        'columns': COLUMNS,
        'originX': round(v.x, 5),
        'originY': round(1 - v.y, 5),
        # Height of a standing character in render pixels, head to feet, so
        # the game can scale sprites to its own character height.
        'standingHeight': round((1.84 * math.cos(math.radians(30))) * PX_PER_UNIT, 1),
        'rows': rows,
        'frames': {anim: n for anim, n in ANIMS},
        'count': CHARACTER_COUNT,
    }
    with open(os.path.join(OUT_DIR, 'patrons.json'), 'w') as f:
        json.dump(meta, f, indent=2)
        f.write('\n')

    with tempfile.TemporaryDirectory() as tmp:
        for index in range(first, last):
            look = render_character(scene, index, tmp)
            print(f'patron {index:02d}:', look['build'], look['hair'], look['top'], flush=True)


if __name__ == '__main__':
    main()
