"""Shrinks the game's sprite PNGs to 256-colour palettes (about a third of
the size, no visible change), so the single-file build stays under the play
link's 16 MB limit. Run it after rendering new art:
    python3 art/compress_sprites.py
Already-compressed files are skipped."""
import glob
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'game', 'src', 'assets', 'sprites')
before = after = 0
for path in glob.glob(os.path.join(ROOT, '*.png')) + glob.glob(os.path.join(ROOT, 'patrons', '*.png')):
    im = Image.open(path)
    size = os.path.getsize(path)
    before += size
    if im.mode == 'P':
        after += size
        continue
    im.convert('RGBA').quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    after += os.path.getsize(path)
print(f'sprites: {before // 1024} KB -> {after // 1024} KB')
