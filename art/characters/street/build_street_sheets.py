"""Turns ChatGPT walk sheets into character sheets for the people on the
street outside the club.

Each source, art/characters/street/<name>_walk.png, is ChatGPT's drawing
of one character: 6 walking poses facing the camera (top row, facing
down-left) and the same from behind (bottom row, facing up-right). AI
drawings tend to keep the same leg forward in every pose, so walkcycle.py
builds a proper left-right walk from them: the widest stride, the pose with
the feet closest together, and the stride with its legs swapped (below the
skirt or shorts, so the clothes don't get a seam).

Writes game/src/assets/sprites/patrons/patron_st<NN>.png and .json in the
same grid format as the other character sheets (see patronMetaOf() in
assets.js): idle and walk, front and back; dance and sit fall back to
standing. Run from the repo root:
    python3 art/characters/street/build_street_sheets.py
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import walkcycle as WC  # noqa: E402

OUT = os.path.join(HERE, '..', '..', '..', 'game', 'src', 'assets', 'sprites', 'patrons')
HEIGHT = 170   # standing height in the sheet, px (the game scales it down)


def norm(fr, scale):
    return fr.resize((max(1, round(fr.width * scale)), max(1, round(fr.height * scale))), Image.LANCZOS)


def build(src, index):
    rows = WC.frames(src)
    front, back = WC.cycle(rows[0]), WC.cycle(rows[1])
    scale = HEIGHT / front[1].height
    clips = {'idle_front': [front[1]], 'idle_back': [back[1]], 'walk_front': front, 'walk_back': back}
    frames = []
    for k, fs in clips.items():
        clips[k] = [norm(f, scale) for f in fs]
        frames += clips[k]
    # one cell size for all: the head centred, the feet on one baseline
    anchors = [WC.anchor(f) for f in frames]
    left = max(cx for cx, _ in anchors) + 4
    right = max(f.width - cx for f, (cx, _) in zip(frames, anchors)) + 4
    up = max(by for _, by in anchors) + 4
    down = 6
    fw, fh = int(left + right), int(up + down)
    order = ['idle_front', 'idle_back', 'walk_front', 'walk_back']
    sheet = Image.new('RGBA', (fw * 4, fh * 4))
    starts = {}
    for r, k in enumerate(order):
        starts[k] = r * 4
        for c, f in enumerate(clips[k]):
            cx, by = WC.anchor(f)
            sheet.alpha_composite(f, (int(c * fw + left - cx), int(r * fh + up - by)))
    # the clips this character doesn't have stand still instead
    for clip in ('dance', 'sit', 'drink', 'sittalk'):
        for side in ('front', 'back'):
            starts[f'{clip}_{side}'] = starts[f'idle_{side}']
    name = f'patron_st{index:02d}'
    sheet.save(os.path.join(OUT, name + '.png'), optimize=True)
    meta = {'frameWidth': fw, 'frameHeight': fh, 'columns': 4, 'originX': round(left / fw, 5), 'originY': round(up / fh, 5),
            'standingHeight': float(HEIGHT), 'starts': starts,
            'frames': {'idle': 1, 'walk': 4, 'dance': 1, 'sit': 1, 'drink': 1, 'sittalk': 1},
            'fps': {'idle': 1, 'walk': 6, 'dance': 1, 'sit': 1, 'drink': 1, 'sittalk': 1}}
    json.dump(meta, open(os.path.join(OUT, name + '.json'), 'w'), indent=2)
    print(name, fw, fh, os.path.basename(src))


if __name__ == '__main__':
    for i, src in enumerate(sorted(glob.glob(os.path.join(HERE, '*_walk.png'))), 1):
        build(src, i)
