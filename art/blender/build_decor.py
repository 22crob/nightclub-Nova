"""Builds Club Nova's decorations in Blender and renders their sprites.

Run from the repo root with a Python that has the `bpy` module and pillow:
    python art/blender/build_decor.py                  # all decorations
    python art/blender/build_decor.py speaker lava     # only some
    python art/blender/build_decor.py --preview DIR speaker
        # facing 0 only, written to DIR, for a quick look before a full render

Decorations sit on one tile (x, y in [-0.5, 0.5]) unless noted, and face -Y
at rest. See art/REFERENCE_NOTES.md for the look we're going for. For
scale: a bar counter is 1.0 tall and a patron about 1.5. Nightclub City's
speakers are about 2x a DJ booth.

Each decoration writes decor_<name>_{0,90,180,270}.png and
decor_<name>.json to game/src/assets/sprites/, and decor_<name>.blend here.
"""

import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_bar as bb  # noqa: E402
from build_bars import neon_tube, plain, srgb  # noqa: E402

box, cylinder, cone = bb.box, bb.cylinder, bb.cone
principled, neon = bb.principled, bb.neon


def sphere(name, x, y, z, r, mat, scale=(1, 1, 1), segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=r, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    return bb._finish(obj, mat, 0)


def tilted(obj, rx=0.0, ry=0.0, rz=0.0):
    obj.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    return obj


def frond(name, x, y, z, length, width, angle, droop, mat):
    """A leaf: a flattened ellipsoid pointing out at `angle` (degrees around
    Z), tipped down by `droop` degrees."""
    a = math.radians(angle)
    cx = x + math.cos(a) * length * 0.5 * math.cos(math.radians(droop))
    cy = y + math.sin(a) * length * 0.5 * math.cos(math.radians(droop))
    cz = z - length * 0.5 * math.sin(math.radians(droop))
    obj = sphere(name, cx, cy, cz, 1.0, mat, scale=(length * 0.5, width, 0.02), segments=16)
    obj.rotation_euler = (0, math.radians(droop), a)
    return obj


def ring_y(name, x, y, z, major, minor, mat):
    """A torus standing upright, facing -Y (like a speaker's woofer ring)."""
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=(x, y, z),
                                     rotation=(math.radians(90), 0, 0), major_segments=40, minor_segments=10)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return bb._finish(obj, mat, 0)


def disc_y(name, x, y, z, r, depth, mat):
    """A flat disc facing -Y."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=r, depth=depth, location=(x, y, z),
                                        rotation=(math.radians(90), 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return bb._finish(obj, mat, 0)


# --------------------------------------------------------------------------
# Speaker tower: a tall black cabinet, big woofer below and a smaller one
# above, each with a glowing cyan ring.
# --------------------------------------------------------------------------

def build_speaker():
    cab = principled('SpkCab', srgb('#2a2b31'), rough=0.35)
    trim = plain('#5d5f68', rough=0.3)
    cone_mat = principled('SpkCone', srgb('#121216'), rough=0.6)
    dust = principled('SpkDust', srgb('#3a3b42'), rough=0.3)
    cyan = neon('SpkCyan', (0.1, 0.85, 1.0), 9)
    H = 2.35
    front = -0.33
    box('Feet', -0.36, 0.36, -0.31, 0.31, 0, 0.06, trim, bevel=0.01)
    box('Cabinet', -0.38, 0.38, front, 0.33, 0.06, H - 0.04, cab, bevel=0.035)
    box('Cap', -0.39, 0.39, front - 0.01, 0.34, H - 0.05, H, plain('#4a4c55', rough=0.75), bevel=0.02)
    for name, z, r in (('Big', 0.66, 0.28), ('Small', 1.45, 0.2)):
        disc_y(f'{name}Cone', 0, front - 0.005, z, r, 0.02, cone_mat)
        sphere(f'{name}Dust', 0, front - 0.02, z, r * 0.32, dust, scale=(1, 0.45, 1))
        ring_y(f'{name}Ring', 0, front - 0.02, z, r + 0.012, 0.022, cyan)
        ring_y(f'{name}Surround', 0, front - 0.012, z, r * 0.78, 0.012, trim)
    # Tweeter and a port slot near the top.
    disc_y('Tweeter', 0, front - 0.005, 1.92, 0.07, 0.02, cone_mat)
    ring_y('TweeterRing', 0, front - 0.015, 1.92, 0.08, 0.012, cyan)
    box('Port', -0.22, 0.22, front - 0.004, front + 0.01, 2.12, 2.18, cone_mat, bevel=0.01)


# --------------------------------------------------------------------------
# Lava lamp: a big one, on its own stand, glowing red-orange.
# --------------------------------------------------------------------------

def build_lava():
    metal = plain('#b9bcc8', rough=0.2)
    glass = principled('LavaGlass', (0.8, 0.05, 0.12), rough=0.1, emission=(0.9, 0.03, 0.1), emission_strength=0.5, alpha=0.6)
    blob = principled('LavaBlob', (1.0, 0.55, 0.05), rough=0.3, emission=(1.0, 0.45, 0.02), emission_strength=1.2)
    cone('Base', 0, 0, 0, 0.55, 0.3, 0.14, metal, verts=40)
    cylinder('Collar', 0, 0, 0.55, 0.62, 0.15, metal, verts=40)
    cone('GlassLow', 0, 0, 0.62, 1.25, 0.14, 0.2, glass, verts=40)
    cone('GlassHigh', 0, 0, 1.25, 1.75, 0.2, 0.11, glass, verts=40)
    cone('Cap', 0, 0, 1.75, 1.95, 0.12, 0.06, metal, verts=40)
    for i, (x, y, z, r) in enumerate([(0.0, 0.0, 0.78, 0.09), (0.04, -0.02, 1.08, 0.07), (-0.05, 0.02, 1.4, 0.06),
                                     (0.02, 0.0, 1.62, 0.045)]):
        sphere(f'Blob{i}', x, y, z, r, blob, scale=(1, 1, 1.35))


# --------------------------------------------------------------------------
# Aquarium: a glowing blue glass tank with fish and plants on a cabinet.
# --------------------------------------------------------------------------

def build_aquarium():
    cabinet = principled('AquaCab', srgb('#1d1a24'), rough=0.3)
    trim = plain('#b8bcc8', rough=0.25)
    water = principled('AquaWater', (0.05, 0.35, 0.9), rough=0.05, emission=(0.03, 0.25, 0.9), emission_strength=0.5, alpha=0.4)
    back = principled('AquaBack', srgb('#0a2a6a'), rough=0.6, emission=srgb('#1650c0'), emission_strength=0.6)
    gravel = plain('#d8c38a', rough=0.8)
    plant = principled('AquaPlant', srgb('#2bd46a'), rough=0.5, emission=srgb('#1a8a40'), emission_strength=1.2)
    fish_o = principled('AquaFishO', srgb('#ff8a1f'), rough=0.3, emission=srgb('#ff6a00'), emission_strength=1.8)
    fish_y = principled('AquaFishY', srgb('#ffe03a'), rough=0.3, emission=srgb('#ffb000'), emission_strength=1.8)
    lamp = neon('AquaLamp', (0.6, 0.9, 1.0), 6)
    box('Cabinet', -0.42, 0.42, -0.4, 0.4, 0, 0.55, cabinet, bevel=0.03)
    box('CabTrim', -0.43, 0.43, -0.41, 0.41, 0.52, 0.58, trim, bevel=0.01)
    box('Gravel', -0.38, 0.38, -0.36, 0.36, 0.58, 0.68, gravel, bevel=0.01)
    box('BackWall', -0.39, 0.39, 0.36, 0.38, 0.68, 1.68, back, bevel=0)
    box('SideWall', -0.4, -0.38, -0.37, 0.38, 0.68, 1.68, back, bevel=0)
    box('Water', -0.4, 0.4, -0.38, 0.38, 0.58, 1.68, water, bevel=0.02)
    box('Lid', -0.43, 0.43, -0.41, 0.41, 1.68, 1.76, trim, bevel=0.012)
    box('LidLamp', -0.36, 0.36, -0.42, -0.41, 1.7, 1.73, lamp, bevel=0)
    for i, (x, y, h) in enumerate([(-0.25, 0.18, 0.55), (-0.15, 0.25, 0.75), (0.22, 0.2, 0.62), (0.28, 0.05, 0.4)]):
        cone(f'Plant{i}', x, y, 0.68, 0.68 + h, 0.07, 0.01, plant, verts=10)
    # Fish and bubbles move in the game (src/scene/tankFx.js).


# --------------------------------------------------------------------------
# Plants
# --------------------------------------------------------------------------

def build_fern():
    pot = plain('#c0643a', rough=0.6)
    rim = plain('#d4784c', rough=0.6)
    soil = plain('#3a2616', rough=0.9)
    leaf = principled('FernLeaf', srgb('#3fae4a'), rough=0.5)
    leaf2 = principled('FernLeaf2', srgb('#5cc95a'), rough=0.5)
    cone('Pot', 0, 0, 0, 0.42, 0.2, 0.27, pot, verts=32)
    cylinder('Rim', 0, 0, 0.4, 0.47, 0.29, rim, verts=32)
    cylinder('Soil', 0, 0, 0.44, 0.46, 0.26, soil, verts=32)
    for i in range(12):
        frond(f'Leaf{i}', 0, 0, 0.62 + (i % 3) * 0.06, 0.62, 0.075, i * 30 + (i % 2) * 12, 18 + (i % 3) * 12,
              leaf if i % 2 else leaf2)
    for i in range(5):
        frond(f'Top{i}', 0, 0, 0.7, 0.45, 0.07, i * 72 + 20, -35, leaf2)


def build_palm():
    pot = principled('PalmPot', srgb('#f2f0ea'), rough=0.25)
    band = plain('#c9a24a', rough=0.35)
    soil = plain('#3a2616', rough=0.9)
    trunk = plain('#8a6238', rough=0.8)
    ring = plain('#6b4826', rough=0.8)
    leaf = principled('PalmLeaf', srgb('#2f9a3e'), rough=0.5)
    leaf2 = principled('PalmLeaf2', srgb('#4cbb4a'), rough=0.5)
    cylinder('Pot', 0, 0, 0, 0.5, 0.27, pot, verts=32)
    cylinder('Band', 0, 0, 0.38, 0.43, 0.275, band, verts=32)
    cylinder('Soil', 0, 0, 0.48, 0.5, 0.25, soil, verts=32)
    z = 0.5
    for i in range(7):
        r = 0.09 - i * 0.006
        cone(f'Trunk{i}', 0.0 + i * 0.012, 0, z, z + 0.24, r, r * 0.85, trunk, verts=16)
        cylinder(f'TrunkRing{i}', i * 0.012, 0, z + 0.2, z + 0.24, r * 0.98, ring, verts=16)
        z += 0.22
    top = (7 * 0.012, 0, z)
    # Each frond arches: a rising inner half, then a drooping outer half.
    for i in range(9):
        a = math.radians(i * 40)
        mat = leaf if i % 2 else leaf2
        up, out = 0.45, 0.55
        frond(f'FrondIn{i}', top[0], top[1], top[2], up, 0.1, i * 40, -30, mat)
        ex = top[0] + math.cos(a) * up * math.cos(math.radians(30))
        ey = top[1] + math.sin(a) * up * math.cos(math.radians(30))
        ez = top[2] + up * math.sin(math.radians(30))
        frond(f'FrondOut{i}', ex, ey, ez, out, 0.11, i * 40, 40 + (i % 3) * 8, mat)


# --------------------------------------------------------------------------
# Beer crates: a stack of plastic crates full of bottles.
# --------------------------------------------------------------------------

def build_crates():
    red = principled('CrateRed', srgb('#c8282e'), rough=0.45)
    yellow = principled('CrateYellow', srgb('#e6b422'), rough=0.45)
    glass = principled('CrateBottle', srgb('#2f6a2a'), rough=0.15)
    cap = plain('#d8d8d8', rough=0.3)

    def crate(name, x, y, z, mat, w=0.36, d=0.26, h=0.3):
        box(f'{name}Body', x - w, x + w, y - d, y + d, z, z + h, mat, bevel=0.02)
        box(f'{name}Grip', x - w * 0.5, x + w * 0.5, y - d - 0.005, y - d + 0.01, z + h - 0.09, z + h - 0.05, plain('#1a1a1a'), bevel=0.01)
        for i in range(4):
            for j in range(3):
                bx, by = x - w + 0.1 + i * (2 * w - 0.2) / 3, y - d + 0.08 + j * (2 * d - 0.16) / 2
                cylinder(f'{name}B{i}{j}', bx, by, z + h - 0.02, z + h + 0.06, 0.03, glass, verts=10)
                cylinder(f'{name}C{i}{j}', bx, by, z + h + 0.06, z + h + 0.075, 0.018, cap, verts=8)

    crate('Low', 0, 0.05, 0, red)
    crate('Mid', 0.02, 0.06, 0.31, yellow)
    crate('Top', -0.03, 0.04, 0.62, red)


# --------------------------------------------------------------------------
# Speakers: the wooden starter speaker and the neon tower (the black tower
# is build_speaker above).
# --------------------------------------------------------------------------

def build_wood_speaker():
    oak = bb.wood('SpkOak', (0.2, 0.09, 0.035), (0.36, 0.17, 0.07))
    grille = plain('#24201e', rough=0.9)
    cone_mat = plain('#3a3632', rough=0.7)
    trim = plain('#c9b48a', rough=0.4)
    front = -0.28
    box('Cabinet', -0.3, 0.3, front, 0.28, 0, 1.3, oak, bevel=0.02)
    box('Grille', -0.26, 0.26, front - 0.012, front + 0.01, 0.06, 1.24, grille, bevel=0.012)
    for name, z, r in (('Big', 0.45, 0.2), ('Small', 0.95, 0.12)):
        disc_y(f'{name}Cone', 0, front - 0.02, z, r, 0.012, cone_mat)
        ring_y(f'{name}Rim', 0, front - 0.022, z, r, 0.012, trim)
    disc_y('Badge', 0, front - 0.02, 1.16, 0.035, 0.01, trim)


def build_neon_speaker():
    gloss = principled('NeoCab', srgb('#0d0b12'), rough=0.12)
    cone_mat = plain('#141418', rough=0.5)
    pink = neon('NeoPink', (1.0, 0.08, 0.55), 10)
    cyan = neon('NeoCyan', (0.1, 0.85, 1.0), 9)
    panel = principled('NeoPanel', srgb('#2a0e58'), rough=0.3, emission=srgb('#6a2ccf'), emission_strength=0.45)
    H = 2.35
    front = -0.34
    box('Feet', -0.36, 0.36, -0.31, 0.31, 0, 0.06, plain('#2a2a30', rough=0.5), bevel=0.01)
    box('Cabinet', -0.39, 0.39, front, 0.34, 0.06, H - 0.04, gloss, bevel=0.04)
    box('Cap', -0.4, 0.4, front - 0.01, 0.35, H - 0.05, H, plain('#24222a', rough=0.7), bevel=0.02)
    box('SidePanel', 0.39, 0.4, -0.25, 0.25, 0.3, H - 0.3, panel, bevel=0)
    for name, z, r, mat in (('Big', 0.66, 0.29, pink), ('Small', 1.45, 0.21, cyan)):
        disc_y(f'{name}Cone', 0, front - 0.005, z, r, 0.02, cone_mat)
        ring_y(f'{name}Ring', 0, front - 0.02, z, r + 0.012, 0.026, mat)
        ring_y(f'{name}Inner', 0, front - 0.02, z, r * 0.45, 0.014, mat)
    disc_y('Tweeter', 0, front - 0.005, 1.92, 0.07, 0.02, cone_mat)
    ring_y('TweeterRing', 0, front - 0.015, 1.92, 0.08, 0.014, pink)
    # LED edges up the front corners.
    for x in (-0.385, 0.385):
        box(f'Edge{x}', x - 0.012, x + 0.012, front - 0.012, front + 0.004, 0.1, H - 0.08, cyan, bevel=0)


# --------------------------------------------------------------------------
# Velvet rope between two brass posts.
# --------------------------------------------------------------------------

def build_rope():
    brass = principled('RopeBrass', srgb('#d9a83a'), rough=0.22)
    velvet = principled('RopeVelvet', srgb('#b3122a'), rough=0.8)
    for x in (-0.38, 0.38):
        cylinder(f'Base{x}', x, 0, 0, 0.05, 0.12, brass, verts=24)
        cylinder(f'Post{x}', x, 0, 0.05, 0.95, 0.03, brass, verts=16)
        sphere(f'Knob{x}', x, 0, 0.98, 0.055, brass)
    pts = []
    for i in range(9):
        t = i / 8
        pts.append((-0.36 + 0.72 * t, 0, 0.88 - 0.22 * math.sin(math.pi * t)))
    neon_tube('Rope', pts, 0.03, velvet)


# --------------------------------------------------------------------------
# Glowing tube column, and a mirror disco ball on a stand.
# --------------------------------------------------------------------------

def build_tube():
    base = plain('#c9ccd6', rough=0.25)
    glow = principled('TubeGlow', (0.05, 0.55, 1.0), rough=0.05, emission=(0.02, 0.5, 1.0), emission_strength=0.9, alpha=0.85)
    core = neon('TubeCore', (0.1, 0.7, 1.0), 2)
    bubble = principled('TubeBubble', (0.95, 1.0, 1.0), rough=0.0, emission=(0.8, 1.0, 1.0), emission_strength=2.0)
    cylinder('Base', 0, 0, 0, 0.18, 0.26, base, verts=32)
    cylinder('Top', 0, 0, 2.08, 2.22, 0.24, base, verts=32)
    cylinder('Core', 0, 0, 0.18, 2.08, 0.05, core, verts=16)
    cylinder('Glass', 0, 0, 0.18, 2.08, 0.2, glow, verts=40)
    for i, (x, z) in enumerate([(0.08, 0.5), (-0.06, 0.8), (0.1, 1.15), (-0.09, 1.45), (0.05, 1.75)]):
        sphere(f'Bubble{i}', x, -0.08, z, 0.03 + (i % 2) * 0.015, bubble, segments=10)


def build_disco():
    chrome = plain('#d8dbe4', rough=0.2)
    tiles = [principled('DiscoA', srgb('#e8ecf6'), rough=0.1, emission=srgb('#ffffff'), emission_strength=0.5),
             principled('DiscoB', srgb('#7a8098'), rough=0.1),
             principled('DiscoC', srgb('#a8b4ff'), rough=0.1, emission=srgb('#7a8cff'), emission_strength=0.4),
             principled('DiscoD', srgb('#ffb8f0'), rough=0.1, emission=srgb('#ff7ae0'), emission_strength=0.3)]
    cylinder('Base', 0, 0, 0, 0.05, 0.24, chrome, verts=32)
    cylinder('Pole', 0, 0, 0.05, 1.6, 0.025, chrome, verts=12)
    cylinder('Hanger', 0, 0, 1.6, 1.72, 0.035, chrome, verts=12)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.34, location=(0, 0, 1.98))
    ball = bpy.context.active_object
    ball.name = 'Ball'
    # Mirror tiles: every face gets one of a few tints, flat shaded.
    for m in tiles:
        ball.data.materials.append(m)
    for k, poly in enumerate(ball.data.polygons):
        poly.material_index = (k * 7 + (k // 16) * 3) % len(tiles)
    ball.parent = bb.ROOT
    # Little glints.
    glint = neon('DiscoGlint', (1.0, 1.0, 1.0), 8)
    for i, (x, y, z) in enumerate([(0.2, -0.25, 2.1), (-0.1, -0.31, 1.9), (0.28, -0.12, 1.85)]):
        sphere(f'Glint{i}', x, y, z, 0.022, glint, segments=8)


# --------------------------------------------------------------------------
# A free-standing neon sign: the club's name on a black board.
# --------------------------------------------------------------------------

def build_neon_sign():
    board = principled('SignBoard', srgb('#141218'), rough=0.3)
    frame = plain('#3a3842', rough=0.4)
    pink = neon('SignPink', (1.0, 0.1, 0.6), 9)
    cyan = neon('SignCyan', (0.1, 0.85, 1.0), 8)
    for x in (-0.32, 0.32):
        box(f'Leg{x}', x - 0.025, x + 0.025, -0.03, 0.03, 0, 0.9, frame, bevel=0.006)
        box(f'Foot{x}', x - 0.06, x + 0.06, -0.2, 0.2, 0, 0.04, frame, bevel=0.01)
    box('Board', -0.45, 0.45, -0.04, 0.03, 0.85, 1.55, board, bevel=0.02)
    box('Trim', -0.46, 0.46, -0.045, 0.035, 0.84, 1.56, frame, bevel=0.01)
    box('Board2', -0.45, 0.45, -0.05, -0.04, 0.85, 1.55, board, bevel=0)
    box('StarPost', -0.012, 0.012, -0.03, 0.0, 1.56, 1.6, frame, bevel=0)
    bpy.ops.object.text_add(location=(0, -0.06, 1.12), rotation=(math.radians(90), 0, 0))
    txt = bpy.context.active_object
    txt.data.body = 'NOVA'
    txt.data.align_x = 'CENTER'
    txt.data.size = 0.3
    txt.data.extrude = 0.012
    bpy.ops.object.convert(target='MESH')
    bb._finish(bpy.context.active_object, pink, 0)
    # A cyan star above the name.
    pts = []
    for k in range(11):
        a = math.pi / 2 + k * math.pi / 5
        r = 0.09 if k % 2 == 0 else 0.04
        pts.append((math.cos(a) * r, -0.06, 1.66 + math.sin(a) * r))
    neon_tube('Star', pts, 0.008, cyan)


# --------------------------------------------------------------------------
# Spotlight on a tripod, with a soft beam.
# --------------------------------------------------------------------------

def build_spotlight():
    black = plain('#1c1c22', rough=0.4)
    grey = plain('#6a6c76', rough=0.35)
    lens = neon('SpotLens', (1.0, 0.95, 0.75), 12)
    for k in range(3):
        a = math.radians(90 + k * 120)
        neon_tube(f'Leg{k}', [(math.cos(a) * 0.32, math.sin(a) * 0.32, 0), (0, 0, 1.0)], 0.018, black)
    cylinder('Mast', 0, 0, 0.9, 1.5, 0.025, grey, verts=12)
    # Head: a can pointing up and toward -Y (the crowd).
    head = cylinder('Head', 0, 0, -0.2, 0.2, 0.15, black, verts=24)
    tilted(head, rx=-55).location = (0, -0.05, 1.62)
    rim = cylinder('Lens', 0, 0, 0.2, 0.215, 0.13, lens, verts=24)
    tilted(rim, rx=-55).location = (0, -0.05, 1.62)
    box('Yoke', -0.17, 0.17, -0.02, 0.02, 1.5, 1.62, grey, bevel=0.005)


# --------------------------------------------------------------------------
# Pool table (2 x 1 tiles: x in [-1, 1]).
# --------------------------------------------------------------------------

def build_pool():
    oak = bb.wood('PoolOak', (0.16, 0.07, 0.03), (0.3, 0.14, 0.06))
    felt = plain('#1f8a4a', rough=0.9)
    pocket = plain('#0c0c0c', rough=0.9)
    for x in (-0.78, 0.78):
        for y in (-0.3, 0.3):
            box(f'Leg{x}{y}', x - 0.06, x + 0.06, y - 0.06, y + 0.06, 0, 0.6, oak, bevel=0.01)
    box('Apron', -0.88, 0.88, -0.4, 0.4, 0.5, 0.72, oak, bevel=0.015)
    box('Felt', -0.8, 0.8, -0.32, 0.32, 0.72, 0.76, felt, bevel=0.005)
    for name, x0, x1, y0, y1 in (('RailF', -0.9, 0.9, -0.42, -0.32), ('RailB', -0.9, 0.9, 0.32, 0.42),
                                 ('RailL', -0.9, -0.8, -0.42, 0.42), ('RailR', 0.8, 0.9, -0.42, 0.42)):
        box(name, x0, x1, y0, y1, 0.72, 0.8, oak, bevel=0.012)
    for x in (-0.79, 0, 0.79):
        for y in (-0.31, 0.31):
            cylinder(f'Pocket{x}{y}', x, y, 0.76, 0.802, 0.045, pocket, verts=16)
    colors = ['#f4f1e6', '#e6c21e', '#1e4ed8', '#d8281e', '#6a1ea8', '#e8781e', '#1e8a3a', '#7a1e1e', '#111111']
    spots = [(-0.45, 0.0), (0.3, 0.0), (0.38, -0.05), (0.38, 0.05), (0.46, 0.0), (0.46, -0.1), (0.46, 0.1), (0.54, -0.05), (0.54, 0.05)]
    for i, ((x, y), c) in enumerate(zip(spots, colors)):
        sphere(f'Ball{i}', x, y, 0.79, 0.035, principled(f'Ball{i}', srgb(c), rough=0.15), segments=12)
    cue = plain('#d8b878', rough=0.4)
    rod = cylinder('Cue', 0, 0, -0.65, 0.65, 0.012, cue, verts=10)
    rod.rotation_euler = (0, math.radians(90), math.radians(12))
    rod.location = (-0.05, -0.18, 0.8)


# --------------------------------------------------------------------------
# Statues: a gold trophy and a lucky cat.
# --------------------------------------------------------------------------

def build_trophy():
    marble = principled('Marble', srgb('#1a1a20'), rough=0.15)
    gold = principled('Gold', srgb('#f0b42a'), rough=0.2, emission=srgb('#a86a00'), emission_strength=0.25)
    plaque = plain('#e8d29a', rough=0.3)
    box('Plinth', -0.36, 0.36, -0.36, 0.36, 0, 0.55, marble, bevel=0.03)
    box('Plaque', -0.18, 0.18, -0.37, -0.36, 0.2, 0.34, plaque, bevel=0.005)
    cylinder('Foot', 0, 0, 0.55, 0.65, 0.26, gold, verts=32)
    cone('Stem', 0, 0, 0.65, 1.05, 0.12, 0.05, gold, verts=24)
    cylinder('Knot', 0, 0, 1.05, 1.12, 0.09, gold, verts=24)
    cone('Cup', 0, 0, 1.12, 1.75, 0.08, 0.36, gold, verts=40)
    cylinder('Lip', 0, 0, 1.73, 1.78, 0.37, gold, verts=40)
    for x in (-0.36, 0.36):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.16, minor_radius=0.03, location=(x, 0, 1.48),
                                         rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, gold, 0)
    sphere('Star', 0, -0.25, 1.4, 0.07, neon('TrophyStar', (1.0, 0.9, 0.5), 6), segments=12)


def build_lucky_cat():
    white = principled('CatWhite', srgb('#f7f4ee'), rough=0.3)
    red = principled('CatRed', srgb('#d8202e'), rough=0.3)
    gold = principled('CatGold', srgb('#f0b42a'), rough=0.2, emission=srgb('#a86a00'), emission_strength=0.3)
    black = plain('#151515', rough=0.3)
    pink = plain('#f29ab0', rough=0.4)
    box('Base', -0.38, 0.38, -0.38, 0.38, 0, 0.2, red, bevel=0.03)
    sphere('Body', 0, 0, 0.62, 0.36, white, scale=(1, 0.9, 1.15))
    sphere('Head', 0, -0.04, 1.25, 0.34, white, scale=(1.1, 0.95, 0.92))
    for x in (-0.2, 0.2):
        c = cone(f'Ear{x}', x, -0.04, 1.45, 1.66, 0.11, 0.0, white, verts=16)
        cone(f'EarIn{x}', x, -0.09, 1.47, 1.62, 0.07, 0.0, pink, verts=12)
    for x in (-0.12, 0.12):
        sphere(f'Eye{x}', x, -0.33, 1.3, 0.05, black, scale=(1, 0.4, 0.55), segments=12)
    sphere('Nose', 0, -0.35, 1.2, 0.03, pink, segments=10)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.035, location=(0, -0.03, 0.98))
    bb._finish(bpy.context.active_object, red, 0)
    sphere('Bell', 0, -0.29, 0.92, 0.06, gold, segments=14)
    # Raised paw (waving) and a gold coin held in front.
    sphere('ArmUp', 0.3, -0.12, 1.05, 0.11, white, scale=(0.9, 0.9, 1.6))
    sphere('PawUp', 0.32, -0.16, 1.3, 0.1, white)
    sphere('PawLow', -0.22, -0.3, 0.7, 0.1, white)
    disc_y('Coin', -0.05, -0.36, 0.62, 0.17, 0.03, gold)


# --------------------------------------------------------------------------
# The October 2026 batch, from the owner's main reference screenshots
# (art/references/main/): simple pieces for early levels, glowing and
# showpiece ones for later, several in two colours.
# --------------------------------------------------------------------------

def build_barrel():
    """An old oak barrel with iron hoops and a candle on top."""
    oak = principled('BarrelOak', srgb('#9a5f30'), rough=0.7)
    oak2 = principled('BarrelOak2', srgb('#86512a'), rough=0.7)
    iron = plain('#3a3a40', rough=0.4)
    wax = plain('#f4ead2', rough=0.6)
    flame = neon('BarrelFlame', (1.0, 0.7, 0.2), 8)
    # Staves: a bulging barrel made of a few stacked cones.
    cone('StaveLow', 0, 0, 0, 0.42, 0.3, 0.36, oak, verts=20)
    cone('StaveHigh', 0, 0, 0.42, 0.84, 0.36, 0.3, oak2, verts=20)
    cylinder('Lid', 0, 0, 0.84, 0.86, 0.29, plain('#7a4824', rough=0.75), verts=20)
    for i, (z, r) in enumerate([(0.08, 0.31), (0.32, 0.355), (0.52, 0.355), (0.76, 0.31)]):
        cylinder(f'Hoop{i}', 0, 0, z, z + 0.04, r + 0.008, iron, verts=20)
    cylinder('Candle', 0.05, -0.05, 0.86, 1.02, 0.045, wax, verts=12)
    cone('Flame', 0.05, -0.05, 1.02, 1.1, 0.025, 0.0, flame, verts=8)


def build_street_lamp():
    """An old black lamp post with a warm glass lantern."""
    black = principled('LampBlack', srgb('#1e1e24'), rough=0.35)
    glass = principled('LampGlass', (1.0, 0.85, 0.5), rough=0.1, emission=(1.0, 0.72, 0.3), emission_strength=2.5)
    cylinder('Foot', 0, 0, 0, 0.1, 0.24, black, verts=24)
    cone('Plinth', 0, 0, 0.1, 0.5, 0.16, 0.07, black, verts=16)
    cylinder('Post', 0, 0, 0.5, 2.15, 0.045, black, verts=12)
    cylinder('Collar', 0, 0, 2.1, 2.18, 0.09, black, verts=16)
    cone('LanternLow', 0, 0, 2.18, 2.28, 0.08, 0.14, black, verts=8)
    cone('Glass', 0, 0, 2.28, 2.62, 0.13, 0.17, glass, verts=8)
    cone('Roof', 0, 0, 2.62, 2.78, 0.21, 0.04, black, verts=8)
    sphere('Finial', 0, 0, 2.82, 0.04, black, segments=10)


def globe_lamp(glow_hex):
    """A tall standing lamp with a glowing round top (as in the art deco and
    ice clubs)."""
    def build():
        chrome = plain('#c8ccd8', rough=0.2)
        dark = plain('#26242c', rough=0.4)
        g = srgb(glow_hex)
        globe = principled(f'Globe{glow_hex}', g, rough=0.15, emission=g, emission_strength=2.2)
        cylinder('Base', 0, 0, 0, 0.06, 0.26, dark, verts=32)
        cone('BaseTop', 0, 0, 0.06, 0.12, 0.24, 0.08, chrome, verts=32)
        cylinder('Pole', 0, 0, 0.12, 1.95, 0.03, chrome, verts=12)
        cylinder('Cup', 0, 0, 1.92, 2.0, 0.09, chrome, verts=24)
        sphere('Globe', 0, 0, 2.22, 0.25, globe, segments=32)
    return build


def crystal_column(glass_hex, glow_hex):
    """A tall six-sided crystal column lit from inside, on a chrome base."""
    def build():
        chrome = plain('#cfd2dc', rough=0.2)
        g = srgb(glow_hex)
        glass = principled(f'Crystal{glass_hex}', srgb(glass_hex), rough=0.05, emission=g, emission_strength=0.9, alpha=0.8)
        core = neon(f'CrystalCore{glow_hex}', g, 3)
        cylinder('Base', 0, 0, 0, 0.16, 0.3, chrome, verts=6)
        cylinder('Core', 0, 0, 0.16, 1.9, 0.07, core, verts=6)
        cylinder('Crystal', 0, 0, 0.16, 1.9, 0.22, glass, verts=6)
        cone('Point', 0, 0, 1.9, 2.3, 0.22, 0.02, glass, verts=6)
        cylinder('Band', 0, 0, 0.9, 0.95, 0.23, chrome, verts=6)
    return build


def build_glow_plinth():
    """A purple glowing plinth with a white orb sitting on it."""
    white = principled('PlinthWhite', srgb('#f2eef8'), rough=0.3)
    purple = principled('PlinthGlow', srgb('#a040ff'), rough=0.2, emission=srgb('#9a2cff'), emission_strength=2.0)
    orb = principled('PlinthOrb', srgb('#ffffff'), rough=0.1, emission=srgb('#f0e0ff'), emission_strength=1.2)
    box('Foot', -0.36, 0.36, -0.36, 0.36, 0, 0.08, white, bevel=0.02)
    box('Glow', -0.3, 0.3, -0.3, 0.3, 0.08, 0.86, purple, bevel=0.03)
    box('Top', -0.36, 0.36, -0.36, 0.36, 0.86, 0.94, white, bevel=0.02)
    sphere('Orb', 0, 0, 1.16, 0.22, orb, segments=32)


def speaker_stack(ring_rgb):
    """Two speaker cabinets stacked, each with two woofers ringed in light."""
    def build():
        cab = principled('StackCab', srgb('#212228'), rough=0.35)
        trim = plain('#55575f', rough=0.3)
        cone_mat = principled('StackCone', srgb('#111114'), rough=0.6)
        ring = neon(f'StackRing{ring_rgb}', ring_rgb, 9)
        front = -0.36
        box('Feet', -0.4, 0.4, -0.34, 0.34, 0, 0.05, trim, bevel=0.01)
        for c, (z0, z1) in enumerate([(0.05, 1.2), (1.22, 2.37)]):
            box(f'Cab{c}', -0.42, 0.42, front, 0.36, z0, z1, cab, bevel=0.03)
            for w, z in enumerate((z0 + 0.32, z0 + 0.82)):
                disc_y(f'Cone{c}{w}', 0, front - 0.005, z, 0.22, 0.02, cone_mat)
                ring_y(f'Ring{c}{w}', 0, front - 0.02, z, 0.232, 0.02, ring)
                sphere(f'Dust{c}{w}', 0, front - 0.02, z, 0.07, trim, scale=(1, 0.45, 1))
        box('Cap', -0.43, 0.43, front - 0.01, 0.37, 2.37, 2.42, trim, bevel=0.015)
    return build


def build_glass_partition():
    """A glass screen in a chrome frame, etched with diamonds and lit along
    its foot (the art deco club's glass partitions)."""
    chrome = plain('#d0d4de', rough=0.2)
    glass = principled('PartGlass', srgb('#9fd8ff'), rough=0.05, emission=srgb('#4aa8ff'), emission_strength=0.6, alpha=0.55)
    etch = principled('PartEtch', srgb('#ffffff'), rough=0.2, emission=srgb('#cfe8ff'), emission_strength=0.8)
    light = neon('PartLight', (0.4, 0.8, 1.0), 6)
    box('Foot', -0.48, 0.48, -0.12, 0.12, 0, 0.1, chrome, bevel=0.02)
    box('LightStrip', -0.44, 0.44, -0.125, -0.115, 0.03, 0.07, light, bevel=0)
    box('Glass', -0.42, 0.42, -0.03, 0.03, 0.1, 2.0, glass, bevel=0)
    for x0, x1 in ((-0.48, -0.42), (0.42, 0.48)):
        box(f'Post{x0}', x0, x1, -0.05, 0.05, 0.1, 2.06, chrome, bevel=0.01)
    box('TopRail', -0.48, 0.48, -0.05, 0.05, 2.0, 2.06, chrome, bevel=0.01)
    # Etched diamonds down the middle.
    for i, z in enumerate((0.45, 0.85, 1.25, 1.65)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=0.13, depth=0.004, location=(0, -0.034, z),
                                            rotation=(math.radians(90), 0, 0))
        d = bpy.context.active_object
        d.name = f'Etch{i}'
        bb._finish(d, etch, 0)


def liquid_tank(liquid_hex):
    """A glass tank of glowing liquid with bubbles, in a steel frame with a
    pipe on top (the ice club's row of tanks)."""
    def build():
        steel = plain('#9aa0ae', rough=0.3)
        dark = plain('#2a2a32', rough=0.4)
        g = srgb(liquid_hex)
        liquid = principled(f'Liquid{liquid_hex}', g, rough=0.05, emission=g, emission_strength=1.4, alpha=0.75)
        bubble = principled('TankBubble', (0.95, 0.95, 1.0), rough=0.0, emission=(0.9, 0.9, 1.0), emission_strength=2.0)
        box('Base', -0.4, 0.4, -0.4, 0.4, 0, 0.22, dark, bevel=0.02)
        box('Liquid', -0.34, 0.34, -0.34, 0.34, 0.22, 1.72, liquid, bevel=0.02)
        for x in (-0.37, 0.37):
            for y in (-0.37, 0.37):
                box(f'Post{x}{y}', x - 0.04, x + 0.04, y - 0.04, y + 0.04, 0.22, 1.78, steel, bevel=0.01)
        box('Lid', -0.4, 0.4, -0.4, 0.4, 1.78, 1.86, steel, bevel=0.015)
        cylinder('Pipe', 0, 0, 1.86, 2.08, 0.06, steel, verts=16)
        cylinder('Valve', 0, 0, 2.02, 2.06, 0.11, dark, verts=16)
        # Bubbles rise in the game (src/scene/tankFx.js).
    return build


def build_gargoyle():
    """A stone gargoyle crouched on a pedestal, wings folded."""
    stone = principled('GargStone', srgb('#8a8a90'), rough=0.85)
    dark = principled('GargDark', srgb('#6a6a72'), rough=0.85)
    eye = neon('GargEye', (1.0, 0.25, 0.2), 5)
    box('Pedestal', -0.34, 0.34, -0.34, 0.34, 0, 0.62, dark, bevel=0.03)
    box('PedTop', -0.38, 0.38, -0.38, 0.38, 0.62, 0.7, stone, bevel=0.02)
    sphere('Body', 0, 0.02, 1.0, 0.24, stone, scale=(1, 0.9, 1.25))
    sphere('Haunch', 0, 0.06, 0.82, 0.25, stone, scale=(1.15, 1.0, 0.6))
    for x in (-0.13, 0.13):
        sphere(f'Foot{x}', x, -0.2, 0.74, 0.08, dark, scale=(1, 1.4, 0.6), segments=12)
        sphere(f'Arm{x}', x * 1.1, -0.17, 0.92, 0.06, stone, scale=(1, 1, 2.2), segments=12)
    sphere('Head', 0, -0.1, 1.38, 0.17, stone, scale=(1.05, 1.0, 0.95))
    sphere('Snout', 0, -0.24, 1.33, 0.08, dark, scale=(1.2, 1, 0.8), segments=12)
    for x in (-0.07, 0.07):
        sphere(f'Eye{x}', x, -0.25, 1.42, 0.025, eye, segments=8)
        c = cone(f'Horn{x}', x * 1.4, -0.06, 1.48, 1.66, 0.045, 0.0, dark, verts=10)
        tilted(c, ry=-25 if x < 0 else 25)
    # Bat wings spread behind the shoulders: three long fingers each, with a
    # thin membrane between them.
    for x in (-1, 1):
        for k, (ang, length) in enumerate([(25, 0.5), (55, 0.58), (85, 0.5)]):
            a = math.radians(ang)
            cx = 0.12 * x + math.cos(a) * length * 0.5 * x
            cz = 1.15 + math.sin(a) * length * 0.5
            f = sphere(f'WingFinger{x}{k}', cx, 0.2, cz, 1.0, stone, scale=(length * 0.5, 0.03, 0.035), segments=12)
            f.rotation_euler = (0, -a * x, 0)
        m = sphere(f'WingSkin{x}', 0.12 * x + 0.2 * x, 0.21, 1.33, 1.0, dark, scale=(0.24, 0.015, 0.2), segments=16)
        m.rotation_euler = (0, math.radians(-50 * x), 0)
    # A heavy brow and fangs, so he scowls rather than smiles.
    sphere('Brow', 0, -0.2, 1.45, 0.12, dark, scale=(1.3, 0.5, 0.35), segments=12)
    for x in (-0.04, 0.04):
        cone(f'Fang{x}', x, -0.3, 1.25, 1.3, 0.0, 0.018, plain('#f2efe6', rough=0.4), verts=6)


def build_robot():
    """A friendly green retro robot with an antenna and glowing eyes."""
    green = principled('RobotGreen', srgb('#58c26a'), rough=0.35)
    dark = plain('#2c3a30', rough=0.4)
    chrome = plain('#c8ccd6', rough=0.25)
    eye = neon('RobotEye', (1.0, 0.85, 0.2), 6)
    light = neon('RobotLight', (1.0, 0.2, 0.3), 6)
    for x in (-0.15, 0.15):
        box(f'Foot{x}', x - 0.1, x + 0.1, -0.18, 0.12, 0, 0.1, dark, bevel=0.03)
        cylinder(f'Leg{x}', x, 0, 0.1, 0.5, 0.07, chrome, verts=16)
    box('Body', -0.3, 0.3, -0.22, 0.22, 0.5, 1.15, green, bevel=0.06)
    box('Panel', -0.18, 0.18, -0.225, -0.215, 0.62, 0.98, dark, bevel=0.01)
    for i, (x, z, m) in enumerate([(-0.09, 0.9, light), (0.0, 0.9, eye), (0.09, 0.9, light)]):
        sphere(f'Btn{i}', x, -0.23, z, 0.03, m, segments=10)
    for i, z in enumerate((0.7, 0.76)):
        box(f'Grille{i}', -0.12, 0.12, -0.226, -0.22, z, z + 0.025, chrome, bevel=0)
    for x in (-1, 1):
        cylinder(f'Shoulder{x}', 0.33 * x, 0, 1.0, 1.08, 0.07, chrome, verts=16)
        arm = cylinder(f'Arm{x}', 0.36 * x, -0.04, 0.68, 1.04, 0.05, chrome, verts=12)
        tilted(arm, rx=-12)
        sphere(f'Hand{x}', 0.36 * x, -0.1, 0.64, 0.08, green, segments=14)
    cylinder('Neck', 0, 0, 1.15, 1.22, 0.08, chrome, verts=16)
    box('Head', -0.22, 0.22, -0.18, 0.18, 1.22, 1.56, green, bevel=0.05)
    for x in (-0.09, 0.09):
        cylinder(f'EyeRim{x}', x, -0.17, 1.36, 1.44, 0.075, chrome, verts=20).rotation_euler = (math.radians(90), 0, 0)
        sphere(f'Eye{x}', x, -0.19, 1.4, 0.05, eye, scale=(1, 0.5, 1), segments=14)
    box('Mouth', -0.08, 0.08, -0.185, -0.175, 1.27, 1.3, dark, bevel=0)
    cylinder('Antenna', 0, 0, 1.56, 1.76, 0.015, chrome, verts=8)
    sphere('AntennaBall', 0, 0, 1.78, 0.045, light, segments=12)


def build_cat_statue():
    """A white cat statue lounging on a long plinth (the art deco club)."""
    white = principled('CatStone', srgb('#f4f2ee'), rough=0.3)
    plinth = principled('CatPlinth', srgb('#2a2630'), rough=0.25)
    gold = principled('CatTrim', srgb('#e8b84a'), rough=0.25, emission=srgb('#a87a10'), emission_strength=0.25)
    box('Plinth', -0.4, 0.4, -0.3, 0.3, 0, 0.5, plinth, bevel=0.03)
    box('Trim', -0.41, 0.41, -0.31, 0.31, 0.46, 0.5, gold, bevel=0.008)
    # Lying along X, head up at +x end facing the viewer.
    sphere('Body', -0.05, 0.02, 0.66, 0.2, white, scale=(1.6, 0.85, 0.75))
    sphere('Hip', -0.24, 0.04, 0.64, 0.16, white, scale=(1.1, 1.0, 0.9))
    sphere('Chest', 0.18, -0.02, 0.68, 0.15, white, scale=(1.0, 0.95, 1.1))
    for x in (0.24, 0.32):
        sphere(f'Paw{x}', x, -0.16, 0.54, 0.05, white, scale=(1.6, 1, 0.7), segments=12)
    sphere('Head', 0.26, -0.06, 0.92, 0.14, white, scale=(1.0, 0.95, 0.92))
    for dx in (-0.08, 0.08):
        c = cone(f'Ear{dx}', 0.26 + dx, -0.06, 1.0, 1.12, 0.05, 0.0, white, verts=12)
    for dx in (-0.05, 0.05):
        sphere(f'Eye{dx}', 0.26 + dx, -0.19, 0.94, 0.018, gold, segments=8)
    tail = sphere('Tail', -0.42, -0.12, 0.6, 0.05, white, scale=(1, 3.2, 0.8), segments=12)
    tilted(tail, rz=-30)


def build_waterfall():
    """A tall glass column with water running down inside, over a lit
    basin."""
    chrome = plain('#cfd3dc', rough=0.2)
    basin = principled('FallBasin', srgb('#1c2a40'), rough=0.3)
    water = principled('FallWater', srgb('#7ad0ff'), rough=0.05, emission=srgb('#3aa8ff'), emission_strength=1.0, alpha=0.55)
    stream = principled('FallStream', srgb('#e8f8ff'), rough=0.05, emission=srgb('#bfe8ff'), emission_strength=2.0)
    glass = principled('FallGlass', srgb('#dff2ff'), rough=0.02, alpha=0.25)
    cylinder('Basin', 0, 0, 0, 0.3, 0.42, basin, verts=40)
    cylinder('BasinRim', 0, 0, 0.28, 0.34, 0.43, chrome, verts=40)
    cylinder('Pool', 0, 0, 0.2, 0.31, 0.38, water, verts=40)
    cylinder('Water', 0, 0, 0.31, 2.2, 0.18, water, verts=32)
    for i, (x, w) in enumerate([(-0.1, 0.012), (-0.03, 0.02), (0.05, 0.014), (0.11, 0.01)]):
        box(f'Stream{i}', x - w, x + w, -0.19, -0.17, 0.32, 2.18, stream, bevel=0)
    cylinder('Glass', 0, 0, 0.31, 2.2, 0.22, glass, verts=32)
    cylinder('Crown', 0, 0, 2.2, 2.3, 0.25, chrome, verts=32)


def build_pagoda():
    """A tall orange pagoda statue, five roofs high (the theatre club)."""
    red = principled('PagodaRed', srgb('#e2502a'), rough=0.45)
    orange = principled('PagodaRoof', srgb('#f29a2e'), rough=0.4)
    gold = principled('PagodaGold', srgb('#f2c24a'), rough=0.25, emission=srgb('#a87a10'), emission_strength=0.3)
    lamp = neon('PagodaLamp', (1.0, 0.75, 0.3), 5)
    box('Plinth', -0.4, 0.4, -0.4, 0.4, 0, 0.18, plain('#3a2a26', rough=0.6), bevel=0.02)
    z = 0.18
    size = 0.3
    for k in range(5):
        h = 0.36 - k * 0.03
        box(f'Storey{k}', -size, size, -size, size, z, z + h, red, bevel=0.015)
        box(f'Window{k}', -size * 0.4, size * 0.4, -size - 0.005, -size + 0.01, z + h * 0.25, z + h * 0.75, lamp, bevel=0)
        z += h
        r = size + 0.14
        cone(f'Roof{k}', 0, 0, z, z + 0.12, r * 1.41, size * 0.5, orange, verts=4).rotation_euler = (0, 0, math.radians(45))
        z += 0.1
        size *= 0.84
    cylinder('Spire', 0, 0, z, z + 0.3, 0.025, gold, verts=10)
    for i in range(3):
        sphere(f'SpireBall{i}', 0, 0, z + 0.08 + i * 0.08, 0.05 - i * 0.01, gold, segments=10)


# Some models are built small and scaled up as a whole.
SCALE = {'lava': (1.15, 1.15, 1.2), 'aquarium': (1.0, 1.0, 1.25)}

DECOR = {
    'fern': build_fern,
    'palm': build_palm,
    'crates': build_crates,
    'woodSpeaker': build_wood_speaker,
    'speaker': build_speaker,
    'neonSpeaker': build_neon_speaker,
    'rope': build_rope,
    'lava': build_lava,
    'tube': build_tube,
    'disco': build_disco,
    'neonSign': build_neon_sign,
    'spotlight': build_spotlight,
    'pool': build_pool,
    'aquarium': build_aquarium,
    'trophy': build_trophy,
    'luckyCat': build_lucky_cat,
    'barrel': build_barrel,
    'streetLamp': build_street_lamp,
    'globeLamp': globe_lamp('#fff4dc'),
    'globeLampPink': globe_lamp('#ff7ad8'),
    'crystal': crystal_column('#8ff0ea', '#20d8d0'),
    'crystalPink': crystal_column('#ffb0e8', '#ff40c0'),
    'glowPlinth': build_glow_plinth,
    'stack': speaker_stack((0.1, 0.85, 1.0)),
    'stackPurple': speaker_stack((0.7, 0.2, 1.0)),
    'partition': build_glass_partition,
    'tank': liquid_tank('#a040ff'),
    'tankBlue': liquid_tank('#3a9cff'),
    'gargoyle': build_gargoyle,
    'robot': build_robot,
    'catStatue': build_cat_statue,
    'waterfall': build_waterfall,
    'pagoda': build_pagoda,
}

import decor_batch2  # noqa: E402  (the owner's October 2026 drafts)
DECOR.update(decor_batch2.DESIGNS)


def build(name, preview_dir=None):
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    bb.M.clear()
    root = bpy.data.objects.new(f'Decor_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    DECOR[name]()
    root.scale = SCALE.get(name, (1, 1, 1))
    if preview_dir:
        os.makedirs(preview_dir, exist_ok=True)
        origin = iso_rig.check_projection(scene, cam)
        iso_rig.add_outlines(scene, root)
        iso_rig.apply_model_scale(root)
        scene.render.filepath = os.path.join(preview_dir, f'decor_{name}.png')
        bpy.ops.render.render(write_still=True)
        print(f'decor_{name} origin_px:', origin, flush=True)
        return
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'decor_{name}.blend'))
    layers = decor_batch2.LAYERS.get(name)
    meta = iso_rig.render_facings(scene, cam, root, f'decor_{name}', bb.SPRITE_DIR, layers=layers(root) if layers else None)
    print(f'decor_{name}:', meta, flush=True)


def main():
    args = sys.argv[1:]
    preview = None
    if args[:1] == ['--preview']:
        preview, args = args[1], args[2:]
    for name in args or list(DECOR):
        build(name, preview)


if __name__ == '__main__':
    main()
