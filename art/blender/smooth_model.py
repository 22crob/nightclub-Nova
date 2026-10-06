"""Smooths a character mesh: relaxes ridges and lumps without shrinking it,
keeps the hands and fingers crisp, and adds a subdivision layer for a soft
finish. Everything is added as modifiers (nothing is applied), so it can
be tuned or turned off in Blender, and an FBX export applies it.

    python smooth_model.py SRC.blend OUT.blend [--hands X]

--hands X: vertices further than X from the middle (left/right) count as
hands and are left out of the relaxing (default: 72% of the half-width).
"""
import sys

import bpy

ITERATIONS = 10        # how many relaxing passes
STRENGTH = 0.6         # how far each pass moves a vertex
SUBDIV_VIEW = 1        # smoothing levels in the viewport
SUBDIV_RENDER = 2      # and when rendering


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    src, out = args[0], args[1]
    bpy.ops.wm.open_mainfile(filepath=src)
    for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
        xs = [v.co.x for v in obj.data.vertices]
        half = max(abs(min(xs)), abs(max(xs)))
        hands_from = float(args[args.index('--hands') + 1]) if '--hands' in args else half * 0.72

        # The hands, fading in over a short stretch so the wrists blend.
        group = obj.vertex_groups.get('Hands') or obj.vertex_groups.new(name='Hands')
        fade = half * 0.08
        for v in obj.data.vertices:
            w = min(1.0, max(0.0, (abs(v.co.x) - hands_from) / fade))
            if w > 0:
                group.add([v.index], w, 'REPLACE')

        # Relax the surface everywhere but the hands, keeping the volume.
        relax = obj.modifiers.new('Relax ridges', 'LAPLACIANSMOOTH')
        relax.iterations = ITERATIONS
        relax.lambda_factor = STRENGTH
        relax.lambda_border = 0.0
        relax.use_volume_preserve = True
        relax.use_normalized = True
        relax.vertex_group = group.name
        relax.invert_vertex_group = True

        sub = obj.modifiers.new('Soft finish', 'SUBSURF')
        sub.levels = SUBDIV_VIEW
        sub.render_levels = SUBDIV_RENDER
        sub.quality = 3

        for p in obj.data.polygons:
            p.use_smooth = True
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)


if __name__ == '__main__':
    main()
