"""Cleans up the owner's chibi base body (art/characters/character_model_1.blend)
while keeping its definition (eye sockets, the outline of the head and
body):

- deletes stray single vertices,
- clears the "sharp" marks on its edges (nearly all of them were marked,
  which made it shade in flat steps),
- makes it exactly symmetrical by mirroring one side onto the other (the
  side with the cleaner ear, the -X side by default), so both ears match,
- smooths only where it's needed, through vertex groups: the whole neck,
  shoulders to the underside of the chin (strongly, and with a plain
  smooth that irons out the lumps under the chin, so it runs cleanly into
  the shoulders) and the
  ears (gently, which tidies the torn tops where they join the head),
- and adds a light subdivision so it isn't faceted.

The mirroring and clean-up are applied to the mesh; the smoothing and
subdivision are modifiers ("Smooth neck", "Flatten neck lumps", "Smooth
ears", "Soft finish"),
so they can be tuned in Blender.

    python clean_character.py SRC.blend OUT.blend [--keep +X]
"""
import sys

import bpy  # first: it makes bmesh importable outside Blender
import bmesh

# The whole neck, from the shoulders up to the underside of the chin.
NECK = dict(z=(0.80, 1.02), core=(0.84, 0.985), half_width=0.27, iterations=20, strength=0.8, flatten=40)
EARS = dict(x_from=0.255, z=(1.03, 1.43), top_from=1.28, iterations=8, strength=0.5)


def ramp(value, lo, core_lo, core_hi, hi):
    """0 outside lo..hi, 1 inside core_lo..core_hi, fading between."""
    if value <= lo or value >= hi:
        return 0.0
    if value < core_lo:
        return (value - lo) / (core_lo - lo)
    if value > core_hi:
        return (hi - value) / (hi - core_hi)
    return 1.0


def clean_mesh(obj, keep):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    loose = [v for v in bm.verts if not v.link_edges]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # '-X' copies the negative X half onto the positive side.
    bmesh.ops.symmetrize(bm, input=bm.verts[:] + bm.edges[:] + bm.faces[:], direction=keep, dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # Nearly every edge came marked sharp, which shades the model in flat
    # steps even with smooth shading on; clearing the marks makes it shade
    # smoothly without changing its shape.
    for e in bm.edges:
        e.smooth = True
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len(loose)


def add_group(obj, name, weight_of):
    group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
    for v in obj.data.vertices:
        w = weight_of(v.co)
        if w > 0:
            group.add([v.index], w, 'REPLACE')
    return group


def add_smooth(obj, name, group, iterations, strength):
    m = obj.modifiers.new(name, 'LAPLACIANSMOOTH')
    m.iterations = iterations
    m.lambda_factor = strength
    m.lambda_border = 0.0
    m.use_volume_preserve = True
    m.use_normalized = True
    m.vertex_group = group.name


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    src, out = args[0], args[1]
    keep = args[args.index('--keep') + 1] if '--keep' in args else '-X'
    keep = keep.replace('+', '')
    bpy.ops.wm.open_mainfile(filepath=src)
    obj = next(o for o in bpy.data.objects if o.type == 'MESH')
    for m in list(obj.modifiers):
        obj.modifiers.remove(m)
    removed = clean_mesh(obj, keep)

    nz0, nz1 = NECK['z']
    nc0, nc1 = NECK['core']
    neck = add_group(obj, 'Neck', lambda c: ramp(c.z, nz0, nc0, nc1, nz1) * ramp(abs(c.x), -1, -1, NECK['half_width'] * 0.7, NECK['half_width']))
    ez0, ez1 = EARS['z']
    # Ears: gently all over, fully at the top where they were torn.
    ears = add_group(obj, 'Ears', lambda c: (0.0 if abs(c.x) < EARS['x_from'] or not ez0 < c.z < ez1 else
                                             min(1.0, 0.45 + max(0.0, c.z - EARS['top_from']) * 6)))
    add_smooth(obj, 'Smooth neck', neck, NECK['iterations'], NECK['strength'])
    # Then a plain smooth, which pulls bumps in rather than keeping their
    # volume: it irons out the lumps under the chin.
    flat = obj.modifiers.new('Flatten neck lumps', 'SMOOTH')
    flat.factor = 1.0
    flat.iterations = NECK['flatten']
    flat.vertex_group = neck.name
    add_smooth(obj, 'Smooth ears', ears, EARS['iterations'], EARS['strength'])

    sub = obj.modifiers.new('Soft finish', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    sub.quality = 3
    for p in obj.data.polygons:
        p.use_smooth = True

    print(f'removed {removed} stray vertices; kept the {keep} side; {len(obj.data.vertices)} vertices')
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)


if __name__ == '__main__':
    main()
