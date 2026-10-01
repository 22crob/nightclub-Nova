"""Builds Club Nova's seating in Blender and renders their sprites.

Run from the repo root with a Python that has the `bpy` module and pillow:
    python art/blender/build_seating.py                    # everything
    python art/blender/build_seating.py couch stool        # only some
    python art/blender/build_seating.py --preview DIR couch
        # facing 0 only (whole, back and front layers), written to DIR

Seating is drawn in two layers, and seated patrons are drawn between them:
'front' always goes on top. Seats, arms and tables are always in front.
Parts whose name starts with "Back" (backrests) are behind the patrons
unless, at that facing, they stand between the patrons and the camera;
so a backrest moves to the front layer when the piece faces away.

Each piece also lists its seats: where a patron sits, in Blender units at
facing 0 relative to the model's centre, and `sitLift`, how far a seated
patron is raised (bar stools lift them so their legs dangle). These are
added to <name>.json for the game.

Front faces -Y at rest; seated patrons face that way. For scale: a bar
counter is 1.0 tall and a patron about 1.5.
"""

import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_bar as bb  # noqa: E402
from build_bars import plain, srgb  # noqa: E402
from build_decor import sphere  # noqa: E402

box, cylinder, cone = bb.box, bb.cylinder, bb.cone
principled, neon = bb.principled, bb.neon


def arc_block(name, cx, cy, r0, r1, a0, a1, z0, z1, mat, bevel=0.02):
    """A curved block: the ring between radii r0 and r1, from angle a0 to a1
    (degrees, 90 = +Y), between heights z0 and z1."""
    import bmesh
    steps = max(4, int(abs(a1 - a0) / 8))
    bm = bmesh.new()
    rings = []
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((cx + r * c, cy + r * s, z)) for r, z in ((r0, z0), (r1, z0), (r1, z1), (r0, z1))])
    for k in range(steps):
        a, b = rings[k], rings[k + 1]
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return bb._finish(obj, mat, bevel)


def candle(name, x, y, z):
    cylinder(f'{name}Glass', x, y, z, z + 0.07, 0.035, principled(f'{name}Jar', (1.0, 0.75, 0.4), rough=0.1,
             emission=(1.0, 0.55, 0.15), emission_strength=1.5, alpha=0.8), verts=12)
    sphere(f'{name}Flame', x, y, z + 0.09, 0.018, neon(f'{name}Fire', (1.0, 0.7, 0.25), 8), scale=(1, 1, 1.6), segments=8)


# --------------------------------------------------------------------------
# Fabric couch: 2 x 1 tiles, two seats.
# --------------------------------------------------------------------------

def build_couch():
    fabric = plain('#6f6a86', rough=0.9)
    cushion = plain('#7f7a98', rough=0.9)
    leg = plain('#2a2420', rough=0.6)
    for x in (-0.86, 0.86):
        for y in (-0.36, 0.3):
            cylinder(f'Leg{x}{y}', x, y, 0, 0.08, 0.035, leg, verts=10)
    box('Base', -0.92, 0.92, -0.4, 0.38, 0.08, 0.3, fabric, bevel=0.04)
    for i, x in enumerate((-0.42, 0.42)):
        box(f'Seat{i}', x - 0.4, x + 0.4, -0.42, 0.18, 0.3, 0.42, cushion, bevel=0.05)
        box(f'BackCushion{i}', x - 0.4, x + 0.4, 0.12, 0.3, 0.42, 0.78, cushion, bevel=0.06)
    box('BackRest', -0.92, 0.92, 0.26, 0.4, 0.3, 0.84, fabric, bevel=0.05)
    for x in (-0.92, 0.82):
        box(f'Arm{x}', x, x + 0.1, -0.42, 0.4, 0.3, 0.6, fabric, bevel=0.04)
    return {'seats': [[-0.42, -0.05], [0.42, -0.05]], 'sitLift': 0.0}


# --------------------------------------------------------------------------
# Chrome bar stool: 1 tile, one seat; patrons perch with legs dangling.
# --------------------------------------------------------------------------

def build_stool():
    chrome = plain('#d6d9e2', rough=0.18)
    white = principled('StoolWhite', srgb('#f4f2ee'), rough=0.3)
    red = principled('StoolRed', srgb('#c8142c'), rough=0.6)
    cylinder('BackBase', 0, 0, 0, 0.04, 0.2, chrome, verts=32)
    cylinder('BackPole', 0, 0, 0.04, 0.62, 0.03, chrome, verts=12)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.012, location=(0, 0, 0.3))
    bb._finish(bpy.context.active_object, chrome, 0)
    bpy.context.active_object.name = 'BackFootRing'
    cylinder('SeatShell', 0, 0, 0.6, 0.68, 0.2, white, verts=32)
    cylinder('SeatCushion', 0, 0, 0.68, 0.74, 0.19, red, verts=32)
    return {'seats': [[0.0, 0.0]], 'sitLift': 0.3}


# --------------------------------------------------------------------------
# Red velvet booth: 2 x 2 tiles, a curved sofa around a round table.
# --------------------------------------------------------------------------

def build_velvet_booth():
    velvet = principled('Velvet', srgb('#b0102a'), rough=0.85)
    velvet_dark = principled('VelvetDark', srgb('#7c0a1e'), rough=0.85)
    gold = principled('BoothGold', srgb('#e2b23a'), rough=0.25)
    table_top = principled('TableTop', srgb('#1a1418'), rough=0.15)
    a0, a1 = -25, 205  # the arc, open toward -Y
    arc_block('Plinth', 0, 0.05, 0.5, 0.92, a0, a1, 0, 0.1, plain('#2a1a1e', rough=0.6), bevel=0.01)
    arc_block('Seat', 0, 0.05, 0.5, 0.88, a0, a1, 0.1, 0.42, velvet, bevel=0.04)
    # The backrest is made of short pieces so each can go in front of or
    # behind the patrons on its own (see layers_at()).
    n = 10
    for k in range(n):
        b0, b1 = a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n
        arc_block(f'BackRest{k}', 0, 0.05, 0.78, 0.94, b0, b1, 0.42, 1.0, velvet_dark, bevel=0.0)
        arc_block(f'BackPiping{k}', 0, 0.05, 0.77, 0.95, b0, b1, 0.98, 1.02, gold, bevel=0.0)
    # Tufted buttons on the backrest.
    for k in range(9):
        a = math.radians(a0 + 10 + k * (a1 - a0 - 20) / 8)
        for z in (0.6, 0.82):
            sphere(f'BackButton{k}{z}', 0.77 * math.cos(a), 0.05 + 0.77 * math.sin(a), z, 0.018, gold, segments=8)
    # Round table with drinks and a candle.
    cylinder('TableFoot', 0, -0.1, 0, 0.04, 0.2, gold, verts=24)
    cylinder('TableStem', 0, -0.1, 0.04, 0.52, 0.035, gold, verts=12)
    cylinder('Table', 0, -0.1, 0.52, 0.56, 0.32, table_top, verts=40)
    cylinder('TableRim', 0, -0.1, 0.515, 0.525, 0.325, gold, verts=40)
    candle('Candle', 0.0, -0.1, 0.56)
    for i, (x, y, c) in enumerate([(-0.16, -0.02, '#ff4d8d'), (0.15, -0.2, '#3de0ff')]):
        drink = principled(f'Drink{i}', srgb(c), rough=0.1, emission=srgb(c), emission_strength=0.6, alpha=0.85)
        cone(f'Glass{i}', x, y, 0.56, 0.68, 0.03, 0.045, drink, verts=12)
    seats = [[0.64 * math.cos(math.radians(a)), 0.05 + 0.64 * math.sin(math.radians(a))] for a in (150, 90, 30)]
    return {'seats': [[round(x, 3), round(y, 3)] for x, y in seats], 'sitLift': 0.0}


SEATING = {
    'couch': build_couch,
    'stool': build_stool,
    'velvetBooth': build_velvet_booth,
}


def layers_at(root, seats):
    """Returns a function of the facing giving the back/front layers."""
    from mathutils import Vector
    bpy.context.view_layer.update()
    meshes = [o for o in root.children_recursive if o.type in ('MESH', 'CURVE', 'FONT')]
    centre = {o: sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8 for o in meshes}

    def at(facing):
        # Direction to the camera in the model's own space at this facing.
        a = math.radians(-45 - facing)
        to_cam = (math.cos(a), math.sin(a))
        depth = lambda x, y: x * to_cam[0] + y * to_cam[1]
        seat_depth = max(depth(x, y) for x, y in seats)
        front = [o for o in meshes if not o.name.startswith('Back')
                 or depth(centre[o].x, centre[o].y) > seat_depth + 0.08]
        return {'back': [o for o in meshes if o not in front], 'front': front}
    return at


def build(name, preview_dir=None):
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    bb.M.clear()
    root = bpy.data.objects.new(f'Seat_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    info = SEATING[name]()
    layers = layers_at(root, info['seats'])
    base = f'seat_{name}'
    if preview_dir:
        os.makedirs(preview_dir, exist_ok=True)
        origin = iso_rig.check_projection(scene, cam)
        everything = list(root.children_recursive)
        for lname, objs in [('all', everything)] + list(layers(0).items()):
            keep = set(objs)
            for o in everything:
                o.hide_render = o not in keep
            scene.render.filepath = os.path.join(preview_dir, f'{base}_{lname}.png')
            bpy.ops.render.render(write_still=True)
        print(f'{base} origin_px:', origin, flush=True)
        return
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'{base}.blend'))
    meta = iso_rig.render_facings(scene, cam, root, base, bb.SPRITE_DIR, layers=layers)
    meta.update(info)
    with open(os.path.join(bb.SPRITE_DIR, f'{base}.json'), 'w') as f:
        json.dump(meta, f, indent=2)
        f.write('\n')
    print(f'{base}:', meta, flush=True)


def main():
    args = sys.argv[1:]
    preview = None
    if args[:1] == ['--preview']:
        preview, args = args[1], args[2:]
    for name in args or list(SEATING):
        build(name, preview)


if __name__ == '__main__':
    main()
