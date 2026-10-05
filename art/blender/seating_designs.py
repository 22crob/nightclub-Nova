"""More booths and sofas for Club Nova, built with build_seating.py's
helpers and rendered by it (build_seating.py merges DESIGNS into SEATING):
    python art/blender/build_seating.py --preview DIR tikiHut
    python art/blender/build_seating.py tikiHut ...

Booths take 3 x 3 tiles (the Wood Lounge 3 x 2) and each has its own
shape; sofas take 3 x 1 tiles and seat two. Front faces -Y. Backrests are
parts named Back*, roofs and arches overhead Canopy* (see
build_seating.layers_at()); a seat may face its own way ([x, y, degrees]).
See art/REFERENCE_NOTES.md for the owner's reference screenshots.
"""

import math

import build_seating as bs

bb = bs.bb
box, cylinder, cone, sphere, arc_block, candle, drinks = bs.box, bs.cylinder, bs.cone, bs.sphere, bs.arc_block, bs.candle, bs.drinks
principled, neon, plain, srgb = bs.principled, bs.neon, bs.plain, bs.srgb



def mat(hex_color, rough=0.5, glow=0.0, **kw):
    if glow:
        kw.update(emission=srgb(hex_color), emission_strength=glow)
    return principled(f'M{hex_color}{rough}{glow}', srgb(hex_color), rough=rough, **kw)


def torus(name, x, y, z, major, minor, m, rot=(0, 0, 0), scale=(1, 1, 1)):
    import bpy
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=(x, y, z),
                                     rotation=tuple(math.radians(a) for a in rot), major_segments=40, minor_segments=12)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.shade_smooth()
    return bb._finish(o, m, 0)


# --------------------------------------------------------------------------
# Booths (3 x 3 unless noted), each its own shape. A seat may face its own
# way: [x, y, degrees] (see build_seating.py).
# --------------------------------------------------------------------------

def tube(name, a, b, r, m, verts=10):
    """A rod from point a to point b."""
    from mathutils import Vector
    a, b = Vector(a), Vector(b)
    bs.bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=(b - a).length, location=(a + b) / 2)
    o = bs.bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    return bb._finish(o, m, 0)


def lathe(name, cx, cy, profile, a0, a1, m, thickness=0.0):
    """A surface turned round the upright axis at (cx, cy): `profile` is
    [(radius, z), ...] from bottom to top, swept from angle a0 to a1."""
    import bmesh
    steps = max(6, int(abs(a1 - a0) / 6))
    bm = bmesh.new()
    grid = []
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        grid.append([bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z)) for r, z in profile])
    for k in range(steps):
        for j in range(len(profile) - 1):
            bm.faces.new((grid[k][j], grid[k + 1][j], grid[k + 1][j + 1], grid[k][j + 1]))
    mesh = bs.bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = bs.bpy.data.objects.new(name, mesh)
    bs.bpy.context.scene.collection.objects.link(o)
    for poly in mesh.polygons:
        poly.use_smooth = True
    if thickness:
        mod = o.modifiers.new('Solid', 'SOLIDIFY')
        mod.thickness = thickness
    return bb._finish(o, m, 0)


def seats(*spots, lift=0.0):
    return {'seats': [list(s) for s in spots], 'sitLift': lift}


def tiki_hut():
    straw = mat('#c9a35a', rough=0.95)
    straw2 = mat('#b08840', rough=0.95)
    bamboo = mat('#b8964a', rough=0.5)
    dark = mat('#5a3b1c', rough=0.7)
    deck = bb.wood('TikiDeck', (0.2, 0.09, 0.035), (0.36, 0.17, 0.07))
    box('Deck', -1.05, 1.05, -0.95, 0.95, 0, 0.08, deck, bevel=0.01)
    box('Seat', -0.92, 0.92, 0.22, 0.72, 0.08, 0.42, mat('#d8b878', rough=0.9), bevel=0.04)
    for i in range(13):
        x = -0.9 + i * 0.15
        cylinder(f'BackBamboo{i}', x, 0.78, 0.08, 1.0 + 0.04 * (i % 2), 0.05, bamboo, verts=12)
        cylinder(f'BackKnot{i}', x, 0.78, 0.62, 0.64, 0.055, dark, verts=12)
    # A slanted thatch awning over the bench, on bamboo poles: tall at the
    # back, shorter at the front.
    for x in (-1.0, 1.0):
        cylinder(f'BackPost{x}', x, 0.88, 0.08, 2.5, 0.05, bamboo, verts=12)
        cylinder(f'Post{x}', x, 0.0, 0.08, 2.15, 0.05, bamboo, verts=12)
    roof = box('CanopyRoof', -1.15, 1.15, -0.2, 1.1, -0.05, 0.05, straw, bevel=0.03)
    roof.location = (0, 0.45, 2.32)
    roof.rotation_euler = (math.radians(20), 0, 0)
    fringe = box('CanopyFringe', -1.15, 1.15, -0.04, 0.04, -0.12, 0.0, straw2, bevel=0.02)
    fringe.location = (0, -0.18, 2.1)
    # A square tiki table with a flaming volcano bowl.
    box('TableBase', -0.12, 0.12, -0.42, -0.18, 0.08, 0.4, dark, bevel=0.02)
    box('Table', -0.38, 0.38, -0.55, -0.05, 0.4, 0.46, deck, bevel=0.015)
    cone('Volcano', 0, -0.3, 0.46, 0.62, 0.12, 0.05, mat('#6b4423', rough=0.8), verts=20)
    cylinder('Lava', 0, -0.3, 0.62, 0.64, 0.05, neon('Lava', (1.0, 0.35, 0.05), 4), verts=16)
    for x in (-1.0, 1.0):
        cone(f'TorchCup{x}', x, 0.0, 2.15, 2.25, 0.05, 0.08, dark, verts=12)
        cone(f'Flame{x}', x, 0.0, 2.25, 2.42, 0.07, 0.0, neon('TorchFire', (1.0, 0.4, 0.05), 4), verts=10)
    return seats((-0.55, 0.45), (0, 0.45), (0.55, 0.45))


def igloo_booth():
    ice = principled('IglooIce', srgb('#8cc8f0'), rough=0.25, transmission=0.25, ior=1.31,
                     emission=srgb('#3a8ad8'), emission_strength=0.25)
    ice2 = principled('IglooIce2', srgb('#a8d8f8'), rough=0.25, transmission=0.25, ior=1.31,
                      emission=srgb('#4a9ae8'), emission_strength=0.25)
    cylinder('SnowFloor', 0, 0, 0, 0.06, 1.08, mat('#e4eef8', rough=0.6), verts=48)
    # The dome, open at the front, in courses of ice blocks.
    rows, R, H = 7, 1.02, 1.55
    for r in range(rows):
        t0, t1 = r / rows * (math.pi / 2), (r + 1) / rows * (math.pi / 2)
        z0, z1 = 0.06 + H * math.sin(t0), 0.06 + H * math.sin(t1)
        rad = R * math.cos((t0 + t1) / 2)
        a0, a1 = (-20, 200) if r < rows - 2 else (-90, 270)
        n = 6
        for k in range(n):
            b0 = a0 + (a1 - a0) * (k + (0.5 if r % 2 else 0)) / n
            b1 = min(a1, b0 + (a1 - a0) / n)
            arc_block(f'BackIce{r}_{k}', 0, 0, max(0.05, rad - 0.13), rad, b0 + 1, b1 - 1, z0 + 0.01, z1 - 0.01, ice if (r + k) % 2 else ice2, bevel=0.015)
    arc_block('Seat', 0, 0, 0.35, 0.82, 15, 165, 0.06, 0.42, principled('IglooFur', srgb('#dfe6ee'), rough=0.95), bevel=0.04)
    cylinder('Table', 0, -0.25, 0.06, 0.44, 0.2, principled('IceTop', (0.7, 0.88, 1.0), rough=0.05, transmission=0.6,
             emission=(0.4, 0.7, 1.0), emission_strength=0.8), verts=24)
    drinks_at = [(-0.07, -0.25), (0.08, -0.2)]
    for i, (x, y) in enumerate(drinks_at):
        cone(f'Glass{i}', x, y, 0.44, 0.56, 0.03, 0.045, mat('#7fe0ff', rough=0.1, glow=0.6, alpha=0.85), verts=12)
    return seats((-0.42, 0.42), (0, 0.6), (0.42, 0.42))


def glow_lounge():
    """Two glossy benches facing each other across a table with glowing cup rings."""
    blue = principled('LoungeBlue', srgb('#2a9ad8'), rough=0.12)
    blue_light = principled('LoungeBlueLight', srgb('#5ec4f4'), rough=0.1)
    chrome = mat('#d8e2ec', rough=0.15)
    cyan = neon('LoungeGlow', (0.2, 0.85, 1.0), 3.5)
    box('Base', -1.05, 1.05, -1.0, 1.0, 0, 0.1, chrome, bevel=0.02)
    box('BaseGlow', -1.06, 1.06, -1.01, 1.01, 0.03, 0.06, cyan, bevel=0)
    box('Tub', -1.0, 1.0, -0.95, 0.95, 0.1, 0.36, blue, bevel=0.06)
    for x in (-1.0, 0.88):
        box(f'Side{x}', x, x + 0.12, -0.95, 0.95, 0.36, 0.56, blue, bevel=0.05)
    for row, (y0, y1, by, rot) in enumerate([(0.38, 0.82, 0.86, 0), (-0.82, -0.38, -0.86, 180)]):
        box(f'Seat{row}', -0.88, 0.88, y0, y1, 0.36, 0.44, blue_light, bevel=0.05)
        for k, x in enumerate((-0.63, -0.21, 0.21, 0.63)):
            sphere(f'BackShell{row}{k}', x, by, 0.72, 1.0, blue_light if k % 2 else blue, scale=(0.21, 0.09, 0.32), segments=24)
    box('Table', -0.6, 0.6, -0.24, 0.24, 0.36, 0.52, blue_light, bevel=0.05)
    for i, x in enumerate((-0.3, 0.0, 0.3)):
        torus(f'CupRing{i}', x, 0, 0.53, 0.085, 0.028, cyan)
        cylinder(f'Cup{i}', x, 0, 0.52, 0.6, 0.05, mat(['#ff4dcf', '#ffe36f', '#7dff9a'][i], rough=0.1, glow=0.6, alpha=0.85), verts=14)
    return seats((-0.42, 0.6, 0), (0.42, 0.6, 0), (-0.42, -0.6, 180), (0.42, -0.6, 180))


def wood_lounge():
    """3 x 2: a wood-walled booth, dark leather seats and two candle tables.
    Units side by side line up into one long booth."""
    wood = bb.wood('LoungeWood', (0.2, 0.09, 0.035), (0.34, 0.16, 0.065))
    leather = principled('LoungeLeather', srgb('#26343c'), rough=0.3)
    leather2 = principled('LoungeLeather2', srgb('#2f404a'), rough=0.3)
    stud = mat('#c9ccd6', rough=0.3)
    box('Floor', -1.1, 1.1, -0.72, 0.72, 0, 0.05, mat('#3a3e46', rough=0.4), bevel=0.005)
    box('Wall', -1.1, 1.1, -0.74, -0.62, 0, 0.42, wood, bevel=0.01)
    for i in range(12):
        sphere(f'Stud{i}', -1.02 + i * 0.185, -0.745, 0.38, 0.012, stud, segments=6)
    box('BackWall', -1.1, 1.1, 0.64, 0.72, 0, 0.92, wood, bevel=0.01)
    box('Seat', -1.08, 1.08, 0.18, 0.64, 0.05, 0.4, leather, bevel=0.04)
    for k, x in enumerate((-0.82, -0.28, 0.28, 0.82)):
        box(f'BackCushion{k}', x - 0.26, x + 0.26, 0.46, 0.64, 0.4, 0.86, leather2 if k % 2 else leather, bevel=0.1)
    for i, x in enumerate((-0.5, 0.5)):
        cylinder(f'TableLeg{i}', x, -0.25, 0.05, 0.4, 0.03, mat('#2a1a10'), verts=10)
        box(f'Table{i}', x - 0.2, x + 0.2, -0.45, -0.05, 0.4, 0.46, wood, bevel=0.012)
        candle(f'Candle{i}', x, -0.25, 0.46)
    return seats((-0.5, 0.4), (0.5, 0.4))


def tulip_lounge():
    """White shell chairs round a lime pedestal table, facing each other."""
    white = principled('ShellWhite', srgb('#f6f6f8'), rough=0.2)
    lime = principled('Lime', srgb('#c8e83a'), rough=0.25, emission=srgb('#a8d020'), emission_strength=0.15)
    cylinder('TableFoot', 0, 0, 0, 0.04, 0.3, white, verts=32)
    cone('TableStem', 0, 0, 0.04, 0.46, 0.14, 0.05, white, verts=24)
    cylinder('Table', 0, 0, 0.46, 0.53, 0.46, lime, verts=40)
    for i, (x, y) in enumerate([(-0.1, 0.08), (0.12, -0.06)]):
        cone(f'Glass{i}', x, y, 0.53, 0.65, 0.03, 0.045, mat('#ffffff', rough=0.05, glow=0.3, alpha=0.7), verts=12)
    out = []
    for i, (deg, rot) in enumerate([(90, 0), (270, 180), (180, 90), (0, 270)]):
        a = math.radians(deg)
        cx, cy = 0.86 * math.cos(a), 0.86 * math.sin(a)
        cylinder(f'ChairFoot{i}', cx, cy, 0, 0.03, 0.19, white, verts=24)
        cylinder(f'ChairStem{i}', cx, cy, 0.03, 0.28, 0.035, white, verts=12)
        cylinder(f'Seat{i}', cx, cy, 0.28, 0.4, 0.26, white, verts=32)
        cylinder(f'Cushion{i}', cx, cy, 0.4, 0.44, 0.23, lime, verts=32)
        # The shell back, round the far side of the seat from the table.
        arc_block(f'BackShell{i}', cx, cy, 0.21, 0.27, deg - 62, deg + 62, 0.32, 0.76, white, bevel=0.03)
        out.append((round(cx * 0.95, 3), round(cy * 0.95, 3), rot))
    return seats(*out)


def birdcage_booth():
    gold = mat('#e8b84a', rough=0.25, glow=0.15)
    pink = principled('CagePink', srgb('#e0558f'), rough=0.85)
    cylinder('Platform', 0, 0, 0, 0.12, 1.0, mat('#2a1a22'), verts=48)
    torus('PlatformRim', 0, 0, 0.12, 0.98, 0.025, gold)
    arc_block('Seat', 0, 0, 0.25, 0.72, 25, 155, 0.12, 0.44, pink, bevel=0.04)
    arc_block('BackRest', 0, 0, 0.62, 0.76, 15, 165, 0.44, 0.95, principled('CagePinkBack', srgb('#b83a70'), rough=0.85), bevel=0.03)
    n = 22
    for i in range(n):
        a = math.radians(i * 360 / n + 8)
        x, y = 0.95 * math.cos(a), 0.95 * math.sin(a)
        if -0.35 < x < 0.35 and y < 0:
            continue  # the cage's open door
        tube(f'{"BackBar" if y > -0.1 else "Bar"}{i}', (x, y, 0.12), (x, y, 1.75), 0.011, gold)
        tube(f'CanopyDome{i}', (x, y, 1.75), (0, 0, 2.3), 0.011, gold)
    torus('CanopyRing', 0, 0, 1.75, 0.95, 0.018, gold)
    sphere('CanopyFinial', 0, 0, 2.33, 0.05, gold)
    torus('CanopyHook', 0, 0, 2.45, 0.07, 0.012, gold, rot=(90, 0, 0))
    cylinder('TableStem', 0, -0.28, 0.12, 0.5, 0.025, gold, verts=12)
    cylinder('Table', 0, -0.28, 0.5, 0.54, 0.2, mat('#fbeff4', rough=0.2), verts=32)
    candle('Candle', 0.0, -0.28, 0.54)
    return seats((-0.3, 0.38), (0.3, 0.38))


def disco_stage():
    silver = mat('#cfd4de', rough=0.15)
    pink = neon('StageRim', (1.0, 0.25, 0.75), 3.5)
    cylinder('Stage', 0, 0, 0, 0.12, 1.05, mat('#24222a', rough=0.2), verts=48)
    torus('StageRim', 0, 0, 0.1, 1.04, 0.02, pink)
    cylinder('StageTop', 0, 0, 0.12, 0.2, 0.92, mat('#d8dce6', rough=0.08, glow=0.15), verts=48)
    box('Seat', -0.82, 0.82, 0.12, 0.6, 0.2, 0.46, mat('#b8bfcc', rough=0.2, glow=0.05), bevel=0.05)
    for k, x in enumerate((-0.55, 0.0, 0.55)):
        box(f'BackCushion{k}', x - 0.26, x + 0.26, 0.5, 0.68, 0.46, 0.98, mat('#e8ecf4', rough=0.1, glow=0.15), bevel=0.08)
    for x in (-0.92, 0.92):
        box(f'Arm{x}', x - 0.1, x + 0.1, 0.12, 0.7, 0.2, 0.62, silver, bevel=0.05)
        cylinder(f'BackPillar{x}', x, 0.72, 0.2, 2.1, 0.05, silver, verts=16)
    tube('CanopyBeam', (-0.92, 0.72, 2.1), (0.92, 0.72, 2.1), 0.045, silver)
    tube('CanopyChain', (0, 0.72, 2.1), (0, 0.3, 1.9), 0.008, silver)
    ball = sphere('CanopyBall', 0, 0.3, 1.78, 0.14, mat('#e8ecf4', rough=0.1, glow=0.7), segments=12)
    cylinder('TableStem', 0, -0.4, 0.2, 0.55, 0.025, silver, verts=12)
    cylinder('Table', 0, -0.4, 0.55, 0.59, 0.22, mat('#1a1c22', rough=0.05), verts=32)
    for i, (x, c) in enumerate([(-0.07, '#ff4d8d'), (0.08, '#3de0ff')]):
        cone(f'Glass{i}', x, -0.4, 0.59, 0.71, 0.03, 0.045, mat(c, rough=0.1, glow=0.6, alpha=0.85), verts=12)
    return seats((-0.55, 0.35), (0, 0.35), (0.55, 0.35))


def throne_booth():
    gold = mat('#f0c24a', rough=0.2, glow=0.2)
    purple = principled('ThronePurple', srgb('#5a1d8a'), rough=0.85)
    red = principled('Carpet', srgb('#a0102a'), rough=0.95)
    box('Dais', -1.05, 1.05, -0.55, 0.95, 0, 0.16, red, bevel=0.02)
    box('DaisTrim', -1.06, 1.06, -0.56, -0.53, 0.12, 0.16, gold, bevel=0)
    box('Step', -0.5, 0.5, -0.95, -0.55, 0, 0.08, red, bevel=0.02)
    for i, x in enumerate((-0.52, 0.52)):
        box(f'SeatFrame{i}', x - 0.32, x + 0.32, 0.05, 0.62, 0.16, 0.42, gold, bevel=0.03)
        box(f'Seat{i}', x - 0.28, x + 0.28, 0.08, 0.58, 0.42, 0.5, purple, bevel=0.04)
        box(f'BackFrame{i}', x - 0.34, x + 0.34, 0.6, 0.74, 0.42, 1.5, gold, bevel=0.04)
        box(f'BackPanel{i}', x - 0.27, x + 0.27, 0.56, 0.62, 0.5, 1.4, purple, bevel=0.03)
        for k, dx in enumerate((-0.24, 0, 0.24)):
            cone(f'BackSpike{i}{k}', x + dx, 0.67, 1.5, 1.68 if k == 1 else 1.6, 0.05, 0.0, gold, verts=12)
            sphere(f'BackJewel{i}{k}', x + dx, 0.67, 1.7 if k == 1 else 1.62, 0.028, neon(f'Jewel{k}', [(1, 0.1, 0.3), (0.2, 0.6, 1), (0.3, 1, 0.5)][k], 4), segments=8)
        for side in (-1, 1):
            box(f'Arm{i}{side}', x + side * 0.32 - 0.05, x + side * 0.32 + 0.05, 0.05, 0.62, 0.42, 0.68, gold, bevel=0.02)
    cylinder('TableStem', 0, 0.3, 0.16, 0.6, 0.03, gold, verts=12)
    cylinder('Table', 0, 0.3, 0.6, 0.64, 0.14, gold, verts=24)
    cone('Goblet', 0, 0.3, 0.64, 0.76, 0.02, 0.05, gold, verts=16)
    return seats((-0.52, 0.3), (0.52, 0.3))


def seashell_booth():
    coral = principled('ShellCoral', srgb('#f6b7a6'), rough=0.4)
    pearl = principled('ShellPearl', srgb('#fff4ec'), rough=0.2, emission=srgb('#ffe6f0'), emission_strength=0.15)
    sphere('LowerShell', 0, 0.05, 0.2, 1.0, coral, scale=(1.0, 0.72, 0.24), segments=40)
    box('Seat', -0.8, 0.8, -0.35, 0.45, 0.3, 0.44, principled('ShellSeat', srgb('#7fd6cf'), rough=0.85), bevel=0.08)
    # The upper shell stands up behind: ribs fanning out from the hinge.
    n = 13
    for k in range(n):
        a = math.radians(8 + k * (164 / (n - 1)))
        tube(f'BackRib{k}', (0, 0.62, 0.35), (1.0 * math.cos(a), 0.62 + 0.08 * math.sin(a), 0.35 + 1.1 * math.sin(a)), 0.09,
             pearl if k % 2 else coral, verts=16)
    sphere('BackHinge', 0, 0.62, 0.35, 0.14, coral, segments=16)
    cylinder('PearlStand', 0, -0.62, 0, 0.3, 0.05, coral, verts=16)
    sphere('Pearl', 0, -0.62, 0.42, 0.12, mat('#ffffff', rough=0.1, glow=0.5))
    return seats((-0.4, 0.1), (0.4, 0.1))


def galaxy_pods():
    navy = principled('PodNavy', srgb('#1a1f5a'), rough=0.5)
    shell = principled('PodShell', srgb('#e8ecff'), rough=0.15)
    silver = mat('#c0c6d8', rough=0.2)
    cylinder('Platform', 0, 0, 0, 0.1, 1.05, mat('#0d0f24', rough=0.1), verts=48)
    torus('PlatformGlow', 0, 0, 0.08, 1.04, 0.02, neon('PodGlow', (0.45, 0.35, 1.0), 4))
    import random
    rnd = random.Random(5)
    star = neon('Star', (0.9, 0.92, 1.0), 5)
    for i in range(30):
        a, r = rnd.uniform(0, 6.28), rnd.uniform(0.1, 0.95)
        sphere(f'FloorStar{i}', r * math.cos(a), r * math.sin(a), 0.1, 0.012, star, segments=6)
    out = []
    for p, px in enumerate((-0.52, 0.52)):
        py = 0.1
        # The egg: one smooth shell, open at the front, lined in navy.
        prof = [(0.06 + 0.42 * math.sin(math.pi * t) ** 0.8, 0.25 + 1.35 * t) for t in [k / 20 for k in range(21)]]
        lathe(f'BackEgg{p}', px, py, prof, -35, 215, shell, thickness=0.035)
        lathe(f'BackLining{p}', px, py, [(max(0.02, r - 0.04), z) for r, z in prof[1:-1]], -32, 212, navy)
        cylinder(f'Seat{p}', px, py - 0.05, 0.38, 0.46, 0.3, principled('PodCushion', srgb('#7a5aff'), rough=0.85), verts=24)
        tube(f'CanopyStand{p}a', (px, 0.85, 0.1), (px, 0.85, 1.85), 0.03, silver)
        tube(f'CanopyStand{p}b', (px, 0.85, 1.85), (px, py, 1.85), 0.03, silver)
        tube(f'CanopyStand{p}c', (px, py, 1.85), (px, py, 1.6), 0.015, silver)
        out.append((px, py - 0.05))
    return seats(*out)


def donut_lounge():
    dough = principled('Dough', srgb('#d89a50'), rough=0.6)
    icing = principled('Icing', srgb('#ff8ec0'), rough=0.3)
    torus('Donut', 0, 0.05, 0.28, 0.62, 0.28, dough)
    torus('Frosting', 0, 0.05, 0.36, 0.62, 0.26, icing, scale=(1, 1, 0.7))
    import random
    rnd = random.Random(9)
    cols = [mat(c, rough=0.3, glow=0.2) for c in ('#ffffff', '#5ad8ff', '#ffe36f', '#7dff9a', '#c07dff')]
    for i in range(40):
        a = rnd.uniform(0, 6.28)
        r = 0.62 + rnd.uniform(-0.18, 0.18)
        o = cylinder(f'Sprinkle{i}', r * math.cos(a), 0.05 + r * math.sin(a), 0.535, 0.545, 0.012, cols[i % 5], verts=6)
        o.scale = (3, 1, 1)
        o.rotation_euler = (0, 0, rnd.uniform(0, 3.14))
    stripes = [mat('#ff4d8d', rough=0.3), mat('#ffffff', rough=0.3)]
    for i, (x, h, c) in enumerate([(-0.72, 1.6, '#ff4d8d'), (0.75, 1.35, '#5ad8ff')]):
        cylinder(f'BackStick{i}', x, 0.8, 0, h, 0.025, mat('#ffffff', rough=0.4), verts=10)
        o = cylinder(f'BackLolly{i}', 0, 0, -0.04, 0.04, 0.3, mat(c, rough=0.25, glow=0.2), verts=32)
        o.rotation_euler = (math.radians(90), 0, 0)
        o.location = (x, 0.8, h + 0.25)
        t = torus(f'BackSwirl{i}', x, 0.755, h + 0.25, 0.17, 0.03, mat('#ffffff', rough=0.3), rot=(90, 0, 0))
    return seats((-0.42, -0.4), (0, -0.55), (0.42, -0.4))


def garden_gazebo():
    white = mat('#f6f4ee', rough=0.5)
    mint = mat('#9fd8b8', rough=0.6)
    cylinder('Floor', 0, 0, 0, 0.1, 1.08, white, verts=6)
    for i in range(6):
        a = math.radians(i * 60 + 30)
        x, y = 1.0 * math.cos(a), 1.0 * math.sin(a)
        cylinder(f'{"BackPost" if y > 0 else "Post"}{i}', x, y, 0.1, 2.55, 0.04, white, verts=12)
    cone('CanopyRoof', 0, 0, 2.5, 3.15, 1.28, 0.03, mint, verts=6)
    cone('CanopyEave', 0, 0, 2.45, 2.53, 1.3, 1.25, white, verts=6)
    sphere('CanopyFinial', 0, 0, 3.2, 0.06, white)
    box('Seat', -0.8, 0.8, 0.22, 0.7, 0.1, 0.44, principled('GazeboCushion', srgb('#f2ead6'), rough=0.85), bevel=0.05)
    for k in range(7):
        x = -0.75 + k * 0.25
        o = box(f'BackLattice{k}a', -0.015, 0.015, -0.015, 0.015, -0.35, 0.35, white, bevel=0)
        o.location = (x, 0.74, 0.75)
        o.rotation_euler = (0, math.radians(35), 0)
        o = box(f'BackLattice{k}b', -0.015, 0.015, -0.015, 0.015, -0.35, 0.35, white, bevel=0)
        o.location = (x, 0.74, 0.75)
        o.rotation_euler = (0, math.radians(-35), 0)
    box('BackTop', -0.82, 0.82, 0.71, 0.77, 1.02, 1.06, white, bevel=0.01)
    leaf = principled('Hedge', srgb('#3f8a3a'), rough=0.95)
    flowers = [mat('#ff5a8a', glow=0.2), mat('#fff06a', glow=0.2), mat('#c07dff', glow=0.2)]
    for side in (-1, 1):
        box(f'Planter{side}', side * 0.78 - 0.18, side * 0.78 + 0.18, -0.7, -0.35, 0.1, 0.35, white, bevel=0.02)
        for j in range(5):
            sphere(f'Bush{side}{j}', side * 0.78 + (j % 3 - 1) * 0.1, -0.52 + (j // 3) * 0.1, 0.42, 0.11, leaf, segments=10)
            sphere(f'Flower{side}{j}', side * 0.78 + (j % 3 - 1) * 0.11, -0.55 + (j // 3) * 0.1, 0.53, 0.03, flowers[j % 3], segments=8)
    cylinder('TableStem', 0, -0.3, 0.1, 0.5, 0.025, white, verts=12)
    cylinder('Table', 0, -0.3, 0.5, 0.54, 0.22, white, verts=32)
    return seats((-0.5, 0.45), (0, 0.45), (0.5, 0.45))


def fire_sectional():
    stone = principled('PitStone', srgb('#8a8580'), rough=0.9)
    cushion = principled('PitCushion', srgb('#d07a3a'), rough=0.85)
    frame = principled('SectionalFrame', srgb('#3a3632'), rough=0.6)
    back = principled('SectionalBack', srgb('#b86830'), rough=0.85)
    # An L: a long sofa along the back and another down the left side.
    box('FrameBack', -1.05, 1.0, 0.4, 1.0, 0, 0.3, frame, bevel=0.03)
    box('FrameLeft', -1.05, -0.45, -1.0, 0.4, 0, 0.3, frame, bevel=0.03)
    box('SeatBack', -1.0, 0.95, 0.42, 0.85, 0.3, 0.42, cushion, bevel=0.05)
    box('SeatLeft', -1.0, -0.5, -0.95, 0.42, 0.3, 0.42, cushion, bevel=0.05)
    box('BackRestBack', -1.05, 1.0, 0.84, 1.0, 0.3, 0.85, back, bevel=0.05)
    box('BackRestLeft', -1.05, -0.88, -1.0, 0.84, 0.3, 0.85, back, bevel=0.05)
    box('ArmRight', 0.88, 1.0, 0.4, 1.0, 0.3, 0.6, frame, bevel=0.03)
    box('ArmFront', -1.05, -0.45, -1.0, -0.88, 0.3, 0.6, frame, bevel=0.03)
    # A square fire table.
    box('FireTable', -0.25, 0.85, -0.85, 0.15, 0, 0.36, stone, bevel=0.03)
    box('FireBed', -0.05, 0.65, -0.65, -0.05, 0.36, 0.38, neon('Embers', (0.9, 0.2, 0.02), 2.5), bevel=0)
    fire = neon('Fire', (1.0, 0.4, 0.05), 3.5)
    tip = neon('FireTip', (1.0, 0.75, 0.2), 4)
    for i, (x, y, h) in enumerate([(0.3, -0.35, 0.75), (0.1, -0.25, 0.6), (0.5, -0.45, 0.62), (0.2, -0.5, 0.55), (0.45, -0.2, 0.58)]):
        cone(f'Flame{i}', x, y, 0.38, h, 0.07, 0.0, fire, verts=12)
        cone(f'FlameTip{i}', x, y, 0.4, h * 0.85, 0.035, 0.0, tip, verts=10)
    return seats((-0.3, 0.62, 0), (0.45, 0.62, 0), (-0.75, -0.05, 90), (-0.75, -0.6, 90))


def cloud_bed():
    cloud = principled('Cloud', srgb('#ffffff'), rough=0.9, emission=srgb('#eaf2ff'), emission_strength=0.15)
    cylinder('BedBase', 0, 0, 0, 0.14, 1.02, mat('#bfe0ff', rough=0.4, glow=0.2), verts=48)
    cylinder('Mattress', 0, 0, 0.14, 0.42, 0.98, principled('CloudSheet', srgb('#f4f8ff'), rough=0.9), verts=48)
    torus('MattressEdge', 0, 0, 0.42, 0.95, 0.04, principled('CloudPiping', srgb('#d8e8ff'), rough=0.8))
    import random
    rnd = random.Random(11)
    for i in range(11):
        a = math.radians(-10 + i * 20)
        x, y = 0.95 * math.cos(a), 0.95 * math.sin(a)
        for j, z in enumerate((0.6, 0.85)):
            sphere(f'BackPuff{i}_{j}', x, y, z + rnd.uniform(-0.03, 0.03), 0.2 - 0.04 * j, cloud, segments=14)
    for i in range(6):
        a = math.radians(30 + i * 24)
        sphere(f'BackPuffTop{i}', 0.9 * math.cos(a), 0.9 * math.sin(a), 1.05 + rnd.uniform(-0.02, 0.05), 0.14, cloud, segments=14)
    for i, (x, c) in enumerate([(-0.4, '#ffc8e0'), (0, '#c8e0ff'), (0.4, '#fff0b0')]):
        sphere(f'BackPillow{i}', x, 0.55, 0.52, 1.0, principled(f'Pillow{i}', srgb(c), rough=0.9), scale=(0.2, 0.08, 0.12), segments=16)
    star = mat('#ffd84a', rough=0.3, glow=0.8)
    for i in range(4):
        a = math.radians(-60 + i * 40)
        sphere(f'Star{i}', 0.95 * math.cos(a), 0.95 * math.sin(a), 0.16, 0.025, star, segments=8)
    return seats((-0.45, -0.4), (0, -0.55), (0.45, -0.4))


# --------------------------------------------------------------------------
# Sofas (3 x 1): two seats at x = +-0.42, facing -Y.
# --------------------------------------------------------------------------

SOFA = {'seats': [[-0.42, -0.05], [0.42, -0.05]], 'sitLift': 0.0}


def kiss_sofa():
    red = principled('LipRed', srgb('#d4103a'), rough=0.2)
    box('Plinth', -0.9, 0.9, -0.36, 0.3, 0, 0.08, mat('#1a0a10'), bevel=0.02)
    sphere('Seat', 0, -0.05, 0.27, 1.0, red, scale=(0.95, 0.36, 0.2), segments=32)
    for side in (-1, 1):
        o = sphere(f'BackLip{side}', side * 0.42, 0.18, 0.62, 1.0, red, scale=(0.52, 0.2, 0.3), segments=32)
        o.rotation_euler = (0, math.radians(-14 * side), 0)
    sphere('BackLipMid', 0, 0.2, 0.52, 1.0, red, scale=(0.2, 0.17, 0.12), segments=20)
    sphere('Shine', -0.4, -0.25, 0.4, 1.0, mat('#ff8aa0', rough=0.1, glow=0.3), scale=(0.18, 0.04, 0.03), segments=12)
    return SOFA


def bathtub_sofa():
    white = principled('TubWhite', srgb('#f6f4f0'), rough=0.2)
    gold = mat('#e2b23a', rough=0.25, glow=0.15)
    pink = principled('TubCushion', srgb('#ff8fb8'), rough=0.85)
    # The tub, cut open along the front.
    box('Tub', -0.92, 0.92, -0.38, 0.38, 0.14, 0.34, white, bevel=0.1)
    box('BackTubWall', -0.92, 0.92, 0.22, 0.38, 0.34, 0.8, white, bevel=0.07)
    for x in (-0.92, 0.8):
        box(f'TubEnd{x}', x, x + 0.12, -0.38, 0.38, 0.34, 0.68, white, bevel=0.06)
    for i, x in enumerate((-0.42, 0.42)):
        box(f'Seat{i}', x - 0.38, x + 0.38, -0.36, 0.2, 0.34, 0.44, pink, bevel=0.05)
        box(f'BackCushion{i}', x - 0.38, x + 0.38, 0.1, 0.22, 0.42, 0.74, pink, bevel=0.06)
    for x in (-0.8, 0.8):
        for y in (-0.28, 0.28):
            sphere(f'Foot{x}{y}', x, y, 0.08, 0.07, gold, scale=(1, 1, 1.2), segments=12)
    cylinder('BackFaucet', 0.86, 0.3, 0.8, 1.0, 0.025, gold, verts=12)
    sphere('BackFaucetHead', 0.86, 0.22, 1.0, 0.045, gold, scale=(1, 2, 0.8), segments=12)
    for i in range(6):
        sphere(f'Bubble{i}', -0.75 + i * 0.3, -0.38, 0.38 + 0.05 * (i % 2), 0.05, mat('#e8f6ff', rough=0.1, glow=0.3, alpha=0.8), segments=10)
    return SOFA


def cruiser_sofa():
    red = principled('CarRed', srgb('#c8142c'), rough=0.25)
    chrome = mat('#e2e6ee', rough=0.15)
    cream = principled('CarCream', srgb('#f4ead6'), rough=0.6)
    box('Body', -0.95, 0.95, -0.4, 0.38, 0.08, 0.34, red, bevel=0.08)
    box('Bumper', -0.97, 0.97, -0.45, -0.38, 0.1, 0.18, chrome, bevel=0.03)
    for i, x in enumerate((-0.42, 0.42)):
        box(f'Seat{i}', x - 0.38, x + 0.38, -0.36, 0.18, 0.34, 0.44, cream, bevel=0.05)
        box(f'BackCushion{i}', x - 0.38, x + 0.38, 0.14, 0.27, 0.44, 0.8, cream, bevel=0.07)
        for k in range(3):
            box(f'BackPiping{i}{k}', x - 0.2 + k * 0.2 - 0.008, x - 0.2 + k * 0.2 + 0.008, 0.135, 0.14, 0.48, 0.76, mat('#d8c8a8'), bevel=0)
    box('BackBody', -0.95, 0.95, 0.27, 0.4, 0.34, 0.9, red, bevel=0.08)
    box('BackChrome', -0.95, 0.95, 0.27, 0.41, 0.9, 0.93, chrome, bevel=0.01)
    for side in (-1, 1):
        box(f'Fender{side}', side * 0.95 - 0.1, side * 0.95 + 0.1, -0.42, 0.4, 0.08, 0.56, red, bevel=0.08)
        cone(f'BackFin{side}', side * 0.9, 0.34, 0.56, 1.0, 0.07, 0.01, red, verts=12)
        sphere(f'Headlight{side}', side * 0.9, -0.43, 0.38, 0.07, neon('Headlight', (1.0, 0.95, 0.7), 6), segments=14)
        torus(f'HeadRing{side}', side * 0.9, -0.43, 0.38, 0.07, 0.012, chrome, rot=(90, 0, 0))
        o = cylinder(f'Tyre{side}', side * 0.98, -0.18, 0.0, 0.08, 0.16, mat('#141414', rough=0.7), verts=24)
        o.rotation_euler = (0, math.radians(90), 0)
        o.location = (side * 0.98, -0.18, 0.16)
    box('Grille', -0.3, 0.3, -0.42, -0.4, 0.2, 0.3, chrome, bevel=0.01)
    return SOFA


def deco_sofa():
    emerald = principled('Emerald', srgb('#0f6a4a'), rough=0.85)
    emerald_dark = principled('EmeraldDark', srgb('#0a5038'), rough=0.85)
    brass = mat('#d8a840', rough=0.25, glow=0.1)
    for x in (-0.84, 0.84):
        for y in (-0.34, 0.3):
            cone(f'Leg{x}{y}', x, y, 0, 0.1, 0.02, 0.035, brass, verts=10)
    box('Base', -0.92, 0.92, -0.4, 0.38, 0.1, 0.3, emerald_dark, bevel=0.06)
    box('BaseTrim', -0.93, 0.93, -0.41, -0.39, 0.12, 0.15, brass, bevel=0)
    for i, x in enumerate((-0.42, 0.42)):
        box(f'Seat{i}', x - 0.4, x + 0.4, -0.42, 0.18, 0.3, 0.44, emerald, bevel=0.06)
    for k in range(10):
        x = -0.83 + k * 0.184
        cylinder(f'BackChannel{k}', x, 0.3, 0.42, 0.92, 0.088, emerald, verts=20)
        sphere(f'BackChannelTop{k}', x, 0.3, 0.92, 0.088, emerald, segments=16)
    for x in (-0.93, 0.83):
        box(f'Arm{x}', x, x + 0.1, -0.42, 0.4, 0.3, 0.58, emerald_dark, bevel=0.05)
        box(f'ArmCap{x}', x - 0.005, x + 0.105, -0.42, 0.4, 0.58, 0.6, brass, bevel=0)
    return SOFA


def chesterfield():
    leather = principled('Chester', srgb('#6a3418'), rough=0.35)
    leather2 = principled('ChesterLight', srgb('#7e4220'), rough=0.35)
    button = mat('#3a1a0a', rough=0.4)
    for x in (-0.86, 0.86):
        for y in (-0.34, 0.3):
            sphere(f'Leg{x}{y}', x, y, 0.04, 0.045, mat('#2a1408', rough=0.5), segments=10)
    box('Base', -0.94, 0.94, -0.4, 0.38, 0.08, 0.3, leather, bevel=0.05)
    for i, x in enumerate((-0.42, 0.42)):
        box(f'Seat{i}', x - 0.4, x + 0.4, -0.42, 0.2, 0.3, 0.42, leather2, bevel=0.06)
    box('BackRest', -0.94, 0.94, 0.2, 0.4, 0.3, 0.8, leather, bevel=0.06)
    for row, z in enumerate((0.48, 0.6, 0.72)):
        for k in range(9):
            x = -0.8 + k * 0.2 + (0.1 if row % 2 else 0)
            if x > 0.82:
                continue
            sphere(f'BackTuft{row}{k}', x, 0.195, z, 0.018, button, segments=8)
    for side in (-1, 1):
        box(f'Arm{side}', side * 0.94 - 0.11, side * 0.94 + 0.05 if side < 0 else side * 0.94 + 0.11, -0.42, 0.4, 0.3, 0.66, leather, bevel=0.05)
        roll = cylinder(f'ArmRollReal{side}', 0, 0, -0.42, 0.42, 0.1, leather2, verts=20)
        roll.rotation_euler = (math.radians(90), 0, 0)
        roll.location = (side * 0.9, -0.01, 0.66)
    return SOFA


def beer_hall_bench():
    oak = bb.wood('BenchOak', (0.22, 0.1, 0.04), (0.4, 0.2, 0.08))
    iron = mat('#2a2a2e', rough=0.5)
    for side in (-1, 1):
        # Barrel ends.
        o = cylinder(f'Barrel{side}', 0, 0, -0.2, 0.2, 0.22, oak, verts=24)
        o.rotation_euler = (0, math.radians(90), 0)
        o.location = (side * 0.78, -0.08, 0.22)
        for dx in (-0.12, 0.12):
            h = cylinder(f'Hoop{side}{dx}', 0, 0, -0.012, 0.012, 0.225, iron, verts=24)
            h.rotation_euler = (0, math.radians(90), 0)
            h.location = (side * 0.78 + dx, -0.08, 0.22)
    for k in range(3):
        y = -0.36 + k * 0.18
        box(f'SeatPlank{k}', -0.94, 0.94, y, y + 0.16, 0.44, 0.5, oak, bevel=0.01)
    for k in range(3):
        z = 0.6 + k * 0.14
        box(f'BackPlank{k}', -0.94, 0.94, 0.26, 0.3, z, z + 0.11, oak, bevel=0.01)
    for x in (-0.6, 0.0, 0.6):
        box(f'BackPost{x}', x - 0.03, x + 0.03, 0.3, 0.34, 0.44, 1.02, oak, bevel=0.01)
    # A couple of steins on the barrel tops.
    for side in (-1, 1):
        cylinder(f'Stein{side}', side * 0.86, -0.3, 0.5, 0.62, 0.04, mat('#e8c060', rough=0.2, glow=0.2, alpha=0.9), verts=14)
        cylinder(f'Foam{side}', side * 0.86, -0.3, 0.62, 0.66, 0.042, mat('#fffaf0', rough=0.8), verts=14)
    return SOFA


def led_cube_bench():
    frost = lambda name, c: principled(name, srgb(c), rough=0.3, emission=srgb(c), emission_strength=0.7)
    colors = [frost('CubePink', '#ff3ea8'), frost('CubeCyan', '#2ad8ff'), frost('CubeLime', '#8aff4a'),
              frost('CubeViolet', '#a86aff'), frost('CubeOrange', '#ffa53a')]
    for i, x in enumerate((-0.62, -0.21, 0.21, 0.62)):
        box(f'Seat{i}', x - 0.19, x + 0.19, -0.36, 0.18, 0, 0.4, colors[i], bevel=0.03)
    box('BackPanel', -0.82, 0.82, 0.22, 0.3, 0.0, 0.86, mat('#1c1826', rough=0.15), bevel=0.03)
    for i in range(5):
        z = 0.12 + i * 0.16
        box(f'BackStripe{i}', -0.8, 0.8, 0.205, 0.215, z, z + 0.04, neon(f'Stripe{i}', srgb(['#ff3ea8', '#2ad8ff', '#8aff4a', '#a86aff', '#ffa53a'][i]), 3), bevel=0)
    return SOFA


def rattan_love_seat():
    rattan = principled('Rattan', srgb('#c89a5a'), rough=0.8)
    rattan_dark = principled('RattanDark', srgb('#a07840'), rough=0.8)
    cushion = principled('RattanCushion', srgb('#f4ece0'), rough=0.9)
    cone('Base', 0, 0, 0, 0.3, 0.42, 0.55, rattan_dark, verts=32)
    bs.bpy.context.active_object.scale = (1.7, 0.75, 1)
    box('Seat0', -0.85, 0.85, -0.38, 0.18, 0.3, 0.42, cushion, bevel=0.06)
    # The peacock back: a fan of woven slats rising highest in the middle.
    n = 17
    for k in range(n):
        t = (k - (n - 1) / 2) / ((n - 1) / 2)
        x = t * 0.88
        top = 1.55 - 0.6 * t * t
        box(f'BackSlat{k}', x - 0.045, x + 0.045, 0.22, 0.3, 0.3, top, rattan if k % 2 else rattan_dark, bevel=0.02)
    for row, z in enumerate((0.7, 1.0, 1.25)):
        box(f'BackWeave{row}', -0.9, 0.9, 0.205, 0.22, z, z + 0.04, rattan_dark, bevel=0.01)
    for i, x in enumerate((-0.42, 0.42)):
        box(f'BackPillow{i}', x - 0.25, x + 0.25, 0.08, 0.2, 0.42, 0.78, principled(f'Pillow{i}', srgb(['#3ab0a0', '#ff8a5a'][i]), rough=0.9), bevel=0.06)
    return SOFA


DESIGNS = {
    'tikiHut': tiki_hut,
    'iglooBooth': igloo_booth,
    'glowLounge': glow_lounge,
    'woodLounge': wood_lounge,
    'tulipLounge': tulip_lounge,
    'birdcageBooth': birdcage_booth,
    'discoStage': disco_stage,
    'throneBooth': throne_booth,
    'shellBooth': seashell_booth,
    'galaxyPods': galaxy_pods,
    'donutLounge': donut_lounge,
    'gardenGazebo': garden_gazebo,
    'fireSectional': fire_sectional,
    'cloudBed': cloud_bed,
    'kissSofa': kiss_sofa,
    'bathtubSofa': bathtub_sofa,
    'cruiserSofa': cruiser_sofa,
    'decoSofa': deco_sofa,
    'chesterfield': chesterfield,
    'beerBench': beer_hall_bench,
    'cubeBench': led_cube_bench,
    'rattanSeat': rattan_love_seat,
}
