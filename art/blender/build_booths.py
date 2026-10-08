"""Builds Club Nova's DJ booth line-up in Blender and renders their sprites.

Run from the repo root with a Python that has the `bpy` module and pillow:
    python art/blender/build_booths.py               # all tiers
    python art/blender/build_booths.py starter ice   # only some tiers
    python art/blender/build_booths.py --preview DIR truss   # facing 0 only, for a look

Five tiers that pair with the five bars (build_bars.py), from a wooden
desk with turntables to a glowing ice booth. Booths are only the DJ's desk
and gear; speakers are a separate decoration.

Every booth has the same 2 x 1 tile footprint. Models are built x in
[-1, 1], y in [-0.5, 0.5], then scaled by BOOTH_SCALE (0.75) so that,
after iso_rig.MODEL_SCALE, the desk is exactly 2 game tiles long and a
quarter lower: the size of Nightclub City's compact DJ desks. The crowd side faces -Y (game +gy at facing 0); the DJ
stands just behind it on the +Y side, outside the footprint, and is drawn
behind the booth so the desk hides their legs.

Each tier writes dj_<tier>_{0,90,180,270}.png and dj_<tier>.json to
game/src/assets/sprites/, and dj_<tier>.blend here.
"""

import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_bar as bb  # noqa: E402
from build_bars import plain, srgb  # noqa: E402

box, cylinder, rod_x, cone = bb.box, bb.cylinder, bb.rod_x, bb.cone
principled, wood, neon = bb.principled, bb.wood, bb.neon

DESK_H = 1.0   # desk height before BOOTH_SCALE
BOOTH_SCALE = 0.75  # 2 units x 0.75 x 4/3 = exactly 2 game tiles


def platter(name, x, y, z, radius, base, disc, label, ring=None):
    """A turntable / jog wheel: base plate, platter, label, optional glow ring."""
    box(f'{name}Base', x - radius - 0.04, x + radius + 0.04, y - radius - 0.04, y + radius + 0.04,
        z, z + 0.05, base, bevel=0.01)
    cylinder(f'{name}Disc', x, y, z + 0.05, z + 0.068, radius, disc, verts=32)
    cylinder(f'{name}Label', x, y, z + 0.068, z + 0.072, radius * 0.32, label, verts=20)
    if ring:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius + 0.012, minor_radius=0.008, location=(x, y, z + 0.06))
        bb._finish(bpy.context.active_object, ring, 0)


def mixer(name, x, y, z, w, d, body, knob, lights=None):
    box(f'{name}Body', x - w / 2, x + w / 2, y - d / 2, y + d / 2, z, z + 0.06, body, bevel=0.01)
    for i in range(3):
        for j in range(3):
            cylinder(f'{name}Knob{i}{j}', x - w / 4 + i * w / 4, y - d / 4 + j * d / 4, z + 0.06, z + 0.085, 0.012, knob, verts=10)
    if lights:
        for i, m in enumerate(lights):
            box(f'{name}Led{i}', x - w / 2 + 0.02, x + w / 2 - 0.02, y + d / 2 - 0.02 - i * 0.012, y + d / 2 - 0.012 - i * 0.012,
                z + 0.06, z + 0.064, m, bevel=0)


# --------------------------------------------------------------------------
# Tier 1: a wooden DJ desk with two turntables and a mixer.
# --------------------------------------------------------------------------

def build_wood():
    oak = wood('BoothOak', (0.2, 0.09, 0.035), (0.36, 0.17, 0.07))
    oak_dark = wood('BoothOakDark', (0.1, 0.045, 0.02), (0.2, 0.09, 0.04))
    top = principled('BoothWoodTop', srgb('#3a1f12'), rough=0.3)
    deck = plain('#2b2b30', rough=0.5)
    vinyl = plain('#111114', rough=0.2)
    label = plain('#d8b04a', rough=0.5)
    knob = plain('#cfcfd4', rough=0.3)
    box('Body', -0.94, 0.94, -0.36, 0.3, 0.05, DESK_H - 0.05, oak_dark, bevel=0.008)
    box('Kick', -0.92, 0.92, -0.33, 0.3, 0, 0.06, plain('#1e140e'), bevel=0.003)
    for i in range(4):
        x0 = -0.9 + i * 0.455
        box(f'Panel{i}', x0, x0 + 0.42, -0.38, -0.36, 0.15, DESK_H - 0.15, oak, bevel=0.012)
    box('Top', -0.97, 0.97, -0.42, 0.34, DESK_H - 0.05, DESK_H + 0.01, top, bevel=0.02)
    platter('DeckL', -0.55, -0.04, DESK_H + 0.01, 0.17, deck, vinyl, label)
    platter('DeckR', 0.55, -0.04, DESK_H + 0.01, 0.17, deck, vinyl, label)
    mixer('Mixer', 0, -0.04, DESK_H + 0.01, 0.26, 0.34, deck, knob)
    # Headphones resting on the desk, and a crate of records at the side.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.08, minor_radius=0.012, location=(0.82, 0.18, DESK_H + 0.03))
    bb._finish(bpy.context.active_object, plain('#1a1a1a'), 0)


# --------------------------------------------------------------------------
# Tier 2: Pro Booth. The wooden desk grown up: a dark stone top, CDJ decks
# instead of turntables, and one small warm light strip (the first glow).
# --------------------------------------------------------------------------

def build_pro():
    oak = wood('ProOak', (0.2, 0.09, 0.035), (0.36, 0.17, 0.07))
    oak_dark = wood('ProOakDark', (0.1, 0.045, 0.02), (0.2, 0.09, 0.04))
    stone = principled('ProStone', srgb('#24252c'), rough=0.18)
    cdj = plain('#2c2d33', rough=0.4)
    jog = plain('#55565e', rough=0.3)
    knob = plain('#cfcfd4', rough=0.3)
    screen = principled('ProScreen', srgb('#1a2a40'), rough=0.2, emission=srgb('#3a8aff'), emission_strength=1.0)
    warm = neon('ProWarmStrip', srgb('#ffb45a'), 6)
    box('Kick', -0.92, 0.92, -0.33, 0.3, 0, 0.07, plain('#1e140e'), bevel=0.003)
    box('Body', -0.94, 0.94, -0.36, 0.3, 0.06, DESK_H - 0.05, oak_dark, bevel=0.008)
    for i in range(4):
        x0 = -0.9 + i * 0.455
        box(f'Panel{i}', x0, x0 + 0.42, -0.38, -0.36, 0.15, DESK_H - 0.17, oak, bevel=0.012)
    box('Top', -0.97, 0.97, -0.44, 0.34, DESK_H - 0.05, DESK_H + 0.01, stone, bevel=0.014)
    box('WarmStrip', -0.92, 0.92, -0.43, -0.415, DESK_H - 0.085, DESK_H - 0.07, warm, bevel=0)
    for x in (-0.55, 0.55):
        box(f'Cdj{x}', x - 0.21, x + 0.21, -0.26, 0.2, DESK_H + 0.01, DESK_H + 0.07, cdj, bevel=0.012)
        cylinder(f'Jog{x}', x, -0.06, DESK_H + 0.07, DESK_H + 0.09, 0.14, jog, verts=32)
        box(f'Screen{x}', x - 0.08, x + 0.08, 0.1, 0.17, DESK_H + 0.07, DESK_H + 0.075, screen, bevel=0)
    mixer('Mixer', 0, -0.04, DESK_H + 0.01, 0.26, 0.4, cdj, knob)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.08, minor_radius=0.012, location=(0.84, 0.22, DESK_H + 0.03))
    bb._finish(bpy.context.active_object, plain('#1a1a1a'), 0)


# --------------------------------------------------------------------------
# Tier 3: Club Booth, matching the Pub Bar: slatted wood, stone top, CDJs,
# a pink neon line under the edge.
# --------------------------------------------------------------------------

def build_club():
    bb.build_materials()
    M = bb.M
    cdj = plain('#2c2d33', rough=0.4)
    jog = plain('#55565e', rough=0.3)
    screen = principled('CdjScreen', srgb('#1a2a40'), rough=0.2, emission=srgb('#3a8aff'), emission_strength=1.2)
    knob = plain('#cfcfd4', rough=0.3)
    box('Kick', -0.92, 0.92, -0.33, 0.3, 0, 0.09, M['black'], bevel=0.004)
    box('Body', -0.94, 0.94, -0.36, 0.3, 0.09, DESK_H - 0.05, M['wood_dark'], bevel=0.006)
    bb.slats('Slat', -0.935, 0.935, -0.36, -0.016, 0.1, DESK_H - 0.07, 20, M['wood'])
    box('Top', -0.97, 0.97, -0.46, 0.34, DESK_H - 0.05, DESK_H + 0.01, M['stone'], bevel=0.012)
    box('EdgeNeon', -0.94, 0.94, -0.45, -0.43, DESK_H - 0.08, DESK_H - 0.065, M['neon_pink'], bevel=0)
    for x in (-0.55, 0.55):
        box(f'Cdj{x}', x - 0.21, x + 0.21, -0.26, 0.2, DESK_H + 0.01, DESK_H + 0.07, cdj, bevel=0.012)
        cylinder(f'Jog{x}', x, -0.06, DESK_H + 0.07, DESK_H + 0.09, 0.14, jog, verts=32)
        box(f'Screen{x}', x - 0.08, x + 0.08, 0.1, 0.17, DESK_H + 0.07, DESK_H + 0.075, screen, bevel=0)
    mixer('Mixer', 0, -0.04, DESK_H + 0.01, 0.26, 0.4, cdj, knob,
          lights=[neon('MixLed1', srgb('#39ff88'), 6), neon('MixLed2', srgb('#ffd23f'), 6)])


# --------------------------------------------------------------------------
# Tier 4: Neon Booth, matching the Neon Bar: glossy black, glowing panels,
# a glowing EQ display, CDJs with glowing rings.
# --------------------------------------------------------------------------

def build_neon():
    gloss = principled('BoothGloss', srgb('#0d0b12'), rough=0.12)
    panel_dim = principled('BoothPanel', srgb('#4a1aa0'), rough=0.3, emission=srgb('#9a4cff'), emission_strength=0.9)
    pink = neon('BoothPink', (1.0, 0.08, 0.55), 12)
    cyan = neon('BoothCyan', (0.1, 0.8, 1.0), 10)
    yellow = neon('BoothYellow', srgb('#ffd23f'), 8)
    cdj = plain('#1c1c22', rough=0.3)
    jog = plain('#3a3a44', rough=0.2)
    knob = plain('#cfcfd4', rough=0.3)
    box('Kick', -0.92, 0.92, -0.33, 0.3, 0, 0.07, gloss, bevel=0.004)
    box('Body', -0.94, 0.94, -0.36, 0.3, 0.07, DESK_H - 0.05, gloss, bevel=0.01)
    box('Panel', -0.88, 0.88, -0.375, -0.36, 0.14, DESK_H - 0.12, panel_dim, bevel=0.01)
    # A glowing graphic-equaliser display across the front panel.
    heights = (0.25, 0.42, 0.6, 0.48, 0.7, 0.55, 0.36, 0.62, 0.45, 0.3, 0.52, 0.66, 0.4, 0.28)
    for i, h in enumerate(heights):
        x = -0.8 + i * (1.6 / (len(heights) - 1))
        col = cyan if h < 0.45 else (pink if h > 0.6 else yellow)
        box(f'Eq{i}', x - 0.035, x + 0.035, -0.385, -0.375, 0.2, 0.2 + h * 0.85 * (DESK_H - 0.35) / 0.7, col, bevel=0)
    box('Top', -0.97, 0.97, -0.46, 0.34, DESK_H - 0.05, DESK_H + 0.01, gloss, bevel=0.012)
    box('TopNeon', -0.95, 0.95, -0.47, -0.45, DESK_H - 0.045, DESK_H - 0.01, pink, bevel=0)
    box('FloorNeon', -0.92, 0.92, -0.38, -0.365, 0.02, 0.045, cyan, bevel=0)
    for x in (-0.55, 0.55):
        box(f'Cdj{x}', x - 0.21, x + 0.21, -0.26, 0.2, DESK_H + 0.01, DESK_H + 0.07, cdj, bevel=0.012)
        platter(f'Jog{x}', x, -0.06, DESK_H + 0.07, 0.13, cdj, jog, plain('#111111'), ring=cyan)
    mixer('Mixer', 0, -0.04, DESK_H + 0.01, 0.26, 0.4, cdj, knob, lights=[pink, cyan, yellow])


# --------------------------------------------------------------------------
# Tier 5: Ice Booth, matching the Ice Bar: glowing ice blocks, frosted
# glass top, pearl trim, white decks with blue glowing rings.
# --------------------------------------------------------------------------

def build_ice():
    ice = principled('BoothIce', (0.45, 0.75, 1.0), rough=0.2, transmission=0.55, ior=1.31,
                     emission=(0.18, 0.55, 1.0), emission_strength=0.7)
    ice_core = neon('BoothIceCore', (0.2, 0.6, 1.0), 1.2)
    frost = principled('BoothFrost', (0.8, 0.9, 1.0), rough=0.3, transmission=0.5, emission=(0.45, 0.75, 1.0), emission_strength=0.35)
    pearl = principled('BoothPearl', (0.86, 0.9, 0.97), rough=0.25)
    white = principled('BoothWhite', srgb('#eef3fa'), rough=0.4)
    blue = neon('BoothBlue', (0.25, 0.7, 1.0), 10)
    deck = plain('#e8ecf2', rough=0.35)
    jog = plain('#c9d2de', rough=0.25)
    knob = plain('#8a95a8', rough=0.3)
    box('Plinth', -0.94, 0.94, -0.36, 0.3, 0, 0.08, white, bevel=0.01)
    box('GlowCore', -0.86, 0.86, -0.28, 0.2, 0.12, DESK_H - 0.12, ice_core, bevel=0)
    # Ice blocks, three rows, staggered like brickwork.
    rows, cols = 3, 5
    h = (DESK_H - 0.13) / rows
    w = 1.88 / cols
    for r in range(rows):
        off = w / 2 if r % 2 else 0
        for c in range(cols + (1 if r % 2 else 0)):
            a = max(-0.94, -0.94 + c * w - off)
            b = min(0.94, -0.94 + (c + 1) * w - off)
            if b - a < 0.03:
                continue
            box(f'Ice{r}_{c}', a + 0.004, b - 0.004, -0.37, 0.29, 0.08 + r * h + 0.004, 0.08 + (r + 1) * h - 0.004, ice, bevel=0.018)
    box('Top', -0.97, 0.97, -0.46, 0.34, DESK_H - 0.05, DESK_H + 0.01, frost, bevel=0.012)
    box('TopEdge', -0.97, 0.97, -0.47, -0.45, DESK_H - 0.04, DESK_H, pearl, bevel=0)
    box('FloorGlow', -0.92, 0.92, -0.39, -0.375, 0.02, 0.035, blue, bevel=0)
    for x in (-0.55, 0.55):
        box(f'Cdj{x}', x - 0.21, x + 0.21, -0.26, 0.2, DESK_H + 0.01, DESK_H + 0.07, deck, bevel=0.012)
        platter(f'Jog{x}', x, -0.06, DESK_H + 0.07, 0.13, deck, jog, pearl, ring=blue)
    mixer('Mixer', 0, -0.04, DESK_H + 0.01, 0.26, 0.4, deck, knob, lights=[blue])
    # A champagne flute by the decks.
    crystal = principled('BoothCrystal', (0.95, 0.97, 1.0), rough=0.0, transmission=1.0, ior=1.6,
                         emission=(0.7, 0.85, 1.0), emission_strength=0.8)
    cylinder('FluteStem', 0.86, -0.3, DESK_H + 0.01, DESK_H + 0.08, 0.004, crystal, verts=8)
    cone('Flute', 0.86, -0.3, DESK_H + 0.08, DESK_H + 0.2, 0.012, 0.025, crystal)


# --------------------------------------------------------------------------
# The October 2026 booths, from the owner's main reference screenshots
# (art/references/main/), filling the gaps between the five tiers above.
# --------------------------------------------------------------------------

def decks(cdj, jog, knob, ring=None, lights=None, label=None):
    """Two CDJs and a mixer on the desk top, as the other booths have."""
    for x in (-0.55, 0.55):
        box(f'Cdj{x}', x - 0.21, x + 0.21, -0.26, 0.2, DESK_H + 0.01, DESK_H + 0.07, cdj, bevel=0.012)
        platter(f'Jog{x}', x, -0.06, DESK_H + 0.07, 0.13, cdj, jog, label or plain('#111111'), ring=ring)
    mixer('Mixer', 0, -0.04, DESK_H + 0.01, 0.26, 0.4, cdj, knob, lights=lights)


def build_crate():
    """Level 3: a plank on stacked beer crates, a turntable and a laptop:
    the starter DJ making do."""
    crate = wood('CrateWood', (0.32, 0.17, 0.07), (0.5, 0.3, 0.13))
    crate_dark = plain('#3a2414', rough=0.8)
    plank = wood('Plank', (0.42, 0.26, 0.12), (0.6, 0.4, 0.2))
    bottle = principled('CrateBottle', srgb('#2e6a2a'), rough=0.2)
    # Stacked crates, open-sided: corner posts, slats with gaps, bottles
    # showing through.
    for i, x in enumerate((-0.66, 0.0, 0.66)):
        for j in range(2):
            z0 = j * (DESK_H - 0.06) / 2
            z1 = z0 + (DESK_H - 0.06) / 2 - 0.01
            box(f'CrateFloor{i}{j}', x - 0.3, x + 0.3, -0.34, 0.28, z0, z0 + 0.04, crate_dark, bevel=0)
            for cxp in (x - 0.29, x + 0.29):
                for cyp in (-0.33, 0.27):
                    box(f'Post{i}{j}{cxp}{cyp}', cxp - 0.025, cxp + 0.025, cyp - 0.025, cyp + 0.025, z0, z1, crate, bevel=0.004)
            for k in range(3):
                zz = z0 + 0.06 + k * (z1 - z0 - 0.08) / 2.2
                box(f'SlatF{i}{j}{k}', x - 0.3, x + 0.3, -0.35, -0.33, zz, zz + 0.06, crate, bevel=0.004)
                box(f'SlatS{i}{j}{k}', x + 0.28, x + 0.3, -0.34, 0.28, zz, zz + 0.06, crate, bevel=0.004)
            for k in range(3):
                for m in range(2):
                    cylinder(f'Bottle{i}{j}{k}{m}', x - 0.16 + k * 0.16, -0.18 + m * 0.24, z0 + 0.04, z1 - 0.04, 0.045, bottle, verts=10)
    box('Plank', -0.98, 0.98, -0.4, 0.32, DESK_H - 0.06, DESK_H + 0.01, plank, bevel=0.01)
    platter('Deck', -0.5, -0.04, DESK_H + 0.01, 0.17, plain('#2b2b30', rough=0.5), plain('#111114', rough=0.2), plain('#d84a4a'))
    # A laptop, open, screen lit.
    box('LaptopBase', 0.25, 0.65, -0.2, 0.1, DESK_H + 0.01, DESK_H + 0.03, plain('#9a9ca4', rough=0.3), bevel=0.005)
    lid = box('LaptopLid', 0.25, 0.65, 0.09, 0.11, DESK_H + 0.03, DESK_H + 0.29, plain('#9a9ca4', rough=0.3), bevel=0.005)
    box('LaptopScreen', 0.28, 0.62, 0.085, 0.09, DESK_H + 0.05, DESK_H + 0.27,
        principled('LaptopGlow', srgb('#3a7aff'), rough=0.2, emission=srgb('#5a9aff'), emission_strength=1.2), bevel=0)


def build_brick():
    """Level 10: faced with red brick like the brick-street club, a wood top,
    turntables and a little amp."""
    brick = principled('BoothBrick', srgb('#a8432c'), rough=0.85)
    brick2 = principled('BoothBrick2', srgb('#8e3824'), rough=0.85)
    mortar = plain('#cfc4b4', rough=0.9)
    top = wood('BrickTop', (0.24, 0.12, 0.05), (0.38, 0.2, 0.09))
    box('Mortar', -0.94, 0.94, -0.355, 0.3, 0, DESK_H - 0.05, brick2, bevel=0)
    rows = 7
    h = (DESK_H - 0.05) / rows
    for r in range(rows):
        off = 0.11 if r % 2 else 0
        x = -0.94 - off
        k = 0
        while x < 0.94:
            a, b = max(-0.94, x), min(0.94, x + 0.22)
            if b - a > 0.04:
                box(f'Brick{r}_{k}', a + 0.012, b - 0.012, -0.37, 0.29, r * h + 0.012, (r + 1) * h - 0.012,
                    brick if (r + k) % 3 else brick2, bevel=0.008)
                box(f'Mortar{r}_{k}', a, b, -0.364, -0.356, r * h, (r + 1) * h, mortar, bevel=0)
            x += 0.22
            k += 1
    for side in (-1, 1):
        for r in range(rows):
            off = 0.11 if r % 2 else 0
            y = -0.36 - off
            k = 0
            while y < 0.3:
                a, b = max(-0.36, y), min(0.3, y + 0.22)
                if b - a > 0.04:
                    x0 = 0.94 if side > 0 else -0.955
                    box(f'SideBrick{side}{r}_{k}', x0, x0 + 0.015, a + 0.012, b - 0.012, r * h + 0.012, (r + 1) * h - 0.012,
                        brick if (r + k) % 3 else brick2, bevel=0.004)
                y += 0.22
                k += 1
    box('Top', -0.98, 0.98, -0.44, 0.34, DESK_H - 0.05, DESK_H + 0.02, top, bevel=0.015)
    deck, vinyl, label = plain('#2b2b30', rough=0.5), plain('#111114', rough=0.2), plain('#f0d040')
    platter('DeckL', -0.55, -0.04, DESK_H + 0.02, 0.17, deck, vinyl, label)
    platter('DeckR', 0.55, -0.04, DESK_H + 0.02, 0.17, deck, vinyl, label)
    mixer('Mixer', 0, -0.04, DESK_H + 0.02, 0.26, 0.34, deck, plain('#cfcfd4', rough=0.3))
    # A little guitar-style amp at the end.
    box('Amp', 0.62, 0.92, 0.12, 0.32, DESK_H + 0.02, DESK_H + 0.24, plain('#1e1e22', rough=0.6), bevel=0.01)
    box('AmpGrille', 0.65, 0.89, 0.115, 0.12, DESK_H + 0.05, DESK_H + 0.2, plain('#6a5a40', rough=0.9), bevel=0)


def build_theatre():
    """Level 16: red velvet with gold trim and little footlights along the
    front, like the theatre club's stage."""
    velvet = principled('Velvet', srgb('#a0102a'), rough=0.95)
    velvet_dark = principled('VelvetDark', srgb('#6e0a1c'), rough=0.95)
    gold = principled('StageGold', srgb('#e8b84a'), rough=0.25, emission=srgb('#a87a10'), emission_strength=0.2)
    bulb = neon('Footlight', (1.0, 0.85, 0.5), 6)
    box('Body', -0.94, 0.94, -0.36, 0.3, 0.06, DESK_H - 0.05, velvet_dark, bevel=0.01)
    # Pleated curtain front.
    n = 14
    for i in range(n):
        x = -0.9 + i * (1.8 / n)
        cylinder(f'Pleat{i}', x + 0.064, -0.36, 0.1, DESK_H - 0.09, 0.07, velvet, verts=12)
    box('Plinth', -0.97, 0.97, -0.46, 0.32, 0, 0.1, gold, bevel=0.01)
    box('Top', -0.98, 0.98, -0.46, 0.34, DESK_H - 0.06, DESK_H + 0.01, velvet_dark, bevel=0.012)
    box('TopTrim', -0.98, 0.98, -0.47, -0.45, DESK_H - 0.07, DESK_H + 0.0, gold, bevel=0.004)
    for i in range(9):
        x = -0.85 + i * (1.7 / 8)
        box(f'LampShade{i}', x - 0.035, x + 0.035, -0.5, -0.46, 0.1, 0.16, gold, bevel=0.005)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=(x, -0.5, 0.135))
        bb._finish(bpy.context.active_object, bulb, 0)
    decks(plain('#1c1c22', rough=0.3), plain('#3a3a44', rough=0.2), gold, ring=bulb)


def build_truss():
    """Level 24: a silver truss frame round the front of the desk with two
    moving-head lights on top (the brick and purple clubs' DJ)."""
    steel = principled('Truss', srgb('#c8ccd6'), rough=0.25)
    black = principled('TrussDesk', srgb('#18181e'), rough=0.3)
    white = principled('TrussWhite', srgb('#eef0f4'), rough=0.35)
    lens = neon('MovingLens', (0.6, 0.85, 1.0), 10)
    box('Body', -0.9, 0.9, -0.34, 0.3, 0.0, DESK_H - 0.05, black, bevel=0.01)
    box('Top', -0.94, 0.94, -0.42, 0.34, DESK_H - 0.05, DESK_H + 0.01, black, bevel=0.012)
    box('Logo', -0.3, 0.3, -0.345, -0.34, 0.35, 0.65, white, bevel=0)
    # Truss: two front posts and a beam, each a box of four rods with zigzags.
    def truss(name, a, b, size=0.06):
        from mathutils import Vector
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        side = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
        u = axis.cross(side).normalized() * size
        v = axis.cross(u).normalized() * size
        corners = [u + v, u - v, -u - v, -u + v]
        def rod(n, p, q, r):
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=(q - p).length, location=(p + q) / 2)
            o = bpy.context.active_object
            o.name = n
            o.rotation_mode = 'QUATERNION'
            o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((q - p).normalized())
            bb._finish(o, steel, 0)
        for k, c in enumerate(corners):
            rod(f'{name}Rod{k}', a + c, b + c, 0.012)
        steps = max(2, int((b - a).length / 0.16))
        for j in range(steps):
            p = a + (b - a) * (j / steps)
            q = a + (b - a) * ((j + 1) / steps)
            c0, c1 = corners[j % 4], corners[(j + 1) % 4]
            rod(f'{name}Zig{j}', p + c0, q + c1, 0.006)
    truss('PostL', (-0.92, -0.4, 0), (-0.92, -0.4, 2.0))
    truss('PostR', (0.92, -0.4, 0), (0.92, -0.4, 2.0))
    truss('Beam', (-0.98, -0.4, 2.0), (0.98, -0.4, 2.0))
    for x in (-0.45, 0.45):
        box(f'Yoke{x}', x - 0.09, x + 0.09, -0.48, -0.32, 1.86, 1.93, black, bevel=0.01)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=(x, -0.42, 1.78))
        bb._finish(bpy.context.active_object, black, 0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.06, depth=0.02, location=(x, -0.5, 1.75),
                                            rotation=(math.radians(70), 0, 0))
        bb._finish(bpy.context.active_object, lens, 0)
    decks(white, plain('#9aa0ac', rough=0.25), plain('#5a5f6a', rough=0.3), ring=lens)


def build_screen():
    """Level 27: the whole front is a blue LED screen showing a pulsing
    grid, like the theatre club's screen, trimmed in chrome."""
    black = principled('ScreenDesk', srgb('#121218'), rough=0.3)
    chrome = principled('ScreenChrome', srgb('#c8ccd6'), rough=0.2)
    off = principled('LedOff', srgb('#0a1630'), rough=0.4, emission=srgb('#0a2a6a'), emission_strength=0.6)
    colours = [neon(f'Led{i}', c, 1.6) for i, c in enumerate([(0.05, 0.35, 1.0), (0.05, 0.8, 1.0), (0.55, 0.15, 1.0), (1.0, 0.15, 0.65)])]
    box('Body', -0.94, 0.94, -0.34, 0.3, 0.0, DESK_H - 0.05, black, bevel=0.01)
    box('Frame', -0.95, 0.95, -0.36, -0.34, 0.06, DESK_H - 0.08, chrome, bevel=0.006)
    cols, rows = 16, 7
    for c in range(cols):
        for r in range(rows):
            x = -0.88 + c * (1.76 / (cols - 1))
            z = 0.14 + r * ((DESK_H - 0.3) / (rows - 1))
            ripple = math.cos(math.hypot(c - 7.5, (r - 3) * 1.6) * 0.8)
            m = colours[(c + r) % 4] if ripple > 0.2 else off
            box(f'Led{c}_{r}', x - 0.045, x + 0.045, -0.37, -0.36, z - 0.035, z + 0.035, m, bevel=0)
    box('Top', -0.98, 0.98, -0.44, 0.34, DESK_H - 0.05, DESK_H + 0.01, black, bevel=0.012)
    box('TopEdge', -0.98, 0.98, -0.45, -0.43, DESK_H - 0.05, DESK_H, chrome, bevel=0)
    decks(plain('#1c1c22', rough=0.3), plain('#3a3a44', rough=0.2), plain('#cfcfd4', rough=0.3),
          ring=colours[1], lights=colours[:3])


def build_deco():
    """Level 33: black lacquer with gold art-deco fans and gold trim (the
    black-and-gold club)."""
    lacquer = principled('Lacquer', srgb('#0e0d12'), rough=0.08)
    gold = principled('DecoGold', srgb('#e8b84a'), rough=0.2, emission=srgb('#a87a10'), emission_strength=0.25)
    glow = neon('DecoGlow', (1.0, 0.8, 0.4), 4)
    box('Body', -0.94, 0.94, -0.36, 0.3, 0.06, DESK_H - 0.05, lacquer, bevel=0.012)
    box('Plinth', -0.96, 0.96, -0.4, 0.32, 0, 0.07, gold, bevel=0.008)
    # Three gold sunburst fans across the front: rays spreading up from a
    # little half-disc, stepped arcs above them.
    from mathutils import Vector
    for k, cx in enumerate((-0.6, 0.0, 0.6)):
        base_z = 0.2
        for i in range(7):
            a = math.radians(15 + i * 25)
            p = Vector((cx + 0.07 * math.cos(a), -0.375, base_z + 0.07 * math.sin(a)))
            q = Vector((cx + 0.26 * math.cos(a), -0.375, base_z + 0.26 * math.sin(a)))
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.013, depth=(q - p).length, location=(p + q) / 2)
            o = bpy.context.active_object
            o.rotation_mode = 'QUATERNION'
            o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((q - p).normalized())
            bb._finish(o, gold, 0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.06, depth=0.012, location=(cx, -0.375, base_z),
                                            rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, gold, 0)
        box(f'FanBase{k}', cx - 0.29, cx + 0.29, -0.38, -0.37, base_z - 0.03, base_z, gold, bevel=0)
    box('Band', -0.94, 0.94, -0.375, -0.365, 0.58, 0.61, gold, bevel=0)
    box('Top', -0.98, 0.98, -0.46, 0.34, DESK_H - 0.05, DESK_H + 0.01, lacquer, bevel=0.012)
    box('TopTrim', -0.98, 0.98, -0.47, -0.45, DESK_H - 0.06, DESK_H, gold, bevel=0.004)
    box('UnderGlow', -0.9, 0.9, -0.41, -0.395, 0.07, 0.09, glow, bevel=0)
    decks(lacquer, gold, gold, ring=glow, label=gold)


def build_holo():
    """Level 38: glossy white with a holographic rainbow front, a glowing
    top edge and two light wands."""
    white = principled('HoloWhite', srgb('#f4f4f8'), rough=0.1)
    ring_glow = neon('HoloRing', (0.7, 0.5, 1.0), 8)
    box('Body', -0.94, 0.94, -0.34, 0.3, 0.0, DESK_H - 0.05, white, bevel=0.03)
    bands = 12
    for i in range(bands):
        hue = i / bands
        import colorsys
        r, g, b = colorsys.hsv_to_rgb(hue, 0.8, 1.0)
        m = principled(f'Holo{i}', (r, g, b), rough=0.1, emission=(r, g, b), emission_strength=0.6)
        x0 = -0.88 + i * (1.76 / bands)
        box(f'HoloBand{i}', x0, x0 + 1.76 / bands, -0.36, -0.34, 0.1, DESK_H - 0.12, m, bevel=0)
    box('Top', -0.98, 0.98, -0.44, 0.34, DESK_H - 0.05, DESK_H + 0.01, white, bevel=0.02)
    box('TopGlow', -0.96, 0.96, -0.45, -0.43, DESK_H - 0.045, DESK_H - 0.01, ring_glow, bevel=0)
    # Two glowing light wands standing at the back corners.
    for x in (-0.9, 0.9):
        cylinder(f'WandBase{x}', x, 0.24, DESK_H + 0.01, DESK_H + 0.05, 0.05, white, verts=16)
        cylinder(f'Wand{x}', x, 0.24, DESK_H + 0.05, DESK_H + 0.6, 0.022, ring_glow, verts=12)
    decks(white, plain('#d8d8e4', rough=0.2), plain('#9a9aaa', rough=0.3), ring=ring_glow, lights=[ring_glow])


TIERS = {
    'wood': build_wood,
    'pro': build_pro,
    'club': build_club,
    'neon': build_neon,
    'ice': build_ice,
    'crate': build_crate,
    'brick': build_brick,
    'theatre': build_theatre,
    'truss': build_truss,
    'screen': build_screen,
    'deco': build_deco,
    'holo': build_holo,
}


def build_tier(name):
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    bb.M.clear()
    root = bpy.data.objects.new(f'Booth_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    TIERS[name]()
    root.scale = (BOOTH_SCALE, BOOTH_SCALE, BOOTH_SCALE)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'dj_{name}.blend'))
    meta = iso_rig.render_facings(scene, cam, root, f'dj_{name}', bb.SPRITE_DIR)
    print(f'dj_{name}:', meta, flush=True)


def preview(name, out_dir):
    """Facing 0 only, for a quick look before the full render."""
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    bb.M.clear()
    root = bpy.data.objects.new(f'Booth_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    TIERS[name]()
    root.scale = (BOOTH_SCALE, BOOTH_SCALE, BOOTH_SCALE)
    iso_rig.check_projection(scene, cam)
    iso_rig.add_outlines(scene, root)
    iso_rig.apply_model_scale(root)
    os.makedirs(out_dir, exist_ok=True)
    scene.render.filepath = os.path.join(out_dir, f'dj_{name}.png')
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[1:]
    if args[:1] == ['--preview']:
        for name in args[2:] or list(TIERS):
            preview(name, args[1])
        return
    for name in args or list(TIERS):
        build_tier(name)


if __name__ == '__main__':
    main()
