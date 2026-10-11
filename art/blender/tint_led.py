"""Deepens the LED poles' tube colour in their finished pictures.

Blender's AgX view pales bright, saturated light toward white, so a blue
LED pole came out baby blue (the owner wanted a brighter blue). After
rendering them with build_decor.py, run:
    python3 art/blender/tint_led.py
Every coloured pixel (the tube; the chrome brackets are grey and stay as they
are) is pushed to the pole's own hue at full saturation, keeping its
brightness, so the tube still shades round. Run it once per render.
"""
import colorsys
import glob
import os

from PIL import Image

SPRITES = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'src', 'assets', 'sprites')
# Pole -> (hue 0-1, saturation): the deep colour each tube should be.
POLES = {
    'wallLedCyan': (0.6, 0.85),    # electric blue
    'wallLedPink': (0.9, 0.8),
    'wallLedRed': (0.0, 0.88),
    'wallLedPurple': (0.76, 0.8),
}

for name, (hue, sat) in POLES.items():
    for path in glob.glob(os.path.join(SPRITES, f'decor_{name}_*.png')):
        im = Image.open(path).convert('RGBA')
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if s < 0.15:
                    continue  # chrome, outlines
                v = min(1.0, v * 1.05)
                r2, g2, b2 = colorsys.hsv_to_rgb(hue, max(s, sat), v)
                px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
        im.save(path)
        print('tinted', os.path.basename(path))
