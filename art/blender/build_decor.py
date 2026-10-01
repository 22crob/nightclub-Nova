"""Builds Club Nova's decorations in Blender and renders their sprites.

Run from the repo root with a Python that has the `bpy` module and pillow:
    python art/blender/build_decor.py                  # all decorations
    python art/blender/build_decor.py speaker lava     # only some
    python art/blender/build_decor.py --preview DIR speaker
        # facing 0 only, written to DIR, for a quick look before a full render

Decorations sit on one tile (x, y in [-0.5, 0.5]) unless noted, and face -Y
at rest. See art/REFERENCE_NOTES.md for the look we're going for. For
scale: a patron stands about 2.4 units tall, a bar counter 1.0.

Each decoration writes decor_<name>_{0,90,180,270}.png and
decor_<name>.json to game/src/assets/sprites/, and decor_<name>.blend here.
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

box, cylinder, cone = bb.box, bb.cylinder, bb.cone
principled, neon = bb.principled, bb.neon


def sphere(name, x, y, z, r, mat, scale=(1, 1, 1), segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=r, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    return bb._finish(obj, mat, 0)


def ring_y(name, x, y, z, major, minor, mat):
    """A torus standing upright, facing -Y (like a speaker's woofer ring)."""
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=(x, y, z),
                                     rotation=(math.radians(90), 0, 0), major_segments=40, minor_segments=10)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return bb._finish(obj, mat, 0)


def disc_y(name, x, y, z, r, depth, mat):
    """A flat disc facing -Y."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=r, depth=depth, location=(x, y, z),
                                        rotation=(math.radians(90), 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return bb._finish(obj, mat, 0)


# --------------------------------------------------------------------------
# Speaker tower: a tall black cabinet, big woofer below and a smaller one
# above, each with a glowing cyan ring.
# --------------------------------------------------------------------------

def build_speaker():
    cab = principled('SpkCab', srgb('#2a2b31'), rough=0.35)
    trim = plain('#5d5f68', rough=0.3)
    cone_mat = principled('SpkCone', srgb('#121216'), rough=0.6)
    dust = principled('SpkDust', srgb('#3a3b42'), rough=0.3)
    cyan = neon('SpkCyan', (0.1, 0.85, 1.0), 9)
    H = 2.9
    front = -0.33
    box('Feet', -0.36, 0.36, -0.31, 0.31, 0, 0.06, trim, bevel=0.01)
    box('Cabinet', -0.38, 0.38, front, 0.33, 0.06, H - 0.04, cab, bevel=0.035)
    box('Cap', -0.39, 0.39, front - 0.01, 0.34, H - 0.05, H, plain('#4a4c55', rough=0.75), bevel=0.02)
    for name, z, r in (('Big', 0.8, 0.3), ('Small', 1.8, 0.21)):
        disc_y(f'{name}Cone', 0, front - 0.005, z, r, 0.02, cone_mat)
        sphere(f'{name}Dust', 0, front - 0.02, z, r * 0.32, dust, scale=(1, 0.45, 1))
        ring_y(f'{name}Ring', 0, front - 0.02, z, r + 0.012, 0.022, cyan)
        ring_y(f'{name}Surround', 0, front - 0.012, z, r * 0.78, 0.012, trim)
    # Tweeter and a port slot near the top.
    disc_y('Tweeter', 0, front - 0.005, 2.4, 0.07, 0.02, cone_mat)
    ring_y('TweeterRing', 0, front - 0.015, 2.4, 0.08, 0.012, cyan)
    box('Port', -0.22, 0.22, front - 0.004, front + 0.01, 2.62, 2.68, cone_mat, bevel=0.01)


# --------------------------------------------------------------------------
# Lava lamp: a big one, on its own stand, glowing red-orange.
# --------------------------------------------------------------------------

def build_lava():
    metal = plain('#b9bcc8', rough=0.2)
    glass = principled('LavaGlass', (0.8, 0.05, 0.12), rough=0.1, emission=(0.9, 0.03, 0.1), emission_strength=0.5, alpha=0.6)
    blob = principled('LavaBlob', (1.0, 0.55, 0.05), rough=0.3, emission=(1.0, 0.45, 0.02), emission_strength=1.2)
    cone('Base', 0, 0, 0, 0.55, 0.3, 0.14, metal, verts=40)
    cylinder('Collar', 0, 0, 0.55, 0.62, 0.15, metal, verts=40)
    cone('GlassLow', 0, 0, 0.62, 1.25, 0.14, 0.2, glass, verts=40)
    cone('GlassHigh', 0, 0, 1.25, 1.75, 0.2, 0.11, glass, verts=40)
    cone('Cap', 0, 0, 1.75, 1.95, 0.12, 0.06, metal, verts=40)
    for i, (x, y, z, r) in enumerate([(0.0, 0.0, 0.78, 0.09), (0.04, -0.02, 1.08, 0.07), (-0.05, 0.02, 1.4, 0.06),
                                     (0.02, 0.0, 1.62, 0.045)]):
        sphere(f'Blob{i}', x, y, z, r, blob, scale=(1, 1, 1.35))


# --------------------------------------------------------------------------
# Aquarium: a glowing blue glass tank with fish and plants on a cabinet.
# --------------------------------------------------------------------------

def build_aquarium():
    cabinet = principled('AquaCab', srgb('#1d1a24'), rough=0.3)
    trim = plain('#b8bcc8', rough=0.25)
    water = principled('AquaWater', (0.05, 0.35, 0.9), rough=0.05, emission=(0.03, 0.25, 0.9), emission_strength=0.5, alpha=0.4)
    back = principled('AquaBack', srgb('#0a2a6a'), rough=0.6, emission=srgb('#1650c0'), emission_strength=0.6)
    gravel = plain('#d8c38a', rough=0.8)
    plant = principled('AquaPlant', srgb('#2bd46a'), rough=0.5, emission=srgb('#1a8a40'), emission_strength=1.2)
    fish_o = principled('AquaFishO', srgb('#ff8a1f'), rough=0.3, emission=srgb('#ff6a00'), emission_strength=1.8)
    fish_y = principled('AquaFishY', srgb('#ffe03a'), rough=0.3, emission=srgb('#ffb000'), emission_strength=1.8)
    lamp = neon('AquaLamp', (0.6, 0.9, 1.0), 6)
    box('Cabinet', -0.42, 0.42, -0.4, 0.4, 0, 0.55, cabinet, bevel=0.03)
    box('CabTrim', -0.43, 0.43, -0.41, 0.41, 0.52, 0.58, trim, bevel=0.01)
    box('Gravel', -0.38, 0.38, -0.36, 0.36, 0.58, 0.68, gravel, bevel=0.01)
    box('BackWall', -0.39, 0.39, 0.36, 0.38, 0.68, 1.68, back, bevel=0)
    box('SideWall', -0.4, -0.38, -0.37, 0.38, 0.68, 1.68, back, bevel=0)
    box('Water', -0.4, 0.4, -0.38, 0.38, 0.58, 1.68, water, bevel=0.02)
    box('Lid', -0.43, 0.43, -0.41, 0.41, 1.68, 1.76, trim, bevel=0.012)
    box('LidLamp', -0.36, 0.36, -0.42, -0.41, 1.7, 1.73, lamp, bevel=0)
    for i, (x, y, h) in enumerate([(-0.25, 0.18, 0.55), (-0.15, 0.25, 0.75), (0.22, 0.2, 0.62), (0.28, 0.05, 0.4)]):
        cone(f'Plant{i}', x, y, 0.68, 0.68 + h, 0.07, 0.01, plant, verts=10)
    for i, (x, y, z, m) in enumerate([(-0.08, -0.05, 1.1, fish_o), (0.15, -0.12, 1.35, fish_y), (-0.2, -0.15, 1.45, fish_o)]):
        sphere(f'Fish{i}', x, y, z, 0.07, m, scale=(1.5, 0.55, 0.85), segments=16)
        cone(f'Tail{i}', x - 0.13, y, z - 0.045, z + 0.045, 0.0, 0.05, m, verts=8)
    # Bubbles.
    bubble = principled('AquaBubble', (0.9, 0.97, 1.0), rough=0.0, emission=(0.8, 0.95, 1.0), emission_strength=1.5)
    for i, z in enumerate((0.85, 1.05, 1.25, 1.48)):
        sphere(f'Bubble{i}', 0.3, -0.2, z, 0.022 + i * 0.004, bubble, segments=10)


# Some models are built small and scaled up as a whole.
SCALE = {'lava': (1.15, 1.15, 1.2), 'aquarium': (1.0, 1.0, 1.25)}

DECOR = {
    'speaker': build_speaker,
    'lava': build_lava,
    'aquarium': build_aquarium,
}


def build(name, preview_dir=None):
    scene = iso_rig.reset_scene()
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    bb.M.clear()
    root = bpy.data.objects.new(f'Decor_{name}', None)
    scene.collection.objects.link(root)
    bb.ROOT = root
    DECOR[name]()
    root.scale = SCALE.get(name, (1, 1, 1))
    if preview_dir:
        os.makedirs(preview_dir, exist_ok=True)
        origin = iso_rig.check_projection(scene, cam)
        scene.render.filepath = os.path.join(preview_dir, f'decor_{name}.png')
        bpy.ops.render.render(write_still=True)
        print(f'decor_{name} origin_px:', origin, flush=True)
        return
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'decor_{name}.blend'))
    meta = iso_rig.render_facings(scene, cam, root, f'decor_{name}', bb.SPRITE_DIR)
    print(f'decor_{name}:', meta, flush=True)


def main():
    args = sys.argv[1:]
    preview = None
    if args[:1] == ['--preview']:
        preview, args = args[1], args[2:]
    for name in args or list(DECOR):
        build(name, preview)


if __name__ == '__main__':
    main()
