# Design-Spezifikation: Familienuhr

Exakte Werte zur Karte in `src/cards/MollyClockCard.jsx` und den `.molly-*`
Regeln in `src/index.css`. Entwurfsvorlage: `design/Main.dc.html` (Messing)
bzw. `design/Wurzelwerk.dc.html`.

---

## 1. Koordinatensystem

```
viewBox   0 0 400 400
Zentrum   C = (200, 200)
Winkel    0° = 12 Uhr, im Uhrzeigersinn
polar(r, deg) → x = C + r·cos(deg−90°), y = C + r·sin(deg−90°)
```

Das SVG hat `overflow: visible` — der Ring darf über die viewBox hinausragen,
ohne beschnitten zu werden.

## 2. Sektoren

Zehn Sektoren à 36°, Reihenfolge = Anordnung im Uhrzeigersinn ab 12 Uhr:

| # | ID | Beschriftung | Winkel |
|---|---|---|---|
| 0 | `home` | Zuhause | 0° |
| 1 | `work` | Arbeit | 36° |
| 2 | `school` | Schule | 72° |
| 3 | `shopping` | Einkauf | 108° |
| 4 | `visiting` | Besuch | 144° |
| 5 | `holiday` | Urlaub | 180° |
| 6 | `travel` | Unterwegs | 216° |
| 7 | `lost` | Verschollen | 252° |
| 8 | `peril` | Gefahr | 288° |
| 9 | `homeward` | Heimweg | 324° |

„Heimweg" liegt bewusst direkt **vor** „Zuhause" — der Zeiger legt auf dem
Weg nach Hause die kürzeste Strecke zurück.

## 3. Radien (Messing)

| Konstante | Wert | Bedeutung |
|---|---|---|
| `R_CASE` | 190 | äußerer Messingring |
| `R_ICON` | 170 | Sektor-Icons in der Lünette |
| `R_FACE` | 152 | Zifferblatt |
| `R_LABEL` | 138 | Basis der Sektor-Beschriftung |
| `R_WEDGE_IN` | 44 | innerer Rand der Sektorfläche |
| Nabe | 19 / 4.5 | Rosettenring / Kern |
| `HAND_BASE` | 88 | Länge des ersten Zeigers |
| `HAND_STEP` | 18 | Abzug je weiterer Person |

**Zeigerlängen:** `max(38, 88 − i·18)` → 88, 70, 52, 38 …

**Adaptiver Beschriftungsradius.** Waagerecht stehende Sektoren tragen lange
Wörter („Verschollen") und stoßen sonst an die Lünette:

```
r_label = 138 − 20·|sin(deg)|
```

→ 138 bei 0°/180°, 126.2 bei 36°/144°/216°/324°, 119.0 bei 72°/108°/252°/288°.

Das ist auch die Regel, die verhindert, dass der Zeigerkopf die Beschriftung
verdeckt: der äußerste Zeiger reicht mit Zierring bis 88 + 21.5 = **109.5**,
die nächstliegende Beschriftung sitzt bei **119**. Wer `HAND_BASE` erhöht,
muss `R_LABEL` mitziehen.

## 4. Gehäuse

Kein durchgehender Kreis — vier Bögen mit Lücken, wandernder Strichstärke und
Deckkraft, alle in `url(#mcBrass)`:

| von | bis | Radius | Strichstärke | Deckkraft |
|---|---|---|---|---|
| 7° | 171° | 190 | 5.2 | 1.0 |
| 189° | 353° | 190 | 4.4 | 1.0 |
| 2° | 358° | 196.5 | 0.9 | 0.32 |
| 12° | 348° | 181.5 | 0.8 | 0.22 |

`stroke-linecap: round`. Die Lücken bei 12 und 6 Uhr sind der Kern des
Entwurfs: eine geschlossene, gleich starke Linie wirkt gefräst, eine
unterbrochene gestochen.

**Trennstriche** zwischen den Sektoren laufen minimal aus der Achse — Anfangs-
und Endpunkt kippen gegenläufig um `jitter(i) = sin(i · 2.399) · 1.1` Grad:

```
von polar(154, deg + 18 + j)  bis  polar(187, deg + 18 − j)
stroke var(--color-amber), 0.9px, opacity 0.3
```

**Kerben:** je Sektor zwei Striche bei `deg ± 10.5°`, von r=184 nach r=179,
0.7px, opacity 0.18.

**Patina-Korn** über der ganzen Scheibe, auf r=196 beschnitten:

```svg
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
<feColorMatrix type="saturate" values="0"/>
```
als `<rect>` mit `opacity 0.055`.

**Nabe:** Kreis r=19 in `--color-card` mit 1.6px Messingrand, darin 16
Radialstriche à 22.5° von r=8 nach r=15 (0.6px, opacity 0.32), Kern r=4.5.

## 5. Belegter Sektor

Zwei Flächen statt einer Füllung:

1. **Lünette** (r 154 → 186): Schraffur, `opacity 0.85`
2. **Zifferblatt** (r 44 → 152): Personenfarbe flächig, `opacity 0.08`

Das Schraffurmuster:

```svg
<pattern width="7" height="7" patternTransform="rotate(38)"
         patternUnits="userSpaceOnUse">
  <line x1="0" y1="0" x2="0" y2="7" stroke="<Personenfarbe>"
        stroke-width="1.5" opacity="0.5"/>
</pattern>
```

Warum Schraffur: eine flächige Füllung liest sich als UI-Zustand, eine
Schraffur als Gravur — und sie bleibt lesbar, wenn zwei Personen im selben
Sektor stehen. Je Person ein eigenes Pattern (`mcHatch-<key>`).

Icons und Beschriftung wechseln bei Belegung von `--color-text-muted`
(opacity 0.42 bzw. 0.65) auf die Personenfarbe (opacity 1, Schriftschnitt 600).

## 6. Zeiger

Geschmiedete Nadel: von der Nabe breit, zur Spitze fein, mit Gegengewicht.
`L` = Zeigerlänge, `mid = L · 0.55`:

```
Gegengewicht  Kreis (200, 228) r=6, opacity 0.45
Nadel         M 184.1 201.7 → L 198 (200−mid) → L 200 (200−L)
                            → L 202 (200−mid) → L 215.9 201.7 Z
              fill Personenfarbe, opacity 0.92
Kopf          Kreis r=17, fill --color-card, Rand 1.9px
Zierring      Kreis r=21.5, 0.7px, opacity 0.35
Initial       17px, Schnitt 600, Personenfarbe
```

## 7. Farben

Alles außer Rinde und Blattgrün kommt aus den Theme-Tokens, die Uhr bleibt
damit in Dunkel/Hell/Downton stimmig.

| Element | Quelle |
|---|---|
| Messing (Verlauf `mcBrass`) | `--color-amber` mit 0.95 / 0.62 / 0.30 / 0.80 bei 0/38/62/100 % |
| Zifferblatt (`mcFace`) | radial `--color-surface` → `--color-card` (72 %) → `--color-bg` |
| Beschriftung inaktiv | `--color-text-muted` |
| Johannes | `--color-teal` (Patina auf Messing) |
| Tanja | `--color-amber` |
| Rinde (Wurzelwerk) | `#6b5a3e` fest |
| Blatt inaktiv | `#3f5c47` fest |

Personenfarben stehen in `MOLLY_PERSONS` und sind frei wählbar.

## 8. Typografie

| Element | Schrift | Größe | Rest |
|---|---|---|---|
| Sektor (Messing) | Cormorant Garamond | 15.5px | `small-caps`, `letter-spacing 1.1px` |
| Sektor (Wurzelwerk) | Vollkorn | 14.5px | `letter-spacing 0.2px` |
| Zeiger-Initial | Cormorant Garamond | 17px | Schnitt 600 |
| Plakette Name | Cormorant Garamond | 16px | `small-caps`, `letter-spacing 1.4px` |
| Plakette Ort | Outfit | 21px | Schnitt 400 |
| Plakette Detail | DM Mono | 11.5px | `--color-text-muted` |
| Kartenlabel | DM Mono | 12px | Versalien, `letter-spacing 1.5px` |

Als Tokens: `--font-display`, `--font-display-vine`; geladen in `index.html`.
Fallback ist jeweils Georgia — ohne Netz sieht die Uhr etwas anders, aber
nicht kaputt aus.

## 9. Animation

| Was | Wert |
|---|---|
| Zeigerbewegung | `transform 1.9s cubic-bezier(0.32, 1.34, 0.44, 1)` |
| Zittern | `mollyQuiver 5.5s ease-in-out infinite`, −0.7° / +0.5° / −0.2° bei 0 / 33 / 66 % |
| Versatz je Person | `animation-delay: i · −1.7s` |
| Ankunfts-Puls | `mollyPulse 1.4s 0.9s ease-out both`, `scale(0.7)` @ 0.9 → `scale(2.4)` @ 0 |
| Sektor-Einblendung | `opacity`/`fill-opacity` 1.2s ease-out |

Drei Details, die den Unterschied machen:

- **Kumulativer Winkel.** Der Zeiger dreht immer über den kürzeren Weg:
  `delta = ((ziel − ist) mod 360 + 540) mod 360 − 180`, aufaddiert auf den
  bisherigen Winkel. Ohne das springt er beim Wechsel über die 12.
- **`transform-box: view-box`** auf Zeiger und Zitter-Gruppe, `transform-origin:
  50% 50%` — sonst rotiert SVG um den falschen Punkt. Der Puls braucht dagegen
  `fill-box`, weil er um seinen eigenen Mittelpunkt skaliert.
- **Der Puls startet 0.9 s verzögert**, also erst wenn der Zeiger fast steht.
  Er wird über `key={changedAt}` neu gemountet und spielt dadurch erneut ab —
  kein Timer nötig.

`prefers-reduced-motion` schaltet Zittern und Puls ab und kürzt die
Zeigerbewegung auf 0.3 s.

## 10. Layout

Grid mit benannten Bereichen, Zifferblatt in der Mitte, Plaketten flankierend:

```
< 900px    "dial" / "a" / "b"                 Zifferblatt 100 %, max 330px
≥ 900px    "a dial b", 1fr auto 1fr, gap 28   Zifferblatt 440px
≥ 1180px                                       Zifferblatt 520px
```

Ab 900px wird die linke Plakette gespiegelt (`flex-direction: row-reverse`,
`text-align: right`), damit die beiden Seiten die Uhr rahmen. Personen werden
per `index % 2` auf links/rechts verteilt.

## 11. Wurzelwerk

Gleiche Geometrie und dieselbe Zeigermechanik, anderes Material.

| Element | Wert |
|---|---|
| Ranke außen | `organicRing(168, 30, 6, 0.6)`, Rinde, 3.4px, opacity 0.9 |
| Ranke innen | `organicRing(159, 24, 4.2, 2.4)`, 1.4px, opacity 0.45 |
| Blatt je Sektor | Linse ±22 lang, ±17 breit, um `deg + jitter(i)·3.5` gedreht, mit Mittelrippe |
| Blatt belegt / leer | `fill-opacity` 0.32 / 0.20, Rand 1.5px / 1px |
| Beschriftung | `132 − 16·|sin(deg)|` |
| Trieb | kubische Kurve, Kontrollpunkte `polar(L·0.42, −11°)` und `polar(L·0.78, +7°)`, Rinde 3.2px |
| Seitenblätter | bei `t` = 0.42 / 0.66 / 0.84, Seite ∓, um ±52° gedreht |
| Laterne | Glühkreis r=34 (Radialverlauf Personenfarbe 0.5 → 0), Scheibe r=16 |
| Wurzelstock | `organicRing` mit r = 22 / 15 / 8, Strichstärke 2.4 / 1.4 / 1.1 |

`organicRing(r, n, amp, seed)` legt `n` Punkte auf den Kreis und variiert den
Radius mit `sin(k·1.3 + seed)·amp + sin(k·0.41 + seed)·amp·0.7`, verbunden
über quadratische Bézierkurven — deterministisch, also bei jedem Rendern
identisch.

## 12. Ikonografie

Zehn Strich-Icons auf 20×20-Raster, `stroke-width 1.35` (auf die Zielgröße
zurückgerechnet), `linecap`/`linejoin` rund, kein `fill`. Dargestellt mit 21px
(Messing) bzw. 17px (Wurzelwerk).

**Keine Emoji.** Emoji rendern je nach Plattform anders, lassen sich nicht
einfärben und kippen den Stil ins Verspielte. Das gilt auch für die
Personen — statt Avatar-Emoji eine Initiale in der Anzeigeschrift.

Kreise, die sich nicht sinnvoll als Pfad ausdrücken lassen (Köpfe, Räder,
Kompassrose), liegen getrennt in `ICON_DOTS`.

## 13. Wenn du etwas änderst

- **Mehr als vier Personen** → Zeiger werden auf 38 gekappt und überlagern
  sich. Dann `HAND_STEP` verkleinern oder die Köpfe seitlich versetzen.
- **Sektor umbenennen** → nur `SECTORS` in `src/lib/mollyClock.js`; Winkel,
  Layout und Animation folgen automatisch. Beschriftungen über etwa elf
  Zeichen brauchen einen größeren `pull`-Wert.
- **Sektor hinzufügen** → `SECTOR_STEP` fällt unter 36°, die Beschriftungen
  werden eng. Ab zwölf Sektoren die Schrift verkleinern oder Beschriftung
  radial ausrichten.
- **Andere Personenfarben** → nur `MOLLY_PERSONS`. Schraffur, Zeiger, Plakette
  und Glühen ziehen mit.
