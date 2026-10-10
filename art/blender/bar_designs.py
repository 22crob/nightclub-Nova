"""Ten more bar looks, on the same skeleton as every bar in build_bars.py:
1 x 3 tiles (iso_rig.make_bar_piece), a customer counter on the -Y side
(y -1.28..-0.82, top at about 1.0), the bartender's aisle, and the back bar
(cabinet y 0.86..1.36, top at about 0.9, a shelf wall behind up to about
2.3). Only the dressing changes, so they line up into long bars, guests
stand at the counter and the bartender walks the aisle just like the
others.

    python art/blender/bar_designs.py --preview DIR [name...]   # stills for approval
    python art/blender/bar_designs.py [name...]                  # full renders

The full render writes bar_<name>_{0,90,180,270}.png (+ back/front
layers) and bar_<name>.json to game/src/assets/sprites/.
"""
import math
import os
import random
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_bar as bb  # noqa: E402
import build_bars as bars  # noqa: E402

box, cylinder, rod_x, cone, bottle = bb.box, bb.cylinder, bb.rod_x, bb.cone, bb.bottle
principled, wood, neon = bb.principled, bb.wood, bb.neon
srgb, plain, bottle_row, neon_tube = bars.srgb, bars.plain, bars.bottle_row, bars.neon_tube


def glowing(hex_color, strength=2.0):
    return neon(f'Glow{hex_color}{strength}', srgb(hex_color), strength)


def bottles_of(*colours, glow=0.0):
    return [principled(f'B{c}{glow}', srgb(c), rough=0.12, transmission=0.6,
                       **({'emission': srgb(c), 'emission_strength': glow} if glow else {})) for c in colours]


def sphere(name, x, y, z, r, mat, segs=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(6, segs // 2), radius=r, location=(x, y, z))
    bb._finish(bpy.context.active_object, mat, 0)


def shell(counter_mat, top_mat, back_mat, top_edge=None, floor_mat=None):
    """The shared skeleton below the back piece: the customer counter and
    top, and the back cabinet with its top. Every design dresses this."""
    box('CounterBody', -0.46, 0.46, -1.28, -0.82, 0.05, 0.98, counter_mat, bevel=0.008)
    box('CounterKick', -0.45, 0.45, -1.25, -0.82, 0, 0.06, plain('#15121a'), bevel=0.003)
    box('CounterTop', -0.49, 0.49, -1.37, -0.76, 0.98, 1.05, top_mat, bevel=0.015)
    if top_edge:
        box('TopEdge', -0.49, 0.49, -1.38, -1.36, 0.99, 1.04, top_edge, bevel=0)
    box('BackCabinet', -0.46, 0.46, 0.86, 1.4, 0.05, 0.88, back_mat, bevel=0.008)
    box('BackKick', -0.45, 0.45, 0.88, 1.4, 0, 0.06, plain('#15121a'), bevel=0.003)
    box('BackTop', -0.48, 0.48, 0.84, 1.42, 0.88, 0.94, top_mat, bevel=0.01)
    # The bartender's floor joins counter and back into one piece.
    box('AisleFloor', -0.46, 0.46, -0.82, 0.86, 0, 0.015, floor_mat or plain('#2a2430', rough=0.6), bevel=0.003)


# The back piece is designed on the whole cabinet top (front y 0.86, sides
# x +-0.48, back y 1.4), then push_back() squeezes it against the wall so
# the front of the cabinet top stays free as a little bar top.
HY0, HY1, HZ0, HZ1 = 0.86, 1.4, 0.94, 2.3
WALL_FRONT = 1.1                  # front of the back piece after push_back()
LEDGE = ('BackBottle', 'Lamp', 'Ledge')   # things standing on the bar top


def push_back():
    """Squeeze everything above the cabinet top (but the bar-top things)
    toward the wall, the back staying at y 1.42."""
    back = HY1 + 0.02
    k = (back - WALL_FRONT) / (back - (HY0 - 0.02))
    for o in bb.ROOT.children_recursive:
        if o.type != 'MESH' or o.name.startswith(LEDGE):
            continue
        mw = o.matrix_world
        pts = [mw @ v.co for v in o.data.vertices]
        if min(p.z for p in pts) < HZ0 - 0.005 or max(p.y for p in pts) < HY0 - 0.25:
            continue
        inv = mw.inverted()
        for v, p in zip(o.data.vertices, pts):
            p.y = back - (back - p.y) * k
            v.co = inv @ p


def hutch(frame, inner, crown=None, depth=0.06):
    """An open cabinet on the back bar: sides and a crown flush with the
    cabinet below, and a back panel `depth` deep at the rear."""
    for x in (-0.48, 0.48):
        box(f'HutchSide{x}', x - 0.03, x + 0.03, HY0, HY1, HZ0, HZ1, frame, bevel=0.006)
    box('HutchBack', -0.46, 0.46, HY1 - depth, HY1, HZ0, HZ1, inner, bevel=0.004)
    box('HutchCrown', -0.5, 0.5, HY0 - 0.02, HY1 + 0.02, HZ1, HZ1 + 0.08, crown or frame, bevel=0.01)


def ledge_glasses():
    """A few upturned glasses at the end of the bar top."""
    g = clear_glass('LedgeGlass')
    for i, x in enumerate((0.3, 0.38)):
        cylinder(f'LedgeGlass{i}', x, 0.97, 0.94, 1.04, 0.03, g, verts=14)


def shelves(mat, bottles, zs=(1.36, 1.76), seed=0, edge=None, y=(0.92, 1.34)):
    for j, z in enumerate(zs):
        box(f'Shelf{j}', -0.45, 0.45, y[0], y[1], z - 0.02, z, mat, bevel=0.003)
        if edge:
            box(f'ShelfEdge{j}', -0.45, 0.45, y[0] - 0.005, y[0] + 0.005, z - 0.035, z - 0.02, edge, bevel=0)
        bottle_row(f'Bottle{j}_', -0.36, 0.36, (y[0] + y[1]) / 2, z, 6, bottles, seed=seed + j)


def foot_rail(mat):
    rod_x('FootRail', -0.44, 0.44, -1.42, 0.18, 0.017, mat)
    for x in (-0.36, 0.36):
        box(f'RailPost{x}', x - 0.012, x + 0.012, -1.42, -1.28, 0.165, 0.195, mat, bevel=0.003)


def cocktail(name, x, y, z, glass, drink_hex, h=0.13):
    cylinder(f'{name}Stem', x, y, z, z + h * 0.5, 0.004, glass, verts=8)
    cone(f'{name}Bowl', x, y, z + h * 0.5, z + h, 0.004, 0.05, glass)
    cone(f'{name}Drink', x, y, z + h * 0.55, z + h * 0.9, 0.003, 0.042, glowing(drink_hex, 3))


def clear_glass(name='ClearGlass'):
    return principled(name, (0.9, 0.95, 1.0), rough=0.03, transmission=1.0)


# --------------------------------------------------------------------------
# 1. Tiki Bar: bamboo counter, and behind it a tiki hut: a carved idol
#    between two torches under a thatched roof.
# --------------------------------------------------------------------------

def build_tiki():
    bamboo = plain('#c8a24a', rough=0.6)
    bamboo_dark = plain('#7a5a22', rough=0.7)
    thatch = plain('#c09040', rough=0.95)
    reed = plain('#9a6e2a', rough=0.9)
    shell(reed, plain('#5a3518', rough=0.4), reed)
    for i in range(9):
        x = -0.42 + i * 0.105
        cylinder(f'Pole{i}', x, -1.29, 0.06, 0.97, 0.045, bamboo if i % 2 else bamboo_dark, verts=12)
        cylinder(f'Node{i}', x, -1.29, 0.5, 0.52, 0.05, bamboo_dark, verts=12)
    # Hut: bamboo posts at the corners, a woven back, a thick thatch roof.
    hutch(bamboo_dark, plain('#6a4a1e', rough=0.9), crown=bamboo_dark)
    for k in range(4):
        z = HZ1 + 0.05 + k * 0.06
        box(f'Thatch{k}', -0.58 + k * 0.05, 0.58 - k * 0.05, HY0 - 0.14 + k * 0.05, HY1 + 0.06, z, z + 0.09, thatch, bevel=0.03)
    # A carved idol in the middle: stacked blocks with a face.
    wood_idol = plain('#6a3a1a', rough=0.8)
    box('IdolBody', -0.11, 0.11, 1.1, 1.3, HZ0, 1.75, wood_idol, bevel=0.03)
    box('IdolHead', -0.14, 0.14, 1.08, 1.3, 1.75, 2.12, wood_idol, bevel=0.04)
    for x in (-0.06, 0.06):
        box(f'IdolEye{x}', x - 0.035, x + 0.035, 1.075, 1.08, 1.98, 2.04, plain('#f2e3b0'), bevel=0)
    box('IdolMouth', -0.08, 0.08, 1.075, 1.08, 1.82, 1.88, plain('#e2533d'), bevel=0)
    for x in (-0.3, 0.3):
        cylinder(f'Torch{x}', x, 1.05, HZ0, 1.75, 0.02, bamboo, verts=10)
        cone(f'TorchCup{x}', x, 1.05, 1.73, 1.83, 0.025, 0.055, bamboo_dark)
        cone(f'Flame{x}', x, 1.05, 1.81, 1.98, 0.045, 0.0, glowing('#ff8a1f', 6))
        bottle_row(f'Bottle{x}', x - 0.08, x + 0.08, 1.2, HZ0, 2, bottles_of('#c86a1a', '#e2533d', '#f2c83a'), seed=31)
    for i, x in enumerate((-0.28, -0.14)):
        sphere(f'Coconut{i}', x, -1.1, 1.11, 0.06, plain('#5a3a1e', rough=0.8))
        cylinder(f'Umbrella{i}', x + 0.02, -1.1, 1.14, 1.27, 0.003, bamboo, verts=6)
        cone(f'UmbrellaTop{i}', x + 0.02, -1.1, 1.24, 1.29, 0.06, 0.0, plain(('#ff4fa8', '#23c4ff')[i]))
    sphere('Pineapple', 0.24, -1.05, 1.13, 0.07, plain('#e0a22a', rough=0.7))
    cone('PineappleTop', 0.24, -1.05, 1.19, 1.32, 0.05, 0.0, plain('#3a8a2a'))


# --------------------------------------------------------------------------
# 2. Disco Bar: a rainbow light-up counter; behind it a wall of glowing
#    dance-floor squares in a gold frame, a disco ball on top.
# --------------------------------------------------------------------------

def build_disco():
    gold = principled('DiscoGold', srgb('#f2c040'), rough=0.25)
    dark = plain('#1a1024', rough=0.4)
    mirror = principled('MirrorTile', srgb('#d8dce8'), rough=0.08)
    shell(dark, gold, dark)
    rainbow = ['#ff3b5a', '#ff8a1f', '#ffd23f', '#39ff88', '#23c4ff', '#a855f7']
    for i, c in enumerate(rainbow):
        z0 = 0.14 + i * 0.13
        box(f'Rainbow{i}', -0.44, 0.44, -1.292, -1.28, z0, z0 + 0.11, glowing(c, 2.2), bevel=0)
    hutch(gold, dark, depth=0.08)
    rnd = random.Random(4)
    for r in range(6):            # light-up squares filling the back
        for c in range(4):
            x0 = -0.44 + c * 0.22
            z0 = HZ0 + 0.03 + r * 0.22
            box(f'Square{r}_{c}', x0 + 0.01, x0 + 0.21, HY1 - 0.1, HY1 - 0.08, z0, z0 + 0.2,
                glowing(rnd.choice(rainbow), 1.6), bevel=0)
    sphere('DiscoBall', 0, 1.13, HZ1 + 0.24, 0.15, mirror, segs=12)
    cylinder('BallStand', 0, 1.13, HZ1 + 0.08, HZ1 + 0.1, 0.06, gold, verts=16)
    foot_rail(gold)
    for i, (x, c) in enumerate(((-0.3, '#ff3fa4'), (-0.16, '#23c4ff'), (0.24, '#ffd23f'))):
        cocktail(f'Disco{i}', x, -1.12, 1.05, clear_glass(), c)
    bottle_row('BackBottle', -0.36, 0.36, 1.0, 0.94, 6, bottles_of('#ff3fa4', '#23c4ff', '#ffd23f', glow=1.8), seed=41)


# --------------------------------------------------------------------------
# 3. Speakeasy Bar: black lacquer and gold; behind it a warmly lit
#    mahogany cabinet with an arched mirror, decanters and a gold sunburst.
# --------------------------------------------------------------------------

def build_speakeasy():
    lacquer = principled('Lacquer', srgb('#3a1f22'), rough=0.18)
    gold = principled('DecoGold', srgb('#e8b84a'), rough=0.22)
    mahogany = wood('Mahogany', (0.3, 0.09, 0.05), (0.5, 0.18, 0.09))
    amber = glowing('#ffb04a', 1.2)
    shell(lacquer, mahogany, mahogany, top_edge=gold)
    for i in range(3):            # gold art-deco fans on the counter front
        cx = -0.3 + i * 0.3
        for k in range(7):
            a = math.radians(-60 + k * 20)
            neon_tube(f'Fan{i}_{k}', [(cx, -1.29, 0.2), (cx + math.sin(a) * 0.12, -1.29, 0.2 + math.cos(a) * 0.55)], 0.008, gold)
        box(f'FanBase{i}', cx - 0.13, cx + 0.13, -1.295, -1.28, 0.16, 0.2, gold, bevel=0)
    foot_rail(gold)
    hutch(mahogany, amber, crown=lacquer)
    box('Mirror', -0.3, 0.3, HY1 - 0.07, HY1 - 0.06, 1.4, 2.15, principled('Mirror', srgb('#c8b8a0'), rough=0.05), bevel=0)
    for k in range(9):            # gold sunburst on the crown
        a = math.radians(-80 + k * 20)
        neon_tube(f'Sun{k}', [(0, HY0 - 0.03, HZ1 + 0.04), (math.sin(a) * 0.16, HY0 - 0.03, HZ1 + 0.04 + math.cos(a) * 0.16)], 0.008, gold)
    box('DecoShelf', -0.45, 0.45, 0.92, 1.34, 1.36, 1.38, gold, bevel=0.003)
    for i, x in enumerate((-0.3, -0.1, 0.1, 0.3)):     # crystal decanters
        sphere(f'Decanter{i}', x, 1.12, 1.46, 0.07, plain(('#c08030', '#8a4a1a', '#d8c090', '#6a2a2a')[i], rough=0.05, transmission=0.6))
        cylinder(f'DecNeck{i}', x, 1.12, 1.52, 1.6, 0.018, clear_glass(), verts=10)
        sphere(f'Stopper{i}', x, 1.12, 1.62, 0.025, gold, segs=8)
    for x in (-0.3, 0.3):         # green banker lamps
        cylinder(f'LampStem{x}', x, 0.98, 0.94, 1.1, 0.008, gold, verts=8)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.05, depth=0.16, location=(x, 0.98, 1.13), rotation=(0, math.radians(90), 0))
        bpy.context.active_object.name = 'LampShade'
        bb._finish(bpy.context.active_object, principled('BankerGreen', srgb('#1f8a4a'), rough=0.2, emission=srgb('#3aff7a'), emission_strength=0.8), 0)
    for x in (-0.28, -0.14):
        cylinder(f'Rocks{x}', x, -1.1, 1.05, 1.13, 0.035, plain('#c08030', rough=0.05, transmission=0.6), verts=16)


# --------------------------------------------------------------------------
# 4. Marble Lounge: white marble and gold; behind it an emerald alcove
#    with a gold-framed mirror and a champagne tower.
# --------------------------------------------------------------------------

def build_marble():
    marble = principled('Marble', srgb('#f1eee9'), rough=0.18)
    vein = plain('#d4cec6', rough=0.2)
    gold = principled('LuxGold', srgb('#e6b84a'), rough=0.22)
    emerald = plain('#1e7a5a', rough=0.5)
    shell(marble, marble, marble, top_edge=gold)
    rnd = random.Random(7)
    for i in range(6):            # soft grey veins
        x = rnd.uniform(-0.4, 0.4)
        box(f'Vein{i}', x, x + 0.012, -1.283, -1.281, rnd.uniform(0.1, 0.3), rnd.uniform(0.6, 0.95), vein, bevel=0)
    for x in (-0.3, 0.0, 0.3):
        box(f'Pilaster{x}', x - 0.025, x + 0.025, -1.3, -1.28, 0.06, 0.98, gold, bevel=0.004)
    foot_rail(gold)
    hutch(marble, emerald, crown=marble)
    box('MirrorFrame', -0.26, 0.26, HY1 - 0.08, HY1 - 0.06, 1.3, 2.18, gold, bevel=0.01)
    box('MirrorGlass', -0.22, 0.22, HY1 - 0.085, HY1 - 0.08, 1.34, 2.14, principled('LuxMirror', srgb('#cfe8e0'), rough=0.05,
                                                                                    emission=srgb('#a0ffe0'), emission_strength=0.3), bevel=0)
    box('CrownGold', -0.5, 0.5, HY0 - 0.03, HY0 - 0.02, HZ1 + 0.02, HZ1 + 0.06, gold, bevel=0)
    coupe = clear_glass('Coupe')
    fizz = glowing('#ffe9a8', 1.5)
    for level, (n, z) in enumerate(((4, 0.94), (3, 1.04), (2, 1.14), (1, 1.24))):   # champagne tower
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.1
            cylinder(f'CoupeStem{level}_{i}', x, 1.05, z, z + 0.05, 0.004, coupe, verts=8)
            cone(f'Coupe{level}_{i}', x, 1.05, z + 0.05, z + 0.1, 0.01, 0.045, fizz)
    for x in (-0.28, -0.17):
        cylinder(f'FluteStem{x}', x, -1.18, 1.05, 1.12, 0.004, gold, verts=8)
        cone(f'Flute{x}', x, -1.18, 1.12, 1.24, 0.012, 0.025, fizz)
    cylinder('FruitBowl', 0.22, -1.05, 1.05, 1.1, 0.08, gold, verts=20)
    for k, c in enumerate(('#e2533d', '#f2c83a', '#7ac23a')):
        sphere(f'Fruit{k}', 0.19 + k * 0.03, -1.05 + (k - 1) * 0.03, 1.13, 0.035, plain(c))


# --------------------------------------------------------------------------
# 5. Surf Shack: teal and white planks; behind it a rack of upright
#    surfboards under a striped awning with string lights.
# --------------------------------------------------------------------------

def build_surf():
    teal = plain('#2fb0b0', rough=0.7)
    white = plain('#f2efe6', rough=0.6)
    drift = plain('#c9b08a', rough=0.85)
    shell(teal, drift, white)
    for i in range(6):
        z0 = 0.08 + i * 0.15
        box(f'Plank{i}', -0.47, 0.47, -1.295, -1.28, z0, z0 + 0.13, teal if i % 2 else white, bevel=0.01)
    hutch(drift, plain('#e8dcc0', rough=0.85), crown=white)
    for i, (x, c) in enumerate(((-0.28, '#ff8a1f'), (0.0, '#23c4ff'), (0.28, '#ff4fa8'))):   # surfboards
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1, location=(x, 1.25, 1.6))
        board = bpy.context.active_object
        board.scale = (0.11, 0.025, 0.6)
        bb._finish(board, plain(c, rough=0.4), 0)
        box(f'BoardStripe{i}', x - 0.012, x + 0.012, 1.22, 1.223, 1.08, 2.12, white, bevel=0)
    for i in range(6):            # striped awning over the front
        x0 = -0.5 + i * (1 / 6)
        box(f'Awning{i}', x0, x0 + 1 / 6, HY0 - 0.2, HY0 + 0.05, HZ1 + 0.02, HZ1 + 0.06, teal if i % 2 else white, bevel=0.004)
    for i in range(9):
        x = -0.44 + i * 0.11
        sphere(f'Bulb{i}', x, HY0 - 0.18, HZ1 - 0.04 - 0.04 * math.sin(i / 8 * math.pi), 0.022,
               glowing(('#ffd23f', '#ff4fa8', '#23c4ff', '#39ff88')[i % 4], 4), segs=8)
    bottle_row('BackBottle', -0.36, 0.36, 1.0, 0.94, 6, bottles_of('#f2c83a', '#e2533d', '#2fb0b0', '#d8d8d0'), seed=71)
    for i, x in enumerate((-0.28, -0.14)):
        cylinder(f'Beer{i}', x, -1.1, 1.05, 1.2, 0.03, plain('#e0a22a', rough=0.1, transmission=0.6), verts=14)
        sphere(f'Lime{i}', x + 0.02, -1.1, 1.21, 0.015, plain('#7ac23a'))
    sphere('Shell', 0.25, -1.05, 1.07, 0.05, plain('#ff9aa8', rough=0.5))


# --------------------------------------------------------------------------
# 6. Retro Diner: red quilted counter and chrome; behind it a glowing
#    soda fridge with glass doors and a neon sign.
# --------------------------------------------------------------------------

def build_diner():
    red = plain('#d0283a', rough=0.35)
    chrome = principled('DinerChrome', srgb('#dde2ea'), rough=0.12)
    mint = plain('#9fe2cf', rough=0.4)
    shell(red, mint, red, top_edge=chrome)
    for i in range(4):
        for j in range(3):
            sphere(f'Button{i}_{j}', -0.33 + i * 0.22, -1.29, 0.3 + j * 0.25, 0.018, chrome, segs=8)
    box('ChromeBand', -0.47, 0.47, -1.3, -1.28, 0.9, 0.95, chrome, bevel=0.004)
    foot_rail(chrome)
    # Soda fridge: chrome body, two lit glass doors full of bottles.
    hutch(chrome, glowing('#e8fff8', 0.9), crown=red)
    for i, x0 in enumerate((-0.44, 0.01)):
        box(f'DoorFrame{i}', x0, x0 + 0.43, HY0 - 0.01, HY0 + 0.01, HZ0 + 0.02, HZ1 - 0.04, chrome, bevel=0.006)
        box(f'DoorGlass{i}', x0 + 0.03, x0 + 0.4, HY0 - 0.012, HY0 - 0.008, HZ0 + 0.06, HZ1 - 0.08,
            principled(f'FridgeGlass{i}', (0.85, 0.95, 1.0), rough=0.05, transmission=0.85), bevel=0)
        box(f'Handle{i}', x0 + (0.38 if i == 0 else 0.03), x0 + (0.4 if i == 0 else 0.05), HY0 - 0.04, HY0 - 0.01, 1.4, 1.8, chrome, bevel=0.003)
    for j, z in enumerate((1.1, 1.45, 1.8)):
        box(f'FridgeShelf{j}', -0.44, 0.44, 0.92, 1.34, z - 0.015, z, chrome, bevel=0)
        bottle_row(f'Soda{j}_', -0.38, 0.38, 1.1, z, 7, bottles_of('#d0283a', '#3a8a2a', '#f2c83a', '#5a2a1a'), heights=(0.16, 0.2), seed=81 + j)
    neon_tube('DinerSign', [(-0.22, HY0 - 0.04, HZ1 + 0.04), (0.22, HY0 - 0.04, HZ1 + 0.04)], 0.016, glowing('#ff3b5a', 8))
    cone('Shake', -0.22, -1.08, 1.05, 1.24, 0.03, 0.045, plain('#ff9ac8', rough=0.4))
    sphere('Cream', -0.22, -1.08, 1.26, 0.04, plain('#ffffff'))
    sphere('Cherry', -0.22, -1.08, 1.31, 0.015, plain('#c0102a'))


# --------------------------------------------------------------------------
# 7. Warehouse Bar: riveted steel and concrete; behind it a steel rack of
#    beer kegs with copper taps and Edison bulbs.
# --------------------------------------------------------------------------

def build_warehouse():
    steel = plain('#4a4e56', rough=0.55)
    rust = plain('#8a4a2a', rough=0.8)
    concrete = plain('#9a9a96', rough=0.9)
    copper = principled('Copper', srgb('#c87a4a'), rough=0.3)
    shell(steel, concrete, steel)
    for i in range(3):
        x0 = -0.42 + i * 0.285
        box(f'Panel{i}', x0, x0 + 0.26, -1.29, -1.28, 0.12, 0.9, rust if i == 1 else steel, bevel=0.006)
        for z in (0.16, 0.86):
            for x in (x0 + 0.03, x0 + 0.23):
                sphere(f'Rivet{i}_{z}_{x}', x, -1.295, z, 0.012, plain('#2a2c30'), segs=6)
    foot_rail(plain('#2a2c30', rough=0.4))
    hutch(steel, plain('#8a3a2a', rough=0.9), crown=steel)
    for r in range(6):            # brick courses on the back
        box(f'Mortar{r}', -0.46, 0.46, HY1 - 0.065, HY1 - 0.06, HZ0 + 0.1 + r * 0.22, HZ0 + 0.112 + r * 0.22, plain('#c8bca8'), bevel=0)
    for j, z in enumerate((1.12, 1.62)):    # kegs lying on two steel shelves
        box(f'KegShelf{j}', -0.45, 0.45, 0.92, 1.34, z - 0.04, z - 0.02, steel, bevel=0.003)
        for i, x in enumerate((-0.26, 0.0, 0.26)):
            bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.12, depth=0.36, location=(x, 1.13, z + 0.1),
                                                rotation=(math.radians(90), 0, 0))
            bb._finish(bpy.context.active_object, principled('KegSteel', srgb('#b8bcc4'), rough=0.3), 0)
            cylinder(f'KegTap{j}_{i}', x, 0.93, z + 0.06, z + 0.14, 0.015, copper, verts=8)
    for x in (-0.3, 0.0, 0.3):
        cylinder(f'Cord{x}', x, 1.0, 2.0, HZ1, 0.004, plain('#15121a'), verts=6)
        sphere(f'Edison{x}', x, 1.0, 1.96, 0.04, glowing('#ffb04a', 5), segs=10)
    for x in (-0.28, -0.14):
        cylinder(f'Mug{x}', x, -1.1, 1.05, 1.2, 0.038, plain('#e0a22a', rough=0.1, transmission=0.5), verts=14)
        cylinder(f'Foam{x}', x, -1.1, 1.2, 1.23, 0.04, plain('#fff4dc'), verts=14)


# --------------------------------------------------------------------------
# 8. Garden Bar: light wood and a flower box; behind it a trimmed hedge
#    wall with flowers under a white trellis arch.
# --------------------------------------------------------------------------

def build_garden():
    birch = wood('Birch', (0.55, 0.42, 0.28), (0.78, 0.64, 0.46))
    leaf = plain('#3a9a3a', rough=0.8)
    leaf2 = plain('#6ac24a', rough=0.8)
    white = plain('#f4f2ea', rough=0.6)
    shell(birch, plain('#f2ead8', rough=0.5), birch)
    box('Planter', -0.47, 0.47, -1.4, -1.29, 0.55, 0.78, birch, bevel=0.01)
    for i in range(12):
        sphere(f'Green{i}', -0.42 + i * 0.076, -1.34, 0.82, 0.05, leaf, segs=8)
        sphere(f'Bloom{i}', -0.42 + i * 0.076, -1.37, 0.86, 0.03, plain(('#ff4fa8', '#ffd23f', '#a855f7')[i % 3]), segs=8)
    hutch(white, plain('#2a6a2a', rough=0.9), crown=white)
    box('Hedge', -0.45, 0.45, 0.98, HY1 - 0.06, HZ0, HZ1 - 0.02, leaf, bevel=0.05)
    rnd = random.Random(3)
    for i in range(30):           # leaves and flowers on the hedge face
        sphere(f'Leaf{i}', rnd.uniform(-0.42, 0.42), 0.98, rnd.uniform(HZ0 + 0.05, HZ1 - 0.08), rnd.uniform(0.03, 0.05), leaf2, segs=8)
    for i in range(12):
        sphere(f'Flower{i}', rnd.uniform(-0.4, 0.4), 0.965, rnd.uniform(HZ0 + 0.1, HZ1 - 0.1), 0.025,
               plain(('#ff4fa8', '#ffd23f', '#ffffff')[i % 3]), segs=8)
    for k in range(9):            # trellis arch in front of the hedge
        a = k / 8 * math.pi
        neon_tube(f'Arch{k}', [(-0.4 * math.cos(a), HY0 + 0.02, 1.95 + 0.25 * math.sin(a)),
                               (-0.4 * math.cos(a + math.pi / 8), HY0 + 0.02, 1.95 + 0.25 * math.sin(a + math.pi / 8))], 0.012, white)
    bottle_row('BackBottle', -0.36, 0.36, 0.93, 0.94, 6, bottles_of('#7ac23a', '#f2c83a', '#ff9aa8', '#d8d8d0'), seed=101)
    for i, x in enumerate((-0.28, -0.14)):
        cylinder(f'Mojito{i}', x, -1.1, 1.05, 1.18, 0.03, plain('#c8f0b0', rough=0.05, transmission=0.6), verts=14)
        sphere(f'Mint{i}', x, -1.1, 1.19, 0.02, leaf2, segs=8)


# --------------------------------------------------------------------------
# 9. Cyber Bar: navy with a glowing grid; behind it a big hologram screen
#    with an equaliser, framed in cyan light.
# --------------------------------------------------------------------------

def build_cyber():
    navy = principled('CyberNavy', srgb('#0b1430'), rough=0.2)
    cyan = glowing('#23e4ff', 6)
    magenta = glowing('#ff2ad4', 6)
    shell(navy, navy, navy)
    for i in range(7):
        x = -0.42 + i * 0.14
        box(f'GridV{i}', x - 0.004, x + 0.004, -1.292, -1.28, 0.1, 0.94, cyan, bevel=0)
    for j in range(5):
        z = 0.14 + j * 0.2
        box(f'GridH{j}', -0.44, 0.44, -1.292, -1.28, z - 0.004, z + 0.004, cyan, bevel=0)
    box('TopGlow', -0.49, 0.49, -1.385, -1.37, 1.0, 1.03, magenta, bevel=0)
    box('BackTopGlow', -0.48, 0.48, 0.83, 0.845, 0.895, 0.925, magenta, bevel=0)
    hutch(navy, principled('Screen', srgb('#06223a'), rough=0.1, emission=srgb('#1a5a90'), emission_strength=0.9), crown=navy, depth=0.1)
    for x in (-0.48, 0.48):
        box(f'EdgeGlow{x}', x - 0.006, x + 0.006, HY0 - 0.006, HY0 + 0.004, HZ0, HZ1, cyan, bevel=0)
    box('CrownGlow', -0.49, 0.49, HY0 - 0.035, HY0 - 0.02, HZ1 + 0.03, HZ1 + 0.05, cyan, bevel=0)
    for k, h in enumerate((0.35, 0.6, 0.3, 0.75, 0.5, 0.4, 0.65)):   # equaliser bars on the screen
        x = -0.36 + k * 0.12
        box(f'EqBar{k}', x - 0.04, x + 0.04, HY1 - 0.105, HY1 - 0.1, 1.15, 1.15 + h, (cyan, magenta)[k % 2], bevel=0)
    bottle_row('BackBottle', -0.36, 0.36, 1.0, 0.94, 6, bottles_of('#23e4ff', '#ff2ad4', '#7a5aff', '#39ff88', glow=2.4), seed=111)
    for i, (x, c) in enumerate(((-0.3, '#23e4ff'), (-0.16, '#ff2ad4'))):
        cocktail(f'Cyber{i}', x, -1.12, 1.05, clear_glass('CyberGlass'), c)
    foot_rail(plain('#2a3a6a', rough=0.3))


# --------------------------------------------------------------------------
# 10. Candy Bar: pastel pink with sprinkles; behind it a candy shop
#     cabinet of gumball machines and sweet jars, lollipops on top.
# --------------------------------------------------------------------------

def build_candy():
    pink = plain('#ff9ad0', rough=0.4)
    mint = plain('#9ff0d8', rough=0.4)
    cream = plain('#fff2f8', rough=0.4)
    shell(pink, cream, mint)
    rnd = random.Random(5)
    for i in range(40):
        x, z = rnd.uniform(-0.42, 0.42), rnd.uniform(0.12, 0.85)
        box(f'Sprinkle{i}', x - 0.02, x + 0.02, -1.29, -1.28, z - 0.006, z + 0.006,
            plain(('#ffffff', '#ffd23f', '#23c4ff', '#a855f7', '#ff3b5a')[i % 5]), bevel=0)
    for i in range(10):
        x = -0.44 + i * 0.098
        cone(f'Drip{i}', x, -1.3, 0.86 + 0.04 * (i % 3), 0.98, 0.0, 0.035, cream)
    hutch(cream, plain('#ffd6ea', rough=0.6), crown=pink)
    jar = principled('JarGlass', (0.95, 0.97, 1.0), rough=0.05, transmission=0.7)
    for i, x in enumerate((-0.28, 0.0, 0.28)):      # gumball machines
        cylinder(f'GumBase{i}', x, 1.13, HZ0, HZ0 + 0.18, 0.08, plain(('#ff3b5a', '#23c4ff', '#a855f7')[i]), verts=16)
        sphere(f'GumGlobe{i}', x, 1.13, HZ0 + 0.3, 0.12, jar, segs=16)
        for g in range(8):
            sphere(f'Gum{i}_{g}', x + rnd.uniform(-0.07, 0.07), 1.13 + rnd.uniform(-0.07, 0.07), HZ0 + 0.24 + rnd.uniform(-0.04, 0.06),
                   0.025, plain(('#ffd23f', '#ff4fa8', '#39ff88', '#23c4ff')[g % 4]), segs=8)
    box('JarShelf', -0.45, 0.45, 0.92, 1.34, 1.66, 1.68, cream, bevel=0.003)
    for i, x in enumerate((-0.3, -0.1, 0.1, 0.3)):  # sweet jars
        cylinder(f'Jar{i}', x, 1.13, 1.68, 1.9, 0.07, jar, verts=16)
        cylinder(f'Sweets{i}', x, 1.13, 1.69, 1.84, 0.062, plain(('#ff9ad0', '#9ff0d8', '#ffd23f', '#c8a0ff')[i]), verts=16)
        cylinder(f'Lid{i}', x, 1.13, 1.9, 1.93, 0.075, plain('#ff4fa8'), verts=16)
    for x, c in ((-0.36, '#ff4fa8'), (0.36, '#23c4ff')):   # lollipops on the crown
        cylinder(f'Stick{x}', x, 1.13, HZ1 + 0.08, HZ1 + 0.3, 0.012, cream, verts=8)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.12, depth=0.04, location=(x, 1.13, HZ1 + 0.4),
                                            rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, plain(c, rough=0.3), 0)
    for i, x in enumerate((-0.28, -0.12)):
        cylinder(f'Cupcake{i}', x, -1.1, 1.05, 1.11, 0.04, plain('#c08050'), verts=14)
        sphere(f'Frosting{i}', x, -1.1, 1.14, 0.045, plain(('#ff9ad0', '#9ff0d8')[i]), segs=10)
    foot_rail(plain('#ff4fa8', rough=0.3))


# --------------------------------------------------------------------------
# The nightclub batch (October 2026): made after the owner's item review,
# from the kept bars and the main reference clubs. Glossy black, white,
# chrome and velvet, lit by the bar itself.
# --------------------------------------------------------------------------

def bays(frame, glow_hex, bottle_cols, cols=3, rows=2, seed=0, strength=1.6):
    """A back wall of backlit bottle bays: a frame of cells, each glowing
    from behind with a few bottles standing in it (the reference clubs'
    white cabinets lit purple)."""
    w = 0.92 / cols
    h = (HZ1 - HZ0 - 0.06) / rows
    for r in range(rows):
        for c in range(cols):
            x0 = -0.46 + c * w
            z0 = HZ0 + 0.03 + r * h
            box(f'BayGlow{r}_{c}', x0 + 0.02, x0 + w - 0.02, HY1 - 0.08, HY1 - 0.06, z0 + 0.02, z0 + h - 0.02,
                principled(f'Bay{glow_hex}{strength}', srgb(glow_hex), rough=0.6, emission=srgb(glow_hex), emission_strength=strength), bevel=0)
            box(f'BayShelf{r}_{c}', x0 + 0.02, x0 + w - 0.02, 0.92, HY1 - 0.06, z0, z0 + 0.025, frame, bevel=0.003)
            bottle_row(f'Bottle{r}_{c}_', x0 + 0.05, x0 + w - 0.05, 1.15, z0 + 0.025, 2, bottle_cols, seed=seed + r * 7 + c,
                       heights=(0.2, min(0.28, h - 0.1)))
    for c in range(cols + 1):
        x = -0.46 + c * w
        box(f'BayPost{c}', x - 0.018, x + 0.018, 0.9, 0.96, HZ0, HZ1, frame, bevel=0.004)
    for r in range(rows + 1):
        z = HZ0 + 0.03 + r * h
        box(f'BayRail{r}', -0.47, 0.47, 0.9, 0.96, z - 0.012, z + 0.012, frame, bevel=0.003)


# 11. Ultraviolet Bar: a white gloss counter banded in purple light, and
#     white bottle bays glowing purple behind (reference club 2).
def build_ultraviolet():
    white = principled('UvWhite', srgb('#f4f2f8'), rough=0.12)
    black = principled('UvBlack', srgb('#16121e'), rough=0.15)
    purple = glowing('#a24bff', 5)
    shell(white, black, white)
    for z in (0.22, 0.52, 0.82):
        box(f'Band{z}', -0.45, 0.45, -1.292, -1.28, z, z + 0.05, purple, bevel=0)
    box('TopGlow', -0.49, 0.49, -1.385, -1.37, 0.99, 1.03, purple, bevel=0)
    box('KickGlow', -0.45, 0.45, -1.27, -1.255, 0.01, 0.035, purple, bevel=0)
    hutch(white, black, crown=white)
    bays(white, '#8a2aff', bottles_of('#ffffff', '#c8a0ff', '#ff6fd8', glow=0.6), seed=201, strength=1.2)
    box('CrownGlow', -0.49, 0.49, HY0 - 0.035, HY0 - 0.02, HZ1 + 0.02, HZ1 + 0.05, purple, bevel=0)
    for i, (x, c) in enumerate(((-0.3, '#b46bff'), (-0.16, '#ff6fd8'))):
        cocktail(f'Uv{i}', x, -1.12, 1.05, clear_glass(), c)
    foot_rail(principled('UvChrome', srgb('#d6dae4'), rough=0.15))


# 12. Champagne Bar: black lacquer quilted in gold, and behind it a gold
#     arch over a mirror, champagne on ice and a wall of golden bottles.
def build_champagne():
    black = principled('ChampBlack', srgb('#141016'), rough=0.12)
    gold = principled('ChampGold', srgb('#f0c24a'), rough=0.2, emission=srgb('#a87000'), emission_strength=0.15)
    shell(black, gold, black, top_edge=gold)
    # Gold diamond quilting on the counter front, clipped to the panel.
    X0, X1, Z0, Z1 = -0.43, 0.43, 0.1, 0.92
    for i in range(-4, 5):
        for slope in (1, -1):
            pts = []
            for x in (X0, X1):                      # z = c + slope * 1.6 * x
                c = 0.51 + i * 0.27
                pts.append((x, c + slope * 1.6 * x))
            (xa, za), (xb, zb) = pts
            seg = []
            for t in [k / 200 for k in range(201)]:
                x, z = xa + (xb - xa) * t, za + (zb - za) * t
                if Z0 <= z <= Z1:
                    seg.append((x, z))
            if len(seg) > 1:
                neon_tube(f'Quilt{slope}_{i}', [(seg[0][0], -1.29, seg[0][1]), (seg[-1][0], -1.29, seg[-1][1])], 0.007, gold)
    foot_rail(gold)
    hutch(black, black, crown=gold)
    bays(gold, '#d06a10', bottles_of('#2a5a2a', '#e8c070', '#3a2a10', glow=0.2), cols=3, rows=2, seed=211, strength=0.7)
    for k in range(13):           # a gold arch along the crown
        a = math.radians(180 * k / 12)
        neon_tube(f'Arch{k}', [(0.46 * math.cos(a), HY0 - 0.03, HZ1 + 0.05 + 0.22 * math.sin(a)),
                               (0.46 * math.cos(a + math.pi / 12), HY0 - 0.03, HZ1 + 0.05 + 0.22 * math.sin(a + math.pi / 12))], 0.012, gold)
    cylinder('Bucket', 0.24, -1.07, 1.05, 1.2, 0.07, principled('ChampSilver', srgb('#d8dce4'), rough=0.15), verts=20)
    cylinder('Bubbly', 0.24, -1.07, 1.1, 1.36, 0.028, principled('ChampBottle', srgb('#1f4a2a'), rough=0.15), verts=12)
    cylinder('Foil', 0.24, -1.07, 1.36, 1.41, 0.017, gold, verts=10)
    fizz = glowing('#ffe9a8', 1.5)
    for x in (-0.3, -0.19, -0.08):
        cylinder(f'FluteStem{x}', x, -1.12, 1.05, 1.12, 0.004, gold, verts=8)
        cone(f'Flute{x}', x, -1.12, 1.12, 1.25, 0.012, 0.025, fizz)


# 13. Velvet Bar: a counter of deep red tufted velvet with a black top,
#     and behind it amber-lit arched niches full of bottles.
def build_velvet():
    velvet = principled('BarVelvet', srgb('#9a0c26'), rough=0.85)
    dark = principled('BarVelvetDark', srgb('#5a0616'), rough=0.85)
    black = principled('BarBlackTop', srgb('#121014'), rough=0.1)
    brass = principled('BarBrass', srgb('#d8a84a'), rough=0.25)
    shell(velvet, black, black, top_edge=brass)
    for r, z in enumerate((0.25, 0.48, 0.71)):      # tufted panels with buttons
        for k in range(5):
            x = -0.36 + k * 0.18 + (0.09 if r % 2 else 0)
            if abs(x) > 0.42:
                continue
            sphere(f'Tuft{r}{k}', x, -1.285, z, 0.016, dark, segs=8)
    for z in (0.12, 0.92):
        box(f'Piping{z}', -0.46, 0.46, -1.295, -1.28, z - 0.012, z + 0.012, brass, bevel=0)
    foot_rail(brass)
    hutch(black, black, crown=velvet)
    for i, x in enumerate((-0.3, 0.0, 0.3)):        # arched amber niches
        box(f'Niche{i}', x - 0.12, x + 0.12, HY1 - 0.08, HY1 - 0.06, HZ0 + 0.08, 1.95, glowing('#ffa040', 1.4), bevel=0)
        arc_niche = [(x + 0.12 * math.cos(math.radians(a)), 1.95 + 0.12 * math.sin(math.radians(a))) for a in range(0, 181, 30)]
        for j in range(len(arc_niche) - 1):
            (x0, z0), (x1, z1) = arc_niche[j], arc_niche[j + 1]
            neon_tube(f'NicheArch{i}_{j}', [(x0, HY1 - 0.09, z0), (x1, HY1 - 0.09, z1)], 0.01, brass)
        box(f'NicheTop{i}', x - 0.12, x + 0.12, HY1 - 0.08, HY1 - 0.06, 1.95, 2.05, glowing('#ffa040', 1.4), bevel=0)
        for z in (1.12, 1.5):
            box(f'NicheShelf{i}{z}', x - 0.12, x + 0.12, 0.92, HY1 - 0.06, z, z + 0.02, brass, bevel=0.002)
            bottle_row(f'Bottle{i}_{z}', x - 0.09, x + 0.09, 1.15, z + 0.02, 2, bottles_of('#c86a1a', '#6a1a1a', '#e8c070'), seed=int(z * 10) + i)
    for x in (-0.48, 0.48):
        box(f'NicheWall{x}', x - 0.03, x + 0.03, 0.9, HY1, HZ0, HZ1, black, bevel=0.003)
    for x in (-0.28, -0.14):
        cylinder(f'Rocks{x}', x, -1.1, 1.05, 1.13, 0.035, plain('#c08030', rough=0.05, transmission=0.6), verts=16)


# 14. Chrome Bar: a quilted chrome counter edged in cyan light; behind it
#     glass shelves lit cyan, and a row of beer taps on the bar top.
def build_chrome():
    chrome = principled('BarChrome', srgb('#c8ced8'), rough=0.12)
    dark = principled('BarGunmetal', srgb('#2a2e36'), rough=0.2)
    cyan = glowing('#2ae0ff', 5)
    glass = principled('ShelfGlass', srgb('#bff4ff'), rough=0.03, transmission=0.9)
    shell(chrome, dark, dark)
    for r in range(4):            # quilted chrome squares
        for k in range(5):
            x0 = -0.44 + k * 0.176
            z0 = 0.1 + r * 0.21
            box(f'Quilt{r}{k}', x0 + 0.012, x0 + 0.164, -1.3, -1.285, z0 + 0.012, z0 + 0.198,
                principled(f'Quilt{(r + k) % 2}', srgb(('#dfe4ec', '#aeb6c2')[(r + k) % 2]), rough=0.12), bevel=0.01)
    box('TopGlow', -0.49, 0.49, -1.385, -1.37, 0.99, 1.03, cyan, bevel=0)
    for x in (-0.47, 0.47):
        box(f'EdgeGlow{x}', x - 0.008, x + 0.008, -1.31, -1.29, 0.06, 0.98, cyan, bevel=0)
    foot_rail(chrome)
    hutch(chrome, principled('ChromeBack', srgb('#0a2a36'), rough=0.2, emission=srgb('#0a6a8a'), emission_strength=1.0), crown=dark)
    for j, z in enumerate((1.3, 1.66, 2.0)):
        box(f'GlassShelf{j}', -0.45, 0.45, 0.92, 1.34, z - 0.015, z, glass, bevel=0.002)
        box(f'ShelfGlow{j}', -0.45, 0.45, 0.915, 0.925, z - 0.02, z - 0.012, cyan, bevel=0)
        bottle_row(f'Bottle{j}_', -0.36, 0.36, 1.13, z, 6, bottles_of('#bff4ff', '#2ae0ff', '#ffffff', '#7a8aff', glow=0.5), seed=231 + j)
    box('TapBar', -0.3, 0.3, 0.96, 1.02, 0.94, 1.0, chrome, bevel=0.01)
    for i in range(5):
        x = -0.24 + i * 0.12
        cylinder(f'Tap{i}', x, 0.99, 1.0, 1.14, 0.012, chrome, verts=10)
        cylinder(f'TapHandle{i}', x, 0.99, 1.14, 1.24, 0.016, (cyan, dark)[i % 2], verts=10)
    for x in (-0.28, -0.15):
        cylinder(f'Pint{x}', x, -1.1, 1.05, 1.2, 0.038, plain('#f2b23a', rough=0.05, transmission=0.5), verts=16)
        cylinder(f'Foam{x}', x, -1.1, 1.2, 1.23, 0.038, plain('#fff6e0', rough=0.8), verts=16)


# 15. Pink Neon Bar: black gloss with a pink neon wave along the front;
#     behind it a mirror wall with a neon sign of two glasses clinking.
def build_pinkneon():
    black = principled('PinkBlack', srgb('#120c14'), rough=0.08)
    pink = glowing('#ff3fb4', 6)
    hot = glowing('#ff8ad8', 4)
    mirror = principled('PinkMirror', srgb('#3a2238'), rough=0.05, emission=srgb('#ff3fb4'), emission_strength=0.15)
    shell(black, black, black)
    wave = [(-0.44 + i * 0.04, -1.29, 0.5 + 0.18 * math.sin(i * 0.55)) for i in range(23)]
    neon_tube('Wave', wave, 0.012, pink)
    wave2 = [(-0.44 + i * 0.04, -1.29, 0.35 + 0.14 * math.sin(i * 0.55 + 1.6)) for i in range(23)]
    neon_tube('Wave2', wave2, 0.008, hot)
    box('TopGlow', -0.49, 0.49, -1.385, -1.37, 0.99, 1.03, pink, bevel=0)
    foot_rail(principled('PinkChrome', srgb('#d6dae4'), rough=0.15))
    hutch(black, mirror, crown=black)
    # Two cocktail glasses clinking, drawn in neon on the mirror.
    for side in (-1, 1):
        cx = side * 0.13
        tilt = side * 0.18
        pts = [(cx - 0.12, 1.85 + tilt * -0.3), (cx + 0.12, 1.85 + tilt * 0.3), (cx, 1.62), (cx - 0.12, 1.85 + tilt * -0.3)]
        neon_tube(f'GlassSign{side}', [(x, HY1 - 0.09, z) for x, z in pts], 0.012, pink)
        neon_tube(f'GlassStem{side}', [(cx, HY1 - 0.09, 1.62), (cx, HY1 - 0.09, 1.42)], 0.012, pink)
        neon_tube(f'GlassFoot{side}', [(cx - 0.07, HY1 - 0.09, 1.42), (cx + 0.07, HY1 - 0.09, 1.42)], 0.012, pink)
    for k in range(5):            # sparkle lines where they touch
        a = math.radians(40 + k * 25)
        neon_tube(f'Clink{k}', [(0.1 * math.cos(a) * 0.4, HY1 - 0.09, 1.98 + 0.04 * math.sin(a)),
                                (0.1 * math.cos(a), HY1 - 0.09, 1.98 + 0.12 * math.sin(a))], 0.007, hot)
    box('Shelf', -0.45, 0.45, 0.92, 1.34, 1.18, 1.2, black, bevel=0.003)
    box('ShelfGlow', -0.45, 0.45, 0.915, 0.925, 1.17, 1.18, pink, bevel=0)
    bottle_row('Bottle', -0.38, 0.38, 1.13, 1.2, 6, bottles_of('#ff3fb4', '#ffffff', '#ff8ad8', glow=1.0), seed=241)
    bottle_row('BackBottle', -0.36, 0.36, 1.0, 0.94, 5, bottles_of('#ff3fb4', '#c8a0ff', glow=1.6), seed=242)
    for i, (x, c) in enumerate(((-0.3, '#ff3fb4'), (-0.16, '#ff8ad8'))):
        cocktail(f'Pink{i}', x, -1.12, 1.05, clear_glass(), c)



DESIGNS = {
    'tiki': ('Tiki Bar', build_tiki),
    'disco': ('Disco Bar', build_disco),
    'speakeasy': ('Speakeasy Bar', build_speakeasy),
    'marble': ('Marble Lounge Bar', build_marble),
    'surf': ('Surf Shack Bar', build_surf),
    'diner': ('Retro Diner Bar', build_diner),
    'warehouse': ('Warehouse Bar', build_warehouse),
    'garden': ('Garden Bar', build_garden),
    'cyber': ('Cyber Bar', build_cyber),
    'candy': ('Candy Bar', build_candy),
    'ultraviolet': ('Ultraviolet Bar', build_ultraviolet),
    'champagne': ('Champagne Bar', build_champagne),
    'velvet': ('Velvet Bar', build_velvet),
    'chrome': ('Chrome Bar', build_chrome),
    'pinkneon': ('Pink Neon Bar', build_pinkneon),
}


def build(name):
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    bb.M.clear()
    bb.build_materials()
    root = bpy.data.objects.new(f'Bar_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    DESIGNS[name][1]()
    bpy.context.view_layer.update()
    push_back()
    ledge_glasses()
    iso_rig.make_bar_piece(root)
    return scene, cam, root


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    preview = '--preview' in args
    if preview:
        out = args[args.index('--preview') + 1]
        names = [a for a in args if a in DESIGNS] or list(DESIGNS)
        os.makedirs(out, exist_ok=True)
        for name in names:
            scene, cam, root = build(name)
            scene.cycles.samples = 32
            scene.render.resolution_percentage = 200
            iso_rig.add_outlines(scene, root)
            iso_rig.apply_model_scale(root)
            scene.render.filepath = os.path.join(out, f'bar_{name}.png')
            bpy.ops.render.render(write_still=True)
            print('preview', name, flush=True)
        return
    for name in [a for a in args if a in DESIGNS] or list(DESIGNS):
        scene, cam, root = build(name)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'bar_{name}.blend'))
        meta = iso_rig.render_facings(scene, cam, root, f'bar_{name}', bb.SPRITE_DIR, layers=iso_rig.split_counter(root))
        print(f'bar_{name}:', meta, flush=True)


if __name__ == '__main__':
    main()
