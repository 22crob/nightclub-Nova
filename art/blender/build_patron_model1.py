"""Guests from the owner's own 3D model (art/characters/character_model_1*,
rigged and animated in Mixamo): dresses him (clothes, hair and a painted
face, through build_patron3d.py's colouring) and renders his animations
into a spritesheet for the game, with its own frame grid in a JSON beside
it (the drawn guests' grid in patrons.json is too small for these clips).

Run from the repo root with a Python that has bpy==4.5.4 and pillow:
    python art/blender/build_patron_model1.py                  # the sheet
    python art/blender/build_patron_model1.py --preview DIR    # a few stills
    python art/blender/build_patron_model1.py --look NAME      # another outfit

Clips (art/mixamo/model1/<clip>.fbx, all the same character and skeleton):
walk, dance, sit, sittalk (sitting and talking), drink. The walk is pinned
in place (the game moves guests itself). There is no standing idle yet:
until idle.fbx arrives, idle holds the first frame of the drink.

Sitting: the game seats guests the way the drawn ones sit, with the hips
at standing height and the sprite's feet point on the seat (see
seating.js), so the sit clips are lifted by how much lower their hips are
than standing hips. That puts him on the cushion, legs over its front,
rather than sunk into it.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_patron3d as bp  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
FBX_DIR = os.path.join(REPO, 'art', 'mixamo', 'model1')
OUT_DIR = os.path.join(REPO, 'game', 'src', 'assets', 'sprites', 'patrons')

HEIGHT = 1.5
DIRECTIONS = bp.DIRECTIONS

LOOKS = {
    'teal': dict(skin='#f0b088', hair='#2e1c14', shirt='#1fc6c9', trousers='#2a2833',
                 shoes='#f2f0f4', soles='#8a8494', eyes='#4a2c1c', brows='#2e1c14',
                 lines='#1a1024', mouth='#a8584a'),
}

# (clip, frames in the sheet, source frame range or None for all of it).
# fps is worked out so each clip plays at its own speed (the walk a touch
# faster, to match how fast the game moves guests).
CLIPS = (
    ('walk', 16, None, 1.09),
    ('dance', 48, None, 1.0),
    ('sit', 24, None, 1.0),
    ('sittalk', 48, 'loop', 1.0),     # a seamless slice of the long clip
    ('drink', 48, None, 1.0),
    ('idle', 8, None, 1.0),
)
COLUMNS = 24
# Set by build_patron_painted.py: a function applied to every rendered frame
# (e.g. a bold outline round the whole figure).
POSTPROCESS = None
STANDING_HEIGHT = 118.0     # px, head to feet, in the sheet (drawn: 121)
SOURCE_FPS = 30


# --------------------------------------------------------------------------
# This model's proportions (chibi: a big head from z 0.93 to 1.48, hips at
# 0.50, arms out at 0.80), for build_patron3d's colouring.
# --------------------------------------------------------------------------

def region_of(bone, c):
    b = bone.replace('mixamorig:', '')
    if b.startswith(('LeftFoot', 'RightFoot', 'LeftToe', 'RightToe', 'LeftLeg', 'RightLeg', 'LeftUpLeg', 'RightUpLeg')):
        if c.z < 0.022:
            return 'soles'
        return 'shoes' if c.z < 0.1 else 'trousers'
    if b == 'Hips' or b.startswith('Spine'):
        return 'shirt' if c.z > 0.56 else 'trousers'
    if b.endswith(('Shoulder', 'Arm')):
        return 'shirt' if abs(c.x) < 0.25 else 'skin'
    return 'skin'


HEAD_C = Vector((0, 0.0, 1.21))


def hairline(theta):
    """Height of the hairline: a fringe over the forehead, above the ears
    at the sides, down to the nape at the back."""
    a = abs(theta) / math.pi
    h = 1.33 - 0.04 * a - 0.22 * max(0.0, a - 0.55) / 0.45
    if a < 0.4:
        h += 0.03 * math.cos(theta * 14) * (1 - a / 0.4)
    return h


def is_ear(w):
    return abs(w.x) > 0.262 and 1.03 < w.z < 1.42 and -0.14 < w.y < 0.13


def add_hair(body):
    import bmesh
    hair = body.copy()
    hair.data = body.data.copy()
    hair.name = 'Hair'
    bpy.context.scene.collection.objects.link(hair)
    mw = body.matrix_world
    inv = mw.inverted()
    bm = bmesh.new()
    bm.from_mesh(hair.data)
    names = [g.name for g in body.vertex_groups]
    deform = bm.verts.layers.deform.active
    head_idx = names.index('mixamorig:Head')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v[deform].get(head_idx, 0) < 0.99], context='VERTS')
    bm.normal_update()
    for v in bm.verts:
        w = mw @ v.co
        d = w - HEAD_C
        theta = math.atan2(d.x, -d.y)
        u = d.normalized()
        above = bp.smoothstep(-0.02, 0.03, w.z - hairline(theta))
        if is_ear(w):
            above = 0.0
        crown = bp.smoothstep(0.1, 0.8, u.z)
        locks = max(0.0, math.cos(6 * theta + 4 * u.z)) ** 3
        out = bp.HAIR_THICKNESS * (0.7 + 0.8 * crown + 1.2 * locks * crown)
        off = above * out - (1 - above) * 0.02
        v.co = inv @ (w + (mw.to_3x3() @ v.normal).normalized() * off)
    bm.to_mesh(hair.data)
    bm.free()
    hair.data.materials.clear()
    hair.data.materials.append(bp.material('Hair', bp.LOOK['hair'], rough=0.5))
    for p in hair.data.polygons:
        p.material_index = 0
    sub = hair.modifiers.new('Smooth', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    return hair


def add_glass(arm, parent):
    """A tall cocktail glass (pink drink, a straw) in his left hand, the
    one the drink clip lifts. It follows the hand but stays upright, and
    only shows in the drink clip."""
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.055, depth=0.13, location=(0, 0, 0.02))
    cup = bpy.context.active_object
    cup.data.materials.append(bp.material('GlassDrink', '#ff5fb8', rough=0.25))
    parts.append(cup)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.06, depth=0.022, location=(0, 0, 0.085))
    rim = bpy.context.active_object
    rim.data.materials.append(bp.material('GlassRim', '#e8f6ff', rough=0.2))
    parts.append(rim)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.009, depth=0.1, location=(0.02, 0, 0.12))
    straw = bpy.context.active_object
    straw.rotation_euler = (0, math.radians(14), 0)
    straw.data.materials.append(bp.material('Straw', '#5ff0ff', rough=0.4))
    parts.append(straw)
    glass = bpy.data.objects.new('Glass', None)
    bpy.context.scene.collection.objects.link(glass)
    for o in parts:
        o.parent = glass
        for p in o.data.polygons:
            p.use_smooth = True
    glass.parent = parent
    follow = glass.constraints.new('COPY_LOCATION')
    follow.target = arm
    follow.subtarget = 'mixamorig:LeftHand'
    follow.head_tail = 0.7
    return glass, parts


# --------------------------------------------------------------------------
# Clips
# --------------------------------------------------------------------------

def load_action(path, name):
    """Imports one clip's FBX, keeps its action (renamed) and throws away
    its own copy of the character."""
    objs = bp.import_clip(path)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    action = arm.animation_data.action
    action.name = name
    action.use_fake_user = True
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    return action


def use_action(arm, action):
    """Puts a clip on the armature (Blender 4.4+ also needs the action's
    slot picked, or the pose doesn't change)."""
    ad = arm.animation_data
    ad.action = action
    if hasattr(ad, 'action_slot') and getattr(action, 'slots', None):
        ad.action_slot = action.slots[0]


def hips_height(arm, action, frames):
    use_action(arm, action)
    hips = arm.pose.bones['mixamorig:Hips']
    zs = []
    for f in frames:
        bpy.context.scene.frame_set(int(f))
        zs.append((arm.matrix_world @ hips.head).z)
    return sum(zs) / len(zs)


def seamless_slice(arm, action, length_range=(150, 240)):
    """The stretch of a long clip whose last pose is closest to its first,
    so it loops without a jump."""
    bones = [b for b in arm.pose.bones if b.name.split(':')[-1] in (
        'Hips', 'Spine', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand')]
    use_action(arm, action)
    f0, f1 = (int(x) for x in action.frame_range)
    poses = {}

    def pose(f):
        if f not in poses:
            bpy.context.scene.frame_set(f)
            poses[f] = [b.matrix.to_quaternion() for b in bones]
        return poses[f]

    best = None
    for a in range(f0, f1 - length_range[1], 6):
        for n in range(length_range[0], length_range[1] + 1, 6):
            d = sum(1 - abs(p.dot(q)) for p, q in zip(pose(a), pose(a + n)))
            if best is None or d < best[0]:
                best = (d, a, a + n)
    return best[1], best[2]


def main():
    preview = '--preview' in sys.argv
    out_dir = sys.argv[sys.argv.index('--preview') + 1] if preview else OUT_DIR
    look_name = sys.argv[sys.argv.index('--look') + 1] if '--look' in sys.argv else 'teal'
    os.makedirs(out_dir, exist_ok=True)

    bp.LOOK = LOOKS[look_name]
    bp.region_of = region_of
    scene = iso_rig.reset_scene()
    scene.cycles.samples = 32
    scene.render.fps = SOURCE_FPS
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)

    # The character, from the sit clip (any clip has the same mesh).
    objs = bp.import_clip(os.path.join(FBX_DIR, 'sit.fbx'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH')
    arm.animation_data.action.name = 'sit'
    actions = {'sit': arm.animation_data.action}
    for clip, *_ in CLIPS:
        if clip in actions:
            continue
        path = os.path.join(FBX_DIR, f'{clip}.fbx')
        if os.path.exists(path):
            actions[clip] = load_action(path, clip)
    bp.walk_in_place(actions['walk'])

    # Dress him, in the rest (T) pose.
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    face = os.path.join(bpy.app.tempdir or '/tmp', 'model1_face.png')
    bp.paint_face(face)
    bp.colour_body(body, face)
    hair = add_hair(body)
    for o in (body, hair):
        for p in o.data.polygons:
            p.use_smooth = True
    arm.data.pose_position = 'POSE'

    # Which source frames each sheet frame shows, and how fast it plays.
    plan = {}
    for clip, n, rng, speed in CLIPS:
        src = clip if clip in actions else 'drink'
        act = actions[src]
        if clip == 'idle' and 'idle' not in actions:
            f0 = f1 = act.frame_range[0]
        elif rng == 'loop':
            f0, f1 = seamless_slice(arm, act)
        else:
            f0, f1 = act.frame_range
        frames = [f0 + (f1 - f0) * i / n for i in range(n)] if f1 > f0 else [f0] * n
        fps = n / ((f1 - f0) / SOURCE_FPS) * speed if f1 > f0 else 4
        plan[clip] = dict(action=src, frames=frames, fps=round(fps, 2), source=[f0, f1])
    print('plan', {k: (v['action'], v['source'], v['fps']) for k, v in plan.items()})

    # Sitting: lift so the hips are where they are when standing.
    rest_hips = (arm.matrix_world @ arm.data.bones['mixamorig:Hips'].head_local).z
    lift = {}
    for clip in ('sit', 'sittalk'):
        p = plan[clip]
        lift[clip] = rest_hips - hips_height(arm, actions[p['action']], p['frames'][::4])
    print('sit lift (rest units)', {k: round(v, 3) for k, v in lift.items()})

    root = bpy.data.objects.new('Root', None)
    scene.collection.objects.link(root)
    arm.parent = root
    glass, glass_parts = add_glass(arm, root)
    s = HEIGHT / 1.483
    root.scale = (s, s, s)
    origin = iso_rig.check_projection(scene, cam)
    iso_rig.add_outlines(scene, root)
    iso_rig.apply_model_scale(root)
    unit = root.scale.x     # rest units -> render world units

    from PIL import Image

    def render(clip, frame, turn, path):
        use_action(arm, actions[plan[clip]['action']])
        root.rotation_euler = (0, 0, turn)
        root.location = (0, 0, lift.get(clip, 0.0) * unit)
        for o in glass_parts:
            o.hide_render = clip != 'drink'
        scene.frame_set(int(frame), subframe=frame % 1)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        im = Image.open(path).convert('RGBA')
        return POSTPROCESS(im) if POSTPROCESS else im

    if preview:
        shots = []
        only = os.environ.get('ONLY')
        for clip, *_ in CLIPS:
            if only and clip not in only.split(','):
                continue
            frames = plan[clip]['frames']
            for dname, turn in DIRECTIONS:
                stills = frames if os.environ.get('PREVIEW_ALL') else (frames[0], frames[len(frames) // 3], frames[2 * len(frames) // 3])
                for f in stills:
                    shots.append(render(clip, f, turn, os.path.join(out_dir, f'{clip}_{dname}_{f:06.1f}.png')))
        boxes = [im.getchannel('A').getbbox() for im in shots]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        shots = [im.crop(box) for im in shots]
        w, h = shots[0].size
        per_row = 6
        sheet = Image.new('RGBA', (w * per_row, h * math.ceil(len(shots) / per_row)), (40, 30, 60, 255))
        for i, im in enumerate(shots):
            sheet.alpha_composite(im, ((i % per_row) * w, (i // per_row) * h))
        sheet.save(os.path.join(out_dir, 'preview.png'))
        return

    # Render every frame once, then crop them all to one shared box.
    tmp = os.path.join(bpy.app.tempdir or '/tmp', 'model1_frame.png')
    cells = {}
    for clip, *_ in CLIPS:
        for dname, turn in DIRECTIONS:
            for i, f in enumerate(plan[clip]['frames']):
                key = (clip == 'drink', plan[clip]['action'], round(f, 3), turn, lift.get(clip, 0.0))
                if key not in cells:
                    cells[key] = render(clip, f, turn, tmp).copy()
    standing = cells[(False, plan['walk']['action'], round(plan['walk']['frames'][0], 3), DIRECTIONS[0][1], 0.0)]
    k = STANDING_HEIGHT / (origin[1] - standing.getchannel('A').getbbox()[1])
    boxes = [im.getchannel('A').getbbox() for im in cells.values()]
    x0 = min(b[0] for b in boxes) - 2
    y0 = min(b[1] for b in boxes) - 2
    x1 = max(b[2] for b in boxes) + 2
    y1 = max(b[3] for b in boxes) + 2
    fw, fh = math.ceil((x1 - x0) * k), math.ceil((y1 - y0) * k)

    rows = {}
    row = 0
    for clip, n, *_ in CLIPS:
        for dname, _ in DIRECTIONS:
            rows[f'{clip}_{dname}'] = row * COLUMNS
            row += math.ceil(n / COLUMNS)
    sheet = Image.new('RGBA', (fw * COLUMNS, fh * row))
    for clip, *_ in CLIPS:
        for dname, turn in DIRECTIONS:
            start = rows[f'{clip}_{dname}']
            for i, f in enumerate(plan[clip]['frames']):
                im = cells[(clip == 'drink', plan[clip]['action'], round(f, 3), turn, lift.get(clip, 0.0))].crop((x0, y0, x1, y1))
                im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
                idx = start + i
                sheet.alpha_composite(im, ((idx % COLUMNS) * fw, (idx // COLUMNS) * fh))
    name = f'patron_3d_{look_name}'
    sheet.save(os.path.join(OUT_DIR, f'{name}.png'), optimize=True)
    meta = {
        'frameWidth': fw, 'frameHeight': fh, 'columns': COLUMNS,
        'originX': round((origin[0] - x0) / (x1 - x0), 5), 'originY': round((origin[1] - y0) / (y1 - y0), 5),
        'standingHeight': STANDING_HEIGHT,
        'starts': rows,
        'frames': {clip: n for clip, n, *_ in CLIPS},
        'fps': {clip: plan[clip]['fps'] for clip, *_ in CLIPS},
        'source': {clip: plan[clip]['source'] for clip, *_ in CLIPS},
        'sitLift': {k2: round(v, 4) for k2, v in lift.items()},
    }
    with open(os.path.join(OUT_DIR, f'{name}.json'), 'w') as fh_:
        json.dump(meta, fh_, indent=2)
    print('wrote', name, sheet.size, meta['frameWidth'], meta['frameHeight'])


if __name__ == '__main__':
    main()
