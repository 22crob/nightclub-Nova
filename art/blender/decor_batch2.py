"""The owner's October 2026 decoration drafts (black and white sketches,
coloured here), merged into build_decor.py's DECOR:
    python art/blender/build_decor.py --preview DIR trussLights bubbleColumn ...

Numbers in the comments are the owner's sketch labels (the level each one
unlocks at). Most sit on one tile; the wide ones say their footprint, and
are built to fill it after iso_rig.MODEL_SCALE (2 tiles = 1.5 units).
Statues are smooth metaball figures (no rig needed), in gold, chrome and
bronze.
"""

import math

import bpy
import bmesh
from mathutils import Vector

import build_bar as bb
from build_bars import plain, srgb

box, cylinder, cone = bb.box, bb.cylinder, bb.cone
principled, neon = bb.principled, bb.neon


def mat(hex_color, rough=0.5, glow=0.0, **kw):
    if glow:
        kw.update(emission=srgb(hex_color), emission_strength=glow)
    return principled(f'B2{hex_color}{rough}{glow}{kw.get("alpha", 1)}', srgb(hex_color), rough=rough, **kw)


def sphere(name, x, y, z, r, m, scale=(1, 1, 1), segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(6, segments // 2), radius=r, location=(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.shade_smooth()
    return bb._finish(o, m, 0)


def tube(name, a, b, r, m, verts=10):
    """A rod from point a to point b."""
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=(b - a).length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    bpy.ops.object.shade_smooth()
    return bb._finish(o, m, 0)


def rounded_box(name, x0, x1, y0, y1, z0, z1, m, radius, segments=6):
    """A box with well-rounded edges (bevel of `radius`)."""
    o = box(name, x0, x1, y0, y1, z0, z1, m, bevel=0)
    mod = o.modifiers.new('Round', 'BEVEL')
    mod.width = radius
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
    return o


def faceted(name, x0, x1, y0, y1, z0, z1, m, cut):
    """A box with big flat chamfers on every edge: a cut-gem look."""
    o = box(name, x0, x1, y0, y1, z0, z1, m, bevel=0)
    mod = o.modifiers.new('Facet', 'BEVEL')
    mod.width = cut
    mod.segments = 1
    mod.limit_method = 'NONE'
    return o


def glow_edges(name, obj, thickness, m):
    """A neon cage on another object's edges (its copy, made wireframe)."""
    c = obj.copy()
    c.data = obj.data.copy()
    c.modifiers.clear()
    c.data.materials.clear()
    c.name = name
    bpy.context.scene.collection.objects.link(c)
    w = c.modifiers.new('Wire', 'WIREFRAME')
    w.thickness = thickness
    w.use_replace = True
    c.data.materials.append(m)
    c.parent = bb.ROOT
    return c


# --------------------------------------------------------------------------
# Statues: smooth figures from metaball capsules, posed joint by joint.
# --------------------------------------------------------------------------

def figure(name, parts, m, resolution=0.012):
    """`parts` is a list of (a, b, r): a capsule of radius r from point a to
    point b (b None for a ball). Converted to one smooth mesh."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    mb.threshold = 0.6
    obj = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(obj)
    for a, b, r in parts:
        a = Vector(a)
        if b is None:
            e = mb.elements.new(type='BALL')
            e.co = a
            e.radius = r
            continue
        b = Vector(b)
        e = mb.elements.new(type='CAPSULE')
        e.co = (a + b) / 2
        e.radius = r
        e.size_x = max(0.001, (b - a).length / 2)
        e.rotation = Vector((1, 0, 0)).rotation_difference((b - a).normalized())
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    mesh = bpy.context.active_object
    mesh.name = name
    bpy.ops.object.shade_smooth()
    mesh.data.materials.append(m)
    mesh.parent = bb.ROOT
    return mesh


def body(z, pose):
    """A standing figure's capsules from a pose dict of joint positions
    (relative to the feet at height z). Metaball radii run a bit fat: the
    surface sits inside them."""
    j = {k: Vector((v[0], v[1], v[2] + z)) for k, v in pose.items()}
    p = []
    seg = lambda a, b, r: p.append((j[a], j[b], r))  # noqa: E731
    seg('pelvis', 'chest', 0.12)
    seg('chest', 'neck', 0.1)
    p.append((j['chest'] + Vector((0, 0, 0.02)), None, 0.15))
    p.append((j['pelvis'], None, 0.13))
    seg('neck', 'head', 0.07)
    p.append((j['head'], None, 0.21))
    for s in ('L', 'R'):
        seg(f'shoulder{s}', 'chest', 0.08)
        seg(f'shoulder{s}', f'elbow{s}', 0.065)
        seg(f'elbow{s}', f'wrist{s}', 0.055)
        p.append((j[f'wrist{s}'], None, 0.07))
        seg(f'hip{s}', f'knee{s}', 0.085)
        seg(f'knee{s}', f'ankle{s}', 0.07)
        seg(f'ankle{s}', f'toe{s}', 0.06)
    return j, p


def plinth(top, gold=None, glow=None):
    dark = mat('#17151d', rough=0.25)
    box('Plinth', -0.3, 0.3, -0.3, 0.3, 0, top, dark, bevel=0.02)
    if gold:
        box('PlinthTrim', -0.31, 0.31, -0.31, 0.31, top - 0.03, top, gold, bevel=0.006)
    if glow:
        box('PlinthGlow', -0.27, 0.27, -0.305, -0.295, 0.05, 0.08, glow, bevel=0)


def mic(name, hand, toward, m_handle, m_head):
    """A microphone held in `hand`, its head pointing to `toward`."""
    hand, toward = Vector(hand), Vector(toward)
    d = (toward - hand).normalized()
    tube(f'{name}Handle', hand - d * 0.03, hand + d * 0.1, 0.014, m_handle)
    sphere(f'{name}Head', *(hand + d * 0.13), 0.028, m_head, segments=12)


def build_pop_star():
    """25: a pop star singing, ponytail flying, one arm thrown up. Gold."""
    gold = mat('#f0c050', rough=0.22, glow=0.15)
    top = 0.18
    plinth(top, gold=mat('#f7d77a', rough=0.2, glow=0.3), glow=neon('PopGlow', (1.0, 0.3, 0.7), 6))
    pose = {
        'pelvis': (0, 0, 0.62), 'chest': (0, 0, 0.88), 'neck': (0, 0, 1.02), 'head': (0, -0.01, 1.17),
        'shoulderL': (0.12, 0, 0.98), 'shoulderR': (-0.12, 0, 0.98),
        'elbowL': (0.26, 0.0, 1.12), 'wristL': (0.38, 0.02, 1.3),        # thrown up and out
        'elbowR': (-0.2, -0.1, 0.86), 'wristR': (-0.08, -0.16, 1.04),    # mic to the mouth
        'hipL': (0.07, 0, 0.6), 'kneeL': (0.12, -0.02, 0.33), 'ankleL': (0.15, 0.0, 0.07), 'toeL': (0.17, -0.08, 0.03),
        'hipR': (-0.07, 0, 0.6), 'kneeR': (-0.08, -0.06, 0.32), 'ankleR': (-0.09, 0.0, 0.07), 'toeR': (-0.1, -0.08, 0.03),
    }
    j, p = body(top, pose)
    # Slim: thinner limbs and waist, a little skirt, boots.
    p = [(a, b, r * 0.85) for a, b, r in p]
    p.append((j['pelvis'] + Vector((0, 0, -0.04)), None, 0.15))     # skirt
    p.append((j['pelvis'] + Vector((0, 0, -0.1)), None, 0.17))
    for s in 'LR':
        p.append((j[f'ankle{s}'], j[f'ankle{s}'] + Vector((0, 0, 0.14)), 0.07))  # boots
    # Long high ponytail swinging out behind.
    p.append((j['head'] + Vector((0, 0.04, 0.03)), None, 0.2))     # hair over the back of the head
    crown = j['head'] + Vector((0.0, 0.08, 0.13))
    crown = j['head'] + Vector((0.0, 0.14, 0.06))
    tail = [crown, crown + Vector((-0.02, 0.06, -0.08)), crown + Vector((-0.03, 0.08, -0.26)),
            crown + Vector((-0.02, 0.07, -0.44)), crown + Vector((-0.01, 0.05, -0.58))]
    for k in range(len(tail) - 1):
        p.append((tail[k], tail[k + 1], 0.06 - k * 0.01))
    figure('Star', p, gold)
    mic('Mic', j['wristR'], j['head'] + Vector((0, -0.12, -0.05)), mat('#2a2830', rough=0.4), mat('#3a3840', rough=0.6))


def build_rapper():
    """26: a rapper with a cap, a chain and a mic, the other hand out. Chrome."""
    chrome = mat('#d6dbe6', rough=0.16)
    top = 0.18
    plinth(top, gold=mat('#d6dbe6', rough=0.15), glow=neon('RapGlow', (0.2, 0.8, 1.0), 6))
    pose = {
        'pelvis': (0, 0, 0.6), 'chest': (0, 0, 0.88), 'neck': (0, 0, 1.03), 'head': (0, -0.01, 1.16),
        'shoulderL': (0.15, 0, 0.98), 'shoulderR': (-0.15, 0, 0.98),
        'elbowL': (0.26, -0.1, 0.8), 'wristL': (0.3, -0.28, 0.86),       # hand out to the crowd
        'elbowR': (-0.24, -0.08, 0.84), 'wristR': (-0.1, -0.16, 1.04),   # mic
        'hipL': (0.09, 0, 0.58), 'kneeL': (0.13, -0.02, 0.32), 'ankleL': (0.15, 0.0, 0.07), 'toeL': (0.17, -0.1, 0.04),
        'hipR': (-0.09, 0, 0.58), 'kneeR': (-0.12, 0.0, 0.32), 'ankleR': (-0.14, 0.02, 0.07), 'toeR': (-0.16, -0.08, 0.04),
    }
    j, p = body(top, pose)
    # Baggy: a puffy jacket and wide trousers, chunky trainers.
    p = [(a, b, r * 1.12) for a, b, r in p]
    p.append((j['chest'] + Vector((0, 0, -0.04)), None, 0.2))
    for s in 'LR':
        p.append((j[f'knee{s}'], j[f'ankle{s}'] + Vector((0, 0, 0.05)), 0.1))
        p.append((j[f'ankle{s}'] + Vector((0, -0.03, -0.02)), j[f'toe{s}'], 0.08))
    figure('Rapper', p, chrome)
    # A cap with its peak forward, and a big chain.
    h = j['head']
    cap = mat('#c4cad6', rough=0.2)
    sphere('Cap', h.x, h.y + 0.01, h.z + 0.06, 0.15, cap, scale=(1, 1, 0.62))
    peak = box('CapPeak', -0.1, 0.1, -0.12, 0.02, -0.012, 0.012, cap, bevel=0.01)
    peak.location = (h.x, h.y - 0.13, h.z + 0.05)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.012, location=(0, -0.11, j['chest'].z + 0.02),
                                     rotation=(math.radians(70), 0, 0))
    bb._finish(bpy.context.active_object, mat('#ffd75a', rough=0.2, glow=0.3), 0)
    sphere('Pendant', 0, -0.17, j['chest'].z - 0.07, 0.035, mat('#ffd75a', rough=0.2, glow=0.3), scale=(1, 0.4, 1))
    mic('Mic', j['wristR'], h + Vector((0, -0.14, -0.05)), mat('#2a2830', rough=0.4), mat('#3a3840', rough=0.6))


def build_rocker():
    """29: a rock guitarist in a wide power stance, mid-riff. Bronze."""
    bronze = mat('#c07a3e', rough=0.3, glow=0.05)
    top = 0.18
    plinth(top, gold=mat('#d89050', rough=0.25), glow=neon('RockGlow', (1.0, 0.45, 0.1), 6))
    pose = {
        'pelvis': (0, 0, 0.56), 'chest': (0, -0.02, 0.84), 'neck': (0, -0.02, 0.99), 'head': (0.02, -0.04, 1.12),
        'shoulderL': (0.14, -0.02, 0.94), 'shoulderR': (-0.14, -0.02, 0.94),
        'elbowL': (0.22, -0.16, 0.8), 'wristL': (0.32, -0.2, 0.8),        # on the neck
        'elbowR': (-0.2, -0.14, 0.72), 'wristR': (-0.06, -0.2, 0.66),    # strumming
        'hipL': (0.09, 0, 0.55), 'kneeL': (0.22, -0.05, 0.3), 'ankleL': (0.28, 0.0, 0.07), 'toeL': (0.31, -0.08, 0.03),
        'hipR': (-0.09, 0, 0.55), 'kneeR': (-0.2, -0.02, 0.3), 'ankleR': (-0.25, 0.04, 0.07), 'toeR': (-0.28, -0.04, 0.03),
    }
    j, p = body(top, pose)
    p.append((j['chest'] + Vector((0, 0.02, 0)), None, 0.17))           # jacket
    h = j['head']
    for k, (dx, dz) in enumerate([(-0.1, -0.08), (0.1, -0.08), (-0.12, -0.16), (0.12, -0.16), (0, 0.06)]):
        p.append((h + Vector((dx * 0.7, 0.06, dz * 0.3)), h + Vector((dx, 0.08, dz)), 0.07))  # shaggy hair
    figure('Rocker', p, bronze)
    # The guitar, slung across the body: a body, a neck to the left hand.
    g = mat('#8a4a20', rough=0.3)
    body_c = Vector((-0.04, -0.2, j['pelvis'].z + 0.1))
    sphere('GuitarBody', *body_c, 0.12, g, scale=(1.3, 0.3, 1.0))
    sphere('GuitarBody2', body_c.x + 0.1, body_c.y, body_c.z + 0.07, 0.09, g, scale=(1.2, 0.3, 1.0))
    tube('GuitarNeck', body_c + Vector((0.12, 0, 0.06)), j['wristL'] + Vector((0.12, 0, 0.06)), 0.018, mat('#3a2010', rough=0.4))
    head = j['wristL'] + Vector((0.16, 0, 0.08))
    box('GuitarHead', head.x - 0.03, head.x + 0.05, head.y - 0.01, head.y + 0.01, head.z - 0.02, head.z + 0.03, mat('#3a2010', rough=0.4), bevel=0.005)


# --------------------------------------------------------------------------
# Lights and sculptures
# --------------------------------------------------------------------------

def truss_column(prefix, x0, x1, y0, y1, z0, z1, m, rungs=6):
    """A square truss upright: four corner rods with zigzag braces."""
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    for i, (x, y) in enumerate(corners):
        tube(f'{prefix}Rod{i}', (x, y, z0), (x, y, z1), 0.018, m, verts=8)
    step = (z1 - z0) / rungs
    for k in range(rungs):
        za, zb = z0 + k * step, z0 + (k + 1) * step
        for i in range(4):
            (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
            if k % 2:
                tube(f'{prefix}Brace{k}{i}', (ax, ay, za), (bx, by, zb), 0.009, m, verts=6)
            else:
                tube(f'{prefix}Brace{k}{i}', (bx, by, za), (ax, ay, zb), 0.009, m, verts=6)


def truss_beam(prefix, x0, x1, y0, y1, z0, z1, m, rungs=10):
    corners = [(y0, z0), (y1, z0), (y1, z1), (y0, z1)]
    for i, (y, z) in enumerate(corners):
        tube(f'{prefix}Rod{i}', (x0, y, z), (x1, y, z), 0.018, m, verts=8)
    step = (x1 - x0) / rungs
    for k in range(rungs):
        xa, xb = x0 + k * step, x0 + (k + 1) * step
        for i in range(4):
            (ay, az), (by, bz) = corners[i], corners[(i + 1) % 4]
            a, b = ((xa, ay, az), (xb, by, bz)) if k % 2 else ((xb, ay, az), (xa, by, bz))
            tube(f'{prefix}Brace{k}{i}', a, b, 0.009, m, verts=6)


LEG_X = 1.5        # the truss legs stand 4 game tiles apart (1.5 units each side after MODEL_SCALE)
TRUSS_TOP = 2.1    # tall enough to stand over a DJ set or a seating area


def build_truss_lights():
    """3: a tall truss gantry that stands over things: only its two legs
    take floor (tiles 0 and 4 of a row, three free tiles between), with two
    moving spotlights hanging from it (their pink and blue beams are drawn
    sweeping round in the game, createSweepBeams() in lighting.js). Renders
    in two layers, the far leg behind and the rest in front (TRUSS_LAYERS)."""
    steel = mat('#2a2a32', rough=0.35)
    silver = mat('#b8bcc8', rough=0.25)
    for x in (-LEG_X, LEG_X):
        box(f'Foot{x}', x - 0.16, x + 0.16, -0.18, 0.18, 0, 0.05, steel, bevel=0.01)
        truss_column(f'Col{x}', x - 0.08, x + 0.08, -0.08, 0.08, 0.05, TRUSS_TOP, silver, rungs=6)
    truss_beam('Beam', -LEG_X - 0.08, LEG_X + 0.08, -0.08, 0.08, TRUSS_TOP, TRUSS_TOP + 0.16, silver, rungs=14)
    for i, (x, rgb) in enumerate([(-0.6, (1.0, 0.25, 0.7)), (0.6, (0.25, 0.6, 1.0))]):
        top = TRUSS_TOP
        tube(f'Clamp{i}', (x, 0, top), (x, 0, top - 0.1), 0.02, steel)
        tube(f'Yoke{i}', (x - 0.1, 0, top - 0.1), (x + 0.1, 0, top - 0.1), 0.015, steel)
        tube(f'Can{i}', (x, 0.06, top - 0.14), (x, -0.12, top - 0.28), 0.09, mat('#1a1a20', rough=0.3), verts=20)
        lens = neon(f'Lens{i}', rgb, 12)
        tube(f'Lens{i}', (x, -0.12, top - 0.28), (x, -0.135, top - 0.29), 0.075, lens, verts=20)


def truss_layers(root):
    """Per facing: the leg farther from the camera on its own ('back'), so
    things standing under the gantry draw in front of it, and everything
    else ('front'), drawn over them."""
    import math as _m
    parts = list(root.children_recursive)

    def at(facing):
        a = _m.radians(facing)
        # Game nearness (gx + gy) of the +X leg: x cos a - x sin a.
        far = -LEG_X if (_m.cos(a) - _m.sin(a)) > 0 else LEG_X
        back = [o for o in parts if o.name.startswith((f'Foot{far}', f'Col{far}'))]
        return {'back': back, 'front': [o for o in parts if o not in back]}
    return at


def build_bubble_column():
    """7: a tall glass tube of lit water with bubbles rising."""
    dark = mat('#16141c', rough=0.25)
    water = principled('ColWater', srgb('#5a7cff'), rough=0.05, emission=srgb('#4a5cff'), emission_strength=1.2, alpha=0.6)
    bubble = principled('ColBubble', (0.95, 0.97, 1.0), rough=0.0, emission=(0.85, 0.9, 1.0), emission_strength=2.2)
    cylinder('Base', 0, 0, 0, 0.26, 0.24, dark, verts=40)
    cylinder('BaseGlow', 0, 0, 0.24, 0.27, 0.215, neon('ColRing', (0.5, 0.6, 1.0), 6), verts=40)
    cylinder('Water', 0, 0, 0.26, 1.78, 0.18, water, verts=36)
    cylinder('Cap', 0, 0, 1.78, 1.92, 0.22, dark, verts=40)
    # Bubbles rise in the game (src/scene/tankFx.js).


def build_ribbon():
    """8: a polished ribbon sculpture twisting up off a black plinth."""
    dark = mat('#17151d', rough=0.25)
    box('Plinth', -0.28, 0.28, -0.28, 0.28, 0, 0.3, dark, bevel=0.02)
    box('PlinthTrim', -0.29, 0.29, -0.29, 0.29, 0.27, 0.3, mat('#e8a7c8', rough=0.2, glow=0.2), bevel=0.005)
    m = mat('#ff7ab8', rough=0.1, glow=0.15)  # glossy hot pink
    bm = bmesh.new()
    n = 60
    rows = []
    for i in range(n + 1):
        t = i / n
        z = 0.3 + 1.15 * t
        cx = 0.17 * math.sin(t * math.pi * 2.0)
        cy = 0.1 * math.cos(t * math.pi * 2.0)
        twist = t * math.pi * 2.2
        w = 0.17 * (0.5 + 0.5 * math.sin(t * math.pi * 0.9 + 0.2))
        dx, dy = math.cos(twist) * w, math.sin(twist) * w
        rows.append((bm.verts.new((cx - dx, cy - dy, z)), bm.verts.new((cx + dx, cy + dy, z))))
    for (a0, a1), (b0, b1) in zip(rows, rows[1:]):
        bm.faces.new((a0, a1, b1, b0))
    me = bpy.data.meshes.new('Ribbon')
    bm.to_mesh(me)
    o = bpy.data.objects.new('Ribbon', me)
    bpy.context.scene.collection.objects.link(o)
    s = o.modifiers.new('Thick', 'SOLIDIFY')
    s.thickness = 0.05
    sub = o.modifiers.new('Smooth', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    for p in me.polygons:
        p.use_smooth = True
    bb._finish(o, m, 0)


def build_glass_divider():
    """10 (2 x 1): a wide smoked-glass screen with light streaks, in a black
    frame on two feet, lit pink along the bottom."""
    frame = mat('#18161e', rough=0.3)
    glass = principled('DivGlass', srgb('#8a7ab8'), rough=0.03, emission=srgb('#5a3a9a'), emission_strength=0.35, alpha=0.4)
    streak = principled('DivStreak', srgb('#ffffff'), rough=0.1, emission=srgb('#e8d8ff'), emission_strength=0.7, alpha=0.35)
    for x in (-0.72, 0.72):
        box(f'Foot{x}', x - 0.06, x + 0.06, -0.2, 0.2, 0, 0.05, frame, bevel=0.01)
        box(f'Post{x}', x - 0.035, x + 0.035, -0.035, 0.035, 0.05, 1.3, frame, bevel=0.008)
    box('TopRail', -0.75, 0.75, -0.035, 0.035, 1.26, 1.32, frame, bevel=0.008)
    box('BottomRail', -0.72, 0.72, -0.035, 0.035, 0.22, 0.27, frame, bevel=0.006)
    box('Glass', -0.69, 0.69, -0.012, 0.012, 0.27, 1.26, glass, bevel=0)
    box('Glow', -0.68, 0.68, -0.045, -0.035, 0.23, 0.26, neon('DivGlow', (1.0, 0.3, 0.75), 8), bevel=0)
    # Diagonal light streaks across the glass.
    for i, x in enumerate((-0.45, -0.1, 0.25)):
        o = box(f'Streak{i}', -0.06, 0.06, -0.015, -0.013, -0.42, 0.42, streak, bevel=0)
        o.location = (x, 0, 0.76)
        o.rotation_euler = (0, math.radians(-35), 0)


def build_bottle_shelf():
    """12 (2 x 1): a black open case with two lit shelves of bottles."""
    case = mat('#141218', rough=0.3)
    back = neon('ShelfBack', (1.0, 0.85, 0.6), 1.6)
    edge = neon('ShelfEdge', (1.0, 0.85, 0.6), 5)
    box('Back', -0.74, 0.74, 0.16, 0.2, 0, 1.0, case, bevel=0.01)
    box('BackLight', -0.68, 0.68, 0.145, 0.16, 0.08, 0.94, back, bevel=0)
    for x in (-0.74, 0.7):
        box(f'Side{x}', x, x + 0.04, -0.2, 0.2, 0, 1.0, case, bevel=0.008)
    box('Top', -0.74, 0.74, -0.2, 0.2, 0.96, 1.0, case, bevel=0.008)
    box('Bottom', -0.74, 0.74, -0.2, 0.2, 0, 0.08, case, bevel=0.008)
    cols = ['#d88a2a', '#2e7a3a', '#e8e4d8', '#3a5ad8', '#b02838', '#e8c040', '#7a3ab8', '#202024']
    import random
    rnd = random.Random(12)
    for s, z in enumerate((0.08, 0.5)):
        if s:
            box(f'Shelf{s}', -0.7, 0.7, -0.18, 0.15, z - 0.03, z, case, bevel=0.004)
        box(f'ShelfEdge{s}', -0.7, 0.7, -0.19, -0.18, z - 0.012, z, edge, bevel=0)
        x = -0.62
        while x < 0.6:
            c = srgb(rnd.choice(cols))
            bm = principled(f'Btl{s}{x:.2f}', c, rough=0.08, transmission=0.6, emission=c, emission_strength=0.5)
            h = rnd.uniform(0.24, 0.34)
            cylinder(f'Bottle{s}{x:.2f}', x, 0.0, z, z + h * 0.7, 0.045, bm, verts=14)
            cone(f'Neck{s}{x:.2f}', x, 0.0, z + h * 0.7, z + h, 0.045, 0.015, bm, verts=12)
            x += rnd.uniform(0.11, 0.15)


def build_cube_stack():
    """23: two black cubes stacked askew on a plinth, edges glowing cyan."""
    black = mat('#121118', rough=0.2)
    glow = neon('CubeEdge', (0.2, 0.9, 1.0), 9)
    box('Plinth', -0.3, 0.3, -0.3, 0.3, 0, 0.22, black, bevel=0.015)
    glow_edges('PlinthEdge', bpy.context.active_object, 0.012, glow)
    for i, (z, rz, rx) in enumerate([(0.52, 20, 8), (1.0, -15, -12)]):
        c = box(f'Cube{i}', -0.2, 0.2, -0.2, 0.2, -0.2, 0.2, black, bevel=0.01)
        c.location = (0.02 * (-1) ** i, 0, z)
        c.rotation_euler = (math.radians(rx), math.radians(10 * (-1) ** i), math.radians(rz))
        e = glow_edges(f'CubeEdge{i}', c, 0.018, glow)
        e.location, e.rotation_euler = c.location.copy(), c.rotation_euler.copy()
        e.scale = (1.03, 1.03, 1.03)


# --------------------------------------------------------------------------
# Aquariums: shared tank life (gravel, rocks, plants, fish, bubbles).
# --------------------------------------------------------------------------

FISH = ['#ff8a1f', '#ffe03a', '#ff4a8a', '#5af0ff']


def tank_life(prefix, x0, x1, y0, y1, z0, z1, seed, plants='#2bd46a', fish=FISH, count=None, jelly=False, live=False):
    """`live`: leave out the fish and bubbles, which the game draws moving
    (src/scene/tankFx.js)."""
    import random
    rnd = random.Random(seed)
    w = x1 - x0
    box(f'{prefix}Gravel', x0, x1, y0, y1, z0, z0 + 0.06, mat('#c8b080', rough=0.85), bevel=0.005)
    rock = mat('#3a3a44', rough=0.8)
    for i in range(max(2, int(w * 4))):
        sphere(f'{prefix}Rock{i}', rnd.uniform(x0 + 0.05, x1 - 0.05), rnd.uniform(y0 + (y1 - y0) * 0.4, y1 - 0.04),
               z0 + 0.06, rnd.uniform(0.04, 0.08), rock, scale=(1.3, 1, 0.7), segments=12)
    leaf = mat(plants, rough=0.5, glow=0.8)
    for i in range(max(3, int(w * 6))):
        x = rnd.uniform(x0 + 0.04, x1 - 0.04)
        y = rnd.uniform(y0 + (y1 - y0) * 0.35, y1 - 0.03)
        h = rnd.uniform(0.25, 0.75) * (z1 - z0)
        for k in range(3):
            a = math.radians(rnd.uniform(-30, 30))
            hk = h * (1 - k * 0.2)
            o = sphere(f'{prefix}Leaf{i}{k}', 0, 0, 0, 1.0, leaf, scale=(0.035, 0.012, hk / 2), segments=10)
            o.location = (x + math.sin(a) * hk / 2, y, z0 + 0.05 + math.cos(a) * hk / 2)
            o.rotation_euler = (0, a, math.radians(rnd.uniform(0, 180)))
    n = 0 if live else (count or max(2, int(w * 5)))
    for i in range(n):
        x = rnd.uniform(x0 + 0.08, x1 - 0.08)
        y = rnd.uniform(y0 + 0.05, y1 - 0.05)
        z = rnd.uniform(z0 + 0.2, z1 - 0.1)
        c = rnd.choice(fish)
        if jelly:
            m = principled(f'{prefix}Jelly{i}', srgb(c), rough=0.1, emission=srgb(c), emission_strength=2.2, alpha=0.8)
            sphere(f'{prefix}Bell{i}', x, y, z, 0.06, m, scale=(1, 1, 0.75), segments=14)
            for k in range(4):
                a = k * math.pi / 2 + 0.4
                tube(f'{prefix}Tent{i}{k}', (x + math.cos(a) * 0.03, y + math.sin(a) * 0.03, z - 0.02),
                     (x + math.cos(a) * 0.04, y + math.sin(a) * 0.04, z - 0.16), 0.006, m, verts=5)
            continue
        m = principled(f'{prefix}Fish{i}', srgb(c), rough=0.3, emission=srgb(c), emission_strength=1.6)
        flip = rnd.choice((-1, 1))
        sphere(f'{prefix}Fish{i}', x, y, z, 0.035, m, scale=(1.6, 0.55, 0.9), segments=12)
        cone(f'{prefix}Tail{i}', x - 0.06 * flip, y, z - 0.025, z + 0.025, 0.0, 0.03, m, verts=6)
    if live:
        return
    bubble = principled(f'{prefix}Bubble', (0.95, 0.98, 1.0), rough=0.0, emission=(0.85, 0.95, 1.0), emission_strength=1.6)
    bx = rnd.uniform(x0 + 0.05, x1 - 0.05)
    for i in range(5):
        sphere(f'{prefix}Bub{i}', bx + rnd.uniform(-0.02, 0.02), y0 + 0.06, z0 + 0.15 + i * (z1 - z0 - 0.2) / 5, 0.012 + i * 0.003, bubble, segments=8)


def water(name, hex_color, glow=0.5):
    return principled(name, srgb(hex_color), rough=0.04, emission=srgb(hex_color), emission_strength=glow * 0.5, alpha=0.22)


def build_tank_cabinet():
    """33 (2 x 1): an aquarium on a black cabinet with a glowing strip."""
    cab = mat('#16141c', rough=0.3)
    box('Cabinet', -0.72, 0.72, -0.3, 0.3, 0, 0.5, cab, bevel=0.02)
    for x in (-0.36, 0.36):
        box(f'Door{x}', x - 0.33, x + 0.33, -0.31, -0.3, 0.06, 0.44, mat('#1e1c26', rough=0.25), bevel=0.004)
        box(f'DoorGlow{x}', x - 0.25, x + 0.25, -0.315, -0.31, 0.08, 0.1, neon('CabGlow', (0.4, 0.8, 1.0), 6), bevel=0)
    tank_life('T', -0.68, 0.68, -0.26, 0.26, 0.5, 1.2, 33, live=True)
    box('BackWall', -0.69, 0.69, 0.255, 0.27, 0.5, 1.2, mat('#0c2a6a', rough=0.6, glow=0.5), bevel=0)
    box('Water', -0.7, 0.7, -0.28, 0.28, 0.5, 1.2, water('TWater', '#3a8aff'), bevel=0.01)
    box('Lid', -0.72, 0.72, -0.3, 0.3, 1.2, 1.26, cab, bevel=0.01)


def build_tank_tube():
    """34: a round glass column aquarium with one big plant."""
    dark = mat('#16141c', rough=0.25)
    cylinder('Base', 0, 0, 0, 0.3, 0.3, dark, verts=40)
    cylinder('BaseGlow', 0, 0, 0.12, 0.15, 0.305, neon('TubeGlow', (0.3, 1.0, 0.8), 6), verts=40)
    cylinder('Gravel', 0, 0, 0.3, 0.36, 0.26, mat('#c8b080', rough=0.85), verts=32)
    leaf = mat('#3ae08a', rough=0.5, glow=0.9)
    for k in range(9):
        a = k / 9 * math.tau
        h = 0.7 + 0.35 * ((k * 7) % 5) / 5
        tilt = math.atan2(0.13, h)
        o = sphere(f'Leaf{k}', 0, 0, 0, 1.0, leaf, scale=(0.05, 0.015, h / 2), segments=12)
        o.location = (math.cos(a) * 0.065, 0.02 + math.sin(a) * 0.05, 0.36 + h / 2)
        o.rotation_euler = (-math.sin(a) * tilt, math.cos(a) * tilt, a + math.pi / 2)
    # Fish swim in the game (src/scene/tankFx.js).
    cylinder('Water', 0, 0, 0.3, 1.75, 0.27, water('TubeWater', '#2ad0c0', 0.45), verts=40)
    cylinder('Cap', 0, 0, 1.75, 1.86, 0.3, dark, verts=40)
    cylinder('CapGlow', 0, 0, 1.75, 1.77, 0.305, neon('TubeGlow2', (0.3, 1.0, 0.8), 6), verts=40)


def build_tank_hex():
    """35: a six-sided aquarium on a matching cabinet, lit purple."""
    dark = mat('#16141c', rough=0.25)
    def hexa(name, z0, z1, r, m):
        o = cylinder(name, 0, 0, z0, z1, r, m, verts=6)
        o.rotation_euler = (0, 0, math.radians(30))
        return o
    hexa('Cabinet', 0, 0.48, 0.36, dark)
    hexa('CabGlow', 0.08, 0.11, 0.365, neon('HexGlow', (0.75, 0.35, 1.0), 6))
    tank_life('H', -0.22, 0.22, -0.2, 0.2, 0.48, 1.25, 35, plants='#40e070', count=4, live=True)
    hexa('Water', 0.48, 1.25, 0.34, water('HexWater', '#8a5aff', 0.5))
    hexa('Lid', 1.25, 1.36, 0.37, dark)


def build_tank_long():
    """36 (3 x 1): a long low aquarium on a black stand."""
    cab = mat('#16141c', rough=0.3)
    box('Stand', -1.08, 1.08, -0.24, 0.24, 0.0, 0.3, cab, bevel=0.02)
    box('StandGlow', -1.0, 1.0, -0.245, -0.24, 0.12, 0.15, neon('LongGlow', (0.2, 0.9, 1.0), 6), bevel=0)
    tank_life('L', -1.03, 1.03, -0.2, 0.2, 0.3, 0.86, 36, live=True)
    box('BackWall', -1.04, 1.04, 0.195, 0.21, 0.3, 0.86, mat('#0a3a5a', rough=0.6, glow=0.5), bevel=0)
    box('Water', -1.05, 1.05, -0.22, 0.22, 0.3, 0.86, water('LongWater', '#30c0ff'), bevel=0.01)
    box('Lid', -1.08, 1.08, -0.24, 0.24, 0.86, 0.92, cab, bevel=0.01)


def build_jelly_bowl():
    """37 (2 x 1): a rounded tank of glowing jellyfish on a lit base."""
    dark = mat('#16141c', rough=0.25)
    rounded_box('Base', -0.7, 0.7, -0.3, 0.3, 0, 0.16, dark, 0.06)
    box('BaseGlow', -0.62, 0.62, -0.305, -0.3, 0.06, 0.09, neon('JellyGlow', (1.0, 0.35, 0.9), 7), bevel=0)
    tank_life('J', -0.5, 0.5, -0.16, 0.16, 0.16, 1.0, 37, plants='#7a40ff', fish=['#ff7ae0', '#c07aff', '#7ae0ff'], count=5, jelly=True, live=True)
    rounded_box('Water', -0.66, 0.66, -0.27, 0.27, 0.16, 1.06, water('JellyWater', '#5a2aaa', 0.6), 0.22, segments=8)
    rounded_box('Lid', -0.42, 0.42, -0.16, 0.16, 1.04, 1.12, dark, 0.05)


def build_tank_arch():
    """40 (2 x 1): an aquarium in a tall black arch, pink neon up its sides."""
    dark = mat('#16141c', rough=0.25)
    glow = neon('ArchGlow', (1.0, 0.3, 0.75), 8)
    box('Base', -0.74, 0.74, -0.26, 0.26, 0, 0.16, dark, bevel=0.015)
    box('BaseGlow', -0.66, 0.66, -0.265, -0.26, 0.06, 0.09, glow, bevel=0)
    # The arch: two legs and a half ring across the top.
    for x in (-0.74, 0.58):
        box(f'Leg{x}', x, x + 0.16, -0.24, 0.24, 0.16, 1.0, dark, bevel=0.01)
        box(f'LegGlow{x}', x + 0.06, x + 0.1, -0.245, -0.24, 0.22, 0.98, glow, bevel=0)
    import build_seating as bs
    bs.arc_block('Arch', 0, 0, 0.58, 0.74, -2, 182, 0, 0.48, dark, bevel=0.01)
    arch = bpy.context.active_object
    for o in [o for o in bb.ROOT.children if o.name.startswith('Arch')]:
        o.rotation_euler = (math.radians(90), 0, 0)
        o.location = (0, 0.24, 1.0)
    bs.arc_block('ArchGlow', 0, 0, 0.64, 0.68, 0, 180, 0, 0.005, glow, bevel=0)
    for o in [o for o in bb.ROOT.children if o.name.startswith('ArchGlow')]:
        o.rotation_euler = (math.radians(90), 0, 0)
        o.location = (0, -0.245, 1.0)
    tank_life('A', -0.56, 0.56, -0.18, 0.18, 0.16, 1.4, 40, plants='#30e080', live=True)
    # Water: a box to the arch's spring line and a half cylinder over it.
    w = water('ArchWater', '#2a9ae0', 0.5)
    box('Water', -0.58, 0.58, -0.2, 0.2, 0.16, 1.0, w, bevel=0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.58, depth=0.4, location=(0, 0, 1.0), rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object
    o.name = 'WaterTop'
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for v in o.data.vertices:
        if v.co.y < 0:  # local Y is world -Z after the 90 degree turn
            v.select = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='VERT')
    bpy.ops.object.mode_set(mode='OBJECT')
    bb._finish(o, w, 0)


# Decorations drawn in two layers (see build_decor.build()).
LAYERS = {'trussLights': truss_layers}

DESIGNS = {
    'trussLights': build_truss_lights,
    'bubbleColumn': build_bubble_column,
    'ribbon': build_ribbon,
    'glassDivider': build_glass_divider,
    'bottleShelf': build_bottle_shelf,
    'cubeStack': build_cube_stack,
    'popStar': build_pop_star,
    'rapper': build_rapper,
    'rocker': build_rocker,
    'tankCabinet': build_tank_cabinet,
    'tankTube': build_tank_tube,
    'tankHex': build_tank_hex,
    'tankLong': build_tank_long,
    'jellyBowl': build_jelly_bowl,
    'tankArch': build_tank_arch,
}
