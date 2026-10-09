"""The owner's October 2026 DJ set drafts (black and white sketches,
coloured here), merged into build_booths.py's TIERS:
    python art/blender/build_booths.py --preview DIR glowFront ...

Same 2 x 1 desk as every booth (x in [-1, 1], y in [-0.5, 0.5] before
BOOTH_SCALE, crowd side -Y, DESK_H tall). Each has two turntables and a
mixer on top, like the sketches. Numbers are the owner's sketch labels.
"""

import math

import bpy

import build_bar as bb
from build_bars import plain, srgb

box, cylinder = bb.box, bb.cylinder
principled, neon = bb.principled, bb.neon
DESK_H = 1.0


def turntables(deck, glow=None, mixer_glow=None):
    """Two turntables (base, black record, label, tonearm) and a mixer."""
    vinyl = plain('#0e0e10', rough=0.25)
    label = principled('TTLabel', srgb('#e8e4dc'), rough=0.4)
    arm = plain('#c8ccd4', rough=0.25)
    knob = plain('#d8d8dc', rough=0.3)
    for x in (-0.56, 0.56):
        box(f'TT{x}', x - 0.32, x + 0.32, -0.3, 0.26, DESK_H, DESK_H + 0.07, deck, bevel=0.012)
        cylinder(f'Platter{x}', x - 0.03, -0.03, DESK_H + 0.07, DESK_H + 0.09, 0.22, plain('#4a4a52', rough=0.3), verts=40)
        cylinder(f'Record{x}', x - 0.03, -0.03, DESK_H + 0.09, DESK_H + 0.1, 0.21, vinyl, verts=40)
        cylinder(f'Label{x}', x - 0.03, -0.03, DESK_H + 0.1, DESK_H + 0.104, 0.07, label, verts=24)
        if glow:
            bpy.ops.mesh.primitive_torus_add(major_radius=0.225, minor_radius=0.008, location=(x - 0.03, -0.03, DESK_H + 0.08),
                                             major_segments=40, minor_segments=8)
            bb._finish(bpy.context.active_object, glow, 0)
        cylinder(f'ArmBase{x}', x + 0.24, 0.17, DESK_H + 0.07, DESK_H + 0.11, 0.035, arm, verts=16)
        a = box(f'Arm{x}', -0.008, 0.008, -0.2, 0.0, -0.008, 0.008, arm, bevel=0)
        a.location = (x + 0.24, 0.17, DESK_H + 0.115)
        a.rotation_euler = (0, 0, math.radians(-25))
    box('Mixer', -0.2, 0.2, -0.28, 0.24, DESK_H, DESK_H + 0.08, deck, bevel=0.012)
    for i in range(4):
        for j in range(3):
            cylinder(f'Knob{i}{j}', -0.12 + i * 0.08, 0.14 - j * 0.08, DESK_H + 0.08, DESK_H + 0.105, 0.016, knob, verts=10)
        box(f'Fader{i}', -0.13 + i * 0.08, -0.11 + i * 0.08, -0.22, -0.1, DESK_H + 0.08, DESK_H + 0.085, plain('#222228'), bevel=0)
    if mixer_glow:
        box('MixerLeds', -0.16, 0.16, 0.2, 0.215, DESK_H + 0.08, DESK_H + 0.086, mixer_glow, bevel=0)


def build_glow_front():
    """41: a gloss black desk whose whole front is one glowing panel."""
    black = principled('GFBlack', srgb('#0e0c14'), rough=0.12)
    panel = principled('GFPanel', srgb('#e8d8ff'), rough=0.2, emission=srgb('#b07aff'), emission_strength=3.0)
    box('Body', -0.95, 0.95, -0.4, 0.34, 0, DESK_H, black, bevel=0.015)
    box('Panel', -0.84, 0.84, -0.415, -0.4, 0.14, DESK_H - 0.14, panel, bevel=0.008)
    turntables(plain('#1a1a20', rough=0.3), mixer_glow=neon('GFLed', (0.7, 0.4, 1.0), 8))


def build_curve():
    """42: a long rounded desk, pink light running round its corners."""
    black = principled('CVBlack', srgb('#0e0c14'), rough=0.1)
    pink = neon('CVPink', (1.0, 0.2, 0.65), 10)
    o = box('Body', -0.96, 0.96, -0.42, 0.34, 0.0, DESK_H, black, bevel=0)
    mod = o.modifiers.new('Round', 'BEVEL')
    mod.width = 0.3
    mod.segments = 10
    mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
    # Glow strips on the rounded front corners and along the top edge.
    for side in (-1, 1):
        for k in range(6):
            a = math.radians(-90 + side * (k + 0.5) * 15)
            x = side * 0.66 + math.cos(a) * 0.305
            y = -0.12 + math.sin(a) * 0.305
            box(f'Corner{side}{k}', x - 0.012, x + 0.012, y - 0.012, y + 0.012, 0.12, DESK_H - 0.12, pink, bevel=0)
    box('TopGlow', -0.66, 0.66, -0.425, -0.41, DESK_H - 0.1, DESK_H - 0.07, pink, bevel=0)
    turntables(plain('#1a1a20', rough=0.3), glow=pink)


def build_facet():
    """43: a faceted gunmetal front like a cut gem, gold top edge."""
    gun = principled('FTGun', srgb('#3a3c46'), rough=0.18)
    gun2 = principled('FTGun2', srgb('#5a5e6c'), rough=0.15)
    gold = principled('FTGold', srgb('#e8b84a'), rough=0.22, emission=srgb('#a87a10'), emission_strength=0.4)
    box('Body', -0.95, 0.95, -0.3, 0.34, 0, DESK_H, gun, bevel=0.01)
    # Triangular facets across the front, alternately light and dark.
    import bmesh
    bm = bmesh.new()
    n = 4
    xs = [-0.95 + 1.9 * i / n for i in range(n + 1)]
    for i in range(n):
        x0, x1 = xs[i], xs[i + 1]
        xm = (x0 + x1) / 2
        apex = bm.verts.new((xm, -0.42, DESK_H / 2))
        corners = [bm.verts.new(p) for p in ((x0, -0.3, 0.02), (x1, -0.3, 0.02), (x1, -0.3, DESK_H - 0.02), (x0, -0.3, DESK_H - 0.02))]
        for k in range(4):
            bm.faces.new((corners[k], corners[(k + 1) % 4], apex))
    me = bpy.data.meshes.new('Facets')
    bm.to_mesh(me)
    for k, p in enumerate(me.polygons):
        p.material_index = k % 2
    o = bpy.data.objects.new('Facets', me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(gun2)
    me.materials.append(gun)
    o.parent = bb.ROOT
    box('TopEdge', -0.96, 0.96, -0.44, 0.35, DESK_H - 0.03, DESK_H, gold, bevel=0.006)
    box('Kick', -0.94, 0.94, -0.44, -0.3, 0, 0.03, gold, bevel=0.004)
    turntables(plain('#1c1c22', rough=0.3), mixer_glow=neon('FTLed', (1.0, 0.75, 0.3), 6))


def build_rack():
    """45: an open steel frame table, X braces at the ends, records below."""
    steel = principled('RKSteel', srgb('#b8bcc8'), rough=0.25)
    dark = plain('#1c1c22', rough=0.4)
    t = 0.035
    for x in (-0.93, 0.93):
        for y in (-0.38, 0.3):
            box(f'Leg{x}{y}', x - t, x + t, y - t, y + t, 0, DESK_H - 0.04, steel, bevel=0.006)
        for a, b in (((-0.38, 0.06), (0.3, DESK_H - 0.08)), ((0.3, 0.06), (-0.38, DESK_H - 0.08))):
            from mathutils import Vector
            p, q = Vector((x, a[0], a[1])), Vector((x, b[0], b[1]))
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.018, depth=(q - p).length, location=(p + q) / 2)
            o = bpy.context.active_object
            o.rotation_mode = 'QUATERNION'
            o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((q - p).normalized())
            bb._finish(o, steel, 0)
    box('Top', -0.97, 0.97, -0.42, 0.34, DESK_H - 0.05, DESK_H, dark, bevel=0.008)
    box('TopRim', -0.97, 0.97, -0.425, -0.415, DESK_H - 0.06, DESK_H, steel, bevel=0.003)
    box('Shelf', -0.93, 0.93, -0.38, 0.3, 0.16, 0.2, steel, bevel=0.004)
    # Records filed on the shelf, and a crate.
    cols = ['#e8423a', '#2a6ad8', '#f0c040', '#1a1a1e', '#e85ab8', '#3ab878']
    for i in range(14):
        x = -0.8 + i * 0.05
        box(f'Sleeve{i}', x - 0.008, x + 0.008, -0.3, 0.0, 0.2, 0.5, principled(f'Sleeve{i}', srgb(cols[i % len(cols)]), rough=0.5), bevel=0)
    box('Crate', 0.25, 0.8, -0.32, 0.22, 0.2, 0.46, principled('RKCrate', srgb('#d0402a'), rough=0.6), bevel=0.01)
    turntables(plain('#c8ccd4', rough=0.25), glow=neon('RKGlow', (0.3, 0.9, 1.0), 6))


def build_capsule():
    """48: a white capsule-ended desk with glowing cyan bands round it."""
    white = principled('CPWhite', srgb('#f2f2f6'), rough=0.12)
    cyan = neon('CPCyan', (0.2, 0.85, 1.0), 10)
    o = box('Body', -0.96, 0.96, -0.42, 0.34, 0.0, DESK_H, white, bevel=0)
    mod = o.modifiers.new('Round', 'BEVEL')
    mod.width = 0.37
    mod.segments = 12
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(80)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
    # Upright glowing bands across the front.
    for x in (-0.3, 0.3):
        box(f'Band{x}', x - 0.06, x + 0.06, -0.428, -0.42, 0.04, DESK_H - 0.04, cyan, bevel=0)
    box('TopTrim', -0.6, 0.6, -0.43, -0.41, DESK_H - 0.04, DESK_H - 0.01, cyan, bevel=0)
    turntables(plain('#d8d8e0', rough=0.25), glow=cyan)


def build_glass():
    """50: three glass panels across the front in glowing frames, lit inside."""
    black = principled('GLBlack', srgb('#0e0c14'), rough=0.15)
    frame = neon('GLFrame', (0.55, 0.85, 1.0), 9)
    glass = principled('GLGlass', srgb('#bfe6ff'), rough=0.03, emission=srgb('#4aa0ff'), emission_strength=0.8, alpha=0.45)
    box('Back', -0.95, 0.95, 0.24, 0.34, 0, DESK_H, black, bevel=0.01)
    box('Inner', -0.9, 0.9, -0.3, 0.24, 0.04, DESK_H - 0.05, principled('GLInner', srgb('#102040'), rough=0.4, emission=srgb('#1a4aa0'), emission_strength=0.8), bevel=0)
    box('Top', -0.97, 0.97, -0.42, 0.34, DESK_H - 0.05, DESK_H, black, bevel=0.01)
    box('Plinth', -0.97, 0.97, -0.42, 0.34, 0, 0.04, black, bevel=0.006)
    xs = [-0.95, -0.317, 0.317, 0.95]
    for i in range(3):
        box(f'Pane{i}', xs[i] + 0.02, xs[i + 1] - 0.02, -0.4, -0.38, 0.04, DESK_H - 0.05, glass, bevel=0)
    for x in xs:
        box(f'FrameV{x}', x - 0.02, x + 0.02, -0.42, -0.36, 0.04, DESK_H - 0.05, frame, bevel=0)
    for z in (0.04, DESK_H - 0.07):
        box(f'FrameH{z}', -0.95, 0.95, -0.42, -0.36, z, z + 0.02, frame, bevel=0)
    for x in (-0.95, 0.95):
        box(f'Side{x}', x - 0.02 if x > 0 else x, x if x > 0 else x + 0.02, -0.4, 0.24, 0.04, DESK_H - 0.05, glass, bevel=0)
    turntables(plain('#1c1c22', rough=0.3), glow=frame)


DESIGNS = {
    'glowFront': build_glow_front,
    'curve': build_curve,
    'facet': build_facet,
    'rack': build_rack,
    'capsule': build_capsule,
    'glass': build_glass,
}
