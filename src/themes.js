// Theme-Definitionen: Modes (Hintergrund/Text) + Akzente (Farben)

export const MODES = {
  dark: {
    label: 'Dunkel', icon: '\uD83C\uDF19',
    bg: '#07090f', surface: '#0d1117', card: '#0f1520',
    border: '#1a2535', dim: '#1e2d40',
    'text-primary': '#e2e8f0', 'text-muted': '#94a3b8',
  },
  light: {
    label: 'Hell', icon: '\u2600\uFE0F',
    bg: '#f0f2f5', surface: '#ffffff', card: '#ffffff',
    border: '#d1d5db', dim: '#e5e7eb',
    'text-primary': '#1e293b', 'text-muted': '#64748b',
  },
  downton: {
    label: 'Downton', icon: '\uD83C\uDFF0',
    bg: '#1a120b', surface: '#261a10', card: '#2e1f14',
    border: '#4a3728', dim: '#3d2c1e',
    'text-primary': '#f5e6d3', 'text-muted': '#b8a08a',
  },
}

export const ACCENTS = {
  teal: {
    label: 'Teal', preview: '#14b8a6',
    amber: '#f59e0b', teal: '#14b8a6', red: '#f87171', green: '#4ade80', blue: '#60a5fa',
  },
  amber: {
    label: 'Amber', preview: '#f59e0b',
    amber: '#f59e0b', teal: '#f59e0b', red: '#f87171', green: '#4ade80', blue: '#60a5fa',
  },
  blue: {
    label: 'Blau', preview: '#3b82f6',
    amber: '#f59e0b', teal: '#3b82f6', red: '#f87171', green: '#4ade80', blue: '#3b82f6',
  },
  purple: {
    label: 'Lila', preview: '#a78bfa',
    amber: '#f59e0b', teal: '#a78bfa', red: '#f87171', green: '#4ade80', blue: '#60a5fa',
  },
  rose: {
    label: 'Rose', preview: '#fb7185',
    amber: '#f59e0b', teal: '#fb7185', red: '#fb7185', green: '#4ade80', blue: '#60a5fa',
  },
}

// Downton ueberschreibt Akzente komplett mit eigenem Farbschema
const DOWNTON_ACCENT = {
  amber: '#d4a853',   // Gedaempftes Gold
  teal: '#8b6f4e',    // Warmes Bronze
  red: '#a0522d',     // Sienna/Burgunder
  green: '#6b8e4e',   // Gedaempftes Gruen
  blue: '#7b8fa1',    // Gedaempftes Blaugrau
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const FONTS = {
  sans: { label: 'Sans', icon: '\uD83D\uDD24', value: "'Outfit', system-ui, sans-serif" },
  mono: { label: 'Mono', icon: '\uD83D\uDCBB', value: "'DM Mono', 'Fira Code', monospace" },
}

export function applyTheme(mode = 'dark', accent = 'teal', font = 'sans') {
  const m = MODES[mode] || MODES.dark
  const a = mode === 'downton' ? DOWNTON_ACCENT : (ACCENTS[accent] || ACCENTS.teal)
  const s = document.documentElement.style

  // Mode-Farben
  s.setProperty('--color-bg', m.bg)
  s.setProperty('--color-surface', m.surface)
  s.setProperty('--color-card', m.card)
  s.setProperty('--color-border', m.border)
  s.setProperty('--color-dim', m.dim)
  s.setProperty('--color-text-primary', m['text-primary'])
  s.setProperty('--color-text-muted', m['text-muted'])

  // Akzent-Farben
  s.setProperty('--color-amber', a.amber)
  s.setProperty('--color-amber-dim', hexToRgba(a.amber, 0.1))
  s.setProperty('--color-amber-border', hexToRgba(a.amber, 0.22))

  s.setProperty('--color-teal', a.teal)
  s.setProperty('--color-teal-dim', hexToRgba(a.teal, 0.1))
  s.setProperty('--color-teal-border', hexToRgba(a.teal, 0.22))

  s.setProperty('--color-red', a.red)
  s.setProperty('--color-red-dim', hexToRgba(a.red, 0.1))
  s.setProperty('--color-red-border', hexToRgba(a.red, 0.22))

  s.setProperty('--color-green', a.green)
  s.setProperty('--color-green-dim', hexToRgba(a.green, 0.1))
  s.setProperty('--color-green-border', hexToRgba(a.green, 0.25))

  s.setProperty('--color-blue', a.blue)

  // Schriftart
  const fontVal = (FONTS[font] || FONTS.sans).value
  s.setProperty('--font-mono', fontVal)

  // Slider-Thumb Farbe (Akzent)
  s.setProperty('--color-slider-thumb', a.amber)

  // Light-Mode: Scrollbar + Slider anpassen
  if (mode === 'light') {
    s.setProperty('--color-slider-thumb-shadow', hexToRgba(a.amber, 0.3))
  } else {
    s.setProperty('--color-slider-thumb-shadow', hexToRgba(a.amber, 0.5))
  }
}
