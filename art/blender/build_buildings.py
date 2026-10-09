"""Builds the buildings across the street from the club and renders them.

Run from the repo root with a Python that has bpy and pillow:
    python art/blender/build_buildings.py                 # all buildings
    python art/blender/build_buildings.py diner walkup    # only some
    python art/blender/build_buildings.py --preview DIR diner
        # facing 0 only, written to DIR, for a quick look

Unlike props, buildings are modelled in game tiles (1 Blender unit = one
48 px tile, no MODEL_SCALE) because they stand on the street grid, not in
the club. Each is W tiles along the street and DEPTH tiles deep, centred on
the origin, its street front facing -Y at facing 0. Facing 0 lines the road
behind the right wall (front turned down-left on screen); facing 90 lines
the road behind the left wall (front turned down-right).

Writes bldg_<name>_{0,90}.png and bldg_<name>.json (canvas size and where
the model's origin lands, in game pixels) to game/src/assets/sprites/.
The look follows the main reference's street (art/REFERENCE_NOTES.md):
red brick, cream trim, arched windows, neon shop signs; names are our own.
"""

import json
import math
import os
import random
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_bar as bb  # noqa: E402
from build_bars import neon_tube, plain, srgb  # noqa: E402

box, cylinder = bb.box, bb.cylinder
principled, neon = bb.principled, bb.neon

DEPTH = 4.0
STOREY = 3.2          # a storey, in tiles (a guest is about 2.5 tall)
GROUND = 3.6          # the shop floor is a bit taller
CANVAS = 1600         # render canvas (2x game pixels)
AIM_Z = 7.0           # the camera looks at this height so tall buildings fit

R = random.Random(3)


# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------

def brick(name, color, mortar='#c9b8a6', scale=7.0):
    """Brick courses on every wall: a brick texture running along (x + y)
    and up z, so it reads on fronts and sides alike."""
    mat = principled(name, srgb(color), rough=0.85)
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    tex = nt.nodes.new('ShaderNodeTexBrick')
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Mortar Size'].default_value = 0.018
    tex.inputs['Color1'].default_value = (*srgb(color), 1)
    tex.inputs['Color2'].default_value = (*[c * 0.82 for c in srgb(color)], 1)
    tex.inputs['Mortar'].default_value = (*srgb(mortar), 1)
    nt.links.new(coord.outputs['Object'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['X'], add.inputs[0]); nt.links.new(sep.outputs['Y'], add.inputs[1])
    nt.links.new(add.outputs['Value'], comb.inputs['X']); nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
    nt.links.new(comb.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def mats():
    return {
        'brick': brick('Brick', '#5a2a24', mortar='#6e5a52'),
        'brickDark': brick('BrickDark', '#3a1e1c', mortar='#4e3e3a'),
        'brickBlack': brick('BrickBlack', '#26222c', mortar='#3a3542'),
        'brownstone': principled('Brownstone', srgb('#3e2a24'), rough=0.85),
        'stucco': principled('Stucco', srgb('#4a4048'), rough=0.9),
        'stuccoBlue': principled('StuccoBlue', srgb('#2a3448'), rough=0.9),
        'concrete': principled('Concrete', srgb('#4a4852'), rough=0.9),
        'cream': principled('Cream', srgb('#8a8070'), rough=0.6),
        'trimDark': principled('TrimDark', srgb('#2a2630'), rough=0.6),
        'iron': principled('Iron', srgb('#1c1a22'), rough=0.5),
        'roof': principled('Roof', srgb('#2e2a34'), rough=0.9),
        'glassDark': principled('GlassDark', srgb('#141826'), rough=0.15),
        'warm': principled('WinWarm', srgb('#ffcf7a'), rough=0.5, emission=srgb('#ffb347'), emission_strength=2.2),
        'cool': principled('WinCool', srgb('#9fd8ff'), rough=0.5, emission=srgb('#6ab8ff'), emission_strength=1.6),
        'tv': principled('WinTV', srgb('#7a8cff'), rough=0.5, emission=srgb('#5a6aff'), emission_strength=1.8),
        'curtain': principled('Curtain', srgb('#c0505a'), rough=0.6, emission=srgb('#a03040'), emission_strength=1.2),
        'shopLight': principled('ShopLight', srgb('#d9a860'), rough=0.5, emission=srgb('#e0a050'), emission_strength=0.7),
        'shopCool': principled('ShopCool', srgb('#cfe8ff'), rough=0.5, emission=srgb('#9ccaf2'), emission_strength=0.8),
        'plant': principled('Plant', srgb('#2f7a3a'), rough=0.7),
        'pot': principled('Pot', srgb('#9a5a3a'), rough=0.7),
        'ac': principled('AC', srgb('#6a6a70'), rough=0.5),
        'party': principled('WinParty', srgb('#ff6ad8'), rough=0.5, emission=srgb('#e040c0'), emission_strength=1.8),
    }


# --------------------------------------------------------------------------
# Pieces
# --------------------------------------------------------------------------

FY = -DEPTH / 2   # the street front's plane


def spill(W, color, energy=900):
    """Coloured light from the shop's own neon washing up the front and onto
    the pavement, brightest at street level."""
    d = bpy.data.lights.new('Spill', 'AREA')
    d.energy = energy; d.color = color; d.size = W; d.shape = 'RECTANGLE'; d.size_y = 1.0
    o = bpy.data.objects.new('Spill', d)
    o.location = (0, FY - 2.2, 0.6)
    o.rotation_euler = (math.radians(105), 0, 0)   # aimed back at the front, a little upward
    bpy.context.scene.collection.objects.link(o)
    o.parent = bb.ROOT


def body(W, H, mat, top_mat=None):
    """The building block, with a parapet and cornice."""
    box('Body', -W / 2, W / 2, FY, -FY, 0, H, mat, bevel=0.02)
    box('Cornice', -W / 2 - 0.08, W / 2 + 0.08, FY - 0.12, -FY + 0.08, H - 0.25, H, top_mat or M['cream'], bevel=0.02)
    box('Roof', -W / 2 + 0.1, W / 2 - 0.1, FY + 0.1, -FY - 0.1, H - 0.05, H + 0.02, M['roof'], bevel=0)


def roof_bits(W, H, water_tower=False, seed=0):
    """Things on a city roof: AC boxes, a chimney, a roof door, maybe a
    wooden water tower on legs."""
    rr = random.Random(seed)
    top = H + 0.02
    box('RoofDoor', W / 2 - 1.5, W / 2 - 0.5, 0.2, 1.2, top, top + 1.1, M['concrete'], bevel=0.02)
    for k in range(rr.randint(1, 3)):
        x = rr.uniform(-W / 2 + 0.6, W / 2 - 1.8); y = rr.uniform(-1.2, 1.0)
        box('RoofAC', x - 0.35, x + 0.35, y - 0.3, y + 0.3, top, top + 0.45, M['ac'], bevel=0.02)
    box('Chimney', -W / 2 + 0.3, -W / 2 + 0.75, 1.0, 1.5, top, top + 0.9, M['brickDark'], bevel=0.01)
    if water_tower:
        wood = principled('TankWood', srgb('#6a4a32'), rough=0.8)
        x, y = -W / 2 + 1.4, 0.6
        for dx in (-0.45, 0.45):
            for dy in (-0.45, 0.45):
                box('TankLeg', x + dx - 0.04, x + dx + 0.04, y + dy - 0.04, y + dy + 0.04, top, top + 1.0, M['iron'], bevel=0)
        cylinder('Tank', x, y, top + 1.0, top + 2.2, 0.62, wood, verts=24)
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.68, radius2=0.05, depth=0.5, location=(x, y, top + 2.45))
        bb._finish(bpy.context.active_object, M['roof'], 0)
        for z in (top + 1.3, top + 1.9):
            cylinder('TankHoop', x, y, z, z + 0.05, 0.635, M['iron'], verts=24)


def window(x, z, w=0.7, h=1.3, arch=False, lit=None, frame='cream', sill=True):
    """A window on the street front at (x, z = bottom), with frame and sill."""
    lit = lit if lit is not None else R.choice(['warm', 'warm', 'tv', 'party', 'curtain', 'dark', 'dark', 'dark', 'dark', 'dark'])
    glass = M['glassDark'] if lit == 'dark' else M[lit]
    fr = M[frame]
    box('WinFrame', x - w / 2 - 0.06, x + w / 2 + 0.06, FY - 0.04, FY + 0.02, z - 0.06, z + h + 0.06, fr, bevel=0.01)
    box('WinGlass', x - w / 2, x + w / 2, FY - 0.06, FY + 0.01, z, z + h, glass, bevel=0)
    box('WinBar', x - 0.025, x + 0.025, FY - 0.08, FY - 0.03, z, z + h, fr, bevel=0)
    box('WinBarH', x - w / 2, x + w / 2, FY - 0.08, FY - 0.03, z + h * 0.55, z + h * 0.55 + 0.05, fr, bevel=0)
    if arch:
        # a rounded top: a half disc of frame colour over the window
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=w / 2 + 0.06, depth=0.08,
                                            location=(x, FY - 0.03, z + h), rotation=(math.radians(90), 0, 0))
        o = bpy.context.active_object; o.name = 'Arch'
        bb._finish(o, fr, 0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=w / 2, depth=0.09,
                                            location=(x, FY - 0.04, z + h), rotation=(math.radians(90), 0, 0))
        o = bpy.context.active_object; o.name = 'ArchGlass'
        bb._finish(o, glass, 0)
    if sill:
        box('Sill', x - w / 2 - 0.12, x + w / 2 + 0.12, FY - 0.16, FY, z - 0.12, z - 0.04, fr, bevel=0.01)


def upper_floors(W, z0, floors, cols, arch=False, frame='cream', fire_escape=False, ac=True, plants=True):
    xs = [(-W / 2) + (i + 0.5) * W / cols for i in range(cols)]
    for f in range(floors):
        z = z0 + f * STOREY + 0.8
        for x in xs:
            window(x, z, arch=arch, frame=frame)
            if ac and R.random() < 0.18:
                box('AC', x - 0.28, x + 0.28, FY - 0.42, FY, z - 0.02, z + 0.36, M['ac'], bevel=0.02)
            elif plants and R.random() < 0.15:
                box('Planter', x - 0.4, x + 0.4, FY - 0.3, FY - 0.08, z - 0.05, z + 0.12, M['pot'], bevel=0.01)
                for k in range(3):
                    cylinder('Leaf', x - 0.25 + k * 0.25, FY - 0.2, z + 0.1, z + 0.35, 0.1, M['plant'], verts=8)
        if f < floors - 1:
            box('Band', -W / 2, W / 2, FY - 0.06, FY, z0 + (f + 1) * STOREY - 0.05, z0 + (f + 1) * STOREY + 0.1, M[frame], bevel=0)
    if fire_escape:
        fx0, fx1 = xs[0] - 0.7, xs[min(1, cols - 1)] + 0.7
        for f in range(floors):
            z = z0 + f * STOREY + 0.75
            box('FEDeck', fx0, fx1, FY - 0.9, FY, z - 0.06, z, M['iron'], bevel=0)
            for x in (fx0, fx1):
                box('FEPost', x - 0.03, x + 0.03, FY - 0.9, FY - 0.84, z, z + 0.9, M['iron'], bevel=0)
            box('FERail', fx0, fx1, FY - 0.92, FY - 0.84, z + 0.86, z + 0.92, M['iron'], bevel=0)
            box('FERail2', fx0, fx1, FY - 0.92, FY - 0.86, z + 0.44, z + 0.48, M['iron'], bevel=0)
            if f < floors - 1:
                # the ladder up to the next deck
                n = 7
                for s in range(n):
                    t = s / n
                    box('FEStep', fx0 + 0.2 + t * 1.0, fx0 + 0.45 + t * 1.0, FY - 0.8, FY - 0.2, z + t * STOREY, z + t * STOREY + 0.05, M['iron'], bevel=0)


def shopfront(W, color, glass='shopLight', door_x=None, awning=None, stripes=None):
    """The ground floor: a painted frame, a big lit window and a door."""
    c = principled('ShopPaint', srgb(color), rough=0.5)
    box('ShopBase', -W / 2, W / 2, FY - 0.08, FY, 0, 0.5, c, bevel=0.01)
    box('ShopHead', -W / 2, W / 2, FY - 0.1, FY, GROUND - 0.7, GROUND, c, bevel=0.01)
    for x in (-W / 2 + 0.12, W / 2 - 0.12):
        box('ShopPier', x - 0.12, x + 0.12, FY - 0.1, FY, 0, GROUND, c, bevel=0.01)
    door_x = door_x if door_x is not None else W / 2 - 1.0
    box('ShopWindow', -W / 2 + 0.24, door_x - 0.6, FY - 0.05, FY, 0.5, GROUND - 0.7, M[glass], bevel=0)
    box('Door', door_x - 0.45, door_x + 0.45, FY - 0.05, FY, 0, 2.4, M[glass], bevel=0)
    box('DoorFrame', door_x - 0.52, door_x + 0.52, FY - 0.07, FY - 0.03, 2.4, 2.5, c, bevel=0)
    for x in (door_x - 0.5, door_x + 0.5):
        box('DoorPost', x - 0.04, x + 0.04, FY - 0.07, FY - 0.03, 0, 2.5, c, bevel=0)
    box('DoorPlate', -W / 2 + 0.24, door_x - 0.6, FY - 0.09, FY - 0.04, GROUND - 1.25, GROUND - 1.2, c, bevel=0)
    if awning:
        a = principled('Awning', srgb(awning), rough=0.6)
        b = principled('Awning2', srgb(stripes or awning), rough=0.6)
        n = max(4, int(W * 2))
        for i in range(n):
            x0 = -W / 2 + i * W / n
            m = a if i % 2 == 0 else b
            # a sloped awning: a thin box tilted down toward the street
            box('AwningSlat', x0, x0 + W / n, FY - 1.0, FY, GROUND - 0.65, GROUND - 0.55, m, bevel=0)
            box('AwningFlap', x0, x0 + W / n, FY - 1.05, FY - 0.97, GROUND - 1.0, GROUND - 0.6, m, bevel=0)
        o = bpy.data.objects
    return door_x


def sign_text(text, x, z, size, mat, y=None, board=None, pad=0.25, vertical=False):
    """Neon letters on the front (a dark board behind them if asked)."""
    y = FY - 0.16 if y is None else y
    if vertical:
        for i, ch in enumerate(text):
            sign_text(ch, x, z - i * size * 1.05, size, mat, y=y)
        return
    bpy.ops.object.text_add(location=(x, y, z), rotation=(math.radians(90), 0, 0))
    t = bpy.context.active_object
    t.data.body = text
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    t.data.size = size
    t.data.extrude = 0.03
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    bb._finish(o, mat, 0)
    if board:
        dims = o.dimensions
        box('SignBoard', x - dims.x / 2 - pad, x + dims.x / 2 + pad, y + 0.04, y + 0.12, z - dims.z / 2 - pad * 0.6, z + dims.z / 2 + pad * 0.6, board, bevel=0.03)
    return o


def blade_sign(text, x, z_top, size, mat, board):
    """A tall vertical sign sticking out from the front."""
    n = len(text)
    h = n * size * 1.1 + 0.4
    box('BladeArm', x - 0.04, x + 0.04, FY - 0.9, FY, z_top - 0.1, z_top, M['iron'], bevel=0)
    box('Blade', x - 0.05, x + 0.05, FY - 0.95, FY - 0.15, z_top - h, z_top, board, bevel=0.02)
    for i, ch in enumerate(text):
        # on the blade's +X side, the one the camera sees
        bpy.ops.object.text_add(location=(x + 0.07, FY - 0.55, z_top - 0.3 - i * size * 1.1), rotation=(math.radians(90), 0, math.radians(90)))
        t = bpy.context.active_object
        t.data.body = ch
        t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
        t.data.size = size; t.data.extrude = 0.03
        bpy.ops.object.convert(target='MESH')
        bb._finish(bpy.context.active_object, mat, 0)


# --------------------------------------------------------------------------
# Buildings
# --------------------------------------------------------------------------

def walkup(W=5.0):
    """A red-brick apartment walk-up: stoop, fire escape, arched windows."""
    floors = 3
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['brick'])
    spill(W, (1.0, 0.75, 0.45))
    # ground floor: a stoop up to a lit doorway, windows each side
    box('Base', -W / 2, W / 2, FY - 0.06, FY, 0, 0.6, M['brownstone'], bevel=0)
    for k in range(4):
        box('Step', -0.8, 0.8, FY - 1.2 + k * 0.28, FY, 0, 0.18 * (k + 1), M['concrete'], bevel=0.01)
    box('DoorWay', -0.55, 0.55, FY - 0.06, FY, 0.72, 3.1, M['trimDark'], bevel=0)
    box('DoorGlass', -0.42, 0.42, FY - 0.08, FY - 0.02, 0.75, 2.9, M['warm'], bevel=0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.62, depth=0.1, location=(0, FY - 0.04, 3.1), rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object; bb._finish(o, M['cream'], 0)
    for x in (-W / 2 + 1.0, W / 2 - 1.0):
        window(x, 1.0, w=0.9, h=1.6, frame='cream')
    cylinder('Lamp', 0.9, FY - 0.15, 2.4, 2.75, 0.1, M['warm'], verts=12)
    upper_floors(W, GROUND, floors, 3, arch=True, fire_escape=True)
    roof_bits(W, H, water_tower=True, seed=1)


def diner(W=6.0):
    """A late-night diner: chrome and teal, big bright windows, neon sign."""
    floors = 2
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['stucco'])
    spill(W, (0.4, 0.95, 1.0))
    door_x = shopfront(W, '#2bb3a8', door_x=W / 2 - 1.0, awning='#d93a3a', stripes='#f4efe6')
    # booths seen through the window: red seat backs
    seat = principled('DinerSeat', srgb('#d93a3a'), rough=0.4)
    for i in range(4):
        x = -W / 2 + 0.7 + i * 1.0
        if x > door_x - 0.9: break
        box('BoothBack', x - 0.35, x + 0.35, FY - 0.09, FY - 0.06, 0.5, 1.35, seat, bevel=0.01)
        box('BoothTable', x + 0.38, x + 0.62, FY - 0.09, FY - 0.06, 0.95, 1.02, M['cream'], bevel=0)
    pink = neon('DinerPink', (1.0, 0.2, 0.55), 9)
    cyan = neon('DinerCyan', (0.2, 0.9, 1.0), 8)
    sign_text('DINER', -0.5, GROUND + 0.62, 0.72, pink, board=M['trimDark'], pad=0.16)
    sign_text('OPEN 24 HRS', door_x - 2.4, 1.9, 0.22, cyan, y=FY - 0.11)
    neon_frame(-W / 2 + 0.3, door_x - 0.66, 0.56, GROUND - 0.76, cyan)
    upper_floors(W, GROUND + 0.6, floors, 4, frame='cream', fire_escape=False)
    roof_bits(W, H, seed=2)


def laundromat(W=5.0):
    """A coin laundry: lit window with a row of washing machines."""
    floors = 3
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['stuccoBlue'], top_mat=M['concrete'])
    spill(W, (0.5, 0.75, 1.0))
    door_x = shopfront(W, '#f2c94c', glass='shopCool', door_x=W / 2 - 0.95)
    white = principled('Washer', srgb('#f4f4f4'), rough=0.3)
    porthole = principled('Porthole', srgb('#5aa8ff'), rough=0.1, emission=srgb('#3a88ff'), emission_strength=1.2)
    for i in range(3):
        x = -W / 2 + 0.75 + i * 0.85
        if x > door_x - 0.8: break
        box('Washer', x - 0.34, x + 0.34, FY - 0.1, FY - 0.06, 0.5, 1.4, white, bevel=0.01)
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.22, depth=0.04, location=(x, FY - 0.11, 0.98), rotation=(math.radians(90), 0, 0))
        bb._finish(bpy.context.active_object, porthole, 0)
    blue = neon('LaundryBlue', (0.3, 0.7, 1.0), 9)
    sign_text('LAUNDRY', -0.3, GROUND - 0.33, 0.5, blue)
    upper_floors(W, GROUND + 0.6, floors, 3, frame='trimDark', fire_escape=True)
    roof_bits(W, H, seed=3)



def neon_frame(x0, x1, z0, z1, mat, y=None, r=0.035):
    """A neon tube running round a rectangle on the front."""
    y = FY - 0.12 if y is None else y
    neon_tube('NeonFrame', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1), (x0, y, z0)], r, mat)


def lantern(x, z, color, y=None):
    """A round paper lantern hanging off the front."""
    y = FY - 0.45 if y is None else y
    m = principled('Lantern', srgb(color), rough=0.5, emission=srgb(color), emission_strength=2.5)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.22, location=(x, y, z))
    o = bpy.context.active_object; o.scale = (1, 1, 1.2)
    bb._finish(o, m, 0)
    box('LanternCap', x - 0.08, x + 0.08, y - 0.08, y + 0.08, z + 0.24, z + 0.3, M['iron'], bevel=0)


def martini(x, z, glass_mat, olive_mat, s=0.6, y=None):
    """A neon martini glass outline."""
    y = FY - 0.14 if y is None else y
    pts = [(x - s * 0.5, y, z + s * 0.6), (x, y, z), (x + s * 0.5, y, z + s * 0.6), (x - s * 0.5, y, z + s * 0.6)]
    neon_tube('Martini', pts, 0.03, glass_mat)
    neon_tube('MartiniStem', [(x, y, z), (x, y, z - s * 0.55)], 0.03, glass_mat)
    neon_tube('MartiniFoot', [(x - s * 0.25, y, z - s * 0.55), (x + s * 0.25, y, z - s * 0.55)], 0.03, glass_mat)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=s * 0.08, location=(x + s * 0.08, y, z + s * 0.36))
    bb._finish(bpy.context.active_object, olive_mat, 0)


def dark_shop(W, paint, glow, door_x=None):
    """A night-time shop floor: dark frame, dim coloured window, neon outline."""
    c = principled('ShopPaintDark', srgb(paint), rough=0.5)
    g = principled('ShopGlow', srgb(glow), rough=0.5, emission=srgb(glow), emission_strength=0.7)
    box('ShopBase', -W / 2, W / 2, FY - 0.08, FY, 0, 0.5, c, bevel=0.01)
    box('ShopHead', -W / 2, W / 2, FY - 0.1, FY, GROUND - 0.9, GROUND, c, bevel=0.01)
    for x in (-W / 2 + 0.12, W / 2 - 0.12):
        box('ShopPier', x - 0.12, x + 0.12, FY - 0.1, FY, 0, GROUND, c, bevel=0.01)
    door_x = door_x if door_x is not None else W / 2 - 1.0
    box('ShopWindow', -W / 2 + 0.24, door_x - 0.6, FY - 0.05, FY, 0.5, GROUND - 0.9, g, bevel=0)
    box('Door', door_x - 0.45, door_x + 0.45, FY - 0.05, FY, 0, 2.4, M['trimDark'], bevel=0)
    box('DoorGlass', door_x - 0.3, door_x + 0.3, FY - 0.07, FY - 0.04, 1.2, 2.2, g, bevel=0)
    return door_x


def walkup_dark(W=5.0):
    """Dark brick apartments over a closed shop: the quiet neighbours."""
    floors = 3
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['brickDark'])
    spill(W, (0.4, 1.0, 0.65))
    box('Base', -W / 2, W / 2, FY - 0.06, FY, 0, 0.6, M['brownstone'], bevel=0)
    box('Shutter', -W / 2 + 0.3, W / 2 - 1.6, FY - 0.06, FY, 0.6, GROUND - 0.6, M['concrete'], bevel=0)
    for k in range(9):
        z = 0.7 + k * 0.28
        box('ShutterRib', -W / 2 + 0.3, W / 2 - 1.6, FY - 0.08, FY - 0.05, z, z + 0.03, M['iron'], bevel=0)
    # graffiti-ish neon tag on the shutter
    sign_text('NOVA', -0.9, 1.6, 0.45, neon('Tag', (0.3, 1.0, 0.6), 4), y=FY - 0.1)
    box('DoorWay', W / 2 - 1.3, W / 2 - 0.4, FY - 0.06, FY, 0, 2.6, M['trimDark'], bevel=0)
    box('DoorGlass', W / 2 - 1.15, W / 2 - 0.55, FY - 0.08, FY - 0.02, 0.3, 2.4, M['warm'], bevel=0)
    upper_floors(W, GROUND, floors, 3, arch=True, frame='trimDark', fire_escape=True)
    roof_bits(W, H, water_tower=True, seed=11)


def cocktail(W=5.0):
    """A cocktail lounge: black brick, purple glow, a neon martini."""
    floors = 2
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['brickBlack'])
    spill(W, (0.7, 0.35, 1.0))
    door_x = dark_shop(W, '#15101e', '#7a3aff', door_x=W / 2 - 0.9)
    purple = neon('LoungePurple', (0.65, 0.25, 1.0), 10)
    pink = neon('LoungePink', (1.0, 0.25, 0.7), 10)
    green = neon('Olive', (0.4, 1.0, 0.3), 8)
    neon_frame(-W / 2 + 0.3, door_x - 0.66, 0.56, GROUND - 0.96, purple)
    sign_text('VELVET', -0.6, GROUND - 0.45, 0.5, pink)
    martini(door_x - 0.1, GROUND + 0.9, pink, green, s=0.9)
    upper_floors(W, GROUND + 0.6, floors, 3, frame='trimDark', fire_escape=False, plants=False)
    roof_bits(W, H, seed=12)


def karaoke(W=6.0):
    """A karaoke bar: pink and cyan neon, a tall blade sign, lanterns."""
    floors = 3
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['stuccoBlue'], top_mat=M['trimDark'])
    spill(W, (1.0, 0.35, 0.8))
    door_x = dark_shop(W, '#1a1030', '#ff4fb8', door_x=W / 2 - 1.0)
    pink = neon('KaraPink', (1.0, 0.2, 0.7), 10)
    cyan = neon('KaraCyan', (0.2, 0.9, 1.0), 9)
    sign_text('KARAOKE', -0.5, GROUND - 0.45, 0.48, cyan)
    neon_frame(-W / 2 + 0.3, door_x - 0.66, 0.56, GROUND - 0.96, pink)
    blade_sign('SING', -W / 2 + 0.5, H - 1.2, 0.55, pink, M['trimDark'])
    for i, x in enumerate([-1.5, -0.5, 0.5, 1.5]):
        lantern(x, GROUND + 0.3, ['#ff5a5a', '#ffd25a', '#ff5ad8', '#5ad8ff'][i])
    upper_floors(W, GROUND + 0.6, floors, 4, frame='trimDark', fire_escape=False, plants=False)
    roof_bits(W, H, seed=13)


def noodles(W=4.0):
    """A late-night noodle bar: red lanterns and a red vertical sign."""
    floors = 3
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['brick'])
    spill(W, (1.0, 0.35, 0.2))
    door_x = dark_shop(W, '#2a0e0e', '#ffb04a', door_x=W / 2 - 0.85)
    red = neon('NoodleRed', (1.0, 0.15, 0.1), 10)
    warm = neon('NoodleWarm', (1.0, 0.7, 0.2), 8)
    sign_text('NOODLES', -0.3, GROUND - 0.45, 0.42, warm)
    blade_sign('RAMEN', W / 2 - 0.4, H - 1.5, 0.55, red, M['trimDark'])
    for x in (-1.2, -0.2, 0.8):
        lantern(x, GROUND + 0.25, '#ff3a2a')
    upper_floors(W, GROUND + 0.6, floors, 2, frame='trimDark', fire_escape=True, plants=True)
    roof_bits(W, H, seed=14)


def tattoo(W=4.0):
    """A tattoo parlour: black front, red and cyan neon."""
    floors = 2
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['brickDark'])
    spill(W, (1.0, 0.2, 0.35))
    door_x = dark_shop(W, '#0e0e14', '#3a1020', door_x=W / 2 - 0.85)
    red = neon('TatRed', (1.0, 0.1, 0.2), 10)
    cyan = neon('TatCyan', (0.2, 0.95, 1.0), 9)
    sign_text('TATTOO', -0.3, GROUND - 0.45, 0.45, red)
    neon_frame(-W / 2 + 0.3, door_x - 0.66, 0.56, GROUND - 0.96, cyan)
    sign_text('OPEN', -0.5, 1.6, 0.35, red, y=FY - 0.1)
    upper_floors(W, GROUND + 0.6, floors, 2, frame='trimDark', fire_escape=False, plants=False)
    roof_bits(W, H, seed=15)


def liquor(W=5.0):
    """A corner liquor store: bright window, classic red neon."""
    floors = 2
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['stucco'])
    spill(W, (1.0, 0.3, 0.25))
    door_x = dark_shop(W, '#1e1e24', '#ffe08a', door_x=W / 2 - 1.0)
    red = neon('LiqRed', (1.0, 0.12, 0.12), 10)
    blue = neon('LiqBlue', (0.25, 0.5, 1.0), 9)
    sign_text('LIQUOR', -0.5, GROUND - 0.45, 0.5, red)
    sign_text('24/7', -1.2, 1.55, 0.3, blue, y=FY - 0.1)
    for i in range(5):  # shelves of bottles in the window
        x = -W / 2 + 0.6 + i * 0.45
        if x > door_x - 0.8: break
        for z in (0.9, 1.6):
            box('Bottle', x - 0.06, x + 0.06, FY - 0.09, FY - 0.06, z, z + 0.4, principled('Btl', srgb(['#3a7a3a', '#7a3a1a', '#3a4a8a'][i % 3]), rough=0.2), bevel=0)
    upper_floors(W, GROUND + 0.6, floors, 3, frame='trimDark', fire_escape=True)
    roof_bits(W, H, seed=16)


def hotel(W=6.0):
    """A tall old hotel with a vertical HOTEL sign and a lit canopy."""
    floors = 5
    H = GROUND + floors * STOREY + 0.6
    body(W, H, M['brickDark'], top_mat=M['trimDark'])
    spill(W, (1.0, 0.7, 0.35))
    door_x = dark_shop(W, '#1a1410', '#ffcf7a', door_x=0.0)
    gold = neon('HotelGold', (1.0, 0.75, 0.25), 10)
    pink = neon('HotelPink', (1.0, 0.25, 0.6), 9)
    box('Canopy', -1.2, 1.2, FY - 1.6, FY, GROUND - 0.9, GROUND - 0.75, M['trimDark'], bevel=0.02)
    neon_tube('CanopyEdge', [(-1.2, FY - 1.62, GROUND - 0.82), (1.2, FY - 1.62, GROUND - 0.82)], 0.035, gold)
    blade_sign('HOTEL', W / 2 - 0.5, H - 1.0, 0.85, pink, M['trimDark'])
    sign_text('VACANCY', -1.4, GROUND - 0.45, 0.28, gold)
    upper_floors(W, GROUND + 0.6, floors, 4, frame='trimDark', fire_escape=False, ac=True, plants=False)
    roof_bits(W, H, seed=17)


BUILDINGS = {'walkup': walkup, 'diner': diner, 'laundromat': laundromat, 'walkupDark': walkup_dark, 'cocktail': cocktail,
             'karaoke': karaoke, 'noodles': noodles, 'tattoo': tattoo, 'liquor': liquor, 'hotel': hotel}
WIDTHS = {'walkup': 5.0, 'diner': 6.0, 'laundromat': 5.0, 'walkupDark': 5.0, 'cocktail': 5.0, 'karaoke': 6.0,
          'noodles': 4.0, 'tattoo': 4.0, 'liquor': 5.0, 'hotel': 6.0}


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

def setup():
    scene = iso_rig.reset_scene()
    scene.cycles.samples = 48
    scene.render.resolution_x = CANVAS
    scene.render.resolution_y = CANVAS
    cam = iso_rig.add_camera(scene)
    cam.data.ortho_scale = CANVAS / iso_rig.PX_PER_UNIT
    forward = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    cam.location = Vector((0, 0, AIM_Z)) - forward * 60
    cam.data.clip_end = 200
    # Night light: a dim blue moon from above, warm street glow from the front.
    world = bpy.data.worlds.new('Night')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.03, 0.025, 0.07, 1)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world
    def sun(name, rot, energy, color):
        d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.color = color; d.angle = math.radians(8)
        o = bpy.data.objects.new(name, d); o.rotation_euler = [math.radians(a) for a in rot]; scene.collection.objects.link(o)
    sun('Moon', (35, 0, -35), 0.95, (0.6, 0.7, 1.0))
    sun('StreetGlow', (78, 0, -20), 0.8, (1.0, 0.45, 0.85))   # magenta neon spill from the street
    sun('SideGlow', (70, 0, 70), 0.45, (0.4, 0.5, 1.0))
    return scene, cam


def origin_px(scene, cam):
    bpy.context.view_layer.update()
    v = world_to_camera_view(scene, cam, Vector((0, 0, 0)))
    return v.x * CANVAS / iso_rig.SUPERSAMPLE, (1 - v.y) * CANVAS / iso_rig.SUPERSAMPLE


def build(name, preview_dir=None):
    global M
    R.seed(hash(name) % 1000)
    scene, cam = setup()
    bb.M.clear()
    M = mats()
    root = bpy.data.objects.new(f'Bldg_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    BUILDINGS[name](WIDTHS[name])
    iso_rig.add_outlines(scene, root)
    out_dir = preview_dir or bb.SPRITE_DIR
    os.makedirs(out_dir, exist_ok=True)
    facings = (0,) if preview_dir and not os.environ.get('BOTH') else (0, 90)
    meta = {'width': WIDTHS[name], 'depth': DEPTH, 'facings': {}}
    from PIL import Image
    for f in facings:
        root.rotation_euler = (0, 0, math.radians(f))
        path = os.path.join(out_dir, f'bldg_{name}_{f}.png')
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        ox, oy = origin_px(scene, cam)
        im = Image.open(path)
        l, t, r, b = im.getbbox()
        im = im.crop((l, t, r, b)).resize(((r - l) // 2, (b - t) // 2), Image.LANCZOS)
        im.save(path)
        meta['facings'][str(f)] = {'w': im.width, 'h': im.height, 'ox': round(ox - l / 2, 1), 'oy': round(oy - t / 2, 1)}
    json.dump(meta, open(os.path.join(out_dir, f'bldg_{name}.json'), 'w'), indent=1)
    print(name, meta, flush=True)


def main():
    args = sys.argv[1:]
    preview = None
    if args[:1] == ['--preview']:
        preview, args = args[1], args[2:]
    for name in args or list(BUILDINGS):
        build(name, preview)


M = {}
if __name__ == '__main__':
    main()
