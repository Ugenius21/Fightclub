# Fightclub 🥊

Fightclub ist eine iOS-App, mit der du deinen Fortschritt im Krafttraining und dein Körpergewicht verfolgst.

## 📱 Aufs iPhone – der einfache Weg (Web-App, empfohlen)

Im Ordner `docs/` liegt Fightclub als **Web-App**. Du öffnest sie einmal in Safari und legst sie auf den Home-Bildschirm. Danach startet sie wie eine normale App: Vollbild, eigenes Icon, funktioniert auch offline. Du brauchst keinen Mac, kein Kabel und keine Apple-ID, und sie läuft nicht nach 7 Tagen ab.

**Einmalig online stellen (GitHub Pages):**

1. Auf GitHub im Repository → *Settings* → *General* → ganz unten *Change visibility* → **Public**.
   (GitHub Pages ist für private Repos nur mit GitHub Pro kostenlos. Deine Trainingsdaten landen **nicht** im Repo, sie bleiben nur auf deinem iPhone.)
2. *Settings* → *Pages* → bei *Build and deployment* „Deploy from a branch“ wählen → Branch mit dem `docs`-Ordner auswählen (z. B. `claude/compassionate-fermat-4ojspf` oder nach dem Mergen den Hauptbranch) → Ordner **/docs** → *Save*.
3. Nach ca. 1 Minute steht oben die Adresse, z. B. `https://ugenius21.github.io/Fightclub/`.

*Alternative, falls das Repo privat bleiben soll:* den Ordner `docs` auf [app.netlify.com/drop](https://app.netlify.com/drop) ziehen. Du bekommst sofort eine Adresse.

**Auf dem iPhone 15 Pro installieren:**

1. Die Adresse in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → *Hinzufügen*.
3. Fightclub über das neue Icon starten. Fertig. 🥊

**Deine Daten:** Alles wird lokal auf dem iPhone gespeichert. Unter *Pläne → Daten* kannst du eine **Sicherung exportieren** (z. B. in die Dateien-App oder iCloud Drive) und sie wieder importieren. Wichtig: Wenn du das Icon vom Home-Bildschirm löschst, sind die Daten weg. Mach also ab und zu eine Sicherung.

## Funktionen

- **Trainingspläne**: Lege Pläne wie „Push“, „Pull“ oder „Beine“ an. Jeder Plan hat eine eigene Farbe.
- **Übungen**: Füge einem Plan mit einem Tipp Übungen hinzu (z. B. Bankdrücken, Butterfly). Du kannst sie umbenennen, löschen und per „Bearbeiten“ neu anordnen.
- **Training erfassen**: Jede Übung besteht aus Sätzen mit **Satz · Gewicht (kg) · Wiederholungen**. Mit „Satz hinzufügen“ legst du einen weiteren Satz an; die Werte des vorherigen Satzes werden dabei übernommen.
- **Werte vom letzten Training**: Beim Start eines Trainings werden alle Sätze mit den Werten vom letzten Mal vorbelegt. Unter jeder Übung steht außerdem, was du beim letzten Training geschafft hast.
- **Fortschritt**: Ein Diagramm zeigt die Steigerung pro Übung als maximales Gewicht, geschätztes 1RM oder Volumen, dazu Start, Aktuell, Bestwert und Steigerung.
- **Kalender**: Trainingstage werden in der Farbe des jeweiligen Plans ausgefüllt (z. B. Push = Rot, Beine = Blau). Hast du an einem Tag mehrere Pläne trainiert, wird das Feld geteilt. Über den Kalender kannst du auch vergangene Trainings nachtragen.
- **Körpergewicht**: Trage dein Gewicht ein und sieh dir den Verlauf im Diagramm an (1M / 3M / 6M / 1J / Alle).

Alle Daten werden lokal auf dem Gerät gespeichert (Web-App: im Browser-Speicher, native App: SwiftData).

## Voraussetzungen

- Xcode 16 oder neuer
- iOS 17 oder neuer

## Native iOS-App (optional, aufwendiger)

Zusätzlich gibt es Fightclub als native SwiftUI-App. Die Installation ist deutlich umständlicher. Für den Alltag reicht die Web-App oben.

### Installation ohne Mac (Windows-PC)

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

### Starten mit Xcode (Mac)

1. `Fightclub.xcodeproj` in Xcode öffnen.
2. Unter *Signing & Capabilities* dein Team auswählen (für ein echtes iPhone), ggf. den Bundle Identifier `com.fightclub.app` anpassen.
3. Einen Simulator oder dein iPhone auswählen und mit ⌘R starten.

Beim ersten Start kannst du über „Beispielpläne anlegen“ direkt Push, Pull und Beine mit typischen Übungen erstellen.

## Projektstruktur

```
docs/                           Web-App (index.html, app.js, style.css, Service Worker, Icons)
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
