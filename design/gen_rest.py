# -*- coding: utf-8 -*-
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gen_common import *

C = 200.0

def organic_ring(r, n=30, amp=5.0, seed=0.0):
    pts = [polar(C, C, r + math.sin(k * 1.3 + seed) * amp + math.sin(k * 0.41 + seed) * amp * 0.7, k * 360.0 / n)
           for k in range(n)]
    d = f'M {f(pts[0][0])} {f(pts[0][1])}'
    for k in range(1, n + 1):
        a, b = pts[(k - 1) % n], pts[k % n]
        d += f' Q {f(a[0])} {f(a[1])} {f((a[0]+b[0])/2)} {f((a[1]+b[1])/2)}'
    return d + ' Z'

def blob(cx, cy, r, seed=0.0, n=11, amp=0.3):
    pts = [polar(cx, cy, r * (1 + math.sin(k * 2.1 + seed) * amp), k * 360.0 / n) for k in range(n)]
    d = f'M {f(pts[0][0])} {f(pts[0][1])}'
    for k in range(1, n + 1):
        a, b = pts[(k - 1) % n], pts[k % n]
        d += f' Q {f(a[0])} {f(a[1])} {f((a[0]+b[0])/2)} {f((a[1]+b[1])/2)}'
    return d + ' Z'

# ─────────────────────────── Wurzelwerk ────────────────────────────
def wurzelwerk():
    BARK, LEAF_DIM, MOSS = '#6b5a3e', '#3f5c47', '#4ade80'
    people = [dict(JOHANNES, color=MOSS, hand=92.0), dict(TANJA, color=AMBER, hand=76.0)]
    occ = {p['sector']: p for p in people}
    R_LEAF, R_LABEL = 168.0, 128.0
    s = ['''<defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.55"/><stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowG" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#4ade80" stop-opacity="0.5"/><stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="floor" cx="50%" cy="46%" r="62%">
      <stop offset="0%" stop-color="#16281d"/><stop offset="100%" stop-color="#0b1016" stop-opacity="0"/>
    </radialGradient>
  </defs>''']
    s.append('  <circle cx="200" cy="200" r="196" fill="url(#floor)"/>')
    # Ranke: zwei ungleiche Triebe
    s.append(f'  <path d="{organic_ring(R_LEAF, 30, 6.0, 0.6)}" fill="none" stroke="{BARK}" stroke-width="3.4" stroke-linecap="round" opacity="0.9"/>')
    s.append(f'  <path d="{organic_ring(R_LEAF - 9, 24, 4.2, 2.4)}" fill="none" stroke="{BARK}" stroke-width="1.4" opacity="0.45"/>')
    for i, (sid, label) in enumerate(SECTORS):
        deg = ang(i); o = occ.get(sid); col = o['color'] if o else None
        # Blatt am Sektor
        s.append(f'''  <g transform="rotate({f(deg + jitter(i, 3.5))} 200 200)">
    <path d="M 200 {f(C - R_LEAF - 22)} Q {f(C + 17)} {f(C - R_LEAF)} 200 {f(C - R_LEAF + 22)} Q {f(C - 17)} {f(C - R_LEAF)} 200 {f(C - R_LEAF - 22)} Z"
      fill="{col or LEAF_DIM}" fill-opacity="{0.32 if o else 0.2}" stroke="{col or LEAF_DIM}" stroke-width="{1.5 if o else 1}" stroke-opacity="{0.95 if o else 0.5}"/>
    <path d="M 200 {f(C - R_LEAF - 19)} L 200 {f(C - R_LEAF + 19)}" stroke="{col or LEAF_DIM}" stroke-width="0.8" opacity="0.45"/>
  </g>''')
        ix, iy = polar(C, C, R_LEAF, deg)
        s.append('  ' + icon(sid, ix, iy, 17, col or '#8aa694', 1.4, 1 if o else 0.55))
        lr = R_LABEL - 14 * abs(math.sin(math.radians(deg)))
        lx, ly = pt(C, C, lr, deg)
        s.append(f'  <text x="{lx}" y="{ly}" text-anchor="middle" dominant-baseline="central" '
                 f'font-family="Vollkorn, Georgia, serif" font-size="{15 if o else 14}" font-weight="{600 if o else 500}" '
                 f'fill="{col or "#7e8f80"}">{label}</text>')
    # Triebe als Zeiger, mit Laterne am Ende
    for p in people:
        deg, L, col = ang(idx(p['sector'])), p['hand'], p['color']
        tip = polar(C, C, L, deg)
        c1 = polar(C, C, L * 0.42, deg - 11)
        c2 = polar(C, C, L * 0.78, deg + 7)
        s.append(f'  <path d="M 200 200 C {f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(tip[0])} {f(tip[1])}" fill="none" stroke="{BARK}" stroke-width="3.2" stroke-linecap="round"/>')
        for t, side in ((0.42, -1), (0.66, 1), (0.84, -1)):
            bx, by = polar(C, C, L * t, deg + side * 7)
            s.append(f'''  <g transform="rotate({f(deg + side * 52)} {f(bx)} {f(by)})">
    <path d="M {f(bx)} {f(by - 9)} Q {f(bx + 6)} {f(by)} {f(bx)} {f(by + 9)} Q {f(bx - 6)} {f(by)} {f(bx)} {f(by - 9)} Z" fill="{col}" fill-opacity="0.32" stroke="{col}" stroke-width="0.8" stroke-opacity="0.6"/>
  </g>''')
        g = 'glowG' if col == MOSS else 'glow'
        s.append(f'''  <circle cx="{f(tip[0])}" cy="{f(tip[1])}" r="34" fill="url(#{g})"/>
  <circle cx="{f(tip[0])}" cy="{f(tip[1])}" r="16" fill="#0d141a" stroke="{col}" stroke-width="1.8"/>
  <text x="{f(tip[0])}" y="{f(tip[1]+1)}" text-anchor="middle" dominant-baseline="central" font-family="Vollkorn, Georgia, serif" font-size="17" font-weight="600" fill="{col}">{p['initial']}</text>''')
    # Wurzelstock
    for rr, sw, op in ((22, 2.4, 0.95), (15, 1.4, 0.6), (8, 1.1, 0.4)):
        s.append(f'  <path d="{organic_ring(rr, 14, 1.6, rr)}" fill="none" stroke="{BARK}" stroke-width="{sw}" opacity="{op}"/>')
    s.append(f'  <circle cx="200" cy="200" r="3.4" fill="{BARK}"/>')
    dial = '\n'.join(s)

    def disc(p):
        g = 'glowG' if p['color'] == MOSS else 'glow'
        return (f'<svg width="44" height="44" viewBox="0 0 44 44" style="flex: none;">'
                f'<circle cx="22" cy="22" r="21" fill="url(#{g}2)"/>'
                f'<defs><radialGradient id="{g}2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="{p["color"]}" stop-opacity="0.4"/><stop offset="100%" stop-color="{p["color"]}" stop-opacity="0"/></radialGradient></defs>'
                f'<circle cx="22" cy="22" r="16" fill="#0d141a" stroke="{p["color"]}" stroke-width="1.6"/>'
                f'<text x="22" y="23" text-anchor="middle" dominant-baseline="central" font-family="Vollkorn, Georgia, serif" '
                f'font-size="18" font-weight="600" fill="{p["color"]}">{p["initial"]}</text></svg>')

    NAME_F = "font-family: Vollkorn, Georgia, serif; font-size: 15px; font-weight: 600; letter-spacing: 0.6px;"
    PLACE_F = "font-family: 'Outfit', system-ui, sans-serif; font-size: 19px; font-weight: 400; line-height: 1.2;"
    rows = '\n'.join(legend_row(p, p['color'], disc(p), NAME_F, PLACE_F, 'rgba(74,222,128,0.04)', 'rgba(107,90,62,0.4)') for p in people)
    inner = header('Wurzelwerk', MUTED, 'rgba(74,222,128,0.6)') + f'''
    <div style="display: flex; align-items: center; gap: 24px; height: 410px;">
      <svg width="400" height="400" viewBox="0 0 400 400" style="flex: none;">
{dial}
      </svg>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 330px;">
{rows}
        <div style="font-family: 'DM Mono', monospace; font-size: 11px; color: {MUTED}; opacity: 0.75; line-height: 1.5; padding: 0 2px;">
          Ranke statt Zifferblatt: jeder Ort ein Blatt,<br>jede Person eine Laterne am Trieb.
        </div>
      </div>
    </div>'''
    open(str(pathlib.Path(__file__).parent / 'Wurzelwerk.dc.html'), 'w', encoding='utf-8').write(dc_file(
        'Wurzelwerk', "https://fonts.googleapis.com/css2?family=Vollkorn:wght@500;600;700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap",
        "", shell(inner, '#0f1520', 'rgba(74,222,128,0.5)')))

# ───────────────────────────── Nebel ───────────────────────────────
def nebel():
    people = [dict(JOHANNES, color=BLUE), dict(TANJA, color=AMBER)]
    occ = {p['sector']: p for p in people}
    s = ['''<defs>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="11"/></filter>
    <filter id="soft2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="20"/></filter>
  </defs>''']
    pos = {}
    for i, (sid, label) in enumerate(SECTORS):
        r = 0 if sid == 'home' else 152 + jitter(i, 15, 1.4)
        d = ang(i) + jitter(i, 6, 0.9)
        pos[sid] = (C, C) if sid == 'home' else polar(C, C, r, d)
    # Fäden von Zuhause zur jeweiligen Person
    for p in people:
        hx, hy = pos['home']; tx, ty = pos[p['sector']]
        mx, my = (hx + tx) / 2 + jitter(idx(p['sector']), 26), (hy + ty) / 2 - 22
        s.append(f'  <path d="M {f(hx)} {f(hy)} Q {f(mx)} {f(my)} {f(tx)} {f(ty)}" fill="none" stroke="{p["color"]}" '
                 f'stroke-width="1.4" stroke-dasharray="1 7" stroke-linecap="round" opacity="0.5"/>')
    for i, (sid, label) in enumerate(SECTORS):
        x, y = pos[sid]; o = occ.get(sid)
        col = o['color'] if o else '#2c3b52'
        r = 40 if sid == 'home' else 31 + jitter(i, 4, 2.2)
        s.append(f'  <path d="{blob(x, y, r, i * 1.3, 11, 0.26)}" fill="{col}" opacity="{0.5 if o else 0.34}" filter="url(#soft)"/>')
        if o:
            s.append(f'  <path d="{blob(x, y, r * 1.5, i * 1.3, 11, 0.26)}" fill="{col}" opacity="0.16" filter="url(#soft2)"/>')
        iy_off, ly_off = (6, 27) if o else (-9, 12)
        s.append('  ' + icon(sid, x, y + iy_off, 19, col if o else '#8c9bb0', 1.4, 1 if o else 0.75))
        s.append(f'  <text x="{f(x)}" y="{f(y + ly_off)}" text-anchor="middle" dominant-baseline="central" '
                 f'font-family="Outfit, system-ui, sans-serif" font-size="{13.5 if o else 12.5}" '
                 f'font-weight="{600 if o else 400}" fill="{col if o else "#93a3b8"}">{label}</text>')
    for p in people:
        x, y = pos[p['sector']]
        s.append(f'''  <circle cx="{f(x)}" cy="{f(y - 26)}" r="30" fill="{p['color']}" opacity="0.13" filter="url(#soft)"/>
  <circle cx="{f(x)}" cy="{f(y - 26)}" r="16" fill="#0b1119" stroke="{p['color']}" stroke-width="1.7"/>
  <text x="{f(x)}" y="{f(y - 25)}" text-anchor="middle" dominant-baseline="central" font-family="Outfit, system-ui, sans-serif" font-size="15" font-weight="600" fill="{p['color']}">{p['initial']}</text>''')
    dial = '\n'.join(s)

    def disc(p):
        return (f'<svg width="42" height="42" viewBox="0 0 42 42" style="flex: none;">'
                f'<circle cx="21" cy="21" r="20" fill="{p["color"]}" opacity="0.14"/>'
                f'<circle cx="21" cy="21" r="15" fill="#0b1119" stroke="{p["color"]}" stroke-width="1.6"/>'
                f'<text x="21" y="22" text-anchor="middle" dominant-baseline="central" font-family="Outfit, system-ui, sans-serif" '
                f'font-size="15" font-weight="600" fill="{p["color"]}">{p["initial"]}</text></svg>')

    NAME_F = "font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500;"
    PLACE_F = "font-family: 'Outfit', system-ui, sans-serif; font-size: 19px; font-weight: 400; line-height: 1.2;"
    rows = '\n'.join(legend_row(p, p['color'], disc(p), NAME_F, PLACE_F, 'rgba(96,165,250,0.04)', CARD_BORDER) for p in people)
    inner = header('Nebel &amp; Lichter', MUTED, 'rgba(96,165,250,0.65)') + f'''
    <div style="display: flex; align-items: center; gap: 24px; height: 410px;">
      <svg width="400" height="400" viewBox="0 0 400 400" style="flex: none;">
{dial}
      </svg>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 330px;">
{rows}
        <div style="font-family: 'DM Mono', monospace; font-size: 11px; color: {MUTED}; opacity: 0.75; line-height: 1.5; padding: 0 2px;">
          Orte als Lichtfelder statt Sektoren, Zuhause in der Mitte.<br>Der Faden zeigt, wie weit jemand weg ist.
        </div>
      </div>
    </div>'''
    open(str(pathlib.Path(__file__).parent / 'Nebel.dc.html'), 'w', encoding='utf-8').write(dc_file(
        'Nebel', "https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap",
        "", shell(inner, '#0f1520', 'rgba(96,165,250,0.5)')))

wurzelwerk(); nebel(); print('Wurzelwerk.dc.html + Nebel.dc.html geschrieben')
