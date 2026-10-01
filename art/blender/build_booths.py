"""Builds Club Nova's DJ booth line-up in Blender and renders their sprites.

Run from the repo root with a Python that has the `bpy` module and pillow:
    python art/blender/build_booths.py               # all tiers
    python art/blender/build_booths.py starter ice   # only some tiers

Five tiers that pair with the five bars (build_bars.py), from a wooden
desk with turntables to a glowing ice booth. Booths are only the DJ's desk
and gear; speakers are a separate decoration.

Every booth has the same 2 x 1 tile footprint: x in [-1, 1], y in
[-0.5, 0.5] at rest. The crowd side faces -Y (game +gy at facing 0); the DJ
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

DESK_H = 1.0   # desk height, about the same as the bar counters


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


TIERS = {
    'wood': build_wood,
    'pro': build_pro,
    'club': build_club,
    'neon': build_neon,
    'ice': build_ice,
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
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'dj_{name}.blend'))
    meta = iso_rig.render_facings(scene, cam, root, f'dj_{name}', bb.SPRITE_DIR)
    print(f'dj_{name}:', meta, flush=True)


def main():
    for name in sys.argv[1:] or list(TIERS):
        build_tier(name)


if __name__ == '__main__':
    main()
