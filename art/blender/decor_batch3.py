"""Decorations from the owner's October 2026 notes, merged into
build_decor.py's DECOR:
    python art/blender/build_decor.py --preview DIR snakePlant wallFern ...

- Cool plants for a club (not sunny ones): a snake plant, a monstera, black
  bamboo, each in a dark designer planter.
- A black and silver pool table (3 x 1, like the old one).
- Wall decorations, now real 3D pieces hung on a wall section (the owner
  found the painted-on ones flat): each is modelled with its back on the
  wall plane (Y = 0) and sticking out toward -Y, one section wide (0.75
  units; the bottle shelf two), at most about 1.75 tall (the wall). The
  game shows facing 0 on the right wall and facing 90 on the left wall
  (scene/wallDecor.js).
"""

import math

import bpy
from mathutils import Vector

import build_bar as bb
from build_bars import plain, srgb
from decor_batch2 import mat, sphere, tube, rounded_box

box, cylinder, cone = bb.box, bb.cylinder, bb.cone
principled, neon = bb.principled, bb.neon


def leaf(name, base, direction, length, width, m, droop=0.0):
    """A flat leaf: a squashed sphere from `base` pointing along `direction`
    (a 3D vector), drooping by `droop` at the tip."""
    d = Vector(direction).normalized()
    mid = Vector(base) + d * (length / 2) + Vector((0, 0, -droop))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=mid)
    o = bpy.context.active_object
    o.name = name
    o.scale = (width, width * 0.18, length / 2)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((d * length + Vector((0, 0, -droop * 2))).normalized())
    bpy.ops.object.shade_smooth()
    return bb._finish(o, m, 0)


def planter(dark, rim, r=0.22, h=0.42, square=False):
    if square:
        rounded_box('Planter', -r, r, -r, r, 0, h, dark, 0.03)
        box('PlanterRim', -r - 0.01, r + 0.01, -r - 0.01, r + 0.01, h - 0.03, h, rim, bevel=0.005)
    else:
        cone('Planter', 0, 0, 0, h, r * 0.8, r, dark, verts=32)
        cylinder('PlanterRim', 0, 0, h - 0.03, h, r + 0.012, rim, verts=32)
    cylinder('Soil', 0, 0, h - 0.04, h - 0.02, r - 0.02, plain('#2a1c12', rough=0.9), verts=24)


def build_snake_plant():
    planter(mat('#141418', rough=0.2), mat('#c8a24a', rough=0.25), r=0.2, h=0.48, square=True)
    green = mat('#2f6a3a', rough=0.5)
    edge = mat('#c8d46a', rough=0.5)
    for k in range(9):
        a = k * 2.4
        tilt = 0.12 + (k % 3) * 0.06
        x, y = math.cos(a) * 0.06, math.sin(a) * 0.06
        h = 0.55 + (k % 4) * 0.12
        d = (math.cos(a) * tilt, math.sin(a) * tilt, 1)
        leaf(f'Blade{k}', (x, y, 0.45), d, h, 0.05, (green, edge)[k % 3 == 0])


def build_monstera():
    planter(mat('#6a6a70', rough=0.85), mat('#3a3a40', rough=0.6), r=0.24, h=0.36)
    green = mat('#1f6a34', rough=0.45)
    green2 = mat('#2c8a44', rough=0.45)
    stem = mat('#3a6a2a', rough=0.6)
    for k in range(8):
        a = k * 0.8 + 0.3
        out = 0.28 + (k % 3) * 0.08
        top = (math.cos(a) * out, math.sin(a) * out, 0.75 + (k % 4) * 0.12)
        tube(f'Stem{k}', (0, 0, 0.34), top, 0.012, stem)
        leaf(f'Leaf{k}', top, (math.cos(a), math.sin(a), 0.4), 0.34, 0.16, (green, green2)[k % 2], droop=0.04)


def build_bamboo():
    planter(mat('#101012', rough=0.15), mat('#2a2a30', rough=0.3), r=0.2, h=0.5, square=True)
    cane = mat('#1a1a14', rough=0.4)
    node = mat('#3a3a2a', rough=0.5)
    leafm = mat('#2f7a3a', rough=0.5)
    for k, (x, y, h) in enumerate([(-0.06, -0.04, 1.55), (0.07, 0.02, 1.75), (0.0, 0.08, 1.35), (-0.05, 0.07, 1.65)]):
        cylinder(f'Cane{k}', x, y, 0.46, h, 0.022, cane, verts=10)
        for z in (0.75, 1.05, 1.35):
            if z < h - 0.05:
                cylinder(f'Node{k}{z}', x, y, z, z + 0.02, 0.026, node, verts=10)
        for j in range(5):
            a = j * 1.3 + k
            leaf(f'Leaf{k}_{j}', (x, y, h - 0.15 - j * 0.12), (math.cos(a), math.sin(a), 0.25), 0.22, 0.035, leafm, droop=0.03)


def build_pool_black():
    """A black and silver pool table: black gloss body, chrome legs and
    trim, charcoal felt, silver pockets."""
    black = principled('PoolBlack', srgb('#0e0e12'), rough=0.08)
    chrome = mat('#cfd4dc', rough=0.12)
    felt = plain('#2a2c34', rough=0.95)
    for x in (-0.78, 0.78):
        for y in (-0.3, 0.3):
            cylinder(f'Leg{x}{y}', x, y, 0, 0.55, 0.05, chrome, verts=16)
            cylinder(f'Foot{x}{y}', x, y, 0, 0.04, 0.07, black, verts=16)
    box('Apron', -0.88, 0.88, -0.4, 0.4, 0.5, 0.72, black, bevel=0.015)
    box('ApronTrim', -0.885, 0.885, -0.405, 0.405, 0.6, 0.62, chrome, bevel=0.0)
    box('Felt', -0.8, 0.8, -0.32, 0.32, 0.72, 0.76, felt, bevel=0.005)
    for name, x0, x1, y0, y1 in (('RailF', -0.9, 0.9, -0.42, -0.32), ('RailB', -0.9, 0.9, 0.32, 0.42),
                                 ('RailL', -0.9, -0.8, -0.42, 0.42), ('RailR', 0.8, 0.9, -0.42, 0.42)):
        box(name, x0, x1, y0, y1, 0.72, 0.8, black, bevel=0.012)
    for x in (-0.79, 0, 0.79):
        for y in (-0.31, 0.31):
            cylinder(f'Pocket{x}{y}', x, y, 0.76, 0.805, 0.05, chrome, verts=16)
            cylinder(f'PocketHole{x}{y}', x, y, 0.79, 0.806, 0.035, plain('#050505'), verts=16)
    colors = ['#f4f1e6', '#e6c21e', '#1e4ed8', '#d8281e', '#6a1ea8', '#e8781e', '#1e8a3a', '#7a1e1e', '#111111']
    spots = [(-0.45, 0.0), (0.3, 0.0), (0.38, -0.05), (0.38, 0.05), (0.46, 0.0), (0.46, -0.1), (0.46, 0.1), (0.54, -0.05), (0.54, 0.05)]
    for i, ((x, y), c) in enumerate(zip(spots, colors)):
        sphere(f'Ball{i}', x, y, 0.79, 0.035, principled(f'PBall{i}', srgb(c), rough=0.15), segments=12)
    cue = tube('Cue', (-0.7, -0.26, 0.81), (0.55, -0.12, 0.81), 0.012, mat('#2a2a2e', rough=0.3))
    tube('CueTip', (-0.7, -0.26, 0.81), (-0.62, -0.25, 0.81), 0.0125, chrome)


# --------------------------------------------------------------------------
# Wall decorations: back on the wall (Y = 0), sticking out toward -Y.
# --------------------------------------------------------------------------

W = 0.36  # half a wall section, in model units


def build_wall_fern():
    """A fern in a woven pot, hung from a black wall bracket."""
    black = mat('#151518', rough=0.3)
    box('Plate', -0.06, 0.06, -0.02, 0.0, 1.45, 1.62, black, bevel=0.005)
    tube('Arm', (0, -0.01, 1.58), (0, -0.3, 1.58), 0.012, black)
    for dx in (-0.08, 0.0, 0.08):
        tube(f'Cord{dx}', (0, -0.3, 1.58), (dx, -0.3, 1.25), 0.004, mat('#d8c8a8', rough=0.8))
    cone('Pot', 0, -0.3, 1.1, 1.26, 0.09, 0.13, mat('#c8a26a', rough=0.8), verts=24)
    green = mat('#2f7a34', rough=0.5)
    green2 = mat('#3f9a3a', rough=0.5)
    for k in range(12):
        a = k * 0.53
        d = (math.cos(a), math.sin(a) * 0.8, -0.4 - (k % 3) * 0.3)
        leaf(f'Frond{k}', (0, -0.3, 1.25), d, 0.36 + (k % 3) * 0.1, 0.06, (green, green2)[k % 2], droop=0.06)


def build_wall_pendants():
    """Three warm glass globe pendants hung from a black wall arm."""
    black = mat('#151518', rough=0.3)
    glass = principled('PendantGlass', srgb('#ffe2b0'), rough=0.05, transmission=0.6, emission=srgb('#ffc070'), emission_strength=0.8, alpha=0.6)
    bulb = neon('PendantBulb', (1.0, 0.75, 0.4), 8)
    box('Plate', -0.24, 0.24, -0.02, 0.0, 1.62, 1.7, black, bevel=0.005)
    box('Arm', -0.24, 0.24, -0.36, -0.02, 1.64, 1.68, black, bevel=0.005)
    for i, (x, drop) in enumerate([(-0.18, 0.42), (0.0, 0.58), (0.18, 0.36)]):
        z = 1.64 - drop
        tube(f'Cord{i}', (x, -0.3, 1.64), (x, -0.3, z + 0.08), 0.004, black)
        cylinder(f'Cap{i}', x, -0.3, z + 0.06, z + 0.1, 0.025, black, verts=12)
        sphere(f'Globe{i}', x, -0.3, z, 0.075, glass, segments=20)
        sphere(f'Bulb{i}', x, -0.3, z, 0.03, bulb, segments=12)


def led_pole(rgb):
    def build():
        chrome = mat('#cfd4dc', rough=0.15)
        glow = neon(f'LedPole{rgb}', rgb, 3.5)
        cylinder('Tube', 0, -0.07, 0.12, 1.66, 0.028, glow, verts=16)
        for z in (0.1, 1.66):
            box(f'Bracket{z}', -0.05, 0.05, -0.12, 0.0, z - 0.03, z + 0.03, chrome, bevel=0.008)
    return build


def build_wall_heart():
    """A pink neon heart on a clear acrylic plate, held off the wall."""
    pink = neon('HeartPink', (1.0, 0.25, 0.7), 8)
    acrylic = principled('HeartAcrylic', srgb('#d8e8ff'), rough=0.05, transmission=0.8, alpha=0.2)
    chrome = mat('#cfd4dc', rough=0.15)
    box('Plate', -0.3, 0.3, -0.07, -0.05, 0.85, 1.45, acrylic, bevel=0.01)
    for x in (-0.25, 0.25):
        for z in (0.9, 1.4):
            cylinder(f'Standoff{x}{z}', x, -0.03, z - 0.012, z + 0.012, 0.012, chrome, verts=8)
    pts = []
    for k in range(41):
        t = k / 40 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x * 0.015, -0.085, 1.16 + y * 0.015))
    from build_bars import neon_tube
    neon_tube('Heart', pts, 0.016, pink)


def build_wall_speaker():
    """A black speaker on a wall bracket, angled down at the room."""
    black = mat('#141418', rough=0.35)
    cyan = neon('WallSpkCyan', (0.15, 0.85, 1.0), 5)
    box('Plate', -0.05, 0.05, -0.02, 0.0, 1.2, 1.4, mat('#5a5e68', rough=0.3), bevel=0.005)
    tube('Arm', (0, -0.01, 1.3), (0, -0.14, 1.3), 0.02, mat('#5a5e68', rough=0.3))
    cab = box('Cabinet', -0.2, 0.2, -0.38, -0.14, 1.05, 1.55, black, bevel=0.02)
    for name, z, r in (('Tweeter', 1.43, 0.06), ('Woofer', 1.2, 0.11)):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.012, location=(0, -0.385, z), rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, cyan, 0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r - 0.012, depth=0.01, location=(0, -0.382, z), rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, mat('#22222a', rough=0.6), 0)


def build_wall_fairy():
    """Strings of coloured fairy lights draped in swoops along the wall."""
    wire = mat('#202024', rough=0.5)
    colors = [(1.0, 0.35, 0.75), (0.35, 0.85, 1.0), (1.0, 0.85, 0.35), (0.6, 1.0, 0.45), (0.8, 0.5, 1.0)]
    for row, (z0, sag) in enumerate([(1.66, 0.14), (1.4, 0.1)]):
        pts = []
        for k in range(13):
            t = k / 12
            pts.append((-W + 2 * W * t, -0.04, z0 - sag * math.sin(t * math.pi)))
        for a, b in zip(pts, pts[1:]):
            tube(f'Wire{row}_{a[0]:.2f}', a, b, 0.004, wire)
        for k in range(1, 12, 2):
            x, y, z = pts[k]
            sphere(f'Bulb{row}{k}', x, -0.05, z - 0.03, 0.022, neon(f'Fairy{(row + k) % 5}', colors[(row + k) % 5], 6), segments=10)


def build_wall_vines():
    """A living wall: a dark moss panel thick with leaves, ivy trailing
    down from it, washed in purple light from below."""
    moss = mat('#1a3a1e', rough=0.95)
    frame = mat('#121214', rough=0.3)
    greens = [mat('#2f7a34', rough=0.5), mat('#3f9a3a', rough=0.5), mat('#1f5a2a', rough=0.5)]
    box('Frame', -W, W, -0.06, 0.0, 0.55, 1.65, frame, bevel=0.01)
    box('Moss', -W + 0.03, W - 0.03, -0.08, -0.04, 0.58, 1.62, moss, bevel=0.01)
    import random
    rnd = random.Random(7)
    for k in range(46):
        x = rnd.uniform(-W + 0.05, W - 0.05)
        z = rnd.uniform(0.62, 1.58)
        a = rnd.uniform(0, 2 * math.pi)
        leaf(f'Leaf{k}', (x, -0.08, z), (math.cos(a) * 0.6, -0.5, math.sin(a)), 0.1 + rnd.random() * 0.06, 0.04, greens[k % 3])
    for j in range(5):  # trailing ivy
        x = -W + 0.08 + j * 0.13
        length = 0.25 + (j % 3) * 0.15
        for i in range(int(length / 0.06)):
            z = 0.56 - i * 0.06
            leaf(f'Ivy{j}_{i}', (x + (0.02 if i % 2 else -0.02), -0.07, z), ((-1) ** i * 0.6, -0.4, -0.5), 0.07, 0.03, greens[(i + j) % 3])
    box('UpLight', -W + 0.03, W - 0.03, -0.1, -0.06, 0.5, 0.55, neon('VineGlow', (0.7, 0.3, 1.0), 4), bevel=0)


def build_wall_bottles():
    """Two floating black shelves of bottles with a warm light strip under
    each, two wall sections wide (the Bottle Cabinet, now on the wall)."""
    black = mat('#121216', rough=0.15)
    glow = neon('ShelfGlow', (1.0, 0.72, 0.35), 5)
    gold = mat('#d8a84a', rough=0.25)
    colors = ['#2f8a3a', '#7a3a12', '#c8d4dc', '#3a5ab8', '#a01a3a', '#d8a030', '#5a2a78']
    mats = [principled(f'WB{c}', srgb(c), rough=0.12, transmission=0.6) for c in colors]
    for i, z in enumerate((0.95, 1.35)):
        box(f'Shelf{i}', -0.72, 0.72, -0.24, 0.0, z - 0.04, z, black, bevel=0.008)
        box(f'ShelfGlow{i}', -0.7, 0.7, -0.22, -0.02, z - 0.045, z - 0.04, glow, bevel=0)
        box(f'ShelfEdge{i}', -0.72, 0.72, -0.245, -0.235, z - 0.04, z, gold, bevel=0)
        for k in range(9):
            x = -0.62 + k * 0.155
            h = 0.2 + ((k * 7 + i * 3) % 4) * 0.025
            m = mats[(k + i * 2) % len(mats)]
            cylinder(f'Bottle{i}_{k}', x, -0.12, z, z + h * 0.65, 0.035, m, verts=14)
            cone(f'Shoulder{i}_{k}', x, -0.12, z + h * 0.65, z + h * 0.78, 0.035, 0.013, m, verts=14)
            cylinder(f'Neck{i}_{k}', x, -0.12, z + h * 0.78, z + h, 0.012, m, verts=10)
    box('BackPanel', -0.74, 0.74, -0.012, 0.0, 0.75, 1.7, mat('#1a1418', rough=0.4), bevel=0)
    box('BackGlow', -0.7, 0.7, -0.014, -0.012, 0.8, 1.65, principled('BottleWash', srgb('#ffb060'), rough=0.6, emission=srgb('#ff9a40'), emission_strength=0.5), bevel=0)


DESIGNS = {
    'snakePlant': build_snake_plant,
    'monstera': build_monstera,
    'bamboo': build_bamboo,
    'poolBlack': build_pool_black,
    'wallFern': build_wall_fern,
    'wallPendants': build_wall_pendants,
    'wallLedCyan': led_pole((0.15, 0.85, 1.0)),
    'wallLedPink': led_pole((1.0, 0.25, 0.75)),
    'wallHeart': build_wall_heart,
    'wallSpeaker': build_wall_speaker,
    'wallFairy': build_wall_fairy,
    'wallVines': build_wall_vines,
    'wallBottles': build_wall_bottles,
}
