"""Twenty more booths and sofas for Club Nova, built with build_seating.py's
helpers and rendered by it (build_seating.py merges DESIGNS into SEATING):
    python art/blender/build_seating.py --preview DIR tikiBooth
    python art/blender/build_seating.py tikiBooth ...

Round booths (3 x 3 tiles, like the velvet booth) seat three or four
around a table, open toward -Y. Sofas (3 x 1 tiles, like the couch) seat
two. Backrests are parts named Back* (see build_seating.layers_at()).
"""

import math

import build_seating as bs

bb = bs.bb
box, cylinder, cone, sphere, arc_block, candle, drinks = bs.box, bs.cylinder, bs.cone, bs.sphere, bs.arc_block, bs.candle, bs.drinks
principled, neon, plain, srgb = bs.principled, bs.neon, bs.plain, bs.srgb

A0, A1 = -25, 205  # the arc of a round booth (degrees, 90 = +Y)
CY = 0.05          # the arc's centre
THREE = (150, 90, 30)
FOUR = (160, 115, 65, 20)


def mat(hex_color, rough=0.5, glow=0.0, **kw):
    if glow:
        kw.update(emission=srgb(hex_color), emission_strength=glow)
    return principled(f'M{hex_color}{rough}{glow}', srgb(hex_color), rough=rough, **kw)


def on_arc(n, r, a0=A0 + 8, a1=A1 - 8):
    """n points spread along the booth's arc at radius r: (x, y, degrees)."""
    out = []
    for k in range(n):
        a = a0 + (a1 - a0) * k / max(1, n - 1)
        out.append((r * math.cos(math.radians(a)), CY + r * math.sin(math.radians(a)), a))
    return out


def ring_seats(angles):
    seats = [[0.64 * math.cos(math.radians(a)), CY + 0.64 * math.sin(math.radians(a))] for a in angles]
    return {'seats': [[round(x, 3), round(y, 3)] for x, y in seats], 'sitLift': 0.0}


def ring_base(seat, plinth=None):
    arc_block('Plinth', 0, CY, 0.5, 0.92, A0, A1, 0, 0.1, plinth or plain('#1e161a', rough=0.6), bevel=0.01)
    arc_block('Seat', 0, CY, 0.5, 0.88, A0, A1, 0.1, 0.42, seat, bevel=0.04)


def ring_back(back, z1=1.0, r0=0.78, r1=0.94, pieces=5, prefix='BackRest', z0=0.42, bevel=0.0):
    """The backrest in a few pieces (each can go in front or behind)."""
    for k in range(pieces):
        b0, b1 = A0 + (A1 - A0) * k / pieces, A0 + (A1 - A0) * (k + 1) / pieces
        m = back[k % len(back)] if isinstance(back, (list, tuple)) else back
        arc_block(f'{prefix}{k}', 0, CY, r0, r1, b0, b1, z0, z1, m, bevel=bevel)


def ring_table(top, trim, r=0.32, z=0.52):
    cylinder('TableFoot', 0, -0.1, 0, 0.04, 0.2, trim, verts=24)
    cylinder('TableStem', 0, -0.1, 0.04, z, 0.035, trim, verts=12)
    cylinder('Table', 0, -0.1, z, z + 0.04, r, top, verts=40)
    cylinder('TableRim', 0, -0.1, z - 0.005, z + 0.005, r + 0.005, trim, verts=40)


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
# Round booths (3 x 3)
# --------------------------------------------------------------------------

def tiki_booth():
    straw = mat('#c9a35a', rough=0.95)
    bamboo = mat('#b8964a', rough=0.5)
    dark = mat('#5a3b1c', rough=0.7)
    ring_base(mat('#d8b878', rough=0.9), dark)
    for i, (x, y, a) in enumerate(on_arc(15, 0.86)):
        cylinder(f'BackBamboo{i}', x, y, 0.42, 1.02 + 0.05 * (i % 2), 0.045, bamboo, verts=12)
        for z in (0.6, 0.85):
            cylinder(f'BackKnot{i}{z}', x, y, z, z + 0.02, 0.05, dark, verts=12)
    arc_block('BackThatch', 0, CY, 0.74, 1.0, A0, A1, 1.0, 1.12, straw, bevel=0.03)
    for side, (x, y, _) in zip('LR', (on_arc(2, 0.98, A0 - 4, A1 + 4))):
        cylinder(f'BackTorch{side}', x, y, 0, 1.3, 0.03, bamboo, verts=10)
        cone(f'BackTorchCup{side}', x, y, 1.3, 1.42, 0.04, 0.07, dark, verts=12)
        cone(f'BackFlame{side}', x, y, 1.42, 1.6, 0.06, 0.0, neon(f'TorchFire{side}', (1.0, 0.4, 0.05), 4), verts=12)
    ring_table(bb.wood('TikiTop', (0.2, 0.09, 0.035), (0.36, 0.17, 0.07)), dark)
    # A volcano bowl: brown cone with a glowing top, and two straws.
    cone('Volcano', 0, -0.1, 0.56, 0.72, 0.12, 0.05, mat('#6b4423', rough=0.8), verts=20)
    cylinder('Lava', 0, -0.1, 0.72, 0.74, 0.05, neon('Lava', (1.0, 0.35, 0.05), 6), verts=16)
    drinks(['#ff8a3d', '#ffd23d'])
    return ring_seats(THREE)


def igloo_booth():
    ice = principled('IglooIce', srgb('#8cc8f0'), rough=0.25, transmission=0.25, ior=1.31,
                     emission=srgb('#3a8ad8'), emission_strength=0.25)
    snow = mat('#e4eef8', rough=0.6)
    ring_base(principled('IglooFur', srgb('#dfe6ee'), rough=0.95), mat('#b8c8d8'))
    rows = 4
    for r in range(rows):
        z0 = 0.42 + r * 0.16
        off = 0 if r % 2 == 0 else 0.5
        n = 7
        for k in range(n + 1):
            b0 = A0 + (A1 - A0) * max(0, (k - off)) / n
            b1 = A0 + (A1 - A0) * min(n, (k + 1 - off)) / n
            if b1 - b0 < 4:
                continue
            arc_block(f'BackIce{r}_{k}', 0, CY, 0.78 + r * 0.02, 0.95 - r * 0.01, b0 + 0.6, b1 - 0.6, z0 + 0.008, z0 + 0.152, ice, bevel=0.02)
    arc_block('BackSnowCap', 0, CY, 0.8, 0.94, A0, A1, 1.06, 1.12, snow, bevel=0.03)
    ring_table(principled('IceTop', (0.7, 0.88, 1.0), rough=0.05, transmission=0.6, emission=(0.4, 0.7, 1.0), emission_strength=0.8),
               mat('#dfe8f2', rough=0.3))
    arc_block('FloorGlow', 0, CY, 0.92, 0.95, A0, A1, 0.02, 0.05, neon('IglooGlow', (0.3, 0.75, 1.0), 6), bevel=0)
    drinks(['#7fe0ff', '#bfefff', '#7fe0ff'])
    return ring_seats(THREE)


def neon_halo_booth():
    gloss = mat('#141019', rough=0.15)
    pink = neon('HaloPink', (1.0, 0.1, 0.6), 3.5)
    cyan = neon('HaloCyan', (0.05, 0.75, 1.0), 4)
    ring_base(mat('#221a2c', rough=0.35), gloss)
    ring_back(mat('#1a1420', rough=0.3), z1=1.0)
    for k in range(5):
        b0, b1 = A0 + (A1 - A0) * k / 5, A0 + (A1 - A0) * (k + 1) / 5
        arc_block(f'BackNeon{k}', 0, CY, 0.76, 0.96, b0, b1, 0.99, 1.03, pink, bevel=0)
        arc_block(f'BackNeonLow{k}', 0, CY, 0.775, 0.785, b0, b1, 0.7, 0.72, cyan, bevel=0)
    arc_block('UnderGlow', 0, CY, 0.9, 0.93, A0, A1, 0.02, 0.05, cyan, bevel=0)
    ring_table(mat('#0d0b12', rough=0.05), mat('#3a3442', rough=0.3))
    torus('TableHalo', 0, -0.1, 0.565, 0.3, 0.012, pink)
    drinks(['#ff4dcf', '#3de0ff', '#c07dff'])
    return ring_seats(FOUR)


def birdcage_booth():
    gold = mat('#e8b84a', rough=0.25, glow=0.15)
    ring_base(principled('CagePink', srgb('#e0558f'), rough=0.85), mat('#2a1a22'))
    ring_back(principled('CagePinkBack', srgb('#b83a70'), rough=0.85), z1=0.78)
    for i, (x, y, a) in enumerate(on_arc(17, 0.97, A0, A1)):
        cylinder(f'BackBar{i}', x, y, 0.1, 1.75, 0.012, gold, verts=8)
    arc_block('BackRingMid', 0, CY, 0.955, 0.985, A0, A1, 0.98, 1.0, gold, bevel=0)
    arc_block('BackRingTop', 0, CY, 0.955, 0.985, A0, A1, 1.73, 1.77, gold, bevel=0)
    arc_block('BackRingLow', 0, CY, 0.92, 0.99, A0, A1, 0.08, 0.12, gold, bevel=0)
    # The open cage's top curls in toward the middle.
    for i, (x, y, a) in enumerate(on_arc(7, 0.97, A0, A1)):
        cylinder(f'BackCurl{i}', x * 0.86, (y - CY) * 0.86 + CY, 1.76, 1.9, 0.01, gold, verts=8)
    sphere('BackFinial', 0, CY + 0.82, 1.95, 0.05, gold)
    ring_table(mat('#fbeff4', rough=0.2), gold)
    candle('Candle', 0.0, -0.1, 0.56)
    drinks(['#ff9ac8', '#ffe9a8', '#ff9ac8'])
    return ring_seats(THREE)


def mirror_disco_booth():
    silver = mat('#cfd4de', rough=0.15)
    ring_base(mat('#9aa0ad', rough=0.25, glow=0.05), mat('#2a2c33'))
    tiles = [mat('#e8ecf4', rough=0.05, glow=0.25), mat('#aab2c2', rough=0.1), mat('#f6f0ff', rough=0.05, glow=0.4)]
    n = 14
    for row in range(4):
        for k in range(n):
            b0, b1 = A0 + (A1 - A0) * k / n, A0 + (A1 - A0) * (k + 1) / n
            arc_block(f'BackTile{row}_{k}', 0, CY, 0.78, 0.94, b0 + 0.4, b1 - 0.4, 0.42 + row * 0.145 + 0.006, 0.42 + (row + 1) * 0.145 - 0.006,
                      tiles[(row + k) % 3], bevel=0)
    arc_block('BackCap', 0, CY, 0.77, 0.95, A0, A1, 1.0, 1.03, silver, bevel=0)
    ring_table(mat('#1a1c22', rough=0.05), silver)
    cylinder('BallPole', 0, -0.1, 0.56, 0.8, 0.008, silver, verts=8)
    ball = sphere('MiniBall', 0, -0.1, 0.86, 0.075, mat('#e8ecf4', rough=0.1, glow=0.6), segments=12)
    ball.modifiers.clear()
    drinks(['#ff4d8d', '#3de0ff', '#ffe36f'])
    return ring_seats(FOUR)


def throne_booth():
    purple = principled('ThronePurple', srgb('#5a1d8a'), rough=0.85)
    purple_back = principled('ThronePurpleBack', srgb('#44136a'), rough=0.85)
    gold = mat('#f0c24a', rough=0.2, glow=0.2)
    ring_base(purple, mat('#1e1426'))
    ring_back(purple_back, z1=1.25, pieces=7)
    for k in range(7):
        b0, b1 = A0 + (A1 - A0) * k / 7, A0 + (A1 - A0) * (k + 1) / 7
        arc_block(f'BackPiping{k}', 0, CY, 0.77, 0.95, b0, b1, 1.24, 1.28, gold, bevel=0)
    for i, (x, y, a) in enumerate(on_arc(9, 0.86, A0 + 4, A1 - 4)):
        cone(f'BackSpike{i}', x, y, 1.28, 1.44, 0.04, 0.0, gold, verts=12)
        sphere(f'BackJewel{i}', x, y, 1.46, 0.025, neon(f'Jewel{i % 3}', [(1, 0.1, 0.3), (0.2, 0.6, 1), (0.3, 1, 0.5)][i % 3], 4), segments=8)
    for k in range(9):
        a = math.radians(A0 + 10 + k * (A1 - A0 - 20) / 8)
        for z in (0.62, 0.88, 1.1):
            sphere(f'BackButton{k}{z}', 0.77 * math.cos(a), CY + 0.77 * math.sin(a), z, 0.02, gold, segments=8)
    ring_table(mat('#f0c24a', rough=0.15, glow=0.1), gold)
    cylinder('Goblet', 0.02, -0.1, 0.56, 0.62, 0.02, gold, verts=12)
    cone('GobletCup', 0.02, -0.1, 0.62, 0.72, 0.03, 0.06, gold, verts=16)
    drinks(['#a0103a', '#a0103a'])
    return ring_seats(THREE)


def seashell_booth():
    coral = principled('ShellCoral', srgb('#f6b7a6'), rough=0.5)
    pearl = principled('ShellPearl', srgb('#fff4ec'), rough=0.2, emission=srgb('#ffe6f0'), emission_strength=0.15)
    ring_base(principled('ShellSeat', srgb('#7fd6cf'), rough=0.85), mat('#e8d8c0'))
    n = 11
    for k in range(n):
        b0, b1 = A0 + (A1 - A0) * k / n, A0 + (A1 - A0) * (k + 1) / n
        mid = abs(k - (n - 1) / 2) / ((n - 1) / 2)
        top = 1.45 - 0.55 * mid * mid
        arc_block(f'BackRib{k}', 0, CY, 0.78, 0.94, b0 + 0.8, b1 - 0.8, 0.42, top, coral if k % 2 else pearl, bevel=0.03)
    ring_table(pearl, mat('#e8d8c0', rough=0.3))
    sphere('Pearl', 0, -0.1, 0.64, 0.07, mat('#ffffff', rough=0.1, glow=0.5))
    torus('Clam', 0, -0.1, 0.58, 0.09, 0.025, coral)
    drinks(['#7fe0d6', '#ffb0c8'])
    return ring_seats(THREE)


def galaxy_booth():
    navy = principled('GalaxyNavy', srgb('#1a1f5a'), rough=0.8)
    navy_back = principled('GalaxyBack', srgb('#141848'), rough=0.8)
    ring_base(navy, mat('#0a0c20'))
    ring_back(navy_back)
    arc_block('BackPiping', 0, CY, 0.77, 0.95, A0, A1, 0.98, 1.02, mat('#b9c3ff', rough=0.2, glow=0.4), bevel=0)
    import random
    rnd = random.Random(7)
    star = neon('Star', (0.9, 0.92, 1.0), 8)
    pinks = neon('StarPink', (1.0, 0.5, 0.9), 6)
    for i in range(40):
        a = math.radians(rnd.uniform(A0 + 3, A1 - 3))
        z = rnd.uniform(0.5, 0.95)
        sphere(f'BackStar{i}', 0.775 * math.cos(a), CY + 0.775 * math.sin(a), z, rnd.uniform(0.008, 0.016), star if i % 4 else pinks, segments=6)
    ring_table(mat('#0d0f24', rough=0.05), mat('#6a74c8', rough=0.3))
    sphere('Planet', 0, -0.1, 0.68, 0.09, mat('#ff9a5a', rough=0.4, glow=0.3))
    torus('PlanetRing', 0, -0.1, 0.68, 0.14, 0.008, mat('#ffe0b0', rough=0.3, glow=0.5), rot=(20, 10, 0))
    arc_block('UnderGlow', 0, CY, 0.9, 0.93, A0, A1, 0.02, 0.05, neon('GalaxyGlow', (0.45, 0.35, 1.0), 6), bevel=0)
    return ring_seats(FOUR)


def candy_booth():
    pastels = [principled('CandyPink', srgb('#ff9ec7'), rough=0.5), principled('CandyMint', srgb('#9ff0d0'), rough=0.5),
               principled('CandyLemon', srgb('#fff09a'), rough=0.5), principled('CandyLilac', srgb('#c9a8ff'), rough=0.5)]
    frosting = mat('#ffffff', rough=0.4)
    ring_base(principled('CandySeat', srgb('#ff7fb4'), rough=0.6), mat('#ffd0e4'))
    ring_back(pastels, pieces=8, z1=0.98)
    for i, (x, y, a) in enumerate(on_arc(22, 0.86, A0 + 2, A1 - 2)):
        sphere(f'BackDrip{i}', x, y, 1.0, 0.055, frosting, segments=10)
    ring_table(mat('#fff7fb', rough=0.3), mat('#ff9ec7'))
    # A giant cupcake.
    cone('CupcakeCup', 0, -0.1, 0.56, 0.66, 0.06, 0.08, mat('#ff7fb4', rough=0.5), verts=16)
    sphere('CupcakeTop', 0, -0.1, 0.69, 0.085, mat('#fff0f6', rough=0.4), scale=(1, 1, 0.7))
    sphere('Cherry', 0, -0.1, 0.77, 0.025, mat('#e01030', rough=0.2))
    drinks(['#ff9ec7', '#9ff0d0'])
    return ring_seats(THREE)


def garden_booth():
    leaf = principled('Hedge', srgb('#3f8a3a'), rough=0.95)
    leaf2 = principled('HedgeLight', srgb('#5aa84a'), rough=0.95)
    ring_base(principled('GardenSeat', srgb('#f2ead6'), rough=0.85), mat('#7a6a58'))
    ring_back(leaf, r0=0.76, r1=0.98, z1=1.0, bevel=0.05)
    import random
    rnd = random.Random(3)
    for i, (x, y, a) in enumerate(on_arc(16, 0.87, A0 + 2, A1 - 2)):
        sphere(f'BackBush{i}', x, y, 1.0 + rnd.uniform(-0.02, 0.03), rnd.uniform(0.1, 0.13), leaf2 if i % 2 else leaf, segments=10)
    flowers = [mat('#ff5a8a', glow=0.2), mat('#fff06a', glow=0.2), mat('#ffffff', glow=0.2)]
    for i in range(14):
        a = math.radians(rnd.uniform(A0 + 5, A1 - 5))
        r = 0.775
        sphere(f'BackFlower{i}', r * math.cos(a), CY + r * math.sin(a), rnd.uniform(0.55, 1.05), 0.025, flowers[i % 3], segments=8)
    ring_table(mat('#c9c2b4', rough=0.8), mat('#8a8274', rough=0.6))
    cylinder('Pot', 0, -0.1, 0.56, 0.64, 0.045, mat('#c0603a', rough=0.8), verts=16)
    for i in range(5):
        a = i * 72
        sphere(f'Bloom{i}', 0.03 * math.cos(math.radians(a)), -0.1 + 0.03 * math.sin(math.radians(a)), 0.68, 0.03, flowers[i % 3], segments=8)
    return ring_seats(THREE)


def fire_pit_lounge():
    stone = principled('PitStone', srgb('#8a8580'), rough=0.9)
    stone2 = principled('PitStoneDark', srgb('#6a6560'), rough=0.9)
    ring_base(principled('PitCushion', srgb('#d07a3a'), rough=0.85), stone2)
    for k in range(9):
        b0, b1 = A0 + (A1 - A0) * k / 9, A0 + (A1 - A0) * (k + 1) / 9
        arc_block(f'BackStone{k}', 0, CY, 0.78, 0.95, b0 + 0.5, b1 - 0.5, 0.42, 0.82 + 0.04 * (k % 2), stone if k % 2 else stone2, bevel=0.03)
    for i in range(10):
        a = math.radians(i * 36)
        box(f'PitRock{i}', -0.07, 0.07, -0.05, 0.05, 0, 0.22, stone if i % 2 else stone2, bevel=0.02)
        o = bs.bpy.context.active_object
        o.location = (0.24 * math.cos(a), -0.1 + 0.24 * math.sin(a), 0.11)
        o.rotation_euler = (0, 0, a + math.pi / 2)
    cylinder('Embers', 0, -0.1, 0.0, 0.16, 0.2, neon('Embers', (0.9, 0.2, 0.02), 2.5), verts=20)
    fire = neon('Fire', (1.0, 0.4, 0.05), 3.5)
    fire2 = neon('FireTip', (1.0, 0.75, 0.2), 4)
    for i, (x, y, h) in enumerate([(0, -0.1, 0.55), (0.08, -0.06, 0.42), (-0.08, -0.13, 0.45), (0.03, -0.18, 0.38), (-0.05, -0.02, 0.4)]):
        cone(f'Flame{i}', x, y, 0.16, h, 0.07, 0.0, fire, verts=12)
        cone(f'FlameTip{i}', x, y, 0.2, h * 0.8, 0.035, 0.0, fire2, verts=10)
    return ring_seats(FOUR)


def cloud_booth():
    cloud = principled('Cloud', srgb('#ffffff'), rough=0.9, emission=srgb('#eaf2ff'), emission_strength=0.15)
    ring_base(principled('CloudSeat', srgb('#bfe0ff'), rough=0.9), mat('#dfeeff'))
    import random
    rnd = random.Random(11)
    for i, (x, y, a) in enumerate(on_arc(12, 0.86, A0 + 2, A1 - 2)):
        for j, z in enumerate((0.58, 0.82)):
            sphere(f'BackPuff{i}_{j}', x, y, z + rnd.uniform(-0.03, 0.03), 0.17 - 0.03 * j, cloud, segments=14)
    for i, (x, y, a) in enumerate(on_arc(7, 0.84, A0 + 15, A1 - 15)):
        sphere(f'BackPuffTop{i}', x, y, 1.0 + rnd.uniform(-0.02, 0.04), 0.12, cloud, segments=14)
    ring_table(mat('#fff8d8', rough=0.3, glow=0.2), mat('#e8d8a0', rough=0.3))
    star = mat('#ffd84a', rough=0.3, glow=0.8)
    for i in range(5):
        a = math.radians(90 + i * 72)
        cone(f'StarPoint{i}', 0.04 * math.cos(a), -0.1 + 0.04 * math.sin(a), 0.56, 0.6, 0.03, 0.0, star, verts=6)
    sphere('StarMiddle', 0, -0.1, 0.6, 0.04, star, scale=(1, 1, 0.6))
    arc_block('UnderGlow', 0, CY, 0.9, 0.93, A0, A1, 0.02, 0.05, neon('CloudGlow', (0.9, 0.8, 1.0), 4), bevel=0)
    return ring_seats(THREE)


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
    'tikiBooth': tiki_booth,
    'iglooBooth': igloo_booth,
    'haloBooth': neon_halo_booth,
    'birdcageBooth': birdcage_booth,
    'mirrorBooth': mirror_disco_booth,
    'throneBooth': throne_booth,
    'shellBooth': seashell_booth,
    'galaxyBooth': galaxy_booth,
    'candyBooth': candy_booth,
    'gardenBooth': garden_booth,
    'firePit': fire_pit_lounge,
    'cloudBooth': cloud_booth,
    'kissSofa': kiss_sofa,
    'bathtubSofa': bathtub_sofa,
    'cruiserSofa': cruiser_sofa,
    'decoSofa': deco_sofa,
    'chesterfield': chesterfield,
    'beerBench': beer_hall_bench,
    'cubeBench': led_cube_bench,
    'rattanSeat': rattan_love_seat,
}
