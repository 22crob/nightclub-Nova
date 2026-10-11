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


# Clips drawn whole, frame by frame (the owner's preferred way, October
# 2026: "different drawings jumping frame to frame"): <name>_<clip>_<view>.png
# is a picture of the frames side by side, left to right, on white. They
# replace the posed frames for that clip, at their own speed.
DRAWN_FPS = {'walk': 4, 'idle': 2, 'dance': 5, 'sit': 1}


def drawn_frames(name, clip, view):
    """The whole drawn frames of a clip, or None: cut off the white, split
    into figures left to right, scaled together so the first stands
    `height` px tall (sheet px), each centred on its head with its soles on
    the ground line. Nothing inside a drawing is moved."""
    path = os.path.join(HERE, f'{name}_{clip}_{view}.png')
    if not os.path.exists(path):
        return None
    src = Image.open(path).convert('RGBA')
    if (np.array(src)[:, :, 3] < 128).mean() > 0.2:
        # Already cut out (ChatGPT can give a see-through background).
        rgba = np.array(src)
        rgba[:, :, 3] = np.where(rgba[:, :, 3] < 24, 0, rgba[:, :, 3])
        return split_frames(rgba)
    img = src.convert('RGB')
    a = np.array(img).astype(int)
    white = a.min(2) >= 240
    lab, _ = ndimage.label(white)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    # Specks of compression noise out in the white count as background.
    flab, _ = ndimage.label(~bg)
    sizes = np.bincount(flab.ravel())
    bg |= (sizes < 400)[flab] & (flab > 0)
    # Soften the rim: pixels next to the background fade out by how light
    # they are, so no white fringe shows on the dark club.
    rim = ndimage.binary_dilation(bg, iterations=2) & ~bg
    alpha = np.where(bg, 0, 255).astype(float)
    light = a.min(2)
    alpha[rim] = np.clip((255 - light[rim]) / 120 * 255, 0, 255)
    rgba = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])
    return split_frames(rgba)


def split_frames(rgba):
    """Splits a cut-out picture of frames side by side into frames on the
    sheet's canvas (see drawn_frames())."""
    fg = rgba[:, :, 3] > 20
    cols = np.where(fg.any(0))[0]
    # Figures may touch (ChatGPT packs them close, hair overlapping), so
    # cut at the thinnest columns between them: local minima of how much
    # of each column is drawn, at least about a figure's width apart.
    rows = np.where(fg.any(1))[0]
    height = rows[-1] - rows[0] + 1
    dens = np.convolve(fg.sum(0).astype(float), np.ones(9) / 9, mode='same')
    half = int(height * 0.22)
    cuts = []
    for x in range(cols[0] + half, cols[-1] - half):
        win = dens[x - half:x + half + 1]
        if dens[x] <= win.min() + 1e-6 and dens[x] < 0.3 * np.median(dens[cols]) and (not cuts or x - cuts[-1] > half):
            cuts.append(x)
    edges = [cols[0]] + cuts + [cols[-1] + 1]
    runs = [(x0, x1) for x0, x1 in zip(edges, edges[1:]) if x1 - x0 > 60]
    figs = []
    for x0, x1 in runs:
        rows = np.where(fg[:, x0:x1].any(1))[0]
        if len(rows) < 60:
            continue  # an empty gap between figures (or a stray speck)
        figs.append(Image.fromarray(rgba[rows[0]:rows[-1] + 1, x0:x1], 'RGBA'))
    return figs


def hair_width(fig):
    """The widest row across the top fifth of a figure: the hair, which is
    the same size in every pose, so drawings of different poses (a seated
    one is shorter) can be scaled to match each other."""
    a = np.array(fig)[:, :, 3] > 40
    rows = np.where(a.any(1))[0]
    band = a[rows[0]:rows[0] + max(1, int(fig.height * 0.2))]
    return max((np.where(r)[0][-1] - np.where(r)[0][0] + 1) for r in band if r.any())


def place_figs(figs, scale, top=None):
    """Puts drawn figures on the sheet's canvas at `scale`, each centred on
    its head; standing ones with their soles on the ground line, or (sitting,
    `top` given) with the top of the hair at `top`: a seated guest's upper
    body stays where it is standing, as the game's seats expect."""
    out = []
    for f in figs:
        f = scaled(f, scale)
        fa = np.array(f)[:, :, 3] > 40
        rows = np.where(fa.any(1))[0]
        head = fa[rows[0]:rows[0] + int(f.height * 0.3)]
        hx = np.where(head.any(0))[0]
        cx = (hx[0] + hx[-1]) / 2
        c = Image.new('RGBA', (FW * SS, FH * SS))
        y = top * SS if top is not None else FEET_Y * SS - f.height
        c.alpha_composite(f, (int(round(FW * SS / 2 - cx)), int(round(y))))
        out.append(c)
    return out


# Standing height (sheet px) of a character drawn only in whole frames, with
# no parts sheet to pose: the same as guy01's posed rest pose, so every
# character stands the same size.
STANDING = 185.0


def build(name, preview=None):
    parts = os.path.join(HERE, f'{name}_parts.png')
    rigs = None
    if os.path.exists(parts):
        views = find_parts(parts)
        # The head (no hair) is this share of the frame height at SS.
        unit = (FH * SS * 0.31) / views['front']['head'].height
        rigs = {v: Rig(views[v], v, unit) for v in views}
        # Standing height: soles to the top of the hair in the rest pose.
        rest = draw_pose(rigs['front'], stand(), (FW * SS, FH * SS), (FW * SS / 2, FEET_Y * SS))
        a = np.array(rest)[:, :, 3] > 40
        standing = FEET_Y - np.where(a.any(1))[0].min() / SS
    else:
        standing = STANDING
    rows, counts, fps, missing, borrowed = [], {}, dict(FPS), [], []
    # Drawn clips are all scaled to the drawn walk: its first frame stands
    # as tall as the posed guy, and every other drawing's hair matches its
    # hair width (per view; a view with no walk drawn yet uses the other's).
    ref = {}
    for v in ('front', 'back'):
        walk = drawn_frames(name, 'walk', v)
        ref[v] = hair_width(walk[0]) * standing * 0.97 * SS / walk[0].height if walk else None
    ref = {v: ref[v] or ref['front'] or ref['back'] for v in ref}
    done = {}
    for clip, poses in POSES.items():
        drawn = {}
        for v in ('front', 'back'):
            figs = drawn_frames(name, clip, v)
            # Standing still is sized by height, as tall as the walk: the
            # hair is drawn fuller in some standing drawings, so matching its
            # width made him shrink when he stopped.
            scale = standing * 0.97 * SS / figs[0].height if figs and clip == 'idle' else figs and ref[v] / hair_width(figs[0])
            drawn[v] = figs and place_figs(figs, scale, (FEET_Y - standing) if clip == 'sit' else None)
        if not rigs:
            # Nothing to pose: a view not drawn yet shows the other view's
            # drawings, and a clip not drawn at all shows him standing (the
            # game keeps such a guest from doing it; `missing` in the JSON).
            if not any(drawn.values()):
                missing.append(clip)
                drawn = {v: done[f'idle_{v}'] for v in ('front', 'back')}
                fps[clip] = DRAWN_FPS['idle']
            for v, o in (('front', 'back'), ('back', 'front')):
                if not drawn[v] and drawn[o] and clip not in missing:
                    borrowed.append(f'{clip}_{v}')  # the game keeps a look borrowing its back walk out
                drawn[v] = drawn[v] or drawn[o]
        n = next((len(d) for d in drawn.values() if d), len(poses))
        counts[clip] = n
        if any(drawn.values()) and clip not in missing:
            fps[clip] = DRAWN_FPS[clip]
            # The view not drawn yet takes the same number of posed frames,
            # evenly spaced (a two-step walk takes the two steps).
            poses = [poses[i * len(poses) // n] for i in range(n)]
        for view in ('front', 'back'):
            if drawn[view]:
                done[f'{clip}_{view}'] = drawn[view]
                rows.append((f'{clip}_{view}', [f.resize((FW, FH), Image.LANCZOS) for f in drawn[view]]))
                continue
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
    meta = {'frameWidth': FW, 'frameHeight': FH, 'columns': COLUMNS, 'originX': 0.5,
            'originY': round(FEET_Y / FH, 5), 'standingHeight': round(standing, 1),
            'starts': starts, 'frames': counts, 'fps': fps}
    if missing:
        meta['missing'] = missing
    if borrowed:
        meta['borrowed'] = borrowed
    if preview and rigs:
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
