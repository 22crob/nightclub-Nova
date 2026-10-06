"""Makes the girl base model ready to upload to Mixamo for rigging and
animations: one mesh, in the T-pose she's modelled in, light enough for
Mixamo (the source is about 2 million triangles, mostly smoothing).

    python export_girl_mixamo.py SRC.blend OUT.fbx [PREVIEW.png]

- Smoothing (Subdivision) is turned down, curves (hair strands, brows,
  eyelids, lashes, the smile) become mesh, and the heaviest pieces are
  decimated, to about TARGET_TRIS in all.
- Everything is joined into one object, "Girl", with its origin between
  her feet. Material slots keep their names, so paint_girl.py's colours
  can be put back on whatever Mixamo returns.
- Exported as FBX with Blender's usual axes (she faces -Y in Blender and
  comes out facing the front in Mixamo).
"""
import sys

import bpy

TARGET_TRIS = 60000


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    src, out = args[0], args[1]
    preview = args[2] if len(args) > 2 else None
    bpy.ops.wm.open_mainfile(filepath=src)
    scene = bpy.context.scene

    # Curves: fewer steps around and along, then mesh.
    for o in [o for o in bpy.data.objects if o.type == 'CURVE']:
        o.data.resolution_u = min(o.data.resolution_u, 4)
        o.data.bevel_resolution = min(o.data.bevel_resolution, 1)
    parts = [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE')]
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target='MESH')

    # Smoothing: the small pieces (shoes, calves) keep one level, the big
    # ones none; everything is applied.
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:
        for m in o.modifiers:
            if m.type == 'SUBSURF':
                m.levels = m.render_levels = 1 if len(o.data.polygons) < 2000 else 0
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)

    # Decimate the heavy pieces so the total lands near TARGET_TRIS.
    total = sum(tri_count(o) for o in meshes)
    light = sum(tri_count(o) for o in meshes if tri_count(o) <= 4000)
    heavy = [o for o in meshes if tri_count(o) > 4000]
    budget = max(TARGET_TRIS - light, 1)
    ratio = min(1.0, budget / max(sum(tri_count(o) for o in heavy), 1))
    print(f'before: {total} tris, heavy pieces x{ratio:.3f}')
    for o in heavy:
        d = o.modifiers.new('Slim', 'DECIMATE')
        d.ratio = ratio
        d.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=d.name)

    # One object, origin between the feet, transforms applied.
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    girl = bpy.context.active_object
    girl.name = girl.data.name = 'Girl'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.shade_smooth()
    print(f'after: {tri_count(girl)} tris, {len(girl.material_slots)} materials, height {girl.dimensions.z:.2f}')

    bpy.ops.object.select_all(action='DESELECT')
    girl.select_set(True)
    bpy.ops.export_scene.fbx(filepath=out, use_selection=True, object_types={'MESH'}, apply_scale_options='FBX_SCALE_ALL',
                             mesh_smooth_type='FACE', add_leaf_bones=False, bake_anim=False)

    if preview:
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 16
        scene.render.film_transparent = True
        scene.render.resolution_x, scene.render.resolution_y = 630, 800
        scene.render.filepath = preview
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
