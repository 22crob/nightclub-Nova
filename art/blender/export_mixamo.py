"""Exports a character from a .blend as a clean upload for Mixamo's
Auto-Rigger: just the body, one mesh, nothing else in the file.

Mixamo refuses files with anything it might take for a skeleton ("Sorry,
unable to map your existing skeleton"): cameras, lights, empties, parent
objects, armatures, and vertex groups (which FBX writes as skin
deformers). So this keeps only the meshes, applies their modifiers
(the subdivision is left off by default to keep the triangle count
down; add it back in Blender after rigging), clears vertex groups,
applies transforms, joins everything into one object and writes both an
FBX and an OBJ (an OBJ can't hold a skeleton at all, so it's the
fallback if the FBX is still refused).

    python export_mixamo.py SRC.blend OUT_BASENAME [--subdivide]
"""
import sys

import bpy


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    src, out = args[0], args[1]
    subdivide = '--subdivide' in args
    bpy.ops.wm.open_mainfile(filepath=src)

    for o in list(bpy.data.objects):
        if o.type not in ('MESH', 'CURVE'):
            bpy.data.objects.remove(o, do_unlink=True)
    # (Converting to mesh applies the modifiers, so the subdivision goes first.)
    for o in bpy.data.objects:
        for m in list(getattr(o, 'modifiers', [])):
            if (m.type == 'SUBSURF' and not subdivide) or m.type == 'ARMATURE':
                o.modifiers.remove(m)
    parts = list(bpy.data.objects)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
        o.parent = None
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target='MESH')

    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            if m.type == 'SUBSURF' and not subdivide:
                o.modifiers.remove(m)
            elif m.type == 'ARMATURE':
                o.modifiers.remove(m)
            else:
                bpy.ops.object.modifier_apply(modifier=m.name)
        o.vertex_groups.clear()
        o.shape_key_clear() if o.data.shape_keys else None

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = body.data.name = 'Body'
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print(f'one mesh, {tris} triangles, {len(body.data.vertices)} vertices, size {tuple(round(d, 2) for d in body.dimensions)}')

    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.ops.export_scene.fbx(filepath=out + '.fbx', use_selection=True, object_types={'MESH'},
                             apply_scale_options='FBX_SCALE_ALL', use_mesh_modifiers=True,
                             mesh_smooth_type='FACE', add_leaf_bones=False, bake_anim=False,
                             use_armature_deform_only=True)
    bpy.ops.wm.obj_export(filepath=out + '.obj', export_selected_objects=True, export_materials=False,
                          export_uv=True, export_normals=True, apply_modifiers=True)


if __name__ == '__main__':
    main()
