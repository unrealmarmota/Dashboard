# -*- coding: utf-8 -*-
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gen_common import *

C = 200.0
R_RING, R_ICON, R_LABEL = 178.0, 156.0, 132.0
PAPER, INK, INK_DIM = '#13110c', '#ece2cd', '#7d7360'
PEOPLE = [dict(JOHANNES, color=INK, hand=84.0), dict(TANJA, color=AMBER, hand=68.0)]
OCC = {p['sector']: p for p in PEOPLE}

def wobble_circle(cx, cy, r, n=26, amp=3.2, seed=0.0, close=True):
    """Kreis aus der freien Hand – Radius atmet leicht."""
    pts = []
    for k in range(n):
        d = k * 360.0 / n
        rr = r + math.sin(k * 1.7 + seed) * amp + math.sin(k * 0.7 + seed * 2) * amp * 0.6
        pts.append(polar(cx, cy, rr, d))
    d = f'M {f(pts[0][0])} {f(pts[0][1])}'
    for k in range(1, len(pts) + (1 if close else 0)):
        a, b = pts[(k - 1) % len(pts)], pts[k % len(pts)]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        d += f' Q {f(a[0])} {f(a[1])} {f(mx)} {f(my)}'
    return d + (' Z' if close else '')

def blob(cx, cy, r, seed=0.0, n=11, amp=0.34):
    pts = [polar(cx, cy, r * (1 + math.sin(k * 2.1 + seed) * amp), k * 360.0 / n) for k in range(n)]
    d = f'M {f(pts[0][0])} {f(pts[0][1])}'
    for k in range(1, n + 1):
        a, b = pts[(k - 1) % n], pts[k % n]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        d += f' Q {f(a[0])} {f(a[1])} {f(mx)} {f(my)}'
    return d + ' Z'

s = ['''<defs>
    <filter id="fiber"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4"/><feColorMatrix type="saturate" values="0"/></filter>
    <pattern id="hatch" width="6" height="6" patternTransform="rotate(-42)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#ece2cd" stroke-width="1" opacity="0.34"/>
    </pattern>
    <pattern id="hatchA" width="6" height="6" patternTransform="rotate(42)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#f59e0b" stroke-width="1.1" opacity="0.44"/>
    </pattern>
    <clipPath id="sheet"><circle cx="200" cy="200" r="196"/></clipPath>
    <radialGradient id="wash" cx="50%" cy="44%" r="62%">
      <stop offset="0%" stop-color="#1d1a12"/><stop offset="70%" stop-color="#15130d"/><stop offset="100%" stop-color="#0f1520" stop-opacity="0"/>
    </radialGradient>
  </defs>''']
s.append('  <circle cx="200" cy="200" r="196" fill="url(#wash)"/>')
s.append('  <g clip-path="url(#sheet)"><rect width="400" height="400" filter="url(#fiber)" opacity="0.075"/></g>')

for i, (sid, label) in enumerate(SECTORS):
    deg, occ = ang(i), OCC.get(sid)
    if occ:
        pat = 'hatchA' if occ['color'] == AMBER else 'hatch'
        s.append(f'  <path d="{wedge(C, C, deg, 46, R_RING - 6)}" fill="url(#{pat})" opacity="0.7"/>')

# Zwei ungleiche Tintenkreise
s.append(f'  <path d="{wobble_circle(C, C, R_RING, 26, 3.4, 0.4)}" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round" opacity="0.82"/>')
s.append(f'  <path d="{wobble_circle(C, C, R_RING - 7, 22, 2.6, 2.1)}" fill="none" stroke="{INK}" stroke-width="1" stroke-linecap="round" opacity="0.34"/>')
s.append(f'  <path d="{wobble_circle(C, C, 44, 16, 1.8, 1.2)}" fill="none" stroke="{INK}" stroke-width="1.1" opacity="0.3"/>')

for i, (sid, label) in enumerate(SECTORS):
    deg, occ = ang(i), OCC.get(sid)
    col = occ['color'] if occ else None
    j = jitter(i, 1.6, 1.3)
    ax, ay = pt(C, C, R_RING - 26, deg + STEP / 2 + j)
    bx, by = pt(C, C, R_RING + 4, deg + STEP / 2 - j * 1.4)
    mx, my = pt(C, C, R_RING - 11, deg + STEP / 2 + j * 2.6)
    s.append(f'  <path d="M {ax} {ay} Q {mx} {my} {bx} {by}" fill="none" stroke="{INK}" stroke-width="1.5" stroke-linecap="round" opacity="0.42"/>')
    ix, iy = polar(C, C, R_ICON, deg)
    s.append('  ' + icon(sid, ix, iy, 20, col or INK, 1.5, 1 if occ else 0.4))
    lr = R_LABEL - 18 * abs(math.sin(math.radians(deg)))
    lx, ly = pt(C, C, lr, deg)
    s.append(f'  <text x="{lx}" y="{ly}" text-anchor="middle" dominant-baseline="central" '
             f'font-family="Caveat, \'Segoe Script\', cursive" font-size="{23 if occ else 21}" '
             f'font-weight="{700 if occ else 500}" fill="{col or INK_DIM}">{label}</text>')
    if occ:  # Unterstreichung von Hand
        ux, uy = polar(C, C, lr, deg)
        s.append(f'  <path d="M {f(ux-34)} {f(uy+13)} q 17 4.5 34 -1.5 q 12 -3 17 1" fill="none" stroke="{col}" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>')

# Federzug statt Zeiger
for p in PEOPLE:
    deg, L, col = ang(idx(p['sector'])), p['hand'], p['color']
    tip = polar(C, C, L, deg)
    base_l, base_r = polar(C, C, 13, deg - 92), polar(C, C, 13, deg + 92)
    ctrl_l, ctrl_r = polar(C, C, L * 0.62, deg - 5.5), polar(C, C, L * 0.62, deg + 2.2)
    s.append(f'''  <g>
    <path d="M {f(base_l[0])} {f(base_l[1])} Q {f(ctrl_l[0])} {f(ctrl_l[1])} {f(tip[0])} {f(tip[1])} Q {f(ctrl_r[0])} {f(ctrl_r[1])} {f(base_r[0])} {f(base_r[1])} Z" fill="{col}" opacity="0.88"/>
    <path d="{blob(tip[0], tip[1], 15, 0.9 if col == AMBER else 2.4)}" fill="{PAPER}" stroke="{col}" stroke-width="2"/>
    <text x="{f(tip[0])}" y="{f(tip[1]+1)}" text-anchor="middle" dominant-baseline="central" font-family="Caveat, cursive" font-size="22" font-weight="700" fill="{col}">{p['initial']}</text>
  </g>''')
s.append(f'  <path d="{blob(C, C, 13, 3.1)}" fill="{INK}" opacity="0.9"/>')
s.append(f'  <circle cx="{C}" cy="{C}" r="3" fill="{PAPER}"/>')
# Tintenspritzer
for (bx, by, br, sd) in ((92, 322, 3.4, 1.1), (318, 96, 2.4, 2.7), (78, 118, 1.9, 0.3), (330, 300, 2.8, 4.2)):
    s.append(f'  <path d="{blob(bx, by, br, sd, 9, 0.4)}" fill="{INK}" opacity="0.22"/>')
dial = '\n'.join(s)

def disc(p):
    return (f'<svg width="44" height="44" viewBox="0 0 44 44" style="flex: none;">'
            f'<path d="{blob(22, 22, 18, 1.7 if p["color"] == AMBER else 3.3)}" fill="none" stroke="{p["color"]}" stroke-width="1.8"/>'
            f'<text x="22" y="23" text-anchor="middle" dominant-baseline="central" font-family="Caveat, cursive" '
            f'font-size="24" font-weight="700" fill="{p["color"]}">{p["initial"]}</text></svg>')

NAME_F = "font-family: Caveat, cursive; font-size: 21px; font-weight: 700; letter-spacing: 0.4px;"
PLACE_F = "font-family: 'Outfit', system-ui, sans-serif; font-size: 19px; font-weight: 400; line-height: 1.2;"
rows = '\n'.join(legend_row(p, p['color'], disc(p), NAME_F, PLACE_F, 'rgba(236,226,205,0.04)', 'rgba(236,226,205,0.13)') for p in PEOPLE)

inner = header('Tinte &amp; Pergament', MUTED, 'rgba(236,226,205,0.6)') + f'''
    <div style="display: flex; align-items: center; gap: 24px; height: 410px;">
      <svg width="400" height="400" viewBox="0 0 400 400" style="flex: none;">
{dial}
      </svg>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 330px;">
{rows}
        <div style="font-family: 'DM Mono', monospace; font-size: 11px; color: {MUTED}; opacity: 0.75; line-height: 1.5; padding: 0 2px;">
          Alles von Hand: Kreis, Striche, Schraffur.<br>Heller Federzug auf dunklem Papier.
        </div>
      </div>
    </div>'''

open(str(pathlib.Path(__file__).parent / 'Tinte.dc.html'), 'w', encoding='utf-8').write(dc_file(
    'Tinte', "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap",
    "", shell(inner, '#0f1520', 'rgba(236,226,205,0.55)')))
print('Tinte.dc.html geschrieben')
