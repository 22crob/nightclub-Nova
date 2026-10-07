"""Draws the Neon Cartoon club guy in code (SVG), the style the owner picked.

Run: python3 art/characters/neon/make_neon_avatar.py OUT.svg
"""
import sys
out = sys.argv[1]
def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
def pts(ps): return ' '.join(f'{x:.1f},{y:.1f}' for x, y in ps)

# Crown of curved spikes (left base, tip, right base), swept up and right.
spikes = [((100, 150), (70, 92), (130, 104)),
          ((122, 112), (110, 40), (166, 80)),
          ((152, 86), (168, 16), (206, 68)),
          ((192, 70), (236, 10), (248, 70)),
          ((232, 70), (296, 34), (284, 98)),
          ((270, 92), (336, 88), (304, 140))]
def spike_d(l, t, r):
    return (f'M{l[0]},{l[1]} C{l[0]+4},{l[1]-30} {t[0]-18},{t[1]+26} {t[0]},{t[1]} '
            f'C{t[0]+2},{t[1]+28} {r[0]+14},{r[1]-26} {r[0]},{r[1]} Z')
grads = []
spike_d_all = []
spike_fill = []
for i, (l, t, r) in enumerate(spikes):
    base = ((l[0] + r[0]) / 2, (l[1] + r[1]) / 2)
    end = lerp(t, base, 0.55)
    grads.append(f'<linearGradient id="tip{i}" gradientUnits="userSpaceOnUse" x1="{t[0]}" y1="{t[1]}" x2="{end[0]:.1f}" y2="{end[1]:.1f}">'
                 '<stop offset="0" stop-color="#ff6ad8"/><stop offset="0.45" stop-color="#b04cff"/><stop offset="1" stop-color="#2c1c40"/></linearGradient>')
    d = spike_d(l, t, r)
    spike_d_all.append(d)
    spike_fill.append(f'<path d="{d}" fill="url(#tip{i})"/>')
CAP = "M98 220 C88 160 104 112 146 86 C184 62 248 60 286 88 C314 110 322 152 306 206 L298 206 C294 178 284 160 270 150 C266 162 254 170 242 168 C236 182 218 188 202 178 C190 192 168 194 156 180 C146 192 128 204 116 222 C110 230 102 230 98 220 Z"
hair_outline = ''.join(f'<path d="{d}"/>' for d in spike_d_all) + f'<path d="{CAP}"/>'
hair_fill = ''.join(spike_fill) + f'<path d="{CAP}" fill="url(#hair)"/>'

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640" width="400" height="640">
<defs>
  {''.join(grads)}
  <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9cfa6"/><stop offset="1" stop-color="#e0a272"/></linearGradient>
  <linearGradient id="skinShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d48e5e" stop-opacity="0"/><stop offset="1" stop-color="#c47e50" stop-opacity="0.55"/></linearGradient>
  <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a65bff"/><stop offset="0.6" stop-color="#7b30e2"/><stop offset="1" stop-color="#521ba2"/></linearGradient>
  <linearGradient id="sleeveFar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a21b2"/><stop offset="1" stop-color="#3d117a"/></linearGradient>
  <linearGradient id="jeans" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#40507a"/><stop offset="1" stop-color="#242d48"/></linearGradient>
  <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2650"/><stop offset="1" stop-color="#150c20"/></linearGradient>
  <linearGradient id="tips" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6ad8"/><stop offset="1" stop-color="#a94cff"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4b0"/><stop offset="0.5" stop-color="#ffc83a"/><stop offset="1" stop-color="#c98a10"/></linearGradient>
  <radialGradient id="cheek" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff7f8f" stop-opacity="0.5"/><stop offset="1" stop-color="#ff7f8f" stop-opacity="0"/></radialGradient>
  <radialGradient id="iris" cx="0.45" cy="0.3" r="0.75"><stop offset="0" stop-color="#c39bff"/><stop offset="0.55" stop-color="#6d30c8"/><stop offset="1" stop-color="#2a0c58"/></radialGradient>
  <clipPath id="faceClip"><path d="M106 196 C106 128 150 92 204 92 C262 92 300 130 298 198 C296 254 278 298 236 318 C216 328 196 330 180 324 C138 310 110 270 106 226 Z"/></clipPath>
</defs>
<g stroke="#1a1020" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
  <ellipse cx="200" cy="598" rx="92" ry="14" fill="#000" fill-opacity="0.16" stroke="none"/>

  <!-- far arm, behind the body -->
  <path d="M244 356 C268 368 280 400 280 448 L254 450 C254 420 248 394 236 378 Z" fill="url(#sleeveFar)"/>
  <path d="M252 440 L282 440 L282 452 L252 452 Z" fill="#c2368c" stroke-width="4"/>
  <path d="M254 450 C250 466 254 478 266 480 C280 482 286 470 282 452 Z" fill="#d89466"/>

  <!-- legs and sneakers -->
  <path d="M204 462 L246 462 C250 500 250 530 248 560 L214 560 C212 530 208 500 204 462 Z" fill="url(#jeans)"/>
  <path d="M152 462 L202 462 C198 500 194 532 192 564 L158 564 C154 530 152 498 152 462 Z" fill="url(#jeans)"/>
  <path d="M176 486 C178 514 176 540 174 558" fill="none" stroke="#18213a" stroke-width="3"/>
  <path d="M212 554 L250 554 C262 556 272 566 272 580 L272 586 L208 586 Z" fill="#f1eef9"/>
  <path d="M208 580 L272 580 L272 590 L208 590 Z" fill="#a94cff"/>
  <path d="M150 556 L196 556 L198 586 L130 586 L130 580 C130 568 138 560 150 556 Z" fill="#ffffff"/>
  <path d="M130 580 L198 580 L198 592 L130 592 Z" fill="#ff4fb8"/>
  <path d="M146 566 L178 566" fill="none" stroke="#cfc8e2" stroke-width="3"/>

  <!-- tee and chain in the open jacket -->
  <path d="M170 346 L232 346 C238 380 240 420 240 466 L162 466 C162 420 164 380 170 346 Z" fill="#221a2e"/>
  <path d="M178 348 C182 384 218 386 224 348" fill="none" stroke="url(#gold)" stroke-width="5.5"/>
  <path d="M190 384 L210 384 L206 404 L194 404 Z" fill="url(#gold)" stroke-width="3"/>
  <!-- jacket -->
  <path d="M146 360 C156 348 172 342 184 344 L186 470 L144 470 C138 432 138 392 146 360 Z" fill="url(#jacket)"/>
  <path d="M216 344 C230 342 246 348 256 360 C262 396 262 436 258 470 L216 470 Z" fill="url(#jacket)"/>
  <path d="M184 344 L168 350 L180 402 L188 386 Z" fill="#5a1fb2" stroke-width="4"/>
  <path d="M216 344 L234 352 L222 402 L214 386 Z" fill="#46158a" stroke-width="4"/>
  <path d="M144 458 L186 458 L186 474 L144 474 Z" fill="#ff4fb8" stroke-width="4"/>
  <path d="M216 458 L258 458 L258 474 L216 474 Z" fill="#d23c98" stroke-width="4"/>
  <path d="M232 380 L246 380" fill="none" stroke="#ffd84a" stroke-width="4"/>

  <!-- near arm -->
  <path d="M150 358 C126 372 116 408 118 446 L144 448 C144 418 150 396 162 378 Z" fill="url(#jacket)"/>
  <path d="M116 436 L146 438 L144 452 L116 450 Z" fill="#ff4fb8" stroke-width="4"/>
  <path d="M118 448 C112 466 116 480 130 482 C146 484 150 470 146 454 Z" fill="url(#skin)"/>
  <path d="M130 460 C134 466 136 472 134 478" fill="none" stroke-width="2.5"/>

  <!-- neck, with the head's shadow on it -->
  <path d="M186 314 L218 314 L218 348 C208 354 196 354 186 348 Z" fill="#e2a576"/>
  <path d="M186 318 C198 330 210 330 218 322 L218 334 C206 342 196 340 186 332 Z" fill="#b97448" stroke="none" fill-opacity="0.6"/>

  <!-- far ear -->
  <path d="M288 206 C308 198 318 220 310 242 C304 256 290 258 282 248 Z" fill="#e3a676"/>
  <path d="M296 218 C304 224 304 236 296 244" fill="none" stroke-width="3"/>

  <!-- face -->
  <path d="M106 196 C106 128 150 92 204 92 C262 92 300 130 298 198 C296 254 278 298 236 318 C216 328 196 330 180 324 C138 310 110 270 106 226 Z" fill="url(#skin)"/>
  <g clip-path="url(#faceClip)" stroke="none">
    <path d="M262 120 C300 170 296 260 236 318 L320 330 L320 100 Z" fill="url(#skinShade)"/>
  </g>
  <ellipse cx="146" cy="268" rx="22" ry="11" fill="url(#cheek)" stroke="none"/>
  <ellipse cx="252" cy="266" rx="15" ry="9" fill="url(#cheek)" stroke="none"/>

  <!-- near eye (bigger) and far eye -->
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

  <!-- brows: the near one raised a touch, confident -->
  <path d="M128 186 C144 174 168 174 184 182" fill="none" stroke-width="8.5"/>
  <path d="M216 182 C230 174 248 176 260 186" fill="none" stroke-width="8.5"/>
  <!-- nose and smirk -->
  <path d="M198 268 C193 278 195 285 204 285" fill="none" stroke="#b46c42" stroke-width="3.5"/>
  <path d="M176 298 C192 308 214 306 230 292" fill="none" stroke-width="4.5"/>
  <path d="M226 294 C231 292 235 288 236 283" fill="none" stroke-width="3.5"/>

  <!-- hair: a spiky crown swept up and right, fringe chunks over the forehead -->
  <g fill="#1a1020" stroke-width="10">{hair_outline}</g>
  <g stroke="none">{hair_fill}</g>
  <!-- fringe chunks over the forehead -->
  <path d="M150 150 C142 168 132 186 118 200 C140 196 156 186 166 170 Z" fill="#241634" stroke-width="4"/>
  <path d="M196 150 C196 168 190 180 180 190 C200 188 212 178 216 162 Z" fill="#241634" stroke-width="4"/>
  <path d="M150 112 C176 92 220 86 256 98" fill="none" stroke="#6d4b92" stroke-width="5" stroke-opacity="0.85"/>
  <path d="M140 132 C154 122 170 118 186 118" fill="none" stroke="#6d4b92" stroke-width="4" stroke-opacity="0.6"/>
  <!-- faded side above the ear -->
  <path d="M276 158 C290 176 292 200 288 214 C282 198 276 182 266 168 Z" fill="#4a3660" stroke-width="3"/>
</g>
<g stroke="none">
  <path d="M332 150 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 l12 -4 Z" fill="#ffd84a"/>
  <path d="M74 330 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z" fill="#ff8ad8"/>
</g>
</svg>'''
open(out, 'w').write(svg)
