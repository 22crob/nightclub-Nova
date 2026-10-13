"""The future batch (October 2026, the owner's ask: "futuristic designs and
decorations like hologram decorations"), merged into build_decor.py's DECOR:
    python art/blender/build_decor.py --preview DIR holoDancer holoGlobe ...

The hologram pieces are only their projectors here: the holograms
themselves (a dancing figure, a turning globe, spinning rings, the NOVA
logo, plasma arcs, laser beams) are drawn in the game so they move and
flicker (src/scene/holoFx.js, HOLO in config.js, which holds each
emitter's point in these model units). The Cyber Pillar and the Holo
Screen (a wall piece, back on Y = 0 like decor_batch3's) are plain renders.
"""

import math

import bpy

import build_bar as bb
from build_bars import plain, srgb
from decor_batch2 import mat, sphere, tube, rounded_box

box, cylinder, cone = bb.box, bb.cylinder, bb.cone
principled, neon = bb.principled, bb.neon


def dark():
    return mat('#14141c', rough=0.25)


def chrome():
    return plain('#c9ced8', rough=0.18)


def ring(name, z, r, minor, m):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, major_segments=48, minor_segments=8, location=(0, 0, z))
    o = bpy.context.active_object
    o.name = name
    return bb._finish(o, m, 0)


def build_holo_dancer():
    """A low round projector disc: black, a cyan light ring round the top,
    a glowing lens in the middle. The game projects a dancer above it."""
    cyan = neon('HoloCyan', (0.25, 0.9, 1.0), 6)
    cylinder('Disc', 0, 0, 0, 0.1, 0.42, dark(), verts=48)
    cylinder('Top', 0, 0, 0.1, 0.13, 0.38, mat('#1e2230', rough=0.1), verts=48)
    ring('LightRing', 0.12, 0.34, 0.018, cyan)
    cylinder('Lens', 0, 0, 0.13, 0.15, 0.09, neon('HoloLens', (0.7, 1.0, 1.0), 9), verts=24)
    for k in range(6):
        a = k * math.pi / 3
        box(f'Vent{k}', 0.38 * math.cos(a) - 0.03, 0.38 * math.cos(a) + 0.03,
            0.38 * math.sin(a) - 0.03, 0.38 * math.sin(a) + 0.03, 0.03, 0.07, cyan, bevel=0)


def build_holo_globe():
    """A slim chrome and black pedestal with an emitter dish on top; the game
    turns a wireframe globe above it."""
    cyan = neon('GlobeCyan', (0.2, 0.85, 1.0), 6)
    cylinder('Foot', 0, 0, 0, 0.06, 0.3, dark(), verts=40)
    cone('Stem', 0, 0, 0.06, 0.82, 0.16, 0.07, dark(), verts=32)
    for z in (0.3, 0.55):
        cylinder(f'Band{z}', 0, 0, z, z + 0.025, 0.14 - (z - 0.06) * 0.1, cyan, verts=32)
    cone('Dish', 0, 0, 0.82, 0.92, 0.07, 0.24, chrome(), verts=40)
    ring('DishRing', 0.92, 0.23, 0.015, cyan)
    cylinder('Emitter', 0, 0, 0.9, 0.95, 0.06, neon('GlobeLens', (0.7, 1.0, 1.0), 9), verts=24)


def build_holo_rings():
    """A low six-sided plinth with a purple light strip; the game spins
    three glowing rings like a gyroscope above it."""
    purple = neon('RingPurple', (0.7, 0.3, 1.0), 6)
    cylinder('Plinth', 0, 0, 0, 0.3, 0.36, dark(), verts=6)
    cylinder('Strip', 0, 0, 0.2, 0.23, 0.365, purple, verts=6)
    cylinder('Cap', 0, 0, 0.3, 0.34, 0.3, chrome(), verts=6)
    cylinder('Lens', 0, 0, 0.34, 0.37, 0.1, neon('RingLens', (0.9, 0.7, 1.0), 9), verts=24)


def build_holo_logo():
    """A floor puck with a magenta ring; the game spins the club's star and
    NOVA above it."""
    pink = neon('LogoPink', (1.0, 0.25, 0.8), 6)
    cylinder('Puck', 0, 0, 0, 0.12, 0.3, dark(), verts=40)
    ring('PuckRing', 0.12, 0.27, 0.016, pink)
    cone('Spike', 0, 0, 0.12, 0.3, 0.07, 0.03, chrome(), verts=24)
    cylinder('Lens', 0, 0, 0.3, 0.33, 0.045, neon('LogoLens', (1.0, 0.75, 0.95), 9), verts=20)


def build_plasma_orb():
    """A faceted black stand holding a dark glass sphere with a bright violet
    core; the game crackles lightning arcs inside it."""
    cylinder('Foot', 0, 0, 0, 0.08, 0.28, dark(), verts=8)
    cone('Stand', 0, 0, 0.08, 0.62, 0.2, 0.1, dark(), verts=8)
    cylinder('Collar', 0, 0, 0.6, 0.66, 0.16, chrome(), verts=32)
    glass = principled('OrbGlass', srgb('#1a1030'), rough=0.05, emission=srgb('#6a2cff'), emission_strength=0.35, alpha=0.55)
    sphere('Orb', 0, 0, 0.98, 0.34, glass, segments=40)
    sphere('Core', 0, 0, 0.98, 0.07, neon('OrbCore', (0.9, 0.6, 1.0), 12), segments=20)


def build_laser_gate():
    """3 x 1: two sleek black pylons at the ends, red light strips facing
    each other; the game shoots laser beams between them."""
    red = neon('GateRed', (1.0, 0.15, 0.3), 7)
    for side in (-1, 1):
        x = side * 0.95
        rounded_box(f'Pylon{side}', x - 0.12, x + 0.12, -0.14, 0.14, 0, 1.85, dark(), 0.04)
        box(f'Strip{side}', x - side * 0.125 - 0.012, x - side * 0.125 + 0.012, -0.05, 0.05, 0.3, 1.75, red, bevel=0)
        box(f'Cap{side}', x - 0.13, x + 0.13, -0.15, 0.15, 1.85, 1.9, chrome(), bevel=0.01)
        box(f'Foot{side}', x - 0.2, x + 0.2, -0.2, 0.2, 0, 0.06, chrome(), bevel=0.01)
    box('Rail', -0.83, 0.83, -0.05, 0.05, 0, 0.05, dark(), bevel=0.01)
    box('RailGlow', -0.83, 0.83, -0.051, -0.049, 0.02, 0.04, red, bevel=0)


def build_cyber_pillar():
    """A tall black six-sided column with glowing cyan circuit traces."""
    cyan = neon('PillarCyan', (0.2, 0.9, 1.0), 5)
    cylinder('Base', 0, 0, 0, 0.12, 0.3, chrome(), verts=6)
    cylinder('Column', 0, 0, 0.12, 2.1, 0.22, dark(), verts=6)
    cylinder('Top', 0, 0, 2.1, 2.2, 0.27, chrome(), verts=6)
    cylinder('TopGlow', 0, 0, 2.05, 2.1, 0.225, cyan, verts=6)
    # Circuit traces on each face: a vertical run with little jogs and pads.
    for f in range(6):
        a = math.pi / 6 + f * math.pi / 3
        nx, ny = math.cos(a), math.sin(a)
        tx, ty = -ny, nx
        d = 0.22 * math.cos(math.pi / 6) + 0.003
        for k, (off, z0, z1) in enumerate([(-0.05, 0.25, 0.9), (0.05, 0.9, 1.4), (-0.03, 1.4, 1.95)]):
            cx, cy = nx * d + tx * off, ny * d + ty * off
            box(f'Trace{f}_{k}', cx - 0.008, cx + 0.008, cy - 0.008, cy + 0.008, z0, z1, cyan, bevel=0)
            cylinder(f'Pad{f}_{k}', cx, cy, z1 - 0.01, z1 + 0.01, 0.025, cyan, verts=10)


def build_holo_screen():
    """Wall piece: a dark glass panel in a cyan frame showing a glowing
    equalizer and a wave, sticking out a little from the wall."""
    cyan = neon('ScreenCyan', (0.2, 0.9, 1.0), 5)
    pink = neon('ScreenPink', (1.0, 0.25, 0.75), 6)
    w, z0, z1 = 0.34, 0.2, 1.2
    box('Panel', -w, w, -0.06, 0, z0, z1, mat('#0a0c14', rough=0.08), bevel=0.01)
    for (x0, x1, za, zb) in ((-w - 0.02, w + 0.02, z0 - 0.02, z0), (-w - 0.02, w + 0.02, z1, z1 + 0.02),
                             (-w - 0.02, -w, z0, z1), (w, w + 0.02, z0, z1)):
        box('Frame', x0, x1, -0.07, 0, za, zb, cyan, bevel=0)
    heights = [0.25, 0.45, 0.7, 0.5, 0.85, 0.6, 0.35, 0.55, 0.4]
    bw = (2 * w - 0.1) / len(heights)
    for i, h in enumerate(heights):
        x = -w + 0.05 + i * bw
        box(f'Bar{i}', x + 0.01, x + bw - 0.01, -0.068, -0.062, z0 + 0.06, z0 + 0.06 + h * 0.55, (cyan, pink)[i % 2], bevel=0)
    pts = [(-w + 0.05 + t * (2 * w - 0.1) / 20, -0.069, z1 - 0.2 + 0.07 * math.sin(t * 0.9)) for t in range(21)]
    for a, b in zip(pts, pts[1:]):
        tube('Wave', a, b, 0.008, pink)


DESIGNS = {
    'holoDancer': build_holo_dancer,
    'holoGlobe': build_holo_globe,
    'holoRings': build_holo_rings,
    'holoLogo': build_holo_logo,
    'plasmaOrb': build_plasma_orb,
    'laserGate': build_laser_gate,
    'cyberPillar': build_cyber_pillar,
    'wallHoloScreen': build_holo_screen,
}
