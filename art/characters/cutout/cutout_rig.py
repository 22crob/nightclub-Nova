"""A guest as a cut-out puppet, posed frame by frame, like Nightclub City's
characters: one drawing of the character in pieces (ChatGPT, from the
prompt in art/characters/README.md), and every frame just turns those
pieces a little at the joints. Few frames per move and small bouncy
motions, so it reads choppy and cartoony instead of motion-captured.

The parts sheet (e.g. guy01_parts.png) has two rows, the front view
(facing down-left) on top and the back view (facing up-right) underneath;
each row is the assembled character, then the pieces laid out apart on
white: head (bald), hair, torso, upper arm, forearm, upper arm, forearm,
thigh, thigh, shin with shoe, shin with shoe. The pieces are found as
separate blobs and matched to their part by position (PARTS).

    python3 art/characters/cutout/cutout_rig.py NAME [--preview DIR]

writes game/src/assets/sprites/patrons/patron_cut_NAME.png and .json (the
same grid format as the neon and 3D guests), or with --preview a contact
sheet of every frame and a rest pose next to the drawn reference.
Needs numpy, scipy and pillow.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', '..', '..', 'game', 'src', 'assets', 'sprites', 'patrons')

# Blob order within a row (left to right, top to bottom) -> part names.
# Pieces are sorted into rows by where they sit on the sheet: see find_parts().
ROW_PARTS = ['ref', 'head', 'hair', 'torso', 'armA', 'foreA', 'armB', 'foreB', 'thighA', 'thighB', 'shinA', 'shinB']

# Scale of each piece relative to the head: ChatGPT drew the body pieces
# bigger than in its own assembled picture, where the head (with hair) is
# about half the height, as in Nightclub City.
SCALE = {'head': 1.0, 'hair': 1.0, 'torso': 0.82, 'arm': 0.78, 'fore': 0.78, 'thigh': 0.66, 'shin': 0.62}

SS = 2                      # build at 2x the sheet size, then shrink
FW, FH = 150, 230           # one frame in the sheet, px
FEET_Y = 212                # where the soles stand in a frame
COLUMNS = 16
# Poses a second per clip (each pose is one frame; see POSES).
FPS = {'idle': 2, 'walk': 7, 'dance': 4, 'sit': 1}


def find_parts(path):
    """Cuts every piece out of the sheet as an RGBA image, by part name,
    per view."""
    img = Image.open(path).convert('RGB')
    a = np.array(img).astype(int)
    fg = a.min(2) < 238
    fg = ndimage.binary_closing(fg, iterations=2)
    fg = ndimage.binary_fill_holes(fg)
    lab, _ = ndimage.label(fg)
    blobs = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) < 2000:
            continue
        mask = lab[s] == i + 1
        rgba = np.dstack([np.array(img)[s], (mask * 255).astype(np.uint8)])
        blobs.append({'x': s[1].start, 'y': s[0].start, 'w': s[1].stop - s[1].start,
                      'h': s[0].stop - s[0].start, 'img': Image.fromarray(rgba, 'RGBA')})
    mid = img.height / 2
    views = {}
    for view, row in (('front', [b for b in blobs if b['y'] + b['h'] / 2 < mid]), ('back', [b for b in blobs if b['y'] + b['h'] / 2 >= mid])):
        ref = max(row, key=lambda b: b['w'] * b['h'])
        rest = [b for b in row if b is not ref]
        # Top line: head, hair, torso, then the arm pieces in x order; legs
        # are the lower line (thighs, then shins with shoes, by x).
        top = sorted([b for b in rest if b['y'] < ref['y'] + ref['h'] * 0.45], key=lambda b: b['x'])
        low = sorted([b for b in rest if b['y'] >= ref['y'] + ref['h'] * 0.45], key=lambda b: b['x'])
        if len(top) != 7 or len(low) != 4:
            raise SystemExit(f'{view}: expected 7 upper and 4 lower pieces, found {len(top)} and {len(low)}')
        parts = dict(zip(ROW_PARTS, [ref] + top + low))
        views[view] = {k: v['img'] for k, v in parts.items()}
    return views


def scaled(img, s):
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def mask_rows(img):
    a = np.array(img)[:, :, 3] > 128
    return a


def top_centre(img, inset=0.0):
    """The middle of the piece's top edge, `inset` of its height down."""
    a = mask_rows(img)
    y = int(round(inset * img.height))
    xs = np.where(a[min(y, img.height - 1)])[0]
    return ((xs.min() + xs.max()) / 2 if len(xs) else img.width / 2, y)


def bottom_centre(img, inset=0.0):
    a = mask_rows(img)
    y = int(round((1 - inset) * img.height)) - 1
    xs = np.where(a[max(0, y)])[0]
    return ((xs.min() + xs.max()) / 2 if len(xs) else img.width / 2, y)


class Rig:
    """The pieces of one view, scaled, with their joints."""

    def __init__(self, parts, view, unit):
        self.view = view
        p = {}
        for name, img in parts.items():
            if name == 'ref':
                continue
            kind = name.rstrip('AB') if name[-1] in 'AB' else name
            p[name] = scaled(img, SCALE[kind] * unit)
        self.p = p
        t = p['torso']
        ta = mask_rows(t)
        # Torso joints: neck at the top of the neck stub, shoulders just
        # inside the sleeve tops, hips along the hem.
        self.neck = top_centre(t, 0.04)
        rows = np.where(ta.any(1))[0]
        sh_y = int(t.height * 0.2)
        xs = np.where(ta[sh_y])[0]
        self.shoulders = ((xs.min() + t.width * 0.08, sh_y), (xs.max() - t.width * 0.08, sh_y))
        hem = rows.max()
        xs = np.where(ta[int(hem - t.height * 0.08)])[0]
        self.hips = ((xs.min() + (xs.max() - xs.min()) * 0.3, hem - t.height * 0.12),
                     (xs.min() + (xs.max() - xs.min()) * 0.7, hem - t.height * 0.12))
        self.hip_mid = ((self.hips[0][0] + self.hips[1][0]) / 2, self.hips[0][1])

    def place(self, canvas, img, pivot, at, angle, flip=False):
        """Pastes `img` rotated by `angle` degrees (clockwise on screen)
        about its own point `pivot`, with that point landing on `at`."""
        if flip:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
            pivot = (img.width - pivot[0], pivot[1])
        pad = int(math.hypot(img.width, img.height)) + 2
        big = Image.new('RGBA', (pad * 2, pad * 2))
        big.paste(img, (int(pad - pivot[0]), int(pad - pivot[1])))
        big = big.rotate(-angle, resample=Image.BICUBIC, center=(pad, pad))
        canvas.alpha_composite(big, (int(round(at[0] - pad)), int(round(at[1] - pad))))


def rot(pt, about, angle):
    a = math.radians(angle)
    x, y = pt[0] - about[0], pt[1] - about[1]
    return (about[0] + x * math.cos(a) - y * math.sin(a), about[1] + x * math.sin(a) + y * math.cos(a))


def draw_pose(rig, pose, size, feet):
    """One frame: `pose` is a dict of joint angles (degrees) and offsets.
    Returns an RGBA image of `size`; the soles of a standing pose land on
    `feet`."""
    P = rig.p
    c = Image.new('RGBA', size)
    t = P['torso']
    # Legs hang from the hips; the standing leg length sets where the hips are.
    leg_len = P['thighA'].height * 0.62 + P['shinA'].height * 0.97
    hip_world = (feet[0] + pose.get('dx', 0), feet[1] - leg_len + pose.get('dy', 0))
    # Torso placed so its hip midpoint sits on hip_world, turned by `lean`.
    lean = pose.get('lean', 0)
    tor_at = hip_world

    def tw(pt):  # torso-local point -> world
        return rot((pt[0] - rig.hip_mid[0] + tor_at[0], pt[1] - rig.hip_mid[1] + tor_at[1]), tor_at, lean)

    def leg(side, thigh_a, shin_a):
        th, sh = P['thigh' + side], P['shin' + side]
        hip = tw(rig.hips[0 if side == 'A' else 1])
        tp = top_centre(th, 0.08)
        knee_local = bottom_centre(th, 0.38)
        rig.place(c, th, tp, hip, thigh_a)
        knee = rot((hip[0] + knee_local[0] - tp[0], hip[1] + knee_local[1] - tp[1]), hip, thigh_a)
        rig.place(c, sh, top_centre(sh, 0.03), knee, shin_a)

    def arm(side, up_a, fore_a, behind):
        ua, fa = P['arm' + side], P['fore' + side]
        sh = tw(rig.shoulders[0 if side == 'A' else 1])
        tp = top_centre(ua, 0.18)
        elbow_local = bottom_centre(ua, 0.1)
        a = lean + up_a
        # Forearm first, so the sleeve-less elbow seam hides under the upper arm.
        elbow = rot((sh[0] + elbow_local[0] - tp[0], sh[1] + elbow_local[1] - tp[1]), sh, a)
        rig.place(c, fa, top_centre(fa, 0.08), elbow, a + fore_a)
        rig.place(c, ua, tp, sh, a)

    # Far side first: in the front view the character faces down-left, so
    # his screen-right limbs (B) are the far ones; in the back view (facing
    # up-right) the screen-left ones (A) are.
    far, near = ('B', 'A') if rig.view == 'front' else ('A', 'B')
    L = pose['legs']
    Ar = pose['arms']
    arm(far, *Ar[far], True)
    leg(far, *L[far])
    leg(near, *L[near])
    rig.place(c, t, rig.hip_mid, tor_at, lean)
    # Head on the neck, hair on the head.
    neck = tw(rig.neck)
    head, hair = P['head'], P['hair']
    hp = bottom_centre(head, 0.03)
    tilt = lean + pose.get('tilt', 0)
    rig.place(c, head, hp, neck, tilt)
    off = HAIR[rig.view]
    hair_pivot = (hair.width / 2 + (hp[0] - head.width / 2) + off[0] * head.width,
                  hair.height + (hp[1] - head.height) + off[1] * head.height)
    rig.place(c, hair, hair_pivot, neck, tilt)
    arm(near, *Ar[near], False)
    return c


# Where the hair sits on the head: (x, y) shift as a share of the head's
# size, from lining up the hair's bottom with the head's bottom, centred.
HAIR = {'front': (0.02, 0.3), 'back': (0.0, 0.12)}


def pose(arms=((10, -6), (-10, 6)), legs=((3, 0), (-3, 0)), **kw):
    """A pose: upper arm and forearm angles for arms A and B, thigh and shin
    angles for legs A and B, plus lean, tilt, dx, dy."""
    return {'arms': {'A': arms[0], 'B': arms[1]}, 'legs': {'A': legs[0], 'B': legs[1]}, **kw}


# Every clip is a few distinct poses that the game snaps between, like
# Nightclub City's characters (the owner: "different drawings jumping frame
# to frame"), never in-between frames. Angles in degrees, clockwise on
# screen; 0 is an arm or leg hanging straight down.
POSES = {
    'idle': [
        pose(),
        pose(arms=((12, -10), (-8, 4)), tilt=3, dy=-1),
    ],
    'walk': [
        pose(arms=((-14, -8), (14, 8)), legs=((20, 6), (-18, 0)), tilt=2),
        pose(dy=-4, tilt=0),
        pose(arms=((24, -4), (-24, 4)), legs=((-18, 0), (20, 6)), tilt=-2),
        pose(dy=-4, tilt=0),
    ],
    'dance': [
        # Fist pump: one fist up beside the head, then the other.
        pose(arms=((45, 115), (-12, -18)), legs=((6, 0), (-6, 4)), dy=5, tilt=6, lean=3),
        pose(arms=((12, 18), (-45, -115)), legs=((6, -4), (-6, 0)), dy=5, tilt=-6, lean=-3),
        pose(arms=((45, 115), (-12, -18)), legs=((6, 0), (-6, 4)), dy=0, tilt=6, lean=3),
        pose(arms=((12, 18), (-45, -115)), legs=((6, -4), (-6, 0)), dy=0, tilt=-6, lean=-3),
        # Both hands up.
        pose(arms=((150, -10), (-150, 10)), legs=((8, 0), (-8, 0)), dy=-3),
        # Sway one way with a hand up, then the other.
        pose(arms=((150, -20), (-12, 10)), legs=((8, 0), (0, 0)), lean=7, tilt=6, dx=4, dy=2),
        pose(arms=((12, -10), (-150, 20)), legs=((0, 0), (-8, 0)), lean=-7, tilt=-6, dx=-4, dy=2),
        pose(arms=((150, -10), (-150, 10)), legs=((8, 0), (-8, 0)), dy=4),
    ],
    # Hips stay at standing height (the game's seats expect that); the
    # thighs come forward and the shins hang straight down (shin angles are
    # on screen, not relative to the thigh).
    'sit': [
        pose(arms=((20, -30), (-10, 20)), legs=((72, 4), (64, 8))),
        pose(arms=((20, -30), (-10, 20)), legs=((72, 4), (64, 8)), tilt=3),
    ],
}


def stand():
    return pose()


def sit_flip(view, p):
    """In the front view the character faces down-left, so his knees come
    out to the left (a positive angle); in the back view he faces up-right,
    so they go right."""
    if view == 'back':
        p['legs'] = {k: (-a, -b) for k, (a, b) in p['legs'].items()}
    return p


def build(name, preview=None):
    views = find_parts(os.path.join(HERE, f'{name}_parts.png'))
    # The head (no hair) is this share of the frame height at SS.
    unit = (FH * SS * 0.31) / views['front']['head'].height
    rigs = {v: Rig(views[v], v, unit) for v in views}
    rows = []
    for clip, poses in POSES.items():
        for view in ('front', 'back'):
            frames = []
            for p in poses:
                p = json.loads(json.dumps(p))
                if clip == 'sit':
                    p = sit_flip(view, p)
                img = draw_pose(rigs[view], p, (FW * SS, FH * SS), (FW * SS / 2, FEET_Y * SS))
                frames.append(img.resize((FW, FH), Image.LANCZOS))
            rows.append((f'{clip}_{view}', frames))
    # Each clip_facing starts on a new row of the sheet.
    starts, cells, idx = {}, [], 0
    for key, frames in rows:
        starts[key] = idx
        cells += frames
        pad = (-len(frames)) % COLUMNS
        cells += [None] * pad
        idx += len(frames) + pad
    nrows = idx // COLUMNS
    sheet = Image.new('RGBA', (FW * COLUMNS, FH * nrows))
    for k, f in enumerate(cells):
        if f is not None:
            sheet.alpha_composite(f, ((k % COLUMNS) * FW, (k // COLUMNS) * FH))
    # Standing height: soles to the top of the hair in the rest pose.
    rest = draw_pose(rigs['front'], stand(), (FW * SS, FH * SS), (FW * SS / 2, FEET_Y * SS))
    a = np.array(rest)[:, :, 3] > 40
    top = np.where(a.any(1))[0].min() / SS
    meta = {'frameWidth': FW, 'frameHeight': FH, 'columns': COLUMNS, 'originX': 0.5,
            'originY': round(FEET_Y / FH, 5), 'standingHeight': round(FEET_Y - top, 1),
            'starts': starts, 'frames': {k: len(v) for k, v in POSES.items()}, 'fps': FPS}
    if preview:
        os.makedirs(preview, exist_ok=True)
        bg = Image.new('RGBA', sheet.size, (70, 60, 90, 255))
        bg.alpha_composite(sheet)
        bg.save(os.path.join(preview, f'{name}_sheet.png'))
        ref = views['front']['ref']
        r = rest.resize((FW * 2, FH * 2), Image.LANCZOS)
        cmp_ = Image.new('RGBA', (r.width + ref.width + 40, max(r.height, ref.height) + 20), (255, 255, 255, 255))
        cmp_.alpha_composite(r, (10, 10))
        cmp_.alpha_composite(ref, (r.width + 30, 10))
        rb = draw_pose(rigs['back'], stand(), (FW * SS, FH * SS), (FW * SS / 2, FEET_Y * SS)).resize((FW * 2, FH * 2), Image.LANCZOS)
        out = Image.new('RGBA', (cmp_.width + rb.width + views['back']['ref'].width + 40, cmp_.height), (255, 255, 255, 255))
        out.alpha_composite(cmp_)
        out.alpha_composite(rb, (cmp_.width, 10))
        out.alpha_composite(views['back']['ref'], (cmp_.width + rb.width + 20, 10))
        out.save(os.path.join(preview, f'{name}_rest.png'))
        json.dump(meta, open(os.path.join(preview, f'{name}.json'), 'w'), indent=2)
        return
    sheet.save(os.path.join(OUT_DIR, f'patron_cut_{name}.png'), optimize=True)
    json.dump(meta, open(os.path.join(OUT_DIR, f'patron_cut_{name}.json'), 'w'), indent=2)
    print('wrote', f'patron_cut_{name}.png', meta['standingHeight'])


if __name__ == '__main__':
    args = sys.argv[1:]
    prev = None
    if '--preview' in args:
        k = args.index('--preview')
        prev = args[k + 1]
        del args[k:k + 2]
    build(args[0], prev)
