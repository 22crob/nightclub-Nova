"""The new patron style: the owner's Mixamo character, coloured in Blender
and rendered into a patron spritesheet the game can use like the drawn ones.

Run from the repo root with a Python that has bpy==4.5.4 and pillow:
    python art/blender/build_patron3d.py              # writes patron_12.png
    python art/blender/build_patron3d.py --preview DIR  # a few stills only

Source: art/mixamo/*.fbx, one file per animation, all the same character.
Only walk.fbx exists so far; until idle/dance/sit arrive, those rows are
filled from the walk (see ANIMS). The FBX has one plain white material, so
the colours are added here:
  - skin, shirt, trousers and shoes are picked per face from the bone that
    moves it most (hands and forearms skin, upper arms short sleeves, ...)
  - hair is a shell grown out of the top of the head, so it has volume and
    its own outline
  - the face is painted with PIL and projected onto the front of the head
Mixamo walks move forward; the hips' drift is taken out so he walks in
place, as the game moves patrons itself.

The sheet uses the drawn patrons' frame grid (patrons.json): the render is
scaled so he is standingHeight tall with his feet on the anchor point.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
FBX_DIR = os.path.join(REPO, 'art', 'mixamo')
OUT_DIR = os.path.join(REPO, 'game', 'src', 'assets', 'sprites', 'patrons')
SHEET_INDEX = 12

# Same height as the old chibi patrons (a bar counter is 1.0), before
# iso_rig.MODEL_SCALE. Only the proportions matter: the sheet is rescaled.
HEIGHT = 1.5
# Front faces screen down-left (Blender -Y), turned toward the camera so
# the face reads; back faces up-right, turned the same way.
TURN = math.radians(25)
DIRECTIONS = (('front', TURN), ('back', math.pi + TURN))

# The test look. Colours sit in the game's palette (config.js / the drawn
# outfits): warm skin, dark hair, a bright club tee, dark jeans, white kicks.
LOOK = dict(skin='#f0b088', hair='#2e1c14', shirt='#1fc6c9', trousers='#2a2833',
            shoes='#f2f0f4', soles='#8a8494', eyes='#4a2c1c', brows='#2e1c14',
            lines='#1a1024', mouth='#a8584a')

# Clips: (row name, fbx file, frames in the sheet). A clip whose file is
# missing falls back to the walk, held on one frame for idle and sit.
ANIMS = (('idle', 'idle.fbx'), ('walk', 'walk.fbx'), ('dance', 'dance.fbx'), ('sit', 'sit.fbx'))

HAIR_THICKNESS = 0.035     # how far the hair stands off the scalp (rest units)


def linear(hex_color):
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def material(name, hex_color, rough=0.62, skin=False, face=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*linear(hex_color), 1)
    bsdf.inputs['Roughness'].default_value = 0.42 if skin else rough
    bsdf.inputs['Specular IOR Level'].default_value = 0.35 if skin else 0.25
    if skin:
        bsdf.inputs['Subsurface Weight'].default_value = 0.12
        bsdf.inputs['Subsurface Radius'].default_value = (0.9, 0.35, 0.2)
        bsdf.inputs['Subsurface Scale'].default_value = 0.03
    if face:
        # Painted face over the skin, through the FaceUV projection.
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'FaceUV'
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(face)
        tex.extension = 'CLIP'
        tex.interpolation = 'Cubic'
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.inputs['B'].default_value = (1, 1, 1, 1)
        nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
        nt.links.new(tex.outputs['Alpha'], mix.inputs['Factor'])
        mix.inputs['A'].default_value = (*linear(hex_color), 1)
        nt.links.new(tex.outputs['Color'], mix.inputs['B'])
        nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    return m


# --------------------------------------------------------------------------
# Face
# --------------------------------------------------------------------------

# The front of the head is projected straight back onto a square image:
# FACE_BOX is (x0, z0, size) in rest-pose world units.
FACE_BOX = (-0.38, 0.89, 0.76)
FACE_PX = 1024


def paint_face(path):
    """Sleepy anime eyes under heavy lids, like the drawn patrons: white,
    a big dark iris with a glint, a thick upper lash line and a brow."""
    from PIL import Image, ImageDraw
    S = FACE_PX
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, z0, size = FACE_BOX

    def px(x, z):
        return (x - x0) / size * S, (1 - (z - z0) / size) * S

    def rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

    eye_z, eye_w, eye_h = 1.13, 0.105, 0.095
    for side in (-1, 1):
        cx, cy = px(side * 0.135, eye_z)
        w, h = eye_w / size * S, eye_h / size * S
        d.ellipse((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), fill=(250, 248, 252, 255))
        iw, ih = w * 0.62, h * 0.9
        ix = cx - side * w * 0.08          # glance a little toward the nose
        d.ellipse((ix - iw / 2, cy - ih / 2 + h * 0.08, ix + iw / 2, cy + ih / 2 + h * 0.08), fill=rgb(LOOK['eyes']))
        d.ellipse((ix - iw * 0.28, cy - ih * 0.12, ix + iw * 0.28, cy + ih * 0.4), fill=rgb(LOOK['lines']))
        g = iw * 0.2
        d.ellipse((ix - iw * 0.3 - g, cy - ih * 0.25 - g, ix - iw * 0.3 + g, cy - ih * 0.25 + g), fill=(255, 255, 255, 255))
        # Heavy upper lid: skin over the top third, then the lash line.
        lid = cy - h * 0.18
        d.rectangle((cx - w / 2 - 4, cy - h / 2 - 6, cx + w / 2 + 4, lid), fill=rgb(LOOK['skin']))
        d.line((cx - w / 2 - w * 0.08, lid + h * 0.04, cx + w / 2 + w * 0.08, lid - h * 0.02), fill=rgb(LOOK['lines']), width=int(h * 0.16))
        # Lower lash, short, at the outer corner.
        oc = cx + side * w * 0.5
        d.line((oc - side * w * 0.45, cy + h * 0.5, oc, cy + h * 0.32), fill=rgb(LOOK['lines']), width=int(h * 0.06))
        # Brow: a straight, slightly lowered stroke.
        bx0, by0 = px(side * 0.075, eye_z + 0.095)
        bx1, by1 = px(side * 0.2, eye_z + 0.105)
        d.line((bx0, by0, bx1, by1), fill=rgb(LOOK['brows']), width=int(h * 0.15))
    # Small sideways smirk.
    mx0, my0 = px(-0.035, 1.0)
    mx1, my1 = px(0.04, 1.007)
    d.line((mx0, my0, mx1, my1), fill=rgb(LOOK['mouth']), width=int(FACE_PX * 0.006))
    img.save(path)


# --------------------------------------------------------------------------
# Character
# --------------------------------------------------------------------------

def import_clip(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def walk_in_place(action):
    """Take the steady forward drift out of the hips (and only the drift: a
    straight line from the first key to the last), keeping the bob and sway."""
    for fc in action.fcurves:
        if not (fc.data_path.endswith('"mixamorig:Hips"].location')):
            continue
        keys = fc.keyframe_points
        if len(keys) < 2:
            continue
        f0, v0 = keys[0].co
        f1, v1 = keys[-1].co
        for k in keys:
            shift = v0 + (v1 - v0) * (k.co.x - f0) / (f1 - f0) - v0
            k.co.y -= shift
            k.handle_left.y -= shift
            k.handle_right.y -= shift
        fc.update()


def region_of(bone, c):
    """Which colour a face gets, from the bone that moves it most and where
    its centre is in the rest (T) pose, so hems and cuffs are straight."""
    b = bone.replace('mixamorig:', '')
    if b.startswith(('LeftFoot', 'RightFoot', 'LeftToe', 'RightToe', 'LeftLeg', 'RightLeg', 'LeftUpLeg', 'RightUpLeg')):
        if c.z < 0.022:
            return 'soles'
        return 'shoes' if c.z < 0.09 else 'trousers'
    if b == 'Hips' or b.startswith('Spine'):
        return 'shirt' if c.z > 0.55 else 'trousers'
    if b.endswith(('Shoulder', 'Arm')):     # short sleeves to mid upper arm
        return 'shirt' if abs(c.x) < SLEEVE_X else 'skin'
    return 'skin'   # head, neck, hands


SLEEVE_X = 0.36


def colour_body(body, face_path):
    me = body.data
    mats = {
        'skin': material('Skin', LOOK['skin'], skin=True, face=face_path),
        'shirt': material('Shirt', LOOK['shirt']),
        'trousers': material('Trousers', LOOK['trousers'], rough=0.75),
        'shoes': material('Shoes', LOOK['shoes'], rough=0.45),
        'soles': material('Soles', LOOK['soles'], rough=0.6),
    }
    me.materials.clear()
    order = list(mats)
    for name in order:
        me.materials.append(mats[name])
    names = [g.name for g in body.vertex_groups]
    mw = body.matrix_world
    vert_bone = [names[max(v.groups, key=lambda g: g.weight).group] if v.groups else 'Head' for v in me.vertices]
    for p in me.polygons:
        counts = {}
        for vi in p.vertices:
            counts[vert_bone[vi]] = counts.get(vert_bone[vi], 0) + 1
        p.material_index = order.index(region_of(max(counts, key=counts.get), mw @ p.center))
    vert_skin = [False] * len(me.vertices)
    for p in me.polygons:
        if order[p.material_index] == 'skin':
            for vi in p.vertices:
                vert_skin[vi] = True

    # FaceUV: the front of the head projected straight back.
    x0, z0, size = FACE_BOX
    uv = me.uv_layers.new(name='FaceUV')
    for loop in me.loops:
        v = me.vertices[loop.vertex_index]
        w = mw @ v.co
        n = (mw.to_3x3() @ v.normal).normalized()
        front = vert_skin[loop.vertex_index] and w.z > 0.9 and w.y < 0 and n.y < -0.3
        uv.data[loop.index].uv = ((w.x - x0) / size, (w.z - z0) / size) if front else (-1, -1)


HEAD_C = Vector((0, 0.02, 1.25))


def hairline(theta):
    """Height of the hairline around the head; theta is 0 at the face,
    +-pi at the back. A jagged fringe at the front, over the ears at the
    sides, down to the nape at the back."""
    a = abs(theta) / math.pi
    h = 1.38 - 0.24 * a ** 1.1 - 0.13 * max(0.0, a - 0.55) / 0.45
    if a < 0.4:
        h += 0.035 * math.cos(theta * 14) * (1 - a / 0.4)    # fringe points
    return h


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def add_hair(body):
    """A copy of the whole head, pushed out along its normals above the
    hairline and sunk just inside the head below it, so the hair's edge is
    wherever the two surfaces cross: a smooth line however coarse the mesh.
    It keeps the head's bone weights, so it moves with the head."""
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
        # How far above the hairline (soft over a band, so the crossing is clean).
        above = smoothstep(-0.02, 0.03, w.z - hairline(theta))
        if abs(w.x) > 0.3 and w.z < 1.2:
            above = 0.0                       # ears stay skin
        # Volume: fuller on the crown, with a few soft locks swept back.
        crown = smoothstep(0.1, 0.8, u.z)
        locks = max(0.0, math.cos(6 * theta + 4 * u.z)) ** 3
        out = HAIR_THICKNESS * (0.7 + 0.8 * crown + 1.2 * locks * crown)
        off = above * out - (1 - above) * 0.02
        v.co = inv @ (w + (mw.to_3x3() @ v.normal).normalized() * off)
    bm.to_mesh(hair.data)
    bm.free()
    hair.data.materials.clear()
    hair.data.materials.append(material('Hair', LOOK['hair'], rough=0.5))
    for p in hair.data.polygons:
        p.material_index = 0
    sub = hair.modifiers.new('Smooth', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    return hair


def build(scene):
    objs = import_clip(os.path.join(FBX_DIR, 'walk.fbx'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH')
    walk_in_place(arm.animation_data.action)
    tmp = os.path.join(bpy.app.tempdir or '/tmp', 'patron3d_face.png')
    paint_face(tmp)
    colour_body(body, tmp)
    hair = add_hair(body)
    for o in (body, hair):
        for p in o.data.polygons:
            p.use_smooth = True
    root = bpy.data.objects.new('Root', None)
    scene.collection.objects.link(root)
    arm.parent = root
    s = HEIGHT / body.dimensions.z
    root.scale = (s, s, s)
    return root, arm


def frames_of(action, n):
    f0, f1 = action.frame_range
    return [f0 + (f1 - f0) * i / n for i in range(n)]


def main():
    preview = '--preview' in sys.argv
    out_dir = sys.argv[sys.argv.index('--preview') + 1] if preview else OUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    scene = iso_rig.reset_scene()
    # The sheet is drawn at about half the render size, which averages
    # away the noise of a low sample count.
    scene.cycles.samples = 32
    cam = iso_rig.add_camera(scene)
    iso_rig.add_lighting(scene)
    root, arm = build(scene)
    origin = iso_rig.check_projection(scene, cam)
    iso_rig.add_outlines(scene, root)
    iso_rig.apply_model_scale(root)
    walk = arm.animation_data.action

    from PIL import Image
    import json
    meta = json.load(open(os.path.join(OUT_DIR, 'patrons.json')))

    def render(frame, turn, path):
        root.rotation_euler = (0, 0, turn)
        scene.frame_set(int(frame), subframe=frame % 1)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        return Image.open(path).convert('RGBA')

    if preview:
        shots = []
        for dname, turn in DIRECTIONS:
            for f in frames_of(walk, 4):
                shots.append(render(f, turn, os.path.join(out_dir, f'{dname}_{f:05.1f}.png')))
        boxes = [im.getchannel('A').getbbox() for im in shots]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        shots = [im.crop(box) for im in shots]
        w, h = shots[0].size
        sheet = Image.new('RGBA', (w * 4, h * 2), (40, 30, 60, 255))
        for i, im in enumerate(shots):
            sheet.alpha_composite(im, ((i % 4) * w, (i // 4) * h))
        sheet.save(os.path.join(out_dir, 'preview.png'))
        return

    FW, FH, cols = meta['frameWidth'], meta['frameHeight'], meta['columns']
    feet = (FW * meta['originX'], FH * meta['originY'])
    tmp = os.path.join(bpy.app.tempdir or '/tmp', 'patron3d_frame.png')
    # Scale: his standing height (top of head to the anchor between the
    # feet) becomes standingHeight in the sheet.
    first = render(frames_of(walk, 1)[0], DIRECTIONS[0][1], tmp)
    top = first.getchannel('A').getbbox()[1]
    k = meta['standingHeight'] / (origin[1] - top)
    sheet = Image.new('RGBA', (FW * cols, FH * len(meta['rows'])))
    cache = {}
    for row_name, row in meta['rows'].items():
        clip, dname = row_name.split('_')
        turn = dict(DIRECTIONS)[dname]
        n = meta['frames'][clip]
        if clip == 'walk':
            frames = frames_of(walk, n)
        else:
            # No clip yet: idle and sit hold the walk's passing pose, dance
            # steps through the walk.
            steps = frames_of(walk, meta['frames']['walk'])
            frames = (steps * 4)[:n] if clip == 'dance' else [steps[len(steps) // 4]] * n
        for i, f in enumerate(frames):
            if (f, turn) not in cache:
                im = render(f, turn, tmp)
                big = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
                cell = Image.new('RGBA', (FW, FH))
                cell.alpha_composite(big, (round(feet[0] - origin[0] * k), round(feet[1] - origin[1] * k)))
                cache[f, turn] = cell
            sheet.alpha_composite(cache[f, turn], (i * FW, row * FH))
    path = os.path.join(OUT_DIR, f'patron_{SHEET_INDEX:02d}.png')
    sheet.save(path, optimize=True)
    print('wrote', path)


if __name__ == '__main__':
    main()
