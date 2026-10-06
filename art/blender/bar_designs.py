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


def shell(counter_mat, top_mat, back_mat, wall_mat, crown_mat=None, top_edge=None):
    """The shared skeleton: counter body and top, aisle floor, back cabinet
    and top, shelf wall, side posts and crown. Every design dresses this."""
    box('CounterBody', -0.46, 0.46, -1.28, -0.82, 0.05, 0.98, counter_mat, bevel=0.008)
    box('CounterKick', -0.45, 0.45, -1.25, -0.82, 0, 0.06, plain('#15121a'), bevel=0.003)
    box('CounterTop', -0.49, 0.49, -1.37, -0.76, 0.98, 1.05, top_mat, bevel=0.015)
    if top_edge:
        box('TopEdge', -0.49, 0.49, -1.38, -1.36, 0.99, 1.04, top_edge, bevel=0)
    box('BackCabinet', -0.46, 0.46, 0.86, 1.36, 0.05, 0.88, back_mat, bevel=0.008)
    box('BackKick', -0.45, 0.45, 0.88, 1.36, 0, 0.06, plain('#15121a'), bevel=0.003)
    box('BackTop', -0.48, 0.48, 0.82, 1.42, 0.88, 0.94, top_mat, bevel=0.012)
    box('Wall', -0.49, 0.49, 1.4, 1.48, 0.94, 2.3, wall_mat, bevel=0.008)
    for x in (-0.47, 0.47):
        box(f'Post{x}', x - 0.025, x + 0.025, 1.1, 1.48, 0.94, 2.3, crown_mat or back_mat, bevel=0.006)
    box('Crown', -0.5, 0.5, 1.06, 1.49, 2.3, 2.38, crown_mat or back_mat, bevel=0.01)


def shelves(mat, bottles, zs=(1.36, 1.76), seed=0, edge=None):
    for j, z in enumerate(zs):
        box(f'Shelf{j}', -0.44, 0.44, 1.12, 1.39, z - 0.02, z, mat, bevel=0.003)
        if edge:
            box(f'ShelfEdge{j}', -0.44, 0.44, 1.115, 1.125, z - 0.035, z - 0.02, edge, bevel=0)
        bottle_row(f'Bottle{j}_', -0.36, 0.36, 1.27, z, 6, bottles, seed=seed + j)
    bottle_row('TopBottle', -0.36, 0.36, 1.27, 0.94, 6, bottles, seed=seed + 9)


def foot_rail(mat):
    rod_x('FootRail', -0.44, 0.44, -1.42, 0.18, 0.017, mat)
    for x in (-0.36, 0.36):
        box(f'RailPost{x}', x - 0.012, x + 0.012, -1.42, -1.28, 0.165, 0.195, mat, bevel=0.003)


def cocktail(name, x, y, z, glass, drink_hex, h=0.13):
    cylinder(f'{name}Stem', x, y, z, z + h * 0.5, 0.004, glass, verts=8)
    cone(f'{name}Bowl', x, y, z + h * 0.5, z + h, 0.004, 0.05, glass)
    cone(f'{name}Drink', x, y, z + h * 0.55, z + h * 0.9, 0.003, 0.042, glowing(drink_hex, 3))


# --------------------------------------------------------------------------
# 1. Tiki Bar: bamboo, a thatched roof, tiki torches, coconut drinks.
# --------------------------------------------------------------------------

def build_tiki():
    bamboo = plain('#c8a24a', rough=0.6)
    bamboo_dark = plain('#7a5a22', rough=0.7)
    thatch = plain('#b88a3a', rough=0.95)
    reed = plain('#9a6e2a', rough=0.9)
    shell(reed, plain('#5a3518', rough=0.4), reed, plain('#3a2410', rough=0.8), crown_mat=bamboo_dark)
    for i in range(9):        # bamboo poles across the counter front
        x = -0.42 + i * 0.105
        cylinder(f'Pole{i}', x, -1.29, 0.06, 0.97, 0.045, bamboo if i % 2 else bamboo_dark, verts=12)
        for z in (0.35, 0.7):
            cylinder(f'Node{i}_{z}', x, -1.29, z, z + 0.02, 0.05, bamboo_dark, verts=12)
    box('TikiMask', -0.07, 0.07, -1.345, -1.33, 0.3, 0.78, plain('#6a3a1a', rough=0.7), bevel=0.02)
    for z, c in ((0.66, '#f2e3b0'), (0.48, '#e2533d')):
        box(f'MaskBand{z}', -0.06, 0.06, -1.352, -1.345, z, z + 0.05, plain(c), bevel=0)
    # Thatched roof over the back bar.
    for k in range(5):
        z = 2.3 + k * 0.05
        box(f'Thatch{k}', -0.56 + k * 0.02, 0.56 - k * 0.02, 1.0 - k * 0.04, 1.52, z, z + 0.08, thatch, bevel=0.03)
    # Torches either side of the back bar.
    for x in (-0.44, 0.44):
        cylinder(f'Torch{x}', x, 0.92, 0.94, 1.6, 0.018, bamboo_dark, verts=10)
        cone(f'TorchCup{x}', x, 0.92, 1.58, 1.68, 0.025, 0.05, bamboo_dark)
        cone(f'Flame{x}', x, 0.92, 1.66, 1.82, 0.04, 0.0, glowing('#ff8a1f', 6))
    shelves(bamboo, bottles_of('#c86a1a', '#e2533d', '#f2c83a', '#2a8a4a', '#d8d8d0'), seed=30)
    # Coconut drinks with paper umbrellas.
    for i, x in enumerate((-0.28, -0.14)):
        sphere(f'Coconut{i}', x, -1.1, 1.11, 0.06, plain('#5a3a1e', rough=0.8))
        cylinder(f'Umbrella{i}', x + 0.02, -1.1, 1.14, 1.27, 0.003, bamboo, verts=6)
        cone(f'UmbrellaTop{i}', x + 0.02, -1.1, 1.24, 1.29, 0.06, 0.0, plain(('#ff4fa8', '#23c4ff')[i]))
    sphere('Pineapple', 0.24, -1.05, 1.13, 0.07, plain('#e0a22a', rough=0.7))
    cone('PineappleTop', 0.24, -1.05, 1.19, 1.32, 0.05, 0.0, plain('#3a8a2a'))


# --------------------------------------------------------------------------
# 2. Disco Bar: mirror tiles, gold, a rainbow light-up front, a disco ball.
# --------------------------------------------------------------------------

def build_disco():
    mirror = principled('MirrorTile', srgb('#d8dce8'), rough=0.08, metal=0.0)
    gold = principled('DiscoGold', srgb('#f2c040'), rough=0.25)
    dark = plain('#1a1024', rough=0.4)
    shell(dark, gold, dark, dark, crown_mat=gold)
    rainbow = ['#ff3b5a', '#ff8a1f', '#ffd23f', '#39ff88', '#23c4ff', '#a855f7']
    for i, c in enumerate(rainbow):     # glowing rainbow stripes across the front
        z0 = 0.14 + i * 0.13
        box(f'Rainbow{i}', -0.44, 0.44, -1.292, -1.28, z0, z0 + 0.11, glowing(c, 2.2), bevel=0)
    for i in range(10):                 # mirror tiles up the posts and crown
        for x in (-0.47, 0.47):
            box(f'Tile{x}_{i}', x - 0.03, x + 0.03, 1.08, 1.1, 0.98 + i * 0.13, 1.09 + i * 0.13, mirror, bevel=0.003)
    box('WallGlow', -0.44, 0.44, 1.392, 1.402, 0.98, 2.2, glowing('#a855f7', 1.2), bevel=0)
    shelves(mirror, bottles_of('#ff3fa4', '#23c4ff', '#ffd23f', '#a855f7', '#39ff88', glow=1.8), seed=40, edge=gold)
    # A disco ball hanging over the counter.
    cylinder('BallChain', 0, 1.0, 2.0, 2.38, 0.005, gold, verts=6)
    sphere('DiscoBall', 0, 1.0, 1.88, 0.14, mirror, segs=12)
    foot_rail(gold)
    for i, (x, c) in enumerate(((-0.3, '#ff3fa4'), (-0.16, '#23c4ff'), (0.24, '#ffd23f'))):
        cocktail(f'Disco{i}', x, -1.12, 1.05, principled('DiscoGlass', (0.9, 0.95, 1.0), rough=0.03, transmission=1.0), c)


# --------------------------------------------------------------------------
# 3. Speakeasy Bar: black lacquer, gold art-deco fans, green banker lamps.
# --------------------------------------------------------------------------

def build_speakeasy():
    lacquer = principled('Lacquer', srgb('#120d10'), rough=0.15)
    gold = principled('DecoGold', srgb('#d9a83a'), rough=0.25)
    mahogany = wood('Mahogany', (0.16, 0.04, 0.03), (0.3, 0.09, 0.05))
    green = principled('BankerGreen', srgb('#1f6a3a'), rough=0.2, emission=srgb('#3aff7a'), emission_strength=0.6)
    shell(lacquer, mahogany, lacquer, mahogany, crown_mat=lacquer, top_edge=gold)
    for i in range(3):       # art-deco sunburst fans on the counter front
        cx = -0.3 + i * 0.3
        for k in range(7):
            a = math.radians(-60 + k * 20)
            x0, z0 = cx, 0.2
            x1, z1 = cx + math.sin(a) * 0.12, 0.2 + math.cos(a) * 0.55
            neon_tube(f'Fan{i}_{k}', [(x0, -1.29, z0), (x1, -1.29, z1)], 0.006, gold)
        box(f'FanBase{i}', cx - 0.13, cx + 0.13, -1.295, -1.28, 0.16, 0.2, gold, bevel=0)
    foot_rail(gold)
    for x in (-0.3, 0.3):    # green banker lamps on the back bar
        cylinder(f'LampStem{x}', x, 0.98, 0.94, 1.1, 0.008, gold, verts=8)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.05, depth=0.16, location=(x, 0.98, 1.13),
                                            rotation=(0, math.radians(90), 0))
        bb._finish(bpy.context.active_object, green, 0)
    shelves(mahogany, bottles_of('#8a4a1a', '#c08030', '#3a2a1a', '#6a2a2a', '#d8c090'), seed=50, edge=gold)
    box('DecoPlate', -0.2, 0.2, 1.05, 1.06, 2.3, 2.38, gold, bevel=0)
    for x in (-0.28, -0.14):
        cylinder(f'Rocks{x}', x, -1.1, 1.05, 1.13, 0.035, plain('#c08030', rough=0.05, transmission=0.6), verts=16)


# --------------------------------------------------------------------------
# 4. Marble Lounge: white marble, gold trim, emerald velvet, a fruit bowl.
# --------------------------------------------------------------------------

def build_marble():
    marble = principled('Marble', srgb('#f1eee9'), rough=0.18)
    vein = plain('#b8b2ac', rough=0.2)
    gold = principled('LuxGold', srgb('#e6b84a'), rough=0.22)
    emerald = plain('#1e6a52', rough=0.5)
    shell(marble, marble, emerald, emerald, crown_mat=marble, top_edge=gold)
    rnd = random.Random(7)
    for i in range(10):      # grey veins across the marble front
        x = rnd.uniform(-0.4, 0.4)
        neon_tube(f'Vein{i}', [(x, -1.285, rnd.uniform(0.1, 0.4)), (x + rnd.uniform(-0.15, 0.15), -1.285, rnd.uniform(0.5, 0.95))], 0.003, vein)
    for x in (-0.3, 0.0, 0.3):   # gold pilasters
        box(f'Pilaster{x}', x - 0.025, x + 0.025, -1.3, -1.28, 0.06, 0.98, gold, bevel=0.004)
    foot_rail(gold)
    shelves(marble, bottles_of('#1e6a52', '#e6b84a', '#d8d8d0', '#7a2a3a'), seed=60, edge=gold)
    cylinder('FruitBowl', 0.22, -1.05, 1.05, 1.1, 0.08, gold, verts=20)
    for k, c in enumerate(('#e2533d', '#f2c83a', '#7ac23a')):
        sphere(f'Fruit{k}', 0.19 + k * 0.03, -1.05 + (k - 1) * 0.03, 1.13, 0.035, plain(c))
    for x in (-0.28, -0.17):
        cylinder(f'FluteStem{x}', x, -1.18, 1.05, 1.12, 0.004, gold, verts=8)
        cone(f'Flute{x}', x, -1.18, 1.12, 1.24, 0.012, 0.025, glowing('#ffe9a8', 1.5))


# --------------------------------------------------------------------------
# 5. Surf Shack: teal planks, a surfboard on the wall, string lights.
# --------------------------------------------------------------------------

def build_surf():
    teal = plain('#2fb0b0', rough=0.7)
    white = plain('#f2efe6', rough=0.6)
    drift = plain('#c9b08a', rough=0.85)
    shell(teal, drift, teal, plain('#e8dcc0', rough=0.85), crown_mat=white)
    for i in range(6):       # horizontal planks, alternating teal and white
        z0 = 0.08 + i * 0.15
        box(f'Plank{i}', -0.47, 0.47, -1.295, -1.28, z0, z0 + 0.13, teal if i % 2 else white, bevel=0.01)
    # A surfboard propped against the back wall.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1, location=(0.0, 1.36, 1.62))
    board = bpy.context.active_object
    board.scale = (0.14, 0.03, 0.62)
    bb._finish(board, plain('#ff8a1f', rough=0.4), 0)
    box('BoardStripe', -0.02, 0.02, 1.32, 1.33, 1.05, 2.2, white, bevel=0)
    # String lights along the crown.
    for i in range(9):
        x = -0.44 + i * 0.11
        sphere(f'Bulb{i}', x, 1.06, 2.27 - 0.03 * math.sin(i / 8 * math.pi), 0.022,
               glowing(('#ffd23f', '#ff4fa8', '#23c4ff', '#39ff88')[i % 4], 4), segs=8)
    shelves(drift, bottles_of('#f2c83a', '#e2533d', '#2fb0b0', '#d8d8d0', '#7ac23a'), seed=70)
    for i, x in enumerate((-0.28, -0.14)):
        cylinder(f'Beer{i}', x, -1.1, 1.05, 1.2, 0.03, plain('#e0a22a', rough=0.1, transmission=0.6), verts=14)
        sphere(f'Lime{i}', x + 0.02, -1.1, 1.21, 0.015, plain('#7ac23a'))
    sphere('Shell', 0.25, -1.05, 1.07, 0.05, plain('#ff9aa8', rough=0.5))


# --------------------------------------------------------------------------
# 6. Retro Diner: red quilted vinyl, chrome, a checkered wall, a milkshake.
# --------------------------------------------------------------------------

def build_diner():
    red = plain('#d0283a', rough=0.35)
    chrome = principled('DinerChrome', srgb('#dde2ea'), rough=0.12)
    mint = plain('#9fe2cf', rough=0.4)
    shell(red, mint, red, plain('#f2f2f2'), crown_mat=chrome, top_edge=chrome)
    for i in range(4):       # quilted buttons
        for j in range(3):
            sphere(f'Button{i}_{j}', -0.33 + i * 0.22, -1.29, 0.3 + j * 0.25, 0.018, chrome, segs=8)
    box('ChromeBand', -0.47, 0.47, -1.3, -1.28, 0.9, 0.95, chrome, bevel=0.004)
    for r in range(8):       # black-and-white checker wall
        for c in range(8):
            if (r + c) % 2:
                box(f'Check{r}_{c}', -0.44 + c * 0.11, -0.33 + c * 0.11, 1.395, 1.4, 0.98 + r * 0.16, 1.14 + r * 0.16, plain('#15121a'), bevel=0)
    shelves(chrome, bottles_of('#d0283a', '#9fe2cf', '#f2c83a', '#15121a'), seed=80)
    neon_tube('DinerSign', [(-0.2, 1.04, 2.34), (0.2, 1.04, 2.34)], 0.014, glowing('#ff3b5a', 8))
    # A milkshake with whipped cream and a cherry.
    cone('Shake', -0.22, -1.08, 1.05, 1.24, 0.03, 0.045, plain('#ff9ac8', rough=0.4))
    sphere('Cream', -0.22, -1.08, 1.26, 0.04, plain('#ffffff'))
    sphere('Cherry', -0.22, -1.08, 1.31, 0.015, plain('#c0102a'))
    foot_rail(chrome)


# --------------------------------------------------------------------------
# 7. Warehouse Bar: rusty steel, pipes, Edison bulbs, a concrete top.
# --------------------------------------------------------------------------

def build_warehouse():
    steel = plain('#4a4e56', rough=0.55)
    rust = plain('#8a4a2a', rough=0.8)
    concrete = plain('#9a9a96', rough=0.9)
    brick = plain('#8a3a2a', rough=0.9)
    shell(steel, concrete, steel, brick, crown_mat=steel)
    for i in range(3):       # riveted steel panels with rust streaks
        x0 = -0.42 + i * 0.285
        box(f'Panel{i}', x0, x0 + 0.26, -1.29, -1.28, 0.12, 0.9, rust if i == 1 else steel, bevel=0.006)
        for z in (0.16, 0.86):
            for x in (x0 + 0.03, x0 + 0.23):
                sphere(f'Rivet{i}_{z}_{x}', x, -1.295, z, 0.012, plain('#2a2c30'), segs=6)
    for r in range(7):       # brick courses on the back wall
        box(f'Mortar{r}', -0.48, 0.48, 1.395, 1.4, 1.0 + r * 0.19, 1.012 + r * 0.19, plain('#c8bca8'), bevel=0)
    rod_x('Pipe', -0.48, 0.48, 1.3, 2.2, 0.03, plain('#2a2c30', rough=0.4))
    for x in (-0.3, 0.0, 0.3):   # Edison bulbs hanging on cords
        cylinder(f'Cord{x}', x, 1.15, 1.95, 2.3, 0.004, plain('#15121a'), verts=6)
        sphere(f'Edison{x}', x, 1.15, 1.9, 0.04, glowing('#ffb04a', 5), segs=10)
    shelves(steel, bottles_of('#8a5a2a', '#c08030', '#3a4a2a', '#d8d8d0'), seed=90)
    foot_rail(plain('#2a2c30', rough=0.4))
    for x in (-0.28, -0.14):
        cylinder(f'Mug{x}', x, -1.1, 1.05, 1.2, 0.038, plain('#e0a22a', rough=0.1, transmission=0.5), verts=14)
        cylinder(f'Foam{x}', x, -1.1, 1.2, 1.23, 0.04, plain('#fff4dc'), verts=14)


# --------------------------------------------------------------------------
# 8. Garden Bar: a living green wall, vines, flower boxes, light wood.
# --------------------------------------------------------------------------

def build_garden():
    birch = wood('Birch', (0.55, 0.42, 0.28), (0.78, 0.64, 0.46))
    leaf = plain('#3a8a3a', rough=0.8)
    leaf2 = plain('#6ac24a', rough=0.8)
    shell(birch, plain('#f2ead8', rough=0.5), birch, plain('#2a5a2a', rough=0.9), crown_mat=birch)
    rnd = random.Random(3)
    for i in range(40):      # leafy living wall
        sphere(f'Leaf{i}', rnd.uniform(-0.44, 0.44), 1.38, rnd.uniform(1.0, 2.25), rnd.uniform(0.04, 0.07),
               leaf if i % 2 else leaf2, segs=8)
    for i in range(10):      # flowers among them
        sphere(f'Flower{i}', rnd.uniform(-0.42, 0.42), 1.34, rnd.uniform(1.05, 2.2), 0.025,
               plain(('#ff4fa8', '#ffd23f', '#ffffff')[i % 3]), segs=8)
    # A planter box of flowers along the counter front.
    box('Planter', -0.46, 0.46, -1.36, -1.28, 0.7, 0.86, birch, bevel=0.01)
    for i in range(12):
        sphere(f'Bloom{i}', -0.42 + i * 0.076, -1.32, 0.9, 0.035, plain(('#ff4fa8', '#ffd23f', '#a855f7')[i % 3]), segs=8)
        sphere(f'Green{i}', -0.4 + i * 0.076, -1.32, 0.87, 0.04, leaf, segs=8)
    bottle_row('TopBottle', -0.36, 0.36, 1.2, 0.94, 6, bottles_of('#7ac23a', '#f2c83a', '#ff9aa8', '#d8d8d0'), seed=100)
    for i, x in enumerate((-0.28, -0.14)):
        cylinder(f'Mojito{i}', x, -1.1, 1.05, 1.18, 0.03, plain('#c8f0b0', rough=0.05, transmission=0.6), verts=14)
        sphere(f'Mint{i}', x, -1.1, 1.19, 0.02, leaf2, segs=8)
    for x in (-0.47, 0.47):  # vines climbing the posts
        for k in range(8):
            sphere(f'Vine{x}_{k}', x + 0.03 * math.sin(k), 1.08, 1.0 + k * 0.17, 0.035, leaf2, segs=8)


# --------------------------------------------------------------------------
# 9. Cyber Bar: dark blue, a glowing grid, a hologram screen, magenta edges.
# --------------------------------------------------------------------------

def build_cyber():
    navy = principled('CyberNavy', srgb('#0b1430'), rough=0.2)
    cyan = glowing('#23e4ff', 6)
    magenta = glowing('#ff2ad4', 6)
    shell(navy, navy, navy, navy, crown_mat=navy)
    for i in range(7):       # glowing grid on the counter front
        x = -0.42 + i * 0.14
        box(f'GridV{i}', x - 0.004, x + 0.004, -1.292, -1.28, 0.1, 0.94, cyan, bevel=0)
    for j in range(5):
        z = 0.14 + j * 0.2
        box(f'GridH{j}', -0.44, 0.44, -1.292, -1.28, z - 0.004, z + 0.004, cyan, bevel=0)
    box('TopGlow', -0.49, 0.49, -1.385, -1.37, 1.0, 1.03, magenta, bevel=0)
    box('BackTopGlow', -0.48, 0.48, 0.81, 0.825, 0.895, 0.925, magenta, bevel=0)
    # A hologram screen on the back wall: a frame and glowing bars.
    box('Screen', -0.4, 0.4, 1.38, 1.4, 1.3, 2.1, principled('Screen', srgb('#06223a'), rough=0.1,
                                                             emission=srgb('#1a6aa0'), emission_strength=0.8), bevel=0)
    for k, h in enumerate((0.3, 0.5, 0.25, 0.6, 0.4)):
        x = -0.28 + k * 0.14
        box(f'ScreenBar{k}', x - 0.04, x + 0.04, 1.375, 1.38, 1.38, 1.38 + h, (cyan, magenta)[k % 2], bevel=0)
    for x in (-0.47, 0.47):
        box(f'PostGlow{x}', x - 0.006, x + 0.006, 1.085, 1.095, 0.98, 2.28, cyan, bevel=0)
    bottle_row('TopBottle', -0.36, 0.36, 1.2, 0.94, 6, bottles_of('#23e4ff', '#ff2ad4', '#7a5aff', '#39ff88', glow=2.4), seed=110)
    for i, (x, c) in enumerate(((-0.3, '#23e4ff'), (-0.16, '#ff2ad4'))):
        cocktail(f'Cyber{i}', x, -1.12, 1.05, principled('CyberGlass', (0.8, 0.9, 1.0), rough=0.02, transmission=1.0), c)
    foot_rail(plain('#2a3a6a', rough=0.3))


# --------------------------------------------------------------------------
# 10. Candy Bar: pastel pink and mint, sprinkles, giant lollipops.
# --------------------------------------------------------------------------

def build_candy():
    pink = plain('#ff9ad0', rough=0.4)
    mint = plain('#9ff0d8', rough=0.4)
    cream = plain('#fff2f8', rough=0.4)
    shell(pink, cream, mint, plain('#ffd6ea', rough=0.6), crown_mat=cream)
    rnd = random.Random(5)
    for i in range(40):      # sprinkles on the counter front
        x, z = rnd.uniform(-0.42, 0.42), rnd.uniform(0.12, 0.92)
        box(f'Sprinkle{i}', x - 0.02, x + 0.02, -1.29, -1.28, z - 0.006, z + 0.006,
            plain(('#ffffff', '#ffd23f', '#23c4ff', '#a855f7', '#ff3b5a')[i % 5]), bevel=0)
    # A drippy icing edge under the top.
    for i in range(10):
        x = -0.44 + i * 0.098
        cone(f'Drip{i}', x, -1.3, 0.86 + 0.04 * (i % 3), 0.98, 0.0, 0.035, cream)
    for x, c in ((-0.42, '#ff4fa8'), (0.42, '#23c4ff')):   # giant lollipops either side
        cylinder(f'Stick{x}', x, 1.0, 0.94, 2.0, 0.012, cream, verts=8)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.16, depth=0.04, location=(x, 1.0, 2.12),
                                            rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, plain(c, rough=0.3), 0)
    shelves(cream, bottles_of('#ff9ad0', '#9ff0d8', '#ffd23f', '#c8a0ff'), seed=120)
    for i, x in enumerate((-0.28, -0.12)):
        cylinder(f'Cupcake{i}', x, -1.1, 1.05, 1.11, 0.04, plain('#c08050'), verts=14)
        sphere(f'Frosting{i}', x, -1.1, 1.14, 0.045, plain(('#ff9ad0', '#9ff0d8')[i]), segs=10)
    foot_rail(plain('#ff4fa8', rough=0.3))


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
