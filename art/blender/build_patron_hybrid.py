"""Guests that move like the owner's 3D model but look like the drawn guests:
the model's animated body (art/mixamo/model1, see build_patron_model1.py)
in flat, drawn-style shading, wearing a drawn guest's own head (face and
hair, cut from their sheet) and their outfit colours.

The owner found the fully 3D guest odd-looking next to the drawn ones; this
keeps the smooth Mixamo animation and the drawn faces.

Two steps, so many characters come out of one render:

    python art/blender/build_patron_hybrid.py render       # Blender, ~1h
    python3 art/blender/build_patron_hybrid.py compose 1 3 5 7   # PIL only

render: every frame twice from the game camera, with the model's head
removed. A shade pass (white, one hard shadow step, dark outlines) and an
id pass (flat key colours for skin / shirt / trousers / shoes / soles /
glass, no anti-aliasing). For each frame it also notes where the neck is
on screen, how the head tilts and which way it faces (front or back, and
mirrored or not). Everything goes to art/build/hybrid/.

compose: for each drawn character given, colours the body from the id pass
with that character's colours (sampled from their sheet), shaded by the
shade pass, and pastes their drawn head (front or back view, mirrored when
the face turns the other way) on the neck, tilted with the head. Writes
patron_3d_hybrid<N>.png/.json like build_patron_model1.py's sheets.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
WORK = os.path.join(REPO, 'art', 'build', 'hybrid')
SPRITES = os.path.join(REPO, 'game', 'src', 'assets', 'sprites', 'patrons')

# Region keys for the id pass (sRGB, exact).
KEYS = {
    'skin': (255, 0, 0), 'shirt': (0, 255, 0), 'trousers': (0, 0, 255),
    'shoes': (255, 255, 0), 'soles': (0, 255, 255), 'glass': (255, 0, 255),
}
SHADE_DARK = 0.74           # the shadow tone, as a share of the lit colour
NECK_DROP = 0.045           # chin below the head bone's root, rest units


# ==========================================================================
# Render (Blender)
# ==========================================================================

def render_main():
    import bpy
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    sys.path.insert(0, HERE)
    import iso_rig
    import build_patron3d as bp
    import build_patron_model1 as m1

    os.makedirs(WORK, exist_ok=True)
    scene = iso_rig.reset_scene()
    scene.cycles.samples = 16
    scene.render.fps = m1.SOURCE_FPS
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    cam = iso_rig.add_camera(scene)

    objs = bp.import_clip(os.path.join(m1.FBX_DIR, 'sit.fbx'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH')
    arm.animation_data.action.name = 'sit'
    actions = {'sit': arm.animation_data.action}
    for clip, *_ in m1.CLIPS:
        path = os.path.join(m1.FBX_DIR, f'{clip}.fbx')
        if clip not in actions and os.path.exists(path):
            actions[clip] = m1.load_action(path, clip)
    bp.walk_in_place(actions['walk'])

    # Regions, in the rest pose (build_patron3d's colouring with this
    # model's proportions); then the head goes (the drawn one replaces it).
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    bp.LOOK = m1.LOOKS['teal']
    bp.region_of = m1.region_of
    face = os.path.join(WORK, 'unused_face.png')
    bp.paint_face(face)
    bp.colour_body(body, face)
    region_names = [m.name.split('.')[0].lower() for m in body.data.materials]
    import bmesh
    names = [g.name for g in body.vertex_groups]
    head_idx = names.index('mixamorig:Head')
    bm = bmesh.new()
    bm.from_mesh(body.data)
    deform = bm.verts.layers.deform.active
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v[deform].get(head_idx, 0) > 0.5], context='VERTS')
    bm.to_mesh(body.data)
    bm.free()
    for p in body.data.polygons:
        p.use_smooth = True
    arm.data.pose_position = 'POSE'

    def flat(name, rgb):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        emit = nt.nodes.new('ShaderNodeEmission')
        emit.inputs['Color'].default_value = (*[c / 255 for c in rgb], 1)
        nt.links.new(emit.outputs[0], out.inputs['Surface'])
        return m

    def cel_white(name):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        emit = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(emit.outputs[0], out.inputs['Surface'])
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        dot = nt.nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = Vector((-0.5, -0.8, 0.6)).normalized()
        nt.links.new(geo.outputs['Normal'], dot.inputs[0])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        ramp.color_ramp.elements[0].color = (SHADE_DARK,) * 3 + (1,)
        ramp.color_ramp.elements[1].position = 0.42
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        remap = nt.nodes.new('ShaderNodeMapRange')
        remap.inputs['From Min'].default_value = -1
        nt.links.new(dot.outputs['Value'], remap.inputs['Value'])
        nt.links.new(remap.outputs['Result'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], emit.inputs['Color'])
        return m

    shade_mat = cel_white('Shade')
    id_mats = [flat(f'Id_{r}', KEYS.get(r, KEYS['skin'])) for r in region_names]

    root = bpy.data.objects.new('Root', None)
    scene.collection.objects.link(root)
    arm.parent = root
    glass, glass_parts = m1.add_glass(arm, root)
    glass_id = flat('Id_glass', KEYS['glass'])
    s = m1.HEIGHT / 1.483
    root.scale = (s, s, s)
    origin = iso_rig.check_projection(scene, cam)
    iso_rig.add_outlines(scene, root)
    ls = bpy.context.view_layer.freestyle_settings.linesets[0]
    ls.select_crease = False
    no_lines = bpy.data.collections.get('NoOutline')
    for o in list(no_lines.objects):
        no_lines.objects.unlink(o)
    iso_rig.apply_model_scale(root)
    unit = root.scale.x

    # The same plan as build_patron_model1 (frames, speeds, sit lift).
    plan = {}
    for clip, n, rng, speed in m1.CLIPS:
        src = clip if clip in actions else 'drink'
        act = actions[src]
        if clip == 'idle' and 'idle' not in actions:
            f0 = f1 = act.frame_range[0]
        elif rng == 'loop':
            f0, f1 = m1.seamless_slice(arm, act)
        else:
            f0, f1 = act.frame_range
        frames = [f0 + (f1 - f0) * i / n for i in range(n)] if f1 > f0 else [f0] * n
        fps = n / ((f1 - f0) / m1.SOURCE_FPS) * speed if f1 > f0 else 4
        plan[clip] = dict(action=src, frames=frames, fps=round(fps, 2), n=n)
    rest_hips = (arm.matrix_world @ arm.data.bones['mixamorig:Hips'].head_local).z
    lift = {c: rest_hips - m1.hips_height(arm, actions[plan[c]['action']], plan[c]['frames'][::4]) for c in ('sit', 'sittalk')}

    def set_pass(kind):
        if kind == 'shade':
            body.data.materials.clear()
            body.data.materials.append(shade_mat)
            for o in glass_parts:
                o.data.materials[0] = shade_mat
            scene.render.use_freestyle = True
            scene.cycles.filter_width = 1.5
        else:
            body.data.materials.clear()
            for m in id_mats:
                body.data.materials.append(m)
            for o in glass_parts:
                o.data.materials[0] = glass_id
            scene.render.use_freestyle = False
            scene.cycles.filter_width = 0.01

    # Remember each polygon's region (material index) for the id pass.
    regions = [p.material_index for p in body.data.polygons]

    def apply_regions():
        for p, r in zip(body.data.polygons, regions):
            p.material_index = r

    head = arm.pose.bones['mixamorig:Head']
    W = scene.render.resolution_x

    def screen(p):
        v = world_to_camera_view(scene, cam, p)
        return v.x * W, (1 - v.y) * W

    frames_meta = []
    done = set()
    step = int(os.environ.get('SAMPLE', '1'))     # SAMPLE=8: every 8th frame, for a trial
    for clip, *_ in m1.CLIPS:
        for dname, turn in m1.DIRECTIONS:
            for f in plan[clip]['frames'][::step]:
                key = f'{clip == "drink"}_{plan[clip]["action"]}_{f:.3f}_{turn:.4f}_{lift.get(clip, 0.0):.4f}'
                if key in done:
                    continue
                done.add(key)
                m1.use_action(arm, actions[plan[clip]['action']])
                root.rotation_euler = (0, 0, turn)
                root.location = (0, 0, lift.get(clip, 0.0) * unit)
                for o in glass_parts:
                    o.hide_render = clip != 'drink'
                scene.frame_set(int(f), subframe=f % 1)
                bpy.context.view_layer.update()
                hm = arm.matrix_world @ head.matrix
                chin = hm @ Vector((0, -NECK_DROP, 0))
                top = hm @ Vector((0, head.length, 0))
                fwd = (hm.to_3x3() @ Vector((0, 0, 1))).normalized()
                cx, cy = screen(chin)
                tx, ty = screen(top)
                ahead = screen(chin + fwd * 0.3)
                to_cam = (cam.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
                frames_meta.append(dict(
                    key=key, chin=[cx, cy], angle=math.degrees(math.atan2(tx - cx, cy - ty)),
                    view='front' if fwd.dot(to_cam) > -0.15 else 'back',
                    # The drawn front face looks down-left, the back up-right.
                    mirror=(ahead[0] - cx) > 0 if fwd.dot(to_cam) > -0.15 else (ahead[0] - cx) < 0,
                    headScale=(tx - cx) ** 2 + (ty - cy) ** 2))
                for kind in ('shade', 'id'):
                    set_pass(kind)
                    if kind == 'id':
                        apply_regions()
                    scene.render.filepath = os.path.join(WORK, f'{kind}_{len(frames_meta) - 1:04d}.png')
                    bpy.ops.render.render(write_still=True)
    with open(os.path.join(WORK, 'frames.json'), 'w') as fh:
        json.dump(dict(origin=origin, frames=frames_meta,
                       plan={c: dict(action=p['action'], frames=[f'{f:.3f}' for f in p['frames']], fps=p['fps'], n=p['n']) for c, p in plan.items()},
                       lift={c: round(v, 4) for c, v in lift.items()},
                       directions=[[d, t] for d, t in m1.DIRECTIONS],
                       clips=[c for c, *_ in m1.CLIPS]), fh, indent=1)
    print('rendered', len(frames_meta), 'frames to', WORK)


# ==========================================================================
# Compose (PIL)
# ==========================================================================

def drawn_parts(character):
    """A drawn character's head (front and back, cut at the chin) and their
    colours, from their sheet's first idle frames."""
    from PIL import Image
    meta = json.load(open(os.path.join(SPRITES, 'patrons.json')))
    sheet = Image.open(os.path.join(SPRITES, f'patron_{character:02d}.png')).convert('RGBA')
    fw, fh = meta['frameWidth'], meta['frameHeight']
    feet_y = meta['originY'] * fh
    out = {}
    for view, row in (('front', meta['rows']['idle_front']), ('back', meta['rows']['idle_back'])):
        cell = sheet.crop((0, row * fh, fw, row * fh + fh))
        # The chin (with its outline) is 60% of the standing height above
        # the soles (measured on the sheets; the collar starts just below).
        soles = cell.getchannel('A').getbbox()[3]
        chin_y = round(soles - 0.60 * meta['standingHeight']) + 1
        a = cell.getchannel('A')
        xs = [x for x in range(fw) if a.getpixel((x, chin_y + 3)) > 0]
        neck_x = (xs[0] + xs[-1]) / 2 if xs else fw / 2
        if view == 'front':
            out['colours'] = sample_colours(cell, chin_y, feet_y)
        head = cell.crop((0, 0, fw, chin_y + 2))
        out[view] = dict(img=head, chin=(neck_x, chin_y))
    out['standingHeight'] = meta['standingHeight']
    return out


def sample_colours(cell, chin_y, feet_y):
    """The outfit's colours: the commonest opaque colours in bands of the
    drawn body (skin from the hands' height at the sides)."""
    from collections import Counter

    def common(y0, y1, x0=None, x1=None, skip_dark=True):
        c = Counter()
        w = cell.width
        for y in range(int(y0), int(y1)):
            for x in range(int(x0 or 0), int(x1 or w)):
                r, g, b, a = cell.getpixel((x, y))
                if a < 250 or (skip_dark and r + g + b < 90):
                    continue
                c[(r // 12 * 12, g // 12 * 12, b // 12 * 12)] += 1
        return c.most_common(1)[0][0] if c else (128, 128, 128)

    body_h = feet_y - chin_y
    w = cell.width
    return {
        'shirt': common(chin_y + body_h * 0.12, chin_y + body_h * 0.4, w * 0.35, w * 0.65),
        'trousers': common(chin_y + body_h * 0.62, chin_y + body_h * 0.85, w * 0.3, w * 0.7),
        'shoes': common(chin_y + body_h * 0.9, feet_y + 1, 0, w),
        'skin': common(chin_y - body_h * 0.35, chin_y - body_h * 0.1, w * 0.3, w * 0.7),
    }


CHIN_RAISE = 2.0     # render px: the drawn chin sits this far up the head, showing a little neck


def head_spot(f, pc):
    """Where the padded, rotated head goes: its chin on the neck, raised a
    little along the head's own up direction."""
    a = math.radians(f['angle'])
    cx = f['chin'][0] + math.sin(a) * CHIN_RAISE
    cy = f['chin'][1] - math.cos(a) * CHIN_RAISE
    return round(cx - pc[0]), round(cy - pc[1])


def colour_frame(shade, ids, colours):
    """Body pixels: the region's colour times the shade (outlines dark)."""
    from PIL import Image
    w, h = shade.size
    out = Image.new('RGBA', (w, h))
    sp, ip, op = shade.load(), ids.load(), out.load()
    keys = {v: k for k, v in KEYS.items()}
    pal = dict(colours)
    pal.setdefault('soles', tuple(min(255, c + 20) for c in pal['shoes']))
    pal['glass'] = (255, 95, 184)
    for y in range(h):
        for x in range(w):
            s = sp[x, y]
            if s[3] == 0:
                continue
            i = ip[x, y]
            region = keys.get(i[:3])
            if region is None and i[3] > 0:      # an edge pixel: the nearest key
                region = min(KEYS, key=lambda k: sum((a - b) ** 2 for a, b in zip(KEYS[k], i[:3])))
            if region is None:
                region = 'shirt'
            c = pal[region]
            k = s[0] / 255
            op[x, y] = (round(c[0] * k), round(c[1] * k), round(c[2] * k), s[3])
    return out


def compose_main(characters):
    from PIL import Image
    sys.path.insert(0, HERE)
    info = json.load(open(os.path.join(WORK, 'frames.json')))
    frames = {f['key']: (i, f) for i, f in enumerate(info['frames'])}
    origin = info['origin']
    plan = info['plan']
    lift = info['lift']
    directions = info['directions']
    clips = info['clips']
    COLUMNS = 24
    STANDING = 118.0
    # The 3D standing height in render px: the walk's first frame, head top
    # from the head bone (the head mesh is gone).
    walk0 = frames[f'False_{plan["walk"]["action"]}_{plan["walk"]["frames"][0]}_{directions[0][1]:.4f}_0.0000'][1]
    for character in characters:
        parts = drawn_parts(character)
        k_head = 1.0
        cells = {}
        for key, (i, f) in frames.items():
            shade = Image.open(os.path.join(WORK, f'shade_{i:04d}.png')).convert('RGBA')
            ids = Image.open(os.path.join(WORK, f'id_{i:04d}.png')).convert('RGBA')
            img = colour_frame(shade, ids, parts['colours'])
            head = parts[f['view']]
            hi = head['img']
            chin = head['chin']
            if f['mirror']:
                hi = hi.transpose(Image.FLIP_LEFT_RIGHT)
                chin = (hi.width - chin[0], chin[1])
            # Drawn heads are drawn for the drawn standing height; the 3D
            # body's chin is at the same share of its height.
            scale = (origin[1] - walk0['chin'][1]) / (0.60 * parts['standingHeight'])
            if abs(scale - 1) > 0.01:
                hi = hi.resize((round(hi.width * scale), round(hi.height * scale)), Image.LANCZOS)
                chin = (chin[0] * scale, chin[1] * scale)
            # Tilt about the chin, then put the chin on the neck.
            pad = Image.new('RGBA', (hi.width * 3, hi.height * 3))
            pad.paste(hi, (hi.width, hi.height))
            pc = (chin[0] + hi.width, chin[1] + hi.height)
            rot = pad.rotate(-f['angle'], resample=Image.BICUBIC, center=pc)
            img.alpha_composite(rot, head_spot(f, pc))
            cells[key] = img
        boxes = [im.getchannel('A').getbbox() for im in cells.values()]
        x0 = min(b[0] for b in boxes) - 2
        y0 = min(b[1] for b in boxes) - 2
        x1 = max(b[2] for b in boxes) + 2
        y1 = max(b[3] for b in boxes) + 2
        top = cells[walk0['key']].getchannel('A').getbbox()[1]
        k = STANDING / (origin[1] - top)
        fw, fh = math.ceil((x1 - x0) * k), math.ceil((y1 - y0) * k)
        rows, row = {}, 0
        for clip in clips:
            for dname, _ in directions:
                rows[f'{clip}_{dname}'] = row * COLUMNS
                row += math.ceil(plan[clip]['n'] / COLUMNS)
        sheet = Image.new('RGBA', (fw * COLUMNS, fh * row))
        for clip in clips:
            for dname, turn in directions:
                start = rows[f'{clip}_{dname}']
                for n, fr in enumerate(plan[clip]['frames']):
                    key = f'{clip == "drink"}_{plan[clip]["action"]}_{fr}_{turn:.4f}_{lift.get(clip, 0.0):.4f}'
                    im = cells[key].crop((x0, y0, x1, y1))
                    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
                    idx = start + n
                    sheet.alpha_composite(im, ((idx % COLUMNS) * fw, (idx // COLUMNS) * fh))
        name = f'patron_3d_hybrid{character:02d}'
        sheet.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(SPRITES, f'{name}.png'), optimize=True)
        meta = {
            'frameWidth': fw, 'frameHeight': fh, 'columns': COLUMNS,
            'originX': round((origin[0] - x0) / (x1 - x0), 5), 'originY': round((origin[1] - y0) / (y1 - y0), 5),
            'standingHeight': STANDING, 'starts': rows,
            'frames': {c: plan[c]['n'] for c in clips}, 'fps': {c: plan[c]['fps'] for c in clips},
            'drawnHead': character,
        }
        with open(os.path.join(SPRITES, f'{name}.json'), 'w') as fh_:
            json.dump(meta, fh_, indent=2)
        print('wrote', name, sheet.size, fw, fh)


def preview_main(character, out):
    """Every rendered frame with one character's head and colours, in a
    strip on a dark background (for a trial render)."""
    from PIL import Image
    info = json.load(open(os.path.join(WORK, 'frames.json')))
    parts = drawn_parts(character)
    origin = info['origin']
    walk0 = info['frames'][0]
    ims = []
    for i, f in enumerate(info['frames']):
        shade = Image.open(os.path.join(WORK, f'shade_{i:04d}.png')).convert('RGBA')
        ids = Image.open(os.path.join(WORK, f'id_{i:04d}.png')).convert('RGBA')
        img = colour_frame(shade, ids, parts['colours'])
        head = parts[f['view']]
        hi, chin = head['img'], head['chin']
        if f['mirror']:
            hi = hi.transpose(Image.FLIP_LEFT_RIGHT)
            chin = (hi.width - chin[0], chin[1])
        scale = (origin[1] - walk0['chin'][1]) / (0.60 * parts['standingHeight'])
        hi = hi.resize((round(hi.width * scale), round(hi.height * scale)), Image.LANCZOS)
        chin = (chin[0] * scale, chin[1] * scale)
        pad = Image.new('RGBA', (hi.width * 3, hi.height * 3))
        pad.paste(hi, (hi.width, hi.height))
        pc = (chin[0] + hi.width, chin[1] + hi.height)
        rot = pad.rotate(-f['angle'], resample=Image.BICUBIC, center=pc)
        img.alpha_composite(rot, head_spot(f, pc))
        ims.append(img)
    boxes = [im.getchannel('A').getbbox() for im in ims]
    box = (min(b[0] for b in boxes) - 4, min(b[1] for b in boxes) - 4, max(b[2] for b in boxes) + 4, max(b[3] for b in boxes) + 4)
    ims = [im.crop(box) for im in ims]
    w, h = ims[0].size
    per = 12
    sheet = Image.new('RGBA', (w * per, h * math.ceil(len(ims) / per)), (36, 18, 62, 255))
    for i, im in enumerate(ims):
        sheet.alpha_composite(im, ((i % per) * w, (i // per) * h))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.convert('RGB').save(out)
    print('wrote', out, sheet.size)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    if args[0] == 'render':
        render_main()
    elif args[0] == 'preview':
        preview_main(int(args[1]), args[2])
    else:
        compose_main([int(a) for a in args[1:]])
