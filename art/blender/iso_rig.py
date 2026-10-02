"""Shared Blender setup for Club Nova sprites.

Every prop is modelled at real scale where 1 Blender unit = 1 game tile
(1 m x 1 m), centred on the world origin, and rendered through the same
orthographic 2:1 dimetric camera the game's floor uses. Because the camera
is fixed, sprite size and anchor point are calculated, not measured: the
script writes them to a JSON file next to the PNGs and the game reads that.

Axis convention (the game grid is mirrored relative to Blender's XY):
    game +gx  ->  Blender +X   (down-right on screen)
    game +gy  ->  Blender -Y   (down-left on screen)
A prop's "front" (the side customers use) faces Blender -Y at facing 0.
Facing N is the model rotated N degrees about Z.
"""

import json
import math
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

# Must match game/src/config.js
TILE_W = 48                 # on-screen width of one tile, in game pixels
# Models are built at the original scale, where a tile was 64 px wide, and
# rendered this much bigger in tiles so they keep their size on screen: the
# finer grid matches Nightclub City, whose furniture fills more, smaller
# tiles. Footprints in the game's catalog are in the new tiles.
MODEL_SCALE = 64 / TILE_W
SUPERSAMPLE = 2             # sprites are rendered at 2x and drawn at half size
PX_PER_TILE = TILE_W * SUPERSAMPLE            # render pixels across one tile diamond
PX_PER_UNIT = PX_PER_TILE / math.sqrt(2)      # render pixels per Blender unit, horizontally
CANVAS = 768                # square render canvas in pixels, cropped afterwards
FACINGS = (0, 90, 180, 270)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    except TypeError:
        pass
    scene.render.film_transparent = True
    scene.cycles.film_transparent_glass = True
    scene.render.resolution_x = CANVAS
    scene.render.resolution_y = CANVAS
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    return scene


def add_camera(scene):
    cam_data = bpy.data.cameras.new('IsoCam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = CANVAS / PX_PER_UNIT
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100
    cam = bpy.data.objects.new('IsoCam', cam_data)
    scene.collection.objects.link(cam)
    # 60 deg tilt = 30 deg elevation, which makes a square tile a 2:1 diamond.
    cam.rotation_euler = (math.radians(60), 0, math.radians(45))
    forward = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    # Aim at a point 1 unit up so tall props sit in the middle of the canvas.
    cam.location = Vector((0, 0, 1.0)) - forward * 30
    scene.camera = cam
    return cam


def add_lighting(scene):
    world = bpy.data.worlds.new('ClubAmbient')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.05, 0.035, 0.09, 1)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world

    def area(name, loc, rot, energy, color, size):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.color = color
        data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = [math.radians(a) for a in rot]
        scene.collection.objects.link(obj)

    # Key light from the upper left of the camera, cool fill from the right,
    # magenta rim from behind: a club-lit look that matches the neon floor.
    area('Key', (-3.0, -5.0, 6.0), (40, 0, -30), 1400, (1.0, 0.93, 0.85), 4)
    area('Fill', (5.0, -2.0, 3.0), (65, 0, 65), 500, (0.6, 0.75, 1.0), 4)
    area('Rim', (1.0, 5.0, 4.0), (-50, 0, 170), 350, (1.0, 0.35, 0.8), 3)


# Dark drawn outlines around every prop, like Nightclub City's cartoon art
# (Blender's Freestyle line renderer). Glowing parts get no outline so neon
# stays bright.
OUTLINE_THICKNESS = 3.0               # render pixels (1.5 game pixels)
OUTLINE_COLOR = (0.015, 0.008, 0.02)


def _glows(obj):
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'EMISSION':
                return True
            if node.type == 'BSDF_PRINCIPLED' and node.inputs['Emission Strength'].default_value > 0.3:
                return True
    return False


def add_outlines(scene, root):
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = 'ABSOLUTE'
    scene.render.line_thickness = 1.0
    fs = bpy.context.view_layer.freestyle_settings
    fs.crease_angle = math.radians(137)
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new('Outlines')
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True
    ls.select_external_contour = True
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new('Outline')
    ls.linestyle.color = OUTLINE_COLOR
    ls.linestyle.thickness = OUTLINE_THICKNESS
    no_lines = bpy.data.collections.get('NoOutline') or bpy.data.collections.new('NoOutline')
    if no_lines.name not in scene.collection.children:
        scene.collection.children.link(no_lines)
    for o in root.children_recursive:
        if o.type == 'MESH' and _glows(o) and o.name not in no_lines.objects:
            no_lines.objects.link(o)
    ls.select_by_collection = True
    ls.collection = no_lines
    ls.collection_negation = 'EXCLUSIVE'


def apply_model_scale(root):
    """Scales a model up by MODEL_SCALE (on top of any scale it already
    has). Returns the previous scale so it can be put back."""
    before = tuple(root.scale)
    root.scale = tuple(c * MODEL_SCALE for c in before)
    bpy.context.view_layer.update()
    return before


def check_projection(scene, cam):
    """One tile step must move exactly TILE_W/2 x TILE_H/2 game pixels."""
    bpy.context.view_layer.update()  # make sure the camera's placement has taken effect
    def px(p):
        v = world_to_camera_view(scene, cam, Vector(p))
        return v.x * CANVAS, (1 - v.y) * CANVAS
    o = px((0, 0, 0))
    gx = px((1, 0, 0))
    gy = px((0, -1, 0))
    step_gx = ((gx[0] - o[0]) / SUPERSAMPLE, (gx[1] - o[1]) / SUPERSAMPLE)
    step_gy = ((gy[0] - o[0]) / SUPERSAMPLE, (gy[1] - o[1]) / SUPERSAMPLE)
    half, quarter = TILE_W / 2, TILE_W / 4
    assert abs(step_gx[0] - half) < 0.01 and abs(step_gx[1] - quarter) < 0.01, step_gx
    assert abs(step_gy[0] + half) < 0.01 and abs(step_gy[1] - quarter) < 0.01, step_gy
    return o


def render_facings(scene, cam, root, name, out_dir, layers=None):
    """Render the prop at all four facings, crop every image to the same
    box, and write <name>.json with the game's displayWidth and origin.

    `layers` optionally maps a layer name to a list of the prop's objects;
    each layer is also rendered on its own (everything else hidden) as
    <name>_<layer>_<facing>.png with the same crop, so the game can draw
    something between them (a bartender between back bar and counter).
    It can also be a function of the facing returning such a map, when
    which parts are in front depends on the facing (seating)."""
    from PIL import Image

    origin_px = check_projection(scene, cam)
    add_outlines(scene, root)
    old_scale = apply_model_scale(root)
    os.makedirs(out_dir, exist_ok=True)
    layers_at = layers if callable(layers) else (lambda facing: layers or {})
    everything = [o for o in root.children_recursive]
    raw = {}
    raw_layers = {lname: {} for lname in layers_at(0)}
    for facing in FACINGS:
        root.rotation_euler = (0, 0, math.radians(facing))
        path = os.path.join(out_dir, f'{name}_{facing}.png')
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        raw[facing] = Image.open(path).convert('RGBA')
        for lname, objs in layers_at(facing).items():
            keep = set(objs)
            for o in everything:
                o.hide_render = o not in keep
            path = os.path.join(out_dir, f'{name}_{lname}_{facing}.png')
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            raw_layers[lname][facing] = Image.open(path).convert('RGBA')
        for o in everything:
            o.hide_render = False
    root.rotation_euler = (0, 0, 0)
    root.scale = old_scale

    # One shared crop box (the union of all four silhouettes, plus a small
    # margin) so every facing and layer has the same size and anchor point.
    boxes = [img.getchannel('A').point(lambda a: 255 if a > 2 else 0).getbbox() for img in raw.values()]
    pad = 4
    left = max(0, min(b[0] for b in boxes) - pad)
    top = max(0, min(b[1] for b in boxes) - pad)
    right = min(CANVAS, max(b[2] for b in boxes) + pad)
    bottom = min(CANVAS, max(b[3] for b in boxes) + pad)
    crop = (left, top, right, bottom)
    for facing, img in raw.items():
        img.crop(crop).save(os.path.join(out_dir, f'{name}_{facing}.png'), optimize=True)
    for lname, imgs in raw_layers.items():
        for facing, img in imgs.items():
            img.crop(crop).save(os.path.join(out_dir, f'{name}_{lname}_{facing}.png'), optimize=True)

    width, height = right - left, bottom - top
    meta = {
        'displayWidth': width / SUPERSAMPLE,
        'originX': round((origin_px[0] - left) / width, 5),
        'originY': round((origin_px[1] - top) / height, 5),
        'imageSize': [width, height],
    }
    if raw_layers:
        meta['layers'] = sorted(raw_layers)
    with open(os.path.join(out_dir, f'{name}.json'), 'w') as f:
        json.dump(meta, f, indent=2)
        f.write('\n')
    return meta


def make_bar_piece(root, copies=3, squeeze=0.75):
    """Turns a one-unit-wide bar module into a joinable bar piece, like
    Nightclub City's long bars: `copies` of the module side by side along
    X (the counter), then the whole thing squeezed horizontally so the
    piece fits exactly `copies` x 3 game tiles once render_facings() applies
    MODEL_SCALE (3 * 0.75 * 4/3 = 3). Heights are unchanged. The modules'
    ends meet, so pieces placed side by side make one continuous bar."""
    originals = list(root.children)
    for k in range(copies):
        offset = k - (copies - 1) / 2
        if offset == 0:
            continue  # the originals are the middle module
        for o in originals:
            twin = o.copy()  # shares the mesh and materials
            bpy.context.scene.collection.objects.link(twin)
            twin.parent = root
            twin.location.x = o.location.x + offset
    root.scale = (squeeze, squeeze, 1.0)
    bpy.context.view_layer.update()


def split_counter(root, y_split=-0.6):
    """Splits a bar's parts into 'front' (the customer counter, on the -Y
    tile at rest) and 'back' (back bar and aisle), by where each part sits."""
    bpy.context.view_layer.update()
    front, back = [], []
    for o in root.children_recursive:
        if o.type != 'MESH':
            continue
        corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
        cy = sum(c.y for c in corners) / 8
        (front if cy < y_split else back).append(o)
    return {'front': front, 'back': back}
