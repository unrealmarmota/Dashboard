# -*- coding: utf-8 -*-
"""Gemeinsame Geometrie/Bausteine fuer die Familienuhr-Entwuerfe."""
import math

W, H = 840, 520
SECTORS = [
    ('home',     'Zuhause'),
    ('work',     'Arbeit'),
    ('school',   'Schule'),
    ('shopping', 'Einkauf'),
    ('visiting', 'Besuch'),
    ('holiday',  'Urlaub'),
    ('travel',   'Unterwegs'),
    ('lost',     'Verschollen'),
    ('peril',    'Gefahr'),
    ('homeward', 'Heimweg'),
]
STEP = 36.0

# Szenario (in allen Entwuerfen gleich, damit die Richtungen vergleichbar sind)
JOHANNES = dict(initial='J', name='Johannes', sector='work',
                place='Praxis Dr. Meier', detail='seit 2 h 10')
TANJA = dict(initial='T', name='Tanja', sector='homeward',
             place='Heimweg', detail='noch 4,2 km')

def ang(i):
    return i * STEP

def idx(sid):
    return [s[0] for s in SECTORS].index(sid)

def polar(cx, cy, r, deg):
    a = math.radians(deg - 90)
    return (cx + r * math.cos(a), cy + r * math.sin(a))

def f(v):
    return f'{v:.1f}'

def pt(cx, cy, r, deg):
    x, y = polar(cx, cy, r, deg)
    return f(x), f(y)

def wedge(cx, cy, deg, r_in, r_out, half=STEP / 2):
    ax, ay = pt(cx, cy, r_out, deg - half)
    bx, by = pt(cx, cy, r_out, deg + half)
    cx2, cy2 = pt(cx, cy, r_in, deg + half)
    dx, dy = pt(cx, cy, r_in, deg - half)
    return (f'M {ax} {ay} A {f(r_out)} {f(r_out)} 0 0 1 {bx} {by} '
            f'L {cx2} {cy2} A {f(r_in)} {f(r_in)} 0 0 0 {dx} {dy} Z')

# Deterministisches "Zittern" – nichts hier ist maschinell exakt
def jitter(i, amp=1.0, seed=0.0):
    return math.sin(i * 2.399 + seed) * amp

# ── Icon-Set: 20x20, Strichzeichnung, ein Stil ──────────────────────
ICONS = {
    'home': '<path d="M3 10.4 10 4.2l7 6.2V16.6a1 1 0 0 1-1 1h-3.4v-4.4H7.4v4.4H4a1 1 0 0 1-1-1z"/>',
    'work': '<path d="M3.2 7.4h13.6v9.2H3.2z"/><path d="M7.4 7.4V5.6a.8.8 0 0 1 .8-.8h3.6a.8.8 0 0 1 .8.8v1.8"/><path d="M3.2 11.4h13.6"/>',
    'school': '<path d="M2.6 8 10 4.6 17.4 8 10 11.4z"/><path d="M5.6 9.6v3.5c0 1.1 2 2.2 4.4 2.2s4.4-1.1 4.4-2.2V9.6"/>',
    'shopping': '<path d="M3.4 7.6h13.2l-1.3 8.1a1 1 0 0 1-1 .8H5.7a1 1 0 0 1-1-.8z"/><path d="M7.2 7.6 9.1 3.8"/><path d="M12.8 7.6 10.9 3.8"/>',
    'visiting': '<circle cx="7.4" cy="7.2" r="2.6"/><path d="M2.6 16.8c0-2.6 2.1-4.2 4.8-4.2s4.8 1.6 4.8 4.2"/><circle cx="14.4" cy="8.4" r="2"/><path d="M13 12.8c2.3-.3 4.4 1 4.4 3.4"/>',
    'holiday': '<path d="M4 9.6a6 6 0 0 1 12 0z"/><path d="M10 9.6V16.8"/><path d="M7.4 16.8c1.1-1.3 4.1-1.3 5.2 0"/>',
    'travel': '<path d="M3.6 13.2 5.2 8.8h9.6l1.6 4.4v3.2h-2.2v-1.6H5.8v1.6H3.6z"/><circle cx="6.6" cy="13.4" r="1"/><circle cx="13.4" cy="13.4" r="1"/>',
    'lost': '<path d="M7.2 7.4a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.3-2.8 4.2"/><circle cx="10" cy="15.8" r=".9"/>',
    'peril': '<path d="M11.8 3.2 5.4 11.4h3.8L8.2 16.8l6.4-8.4h-3.8z"/>',
    'homeward': '<circle cx="10" cy="10" r="6.8"/><path d="M13.4 6.6 8.4 8.4 6.6 13.4l5-1.8z"/>',
}

def icon(sid, x, y, size=20, color='currentColor', sw=1.4, opacity=1.0):
    s = size / 20.0
    return (f'<g transform="translate({f(x - size/2)} {f(y - size/2)}) scale({s:.3f})" '
            f'fill="none" stroke="{color}" stroke-width="{sw/s:.2f}" '
            f'stroke-linecap="round" stroke-linejoin="round" opacity="{opacity}">'
            f'{ICONS[sid]}</g>')

# ── Karten-Huelle (Werte 1:1 aus src/index.css / atoms/Card.jsx) ────
CARD_BG, CARD_BORDER = '#0f1520', '#1a2535'
DASH_BG, SURFACE = '#07090f', '#0d1117'
TXT, MUTED = '#e2e8f0', '#94a3b8'
AMBER, TEAL, BLUE, GREEN = '#f59e0b', '#14b8a6', '#60a5fa', '#4ade80'
BRASS = '#d4a853'   # DOWNTON_ACCENT.amber aus themes.js

def shell(inner, bg=CARD_BG, accent=AMBER, pad=18):
    """Dashboard-Hintergrund + Karte im Stil von atoms/Card.jsx."""
    return f'''<div style="width: {W}px; height: {H}px; background: {DASH_BG}; padding: 20px; box-sizing: border-box; font-family: 'Outfit', system-ui, sans-serif;">
  <div style="position: relative; width: 100%; height: 100%; box-sizing: border-box; background: {bg}; border: 1px solid {CARD_BORDER}; border-radius: 14px; padding: {pad}px; overflow: hidden;">
    <div style="position: absolute; top: 0; left: 0; right: 0; height: 1.5px; border-radius: 14px 14px 0 0; background: linear-gradient(to right, {accent}, transparent);"></div>
{inner}
  </div>
</div>'''

def header(right_text, label_color=MUTED, right_color=MUTED):
    return f'''    <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px;">
      <div style="font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: {label_color};">Familienuhr</div>
      <div style="font-family: 'DM Mono', monospace; font-size: 11px; color: {right_color};">{right_text}</div>
    </div>'''

def legend_row(p, color, disc, name_font, place_font, row_bg, row_border, place_color=None):
    """Eine Personenzeile – Struktur in allen Entwuerfen gleich."""
    place_color = place_color or TXT
    return f'''      <div style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: {row_bg}; border: 1px solid {row_border};">
        {disc}
        <div style="min-width: 0;">
          <div style="{name_font} color: {color};">{p['name']}</div>
          <div style="{place_font} color: {place_color};">{p['place']}</div>
          <div style="font-family: 'DM Mono', monospace; font-size: 11.5px; color: {MUTED}; margin-top: 2px;">{p['detail']}</div>
        </div>
      </div>'''

def dc_file(title, font_link, extra_css, body):
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="{font_link}" rel="stylesheet">
  <style>
    body {{ margin: 0; background: {DASH_BG}; }}
    a {{ color: {AMBER}; }} a:hover {{ color: {BRASS}; }}
{extra_css}
  </style>
</helmet>
{body}
</x-dc>
</body>
</html>
'''
