# Übergabe: Familienuhr + Wochenplan

Stand `1bf0755` auf Branch `claude/molly-weasley-clock-dashboard-p7aqqo`.
`main` steht unverändert auf `4c6ebb8`.

Alles ist committet und gepusht. Was fehlt, ist der Weg auf die LXC — das
konnte die Cloud-Session nicht selbst tun (kein Netzweg ins LAN).

---

## 1. Was drin ist

| Commit | Inhalt |
|---|---|
| `73dda9d` | Familienuhr: Karte, Auflösungsregeln, Animation, HA-Doku |
| `cd9038c` | Reverse-Geocoding als Automatik-Quelle + vier Design-Entwürfe |
| `d408b97` | Messing-Optik als Hero, Skin-Umschalter, konsolidierter Wochenplan |
| `1bf0755` | Doku: Einrichtung der Companion-App auf den Handys |

**Dateien**

```
src/lib/mollyClock.js        Sektoren + Auflösungsregeln (reines JS, ohne React)
src/cards/MollyClockCard.jsx Zifferblatt (2 Häute), Plaketten, manuelle Auswahl
src/cards/MealPlanCard.jsx   Wochenplan: Essen + Termine + Aufgaben pro Tag
src/config.js                MOLLY_PERSONS
src/index.css                .molly-* (Layout + Animation)
src/context/SettingsContext  mollySkin (brass | vine)
design/                      Vier Entwürfe + Generatoren
docs/familienuhr.md          HA-Setup: Zonen, proximity, places, Handys
```

**Design-Canvas:** <https://claude.ai/code/artifact/6eb11d81-40e8-422a-adf9-192c39a05d8a>

---

## 2. Deployen

Auf dem Docker-Host. Der `diff`-Schritt ist wichtig: die `nginx.conf` im Repo
proxyt **nur** Uptime Kuma, nicht `/ha-ws`, `/ha-api`, `/gcal`, `/chores`,
`/tandoor`. Im laufenden Container steht offenbar eine andere Version — ein
Rebuild würde sie überschreiben und die HA-Verbindung kappen.

```bash
# laufende nginx-Config sichern
docker exec ha-dashboard cat /etc/nginx/conf.d/default.conf > /tmp/nginx-live.conf

cd <pfad-zum-dashboard-repo>
git fetch origin
git checkout claude/molly-weasley-clock-dashboard-p7aqqo
git pull

# weicht die laufende Config ab? dann sie gewinnen lassen
diff /tmp/nginx-live.conf nginx.conf || cp /tmp/nginx-live.conf nginx.conf

docker compose up -d --build
```

Danach im Browser hart neu laden. `main` bleibt unberührt.

**Erwartung:** Tab *Familie* → oben die Messing-Uhr mit Umschalter
„Messing / Wurzelwerk", darunter der Wochenplan. Stehen beide Zeiger auf
**Verschollen**, ist das kein Kartenfehler, sondern Punkt 3.1.

---

## 3. Offene Punkte

### 3.1 Entity-IDs verifizieren (blockiert die Uhr)

Bestätigt sind nur `person.johannes`, `person.tanja`, `calendar.johannes`,
`calendar.tanja` — die nutzt das Ribbon seit dem ersten Commit produktiv.
Alles andere in `MOLLY_PERSONS` sind erfundene Namen und existiert vermutlich
noch nicht: `proximity.*_zuhause`, `sensor.*_place`, `input_select.molly_*`,
`binary_sensor.molly_*_gefahr`. Fehlende Entitäten werden still übersprungen.

Prüfen:

```bash
curl -s -H "Authorization: Bearer $HA_TOKEN" http://<ha-host>:8123/api/states \
  | jq -r '.[] | select(.entity_id|test("^(person|device_tracker|proximity)\\."))
           | "\(.entity_id) = \(.state) | trackers: \(.attributes.device_trackers // "-")"'
```

**Der wahrscheinliche Haken:** die Companion-App legt `device_tracker.<handy>`
an — das ist nicht dasselbe wie die Person-Entität. Ist der Tracker der Person
nicht zugewiesen (Einstellungen → Personen → Gerät auswählen), bleibt
`person.*` auf `unknown` und die Uhr zeigt „Verschollen".

### 3.2 nginx.conf ins Repo nachziehen

Siehe Deploy-Schritt. Solange die laufende Config nicht eingecheckt ist, ist
jeder Rebuild ein Risiko.

### 3.3 HA-seitige Automatik (optional, macht die Uhr erst gut)

Reihenfolge nach Nutzen: Zonen anlegen → `proximity` (bringt „Heimweg") →
`places` via HACS (kategorisiert unbekannte Orte) → `input_select` (manuelle
Übersteuerung). YAML für alles in `docs/familienuhr.md`.

### 3.4 Handys

`docs/familienuhr.md`, Abschnitt „Auf den Handys einrichten". Kurz: Standort
„Immer" + genauer Standort, Akku-Optimierung aus (Android), Background
Location + Location Zone + Single Accurate Location an. iPhones sind zwischen
zwei Zonen träge — dagegen die `request_location_update`-Automation.

### 3.5 Doppelte Anzeige entscheiden

`ChoresCard` und `CalendarCard` stehen weiter unter dem Wochenplan, zeigen
also Aufgaben und Termine ein zweites Mal. Absicht, weil sie mehr können
(Punktestand, Aufgabenverwaltung, 14-Tage-Ausblick). Wenn das stört: aus
`src/tabs/TabFamilie.jsx` entfernen.

### 3.6 Secrets

`HA_TOKEN`, `TANDOOR_TOKEN`, `PIHOLE_PASSWORD` stehen im Klartext in
`src/config.js`, landen im Browser-Bundle und stecken in der Git-Historie.
Im LAN vertretbar; sauber wären Vite-Env-Variablen.

---

## 4. Was geprüft ist – und was nicht

**Geprüft:** `npm run build` läuft, ESLint auf allen neuen/geänderten Dateien
sauber (die ~70 Altlasten im Repo sind unberührt), Auflösungsregeln gegen
Testfälle durchgespielt, beide Häute und der Wochenplan per Screenshot in
Desktop- und Handy-Breite geprüft.

**Nicht geprüft:** alles gegen echte Daten. Kein Kontakt zu HA, Tandoor,
Chores oder den Kalendern — die Screenshots liefen gegen gemockte Hooks.

---

## 5. Prompt für eine lokale Claude-Code-Session

Claude Code lokal (CLI oder Desktop) auf einer Maschine im LAN starten,
Repo öffnen, und das hier einwerfen:

> Im Repo liegt der Branch `claude/molly-weasley-clock-dashboard-p7aqqo` mit
> einer Familienuhr (Molly-Weasley-Stil) und einem konsolidierten Wochenplan
> für unser HA-Dashboard. Lies `docs/HANDOVER.md` und `docs/familienuhr.md`.
>
> Du hast im Gegensatz zur Vorsession Zugriff auf unser Netz: Home Assistant
> läuft in einer Proxmox-VM, das Dashboard als Container auf `192.168.178.43`.
>
> Bitte der Reihe nach:
> 1. Frag HA nach allen `person.*`, `device_tracker.*` und `proximity.*`
>    Entitäten und gleich sie mit `MOLLY_PERSONS` in `src/config.js` ab.
>    Prüf besonders, ob die Companion-App-Tracker den Personen zugewiesen
>    sind — sonst zeigt die Uhr „Verschollen".
> 2. Hol die laufende `/etc/nginx/conf.d/default.conf` aus dem
>    `ha-dashboard`-Container und commite sie ins Repo, damit ein Rebuild
>    die HA-Routen nicht kaputt macht.
> 3. Deploye den Branch (`git checkout`, `docker compose up -d --build`) und
>    schau im Browser nach, ob Uhr und Wochenplan erscheinen.
> 4. Danach die offenen Punkte aus Abschnitt 3 der Übergabe.
