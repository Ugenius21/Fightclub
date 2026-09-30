# Fightclub 🥊

Fightclub ist eine iOS-App, mit der du deinen Fortschritt im Krafttraining und dein Körpergewicht verfolgst.

## Funktionen

- **Trainingspläne**: Lege Pläne wie „Push“, „Pull“ oder „Beine“ an. Jeder Plan hat eine eigene Farbe.
- **Übungen**: Füge einem Plan mit einem Tipp Übungen hinzu (z. B. Bankdrücken, Butterfly). Du kannst sie umbenennen, löschen und per „Bearbeiten“ neu anordnen.
- **Training erfassen**: Jede Übung besteht aus Sätzen mit **Satz · Gewicht (kg) · Wiederholungen**. Mit „Satz hinzufügen“ legst du einen weiteren Satz an; die Werte des vorherigen Satzes werden dabei übernommen.
- **Werte vom letzten Training**: Beim Start eines Trainings werden alle Sätze mit den Werten vom letzten Mal vorbelegt. Unter jeder Übung steht außerdem, was du beim letzten Training geschafft hast.
- **Fortschritt**: Ein Diagramm zeigt die Steigerung pro Übung als maximales Gewicht, geschätztes 1RM oder Volumen, dazu Start, Aktuell, Bestwert und Steigerung.
- **Kalender**: Trainingstage werden in der Farbe des jeweiligen Plans ausgefüllt (z. B. Push = Rot, Beine = Blau). Hast du an einem Tag mehrere Pläne trainiert, wird das Feld geteilt. Über den Kalender kannst du auch vergangene Trainings nachtragen.
- **Körpergewicht**: Trage dein Gewicht ein und sieh dir den Verlauf im Diagramm an (1M / 3M / 6M / 1J / Alle).

Alle Daten werden lokal auf dem Gerät gespeichert (SwiftData).

## Voraussetzungen

- Xcode 16 oder neuer
- iOS 17 oder neuer

## Starten

1. `Fightclub.xcodeproj` in Xcode öffnen.
2. Unter *Signing & Capabilities* dein Team auswählen (für ein echtes iPhone), ggf. den Bundle Identifier `com.fightclub.app` anpassen.
3. Einen Simulator oder dein iPhone auswählen und mit ⌘R starten.

Beim ersten Start kannst du über „Beispielpläne anlegen“ direkt Push, Pull und Beine mit typischen Übungen erstellen.

## Projektstruktur

```
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
