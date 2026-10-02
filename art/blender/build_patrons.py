"""Builds Club Nova's chibi clubgoers in Blender and renders their spritesheets.

Run from the repo root with a Python that has the `bpy` module and pillow:
    python art/blender/build_patrons.py            # all characters
    python art/blender/build_patrons.py 0 3        # only characters 0..2
    python art/blender/build_patrons.py preview    # quick lineup of stills

Style target: modern anime-chibi streetwear (big head, glossy anime eyes,
chunky hair locks, bold dark outline, flat two-tone colouring) in a
purple / black / teal / pink club palette.

How it gets there:
  - Cel shading: every material is flat emission coloured by a
    constant-step ramp over the surface normal, so each surface is a base
    colour plus one cool shadow tone (and a small highlight band), like
    drawn art. Scene lights don't affect it.
  - Outline: an inflated, inside-out shell around every part.
  - Faces are painted, not modelled: eyes, brows, mouth and beard are drawn
    into an image with PIL and projected onto the front of the head.
  - Hair is built from many tapered locks, each with its own outline.

Each character is posed frame by frame (limbs hang from pivot empties) and
rendered through the game's 2:1 camera.

Output, in game/src/assets/sprites/patrons/:
    patron_NN.png   one spritesheet per character, 16 columns x 6 rows:
                    idle, walk and dance, each facing front then back
    patrons.json    frame size, anchor point (between the feet), row layout
Front means facing screen down-left; the game mirrors it for down-right,
and mirrors the back row for up-left / up-right.
"""

import json
import math
import zlib
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

FRAME_W, FRAME_H = 112, 200
PX_PER_UNIT = 76            # render pixels per Blender unit, measured on screen
AIM_Z = 1.2                 # height the camera centres on
ANIMS = (('idle', 4), ('walk', 8), ('dance', 16))
# Front faces screen down-left (Blender -Y), turned 25 degrees toward the
# camera so the face reads better; back faces up-right, turned the same way.
TURN = math.radians(25)
DIRECTIONS = (('front', TURN), ('back', math.pi + TURN))
COLUMNS = max(n for _, n in ANIMS)

HEAD_C = Vector((0, 0, 1.36))
HEAD_R = 0.42
HEAD_SCALE = (1.0, 0.96, 1.0)

# Cel-shading light direction (world space) and the tone of shadows.
LIGHT_DIR = Vector((-0.45, -0.6, 0.66)).normalized()
OUTLINE = '#1a1024'

SKIN = ['#fde0cb', '#f2c6a4', '#dba47c', '#b77d55', '#8c5a3a', '#5f3a26']
HAIR = {'black': '#1a1520', 'darkbrown': '#3a2418', 'brown': '#6b4428', 'auburn': '#8a3a22',
        'blonde': '#f3d98f', 'platinum': '#f2ecdf', 'pink': '#ff4fb4', 'purple': '#7a44d8'}
EYES = {'violet': '#7b3fe0', 'blue': '#3a7fe0', 'brown': '#6b3f22', 'pink': '#e03a9a', 'teal': '#1fb3b8'}
C = {  # clothing palette: club purples, blacks, teal, pink
    'black': '#1d1a24', 'charcoal': '#34303d', 'white': '#f2f0f4', 'purple': '#6b3fd6',
    'deeppurple': '#46248f', 'violet': '#9a5cf0', 'teal': '#1fc6c9', 'pink': '#ff3fa4',
    'gold': '#f2c14a', 'denim': '#2f4a7a', 'red': '#e23a3a',
}

# The cast. Each entry picks a build, face, hair and outfit.
#   build: 'm', 'f' or 'bouncer' (stocky, wide chest, thick arms)
#   face:  eyes colour, brows ('cool' | 'soft' | 'stern'), mouth ('smirk' | 'grin' | 'flat')
#   top:   tee, tank, hoodie, puffer, blazer, bomber, crop, track, coat
#   bottom: cargo, jeans, pants, track, skirt
CAST = [
    dict(build='m', skin=0, hair='fluffy', hair_color='blonde', eyes='violet', brows='soft', mouth='smirk',
         top='puffer', top_color='purple', inner='black', bottom='cargo', bottom_color='black',
         shoes='sneakers', shoe_color='white', accent='purple', headphones=True, earring=True),
    dict(build='m', skin=1, hair='swept', hair_color='black', eyes='violet', brows='cool', mouth='smirk',
         top='blazer', top_color='black', inner='black', bottom='pants', bottom_color='black',
         shoes='sneakers', shoe_color='white', accent='purple', shades='purple', chain=True, earring=True),
    dict(build='f', skin=2, hair='buns', hair_color='pink', streak='teal', eyes='pink', brows='soft', mouth='grin',
         top='crop', top_color='black', sleeves=('violet', 'teal'), bottom='cargo', bottom_color='black',
         straps='teal', shoes='sneakers', shoe_color='white', accent='pink', hoops=True),
    dict(build='bouncer', skin=5, hair='cornrows', hair_color='black', eyes='brown', brows='stern', mouth='flat',
         beard=True, top='bomber', top_color='black', bottom='cargo', bottom_color='black',
         shoes='boots', shoe_color='black', earpiece=True, arms_behind=True),
    dict(build='m', skin=1, hair='fluffy', hair_color='brown', eyes='blue', brows='soft', mouth='smirk',
         top='track', top_color='teal', inner='white', bottom='track', bottom_color='teal',
         shoes='sneakers', shoe_color='white', accent='teal'),
    dict(build='f', skin=2, hair='bob', hair_color='black', eyes='violet', brows='cool', mouth='smirk',
         top='coat', top_color='purple', inner='black', bottom='pants', bottom_color='black',
         shoes='boots', shoe_color='black', hoops=True, chain=True),
    dict(build='m', skin=3, hair='emo', hair_color='black', streak='purple', eyes='teal', brows='cool', mouth='flat',
         top='hoodie', top_color='black', bottom='jeans', bottom_color='black',
         shoes='sneakers', shoe_color='black', accent='purple', earring=True),
    dict(build='f', skin=0, hair='long', hair_color='platinum', eyes='blue', brows='soft', mouth='smirk',
         top='crop', top_color='white', sleeves=None, bottom='cargo', bottom_color='charcoal',
         shoes='sneakers', shoe_color='white', accent='teal', chain=True),
    dict(build='m', skin=5, hair='buzz', hair_color='black', eyes='brown', brows='cool', mouth='smirk',
         top='tee', top_color='white', bottom='cargo', bottom_color='black',
         shoes='sneakers', shoe_color='white', accent='gold', shades='black', chain=True),
    dict(build='f', skin=3, hair='ponytail', hair_color='auburn', eyes='brown', brows='cool', mouth='smirk',
         top='bomber', top_color='black', inner='pink', bottom='skirt', bottom_color='black',
         shoes='boots', shoe_color='black', hoops=True),
    dict(build='m', skin=2, hair='beanie', hair_color='darkbrown', hat='purple', eyes='blue', brows='soft', mouth='smirk',
         top='hoodie', top_color='charcoal', bottom='cargo', bottom_color='black',
         shoes='sneakers', shoe_color='white', accent='teal', headphones=True),
    dict(build='bouncer', skin=4, hair='shaved', hair_color='black', eyes='brown', brows='stern', mouth='flat',
         top='tank', top_color='black', bottom='cargo', bottom_color='black',
         shoes='boots', shoe_color='black', shades='black', chain=True, arms_behind=True),
]
CHARACTER_COUNT = len(CAST)


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


def tint(rgb, factor):
    return tuple(min(1.0, c * f) for c, f in zip(rgb, factor))


_mat_cache = {}


def mat(hex_color, shadow=(0.6, 0.55, 0.78), highlight=1.18):
    """Cel-shaded material: flat base colour, one cool shadow tone where the
    surface turns away from LIGHT_DIR, and a thin highlight band where it
    faces it squarely."""
    key = (hex_color, shadow, highlight)
    if key in _mat_cache:
        return _mat_cache[key]
    base = linear(hex_color)
    m = bpy.data.materials.new(f'Toon{hex_color}')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    dot = nt.nodes.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    dot.inputs[1].default_value = LIGHT_DIR
    remap = nt.nodes.new('ShaderNodeMath')
    remap.operation = 'MULTIPLY_ADD'
    remap.inputs[1].default_value = 0.5
    remap.inputs[2].default_value = 0.5
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE'  # soft, glossy shading like Nightclub City's
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*tint(base, shadow), 1)
    ramp.color_ramp.elements[1].position = 0.47
    ramp.color_ramp.elements[1].color = (*base, 1)
    hi = ramp.color_ramp.elements.new(0.93)
    hi.color = (*tint(base, (highlight,) * 3), 1)
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(geo.outputs['Normal'], dot.inputs[0])
    nt.links.new(dot.outputs['Value'], remap.inputs[0])
    nt.links.new(remap.outputs['Value'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    _mat_cache[key] = m
    return m


def outline_mat():
    """Dark where the inflated, inside-out shell faces the camera (only
    visible around the silhouette), transparent elsewhere."""
    if 'outline' in _mat_cache:
        return _mat_cache['outline']
    m = bpy.data.materials.new('Outline')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*linear(OUTLINE), 1)
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

OUTLINE_WIDTH = 0.024


# Nightclub City proportions: everything is modelled on the old chibi body
# (head on a short body, about 2 heads tall), then reshaped: longer legs, a
# taller and slimmer torso, and the head lifted to sit on top, so a
# character is about 2.6 heads tall. warp_z() maps a rest-pose height on the
# old body to the new one.
FEET_Z, HIP_Z, NECK_Z = 0.15, 0.5, 0.98
LEG_STRETCH, TORSO_STRETCH, SLIM = 1.3, 1.0, 0.62
HEAD_LIFT = (HIP_Z - FEET_Z) * (LEG_STRETCH - 1) + (NECK_Z - HIP_Z) * (TORSO_STRETCH - 1)


def warp_z(z):
    if z < FEET_Z:
        return z
    if z < HIP_Z:
        return FEET_Z + (z - FEET_Z) * LEG_STRETCH
    return warp_z(HIP_Z - 1e-9) + (z - HIP_Z) * TORSO_STRETCH


def in_head(parent):
    while parent is not None:
        if parent.name.startswith('Neck'):
            return True
        parent = parent.parent
    return False


def warp_point(p, head):
    if head:
        return Vector((p.x, p.y, p.z + HEAD_LIFT))
    return Vector((p.x * SLIM, p.y * SLIM, warp_z(min(p.z, NECK_Z))))


def warp_mesh(obj, parent):
    """Reshapes a part (still in its rest pose) onto the new proportions."""
    if in_head(parent):
        obj.location.z += HEAD_LIFT  # moved whole, so the face decal's mapping holds
        return
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    inv = mw.inverted()
    head = False
    for v in obj.data.vertices:
        v.co = inv @ warp_point(mw @ v.co, head)


def _finish(obj, material, parent, outline=True, smooth=True, width=OUTLINE_WIDTH, subdivide=True):
    warp_mesh(obj, parent)
    obj.data.materials.append(material)
    # Rounds off every box and tube, so the body reads as soft cartoon
    # shapes rather than blocks.
    if subdivide:
        sub = obj.modifiers.new('Smooth', 'SUBSURF')
        sub.levels = sub.render_levels = 2
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if outline:
        obj.data.materials.append(outline_mat())
        mod = obj.modifiers.new('Outline', 'SOLIDIFY')
        mod.thickness = width
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


def capsule(top, bottom, radius, material, parent, outline=True, radius_bottom=None):
    """A (possibly tapered) cylinder with rounded ends from `top` to `bottom`."""
    top, bottom = Vector(top), Vector(bottom)
    length = (top - bottom).length
    if radius_bottom is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=length, location=(top + bottom) / 2)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius_bottom, radius2=radius, depth=length,
                                        location=(top + bottom) / 2)
    obj = bpy.context.active_object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((top - bottom).normalized())
    mod = obj.modifiers.new('Round', 'BEVEL')
    mod.width = min(radius, radius_bottom or radius) * 0.9
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
    return _finish(obj, material, parent, outline, subdivide=False)  # skirts and coat tails keep their shape


def lock(base, tip, radius, material, parent, flat=0.6, outline=True):
    """One tapered, slightly flattened lock of hair from `base` to `tip`."""
    base, tip = Vector(base), Vector(tip)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=radius, radius2=radius * 0.08,
                                    depth=(tip - base).length, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.scale = (1.0, flat, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((tip - base).normalized())
    obj.location = (base + tip) / 2
    bpy.ops.object.transform_apply(location=True, rotation=True)
    mod = obj.modifiers.new('Soft', 'SUBSURF')
    mod.levels = 1
    return _finish(obj, material, parent, outline, width=OUTLINE_WIDTH * 0.8)


def torus(loc, major, minor, material, parent, rot=(0, 0, 0), scale=(1, 1, 1), outline=True):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, material, parent, outline, width=OUTLINE_WIDTH * 0.6)


def pivot(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = warp_point(Vector(loc), in_head(parent))
    if parent:
        bpy.context.view_layer.update()
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


def head_point(ux, uz, out=1.0):
    """A point on the head's surface: ux in [-1, 1] across, uz in [-1, 1] up,
    on the front (-Y) side; `out` > 1 lifts it off the surface."""
    rx, ry, rz = (s * HEAD_R for s in HEAD_SCALE)
    y = -math.sqrt(max(0.0, 1 - ux * ux - uz * uz))
    return Vector((ux * rx * out, y * ry * out, HEAD_C.z + uz * rz * out))


def head_dir_point(theta, phi, out=1.0):
    """A point on the head's surface by angle: theta around from the front
    (-Y, 0) toward the character's left (+X), phi up from the equator."""
    rx, ry, rz = (s * HEAD_R for s in HEAD_SCALE)
    return Vector((math.sin(theta) * math.cos(phi) * rx * out,
                   -math.cos(theta) * math.cos(phi) * ry * out,
                   HEAD_C.z + math.sin(phi) * rz * out))


# --------------------------------------------------------------------------
# Painted faces
# --------------------------------------------------------------------------

FACE_PX = 1024          # face image size
FACE_SS = 3             # supersampling for smooth painted lines


def paint_face(look, path):
    """Paints eyes, brows, mouth (and beard) into a transparent image that
    covers the front of the head, head-on: x in [-Rx, Rx], z in
    [Cz - Rz, Cz + Rz]."""
    from PIL import Image, ImageDraw

    rx, rz = HEAD_SCALE[0] * HEAD_R, HEAD_SCALE[2] * HEAD_R
    S = FACE_PX * FACE_SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def P(x, z):
        return ((x + rx) / (2 * rx) * S, (1 - (z - (HEAD_C.z - rz)) / (2 * rz)) * S)

    def L(v):  # length in BU to pixels
        return v / (2 * rx) * S

    def ellipse(cx, cz, ex, ez, fill):
        x0, y0 = P(cx - ex, cz + ez)
        x1, y1 = P(cx + ex, cz - ez)
        d.ellipse([x0, y0, x1, y1], fill=fill)

    def rgba(hex_color, a=255):
        h = hex_color.lstrip('#')
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)

    ink = rgba('#1f1226')
    fem = look['build'] == 'f'
    skin_hex = SKIN[look['skin']]

    # Soft blush.
    for side in (1, -1):
        ellipse(0.25 * side, 1.215, 0.06, 0.028, rgba('#ff7fa0', 70 if fem else 35))

    # Beard, painted under the mouth.
    if look.get('beard'):
        beard = rgba(HAIR[look['hair_color']], 255)
        pts = [P(x, z) for x, z in ((-0.33, 1.3), (-0.3, 1.13), (-0.18, 1.02), (0, 0.985), (0.18, 1.02),
                                    (0.3, 1.13), (0.33, 1.3), (0.26, 1.22), (0.12, 1.14), (0, 1.13),
                                    (-0.12, 1.14), (-0.26, 1.22))]
        d.polygon(pts, fill=beard)
        # Moustache.
        d.polygon([P(x, z) for x, z in ((-0.1, 1.2), (0, 1.225), (0.1, 1.2), (0.09, 1.18), (0, 1.195),
                                         (-0.09, 1.18))], fill=beard)

    # Eyes: big dark Nightclub City eyes, just tinted with the eye colour.
    tint_rgb = rgba(EYES[look['eyes']])
    iris = tuple(int(20 + c * 0.22) for c in tint_rgb[:3]) + (255,)
    iris_dark = rgba('#0c0810')
    iris_light = tuple(int(40 + c * 0.35) for c in tint_rgb[:3]) + (255,)
    for side in (1, -1):
        ex, ez = 0.155 * side, 1.335
        ellipse(ex, ez, 0.078, 0.086, rgba('#ffffff'))                     # white
        ellipse(ex - 0.006 * side, ez - 0.006, 0.068, 0.082, iris)         # iris, nearly filling the eye
        ellipse(ex - 0.006 * side, ez - 0.03, 0.045, 0.04, iris_light)    # glow at the bottom
        ellipse(ex - 0.006 * side, ez + 0.02, 0.058, 0.05, iris_dark)      # shade at the top
        ellipse(ex - 0.006 * side, ez - 0.004, 0.027, 0.036, rgba('#140a1c'))   # pupil
        ellipse(ex + 0.022 * side * -1 + 0.0, ez + 0.03, 0.022, 0.026, rgba('#ffffff'))  # big glint
        ellipse(ex + 0.018 * side, ez - 0.035, 0.01, 0.012, rgba('#ffffff'))           # small glint
        # Heavy upper lash line, thicker at the outer corner.
        x0, y0 = P(ex - 0.092, ez + 0.1)
        x1, y1 = P(ex + 0.092, ez - 0.08)
        d.arc([x0, y0, x1, y1], start=195, end=345, fill=ink, width=int(L(0.03 if fem else 0.026)))
        ox = ex + 0.085 * side
        d.polygon([P(ox, ez + 0.035), P(ox + 0.04 * side, ez + 0.06 + (0.02 if fem else 0)),
                   P(ox - 0.01 * side, ez + 0.065)], fill=ink)
        # Lower lid.
        d.arc([x0, y0, x1, y1], start=40, end=140, fill=rgba('#6b3a4a', 160), width=int(L(0.008)))
        # Brows.
        inner, outer = 0.075 * side, 0.235 * side
        style = look['brows']
        zi, zo = {'cool': (1.455, 1.49), 'soft': (1.475, 1.482), 'stern': (1.44, 1.49)}[style]
        brow_col = rgba(HAIR[look['hair_color']] if look['hair'] not in ('shaved', 'buzz', 'cornrows') else '#241810')
        d.line([P(inner, zi), P(outer, zo)], fill=brow_col, width=int(L(0.034 if style != 'soft' else 0.028)))
        ellipse(inner, zi, 0.017, 0.017, brow_col)
        ellipse(outer, zo, 0.012, 0.012, brow_col)

    # Nose: a tiny shaded tick.
    d.line([P(0.012, 1.25), P(-0.008, 1.232)], fill=rgba('#9a5a48', 150), width=int(L(0.01)))

    # Mouth.
    mouth = look['mouth']
    if mouth == 'grin':
        pts = [P(-0.075, 1.19), P(0.075, 1.19), P(0.05, 1.135), P(0, 1.12), P(-0.05, 1.135)]
        d.polygon(pts, fill=rgba('#6b1e36'))
        d.polygon([P(-0.035, 1.14), P(0.035, 1.14), P(0.02, 1.125), P(-0.02, 1.125)], fill=rgba('#ff7a9a'))
        d.line([P(-0.075, 1.19), P(0.075, 1.19)], fill=ink, width=int(L(0.01)))
    elif mouth == 'smirk':
        x0, y0 = P(-0.05, 1.2)
        x1, y1 = P(0.07, 1.15)
        d.arc([x0, y0, x1, y1], start=15, end=150, fill=ink, width=int(L(0.013)))
    else:
        d.line([P(-0.045, 1.17), P(0.045, 1.168)], fill=ink, width=int(L(0.013)))
    if fem and look.get('lips', True):
        pass

    img.resize((FACE_PX, FACE_PX), Image.LANCZOS).save(path)


def face_decal(look, neck, tmp):
    """A shell just outside the head carrying the painted face, projected
    straight onto the front half of the head. Moves with the head."""
    path = os.path.join(tmp, f'face_{id(look)}.png')
    paint_face(look, path)
    image = bpy.data.images.load(path)

    rx, rz = HEAD_SCALE[0] * HEAD_R, HEAD_SCALE[2] * HEAD_R
    projector = pivot('FaceProjector', (-rx, 0, HEAD_C.z - rz), neck)
    projector.scale = (2 * rx, 1, 2 * rz)

    m = bpy.data.materials.new('Face')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    coord = nt.nodes.new('ShaderNodeTexCoord')
    coord.object = projector
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.extension = 'CLIP'
    front = nt.nodes.new('ShaderNodeMath')
    front.operation = 'LESS_THAN'
    front.inputs[1].default_value = 0.0
    mask = nt.nodes.new('ShaderNodeMath')
    mask.operation = 'MULTIPLY'
    em = nt.nodes.new('ShaderNodeEmission')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(coord.outputs['Object'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['X'], comb.inputs['X'])
    nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
    nt.links.new(comb.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(sep.outputs['Y'], front.inputs[0])
    nt.links.new(tex.outputs['Alpha'], mask.inputs[0])
    nt.links.new(front.outputs['Value'], mask.inputs[1])
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(mask.outputs['Value'], mix.inputs['Fac'])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[1])
    nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], nt.nodes['Material Output'].inputs['Surface'])
    sphere(HEAD_C, HEAD_R * 1.006, HEAD_SCALE, m, neck, outline=False, segments=48)


# --------------------------------------------------------------------------
# Character
# --------------------------------------------------------------------------

def look_for(index):
    return CAST[index % len(CAST)]


def build_character(look, tmp):
    """Builds one clubgoer and returns the rig: pivot empties the posing
    code moves."""
    build = look['build']
    bouncer = build == 'bouncer'
    fem = build == 'f'
    skin = mat(SKIN[look['skin']], shadow=(0.82, 0.68, 0.72))
    top = mat(C[look['top_color']])
    bottom = mat(C[look['bottom_color']])
    accent_hex = C.get(look.get('accent', 'purple'), C['purple'])

    root = pivot('Root', (0, 0, 0))
    body = pivot('Body', (0, 0, 0), root)
    chest_w = 0.48 if bouncer else (0.32 if fem else 0.38)

    build_top(look, body, top, skin, chest_w)
    capsule((0, 0, 1.02), (0, 0, 0.9), 0.08 if bouncer else 0.066, skin, body, outline=False)  # neck

    # Hips.
    if look['bottom'] == 'skirt':
        cone((0, 0, 0.32), (0, 0, 0.86), 0.25, bottom, body)
    elif look['top'] == 'coat':
        cone((0, 0, 0.28), (0, 0, 1.0), 0.3, top, body)  # coat tails down to the knees
    else:
        rounded_box((0, 0, 0.53), (chest_w * 0.95, 0.24, 0.17), 0.07, bottom, body)

    # Legs hang from hip pivots. Baggy trousers are wide, with pockets.
    legs = []
    baggy = look['bottom'] in ('cargo', 'track')
    leg_r = 0.085 if (baggy or bouncer) else (0.058 if fem else 0.066)
    for side, x in (('L', 0.09), ('R', -0.09)):
        hip = pivot(f'Hip{side}', (x, 0, 0.5), body)
        if look['bottom'] == 'skirt':
            capsule((x, 0, 0.45), (x, 0, 0.12), 0.058, skin, hip)
        else:
            capsule((x, 0, 0.52), (x, 0, 0.13), leg_r, bottom, hip, radius_bottom=leg_r * 1.05 if baggy else None)
        if look['bottom'] == 'cargo':
            rounded_box((x + 0.07 * (1 if x > 0 else -1), 0, 0.32), (0.05, 0.12, 0.12), 0.02, bottom, hip)
            if look.get('straps'):
                capsule((x + 0.05 * (1 if x > 0 else -1), -0.05, 0.44), (x + 0.07 * (1 if x > 0 else -1), -0.04, 0.2),
                        0.012, mat(C[look['straps']]), hip, outline=False)
        if look['bottom'] == 'track':
            capsule((x + 0.083 * (1 if x > 0 else -1), 0, 0.5), (x + 0.086 * (1 if x > 0 else -1), 0, 0.14),
                    0.014, mat(C['white']), hip, outline=False)
        build_shoe(look, x, hip)
        legs.append(hip)

    # Arms hang from shoulder pivots.
    arms = []
    arm_r = 0.08 if bouncer else (0.05 if fem else 0.058)
    shoulder_x = chest_w / 2 + arm_r * 0.55
    sleeves = sleeve_materials(look, top, skin)
    for side, x in (('L', shoulder_x), ('R', -shoulder_x)):
        sh = pivot(f'Shoulder{side}', (x, 0, 0.9), body)
        puffy = look['top'] in ('puffer',) or look.get('sleeves')
        r_up = arm_r * (1.45 if puffy else 1.0)
        capsule((x, 0, 0.94), (x, 0, 0.72), r_up, sleeves[0], sh)
        capsule((x, 0, 0.76), (x, 0, 0.58), arm_r * (1.35 if puffy else 0.92), sleeves[1], sh)
        if look['top'] == 'track':
            capsule((x + (arm_r + 0.004) * (1 if x > 0 else -1), 0, 0.93), (x + (arm_r + 0.004) * (1 if x > 0 else -1), 0, 0.6),
                    0.013, mat(C['white']), sh, outline=False)
        sphere((x, 0, 0.53), arm_r * 1.05, (1, 1, 1.15), skin, sh)  # hands
        arms.append(sh)

    # Head.
    neck = pivot('Neck', (0, 0, 0.98), body)
    sphere(HEAD_C, HEAD_R, HEAD_SCALE, skin, neck, segments=36)
    for x in (0.415, -0.415):
        sphere((x, 0.02, 1.3), 0.075, (0.55, 1, 1.1), skin, neck)
    face_decal(look, neck, tmp)
    build_hair(look, neck)
    build_accessories(look, neck, body, accent_hex)
    return {'root': root, 'body': body, 'neck': neck, 'legs': legs, 'arms': arms,
            'crossed': bool(look.get('arms_behind')),
            'stance': zlib.crc32(repr(sorted(look.items())).encode()) % len(STANCES)}


# Relaxed standing poses, like Nightclub City's: weight on one leg, a lean,
# a head tilt, arms held a little out. Each character gets one.
#   (hip lean, head tilt, chin, left arm out, right arm out, arms forward, left leg out, right leg out)
STANCES = [
    (0.07, -0.14, -0.06, 0.32, 0.18, 0.12, 0.16, 0.04),   # weight on the right leg, head cocked
    (-0.06, 0.12, -0.04, 0.2, 0.34, 0.08, 0.05, 0.15),    # mirrored
    (0.03, -0.08, -0.1, 0.4, 0.4, 0.2, 0.12, 0.12),       # wide, confident, chin up
]


def sleeve_materials(look, top, skin):
    kind = look['top']
    if look.get('sleeves'):
        upper, lower = look['sleeves']
        return mat(C[upper]), mat(C[lower])
    if kind in ('tank', 'crop'):
        return skin, skin
    if kind == 'tee':
        return top, skin
    return top, top  # hoodie, puffer, blazer, bomber, track, coat


def build_top(look, body, top, skin, chest_w):
    kind = look['top']
    inner_hex = C.get(look.get('inner', 'black'), C['black'])
    depth = 0.25 if look['build'] == 'bouncer' else 0.23
    if kind == 'crop':
        rounded_box((0, 0, 0.83), (chest_w, 0.21, 0.26), 0.09, top, body)
        rounded_box((0, 0, 0.66), (chest_w * 0.86, 0.19, 0.13), 0.06, skin, body)      # midriff
        rounded_box((0, 0, 0.6), (chest_w * 0.92, 0.21, 0.035), 0.012, mat(C['black']), body)  # belt
        if look['top_color'] == 'black':  # little heart print
            sphere((0, -0.108, 0.84), 0.03, (1.2, 0.3, 1), mat(C['pink']), body, outline=False)
        return
    if kind == 'puffer':
        # Stacked puffy bands, open at the front over a dark tee.
        for i, z in enumerate((0.6, 0.73, 0.86, 0.98)):
            w = chest_w * (1.08 - 0.02 * i)
            rounded_box((0, 0, z), (w, depth * 1.2, 0.15), 0.07, top, body)
        rounded_box((0, -0.14, 0.8), (0.1, 0.02, 0.4), 0.01, mat(inner_hex), body, outline=False)
        torus((0, 0, 1.03), 0.12, 0.045, top, body)  # collar
        return
    rounded_box((0, 0, 0.76), (chest_w, depth, 0.46), 0.1, top, body)
    if kind in ('blazer', 'bomber', 'track', 'coat'):
        rounded_box((0, -depth / 2 - 0.002, 0.76), (0.12, 0.02, 0.42), 0.01, mat(inner_hex), body, outline=False)
    if kind == 'blazer':
        for x in (0.08, -0.08):
            rounded_box((x, -depth / 2 - 0.01, 0.88), (0.06, 0.015, 0.18), 0.01, mat('#2b2733'), body,
                        outline=False, rot=(0, 0.35 if x > 0 else -0.35, 0))
        rounded_box((0.12, -depth / 2 - 0.01, 0.86), (0.04, 0.012, 0.025), 0.004, mat(C['pink']), body, outline=False)
    if kind == 'bomber':
        torus((0, 0, 1.0), 0.11, 0.03, mat(C['charcoal']), body)  # ribbed collar
        rounded_box((0, 0, 0.55), (chest_w * 1.02, depth * 1.05, 0.06), 0.03, mat(C['charcoal']), body)  # waistband
    if kind == 'hoodie':
        sphere((0, 0.11, 0.99), 0.18, (1.15, 0.72, 0.55), top, body)  # hood
        for x in (0.05, -0.05):
            capsule((x, -depth / 2 - 0.004, 0.92), (x, -depth / 2 - 0.006, 0.78), 0.009, mat(C['white']), body, outline=False)
        rounded_box((0, -depth / 2 - 0.005, 0.64), (chest_w * 0.6, 0.02, 0.1), 0.02, top, body)  # pocket
    if kind == 'track':
        torus((0, 0, 1.0), 0.1, 0.028, top, body)
    if kind == 'tank':
        for x in (0.11, -0.11):
            sphere((x * chest_w / 0.38, 0, 0.99), 0.075, (1, 1, 0.7), skin, body)  # bare shoulders


def build_shoe(look, x, hip):
    shoe = mat(C.get(look['shoe_color'], C['black']))
    accent = mat(C.get(look.get('accent', 'purple'), C['purple']))
    if look['shoes'] == 'boots':
        rounded_box((x, -0.03, 0.09), (0.15, 0.23, 0.18), 0.05, shoe, hip)
        rounded_box((x, -0.03, 0.015), (0.155, 0.235, 0.03), 0.01, mat('#111016'), hip, outline=False)
        return
    # Chunky sneakers: thick white sole, coloured side panel.
    rounded_box((x, -0.04, 0.07), (0.15, 0.25, 0.1), 0.05, shoe, hip)
    rounded_box((x, -0.04, 0.02), (0.16, 0.26, 0.045), 0.02, mat(C['white']), hip)
    rounded_box((x + 0.077 * (1 if x > 0 else -1), -0.04, 0.075), (0.01, 0.14, 0.05), 0.01, accent, hip, outline=False)


def build_accessories(look, neck, body, accent_hex):
    if look.get('shades'):
        lens = mat(C['deeppurple'] if look['shades'] == 'purple' else '#141218', shadow=(0.7, 0.7, 0.8), highlight=1.6)
        frame = mat('#141218')
        for side in (1, -1):
            p = head_point(0.37 * side, -0.06, out=1.04)
            rounded_box(tuple(p), (0.19, 0.03, 0.13), 0.035, lens, neck)
        p = head_point(0, -0.02, out=1.05)
        rounded_box(tuple(p), (0.12, 0.02, 0.022), 0.005, frame, neck, outline=False)
    if look.get('chain'):
        torus((0, -0.07, 0.94), 0.11, 0.012, mat(C['gold'], highlight=1.5), body, rot=(math.radians(68), 0, 0))
    if look.get('headphones'):
        torus((0, 0, 1.0), 0.17, 0.028, mat('#1b1822'), body)
        for side in (1, -1):
            sphere((0.13 * side, -0.1, 0.99), 0.075, (0.55, 1, 1), mat('#1b1822'), body)
            sphere((0.16 * side, -0.1, 0.99), 0.05, (0.3, 1, 1), mat(accent_hex), body, outline=False)
    ear_z = 1.22
    if look.get('hoops'):
        for side in (1, -1):
            torus((0.43 * side, -0.01, ear_z), 0.05, 0.01, mat(C['gold'], highlight=1.5), neck, rot=(0, math.radians(90), 0))
    if look.get('earring'):
        torus((0.43, -0.01, ear_z + 0.02), 0.022, 0.007, mat('#d8d8e0', highlight=1.5), neck, rot=(0, math.radians(90), 0))
    if look.get('earpiece'):
        sphere((0.44, -0.02, 1.3), 0.03, (1, 1, 1), mat('#141218'), neck)
        capsule((0.44, 0.0, 1.27), (0.36, 0.04, 1.02), 0.008, mat('#d8d8e0'), neck, outline=False)


def build_hair(look, neck):
    style = look['hair']
    hair = mat(HAIR[look['hair_color']], shadow=(0.62, 0.55, 0.8), highlight=1.25)
    streak = mat(HAIR.get(look.get('streak', ''), C.get(look.get('streak', ''), '#ffffff'))) if look.get('streak') else None
    rnd = random.Random(hash(style + look['hair_color']) & 0xffff)
    c = HEAD_C

    def cap(lift=0.1, back=0.08, s=(1.05, 1.03, 1.0)):
        sphere((0, back, c.z + lift), HEAD_R, s, hair, neck, segments=28)

    def ring_locks(count, phi, length, radius, spread=(-2.3, 2.3), droop=-0.35, material=None):
        """Locks sticking out around the head at latitude phi, from angle
        spread[0] to spread[1] (0 = front), drooping downward."""
        for i in range(count):
            th = spread[0] + (spread[1] - spread[0]) * i / max(1, count - 1) + rnd.uniform(-0.12, 0.12)
            base = head_dir_point(th, phi, out=0.92)
            outward = (base - c).normalized()
            tip = base + outward * length + Vector((0, 0, droop * length))
            lock(base, tip, radius * rnd.uniform(0.85, 1.15), material or hair, neck)

    if style == 'shaved':
        return
    if style == 'buzz':
        sphere((0, 0.03, c.z + 0.03), HEAD_R * 1.02, (1.02, 0.99, 0.99), hair, neck)
        return
    if style == 'fluffy':
        # A big messy mop of locks, with a curtain of bangs over the forehead.
        cap(0.12, 0.08, (1.1, 1.08, 1.02))
        ring_locks(9, 0.25, 0.2, 0.13, spread=(0.9, 5.4), droop=-0.5)
        ring_locks(8, 0.75, 0.18, 0.14, spread=(0.3, 6.0), droop=0.3)
        for i, x in enumerate((-0.25, -0.12, 0.0, 0.12, 0.25)):
            base = Vector((x * 0.9, -0.24, c.z + 0.36))
            tip = Vector((x * 1.25 + rnd.uniform(-0.04, 0.04), -0.43, c.z + 0.14 + rnd.uniform(-0.02, 0.03)))
            lock(base, tip, 0.1, hair, neck)
        return
    if style == 'swept':
        # Swept back and up, with one loose lock falling over the forehead.
        cap(0.12, 0.06, (1.07, 1.05, 1.0))
        for i, x in enumerate((-0.24, -0.08, 0.08, 0.24)):
            base = Vector((x, -0.3, c.z + 0.3))
            tip = Vector((x * 1.2, 0.15, c.z + 0.58 + rnd.uniform(-0.03, 0.03)))
            lock(base, tip, 0.13, hair, neck)
        ring_locks(6, 0.1, 0.12, 0.12, spread=(1.4, 4.9), droop=-0.6)
        lock(Vector((0.1, -0.33, c.z + 0.34)), Vector((0.2, -0.45, c.z + 0.12)), 0.07, hair, neck)
        return
    if style == 'buns':
        cap(0.1, 0.06)
        for side in (1, -1):
            bun_c = Vector((0.3 * side, 0.08, c.z + 0.4))
            sphere(tuple(bun_c), 0.17, (1, 1, 1), hair, neck)
            for k in range(5):
                a = k / 5 * math.tau
                d = Vector((math.cos(a), math.sin(a) * 0.6, 0.5)).normalized()
                lock(bun_c + d * 0.1, bun_c + d * 0.26, 0.08, hair, neck)
            # Loose strands hanging from the buns, one of them teal.
            lock(Vector((0.38 * side, -0.05, c.z + 0.1)), Vector((0.45 * side, -0.02, c.z - 0.42)), 0.07,
                 streak if (streak and side == 1) else hair, neck)
        for x in (-0.2, -0.07, 0.07, 0.2):
            lock(Vector((x * 0.9, -0.26, c.z + 0.34)), Vector((x * 1.2, -0.43, c.z + 0.16)), 0.09,
                 streak if (streak and x == 0.07) else hair, neck)
        return
    if style == 'cornrows':
        cap(0.02, 0.02, (1.02, 1.0, 0.98))
        for x in (-0.24, -0.12, 0.0, 0.12, 0.24):
            for k in range(7):
                a = 0.55 + k * 0.33   # from the hairline, over the top, to the back
                p = Vector((x * math.cos(a * 0.4), -math.cos(a) * HEAD_R * 0.98, c.z + math.sin(a) * HEAD_R * 0.98 + 0.06))
                sphere(tuple(p), 0.06, (0.8, 1.2, 0.8), hair, neck, outline=False)
        for x in (-0.2, 0.0, 0.2):
            capsule((x, 0.36, c.z - 0.05), (x * 1.1, 0.42, c.z - 0.5), 0.035, hair, neck)
        return
    if style == 'bob':
        # Sleek, straight, centre part, cut at the jaw.
        cap(0.1, 0.05, (1.08, 1.05, 1.0))
        for side in (1, -1):
            rounded_box((0.34 * side, 0.03, c.z - 0.12), (0.14, 0.66, 0.56), 0.07, hair, neck)
            lock(Vector((0.05 * side, -0.33, c.z + 0.34)), Vector((0.28 * side, -0.34, c.z + 0.05)), 0.12, hair, neck, flat=0.4)
        rounded_box((0, 0.27, c.z - 0.08), (0.74, 0.18, 0.56), 0.08, hair, neck)
        return
    if style == 'emo':
        cap(0.12, 0.08)
        # Long fringe swept over one eye, spiky back.
        for i, (x, z) in enumerate(((-0.22, 0.34), (-0.06, 0.36), (0.1, 0.34))):
            base = Vector((x, -0.25, c.z + z))
            tip = Vector((x + 0.3, -0.44, c.z + 0.02 - i * 0.02))
            lock(base, tip, 0.13, streak if (streak and i == 1) else hair, neck)
        ring_locks(7, 0.35, 0.2, 0.13, spread=(1.8, 4.5), droop=-0.2)
        return
    if style == 'long':
        cap(0.1, 0.06)
        for side in (1, -1):
            lock(Vector((0.3 * side, -0.12, c.z + 0.22)), Vector((0.4 * side, -0.05, c.z - 0.62)), 0.14, hair, neck, flat=0.5)
        rounded_box((0, 0.22, c.z - 0.2), (0.8, 0.24, 0.9), 0.12, hair, neck)
        for x in (-0.18, -0.02, 0.14):
            lock(Vector((x, -0.27, c.z + 0.34)), Vector((x + 0.12, -0.44, c.z + 0.14)), 0.1, hair, neck)
        return
    if style == 'ponytail':
        cap(0.1, 0.06)
        sphere((0, 0.38, c.z + 0.3), 0.07, (1, 1, 1), mat(C['black']), neck)
        lock(Vector((0, 0.44, c.z + 0.34)), Vector((0, 0.56, c.z - 0.45)), 0.14, hair, neck)
        for x in (-0.16, 0.0, 0.16):
            lock(Vector((x, -0.27, c.z + 0.35)), Vector((x + 0.1, -0.43, c.z + 0.18)), 0.1, hair, neck)
        return
    if style == 'beanie':
        beanie = mat(C[look['hat']])
        ring_locks(7, -0.05, 0.15, 0.1, spread=(0.8, 5.5), droop=-0.4)
        for x in (-0.16, 0.0, 0.16):
            lock(Vector((x, -0.3, c.z + 0.24)), Vector((x + 0.06, -0.44, c.z + 0.1)), 0.09, hair, neck)
        hemisphere((0, 0.03, c.z + 0.12), HEAD_R * 1.1, (1.03, 1.0, 1.12), beanie, neck)
        torus((0, 0.03, c.z + 0.14), HEAD_R * 1.09, 0.06, beanie, neck, scale=(1.03, 1.0, 1.0))


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
        neck.rotation_euler.y = 0.04 * math.sin(tau * t)
        if rig['crossed']:
            # Bouncers stand with their hands clasped behind their back.
            armL.rotation_euler = (0.45, 0.0, 0.35)
            armR.rotation_euler = (0.45, 0.0, -0.35)
        else:
            lean, tilt, chin, arm_l, arm_r, fwd, leg_l, leg_r = STANCES[rig['stance']]
            sway = 0.04 * math.sin(tau * t)
            body.rotation_euler.y = lean
            neck.rotation_euler.y = tilt - lean + sway
            neck.rotation_euler.x = chin
            armL.rotation_euler.y = -arm_l - sway
            armR.rotation_euler.y = arm_r + sway
            armL.rotation_euler.x = -fwd
            armR.rotation_euler.x = -fwd * 0.6
            legL.rotation_euler.y = -leg_l - lean
            legR.rotation_euler.y = leg_r - lean
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
    # Flat emission shading needs few samples: just enough to smooth edges.
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.cycles.transparent_max_bounces = 16
    cam = iso_rig.add_camera(scene)
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.ortho_scale = FRAME_H / PX_PER_UNIT
    forward = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    cam.location = Vector((0, 0, AIM_Z)) - forward * 30
    # Materials are self-lit, so the colours must come out exactly as
    # picked: no scene lights or world, plain view transform.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    return scene, cam


def clear_character():
    for obj in list(bpy.data.objects):
        if obj.name != 'IsoCam':
            bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)


def render_character(scene, index, tmp):
    from PIL import Image

    look = look_for(index)
    rig = build_character(look, tmp)
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


def preview(scene, cam, path, zoom=2):
    """One standing still per character, front and back, at `zoom` x size:
    a quick lineup for reviewing designs before the full render."""
    from PIL import Image

    scene.render.resolution_x, scene.render.resolution_y = FRAME_W * zoom, FRAME_H * zoom
    w, h = FRAME_W * zoom, FRAME_H * zoom
    sheet = Image.new('RGBA', (w * 6, h * 4), (205, 198, 238, 255))
    with tempfile.TemporaryDirectory() as tmp:
        for index in range(CHARACTER_COUNT):
            rig = build_character(look_for(index), tmp)
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

    bpy.context.view_layer.update()  # make sure the camera's move has taken effect
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
        'standingHeight': round(((1.84 + HEAD_LIFT) * math.cos(math.radians(30))) * PX_PER_UNIT, 1),
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
