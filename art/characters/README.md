# Character base models

The drawn base models that patron outfits are built on. Every outfit is
the same base body with different clothes, hair and colours (see
`art/sprites_from_art.py`, which cuts a base drawing into head, body, arms
and legs and animates it into a sheet).

## Girl base model (not animated yet)

The owner's base model for all the girl patrons, shared 2026-10-06. She
isn't animated yet; that comes later, the same way as the guy (cut into
parts, then idle/walk/dance/sit sheets x front/back).

Put the drawing here as `girl_base.png` (the owner pastes it in chat,
which doesn't reach the repo, so it has to be uploaded to this folder).

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
