# Character base models

The drawn base models that patron outfits are built on. Every outfit is
the same base body with different clothes, hair and colours (see
`art/sprites_from_art.py`, which cuts a base drawing into head, body, arms
and legs and animates it into a sheet).

## Girl base model (not animated yet)

The owner's base model for all the girl patrons, shared 2026-10-06. She
isn't animated yet; that comes later, the same way as the guy (cut into
parts, then idle/walk/dance/sit sheets x front/back).

The owner's 3D model of her is `girl_base.blend` (a grey clay chibi in a
T-pose, built from the drawing: hair, closed smiling eyes, T-shirt,
shorts, flat shoes; no rig or UV maps yet). `art/blender/paint_girl.py`
paints it in a look (skin, hair, shirt with a front print, denim or
cotton shorts, shoes, blush, gold hoops, outlines) and renders the front;
`art/previews/girl_looks.png` shows the three looks so far (Pink Pop,
Neon Night, Sunny). `girl_for_mixamo.fbx` is the same model made ready
for Mixamo by `art/blender/export_girl_mixamo.py`: one mesh, about 60k
triangles (from 2.1 million), material slots kept by name. The drawing itself can go here as `girl_base.png`
(pasting it in chat doesn't reach the repo).

What the drawing shows (front view, clean black line art on white, with
a light centre line and ground line as construction guides):

- **Proportions:** chibi, like the guy: a big round head about a third
  of her height, small body, short legs.
- **Pose:** T-pose, arms straight out to the sides at shoulder height,
  hands as simple round mitts, feet slightly apart.
- **Face:** eyes closed in happy upward curves with thick lashes, a small
  smile, no nose; ears showing at the sides.
- **Hair:** long and straight, side-swept fringe parted on her left (the
  viewer's right), falling behind her shoulders to about her hips.
- **Outfit (the base layer):** a fitted short-sleeved T-shirt with a
  round neckline, knee-length fitted shorts/capris with a cuff line,
  bare lower legs, flat slip-on shoes.
- **Figure:** slim waist and hips, so outfits can be drawn over her.

When she's animated: match the guy's sheet layout, frame counts and fps
(`patrons.json`), so the game can use her sheets without code changes,
and make extra girls with `art/recolor_patron.py`.

## Character Model 1 (base body)

`character_model_1.blend` is the owner's chibi base body (one all-quad
mesh, `Retopology_hp`, about 13,500 faces, T-pose), shared 2026-10-06.
`character_model_1_clean.blend` is it cleaned up by
`art/blender/clean_character.py`, keeping its definition (eye sockets,
outline): the 6 stray vertices deleted, the "sharp" marks cleared from
its edges (nearly all were marked, which shaded it in flat steps), the
-X side mirrored onto +X so the ears match, and smoothing only where
asked, through vertex groups: "Smooth neck" (strong, so the neck runs
into the shoulders) and "Smooth ears" (gentle, tidying their torn tops),
plus a 1-level "Soft finish" subdivision. The smoothing and subdivision
are modifiers, so they can be tuned in Blender. (A first pass that
smoothed everything lost the eye sockets; the owner asked for them back.)
Before and after: `art/previews/character_model_1_clean.png`.
