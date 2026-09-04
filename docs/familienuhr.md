# Familienuhr (Molly-Weasley-Uhr)

Zeigt für jede Person einen Zeiger, der automatisch auf den aktuellen
Aufenthalt springt – nach dem Vorbild der Uhr aus dem Fuchsbau.

- Karte: `src/cards/MollyClockCard.jsx` (Darstellung + Animation)
- Optik-Entwürfe: `design/` (vier organische Richtungen)
- Haut: Umschalter „Messing / Wurzelwerk" in der Kartenkopfzeile, gespeichert
  als `mollySkin` in den Dashboard-Einstellungen (localStorage)
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
| 6 | `place`-Sensor liefert eine POI-Kategorie | passender Sektor, Beschriftung = `place_name` |
| 7 | laufender Kalendertermin mit „Urlaub/Ferien/Reise“ | **Urlaub** |
| 8 | `proximity.*` mit `dir_of_travel: towards` | **Heimweg** (inkl. Restdistanz) |
| 9 | sonst `not_home` | **Unterwegs** (inkl. Distanz, falls bekannt) |

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

### Auf den Handys einrichten

Ohne das hier bleibt die Uhr träge – die Genauigkeit der Zeiger hängt
vollständig davon ab, wie oft die Companion-App einen Standort schickt.

**Beide Handys, gemeinsam**

1. HA Companion App installieren und mit einem **eigenen HA-Benutzer** anmelden
   (nicht denselben für beide – sonst gibt es nur einen `device_tracker`).
2. In HA unter Einstellungen → Personen bei Johannes bzw. Tanja den jeweiligen
   `device_tracker` der App zuweisen. Erst dadurch bewegt sich `person.*`.
3. Benachrichtigungen erlauben – HA erzwingt darüber bei Bedarf ein Standort-Update
   (`request_location_update`).

**Android**

- Systemeinstellungen → Standort: **„Immer zulassen"** und **genauer Standort** an.
- Systemeinstellungen → Akku: Akku-Optimierung für HA auf **„Nicht optimiert"**.
  Sonst friert Android die App im Hintergrund ein.
- App → Einstellungen → Companion App → Sensoren verwalten → Standortsensoren:
  - **Background Location** an – Fused Location API, Update alle 1–3 min.
  - **Location Zone** an – Geofences pro Zone, Zonenwechsel in Sekunden.
  - **Single Accurate Location** an – erzwingt eine genaue Messung, wenn die
    gemeldete Genauigkeit schlechter als der Schwellwert (Standard 200 m) ist.
  - **High Accuracy Mode** – GPS im Sekundentakt. Nicht dauerhaft anschalten;
    als Bedingung entweder „nicht in Zone Zuhause" mit 500 m Trigger-Range oder
    das Autoradio als Bluetooth-Bedingung. Genau das macht den Sektor
    „Heimweg" flott, ohne den Akku den ganzen Tag zu ziehen.

**iOS**

- Einstellungen → Home Assistant → Standort: **„Immer"** und **genauer Standort** an.
- **Hintergrundaktualisierung** an, **Stromsparmodus** aus (drosselt Updates).
- iOS meldet von sich aus nur bei Zonenwechsel, iBeacon-Ereignissen und
  „signifikanten Standortänderungen" (grob 500 m bzw. Funkzellenwechsel,
  mindestens alle 15 min). Zwischen zwei Zonen ist ein iPhone dadurch
  spürbar träger als ein Android-Gerät – dagegen hilft nur ein erzwungenes
  Update per Automation (siehe unten).
- iOS überwacht nur eine begrenzte Zahl Regionen gleichzeitig: Zonen sparsam
  anlegen, sonst fallen die hinteren stillschweigend heraus.

**Zonen**

Radius nicht zu klein wählen (ab ca. 100 m zuverlässig); zu kleine Zonen lösen
den Geofence gar nicht oder ständig aus.

**Update erzwingen (optional)**

```yaml
automation:
  - alias: Standort ausserhalb der Heimzone haeufiger holen
    trigger:
      - platform: time_pattern
        minutes: "/10"
    condition:
      - condition: not
        conditions:
          - condition: state
            entity_id: person.johannes
            state: home
    action:
      - service: notify.mobile_app_<geraetename>
        data:
          message: request_location_update
```

Damit ist die Uhr auch auf dem iPhone nie älter als ~10 Minuten. Preis: etwas
Akku – bei Bedarf das Intervall vergrößern oder die Automation auf Abend-/
Feierabendzeiten begrenzen.

### Orte automatisch kategorisieren (optional)

Für Orte, für die es keine Zone gibt, kann Reverse-Geocoding die Kategorie
liefern: die HACS-Integration [`custom-components/places`](https://github.com/custom-components/places)
fragt OpenStreetMap Nominatim ab und legt `place_category` (OSM-Key),
`place_type` (OSM-Value) und `place_name` als Attribute ab. Kostenlos, ohne
API-Key. Sensor auf `person.johannes` anlegen und in `MOLLY_PERSONS` als
`place: 'sensor.johannes_place'` eintragen.

`PLACE_RULES` in `src/lib/mollyClock.js` bildet die OSM-Tags auf Sektoren ab:

| OSM | Sektor | Beschriftung |
|-----|--------|--------------|
| `shop` / `supermarket`, `bakery`, `mall` … | Einkauf | `place_name` |
| `school`, `kindergarten`, `university` … | Schule | `place_name` |
| `office` / `townhall`, `industrial` … | Arbeit | `place_name` |
| `tourism` / `hotel`, `camp_site` … | Urlaub | `place_name` |
| `amenity`, `healthcare`, `leisure`, `sport` | Besuch | `place_name` |
| `highway` / `motorway`, `parking`, `station` … | *kein Treffer* | – |

Der letzte Fall ist Absicht: ein Straßen-Treffer ist ein schwaches Signal und
darf „Heimweg“ nicht verdecken – er fällt durch zu Proximity bzw. Unterwegs.
Ein echter POI schlägt dagegen Proximity.

**Warum nicht Google?** Die Maps Timeline liegt seit Ende 2024 nur noch auf dem
Gerät, die Cloud-Historie wurde im Juni 2025 abgeschaltet – eine Timeline-API
gibt es nicht. Bliebe die Places API (Nearby Search): technisch möglich, aber
ab 5.000 Aufrufen/Monat kostenpflichtig und nur über einen Proxy nutzbar, weil
der API-Key nicht ins Frontend gehört. Die HA-Integration `google_maps`
(Location Sharing) ist als Legacy-Platform markiert und wird mit Core 2027.5
entfernt.

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
