"""Builds Club Nova's chibi patrons in Blender and renders their spritesheets.

Run from the repo root with a Python that has the `bpy` module:
    python art/blender/build_patrons.py            # all characters
    python art/blender/build_patrons.py 0 3        # only characters 0..2

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

CHARACTER_COUNT = 12
FRAME_W, FRAME_H = 112, 176
PX_PER_UNIT = 76            # render pixels per Blender unit, measured on screen
AIM_Z = 1.02                # height the camera centres on
ANIMS = (('idle', 4), ('walk', 8), ('dance', 16))
DIRECTIONS = (('front', 0.0), ('back', math.pi))
COLUMNS = max(n for _, n in ANIMS)

SKIN = ['#ffe3c8', '#f7cba3', '#e2aa7b', '#c78b5b', '#9b6541', '#6b4329']
HAIR_COLORS = ['#1d1a1a', '#3b2415', '#6b3f1f', '#c9954a', '#f2d47c', '#b3322a',
               '#e6e6e6', '#7b3fd6', '#2aa1d6', '#ff5ea8']
TOP_COLORS = ['#e8354a', '#2f7fe0', '#27b36b', '#f5c13a', '#8e44d6', '#ff7a2e',
              '#26262c', '#f2f2f2', '#ff5ea8', '#1fb5c9']
BOTTOM_COLORS = ['#23324f', '#1b1b20', '#4a5a78', '#6b4a2e', '#d9d2c3', '#33333d']
SHOE_COLORS = ['#f4f4f4', '#1b1b1b', '#d62f2f', '#2f6bd6', '#f5c13a']
HAIR_STYLES = ['short', 'spiky', 'long', 'afro', 'bun', 'mohawk', 'cap', 'bald']
TOPS = ['tee', 'tee', 'tank', 'long', 'jacket']
BOTTOMS = ['pants', 'pants', 'shorts', 'skirt']

HEAD_C = Vector((0, 0, 1.36))
HEAD_R = 0.42


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


def sphere(loc, radius, scale, material, parent, outline=True, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
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


def rounded_box(center, size, bevel, material, parent, outline=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
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
    sx, sy, sz = 1.05 * HEAD_R, 0.97 * HEAD_R, 0.95 * HEAD_R
    u = 1 - (x / sx) ** 2 - ((z - HEAD_C.z) / sz) ** 2
    return -sy * math.sqrt(max(u, 0.0)) - lift


# --------------------------------------------------------------------------
# Character
# --------------------------------------------------------------------------

def random_look(index):
    rnd = random.Random(1000 + index)
    look = {
        'skin': SKIN[index % len(SKIN)],
        'hair': HAIR_STYLES[index % len(HAIR_STYLES)],
        'hair_color': rnd.choice(HAIR_COLORS),
        'top': rnd.choice(TOPS),
        'top_color': rnd.choice(TOP_COLORS),
        'inner_color': rnd.choice(TOP_COLORS),
        'bottom': rnd.choice(BOTTOMS),
        'bottom_color': rnd.choice(BOTTOM_COLORS),
        'shoes': rnd.choice(SHOE_COLORS),
        'hat_color': rnd.choice(TOP_COLORS),
        'glasses': rnd.random() < 0.25,
        'headphones': rnd.random() < 0.15,
        'spike_seed': rnd.random(),
    }
    return look


def build_character(look):
    """Returns the rig: pivot empties the posing code moves."""
    skin = mat(look['skin'])
    top = mat(look['top_color'])
    bottom = mat(look['bottom_color'])
    shoe = mat(look['shoes'], rough=0.4)
    hair = mat(look['hair_color'], rough=0.5)
    dark = mat('#141018', rough=0.3, glow=0)

    root = pivot('Root', (0, 0, 0))
    body = pivot('Body', (0, 0, 0), root)

    # Torso and hips.
    torso_mat = mat(look['top_color']) if look['top'] != 'tank' else top
    rounded_box((0, 0, 0.74), (0.34, 0.24, 0.46), 0.08, torso_mat, body)
    if look['top'] == 'jacket':
        rounded_box((0, -0.118, 0.76), (0.1, 0.02, 0.36), 0.01, mat(look['inner_color']), body, outline=False)
    capsule((0, 0, 1.02), (0, 0, 0.9), 0.07, skin, body, outline=False)  # neck
    if look['bottom'] == 'skirt':
        cone((0, 0, 0.26), (0, 0, 0.82), 0.27, bottom, body)  # widens toward the hem
    else:
        rounded_box((0, 0, 0.52), (0.33, 0.23, 0.16), 0.06, bottom, body)

    # Legs hang from hip pivots.
    legs = []
    for side, x in (('L', 0.085), ('R', -0.085)):
        hip = pivot(f'Hip{side}', (x, 0, 0.5), body)
        if look['bottom'] == 'pants':
            capsule((x, 0, 0.5), (x, 0, 0.1), 0.068, bottom, hip)
        elif look['bottom'] == 'shorts':
            capsule((x, 0, 0.5), (x, 0, 0.33), 0.078, bottom, hip)
            capsule((x, 0, 0.36), (x, 0, 0.1), 0.058, skin, hip)
        else:
            capsule((x, 0, 0.45), (x, 0, 0.1), 0.058, skin, hip)
        rounded_box((x, -0.035, 0.05), (0.12, 0.2, 0.1), 0.04, shoe, hip)
        legs.append(hip)

    # Arms hang from shoulder pivots.
    arms = []
    for side, x in (('L', 0.215), ('R', -0.215)):
        sh = pivot(f'Shoulder{side}', (x, 0, 0.9), body)
        sleeve = {'tee': (top, skin), 'tank': (skin, skin), 'long': (top, top), 'jacket': (top, top)}[look['top']]
        capsule((x, 0, 0.92), (x, 0, 0.72), 0.058, sleeve[0], sh)
        capsule((x, 0, 0.75), (x, 0, 0.58), 0.05, sleeve[1], sh)
        sphere((x, 0, 0.53), 0.065, (1, 1, 1), skin, sh)
        arms.append(sh)

    # Head.
    neck = pivot('Neck', (0, 0, 0.98), body)
    sphere(HEAD_C, HEAD_R, (1.05, 0.97, 0.95), skin, neck, segments=32)
    for x in (0.43, -0.43):
        sphere((x, 0.02, 1.33), 0.07, (0.6, 1, 1), skin, neck)
    # Face: big eyes with a shine, brows, blush, small smile.
    for x in (0.13, -0.13):
        y = head_surface_y(x, 1.39)
        sphere((x, y + 0.012, 1.39), 0.085, (0.85, 0.35, 1.3), dark, neck, outline=False)
        sphere((x + 0.03, y - 0.014, 1.44), 0.027, (1, 0.6, 1), mat('#ffffff', glow=1.0), neck, outline=False)
        sphere((x, head_surface_y(x, 1.52) + 0.01, 1.52), 0.05, (1.1, 0.3, 0.25), mat(look['hair_color']), neck, outline=False)
        sphere((x * 1.65, head_surface_y(x * 1.65, 1.27) + 0.01, 1.27), 0.045, (1.2, 0.3, 0.6),
               mat('#ff8fa3', glow=0.3), neck, outline=False)
    sphere((0, head_surface_y(0, 1.23) + 0.01, 1.23), 0.04, (1.2, 0.3, 0.45), mat('#7a2a33'), neck, outline=False)
    if look['glasses']:
        for x in (0.13, -0.13):
            rounded_box((x, head_surface_y(x, 1.4) - 0.02, 1.4), (0.17, 0.03, 0.12), 0.03, dark, neck)
        rounded_box((0, head_surface_y(0, 1.43) - 0.02, 1.43), (0.1, 0.02, 0.02), 0.005, dark, neck, outline=False)

    build_hair(look, hair, neck)
    if look['headphones']:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.47, minor_radius=0.03, location=(0, 0.02, 1.4),
                                         rotation=(0, math.radians(90), 0))
        band = bpy.context.active_object
        _finish(band, mat('#2b2b33', rough=0.3), neck)
        for x in (0.46, -0.46):
            sphere((x, 0.02, 1.34), 0.1, (0.6, 1, 1), mat(look['top_color'], rough=0.3), neck)

    return {'root': root, 'body': body, 'neck': neck, 'legs': legs, 'arms': arms}


def build_hair(look, hair, neck):
    style = look['hair']
    c = HEAD_C
    if style == 'bald':
        return
    if style == 'cap':
        hat = mat(look['hat_color'], rough=0.5)
        hemisphere((c.x, c.y + 0.02, c.z + 0.06), HEAD_R * 1.07, (1.03, 1.0, 0.95), hat, neck)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.24, depth=0.03, location=(0, -0.42, c.z + 0.08))
        brim = bpy.context.active_object
        brim.scale = (1.1, 1.0, 1)
        bpy.ops.object.transform_apply(scale=True)
        _finish(brim, hat, neck)
        sphere((0, 0.05, c.z + 0.46), 0.04, (1, 1, 1), hat, neck)
        return
    if style == 'afro':
        sphere((0, 0.2, c.z + 0.22), 0.55, (1.02, 0.92, 0.9), hair, neck)
        return
    # A cap of hair over the top and back of the head, plus a fringe.
    sphere((0, 0.1, c.z + 0.12), HEAD_R, (1.08, 1.02, 0.98), hair, neck)
    for x in (-0.17, 0.0, 0.17):
        sphere((x, -0.26, c.z + 0.31), 0.14, (1.0, 0.75, 0.5), hair, neck)
    if style == 'spiky':
        rnd = random.Random(look['spike_seed'])
        for i in range(8):
            ang = -math.pi / 2 + (i / 7) * math.pi + rnd.uniform(-0.15, 0.15)
            base = Vector((math.cos(ang) * 0.26, 0.08 + math.sin(ang) * 0.05 + 0.05, c.z + 0.3))
            tip = base + Vector((math.cos(ang) * 0.2, 0.12, 0.28 + rnd.uniform(-0.05, 0.08)))
            cone(base, tip, 0.11, hair, neck)
    elif style == 'mohawk':
        for i, y in enumerate((-0.22, -0.08, 0.06, 0.2)):
            cone((0, y, c.z + 0.34), (0, y + 0.1, c.z + 0.72 - abs(y) * 0.5), 0.1, hair, neck)
    elif style == 'long':
        rounded_box((0, 0.24, 1.28), (0.8, 0.3, 0.62), 0.14, hair, neck)
        for x in (0.36, -0.36):
            capsule((x, -0.05, 1.45), (x, -0.02, 1.02), 0.1, hair, neck)
    elif style == 'bun':
        sphere((0, 0.3, c.z + 0.4), 0.17, (1, 1, 1), hair, neck)
    # 'short' is just the cap and fringe.


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
    # Bright, neutral fill and a plain view transform, so colours stay
    # clean and saturated like the reference game's flat cartoon art.
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.55, 0.55, 0.6, 1)
    bg.inputs['Strength'].default_value = 1.4
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
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

    look = random_look(index)
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


def main():
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
            print(f'patron {index:02d}:', look['hair'], look['top'], look['bottom'], flush=True)


if __name__ == '__main__':
    main()
