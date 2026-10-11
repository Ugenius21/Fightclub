# Fightclub 🥊

Fightclub ist eine Fitness-App im Comic-Look. Damit verfolgst du deinen Fortschritt im Krafttraining, dein Körpergewicht und deine Ernährung.

## Funktionen

- **Trainingspläne** wie „Push“, „Pull“ oder „Beine“, jeder mit eigener Farbe. Mit „Start!“ geht das Training direkt los.
- **Übungen** fügst du mit einem Tipp hinzu, auch mehrere hintereinander. Die Reihenfolge änderst du per Ziehen am Griff ≡.
- **Training erfassen**: Satz · Gewicht (kg) · Wiederholungen. Eingegeben wird über ein eigenes großes Zahlenfeld mit ±2,5-kg- und ±1-Wdh.-Tasten und „Weiter“ zum nächsten Feld. Die iOS-Tastatur mit dem blauen Markierungskasten erscheint dabei nicht. „＋ Satz“ legt einen weiteren Satz mit den gleichen Werten an. Mit ✓ hakst du einen Satz ab („POW!“), dann startet automatisch der Pausen-Timer.
- **Trainings-Timer** ⏱: startet automatisch mit „Start!“. Er ist als große Stoppuhr oben immer sichtbar, lässt sich pausieren und läuft auch weiter, wenn du die App zwischendurch schließt. Die Trainingszeit (ohne Pausen) wird gespeichert und im K.O.-Bildschirm, im Kalender und im Excel-Export angezeigt. Bei nachgetragenen Trainings startest du den Timer bei Bedarf selbst.
- **Werte vom letzten Training** sind vorausgefüllt (grau, bis du sie änderst oder abhakst). Darunter steht, was du letztes Mal geschafft hast.
- **Maschine besetzt?** ⏭ schiebt die Übung ans Ende. Über ⇅ sortierst du das ganze Training um, auf Wunsch auch dauerhaft im Plan.
- **Notizen pro Übung** 📝: eine dauerhafte Notiz (z. B. Sitzposition, Einstellung) und eine Notiz für heute (z. B. Muskelgefühl). Die Notiz von heute siehst du beim nächsten Mal unter „Letztes Mal“.
- **K.O.-Bildschirm** nach dem Training mit Sätzen, Volumen, Dauer und **neuen Rekorden** 🏆.
- **Fortschritt**: Diagramm pro Übung (max. Gewicht, geschätztes 1RM oder Volumen) mit Start, Aktuell, Bestwert und Steigerung.
- **Kalender**: Trainingstage in der Farbe des Plans (z. B. Push = Rot, Beine = Blau). Hier kannst du auch Trainings nachtragen.
- **Körpergewicht** mit Diagramm (1M / 3M / 6M / 1J / Alle), unter *Fortschritt → ⚖️ Gewicht*.
- **Ernährung** als eigener Bereich wie bei MyFitnessPal: Kalorien-Tagebuch mit Mahlzeiten, **Strichcode-Scanner**, Lebensmittelsuche und Tageszielen (siehe unten).
- **Excel-Export** (.xlsx) aller Daten zur Auswertung.
- **Login per E-Mail**, damit dein Stand auf allen Geräten synchron ist (siehe unten).

## 📱 Aufs iPhone (Web-App)

Im Ordner `docs/` liegt Fightclub als **Web-App**. Du öffnest sie einmal in Safari und legst sie auf den Home-Bildschirm. Danach startet sie wie eine normale App: Vollbild, eigenes Icon, funktioniert auch offline. Du brauchst keinen Mac, kein Kabel und keine Apple-ID.

**Einmalig online stellen (GitHub Pages):**

1. Auf GitHub im Repository → *Settings* → *General* → ganz unten *Change visibility* → **Public**.
   (GitHub Pages ist für private Repos nur mit GitHub Pro kostenlos. Deine Trainingsdaten landen **nicht** im Repo.)
2. *Settings* → *Pages* → bei *Build and deployment* „Deploy from a branch“ wählen → Branch mit dem `docs`-Ordner auswählen (z. B. `claude/compassionate-fermat-4ojspf` oder nach dem Mergen den Hauptbranch) → Ordner **/docs** → *Save*.
3. Nach ca. 1 Minute steht oben die Adresse, z. B. `https://ugenius21.github.io/Fightclub/`.

*Alternative, falls das Repo privat bleiben soll:* den Ordner `docs` auf [app.netlify.com/drop](https://app.netlify.com/drop) ziehen. Du bekommst sofort eine Adresse.

**Auf dem iPhone 15 Pro installieren:**

1. Die Adresse in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → *Hinzufügen*.
3. Fightclub über das neue Icon starten. Fertig. 🥊

Updates kommen automatisch: Nach einer Änderung im Repo lädt die App beim nächsten Öffnen die neue Version.

## 🔐 Login per E-Mail & Synchronisierung (einmalig einrichten)

Ohne Einrichtung funktioniert die App normal, die Daten liegen dann nur auf dem jeweiligen Gerät. Für Login und Sync dient ein kostenloses [Supabase](https://supabase.com)-Projekt als Online-Speicher. Die Einrichtung dauert einmalig etwa 10 Minuten und geht am bequemsten am PC.

**Teil A – Supabase einrichten**

1. Auf [supabase.com](https://supabase.com) → **Start your project** → kostenlos registrieren (z. B. mit deinem GitHub-Konto).
2. **New project**: Name z. B. `fightclub`, ein Datenbank-Passwort vergeben (brauchst du später nicht), Region **Frankfurt (eu-central-1)** → **Create new project**. Ca. 1–2 Minuten warten.
3. Links **SQL Editor** → **New query** → den kompletten Inhalt von [`supabase/setup.sql`](supabase/setup.sql) hineinkopieren → **Run**. Es sollte „Success“ erscheinen. Damit ist die Tabelle für deine Daten angelegt, und jeder Benutzer sieht nur seine eigenen Daten.
4. Links **Authentication → Sign In / Providers → Email**: **„Confirm email“ ausschalten** → *Save*. *(Empfohlen: Dann brauchst du keine Bestätigungs-Mail und bist nach dem Registrieren sofort angemeldet.)*
5. **Authentication → URL Configuration** → bei **Site URL** die Adresse deiner App eintragen, z. B. `https://ugenius21.github.io/Fightclub/` → *Save*. Dorthin führt der Link aus der „Passwort vergessen“-Mail.
6. Zahnrad **Project Settings → API Keys** (bzw. *Data API*): zwei Werte kopieren:
   - **Project URL**, z. B. `https://abcdefgh.supabase.co`
   - **anon public key** (beginnt mit `eyJ…`) bzw. **publishable key** (beginnt mit `sb_publishable_…`)
   
   ⚠️ Niemals den **service_role**- bzw. **secret**-Key verwenden.

**Teil B – Werte in die App eintragen**

7. Auf GitHub die Datei [`docs/config.js`](docs/config.js) öffnen → Stift-Symbol (*Edit*) → die beiden Werte zwischen die Anführungszeichen setzen → **Commit changes**:
   ```js
   window.FIGHTCLUB_CONFIG = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseKey: 'eyJhbGciOi…',
   };
   ```
   Der anon-/publishable-Key darf öffentlich im Repo stehen. Er erlaubt nur das, was die Regeln aus `setup.sql` zulassen.
8. Nach ca. 1 Minute ist GitHub Pages aktualisiert. Fightclub auf dem iPhone **komplett schließen** (vom unteren Rand nach oben wischen und die App wegschieben) und neu öffnen.

**Teil C – Anmelden**

9. In der App **Profil** → E-Mail-Adresse und ein Passwort (mind. 6 Zeichen) eintippen → **Neues Konto erstellen**. Fertig: oben steht deine E-Mail mit grünem Punkt „Synchronisiert“.
10. Auf jedem weiteren Gerät (iPad, zweites Handy, PC-Browser): App öffnen → **Profil** → dieselbe E-Mail und dasselbe Passwort → **Anmelden**. Deine Daten erscheinen automatisch.

Mit **Profil → 🔍 Verbindung prüfen** zeigt die App Schritt für Schritt, ob alles stimmt (Key, Tabelle, Anmeldung) und was ggf. fehlt.

Die App synchronisiert automatisch nach jeder Änderung und beim Öffnen. Offline wird lokal gespeichert und später abgeglichen. Bearbeitest du auf zwei Geräten verschiedene Einträge, bleiben beide erhalten. Beim gleichen Eintrag gewinnt die neuere Änderung. Bereits vorhandene Daten auf dem iPhone werden bei der ersten Anmeldung mit hochgeladen.

*Hinweise:* Lässt du „Confirm email“ eingeschaltet, kommt nach dem Registrieren eine Mail. Den Link darin antippen, danach in der App mit E-Mail und Passwort **Anmelden**. Kostenlose Supabase-Projekte werden nach ca. einer Woche **ohne jede Nutzung** pausiert und lassen sich im Dashboard mit einem Klick wieder starten. Wer regelmäßig trainiert, merkt davon nichts.

## 🍎 Ernährung

Ein eigener Bereich (Tab **Ernährung**, grüne Kopfzeile) zum Kalorienzählen wie bei MyFitnessPal:

- **Tagebuch** mit Frühstück, Mittagessen, Abendessen und Snacks, oben die Bilanz **Ziel − Essen = Übrig** sowie Balken für Eiweiß, Kohlenhydrate und Fett. Mit ‹ › oder durch Tippen aufs Datum wechselst du den Tag.
- **📷 Strichcode scannen:** Die Kamera erkennt den Strichcode auf der Verpackung. Die Nährwerte kommen aus [Open Food Facts](https://world.openfoodfacts.org), einer freien Datenbank mit sehr vielen deutschen Produkten. Danach nur noch die Menge wählen (Portion, 50 g, 100 g … oder eintippen) und **Hinzufügen**. Klappt die Live-Kamera nicht, geht es auch per **Foto** oder durch **Eintippen** der Ziffern.
- **Unbekanntes Produkt?** Einmal selbst anlegen: Eiweiß, Kohlenhydrate und Fett pro 100 g von der Verpackung eintragen, die Kalorien rechnet die App aus (Eiweiß und Kohlenhydrate × 4, Fett × 9 kcal/g). Beim nächsten Scan wird es sofort erkannt, auch offline und auf allen Geräten.
- **Suche:** Zuerst deine eigenen und zuletzt gegessenen Lebensmittel (sofort, offline), mit 🔍 zusätzlich online in Open Food Facts.
- **Zuletzt gegessen** mit einem Tipp erneut eintragen, **„Wie gestern übernehmen“** für eine ganze Mahlzeit, **⚡ Schnell-Eintrag**: nur die Makros eintippen, die Kalorien werden berechnet.
- **Ziele:** Auf die Bilanz tippen und die Makroziele eintragen, das Kalorienziel ergibt sich daraus.
- **Statistik:** 14-Tage-Diagramm, Durchschnittswerte und die Verteilung von Eiweiß, Kohlenhydraten und Fett.
- **Produkte:** Deine eigenen und gescannten Lebensmittel verwalten.

Die Kamera fragt beim ersten Scan nach Erlaubnis. Wurde sie abgelehnt: *iPhone-Einstellungen → Safari → Kamera → Fragen/Erlauben*. Die Strichcode-Erkennung läuft komplett auf dem iPhone. Nur das Nachschlagen eines neuen Produkts braucht Internet.

## 📊 Excel

**Profil → Excel-Export (.xlsx)** erstellt eine Excel-Datei. Am iPhone kannst du sie direkt in Excel öffnen, in der Dateien-App speichern oder per Mail verschicken. Enthalten sind folgende Tabellenblätter:

| Blatt | Inhalt |
|---|---|
| Sätze | Jeder einzelne Satz: Datum, Plan, Übung, Satz, Gewicht, Wiederholungen, Volumen, geschätztes 1RM, Notiz |
| Übungen | Pro Training und Übung: Sätze, max. Gewicht, Wdh. gesamt, Volumen, bestes 1RM |
| Trainings | Pro Training: Plan, Anzahl Übungen/Sätze, Volumen, Dauer |
| Körpergewicht | Datum, Gewicht |
| Ernährung | Pro Tag: Kalorien, Eiweiß, Kohlenhydrate, Fett |
| Mahlzeiten | Jeder Eintrag: Datum, Mahlzeit, Lebensmittel, Marke, Menge, Kalorien, Makros |
| Notizen | Dauerhafte Notizen pro Übung |

Datumswerte sind echte Excel-Daten. Filter und fixierte Kopfzeile sind schon gesetzt, sodass du direkt Pivot-Tabellen oder Diagramme bauen kannst.

## 💾 Sicherung

Unter **Profil → Sicherung exportieren** speicherst du alle Daten als JSON-Datei (z. B. in iCloud Drive). Beim Import wird die Sicherung mit den vorhandenen Daten zusammengeführt. Ohne Login gilt: Wenn du das Icon vom Home-Bildschirm löschst, sind die Daten auf dem iPhone weg. Mach dann ab und zu eine Sicherung.

## Native iOS-App (optional, aufwendiger)

Zusätzlich gibt es Fightclub als native SwiftUI-App mit dem ursprünglichen Funktionsumfang (Pläne, Training, Kalender, Fortschritt, Körpergewicht). Die neuen Funktionen der Web-App (Comic-Design, Login & Sync, Ernährung mit Scanner, Excel) gibt es nur in der Web-App. Die Installation ist deutlich umständlicher.

Voraussetzungen: Xcode 16 oder neuer, iOS 17 oder neuer.

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
docs/                           Web-App
├── index.html, style.css, app.js  Oberfläche (Comic-Design, Ansichten, Zahlenfeld)
├── config.js                     Supabase-Zugangsdaten für Login & Sync
├── js/data.js                    Datenmodell & Zusammenführen für den Sync
├── js/sync.js                    Login per E-Mail + Synchronisierung (Supabase REST)
├── js/xlsx.js                    Excel-Export ohne externe Bibliothek
├── js/food.js                    Ernährung: Tagebuch, Suche, Open Food Facts
├── js/scanner.js                 Strichcode-Scanner (Kamera/Foto)
├── vendor/                       Strichcode-Erkennung (barcode-detector + ZXing-C++ WebAssembly, MIT/Apache-2.0)
└── fonts/                        Bangers & Comic Neue (SIL Open Font License)
design/icon.svg                 Vorlage für das App-Icon (Seife im Comic-Look)
supabase/setup.sql              Tabelle + Zugriffsregeln für den Sync
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
