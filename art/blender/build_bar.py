"""Builds the Club Nova bar in Blender and renders its game sprites.

Run from the repo root with a Python that has the `bpy` module:
    pip install bpy==4.5.4 pillow
    python art/blender/build_bar.py

Writes art/blender/bar.blend, the four facing sprites
game/src/assets/sprites/bar_{0,90,180,270}.png and bar.json (their size and
anchor point, read by game/src/catalog.js).

The bar covers a 1 x 3 tile footprint (1 m wide, 3 m deep), one part per tile:
    front tile (Blender y -1.5..-0.5): customer counter, foot rail, beer taps
    middle tile (y -0.5..0.5):         bartender aisle with a rubber mat
    back tile  (y 0.5..1.5):           back bar cabinet with a lit bottle wall
Customers stand on the -Y side at facing 0 (game +gy).
"""

import math
import os
import random
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
SPRITE_DIR = os.path.join(REPO, 'game', 'src', 'assets', 'sprites')

random.seed(7)

# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------

def principled(name, color, rough=0.5, metal=0.0, transmission=0.0, ior=1.45,
               emission=None, emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Transmission Weight'].default_value = transmission
    bsdf.inputs['IOR'].default_value = ior
    bsdf.inputs['Alpha'].default_value = alpha
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    return mat


def wood(name, dark, light):
    """Walnut with vertical grain on every side: the wave texture runs along
    (x + y), so grain lines stay upright on faces pointing along X or Y."""
    mat = principled(name, dark, rough=0.42)
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    squash = nt.nodes.new('ShaderNodeMath')
    squash.operation = 'MULTIPLY'
    squash.inputs[1].default_value = 0.06
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs['Scale'].default_value = 14.0
    wave.inputs['Distortion'].default_value = 2.5
    wave.inputs['Detail'].default_value = 4.0
    wave.inputs['Detail Scale'].default_value = 1.5
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].color = (*light, 1)
    nt.links.new(coord.outputs['Object'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['X'], add.inputs[0])
    nt.links.new(sep.outputs['Y'], add.inputs[1])
    nt.links.new(sep.outputs['Z'], squash.inputs[0])
    nt.links.new(add.outputs['Value'], comb.inputs['X'])
    nt.links.new(squash.outputs['Value'], comb.inputs['Y'])
    nt.links.new(comb.outputs['Vector'], wave.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def neon(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    return mat


M = {}


def build_materials():
    M['wood'] = wood('Walnut', (0.07, 0.032, 0.015), (0.2, 0.095, 0.045))
    M['wood_dark'] = wood('WalnutDark', (0.035, 0.017, 0.009), (0.09, 0.045, 0.022))
    M['stone'] = principled('BlackStone', (0.018, 0.02, 0.026), rough=0.12)
    M['black'] = principled('MatteBlack', (0.008, 0.008, 0.01), rough=0.7)
    M['rubber'] = principled('Rubber', (0.012, 0.012, 0.014), rough=0.95)
    M['chrome'] = principled('Chrome', (0.85, 0.85, 0.9), rough=0.12, metal=1.0)
    M['brass'] = principled('Brass', (0.85, 0.55, 0.22), rough=0.25, metal=1.0)
    M['glass'] = principled('Glass', (0.9, 0.95, 1.0), rough=0.02, transmission=1.0,
                            emission=(0.4, 0.8, 1.0), emission_strength=0.15)
    M['shelf_glass'] = principled('ShelfGlass', (0.7, 0.85, 0.9), rough=0.05, transmission=1.0)
    M['neon_pink'] = neon('NeonPink', (1.0, 0.08, 0.55), 30)
    M['neon_cyan'] = neon('NeonCyan', (0.1, 0.75, 1.0), 14)
    M['backlight'] = neon('Backlight', (1.0, 0.5, 0.18), 3.5)
    M['cocktail'] = neon('Cocktail', (1.0, 0.25, 0.6), 3)
    bottle_colors = [(0.9, 0.45, 0.08), (0.12, 0.45, 0.15), (0.85, 0.85, 0.8),
                     (0.15, 0.3, 0.8), (0.7, 0.1, 0.12), (0.9, 0.7, 0.2)]
    M['bottles'] = [principled(f'Bottle{i}', c, rough=0.08, transmission=0.85,
                               emission=c, emission_strength=0.6)
                    for i, c in enumerate(bottle_colors)]
    M['handles'] = [principled(f'Handle{i}', c, rough=0.35)
                    for i, c in enumerate([(0.9, 0.1, 0.5), (0.1, 0.7, 0.9), (0.95, 0.75, 0.2)])]


# --------------------------------------------------------------------------
# Geometry helpers. Every part is parented to one root empty so the whole
# bar can be rotated for each facing.
# --------------------------------------------------------------------------

ROOT = None


def _finish(obj, mat, bevel):
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    obj.parent = ROOT
    return obj


def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, mat, bevel)


def cylinder(name, x, y, z0, z1, r, mat, verts=24):
    """Upright cylinder from z0 to z1."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return _finish(obj, mat, 0)


def rod_x(name, x0, x1, y, z, r, mat, verts=20):
    """Horizontal cylinder running along X."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=x1 - x0, location=((x0 + x1) / 2, y, z),
                                        rotation=(0, math.radians(90), 0))
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return _finish(obj, mat, 0)


def cone(name, x, y, z0, z1, r_bottom, r_top, mat, verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r_bottom, radius2=r_top, depth=z1 - z0,
                                    location=(x, y, (z0 + z1) / 2))
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return _finish(obj, mat, 0)


def slats(name, x0, x1, y_face, outward, z0, z1, count, mat):
    """Vertical wood slats on a face at y=y_face, sticking out by `outward`."""
    gap = 0.014
    w = (x1 - x0 - gap * (count - 1)) / count
    for i in range(count):
        a = x0 + i * (w + gap)
        ya, yb = sorted((y_face, y_face + outward))
        box(f'{name}{i}', a, a + w, ya, yb, z0, z1, mat, bevel=0.003)


def bottle(name, x, y, z, height, mat):
    body = height * 0.62
    cylinder(f'{name}Body', x, y, z, z + body, 0.034, mat)
    cone(f'{name}Shoulder', x, y, z + body, z + body + height * 0.12, 0.034, 0.012, mat)
    cylinder(f'{name}Neck', x, y, z + body + height * 0.12, z + height - 0.02, 0.012, mat, verts=12)
    cylinder(f'{name}Cap', x, y, z + height - 0.02, z + height, 0.014, M['black'], verts=12)


def tumbler(name, x, y, z):
    cylinder(name, x, y, z, z + 0.085, 0.03, M['glass'], verts=16)


# --------------------------------------------------------------------------
# The bar
# --------------------------------------------------------------------------

def build_front_counter():
    # Customer-facing counter, front tile. Customer face at y = -1.30.
    box('CounterKick', -0.46, 0.46, -1.26, -0.8, 0.0, 0.09, M['black'])
    box('CounterBody', -0.47, 0.47, -1.30, -0.8, 0.09, 1.02, M['wood_dark'])
    slats('CounterSlat', -0.465, 0.465, -1.30, -0.016, 0.1, 1.0, 11, M['wood'])
    box('CounterTop', -0.49, 0.49, -1.42, -0.74, 1.02, 1.08, M['stone'], bevel=0.01)
    # Neon strip tucked under the overhang, and a glow line at the floor.
    box('CounterNeon', -0.46, 0.46, -1.37, -1.35, 0.998, 1.012, M['neon_pink'], bevel=0)
    box('CounterFaceNeon', -0.46, 0.46, -1.335, -1.318, 0.965, 0.985, M['neon_pink'], bevel=0)
    box('CounterFloorGlow', -0.45, 0.45, -1.285, -1.27, 0.03, 0.045, M['neon_cyan'], bevel=0)
    # Brass foot rail with two brackets.
    rod_x('FootRail', -0.44, 0.44, -1.43, 0.2, 0.018, M['brass'])
    for x in (-0.36, 0.36):
        box(f'RailBracket{x}', x - 0.012, x + 0.012, -1.44, -1.30, 0.185, 0.215, M['brass'], bevel=0.003)
    # Beer tap tower on the counter.
    cylinder('TapTower', 0.22, -1.02, 1.08, 1.36, 0.035, M['chrome'])
    rod_x('TapManifold', 0.09, 0.35, -1.02, 1.37, 0.028, M['chrome'])
    for i, dx in enumerate((-0.09, 0.0, 0.09)):
        cylinder(f'TapHandle{i}', 0.22 + dx, -0.97, 1.39, 1.52, 0.013, M['handles'][i], verts=12)
        cylinder(f'TapSpout{i}', 0.22 + dx, -0.97, 1.31, 1.37, 0.008, M['chrome'], verts=10)
    # A cocktail waiting on the customer side.
    x, y, z = -0.24, -1.2, 1.08
    cylinder('CocktailFoot', x, y, z, z + 0.006, 0.028, M['glass'], verts=16)
    cylinder('CocktailStem', x, y, z, z + 0.07, 0.004, M['glass'], verts=8)
    cone('CocktailBowl', x, y, z + 0.07, z + 0.13, 0.004, 0.055, M['glass'])
    cone('CocktailDrink', x, y, z + 0.075, z + 0.118, 0.003, 0.046, M['cocktail'])
    # Bartender side: speed rail with bottles, facing the aisle.
    box('SpeedShelf', -0.4, 0.4, -0.8, -0.7, 0.44, 0.46, M['chrome'], bevel=0.002)
    for i in range(5):
        bottle(f'SpeedBottle{i}', -0.32 + i * 0.16, -0.75, 0.46, 0.28, M['bottles'][i % 6])
    rod_x('SpeedRail', -0.4, 0.4, -0.69, 0.56, 0.008, M['chrome'], verts=16)


def build_aisle():
    box('AisleMat', -0.44, 0.44, -0.68, 0.76, 0.0, 0.012, M['rubber'], bevel=0.004)
    for i in range(1, 9):
        y = -0.68 + i * 0.16
        box(f'MatRib{i}', -0.43, 0.43, y - 0.006, y + 0.006, 0.012, 0.016, M['black'], bevel=0)


def build_back_bar():
    # Cabinet, back tile. Aisle face at y = 0.85.
    box('CabinetKick', -0.46, 0.46, 0.88, 1.35, 0.0, 0.08, M['black'])
    box('CabinetBody', -0.47, 0.47, 0.85, 1.4, 0.08, 0.9, M['wood_dark'])
    slats('CabinetSlat', -0.465, 0.465, 0.85, -0.016, 0.09, 0.88, 11, M['wood'])
    box('CabinetTop', -0.49, 0.49, 0.8, 1.44, 0.9, 0.95, M['stone'], bevel=0.01)
    box('CabinetNeon', -0.46, 0.46, 0.79, 0.805, 0.905, 0.935, M['neon_cyan'], bevel=0)
    # Two rows of glasses along the front of the cabinet top.
    for row, y in enumerate((0.9, 0.99)):
        for i in range(6):
            tumbler(f'Glass{row}_{i}', -0.39 + i * 0.156 + row * 0.04, y, 0.95)

    # Lit bottle wall.
    box('WallBack', -0.49, 0.49, 1.4, 1.48, 0.95, 2.22, M['wood_dark'])
    box('WallLight', -0.44, 0.44, 1.392, 1.402, 0.98, 2.18, M['backlight'], bevel=0)
    for x in (-0.47, 0.47):
        box(f'WallPost{x}', x - 0.025, x + 0.025, 1.1, 1.48, 0.95, 2.22, M['wood'])
    box('WallCrown', -0.5, 0.5, 1.06, 1.49, 2.22, 2.3, M['black'], bevel=0.01)
    box('CrownNeon', -0.47, 0.47, 1.05, 1.062, 2.245, 2.275, M['neon_pink'], bevel=0)
    shelf_heights = (1.36, 1.77)
    for j, z in enumerate(shelf_heights):
        box(f'Shelf{j}', -0.44, 0.44, 1.12, 1.39, z - 0.015, z, M['shelf_glass'], bevel=0.002)
        box(f'ShelfLed{j}', -0.44, 0.44, 1.115, 1.125, z - 0.03, z - 0.018, M['neon_cyan'], bevel=0)
    # Bottles: one row on the cabinet top, one on each shelf.
    for row, z in enumerate((0.95, *shelf_heights)):
        for i in range(6):
            x = -0.36 + i * 0.144 + random.uniform(-0.01, 0.01)
            h = random.uniform(0.25, 0.32)
            bottle(f'Bottle{row}_{i}', x, 1.27, z, h, random.choice(M['bottles']))


def main():
    global ROOT
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    build_materials()

    ROOT = bpy.data.objects.new('Bar', None)
    scene.collection.objects.link(ROOT)
    build_front_counter()
    build_aisle()
    build_back_bar()

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'bar.blend'))
    meta = iso_rig.render_facings(scene, cam, ROOT, 'bar', SPRITE_DIR, layers=iso_rig.split_counter(ROOT))
    print('bar sprite meta:', meta)


if __name__ == '__main__':
    main()
