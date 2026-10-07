"""Adds a song to the game: shrinks the MP3 into public/music/ and
measures its tempo and first beat, so the speakers and lights bump in time.

    python3 tools/add_song.py SONG.mp3 "Title" "Artist"

Prints the line to add to SONG_FILES in src/music.js. Needs ffmpeg and
numpy. Only use songs the game may use (e.g. Pixabay Music's licence).
"""
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'music')
RATE = 11025
BITRATE = '112k'


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def onsets(x, hop=128):
    """How much the low end jumps, every hop samples (kicks stand out)."""
    win = 1024
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop] * np.hanning(win)
    spec = np.abs(np.fft.rfft(frames, axis=1))
    low = spec[:, : int(200 / (RATE / win)) + 1].sum(axis=1)       # below ~200 Hz
    full = spec.sum(axis=1)
    env = np.maximum(0, np.diff(np.log1p(low * 4 + full), prepend=0))
    return env - env.mean(), RATE / hop


def tempo(env, fps, lo=85, hi=150, step=0.05):
    """The tempo (BPM) whose beat grid lines up best with the onsets, and
    where its first beat falls (seconds)."""
    best = None
    for bpm in np.arange(lo, hi, step):
        period = fps * 60 / bpm
        n = int(len(env) / period) - 1
        for phase_step in range(0, int(period), 1):
            idx = (phase_step + np.arange(n) * period).astype(int)
            score = env[idx].sum()
            if best is None or score > best[0]:
                best = (score, bpm, phase_step / fps)
    return round(float(best[1]), 2), round(float(best[2]), 3)


def main():
    src, title, artist = sys.argv[1], sys.argv[2], sys.argv[3]
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, f'{slug}.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map_metadata', '-1', '-ac', '2', '-ar', '44100',
                    '-b:a', BITRATE, dst], check=True)
    x = decode(dst)
    seconds = len(x) / RATE
    # A rough tempo from the first minute and a half, then a fine one over
    # the whole song (a tempo off by 0.5 BPM drifts a beat a minute).
    env, fps = onsets(x[: int(RATE * 90)])
    rough, _ = tempo(env, fps)
    env, fps = onsets(x)
    bpm, offset = tempo(env, fps, rough - 0.3, rough + 0.3, 0.01)
    entry = {'file': f'{slug}.mp3', 'title': title, 'artist': artist, 'bpm': bpm, 'offset': offset,
             'lengthMs': int(seconds * 1000)}
    print(json.dumps(entry))
    print(f'{os.path.getsize(dst) // 1024} KB', file=sys.stderr)


if __name__ == '__main__':
    main()
