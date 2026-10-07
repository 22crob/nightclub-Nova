"""Guests painted by ChatGPT: the owner's 3D model (art/characters/
character_model_1*, animated in Mixamo) wearing a front and a back drawing
made over plain grey renders of it, so the look is the drawing's and the
movement is Mixamo's. Nothing about the look is invented here.

How a new guest is made:
 1. `--clay DIR` renders the bare model front and back (grey, white
    background, outlined), the pictures to give ChatGPT.
 2. ChatGPT colours them in, keeping the exact outline and pose; save them
    as art/characters/painted/<name>_front.png and <name>_back.png.
 3. `python art/blender/build_patron_painted.py <name>` wraps them onto the
    model (front picture on the front, back on the back, blended round the
    sides; the hair, which pokes out past the head, goes on a slightly
    bigger copy of the head, cut out to the hair's shape) and renders the
    game sheet patron_3d_<name>.png/.json with build_patron_model1.py's
    clips, grid and camera. `--preview DIR` renders a few stills instead.

Run from the repo root with a Python that has bpy==4.5.4 and pillow.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_patron3d as bp  # noqa: E402
import build_patron_model1 as m1  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
PAINTED = os.path.join(REPO, 'art', 'characters', 'painted')
TEX = 1024          # the clay renders' size, and the textures'
MARGIN = 1.08       # the clay renders frame the model this much bigger
NECK_PX = 360       # in the 1024 textures: the hair is all above this row

# The cartoon look (--toon), like Nightclub City's drawn guests: flat colour
# with one shadow step instead of 3D lighting, a bold dark outline round the
# whole figure, and a bigger head.
TOON = {
    'light': (-0.45, -0.55, 0.7),   # where the one shadow step comes from
    'shadow': 0.8,                  # how dark the shadow side is
    'outline_px': 6,                # in the render (before the sheet shrinks it)
    'outline': (12, 8, 16, 255),
    'head': 1.35,                   # head size
}
toon = False
EDGE_PX = 7         # the drawing's outer outline, stripped before wrapping


# --------------------------------------------------------------------------
# The pictures
# --------------------------------------------------------------------------

def prepare(src, out_body, out_hair):
    """From a ChatGPT drawing: a body texture with the background and the
    outer outline replaced by the nearest colour inside (so the model's
    sides don't pick up white or a stretched black line), and a hair
    texture (the hair's colours, transparent everywhere else)."""
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
    im = Image.open(src).convert('RGB').resize((TEX, TEX), Image.LANCZOS)

    # Background: the near-white reached from the corners (white shoes,
    # enclosed by their outline, stay).
    light = im.convert('L').point(lambda v: 255 if v > 228 else 0)
    flood = light.copy()
    for corner in ((0, 0), (TEX - 1, 0), (0, TEX - 1), (TEX - 1, TEX - 1)):
        if flood.getpixel(corner) == 255:
            ImageDraw.floodfill(flood, corner, 128)
    figure = flood.point(lambda v: 0 if v == 128 else 255)
    inner = figure.filter(ImageFilter.MinFilter(2 * EDGE_PX + 1))

    # Grow the inside colours outward over the outline and background.
    body = Image.new('RGB', im.size)
    body.paste(im, mask=inner)
    have = inner
    for _ in range(80):
        grown = have.filter(ImageFilter.MaxFilter(3))
        ring = ImageChops.subtract(grown, have)
        if not ring.getbbox():
            break
        spread = body.filter(ImageFilter.MaxFilter(3))     # brightest neighbour,
        spread_dark = body.filter(ImageFilter.MinFilter(3))  # darkest neighbour,
        blend = Image.blend(spread, spread_dark, 0.5)       # their middle
        body.paste(blend, mask=ring)
        have = grown
    body.save(out_body)

    # Hair: the mass of the hair's own colour on top of the head (any
    # colour: it's sampled just under the top of the figure), without the
    # eyes and face lines (separate blobs), its own strand lines closed in.
    top = next(y for y in range(TEX) if any(figure.getpixel((x, y)) for x in range(TEX // 2 - 120, TEX // 2 + 121, 3)))
    patch = [im.getpixel((x, y)) for y in range(top + 25, top + 70, 3) for x in range(TEX // 2 - 80, TEX // 2 + 81, 3)
             if inner.getpixel((x, y))]
    base = tuple(sorted(c[k] for c in patch)[len(patch) // 2] for k in range(3))

    def near(c):
        return sum((a - b) ** 2 for a, b in zip(c, base)) < 70 ** 2
    head = Image.new('L', im.size, 0)
    ImageDraw.Draw(head).rectangle((0, 0, TEX, NECK_PX), fill=255)
    like = Image.new('L', im.size, 0)
    px = like.load()
    pix = im.load()
    for y in range(NECK_PX):
        for x in range(TEX):
            if near(pix[x, y]):
                px[x, y] = 255
    solid = like.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    seed = next(((x, y) for y in range(top, NECK_PX // 2, 2) for x in range(TEX // 2 - 120, TEX // 2 + 121, 4)
                 if solid.getpixel((x, y)) == 255), None)
    if seed is None:
        raise SystemExit(f'no hair found in {src}')
    ImageDraw.floodfill(solid, seed, 128)
    mass = solid.point(lambda v: 255 if v == 128 else 0)
    mass = mass.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))   # close the strand lines
    mass = ImageChops.multiply(mass, head)
    # Light fringe left from the white background becomes the hair colour.
    hair = im.copy()
    lum = sum(base) / 3
    halo = im.convert('L').point(lambda v: 255 if v > max(200, lum + 40) else 0)
    hair.paste(base, mask=halo)
    # Its outer outline would smear across the sides of the head, so the
    # dark pixels near its edge take the hair colour too.
    rim = ImageChops.subtract(mass, mass.filter(ImageFilter.MinFilter(2 * EDGE_PX + 3)))
    dark_rim = ImageChops.multiply(rim, im.convert('L').point(lambda v: 255 if v < lum * 0.6 else 0))
    hair.paste(base, mask=dark_rim)
    hair = hair.convert('RGBA')
    hair.putalpha(mass)
    hair.save(out_hair)
    # The scalp under the hair: plain hair colour wherever the head isn't
    # face or ears, so a gap in the hair never shows dark lines.
    face = ImageChops.subtract(inner, mass.filter(ImageFilter.MaxFilter(9)))
    scalp = ImageChops.subtract(head, face)
    body = Image.open(out_body).convert('RGB')
    body.paste(base, mask=scalp)
    body.save(out_body)
    mass.save(out_hair.replace('.png', '_mask.png'))
    return mass.getbbox(), base


# --------------------------------------------------------------------------
# Wrapping them on
# --------------------------------------------------------------------------

def rest_points(obj):
    """World positions and normals of a mesh's vertices as it is now (the
    armature in its rest pose)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mesh = ev.to_mesh()
    mw = ev.matrix_world
    pts = [mw @ v.co for v in mesh.vertices]
    nrm = [(mw.to_3x3() @ v.normal).normalized() for v in mesh.vertices]
    ev.to_mesh_clear()
    return pts, nrm


class Frame:
    """Where a world point lands in the 1024 clay renders (and so in the
    drawings): u across, v up, front view looking along +Y."""
    def __init__(self, pts):
        xs = [p.x for p in pts]
        zs = [p.z for p in pts]
        self.cx = (min(xs) + max(xs)) / 2
        self.cz = (min(zs) + max(zs)) / 2
        self.size = max(max(xs) - min(xs), max(zs) - min(zs)) * MARGIN

    def front(self, p):
        return ((p.x - self.cx) / self.size + 0.5, (p.z - self.cz) / self.size + 0.5)

    def back(self, p):
        return (0.5 - (p.x - self.cx) / self.size, (p.z - self.cz) / self.size + 0.5)

    def world_x(self, u):
        return self.cx + (u - 0.5) * self.size

    def world_z(self, v):
        return self.cz + (v - 0.5) * self.size


def project(obj, frame, pts, nrm):
    """Gives `obj` UV maps for the front and back pictures, and a per-vertex
    `front` weight (1 facing the viewer, 0 facing away, blended round the
    sides)."""
    me = obj.data
    for name in ('UVFront', 'UVBack'):
        if name not in me.uv_layers:
            me.uv_layers.new(name=name)
    uf, ub = me.uv_layers['UVFront'], me.uv_layers['UVBack']
    for loop in me.loops:
        p = pts[loop.vertex_index]
        uf.data[loop.index].uv = frame.front(p)
        ub.data[loop.index].uv = frame.back(p)
    attr = me.attributes.get('front') or me.attributes.new('front', 'FLOAT', 'POINT')
    up = me.attributes.get('up') or me.attributes.new('up', 'FLOAT', 'POINT')
    for i, n in enumerate(nrm):
        attr.data[i].value = bp.smoothstep(-0.3, 0.3, -n.y)
        up.data[i].value = bp.smoothstep(0.35, 0.65, n.z)


def painted_material(name, front_png, back_png, cutout=False, hair_rgb=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (0.22, 0.2, 0.26, 1)     # the edge lines' colour (iso_rig.add_outlines)
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.85
    out = nodes['Material Output']

    def picture(path, uv_name, y):
        uv = nodes.new('ShaderNodeUVMap')
        uv.uv_map = uv_name
        uv.location = (-900, y)
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(path)
        tex.extension = 'EXTEND'
        tex.interpolation = 'Closest' if cutout else 'Linear'
        tex.location = (-650, y)
        links.new(uv.outputs['UV'], tex.inputs['Vector'])
        return tex

    f = picture(front_png, 'UVFront', 200)
    b = picture(back_png, 'UVBack', -150)
    weight = nodes.new('ShaderNodeAttribute')
    weight.attribute_name = 'front'
    weight.location = (-650, 450)
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.location = (-350, 200)
    links.new(weight.outputs['Fac'], mix.inputs['Factor'])
    links.new(b.outputs['Color'], mix.inputs['A'])
    links.new(f.outputs['Color'], mix.inputs['B'])
    links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    # A little of the picture's own colour as glow, so shadows don't muddy it.
    links.new(mix.outputs['Result'], bsdf.inputs['Emission Color'])
    # (iso_rig.add_outlines skips parts glowing over 0.3: the body (0.25) gets edge
    # lines, the hair shell, mostly see-through, doesn't.)
    bsdf.inputs['Emission Strength'].default_value = 0.4 if cutout else 0.25
    bsdf.inputs['Specular IOR Level'].default_value = 0.1 if cutout else 0.3
    if cutout:
        # The drawings never show the top of the head: whatever faces up is
        # plain hair.
        up = nodes.new('ShaderNodeAttribute')
        up.attribute_name = 'up'
        up.location = (-650, 600)
        top = nodes.new('ShaderNodeMix')
        top.data_type = 'RGBA'
        top.location = (-150, 300)
        links.new(up.outputs['Fac'], top.inputs['Factor'])
        links.new(mix.outputs['Result'], top.inputs['A'])
        top.inputs['B'].default_value = (*hair_rgb, 1)
        links.new(top.outputs['Result'], bsdf.inputs['Base Color'])
        links.new(top.outputs['Result'], bsdf.inputs['Emission Color'])
        amix = nodes.new('ShaderNodeMix')
        amix.data_type = 'FLOAT'
        amix.location = (-350, -150)
        links.new(weight.outputs['Fac'], amix.inputs['Factor'])
        links.new(b.outputs['Alpha'], amix.inputs['A'])
        links.new(f.outputs['Alpha'], amix.inputs['B'])
        solid = nodes.new('ShaderNodeMath')
        solid.operation = 'MAXIMUM'
        links.new(amix.outputs['Result'], solid.inputs[0])
        links.new(up.outputs['Fac'], solid.inputs[1])
        clip = nodes.new('ShaderNodeMath')
        clip.operation = 'GREATER_THAN'
        clip.inputs[1].default_value = 0.5
        links.new(solid.outputs['Value'], clip.inputs[0])
        hole = nodes.new('ShaderNodeBsdfTransparent')
        both = nodes.new('ShaderNodeMixShader')
        both.location = (200, 0)
        links.new(clip.outputs['Value'], both.inputs['Fac'])
        links.new(hole.outputs['BSDF'], both.inputs[1])
        links.new(bsdf.outputs['BSDF'], both.inputs[2])
        links.new(both.outputs['Shader'], out.inputs['Surface'])
    if toon:
        cartoon(nt, top if cutout else mix, both if cutout else None)
    return mat


def cartoon(nt, colour, cutout_mix):
    """Swaps the lit surface for flat colour: the picture's own colour, a
    little darker on the side away from TOON['light'] (one hard step)."""
    nodes, links = nt.nodes, nt.links
    geo = nodes.new('ShaderNodeNewGeometry')
    dot = nodes.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    dot.inputs[1].default_value = Vector(TOON['light']).normalized()
    links.new(geo.outputs['Normal'], dot.inputs[0])
    step = nodes.new('ShaderNodeValToRGB')
    step.color_ramp.interpolation = 'CONSTANT'
    s = TOON['shadow']
    step.color_ramp.elements[0].color = (s, s, s, 1)
    step.color_ramp.elements[1].position = 0.15
    step.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(dot.outputs['Value'], step.inputs['Fac'])
    shade = nodes.new('ShaderNodeMix')
    shade.data_type = 'RGBA'
    shade.blend_type = 'MULTIPLY'
    shade.inputs['Factor'].default_value = 1.0
    links.new(colour.outputs['Result'], shade.inputs['A'])
    links.new(step.outputs['Color'], shade.inputs['B'])
    flat = nodes.new('ShaderNodeEmission')
    links.new(shade.outputs['Result'], flat.inputs['Color'])
    if cutout_mix:
        links.new(flat.outputs['Emission'], cutout_mix.inputs[2])
    else:
        links.new(flat.outputs['Emission'], nodes['Material Output'].inputs['Surface'])


def bold_outline(im):
    """A dark outline round the whole figure (hair cut-out included)."""
    from PIL import Image, ImageChops, ImageFilter
    a = im.getchannel('A').point(lambda v: 255 if v > 100 else 0)
    w = TOON['outline_px']
    ring = ImageChops.subtract(a.filter(ImageFilter.MaxFilter(2 * w + 1)), a).filter(ImageFilter.GaussianBlur(0.6))
    out = Image.new('RGBA', im.size, TOON['outline'])
    out.putalpha(ring)
    out.alpha_composite(im)
    return out


def big_head(arm, scale):
    """Makes the head bigger in every clip (from the neck, so it grows up
    and out): drops any head-scale keys and scales the head bone."""
    path = 'pose.bones["mixamorig:Head"].scale'
    for act in bpy.data.actions:
        curves = []
        try:
            curves = [fc for fc in act.fcurves if fc.data_path == path]
            for fc in curves:
                act.fcurves.remove(fc)
        except AttributeError:
            pass
        for layer in getattr(act, 'layers', []):
            for strip in layer.strips:
                for bag in getattr(strip, 'channelbags', []):
                    for fc in [fc for fc in bag.fcurves if fc.data_path == path]:
                        bag.fcurves.remove(fc)
    arm.pose.bones['mixamorig:Head'].scale = (scale, scale, scale)


def make_painter(name, work):
    """The colour_body / add_hair pair build_patron_model1.main() calls,
    wrapping guest `name`'s drawings on instead of inventing a look."""
    paths = {}
    hair_boxes = {}
    for side in ('front', 'back'):
        src = os.path.join(PAINTED, f'{name}_{side}.png')
        paths[side] = (os.path.join(work, f'{name}_{side}_body.png'), os.path.join(work, f'{name}_{side}_hair.png'))
        hair_boxes[side], hair_rgb = prepare(src, *paths[side])
        if side == 'front':
            state_rgb = tuple((c / 255) ** 2.2 for c in hair_rgb)     # sRGB -> linear
    state = {}

    def colour_body(body, _face):
        pts, nrm = rest_points(body)
        frame = Frame(pts)
        print('painted: model frame', round(frame.cx, 4), round(frame.cz, 4), round(frame.size, 4))
        project(body, frame, pts, nrm)
        body.data.materials.clear()
        body.data.materials.append(painted_material('Painted', paths['front'][0], paths['back'][0]))
        for p in body.data.polygons:
            p.material_index = 0
        state['frame'] = frame

    def add_hair(body):
        import bmesh
        frame = state['frame']
        hair = body.copy()
        hair.data = body.data.copy()
        hair.name = 'Hair'
        bpy.context.scene.collection.objects.link(hair)
        mw = body.matrix_world
        inv = mw.inverted()
        bm = bmesh.new()
        bm.from_mesh(hair.data)
        deform = bm.verts.layers.deform.active
        head_idx = [g.name for g in body.vertex_groups].index('mixamorig:Head')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v[deform].get(head_idx, 0) < 0.99], context='VERTS')
        head = [mw @ v.co for v in bm.verts]
        c = Vector((sum(p.x for p in head) / len(head), sum(p.y for p in head) / len(head),
                    sum(p.z for p in head) / len(head)))
        # Shape it: where the drawings show hair, the head grows a rounded
        # cut a little off the scalp with tufts on the crown, never past the
        # drawn hair's outline (seen from the front, or the back for the
        # back of the head). Where there's no hair (the face, the ears) it
        # stays just off the skin, and is see-through anyway.
        from PIL import Image
        masks = {side: Image.open(paths[side][1].replace('.png', '_mask.png')) for side in ('front', 'back')}

        def in_hair(p, side):
            u, v = frame.front(p) if side == 'front' else frame.back(p)
            x, y = int(u * TEX), int((1 - v) * TEX)
            return 0 <= x < TEX and 0 <= y < TEX and masks[side].getpixel((x, y)) > 127

        def spread(d, t):
            # Out from the head's centre by t (a little less front to back).
            return Vector((d.x * t, d.y * (1 + (t - 1) * 0.8), d.z * t))

        bm.normal_update()
        moved = 0
        reach = {}
        for v in bm.verts:
            w = mw @ v.co
            d = w - c
            n = (mw.to_3x3() @ v.normal).normalized()
            side = 'front' if n.y < 0 else 'back'
            # Only points whose way out shows in the picture (sideways or
            # up) can be matched to the drawn edge; the rest just sit on top.
            flat = math.hypot(d.x, d.z) / max(d.length, 1e-6)
            t = 1.02
            if in_hair(c + spread(d, 1.03), side) or n.z > 0.35:
                t = 1.06
                if flat > 0.55:
                    while t < 1.6 and in_hair(c + spread(d, t + 0.02), side):
                        t += 0.02
                # A rounded cut hugging the head, with tufts and room for
                # tall hair on the crown, never past the drawn outline.
                u = d.normalized()
                theta = math.atan2(d.x, -d.y)
                crown = bp.smoothstep(0.1, 0.8, u.z)
                locks = max(0.0, math.cos(9 * theta + 6 * u.z)) ** 4
                t = max(1.05, min(t, 1.06 + 0.2 * locks * crown + 0.1 * crown))
                moved += 1
            reach[v] = t
        # Soften it a little, so the spikes stay but nothing is jagged.
        for _ in range(2):
            reach = {v: 0.5 * t + 0.5 * sum(reach[e.other_vert(v)] for e in v.link_edges) / max(len(v.link_edges), 1)
                     for v, t in reach.items()}
        for v, t in reach.items():
            v.co = inv @ (c + spread(mw @ v.co - c, t))
        if os.environ.get('HAIR_DEBUG'):
            ws = [mw @ v.co for v in bm.verts]
            ts = sorted(reach.values())
            print('HAIRDBG centre', tuple(round(x, 3) for x in c), 'head z', round(min(p.z for p in head), 3), round(max(p.z for p in head), 3),
                  'shell z', round(min(p.z for p in ws), 3), round(max(p.z for p in ws), 3),
                  'x', round(min(p.x for p in ws), 3), round(max(p.x for p in ws), 3), 'y', round(min(p.y for p in ws), 3), round(max(p.y for p in ws), 3),
                  't quartiles', [round(ts[int(len(ts) * q)], 2) for q in (0, 0.25, 0.5, 0.75, 0.99)])
        print('painted: hair points shaped', moved, 'of', len(bm.verts))
        bm.to_mesh(hair.data)
        bm.free()
        pts, nrm = rest_points(hair)
        project(hair, frame, pts, nrm)
        hair.data.materials.clear()
        hair.data.materials.append(painted_material('PaintedHair', paths['front'][1], paths['back'][1], cutout=True, hair_rgb=state_rgb))
        for p in hair.data.polygons:
            p.material_index = 0
        if toon:
            big_head(body.find_armature(), TOON['head'])
        return hair

    return colour_body, add_hair


# --------------------------------------------------------------------------
# The bare model, for ChatGPT
# --------------------------------------------------------------------------

def clay(out_dir):
    from PIL import Image, ImageChops, ImageFilter
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(REPO, 'art', 'characters', 'character_model_1_for_mixamo.fbx'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    grey = bpy.data.materials.new('Clay')
    grey.use_nodes = True
    g = grey.node_tree.nodes['Principled BSDF']
    g.inputs['Base Color'].default_value = (0.42, 0.43, 0.46, 1)
    g.inputs['Roughness'].default_value = 0.7
    pts = []
    for o in meshes:
        o.data.materials.clear()
        o.data.materials.append(grey)
        for p in o.data.polygons:
            p.use_smooth = True
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    frame = Frame(pts)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.render.resolution_x = sc.render.resolution_y = TEX
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.world = bpy.data.worlds.new('W')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = frame.size
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 3
    sc.collection.objects.link(sun)
    os.makedirs(out_dir, exist_ok=True)
    for side, sign in (('front', -1), ('back', 1)):
        cam.location = (frame.cx, sign * 10, frame.cz)
        cam.rotation_euler = (math.radians(90), 0, 0 if sign < 0 else math.radians(180))
        sun.rotation_euler = (math.radians(55), 0, math.radians(20 if sign < 0 else 200))
        raw = os.path.join(out_dir, f'raw_{side}.png')
        sc.render.filepath = raw
        bpy.ops.render.render(write_still=True)
        im = Image.open(raw).convert('RGBA')
        a = im.getchannel('A').point(lambda v: 255 if v > 128 else 0)
        edge = ImageChops.subtract(a.filter(ImageFilter.MaxFilter(7)), a)
        out = Image.new('RGBA', im.size, 'white')
        out.alpha_composite(im)
        out.paste((20, 20, 25, 255), mask=edge)
        out.convert('RGB').save(os.path.join(out_dir, f'clay_{side}.png'))


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    if args[:1] == ['--clay']:
        clay(args[1])
        return
    global toon
    toon = '--toon' in args
    args = [a for a in args if a != '--toon']
    name = args[0]
    preview = args[2] if args[1:2] == ['--preview'] else None
    if toon:
        import iso_rig
        reset = iso_rig.reset_scene

        def reset_flat():
            # Flat colours show as painted (no filmic tone curve).
            scene = reset()
            scene.view_settings.view_transform = 'Standard'
            scene.view_settings.look = 'None'
            return scene
        iso_rig.reset_scene = reset_flat
        m1.POSTPROCESS = bold_outline
    work = os.path.join(REPO, 'art', 'build', 'painted', name)     # not committed
    os.makedirs(work, exist_ok=True)
    colour_body, add_hair = make_painter(name, work)
    bp.paint_face = lambda path: None
    bp.colour_body = colour_body
    m1.add_hair = add_hair
    m1.LOOKS[name] = dict(m1.LOOKS['teal'])
    sys.argv = ['build_patron_model1.py', '--look', name] + (['--preview', preview] if preview else [])
    m1.main()


if __name__ == '__main__':
    main()
