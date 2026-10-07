"""The Neon Cartoon club guy as a cut-out puppet, posed frame by frame.

Every limb is its own piece with a joint (shoulder, elbow, hip, knee,
ankle, neck), drawn in the same coordinates as neon_avatar.svg (a 400 x 680
canvas, feet at y 592), so a pose is just a few angles. Two views: 'front'
(facing down-left, toward the camera) and 'back' (facing up-right); the game
mirrors them for the other two diagonals.

    python3 art/characters/neon/neon_rig.py OUT_DIR
writes OUT_DIR/sheet.html (every frame laid out in the sheet's grid) and
OUT_DIR/patron_neon01.json (the grid for the game). render_neon.mjs turns
the html into the sheet png.
"""
import json
import math
import os
import sys

W, H = 400, 680          # one frame's canvas, in drawing units
FEET = (200, 592)        # the point between the feet
SCALE = 0.3              # drawing units -> sheet pixels
FW, FH = round(W * SCALE), round(H * SCALE)
COLUMNS = 32
CLIPS = {'idle': 8, 'walk': 16, 'dance': 32, 'sit': 8}
FPS = {'idle': 6, 'walk': 18, 'dance': 14, 'sit': 5}
ROWS = ['idle_front', 'idle_back', 'walk_front', 'walk_back', 'dance_front', 'dance_back', 'sit_front', 'sit_back']
HEAD_TOP = 74            # top of the skull (under the spikes), for standingHeight

LINE = '#1a1020'


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def pts(ps):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in ps)


DEFS = '''<defs>
  <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9cfa6"/><stop offset="1" stop-color="#e0a272"/></linearGradient>
  <linearGradient id="skinShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d48e5e" stop-opacity="0"/><stop offset="1" stop-color="#c47e50" stop-opacity="0.55"/></linearGradient>
  <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a65bff"/><stop offset="0.6" stop-color="#7b30e2"/><stop offset="1" stop-color="#521ba2"/></linearGradient>
  <linearGradient id="sleeve" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a65bff"/><stop offset="1" stop-color="#7b30e2"/></linearGradient>
  <linearGradient id="sleeveFar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a21b2"/><stop offset="1" stop-color="#3d117a"/></linearGradient>
  <linearGradient id="jeans" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#40507a"/><stop offset="1" stop-color="#2a3352"/></linearGradient>
  <linearGradient id="jeansFar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f3b5e"/><stop offset="1" stop-color="#1f2740"/></linearGradient>
  <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2650"/><stop offset="1" stop-color="#150c20"/></linearGradient>
  <linearGradient id="hairBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2650"/><stop offset="0.72" stop-color="#1c1129"/><stop offset="0.86" stop-color="#5a3c3a"/><stop offset="1" stop-color="#b9805a"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4b0"/><stop offset="0.5" stop-color="#ffc83a"/><stop offset="1" stop-color="#c98a10"/></linearGradient>
  <radialGradient id="cheek" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff7f8f" stop-opacity="0.5"/><stop offset="1" stop-color="#ff7f8f" stop-opacity="0"/></radialGradient>
  <radialGradient id="iris" cx="0.45" cy="0.3" r="0.75"><stop offset="0" stop-color="#c39bff"/><stop offset="0.55" stop-color="#6d30c8"/><stop offset="1" stop-color="#2a0c58"/></radialGradient>
  <clipPath id="faceClip"><path d="M106 196 C106 128 150 92 204 92 C262 92 300 130 298 198 C296 254 278 298 236 318 C216 328 196 330 180 324 C138 310 110 270 106 226 Z"/></clipPath>
  TIPGRADS
</defs>'''

# The spiky crown: (left base, tip, right base), swept up and right.
SPIKES = [((100, 150), (70, 92), (130, 104)),
          ((122, 112), (110, 40), (166, 80)),
          ((152, 86), (168, 16), (206, 68)),
          ((192, 70), (236, 10), (248, 70)),
          ((232, 70), (296, 34), (284, 98)),
          ((270, 92), (336, 88), (304, 140))]


def spike_d(l, t, r):
    return (f'M{l[0]},{l[1]} C{l[0]+4},{l[1]-30} {t[0]-18},{t[1]+26} {t[0]},{t[1]} '
            f'C{t[0]+2},{t[1]+28} {r[0]+14},{r[1]-26} {r[0]},{r[1]} Z')


TIPGRADS = ''
for i, (l, t, r) in enumerate(SPIKES):
    base = ((l[0] + r[0]) / 2, (l[1] + r[1]) / 2)
    end = lerp(t, base, 0.55)
    TIPGRADS += (f'<linearGradient id="tip{i}" gradientUnits="userSpaceOnUse" x1="{t[0]}" y1="{t[1]}" x2="{end[0]:.1f}" y2="{end[1]:.1f}">'
                 '<stop offset="0" stop-color="#ff6ad8"/><stop offset="0.45" stop-color="#b04cff"/><stop offset="1" stop-color="#2c1c40"/></linearGradient>')
DEFS = DEFS.replace('TIPGRADS', TIPGRADS)

CAP_FRONT = ('M98 220 C88 160 104 112 146 86 C184 62 248 60 286 88 C314 110 322 152 306 206 L298 206 C294 178 284 160 270 150 '
             'C266 162 254 170 242 168 C236 182 218 188 202 178 C190 192 168 194 156 180 C146 192 128 204 116 222 C110 230 102 230 98 220 Z')
CAP_BACK = ('M96 226 C86 160 106 96 150 76 C190 58 252 60 288 86 C316 110 322 160 308 226 C300 266 276 298 240 308 '
            'C220 314 184 314 162 306 C130 294 104 266 96 226 Z')


def hair(cap, cap_fill):
    outline = ''.join(f'<path d="{spike_d(*s)}"/>' for s in SPIKES) + f'<path d="{cap}"/>'
    fill = ''.join(f'<path d="{spike_d(*s)}" fill="url(#tip{i})"/>' for i, s in enumerate(SPIKES)) + f'<path d="{cap}" fill="{cap_fill}"/>'
    return f'<g fill="{LINE}" stroke-width="10">{outline}</g><g stroke="none">{fill}</g>'


HEAD_FRONT = f'''
  <path d="M288 206 C308 198 318 220 310 242 C304 256 290 258 282 248 Z" fill="#e3a676"/>
  <path d="M296 218 C304 224 304 236 296 244" fill="none" stroke-width="3"/>
  <path d="M106 196 C106 128 150 92 204 92 C262 92 300 130 298 198 C296 254 278 298 236 318 C216 328 196 330 180 324 C138 310 110 270 106 226 Z" fill="url(#skin)"/>
  <g clip-path="url(#faceClip)" stroke="none"><path d="M262 120 C300 170 296 260 236 318 L320 330 L320 100 Z" fill="url(#skinShade)"/></g>
  <ellipse cx="146" cy="268" rx="22" ry="11" fill="url(#cheek)" stroke="none"/>
  <ellipse cx="252" cy="266" rx="15" ry="9" fill="url(#cheek)" stroke="none"/>
  <path d="M130 228 C136 208 172 202 186 220 C190 246 180 266 160 268 C140 268 128 250 130 228 Z" fill="#fff" stroke-width="4"/>
  <ellipse cx="162" cy="240" rx="16" ry="21" fill="url(#iris)" stroke="none"/>
  <ellipse cx="164" cy="243" rx="8" ry="11" fill="#13071f" stroke="none"/>
  <circle cx="156" cy="231" r="6" fill="#fff" stroke="none"/>
  <circle cx="169" cy="253" r="2.6" fill="#fff" stroke="none"/>
  <path d="M126 226 C136 204 174 198 190 218" fill="none" stroke-width="7.5"/>
  <path d="M127 224 L118 216" fill="none" stroke-width="5"/>
  <path d="M216 220 C226 206 252 208 258 224 C262 246 254 264 236 266 C220 264 212 246 216 220 Z" fill="#fff" stroke-width="4"/>
  <ellipse cx="236" cy="239" rx="13" ry="19" fill="url(#iris)" stroke="none"/>
  <ellipse cx="237" cy="242" rx="6.5" ry="10" fill="#13071f" stroke="none"/>
  <circle cx="231" cy="230" r="5" fill="#fff" stroke="none"/>
  <path d="M212 218 C224 202 254 204 262 222" fill="none" stroke-width="7.5"/>
  <path d="M128 186 C144 174 168 174 184 182" fill="none" stroke-width="8.5"/>
  <path d="M216 182 C230 174 248 176 260 186" fill="none" stroke-width="8.5"/>
  <path d="M198 268 C193 278 195 285 204 285" fill="none" stroke="#b46c42" stroke-width="3.5"/>
  MOUTH
  {hair(CAP_FRONT, 'url(#hair)')}
  <path d="M150 112 C176 92 220 86 256 98" fill="none" stroke="#6d4b92" stroke-width="5" stroke-opacity="0.85"/>
  <path d="M140 132 C154 122 170 118 186 118" fill="none" stroke="#6d4b92" stroke-width="4" stroke-opacity="0.6"/>
  <path d="M276 158 C290 176 292 200 288 214 C282 198 276 182 266 168 Z" fill="#4a3660" stroke-width="3"/>
  <path d="M150 150 C142 168 132 186 118 200 C140 196 156 186 166 170 Z" fill="#241634" stroke-width="4"/>
  <path d="M196 150 C196 168 190 180 180 190 C200 188 212 178 216 162 Z" fill="#241634" stroke-width="4"/>
'''
MOUTH_SMIRK = ('<path d="M176 298 C192 308 214 306 230 292" fill="none" stroke-width="4.5"/>'
               '<path d="M226 294 C231 292 235 288 236 283" fill="none" stroke-width="3.5"/>')
MOUTH_OPEN = ('<path d="M178 294 C192 316 216 314 230 290 C214 298 194 300 178 294 Z" fill="#7a1f3a" stroke-width="4"/>'
              '<path d="M186 300 C198 304 212 302 222 296" fill="none" stroke="#fff" stroke-width="3"/>')

HEAD_BACK = f'''
  <path d="M112 206 C94 198 84 220 92 242 C98 256 112 258 120 248 Z" fill="#e3a676"/>
  <path d="M290 210 C304 206 310 222 304 238 C300 248 290 250 286 244 Z" fill="#d89466"/>
  {hair(CAP_BACK, 'url(#hairBack)')}
  <path d="M150 112 C180 94 222 90 258 104" fill="none" stroke="#6d4b92" stroke-width="5" stroke-opacity="0.8"/>
  <path d="M200 120 C196 170 196 220 200 270" fill="none" stroke="#2a1a3a" stroke-width="4" stroke-opacity="0.7"/>
'''

NECK = '''
  <path d="M186 296 L218 296 L218 348 C208 354 196 354 186 348 Z" fill="#e2a576"/>
  <path d="M186 318 C198 330 210 330 218 322 L218 334 C206 342 196 340 186 332 Z" fill="#b97448" stroke="none" fill-opacity="0.6"/>
'''
TORSO_FRONT = NECK + '''
  <path d="M170 346 L232 346 C238 380 240 420 240 466 L162 466 C162 420 164 380 170 346 Z" fill="#221a2e"/>
  <path d="M178 348 C182 384 218 386 224 348" fill="none" stroke="url(#gold)" stroke-width="5.5"/>
  <path d="M190 384 L210 384 L206 404 L194 404 Z" fill="url(#gold)" stroke-width="3"/>
  <path d="M146 360 C156 348 172 342 184 344 L186 470 L144 470 C138 432 138 392 146 360 Z" fill="url(#jacket)"/>
  <path d="M216 344 C230 342 246 348 256 360 C262 396 262 436 258 470 L216 470 Z" fill="url(#jacket)"/>
  <path d="M184 344 L168 350 L180 402 L188 386 Z" fill="#5a1fb2" stroke-width="4"/>
  <path d="M216 344 L234 352 L222 402 L214 386 Z" fill="#46158a" stroke-width="4"/>
  <path d="M144 458 L186 458 L186 474 L144 474 Z" fill="#ff4fb8" stroke-width="4"/>
  <path d="M216 458 L258 458 L258 474 L216 474 Z" fill="#d23c98" stroke-width="4"/>
  <path d="M232 380 L246 380" fill="none" stroke="#ffd84a" stroke-width="4"/>
'''
TORSO_BACK = NECK + '''
  <path d="M146 356 C168 342 232 342 254 356 C262 396 262 436 258 470 L142 470 C138 432 138 396 146 356 Z" fill="url(#jacket)"/>
  <path d="M168 346 C190 356 212 356 234 346 L236 360 C212 370 190 370 166 360 Z" fill="#4a178f" stroke-width="4"/>
  <path d="M200 368 L200 458" fill="none" stroke="#4a178f" stroke-width="4"/>
  <path d="M168 398 C186 392 214 392 232 398" fill="none" stroke="#ff4fb8" stroke-width="4"/>
  <path d="M142 458 L258 458 L258 474 L142 474 Z" fill="#ff4fb8" stroke-width="4"/>
'''

# Limbs, each as (upper piece, lower piece, end piece) around its joints.
NEAR_ARM = dict(shoulder=(150, 362), elbow=(136, 410), wrist=(132, 446),
                upper='<path d="M138 352 C154 346 166 356 164 372 L150 414 L120 410 L128 370 C128 362 132 355 138 352 Z" fill="url(#sleeve)"/>',
                lower='<path d="M120 402 L150 406 L147 446 L118 444 Z" fill="url(#sleeve)"/>'
                      '<path d="M116 436 L148 438 L146 452 L116 450 Z" fill="#ff4fb8" stroke-width="4"/>',
                end='<path d="M118 448 C112 466 116 480 130 482 C146 484 150 470 146 454 Z" fill="url(#skin)"/>'
                    '<path d="M130 460 C134 466 136 472 134 478" fill="none" stroke-width="2.5"/>')
FAR_ARM = dict(shoulder=(250, 362), elbow=(266, 408), wrist=(268, 446),
               upper='<path d="M238 356 C252 350 270 360 274 376 L282 412 L254 416 L244 384 Z" fill="url(#sleeveFar)"/>',
               lower='<path d="M254 404 L282 402 L283 444 L254 446 Z" fill="url(#sleeveFar)"/>'
                     '<path d="M252 438 L284 438 L284 452 L252 452 Z" fill="#c2368c" stroke-width="4"/>',
               end='<path d="M254 450 C250 466 254 478 266 480 C280 482 286 470 282 452 Z" fill="#d89466"/>')
SHOE_NEAR_FRONT = ('<path d="M152 556 L196 556 L198 586 L130 586 L130 580 C130 568 140 560 152 556 Z" fill="#ffffff"/>'
                   '<path d="M130 580 L198 580 L198 592 L130 592 Z" fill="#ff4fb8"/>'
                   '<path d="M146 566 L178 566" fill="none" stroke="#cfc8e2" stroke-width="3"/>')
SHOE_FAR_FRONT = ('<path d="M214 554 L250 554 C262 556 272 566 272 580 L272 586 L208 586 Z" fill="#f1eef9"/>'
                  '<path d="M208 580 L272 580 L272 590 L208 590 Z" fill="#a94cff"/>')
SHOE_NEAR_BACK = ('<path d="M156 556 L194 556 C206 560 214 570 214 582 L214 586 L150 586 Z" fill="#ffffff"/>'
                  '<path d="M150 580 L214 580 L214 592 L150 592 Z" fill="#ff4fb8"/>'
                  '<path d="M158 566 L170 566" fill="none" stroke="#cfc8e2" stroke-width="3"/>')
SHOE_FAR_BACK = ('<path d="M212 554 L246 554 C258 556 268 566 268 580 L268 586 L206 586 Z" fill="#f1eef9"/>'
                 '<path d="M206 580 L268 580 L268 590 L206 590 Z" fill="#a94cff"/>')
NEAR_LEG = dict(hip=(178, 466), knee=(177, 522), ankle=(176, 560),
                upper='<rect x="155" y="456" width="45" height="72" rx="14" fill="url(#jeans)"/>',
                lower='<rect x="157" y="512" width="40" height="54" rx="12" fill="url(#jeans)"/>'
                      '<path d="M176 524 C178 540 178 552 176 560" fill="none" stroke="#18213a" stroke-width="3"/>')
FAR_LEG = dict(hip=(226, 466), knee=(229, 520), ankle=(230, 556),
               upper='<rect x="204" y="456" width="45" height="70" rx="14" fill="url(#jeansFar)"/>',
               lower='<rect x="210" y="510" width="40" height="52" rx="12" fill="url(#jeansFar)"/>')
POCKETS = '<path d="M162 482 C170 492 186 492 194 482" fill="none" stroke="#18213a" stroke-width="3"/>'


def limb(spec, a_upper, a_lower, a_end, joints, end_piece=None, upper_extra=''):
    j0, j1, j2 = (spec[k] for k in joints)
    end = end_piece if end_piece is not None else spec['end']
    return (f'<g transform="rotate({a_upper:.2f} {j0[0]} {j0[1]})">{spec["upper"]}{upper_extra}'
            f'<g transform="rotate({a_lower:.2f} {j1[0]} {j1[1]})">{spec["lower"]}'
            f'<g transform="rotate({a_end:.2f} {j2[0]} {j2[1]})">{end}</g></g></g>')


def figure(view, p):
    """One frame. p: body (dx, dy), head tilt, and the joint angles (degrees,
    positive = the lower end swings toward the left of the picture)."""
    bx, by = p.get('body', (0, 0))
    front = view == 'front'
    na, fa = p.get('near_arm', (12, 10)), p.get('far_arm', (-10, -8))
    nl, fl = p.get('near_leg', (0, 0)), p.get('far_leg', (0, 0))
    shoe_n = SHOE_NEAR_FRONT if front else SHOE_NEAR_BACK
    shoe_f = SHOE_FAR_FRONT if front else SHOE_FAR_BACK
    # Feet stay flat-ish: the shoe turns back most of the way.
    leg_n = limb(NEAR_LEG, nl[0], nl[1], -(nl[0] + nl[1]) * 0.8, ('hip', 'knee', 'ankle'), shoe_n, '' if front else POCKETS)
    leg_f = limb(FAR_LEG, fl[0], fl[1], -(fl[0] + fl[1]) * 0.8, ('hip', 'knee', 'ankle'), shoe_f)
    sit = p.get('sit')
    if sit:
        leg_n = sit_leg(NEAR_LEG, shoe_n, front)
        leg_f = sit_leg(FAR_LEG, shoe_f, front)
    arm_n = limb(NEAR_ARM, na[0], na[1], 0, ('shoulder', 'elbow', 'wrist'))
    arm_f = limb(FAR_ARM, fa[0], fa[1], 0, ('shoulder', 'elbow', 'wrist'))
    head = (HEAD_FRONT.replace('MOUTH', MOUTH_OPEN if p.get('open_mouth') else MOUTH_SMIRK)) if front else HEAD_BACK
    torso = TORSO_FRONT if front else TORSO_BACK
    tilt = p.get('tilt', 0)
    hx, hy = p.get('head', (0, 0))
    body = (f'<g transform="translate({bx:.2f} {by:.2f})">'
            f'{arm_f}{torso}{arm_n}'
            f'<g transform="translate({hx:.2f} {hy:.2f}) rotate({tilt:.2f} 202 320)">{head}</g></g>')
    # The legs move with the hips only sideways; the feet stay on the floor.
    legs = f'<g transform="translate({bx * 0.4:.2f} {max(0, by) * 0:.2f})">{leg_f}{leg_n}</g>'
    if sit:
        legs = f'<g transform="translate({bx:.2f} {by:.2f})">{leg_f}{leg_n}</g>'
    shadow = f'<ellipse cx="{200 + bx * 0.4:.1f}" cy="594" rx="86" ry="12" fill="#000" fill-opacity="0.0" stroke="none"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{FW}" height="{FH}">'
            f'<g stroke="{LINE}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">'
            f'{shadow}{legs}{body}</g></svg>')


def sit_leg(spec, shoe, front):
    """Sitting: the thigh points forward (toward the camera, so it looks
    short), the shin hangs down to the floor, and the hips stay where they
    are standing (the game's seats expect that)."""
    hx, hy = spec['hip']
    d = -1 if front else 1          # forward: left of the picture in front view, right in back view
    kx, ky = hx + d * 26, hy + 30
    thigh = (f'<path d="M{hx - 21} {hy - 8} L{hx + 21} {hy - 8} L{kx + 20} {ky + 10} L{kx - 20} {ky + 10} Z" fill="url(#jeans)"/>'
             f'<circle cx="{kx}" cy="{ky + 4}" r="20" fill="url(#jeans)"/>')
    floor = 562
    shin = f'<rect x="{kx - 18:.1f}" y="{ky:.1f}" width="36" height="{floor - ky:.1f}" rx="12" fill="url(#jeans)"/>'
    dx = kx - spec['ankle'][0]
    dy = floor - 4 - spec['ankle'][1]
    return f'{shin}<g transform="translate({dx:.1f} {dy:.1f})">{shoe}</g>{thigh}'


def poses(clip, view):
    n = CLIPS[clip]
    fwd = 1 if view == 'front' else -1   # which way "forward" swings in the picture
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n
        if clip == 'idle':
            b = math.sin(t)
            out.append(dict(body=(0, 1.5 + 1.5 * b), near_arm=(7 + 1.5 * b, 6), far_arm=(-6 - 1.5 * b, -6), tilt=1.2 * b))
        elif clip == 'walk':
            s, c = math.sin(t), math.cos(t)
            thigh = 22 * s * fwd
            knee_n = -34 * max(0.0, c) * fwd
            knee_f = -34 * max(0.0, -c) * fwd
            out.append(dict(body=(0, -5 * math.cos(2 * t) + 1),
                            near_leg=(thigh, knee_n), far_leg=(-thigh, knee_f),
                            near_arm=(7 - 11 * s * fwd, 10 + 8 * max(0.0, -s * fwd)), far_arm=(-6 + 11 * s * fwd, -10 - 8 * max(0.0, s * fwd)),
                            tilt=1.5 * math.sin(2 * t), head=(0, 1.5 * math.cos(2 * t))))
        elif clip == 'dance':
            beat = (i % 8) / 8                    # a bounce every 8 frames
            down = math.sin(math.pi * beat) ** 2  # 0 -> 1 -> 0
            sway = math.sin(2 * math.pi * i / 16)
            first_half = i < 16
            pump = 18 * math.sin(2 * math.pi * beat)
            if first_half:   # near arm up, pumping; far arm swinging low
                near_arm = (140 + pump, 35)
                far_arm = (-14 - 10 * sway, -50)
            else:            # switch: far arm up
                near_arm = (14 + 10 * sway, 50)
                far_arm = (-140 - pump, -35)
            out.append(dict(body=(8 * sway, 10 * down - 2),
                            near_leg=(10 * down * fwd + 4 * sway, -22 * down * fwd),
                            far_leg=(-6 * down * fwd + 4 * sway, -18 * down * fwd),
                            near_arm=near_arm, far_arm=far_arm,
                            tilt=6 * math.sin(2 * math.pi * beat) + 3 * sway, open_mouth=first_half and down > 0.5 or (not first_half and down > 0.5)))
        else:  # sit
            b = math.sin(t)
            out.append(dict(sit=True, body=(0, 1 + 1.2 * b), near_arm=(10, 26), far_arm=(-8, -26), tilt=1.0 * b))
    return out


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    cells = []
    starts = {}
    for r, row in enumerate(ROWS):
        clip, view = row.split('_')
        starts[row] = r * COLUMNS
        for c, p in enumerate(poses(clip, view)):
            cells.append(f'<div style="position:absolute;left:{c * FW}px;top:{r * FH}px;width:{FW}px;height:{FH}px">{figure(view, p)}</div>')
    sheet_w, sheet_h = COLUMNS * FW, len(ROWS) * FH
    html = (f'<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:transparent">'
            f'<div style="position:relative;width:{sheet_w}px;height:{sheet_h}px">{DEFS_SVG}{"".join(cells)}</div></body></html>')
    with open(os.path.join(out_dir, 'sheet.html'), 'w') as f:
        f.write(html)
    meta = {'frameWidth': FW, 'frameHeight': FH, 'columns': COLUMNS,
            'originX': round(FEET[0] / W, 5), 'originY': round(FEET[1] / H, 5),
            'standingHeight': round((FEET[1] - HEAD_TOP) * SCALE, 1),
            'starts': starts, 'frames': CLIPS, 'fps': FPS, 'sheetSize': [sheet_w, sheet_h]}
    with open(os.path.join(out_dir, 'patron_neon01.json'), 'w') as f:
        json.dump(meta, f, indent=2)
        f.write('\n')
    print(json.dumps(meta))


# The gradients are defined once for the whole page.
DEFS_SVG = f'<svg width="0" height="0" style="position:absolute">{DEFS}</svg>'

if __name__ == '__main__':
    main(sys.argv[1])
