"""Paints the owner's girl base model (art/characters/girl_base.blend, a grey
clay chibi in a T-pose: T-shirt, shorts, flat shoes, long hair) in one of a
few looks: skin, hair with a lighter crown, a T-shirt with a printed
graphic on the front, denim or cotton shorts, two-tone shoes, blush,
little gold hoops, and the dark cartoon outlines every prop render has.

The model has no UV maps, so the print and the fabrics are projected from
the front in object space; nothing in the mesh is changed.

    python paint_girl.py SRC.blend LOOK OUT.png [--save OUT.blend]

LOOK is one of LOOKS below. Renders the front from the file's own
portrait camera, on a transparent background.
"""
import math
import os
import sys

import bpy
from mathutils import Vector
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))


def srgb(hex_colour, alpha=1.0):
    """'#rrggbb' to a linear RGBA tuple, as Blender's colour inputs want."""
    h = hex_colour.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, alpha)


# Each look: skin, hair (and its lighter crown), shirt and its print
# (shape, fill, outline), shorts (denim or not), shoes and soles.
LOOKS = {
    'pinkpop': dict(skin='#f2c4a6', hair='#3b2418', hairLight='#6a4130', shirt='#ff3fa6', print=('star', '#ffffff', '#b8137a'),
                    shorts='#4f7fc0', denim=True, shoes='#f7f7f7', soles='#ff4fa8', blush='#ff7b9c'),
    'neon': dict(skin='#d39a74', hair='#efe0b4', hairLight='#fff8e2', shirt='#221d2e', print=('bolt', '#5ff0ff', '#ff4fd8'),
                 shorts='#7a3fd0', denim=False, shoes='#25222c', soles='#5ff0ff', blush='#ff6b8a'),
    'sunny': dict(skin='#8a5538', hair='#1c1416', hairLight='#3e1c26', shirt='#ffc93a', print=('heart', '#ff4f8a', '#ffffff'),
                  shorts='#e9eef5', denim=True, shoes='#ff8ac8', soles='#ffffff', blush='#d8506a'),
}


def bounds(objs):
    """World-space min and max corners of some objects."""
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def objects_starting(prefix):
    return [o for o in bpy.data.objects if o.name.startswith(prefix)]


def principled(mat):
    mat.use_nodes = True
    return mat.node_tree.nodes.get('Principled BSDF')


def set_flat(name, colour, rough=0.6):
    mat = bpy.data.materials.get(name)
    if not mat:
        return
    b = principled(mat)
    b.inputs['Base Color'].default_value = srgb(colour)
    b.inputs['Roughness'].default_value = rough


def shade(hex_colour, k):
    """A darker (k < 1) or lighter (k > 1) version of a colour."""
    h = hex_colour.lstrip('#')
    rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    if k < 1:
        rgb = [round(c * k) for c in rgb]
    else:
        rgb = [round(c + (255 - c) * (k - 1)) for c in rgb]
    return '#' + ''.join(f'{c:02x}' for c in rgb)


def print_image(shape, fill, line, path, size=512):
    """The T-shirt's graphic, drawn on a transparent square."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c, r = size / 2, size * 0.42
    if shape == 'star':
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            rr = r if i % 2 == 0 else r * 0.45
            pts.append((c + rr * math.cos(a), c + rr * math.sin(a)))
        d.polygon(pts, fill=fill, outline=line, width=18)
        for (x, y, s) in ((0.86, 0.16, 0.07), (0.12, 0.8, 0.05)):
            d.polygon([(x * size, (y - s) * size), ((x + s * 0.3) * size, y * size), (x * size, (y + s) * size), ((x - s * 0.3) * size, y * size)], fill=fill)
    elif shape == 'bolt':
        pts = [(0.58, 0.04), (0.2, 0.56), (0.47, 0.56), (0.38, 0.96), (0.8, 0.4), (0.53, 0.4), (0.66, 0.04)]
        d.polygon([(x * size, y * size) for x, y in pts], fill=fill, outline=line, width=16)
    elif shape == 'heart':
        pts = []
        for i in range(200):
            t = i / 200 * 2 * math.pi
            x = 16 * math.sin(t) ** 3
            y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            pts.append((c + x * r / 17, c - y * r / 17 - size * 0.02))
        d.polygon(pts, fill=fill, outline=line, width=18)
    img.save(path)
    return path


def front_projection(nt, lo, hi, scale=1.0, centre_z=None):
    """UV coordinates for a picture laid flat on the front: X across, Z up,
    covering the box lo..hi (shrunk by `scale` around its middle)."""
    n = nt.nodes
    coord = n.new('ShaderNodeTexCoord')
    sep = n.new('ShaderNodeSeparateXYZ')
    nt.links.new(coord.outputs['Object'], sep.inputs[0])
    w = (hi.x - lo.x) * scale
    cx = (hi.x + lo.x) / 2
    cz = centre_z if centre_z is not None else (hi.z + lo.z) / 2

    def remap(socket, centre, span):
        m = n.new('ShaderNodeMapRange')
        m.inputs['From Min'].default_value = centre - span / 2
        m.inputs['From Max'].default_value = centre + span / 2
        m.clamp = False
        nt.links.new(socket, m.inputs['Value'])
        return m.outputs['Result']

    comb = n.new('ShaderNodeCombineXYZ')
    nt.links.new(remap(sep.outputs['X'], cx, w), comb.inputs['X'])
    nt.links.new(remap(sep.outputs['Z'], cz, w), comb.inputs['Y'])
    return comb.outputs['Vector']


def front_mask(nt):
    """1 on faces pointing at the camera (-Y), fading to 0 round the sides."""
    n = nt.nodes
    geo = n.new('ShaderNodeNewGeometry')
    sep = n.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    m = n.new('ShaderNodeMapRange')
    m.inputs['From Min'].default_value = -0.35
    m.inputs['From Max'].default_value = -0.75
    nt.links.new(sep.outputs['Y'], m.inputs['Value'])
    return m.outputs['Result']


def paint_shirt(look, tmp_dir):
    mat = bpy.data.materials['Ivory cotton']
    b = principled(mat)
    nt = mat.node_tree
    shirt = objects_starting('T-shirt')
    lo, hi = bounds(shirt)
    shape, fill, line = look['print']
    img = bpy.data.images.load(print_image(shape, fill, line, os.path.join(tmp_dir, f'print_{shape}.png')))
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'CLIP'
    # The print sits on the chest, a bit under half the shirt's width.
    nt.links.new(front_projection(nt, lo, hi, scale=0.46, centre_z=lo.z + (hi.z - lo.z) * 0.48), tex.inputs['Vector'])
    mask = nt.nodes.new('ShaderNodeMath')
    mask.operation = 'MULTIPLY'
    nt.links.new(tex.outputs['Alpha'], mask.inputs[0])
    nt.links.new(front_mask(nt), mask.inputs[1])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = srgb(look['shirt'])
    nt.links.new(mask.outputs[0], mix.inputs['Factor'])
    nt.links.new(tex.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.85


def paint_shorts(look):
    mat = bpy.data.materials['Slate shorts']
    b = principled(mat)
    nt = mat.node_tree
    if not look['denim']:
        b.inputs['Base Color'].default_value = srgb(look['shorts'])
        b.inputs['Roughness'].default_value = 0.8
        return
    # Denim: a fine diagonal weave and a faded, blotchy wash.
    n = nt.nodes
    coord = n.new('ShaderNodeTexCoord')
    wave = n.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'DIAGONAL'
    wave.inputs['Scale'].default_value = 140
    nt.links.new(coord.outputs['Object'], wave.inputs['Vector'])
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 6
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = srgb(shade(look['shorts'], 0.78))
    ramp.color_ramp.elements[1].color = srgb(shade(look['shorts'], 1.18))
    mixf = n.new('ShaderNodeMath')
    mixf.operation = 'ADD'
    scale_wave = n.new('ShaderNodeMath')
    scale_wave.operation = 'MULTIPLY'
    scale_wave.inputs[1].default_value = 0.18
    nt.links.new(wave.outputs['Fac'], scale_wave.inputs[0])
    nt.links.new(noise.outputs['Fac'], mixf.inputs[0])
    nt.links.new(scale_wave.outputs[0], mixf.inputs[1])
    nt.links.new(mixf.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.15
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.9


def paint_hair(look):
    """Hair darkens toward the ends and catches light on the crown."""
    hair = [o for o in bpy.data.objects if o.active_material and 'hair' in o.active_material.name.lower()]
    lo, hi = bounds(hair)
    for name, k in (('Soft graphite • editable hair', 1.0), ('Hair • recessed strand tone', 0.6)):
        mat = bpy.data.materials.get(name)
        if not mat:
            continue
        b = principled(mat)
        nt = mat.node_tree
        coord = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(coord.outputs['Object'], sep.inputs[0])
        m = nt.nodes.new('ShaderNodeMapRange')
        m.inputs['From Min'].default_value = lo.z
        m.inputs['From Max'].default_value = hi.z
        nt.links.new(sep.outputs['Z'], m.inputs['Value'])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = srgb(shade(look['hair'], 0.88 * k))
        ramp.color_ramp.elements[1].position = 0.97
        ramp.color_ramp.elements[1].color = srgb(shade(look['hairLight'], k) if k == 1 else shade(look['hair'], k))
        mid = ramp.color_ramp.elements.new(0.72)
        mid.color = srgb(shade(look['hair'], k))
        nt.links.new(m.outputs['Result'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.45
        b.inputs['Coat Weight'].default_value = 0.25


def paint_trims(look):
    """The collar and the shorts' cuffs get their own trim colours (in the
    file they share the shorts' and shirt's materials, swapped)."""
    for prefix, colour in (('Collar seam', shade(look['shirt'], 0.72)), ('Shorts cuff', shade(look['shorts'], 1.25))):
        mat = bpy.data.materials.new(f'{prefix} trim')
        b = principled(mat)
        b.inputs['Base Color'].default_value = srgb(colour)
        b.inputs['Roughness'].default_value = 0.8
        for o in objects_starting(prefix):
            o.data.materials.clear()
            o.data.materials.append(mat)


def add_disc(name, centre, normal, radius, material, flatten=0.55):
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=radius, fill_type='NGON', location=centre)
    disc = bpy.context.active_object
    disc.name = name
    disc.scale = (1, flatten, 1)
    disc.rotation_euler = normal.to_track_quat('Z', 'Y').to_euler()
    disc.data.materials.append(material)
    return disc


def add_blush(look):
    """Two soft pink ovals on the cheeks, under the smiling eyes."""
    head = next(o for o in bpy.data.objects if o.name.startswith('Head'))
    lids = objects_starting('Tapered smiling eyelid')
    smile = objects_starting('Small smile')
    if not lids or not smile:
        return []
    mat = bpy.data.materials.new('Blush')
    mat.use_nodes = True
    mat.blend_method = 'BLEND'
    b = principled(mat)
    b.inputs['Base Color'].default_value = srgb(look['blush'])
    b.inputs['Alpha'].default_value = 0.45
    b.inputs['Roughness'].default_value = 0.7
    s_lo, s_hi = bounds(smile)
    discs = []
    inv = head.matrix_world.inverted()
    for lid in lids:
        l_lo, l_hi = bounds([lid])
        x = (l_lo.x + l_hi.x) / 2 * 1.08
        z = l_lo.z - (l_lo.z - s_hi.z) * 0.55
        start = Vector((x, -10, z))
        ok, loc, nrm, _ = head.ray_cast(inv @ start, (inv.to_3x3() @ Vector((0, 1, 0))).normalized())
        if not ok:
            continue
        world = head.matrix_world @ loc
        n = (head.matrix_world.to_3x3() @ nrm).normalized()
        discs.append(add_disc(f'Blush {lid.name[-2:].strip()}', world + n * 0.004, n, 0.085, mat))
    return discs


def add_hoops():
    """Little gold hoop earrings hanging from the bottom of each ear."""
    gold = bpy.data.materials.new('Gold hoop')
    b = principled(gold)
    b.inputs['Base Color'].default_value = srgb('#ffc93a')
    b.inputs['Metallic'].default_value = 0.6
    b.inputs['Roughness'].default_value = 0.25
    out = []
    for ear in [o for o in bpy.data.objects if o.name.startswith('Ear') and not o.name.startswith('Ear inner')]:
        lo, hi = bounds([ear])
        bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.011, location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z - 0.035))
        hoop = bpy.context.active_object
        hoop.name = f'Hoop {ear.name}'
        hoop.rotation_euler = (math.radians(90), 0, 0)
        hoop.data.materials.append(gold)
        out.append(hoop)
    return out


def add_outlines(scene, skip):
    """Dark cartoon outlines, like the game's prop renders (see iso_rig)."""
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = 'ABSOLUTE'
    fs = bpy.context.view_layer.freestyle_settings
    fs.crease_angle = math.radians(137)
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new('Outlines')
    ls.select_silhouette = ls.select_border = ls.select_external_contour = True
    ls.select_crease = False
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new('Outline')
    ls.linestyle.color = (0.04, 0.02, 0.05)
    ls.linestyle.thickness = 2.6
    no_lines = bpy.data.collections.new('NoOutline')
    scene.collection.children.link(no_lines)
    for o in skip:
        no_lines.objects.link(o)
    ls.select_by_collection = True
    ls.collection = no_lines
    ls.collection_negation = 'EXCLUSIVE'


def paint(look_name, tmp_dir):
    look = LOOKS[look_name]
    skin = look['skin']
    set_flat('Porcelain • editable skin', skin, 0.55)
    set_flat('Ear inset', shade(skin, 0.8), 0.6)
    set_flat('Eyelid • soft crease', shade(skin, 0.62), 0.6)
    set_flat('Ivory shoes', look['shoes'], 0.5)
    set_flat('Soles', look['soles'], 0.6)
    paint_shirt(look, tmp_dir)
    paint_shorts(look)
    paint_hair(look)
    paint_trims(look)
    skip = add_blush(look)
    add_hoops()
    return skip


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    src, look_name, out = args[0], args[1], args[2]
    save = args[args.index('--save') + 1] if '--save' in args else None
    bpy.ops.wm.open_mainfile(filepath=src)
    scene = bpy.context.scene
    skip = paint(look_name, os.path.dirname(os.path.abspath(out)))
    add_outlines(scene, skip)
    scene.render.engine = 'CYCLES'
    # The same colour look as the game's prop renders (iso_rig), so she
    # sits in with them.
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = int(os.environ.get('SAMPLES', '32'))
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = 630, 800
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    if save:
        bpy.ops.wm.save_as_mainfile(filepath=save, compress=True)


if __name__ == '__main__':
    main()
