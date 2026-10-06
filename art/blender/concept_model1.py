"""Art concept mock-up for the 3D guests (not used by the game): the owner's
model in a flat cartoon style closer to the drawn guests, for a yes/no on
the look before the whole sheet is re-rendered.

- Cel shading in Cycles: each colour is flat (an emission), darkened in one
  hard step on the side away from a fixed light, so it reads like the
  drawn art instead of soft 3D shading.
- Thicker outlines, big open anime eyes, a smaller head, bolder colours.

    python art/blender/concept_model1.py OUT_DIR
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import iso_rig  # noqa: E402
import build_patron3d as bp  # noqa: E402
import build_patron_model1 as m1  # noqa: E402

LOOK = dict(skin='#ffc49a', hair='#3a2014', shirt='#ff3fa6', trousers='#2b3a8f',
            shoes='#ffffff', soles='#ff3fa6', eyes='#3b6fd8', brows='#3a2014',
            lines='#14081c', mouth='#b0424a')
LIGHT = Vector((-0.5, -0.8, 0.6)).normalized()   # where the cel light comes from
SHADOW = 0.72                                      # how dark the shadow tone is


def cel_material(name, hex_color, face=None):
    """A flat colour with one hard shadow step (and the painted face over
    the skin, if given)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(emit.outputs[0], out.inputs['Surface'])
    base = nt.nodes.new('ShaderNodeRGB')
    base.outputs[0].default_value = (*bp.linear(hex_color), 1)
    colour = base.outputs[0]
    if face:
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'FaceUV'
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(face)
        tex.extension = 'CLIP'
        nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        nt.links.new(tex.outputs['Alpha'], mix.inputs['Factor'])
        nt.links.new(colour, mix.inputs['A'])
        nt.links.new(tex.outputs['Color'], mix.inputs['B'])
        colour = mix.outputs['Result']
    # One hard step: lit where the normal faces the light.
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    dot = nt.nodes.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    dot.inputs[1].default_value = LIGHT
    nt.links.new(geo.outputs['Normal'], dot.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].color = (SHADOW, SHADOW, SHADOW, 1)
    ramp.color_ramp.elements[1].position = 0.42
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    remap = nt.nodes.new('ShaderNodeMapRange')
    remap.inputs['From Min'].default_value = -1
    nt.links.new(dot.outputs['Value'], remap.inputs['Value'])
    nt.links.new(remap.outputs['Result'], ramp.inputs['Fac'])
    shade = nt.nodes.new('ShaderNodeMix')
    shade.data_type = 'RGBA'
    shade.blend_type = 'MULTIPLY'
    shade.inputs['Factor'].default_value = 1
    nt.links.new(colour, shade.inputs['A'])
    nt.links.new(ramp.outputs['Color'], shade.inputs['B'])
    nt.links.new(shade.outputs['Result'], emit.inputs['Color'])
    return m


def paint_face(path):
    """Big, open, bright anime eyes with a double highlight, a thick upper
    lash line, raised brows and a small open smile."""
    from PIL import Image, ImageDraw
    S = bp.FACE_PX
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, z0, size = bp.FACE_BOX

    def px(x, z):
        return (x - x0) / size * S, (1 - (z - z0) / size) * S

    def rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

    eye_z, eye_w, eye_h = 1.115, 0.12, 0.15
    for side in (-1, 1):
        cx, cy = px(side * 0.125, eye_z)
        w, h = eye_w / size * S, eye_h / size * S
        d.ellipse((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), fill=(255, 255, 255, 255), outline=rgb(LOOK['lines']), width=int(w * 0.06))
        iw, ih = w * 0.78, h * 0.8
        ix = cx - side * w * 0.05
        d.ellipse((ix - iw / 2, cy - ih / 2 + h * 0.08, ix + iw / 2, cy + ih / 2 + h * 0.08), fill=rgb(LOOK['eyes']))
        d.ellipse((ix - iw * 0.3, cy - ih * 0.15 + h * 0.08, ix + iw * 0.3, cy + ih * 0.35 + h * 0.08), fill=rgb(LOOK['lines']))
        g = iw * 0.2
        d.ellipse((ix - iw * 0.32 - g, cy - ih * 0.28 - g, ix - iw * 0.32 + g, cy - ih * 0.28 + g), fill=(255, 255, 255, 255))
        g2 = iw * 0.09
        d.ellipse((ix + iw * 0.22 - g2, cy + ih * 0.25 - g2, ix + iw * 0.22 + g2, cy + ih * 0.25 + g2), fill=(255, 255, 255, 255))
        # Thick upper lash line, flicking out at the corner.
        top = cy - h / 2
        d.line((cx - w * 0.55, top + h * 0.12, cx, top - h * 0.02, cx + w * 0.55, top + h * 0.12), fill=rgb(LOOK['lines']), width=int(h * 0.12))
        oc = cx + side * w * 0.55
        d.line((oc, top + h * 0.12, oc + side * w * 0.14, top - h * 0.04), fill=rgb(LOOK['lines']), width=int(h * 0.08))
        bx0, by0 = px(side * 0.06, eye_z + 0.12)
        bx1, by1 = px(side * 0.19, eye_z + 0.13)
        d.line((bx0, by0, bx1, by1), fill=rgb(LOOK['brows']), width=int(h * 0.09))
    # A small open smile.
    mx0, my0 = px(-0.045, 0.995)
    mx1, my1 = px(0.045, 0.995)
    d.chord((mx0, my0 - 14, mx1, my1 + 26), 0, 180, fill=rgb(LOOK['mouth']), outline=rgb(LOOK['lines']), width=6)
    # Blush.
    for side in (-1, 1):
        bx, by = px(side * 0.19, 1.03)
        d.ellipse((bx - 34, by - 16, bx + 34, by + 16), fill=(255, 120, 140, 90))
    img.save(path)


def main():
    out_dir = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    bp.LOOK = LOOK
    bp.region_of = m1.region_of
    bp.HAIR_THICKNESS = 0.045
    scene = iso_rig.reset_scene()
    scene.cycles.samples = 16
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    cam = iso_rig.add_camera(scene)
    scene.render.resolution_percentage = 200      # a crisp mock-up

    objs = bp.import_clip(os.path.join(m1.FBX_DIR, 'sit.fbx'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH')
    actions = {'sit': arm.animation_data.action}
    for clip in ('dance', 'drink', 'walk'):
        actions[clip] = m1.load_action(os.path.join(m1.FBX_DIR, f'{clip}.fbx'), clip)
    bp.walk_in_place(actions['walk'])

    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    face = os.path.join(out_dir, 'concept_face.png')
    paint_face(face)
    bp.colour_body(body, face)
    hair = m1.add_hair(body)
    # Swap every material for its cel-shaded version.
    for mat in list(body.data.materials):
        i = list(body.data.materials).index(mat)
        name = mat.name.split('.')[0].lower()
        key = {'skin': 'skin', 'shirt': 'shirt', 'trousers': 'trousers', 'shoes': 'shoes', 'soles': 'soles'}.get(name, 'skin')
        body.data.materials[i] = cel_material(f'Cel{key}', LOOK[key], face=face if key == 'skin' else None)
    hair.data.materials[0] = cel_material('CelHair', LOOK['hair'])
    for o in (body, hair):
        for p in o.data.polygons:
            p.use_smooth = True
    arm.data.pose_position = 'POSE'

    root = bpy.data.objects.new('Root', None)
    scene.collection.objects.link(root)
    arm.parent = root
    s = m1.HEIGHT / 1.483
    root.scale = (s, s, s)
    iso_rig.add_outlines(scene, root)
    # The flat colours are emissions, which add_outlines takes for neon and
    # leaves unlined: line everything.
    no_lines = bpy.data.collections.get('NoOutline')
    for o in list(no_lines.objects):
        no_lines.objects.unlink(o)
    ls = bpy.context.view_layer.freestyle_settings.linesets[0]
    ls.linestyle.thickness = 3.5
    ls.select_crease = False        # just the outline, no scribbles in the hair
    iso_rig.apply_model_scale(root)
    # A slightly smaller head (and hair, which follows the head bone).
    arm.pose.bones['mixamorig:Head'].scale = (0.86, 0.86, 0.86)

    from PIL import Image
    shots = []
    poses = [('drink', 1, 0), ('walk', 9, 0), ('dance', 40, 0), ('sit', 30, 0), ('drink', 150, 0), ('walk', 9, 1)]
    for clip, frame, back in poses:
        m1.use_action(arm, actions[clip])
        root.rotation_euler = (0, 0, m1.DIRECTIONS[back][1])
        scene.frame_set(frame)
        path = os.path.join(out_dir, f'concept_{clip}_{frame}_{back}.png')
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        shots.append(Image.open(path).convert('RGBA'))
    boxes = [im.getchannel('A').getbbox() for im in shots]
    box = (min(b[0] for b in boxes) - 6, min(b[1] for b in boxes) - 6, max(b[2] for b in boxes) + 6, max(b[3] for b in boxes) + 6)
    shots = [im.crop(box) for im in shots]
    w, h = shots[0].size
    sheet = Image.new('RGBA', (w * len(shots), h), (0, 0, 0, 0))
    for i, im in enumerate(shots):
        sheet.alpha_composite(im, (i * w, 0))
    sheet.save(os.path.join(out_dir, 'concept_strip.png'))
    print('wrote', os.path.join(out_dir, 'concept_strip.png'), sheet.size)


if __name__ == '__main__':
    main()
