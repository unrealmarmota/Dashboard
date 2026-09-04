# Entwürfe: Familienuhr

Vier organische Richtungen für die Molly-Weasley-Uhr (`src/cards/MollyClockCard.jsx`),
als Design-Canvas: <https://claude.ai/code/artifact/6eb11d81-40e8-422a-adf9-192c39a05d8a>

| Artboard | Richtung | Stärke | Preis |
|---|---|---|---|
| `Main.dc.html` | Messing & Patina | auf Distanz lesbar, passt zum Downton-Theme | neue Schrift (Cormorant Garamond) |
| `Tinte.dc.html` | Tinte & Pergament | am nächsten am Fuchsbau | Caveat ist aus 3 m schwer lesbar |
| `Wurzelwerk.dc.html` | Ranke mit Laternen | wärmste, eigenständigste Variante | skaliert ab drei Personen schlecht |
| `Nebel.dc.html` | Lichtfelder statt Sektoren | nutzt nur vorhandene Tokens/Schriften | verliert die Uhr-Metapher |

Alle vier zeigen dieselbe Situation und dieselbe Informationsarchitektur wie die
gebaute Karte – es unterscheidet sich nur das SVG.

## Neu generieren

```bash
python3 design/gen_messing.py
python3 design/gen_tinte.py
python3 design/gen_rest.py     # Wurzelwerk + Nebel
```

`gen_common.py` hält Geometrie, Icon-Set und die Kartenhülle; die Farbwerte sind
1:1 aus `src/index.css` und `src/themes.js` übernommen. `canvas.json` legt die
Anordnung auf dem Canvas fest.
