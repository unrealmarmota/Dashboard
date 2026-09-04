# Familienuhr (Molly-Weasley-Uhr)

Zeigt für jede Person einen Zeiger, der automatisch auf den aktuellen
Aufenthalt springt – nach dem Vorbild der Uhr aus dem Fuchsbau.

- Karte: `src/cards/MollyClockCard.jsx` (Darstellung + Animation)
- Regeln: `src/lib/mollyClock.js` (welcher Zustand ergibt welchen Sektor)
- Personen: `MOLLY_PERSONS` in `src/config.js`
- Animation: Abschnitt „Molly-Weasley-Uhr“ in `src/index.css`

## Wie der Aufenthalt automatisch gesetzt wird

Ausgewertet wird in dieser Reihenfolge, die erste zutreffende Regel gewinnt:

| # | Quelle | Ergebnis |
|---|--------|----------|
| 1 | `peril` ist `on` | **Gefahr** |
| 2 | `override` ≠ „Auto“ | der manuell gewählte Sektor |
| 3 | `person.*` ist `unknown`/`unavailable` | **Verschollen** |
| 4 | `person.*` ist `home` | **Zuhause** |
| 5 | `person.*` ist ein Zonenname | Sektor per Stichwort, Beschriftung = Zonenname |
| 6 | laufender Kalendertermin mit „Urlaub/Ferien/Reise“ | **Urlaub** |
| 7 | `proximity.*` mit `dir_of_travel: towards` | **Heimweg** (inkl. Restdistanz) |
| 8 | sonst `not_home` | **Unterwegs** (inkl. Distanz, falls bekannt) |

Nur `entity` ist Pflicht. Alle anderen Entitäten sind optional – existieren sie
in HA nicht, wird die jeweilige Regel einfach übersprungen.

## Home-Assistant-Seite

### Zonen (Pflicht für sinnvolle Sektoren)

Einstellungen → Bereiche & Zonen → Zonen. Der Zonenname landet 1:1 als State
der Person und wird über Stichwörter einem Sektor zugeordnet
(`ZONE_RULES` in `src/lib/mollyClock.js`):

| Sektor | Stichwörter im Zonennamen |
|--------|---------------------------|
| Arbeit | arbeit, work, büro, office, firma, job, praxis, klinik, werkstatt |
| Schule | schule, kita, kindergarten, hort, uni, hochschule, studium |
| Einkauf | einkauf, markt, rewe, aldi, lidl, edeka, kaufland, dm, baumarkt, laden |
| Urlaub | urlaub, ferien, hotel, camping, strand, reise |
| Besuch | oma, opa, eltern, schwieger, freunde, besuch, verein, sport |
| Unterwegs | bahn, bahnhof, zug, flughafen, autobahn |

Eine Zone ohne Treffer landet auf **Besuch** und behält ihren Namen als
Beschriftung („Praxis Dr. Meier“). Neue Stichwörter einfach in `ZONE_RULES`
ergänzen.

### Proximity – erkennt den Heimweg

```yaml
# configuration.yaml
proximity:
  johannes_zuhause:
    zone: home
    devices:
      - person.johannes
    tolerance: 50
    unit_of_measurement: m
  tanja_zuhause:
    zone: home
    devices:
      - person.tanja
    tolerance: 50
    unit_of_measurement: m
```

Liefert `dir_of_travel` (`towards` / `away_from` / `stationary`) und die
Entfernung – daraus wird „Heimweg – noch 8,4 km“.

### Manuelle Übersteuerung (optional)

```yaml
input_select:
  molly_johannes:
    name: Johannes Aufenthalt
    icon: mdi:clock-outline
    options:
      - Auto
      - Zuhause
      - Arbeit
      - Schule
      - Einkauf
      - Besuch
      - Urlaub
      - Unterwegs
      - Verschollen
      - Gefahr
      - Heimweg
    initial: Auto
```

Ein Tipp auf die Person in der Legende öffnet die Auswahl; „Automatik“ setzt
den Wert zurück auf `Auto`. Existiert der `input_select` nicht, wird die
Schaltfläche gar nicht erst angezeigt.

Praktisch dazu: eine Automation, die nach der Heimkehr wieder auf `Auto`
zurückstellt.

```yaml
automation:
  - alias: Familienuhr zuruecksetzen
    trigger:
      - platform: state
        entity_id: person.johannes
        to: home
    action:
      - service: input_select.select_option
        target: { entity_id: input_select.molly_johannes }
        data: { option: Auto }
```

### „Lebensgefahr“ (optional, augenzwinkernd)

Beliebiger `binary_sensor` oder `input_boolean`, z. B. Rauchmelder,
Alarmanlage oder der Wasserstandssensor im Keller:

```yaml
template:
  - binary_sensor:
      - name: molly_johannes_gefahr
        state: >
          {{ is_state('binary_sensor.rauchmelder', 'on')
             and is_state('person.johannes', 'home') }}
```

## Person hinzufügen

In `src/config.js` einen Eintrag an `MOLLY_PERSONS` anhängen. Jeder weitere
Zeiger wird automatisch 15 px kürzer, damit sich Zeiger im gleichen Sektor
nicht verdecken – bis ca. vier Personen bleibt das gut lesbar.

## Animation

- **Zeiger**: CSS-Transition über 1,9 s mit leichtem Overshoot
  (`cubic-bezier(0.32, 1.34, 0.44, 1)`) – der Zeiger schwingt am Ziel kurz
  nach wie ein echter Uhrzeiger. Der Winkel wird kumulativ geführt und immer
  über den kürzeren Weg gedreht, damit kein Sprung über die 12 entsteht.
- **Zittern**: dauerhaftes Wackeln um ±0,7° (`mollyQuiver`), pro Person
  zeitversetzt.
- **Ankunft**: ein Ring am Zeigerkopf pulst auf, sobald ein neuer Sektor
  erreicht ist (`mollyPulse`) – zeitlich hinter der Zeigerbewegung.
- **Sektor**: Lünette und Zifferblatt des belegten Sektors werden in der Farbe
  der Person eingefärbt und blenden weich mit.
- `prefers-reduced-motion` schaltet Zittern und Puls ab und verkürzt die
  Zeigerbewegung.
