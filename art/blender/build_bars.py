"""Builds Club Nova's bar line-up in Blender and renders their game sprites.

Run from the repo root with a Python that has the `bpy` module and pillow:
    python art/blender/build_bars.py              # all tiers
    python art/blender/build_bars.py starter ice  # only some tiers

The bars are a progression from a beginner's first counter to a luxury
showpiece. Every tier has the same 1 x 3 tile footprint and the same three
parts as the original Pub Bar (build_bar.py): back bar, bartender aisle,
customer counter (customers on the -Y side). What changes is detail:

    starter  plain plywood, laminate top, one shelf, no lighting
    wood     stained panels, brass rail, taps, open shelving, warm and plain
    (pub)    the original bar: slatted wood, stone top, lit bottle wall
    neon     glossy black, glowing panels, neon strips and sign, LED shelves
    ice      glowing ice blocks, frosted glass, silver, champagne on ice

Each tier writes bar_<tier>_{0,90,180,270}.png and bar_<tier>.json (size
and anchor) to game/src/assets/sprites/, and bar_<tier>.blend here.
"""

import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_bar as bb  # noqa: E402  (shapes, materials and bottles)

box, cylinder, rod_x, cone, bottle = bb.box, bb.cylinder, bb.rod_x, bb.cone, bb.bottle
principled, wood, neon = bb.principled, bb.wood, bb.neon


def srgb(hex_color):
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def plain(hex_color, rough=0.6, **kw):
    return principled(f'P{hex_color}', srgb(hex_color), rough=rough, **kw)


def bottle_row(prefix, x0, x1, y, z, count, mats, heights=(0.24, 0.32), seed=0):
    import random
    rnd = random.Random(seed)
    for i in range(count):
        x = x0 + (x1 - x0) * (i + 0.5) / count + rnd.uniform(-0.01, 0.01)
        bottle(f'{prefix}{i}', x, y, z, rnd.uniform(*heights), mats[i % len(mats)])


# --------------------------------------------------------------------------
# Tier 1: Starter Bar. A beginner's first counter: plywood, laminate, a
# single shelf. No lights, no shine.
# --------------------------------------------------------------------------

def build_starter():
    ply = plain('#c9a676', rough=0.85)
    ply_edge = plain('#a8855a', rough=0.85)
    laminate = plain('#e9e5dc', rough=0.5)
    board = plain('#8796a8', rough=0.9)
    dark = plain('#3a3a40', rough=0.8)
    white = plain('#f2f2f2', rough=0.4)
    glass = principled('PlainGlass', (0.9, 0.95, 1.0), rough=0.05, transmission=1.0)
    bottles = [plain(c, rough=0.2, transmission=0.6) for c in ('#5a7a3a', '#8a5a2a', '#d8d8d0', '#3a4a6a')]

    # Customer counter: a plywood box with a laminate top and a few stickers.
    box('CounterBody', -0.46, 0.46, -1.28, -0.82, 0, 0.98, ply, bevel=0.004)
    box('CounterEdge', -0.47, 0.47, -1.3, -0.8, 0, 0.05, ply_edge, bevel=0.003)
    box('CounterTop', -0.48, 0.48, -1.34, -0.78, 0.98, 1.02, laminate, bevel=0.006)
    for (x, z, c) in ((-0.22, 0.62, '#e2533d'), (0.1, 0.42, '#3d8ae2'), (0.28, 0.7, '#f2c83a')):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.06, depth=0.006, location=(x, -1.283, z),
                                            rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, plain(c, rough=0.5), 0)
    # A couple of glasses and a napkin holder.
    for x in (-0.25, -0.12):
        cylinder(f'Glass{x}', x, -1.06, 1.02, 1.11, 0.03, glass, verts=14)
    box('Napkins', 0.2, 0.3, -1.12, -1.02, 1.02, 1.1, white, bevel=0.005)

    # Aisle: a plastic crate of empties.
    box('Crate', -0.2, 0.18, -0.25, 0.1, 0, 0.2, plain('#d0482f', rough=0.7), bevel=0.01)
    for i in range(3):
        cylinder(f'CrateBottle{i}', -0.12 + i * 0.12, -0.08, 0.16, 0.34, 0.03, bottles[i % 4], verts=12)

    # Back bar: a low cabinet with a mini fridge, a board wall and one shelf.
    box('BackCabinet', -0.46, 0.46, 0.92, 1.36, 0, 0.86, ply, bevel=0.004)
    box('BackTop', -0.48, 0.48, 0.88, 1.4, 0.86, 0.9, laminate, bevel=0.005)
    box('Fridge', 0.04, 0.42, 0.9, 1.0, 0.08, 0.78, white, bevel=0.01)
    box('FridgeHandle', 0.07, 0.09, 0.885, 0.9, 0.5, 0.7, dark, bevel=0.003)
    box('WallBoard', -0.48, 0.48, 1.38, 1.44, 0.9, 1.75, board, bevel=0.004)
    box('Shelf', -0.4, 0.4, 1.22, 1.38, 1.3, 1.33, ply, bevel=0.004)
    for x in (-0.3, 0.3):
        box(f'Bracket{x}', x - 0.015, x + 0.015, 1.3, 1.38, 1.22, 1.3, dark, bevel=0.002)
    bottle_row('ShelfBottle', -0.34, 0.34, 1.3, 1.33, 5, bottles, seed=1)
    bottle_row('TopBottle', -0.42, -0.02, 1.25, 0.9, 3, bottles, seed=2)


# --------------------------------------------------------------------------
# Tier 2: Wood Bar. Warm stained wood with raised panels, a brass rail,
# taps and open shelving. Still no lights.
# --------------------------------------------------------------------------

def build_wood():
    oak = wood('Oak', (0.2, 0.09, 0.035), (0.36, 0.17, 0.07))
    oak_dark = wood('OakDark', (0.1, 0.045, 0.02), (0.2, 0.09, 0.04))
    top = principled('DarkWoodTop', srgb('#3a1f12'), rough=0.3)
    brass = principled('Brass2', (0.85, 0.58, 0.25), rough=0.3, metal=1.0)
    chrome = principled('Chrome2', (0.85, 0.85, 0.9), rough=0.15, metal=1.0)
    glass = principled('PlainGlass2', (0.9, 0.95, 1.0), rough=0.05, transmission=1.0)
    bottles = [plain(c, rough=0.15, transmission=0.7) for c in
               ('#5a7a3a', '#9a5a1a', '#d8d8d0', '#6a2a2a', '#c09030', '#3a4a6a')]

    # Customer counter with three raised panels and a rounded top.
    box('CounterBody', -0.46, 0.46, -1.28, -0.82, 0.05, 0.98, oak_dark, bevel=0.006)
    box('CounterKick', -0.45, 0.45, -1.25, -0.82, 0, 0.06, plain('#1e140e'), bevel=0.003)
    for i in range(3):
        x0 = -0.42 + i * 0.285
        box(f'Panel{i}', x0, x0 + 0.26, -1.3, -1.28, 0.16, 0.86, oak, bevel=0.012)
    box('CounterTop', -0.49, 0.49, -1.36, -0.76, 0.98, 1.05, top, bevel=0.02)
    rod_x('FootRail', -0.44, 0.44, -1.4, 0.18, 0.017, brass)
    for x in (-0.36, 0.36):
        box(f'RailPost{x}', x - 0.012, x + 0.012, -1.42, -1.28, 0.165, 0.195, brass, bevel=0.003)
    # Two beer taps and a couple of pints.
    for i, x in enumerate((0.12, 0.26)):
        cylinder(f'Tap{i}', x, -1.0, 1.05, 1.3, 0.022, chrome)
        cylinder(f'TapHandle{i}', x, -0.96, 1.3, 1.42, 0.014, plain(('#2a2a2a', '#7a2a1a')[i]), verts=12)
    for x in (-0.3, -0.16):
        cylinder(f'Pint{x}', x, -1.1, 1.05, 1.16, 0.032, plain('#d99a2a', rough=0.1, transmission=0.6), verts=16)

    # Aisle: plain wooden boards.
    box('AisleBoards', -0.44, 0.44, -0.7, 0.78, 0, 0.012, oak_dark, bevel=0.003)

    # Back bar: cabinet with doors, open shelving unit with bottles.
    box('BackCabinet', -0.46, 0.46, 0.88, 1.36, 0.05, 0.88, oak_dark, bevel=0.006)
    box('BackKick', -0.45, 0.45, 0.9, 1.36, 0, 0.06, plain('#1e140e'), bevel=0.003)
    for i, x0 in enumerate((-0.42, 0.02)):
        box(f'Door{i}', x0, x0 + 0.4, 0.86, 0.88, 0.12, 0.8, oak, bevel=0.012)
        box(f'Knob{i}', x0 + (0.36 if i == 0 else 0.03), x0 + (0.38 if i == 0 else 0.05), 0.845, 0.86, 0.45, 0.5, brass, bevel=0.004)
    box('BackTop', -0.48, 0.48, 0.84, 1.4, 0.88, 0.94, top, bevel=0.012)
    box('ShelfBack', -0.46, 0.46, 1.38, 1.44, 0.94, 1.95, oak_dark, bevel=0.005)
    for x in (-0.44, 0.44):
        box(f'ShelfSide{x}', x - 0.02, x + 0.02, 1.12, 1.44, 0.94, 1.95, oak, bevel=0.005)
    box('ShelfCrown', -0.48, 0.48, 1.1, 1.46, 1.95, 2.0, oak, bevel=0.008)
    for j, z in enumerate((1.3, 1.62)):
        box(f'Shelf{j}', -0.42, 0.42, 1.14, 1.4, z, z + 0.025, oak, bevel=0.004)
        bottle_row(f'Bottle{j}_', -0.38, 0.38, 1.27, z + 0.025, 6, bottles, seed=10 + j)
    bottle_row('TopBottle', -0.38, 0.38, 1.27, 0.94, 6, bottles, seed=12)
    for i in range(4):
        cylinder(f'Glass{i}', -0.3 + i * 0.13, 0.98, 0.94, 1.03, 0.028, glass, verts=14)


# --------------------------------------------------------------------------
# Tier 4: Neon Bar. Glossy black, glowing panels, pink and cyan neon, LED
# shelves and a neon cocktail sign.
# --------------------------------------------------------------------------

def neon_tube(name, pts, radius, mat):
    """A neon tube through a list of points (straight segments, round joints)."""
    from mathutils import Vector
    pts = [Vector(p) for p in pts]
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=(b - a).length, location=(a + b) / 2)
        o = bpy.context.active_object
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
        bb._finish(o, mat, 0)
    for p in pts:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=radius, location=p)
        bb._finish(bpy.context.active_object, mat, 0)


def build_neon():
    gloss = principled('GlossBlack', srgb('#0d0b12'), rough=0.12)
    chrome = principled('Chrome4', (0.88, 0.88, 0.95), rough=0.1, metal=1.0)
    panel = neon('PanelGlow', srgb('#8a3cff'), 1.8)
    panel_dim = principled('PanelFrost', srgb('#4a1aa0'), rough=0.3, emission=srgb('#9a4cff'), emission_strength=0.9)
    pink = neon('NeonPink4', (1.0, 0.08, 0.55), 12)
    cyan = neon('NeonCyan4', (0.1, 0.8, 1.0), 10)
    glow_bottles = [principled(f'GlowBottle{i}', srgb(c), rough=0.08, transmission=0.6, emission=srgb(c), emission_strength=2.2)
                    for i, c in enumerate(('#ff3fa4', '#23c4ff', '#ffd23f', '#a855f7', '#39ff88', '#ff7a2e'))]
    glow_glass = principled('GlowGlass', (0.8, 0.9, 1.0), rough=0.02, transmission=1.0, emission=(0.4, 0.8, 1.0), emission_strength=0.6)

    # Customer counter: black body with three glowing frosted panels.
    box('CounterBody', -0.46, 0.46, -1.28, -0.82, 0.06, 0.98, gloss, bevel=0.01)
    box('CounterKick', -0.45, 0.45, -1.24, -0.82, 0, 0.07, gloss, bevel=0.004)
    for i in range(3):
        x0 = -0.42 + i * 0.285
        box(f'GlowPanel{i}', x0, x0 + 0.26, -1.295, -1.28, 0.14, 0.88, panel_dim, bevel=0.01)
        box(f'GlowCore{i}', x0 + 0.05, x0 + 0.21, -1.3, -1.294, 0.25, 0.77, panel, bevel=0.0)
    box('CounterTop', -0.49, 0.49, -1.38, -0.76, 0.98, 1.05, gloss, bevel=0.015)
    box('TopEdge', -0.49, 0.49, -1.39, -1.37, 0.995, 1.035, chrome, bevel=0)
    box('UnderNeon', -0.47, 0.47, -1.385, -1.35, 0.955, 0.98, pink, bevel=0)
    box('SideNeon', 0.465, 0.475, -1.3, -0.82, 0.1, 0.95, pink, bevel=0)
    box('FloorNeon', -0.46, 0.46, -1.29, -1.265, 0.02, 0.045, cyan, bevel=0)
    rod_x('FootRail', -0.44, 0.44, -1.42, 0.18, 0.017, chrome)
    # Chrome taps and glowing cocktails.
    cylinder('TapTower', 0.22, -1.02, 1.05, 1.34, 0.032, chrome)
    for i, dx in enumerate((-0.08, 0.0, 0.08)):
        cylinder(f'TapHandle{i}', 0.22 + dx, -0.97, 1.36, 1.48, 0.012, (pink, cyan, panel)[i], verts=12)
    rod_x('TapBar', 0.12, 0.32, -1.02, 1.35, 0.024, chrome)
    for i, (x, c) in enumerate(((-0.3, '#ff3fa4'), (-0.16, '#23c4ff'))):
        z = 1.05
        cylinder(f'CocktailStem{i}', x, -1.18, z, z + 0.07, 0.004, glow_glass, verts=8)
        cone(f'CocktailBowl{i}', x, -1.18, z + 0.07, z + 0.13, 0.004, 0.055, glow_glass)
        cone(f'CocktailDrink{i}', x, -1.18, z + 0.075, z + 0.118, 0.003, 0.046, neon(f'Drink{i}', srgb(c), 4))

    # Aisle: black rubber with a cyan edge glow.
    box('AisleMat', -0.44, 0.44, -0.7, 0.78, 0, 0.012, gloss, bevel=0.003)
    box('AisleGlow', -0.44, 0.44, -0.7, -0.69, 0.012, 0.018, cyan, bevel=0)

    # Back bar: black cabinet, glowing shelf wall, neon cocktail sign.
    box('BackCabinet', -0.46, 0.46, 0.86, 1.36, 0.06, 0.88, gloss, bevel=0.01)
    box('BackKick', -0.45, 0.45, 0.88, 1.36, 0, 0.07, gloss, bevel=0.004)
    box('BackGlow', -0.42, 0.42, 0.845, 0.86, 0.2, 0.76, panel_dim, bevel=0.01)
    box('BackTop', -0.48, 0.48, 0.82, 1.42, 0.88, 0.94, gloss, bevel=0.012)
    box('BackTopNeon', -0.46, 0.46, 0.81, 0.825, 0.895, 0.925, cyan, bevel=0)
    for row, y in enumerate((0.92, 1.0)):
        for i in range(6):
            cylinder(f'Glass{row}_{i}', -0.38 + i * 0.152 + row * 0.04, y, 0.94, 1.02, 0.028, glow_glass, verts=14)
    box('Wall', -0.49, 0.49, 1.4, 1.48, 0.94, 2.3, gloss, bevel=0.008)
    box('WallLight', -0.44, 0.44, 1.392, 1.402, 0.98, 2.14, neon('WallLED', srgb('#7a2cff'), 1.6), bevel=0)
    for x in (-0.47, 0.47):
        box(f'Post{x}', x - 0.025, x + 0.025, 1.1, 1.48, 0.94, 2.3, gloss, bevel=0.006)
    box('Crown', -0.5, 0.5, 1.06, 1.49, 2.3, 2.38, gloss, bevel=0.01)
    box('CrownNeon', -0.47, 0.47, 1.05, 1.062, 2.32, 2.36, pink, bevel=0)
    for j, z in enumerate((1.36, 1.76)):
        box(f'Shelf{j}', -0.44, 0.44, 1.12, 1.39, z - 0.015, z, principled(f'Acrylic{j}', (0.7, 0.8, 1.0), rough=0.05, transmission=1.0), bevel=0.002)
        box(f'ShelfLED{j}', -0.44, 0.44, 1.115, 1.125, z - 0.03, z - 0.018, (cyan, pink)[j], bevel=0)
        bottle_row(f'Bottle{j}_', -0.36, 0.36, 1.27, z, 6, glow_bottles, seed=20 + j)
    bottle_row('TopBottle', -0.36, 0.36, 1.27, 0.94, 6, glow_bottles, seed=22)
    # Neon cocktail glass sign on the crown.
    y, cz = 1.03, 2.62
    sign = [(-0.13, y, cz + 0.12), (0.13, y, cz + 0.12), (0.0, y, cz - 0.02), (-0.13, y, cz + 0.12)]
    neon_tube('SignBowl', sign, 0.012, pink)
    neon_tube('SignStem', [(0.0, y, cz - 0.02), (0.0, y, cz - 0.14), (-0.07, y, cz - 0.14), (0.07, y, cz - 0.14)], 0.012, cyan)
    neon_tube('SignStraw', [(0.03, y, cz + 0.08), (0.12, y, cz + 0.22)], 0.01, cyan)


# --------------------------------------------------------------------------
# Tier 5: Ice Bar. Glowing ice blocks, frosted glass, silver and crystal,
# champagne on ice.
# --------------------------------------------------------------------------

def build_ice():
    ice = principled('Ice', (0.45, 0.75, 1.0), rough=0.2, transmission=0.55, ior=1.31,
                     emission=(0.18, 0.55, 1.0), emission_strength=0.7)
    ice_core = neon('IceCore', (0.2, 0.6, 1.0), 1.2)
    frost = principled('FrostGlass', (0.8, 0.9, 1.0), rough=0.3, transmission=0.5, emission=(0.45, 0.75, 1.0), emission_strength=0.35)
    # Pearl rather than true metal: shiny metal only mirrors the dark
    # surroundings and renders near-black at sprite size.
    silver = principled('Pearl', (0.86, 0.9, 0.97), rough=0.25)
    white = principled('SnowWhite', srgb('#eef3fa'), rough=0.4)
    crystal = principled('Crystal', (0.95, 0.97, 1.0), rough=0.0, transmission=1.0, ior=1.6,
                         emission=(0.7, 0.85, 1.0), emission_strength=0.8)
    gold = principled('GoldFoil', (1.0, 0.78, 0.35), rough=0.25, metal=1.0)
    champagne = principled('Champagne', srgb('#1f3a26'), rough=0.08, transmission=0.4)
    blue_neon = neon('IceNeon', (0.25, 0.7, 1.0), 10)

    def ice_blocks(prefix, x0, x1, y0, y1, z0, z1, cols, rows):
        w = (x1 - x0) / cols
        h = (z1 - z0) / rows
        for r in range(rows):
            off = (w / 2) if r % 2 else 0
            for c in range(cols + (1 if r % 2 else 0)):
                a = max(x0, x0 + c * w - off)
                b = min(x1, x0 + (c + 1) * w - off)
                if b - a < 0.02:
                    continue
                box(f'{prefix}{r}_{c}', a + 0.004, b - 0.004, y0, y1, z0 + r * h + 0.004, z0 + (r + 1) * h - 0.004, ice, bevel=0.018)

    # Customer counter: stacked glowing ice blocks on a white plinth, a
    # frosted glass top with a silver edge.
    box('Plinth', -0.47, 0.47, -1.3, -0.8, 0, 0.08, white, bevel=0.01)
    box('IceGlowCore', -0.4, 0.4, -1.2, -0.9, 0.12, 0.9, ice_core, bevel=0)
    ice_blocks('CounterIce', -0.46, 0.46, -1.29, -0.81, 0.08, 0.98, 3, 4)
    box('CounterTop', -0.49, 0.49, -1.38, -0.76, 0.98, 1.05, frost, bevel=0.012)
    box('TopEdge', -0.49, 0.49, -1.39, -1.37, 0.99, 1.04, silver, bevel=0)
    box('FloorGlow', -0.46, 0.46, -1.31, -1.295, 0.02, 0.035, blue_neon, bevel=0)
    rod_x('FootRail', -0.44, 0.44, -1.42, 0.18, 0.017, silver)
    # Champagne in a silver ice bucket, and two flutes.
    cylinder('Bucket', 0.2, -1.05, 1.05, 1.2, 0.07, silver, verts=24)
    cylinder('BucketIce', 0.2, -1.05, 1.17, 1.21, 0.064, frost, verts=24)
    cylinder('Champagne', 0.21, -1.05, 1.12, 1.36, 0.032, champagne)
    cone('ChampagneNeck', 0.21, -1.05, 1.36, 1.44, 0.032, 0.012, champagne)
    cylinder('ChampagneFoil', 0.21, -1.05, 1.42, 1.47, 0.014, gold, verts=12)
    for x in (-0.28, -0.17):
        cylinder(f'FluteStem{x}', x, -1.18, 1.05, 1.12, 0.004, crystal, verts=8)
        cone(f'Flute{x}', x, -1.18, 1.12, 1.24, 0.012, 0.025, crystal)
        cone(f'Fizz{x}', x, -1.18, 1.125, 1.22, 0.01, 0.02, neon(f'Fizz{x}', srgb('#ffe9a8'), 2.5))

    # Aisle: white floor with a soft blue edge.
    box('AisleFloor', -0.44, 0.44, -0.7, 0.78, 0, 0.012, white, bevel=0.003)
    box('AisleGlow', -0.44, 0.44, -0.7, -0.69, 0.012, 0.018, blue_neon, bevel=0)

    # Back bar: ice cabinet, tall backlit ice wall with crystal shelves.
    box('BackPlinth', -0.47, 0.47, 0.84, 1.38, 0, 0.08, white, bevel=0.01)
    box('BackGlowCore', -0.4, 0.4, 0.94, 1.28, 0.12, 0.8, ice_core, bevel=0)
    ice_blocks('BackIce', -0.46, 0.46, 0.86, 1.36, 0.08, 0.88, 3, 3)
    box('BackTop', -0.48, 0.48, 0.82, 1.42, 0.88, 0.94, frost, bevel=0.01)
    box('BackTopEdge', -0.48, 0.48, 0.81, 0.83, 0.89, 0.93, silver, bevel=0)
    for row, y in enumerate((0.92, 1.0)):
        for i in range(6):
            x = -0.38 + i * 0.152 + row * 0.04
            cylinder(f'FluteStemB{row}_{i}', x, y, 0.94, 0.99, 0.004, crystal, verts=8)
            cone(f'FluteB{row}_{i}', x, y, 0.99, 1.1, 0.01, 0.022, crystal)
    box('WallLight', -0.44, 0.44, 1.41, 1.43, 0.98, 2.3, neon('IceWallLight', (0.3, 0.65, 1.0), 1.3), bevel=0)
    ice_blocks('WallIce', -0.48, 0.48, 1.36, 1.41, 0.94, 2.34, 3, 5)
    for x in (-0.48, 0.48):
        box(f'Pillar{x}', x - 0.03, x + 0.03, 1.1, 1.48, 0.94, 2.38, silver, bevel=0.008)
    box('Crown', -0.51, 0.51, 1.06, 1.49, 2.38, 2.45, silver, bevel=0.012)
    box('CrownGlow', -0.48, 0.48, 1.05, 1.062, 2.39, 2.43, blue_neon, bevel=0)
    for j, z in enumerate((1.36, 1.78)):
        box(f'CrystalShelf{j}', -0.44, 0.44, 1.12, 1.35, z - 0.015, z, crystal, bevel=0.002)
        box(f'ShelfEdge{j}', -0.44, 0.44, 1.115, 1.125, z - 0.03, z - 0.018, silver, bevel=0)
        for i in range(5):
            x = -0.32 + i * 0.16
            cylinder(f'Champ{j}_{i}', x, 1.25, z, z + 0.2, 0.03, champagne)
            cone(f'ChampNeck{j}_{i}', x, 1.25, z + 0.2, z + 0.27, 0.03, 0.011, champagne)
            cylinder(f'ChampFoil{j}_{i}', x, 1.25, z + 0.25, z + 0.29, 0.013, gold, verts=12)
    # A small crystal chandelier hanging in front of the crown.
    cylinder('ChandelierRod', 0, 1.0, 2.2, 2.45, 0.006, silver, verts=8)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.01, location=(0, 1.0, 2.2))
    bb._finish(bpy.context.active_object, silver, 0)
    for k in range(8):
        a = k / 8 * math.tau
        x, y = math.cos(a) * 0.12, 1.0 + math.sin(a) * 0.12
        cone(f'Drop{k}', x, y, 2.08, 2.18, 0.0, 0.02, crystal)


TIERS = {
    'starter': build_starter,
    'wood': build_wood,
    'neon': build_neon,
    'ice': build_ice,
}


def build_tier(name):
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    bb.M.clear()
    bb.build_materials()  # bottles, glass etc. shared with the Pub Bar
    root = bpy.data.objects.new(f'Bar_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    TIERS[name]()
    iso_rig.make_bar_piece(root)  # one module, fitted to 1 x 3 tiles
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'bar_{name}.blend'))
    meta = iso_rig.render_facings(scene, cam, root, f'bar_{name}', bb.SPRITE_DIR, layers=iso_rig.split_counter(root))
    print(f'bar_{name}:', meta, flush=True)


def main():
    names = sys.argv[1:] or list(TIERS)
    for name in names:
        build_tier(name)


if __name__ == '__main__':
    main()
