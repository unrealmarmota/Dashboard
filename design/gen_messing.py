# -*- coding: utf-8 -*-
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gen_common import *

C = 200.0
R_CASE, R_FACE, R_ICON = 190.0, 152.0, 170.0
R_LABEL = 134.0
PATINA = '#5fa79b'   # verdigris – gealtertes Teal
PEOPLE = [dict(JOHANNES, color=PATINA, hand=96.0),
          dict(TANJA, color=BRASS, hand=78.0)]
OCC = {p['sector']: p for p in PEOPLE}

def label_r(deg):
    return R_LABEL - 18 * abs(math.sin(math.radians(deg)))

s = []
s.append('''<defs>
    <radialGradient id="face" cx="50%" cy="34%" r="78%">
      <stop offset="0%" stop-color="#141b26"/><stop offset="72%" stop-color="#0d131c"/><stop offset="100%" stop-color="#080b12"/>
    </radialGradient>
    <linearGradient id="brass" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#e8c887"/><stop offset="38%" stop-color="#c39b46"/>
      <stop offset="62%" stop-color="#8a6a2e"/><stop offset="100%" stop-color="#d4a853"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/><feColorMatrix type="saturate" values="0"/></filter>
    <clipPath id="dial"><circle cx="200" cy="200" r="196"/></clipPath>''')
for name, col in (('hpat', PATINA), ('hbra', BRASS)):
    s.append(f'''    <pattern id="{name}" width="7" height="7" patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" stroke="{col}" stroke-width="1.5" opacity="0.5"/>
    </pattern>''')
s.append('  </defs>')

# Zifferblatt + Gehaeuse: keine durchgehende Maschinen-Linie, sondern
# gestochene Boegen mit Luecken und leicht wandernder Staerke
s.append(f'  <circle cx="{C}" cy="{C}" r="{f(R_FACE)}" fill="url(#face)"/>')
for a0, a1, r, sw, op in ((7, 171, R_CASE, 5.2, 1), (189, 353, R_CASE, 4.4, 1),
                          (2, 358, 196.5, 0.9, .32), (12, 348, 181.5, 0.8, .22)):
    x0, y0 = pt(C, C, r, a0); x1, y1 = pt(C, C, r, a1)
    big = 1 if (a1 - a0) > 180 else 0
    s.append(f'  <path d="M {x0} {y0} A {f(r)} {f(r)} 0 {big} 1 {x1} {y1}" fill="none" '
             f'stroke="url(#brass)" stroke-width="{sw}" stroke-linecap="round" opacity="{op}"/>')

for i, (sid, label) in enumerate(SECTORS):
    deg = ang(i)
    occ = OCC.get(sid)
    col = occ['color'] if occ else None
    # belegter Sektor: schraffiert statt flaechig gefuellt
    if occ:
        pat = 'hpat' if col == PATINA else 'hbra'
        s.append(f'  <path d="{wedge(C, C, deg, R_FACE + 2, R_CASE - 4)}" fill="url(#{pat})" opacity="0.85"/>')
        s.append(f'  <path d="{wedge(C, C, deg, 44, R_FACE)}" fill="{col}" opacity="0.07"/>')
    # Trennstrich, minimal aus der Achse gekippt (von Hand gestochen)
    j = jitter(i, 1.1)
    ax, ay = pt(C, C, R_FACE + 2, deg + STEP / 2 + j)
    bx, by = pt(C, C, R_CASE - 3, deg + STEP / 2 - j)
    s.append(f'  <line x1="{ax}" y1="{ay}" x2="{bx}" y2="{by}" stroke="{BRASS}" stroke-width="0.9" opacity="0.3"/>')
    # zwei feine Kerben je Sektor
    for d in (-10.5, 10.5):
        cx1, cy1 = pt(C, C, R_CASE - 6, deg + d); cx2, cy2 = pt(C, C, R_CASE - 11, deg + d)
        s.append(f'  <line x1="{cx1}" y1="{cy1}" x2="{cx2}" y2="{cy2}" stroke="{BRASS}" stroke-width="0.7" opacity="0.18"/>')
    ix, iy = polar(C, C, R_ICON, deg)
    s.append('  ' + icon(sid, ix, iy, 21, col or BRASS, 1.35, 1 if occ else 0.42))
    lx, ly = pt(C, C, label_r(deg), deg)
    fill = col if occ else '#8b7successor'
    fill = col if occ else '#8a7852'
    weight = 600 if occ else 500
    s.append(f'  <text x="{lx}" y="{ly}" text-anchor="middle" dominant-baseline="central" '
             f'font-family="\'Cormorant Garamond\', Georgia, serif" font-size="15.5" font-weight="{weight}" '
             f'letter-spacing="1.1" style="font-variant: small-caps;" fill="{fill}">{label}</text>')

# Zeiger: geschmiedete Nadel mit Gegengewicht, kein CAD-Strich
for p in PEOPLE:
    deg = ang(idx(p['sector'])); L = p['hand']; col = p['color']
    tipx, tipy = polar(C, C, L, deg)
    bl = polar(C, C, 16, deg - 84); br = polar(C, C, 16, deg + 84)
    mid_l = polar(C, C, L * 0.55, deg - 2.1); mid_r = polar(C, C, L * 0.55, deg + 2.1)
    tail = polar(C, C, 28, deg + 180)
    s.append(f'''  <g>
    <circle cx="{f(tail[0])}" cy="{f(tail[1])}" r="6" fill="{col}" opacity="0.45"/>
    <path d="M {f(bl[0])} {f(bl[1])} L {f(mid_l[0])} {f(mid_l[1])} L {f(tipx)} {f(tipy)} L {f(mid_r[0])} {f(mid_r[1])} L {f(br[0])} {f(br[1])} Z" fill="{col}" opacity="0.92"/>
    <circle cx="{f(tipx)}" cy="{f(tipy)}" r="17" fill="#0c111a" stroke="{col}" stroke-width="1.9"/>
    <circle cx="{f(tipx)}" cy="{f(tipy)}" r="21.5" fill="none" stroke="{col}" stroke-width="0.7" opacity="0.35"/>
    <text x="{f(tipx)}" y="{f(tipy)}" text-anchor="middle" dominant-baseline="central" font-family="'Cormorant Garamond', Georgia, serif" font-size="17" font-weight="600" fill="{col}">{p['initial']}</text>
  </g>''')

# Nabe: gestochene Rosette
s.append(f'  <circle cx="{C}" cy="{C}" r="19" fill="#0d131c" stroke="url(#brass)" stroke-width="1.6"/>')
for k in range(16):
    d = k * 22.5
    x1, y1 = pt(C, C, 8, d); x2, y2 = pt(C, C, 15, d)
    s.append(f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{BRASS}" stroke-width="0.6" opacity="0.32"/>')
s.append(f'  <circle cx="{C}" cy="{C}" r="4.5" fill="url(#brass)"/>')
s.append('  <g clip-path="url(#dial)"><rect x="0" y="0" width="400" height="400" filter="url(#grain)" opacity="0.055"/></g>')

dial = '\n'.join(s)

def disc(p):
    return (f'<svg width="42" height="42" viewBox="0 0 42 42" style="flex: none;">'
            f'<circle cx="21" cy="21" r="19" fill="#0c111a" stroke="{p["color"]}" stroke-width="1.6"/>'
            f'<circle cx="21" cy="21" r="15.5" fill="none" stroke="{p["color"]}" stroke-width="0.6" opacity="0.4"/>'
            f'<text x="21" y="22" text-anchor="middle" dominant-baseline="central" '
            f'font-family="\'Cormorant Garamond\', Georgia, serif" font-size="19" font-weight="600" fill="{p["color"]}">{p["initial"]}</text></svg>')

NAME_F = ("font-family: 'Cormorant Garamond', Georgia, serif; font-size: 16px; font-weight: 600; "
          "letter-spacing: 1.4px; font-variant: small-caps;")
PLACE_F = "font-family: 'Outfit', system-ui, sans-serif; font-size: 20px; font-weight: 400; line-height: 1.2;"

rows = '\n'.join(legend_row(p, p['color'], disc(p), NAME_F, PLACE_F, 'rgba(212,168,83,0.045)', 'rgba(212,168,83,0.16)') for p in PEOPLE)

inner = header('Messing &amp; Patina', MUTED, 'rgba(212,168,83,0.75)') + f'''
    <div style="display: flex; align-items: center; gap: 24px; height: 410px;">
      <svg width="400" height="400" viewBox="0 0 400 400" style="flex: none;">
{dial}
      </svg>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 330px;">
{rows}
        <div style="font-family: 'DM Mono', monospace; font-size: 11px; color: {MUTED}; opacity: 0.75; line-height: 1.5; padding: 0 2px;">
          Zeiger folgen Zonen, Proximity &amp; Kalender.<br>Belegter Sektor = schraffiert, nicht gefüllt.
        </div>
      </div>
    </div>'''

open(str(pathlib.Path(__file__).parent / 'Main.dc.html'), 'w', encoding='utf-8').write(dc_file(
    'Messing', "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap",
    "    text { paint-order: stroke; }", shell(inner, CARD_BG, BRASS)))
print('Main.dc.html geschrieben')
