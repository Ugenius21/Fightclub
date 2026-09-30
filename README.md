# Fightclub 🥊

Fightclub ist eine App fürs iPhone, mit der du deinen Fortschritt im Krafttraining und dein Körpergewicht verfolgst.

## Funktionen

- **Trainingspläne**: Lege Pläne wie „Push“, „Pull“ oder „Beine“ an. Jeder Plan hat eine eigene Farbe.
- **Übungen**: Füge einem Plan mit einem Tipp Übungen hinzu (z. B. Bankdrücken, Butterfly). Du kannst sie umbenennen, löschen und per „Bearbeiten“ neu anordnen.
- **Training erfassen**: Jede Übung besteht aus Sätzen mit **Satz · Gewicht (kg) · Wiederholungen**. Mit „Satz hinzufügen“ legst du einen weiteren Satz an; die Werte des vorherigen Satzes werden dabei übernommen.
- **Werte vom letzten Training**: Beim Start eines Trainings werden alle Sätze mit den Werten vom letzten Mal vorbelegt. Unter jeder Übung steht außerdem, was du beim letzten Training geschafft hast.
- **Fortschritt**: Ein Diagramm zeigt die Steigerung pro Übung als maximales Gewicht, geschätztes 1RM oder Volumen, dazu Start, Aktuell, Bestwert und Steigerung.
- **Kalender**: Trainingstage werden in der Farbe des jeweiligen Plans ausgefüllt (z. B. Push = Rot, Beine = Blau). Hast du an einem Tag mehrere Pläne trainiert, wird das Feld geteilt. Über den Kalender kannst du auch vergangene Trainings nachtragen.
- **Körpergewicht**: Trage dein Gewicht ein und sieh dir den Verlauf im Diagramm an (1M / 3M / 6M / 1J / Alle).

Fightclub gibt es in zwei Varianten mit denselben Funktionen:

| | **Web-App** (`web/`) – empfohlen ohne Mac | **Native iOS-App** (`Fightclub/`) |
|---|---|---|
| Installation | Link in Safari öffnen → „Zum Home-Bildschirm“ | IPA per Sideloadly vom Windows-PC |
| Kabel / PC nötig | nein | ja |
| Läuft ab | nie | nach 7 Tagen (kostenlose Apple-ID) |
| Offline nutzbar | ja | ja |
| Daten | lokal auf dem iPhone, Backup als JSON-Datei | lokal auf dem iPhone (SwiftData) |

## Installation ohne Mac: Web-App (empfohlen)

Die Web-App wird über **GitHub Pages** veröffentlicht und dann wie eine normale App auf den Home-Bildschirm gelegt – mit eigenem Icon, im Vollbild und offline nutzbar.

**Einmalig einrichten (am Windows-PC im Browser):**

1. Auf GitHub im Repository → *Settings* → *Pages* → bei *Source* **„GitHub Actions“** auswählen.
2. Die Änderungen in den Standard-Branch mergen (Pages veröffentlicht standardmäßig nur vom Standard-Branch). Alternativ: *Actions* → „Web-App veröffentlichen“ → *Run workflow*.
3. Nach ca. 1 Minute steht unter *Settings → Pages* die Adresse, z. B. `https://ugenius21.github.io/Fightclub/`.

**Auf dem iPhone:**

1. Die Adresse in **Safari** öffnen.
2. Auf das **Teilen-Symbol** (Quadrat mit Pfeil) tippen → **„Zum Home-Bildschirm“** → *Hinzufügen*.
3. Fightclub über das neue Icon starten. 🎉

Updates kommen automatisch: Nach jedem Push in `web/` wird die Seite neu veröffentlicht, und die App lädt beim nächsten Start die neue Version.

**Wichtig zu den Daten:** Alles wird nur auf dem iPhone gespeichert (kein Server, kein Konto). Über ⚙︎ → *Backup exportieren* kannst du eine Sicherung z. B. in iCloud Drive ablegen und bei Bedarf wieder importieren. Öffne die App immer über das Home-Bildschirm-Icon – Safari und die Home-Bildschirm-App haben getrennte Speicher.

**Lokal testen:** Im Ordner `web/` einen beliebigen Webserver starten, z. B. `npx serve web` oder `python -m http.server -d web`, und `http://localhost:3000` bzw. `:8000` öffnen.

## Installation ohne Mac: Native App per Sideloadly

GitHub baut die App bei jedem Push automatisch auf einem Mac in der Cloud und stellt eine `.ipa`-Datei bereit. Diese installierst du mit **Sideloadly** und deiner normalen (kostenlosen) Apple-ID auf dem iPhone.

1. **IPA herunterladen:** Im Repository auf GitHub → *Actions* → den neuesten grünen „Build“-Lauf öffnen → unten bei *Artifacts* auf **Fightclub-ipa** klicken. Die ZIP-Datei entpacken; darin liegt `Fightclub.ipa`.
2. **Vorbereitung am PC:** iTunes und iCloud für Windows installieren – und zwar die Versionen **direkt von apple.com**, nicht aus dem Microsoft Store. Danach [Sideloadly](https://sideloadly.io) installieren.
3. **iPhone per Kabel verbinden** und am iPhone „Diesem Computer vertrauen“ bestätigen.
4. **Sideloadly öffnen:** `Fightclub.ipa` hineinziehen, deine Apple-ID eintragen und auf *Start* klicken.
5. **Am iPhone freigeben:**
   - *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* einschalten (iPhone startet neu).
   - *Einstellungen → Allgemein → VPN & Geräteverwaltung* → deine Apple-ID → **Vertrauen**.
6. Fightclub auf dem Home-Bildschirm öffnen. 🎉

**Wichtig bei einer kostenlosen Apple-ID:** Die App läuft **7 Tage** und muss danach über Sideloadly erneut installiert werden. Deine Daten bleiben dabei erhalten, solange du die App nicht vorher löschst. In Sideloadly kannst du unter *Advanced Options* die automatische Verlängerung per WLAN aktivieren, solange der PC läuft.

Mit einem kostenpflichtigen Apple-Developer-Account (99 €/Jahr) läuft die App ein Jahr lang und kann über TestFlight installiert werden. Das lässt sich später ebenfalls komplett über GitHub Actions einrichten.

## Starten mit Xcode (Mac)

Voraussetzungen: Xcode 16 oder neuer, iOS 17 oder neuer.

1. `Fightclub.xcodeproj` in Xcode öffnen.
2. Unter *Signing & Capabilities* dein Team auswählen (für ein echtes iPhone), ggf. den Bundle Identifier `com.fightclub.app` anpassen.
3. Einen Simulator oder dein iPhone auswählen und mit ⌘R starten.

Beim ersten Start kannst du über „Beispielpläne anlegen“ direkt Push, Pull und Beine mit typischen Übungen erstellen.

## Projektstruktur

```
web/                            Web-App (PWA): index.html, app.js, styles.css, Service Worker
Fightclub/
├── FightclubApp.swift          App-Einstieg und SwiftData-Container
├── Models/Models.swift         Datenmodelle (Plan, Übung, Training, Satz, Körpergewicht)
├── Utilities/                  Farben, Formatierung, Trainingslogik, Beispieldaten
└── Views/
    ├── Plans/                  Trainingspläne und Übungen
    ├── Workout/                Training erfassen (Sätze, kg, Wiederholungen)
    ├── Calendar/               Kalender mit Planfarben
    ├── Progress/               Fortschrittsdiagramme pro Übung
    ├── BodyWeight/             Körpergewicht mit Diagramm
    └── Components/             Wiederverwendbare Bausteine
```
