import Foundation
import SwiftData

/// Hilfsfunktionen rund um den Trainingsverlauf.
enum WorkoutHistory {
    static func normalized(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .app)
    }

    /// Findet den letzten Eintrag einer Übung (über alle Pläne hinweg),
    /// der vor `date` stattgefunden hat und nicht zu `excluded` gehört.
    static func lastEntry(
        for exerciseName: String,
        before date: Date = .distantFuture,
        excluding excluded: WorkoutSession? = nil,
        in context: ModelContext
    ) -> ExerciseEntry? {
        let key = normalized(exerciseName)
        let entries = (try? context.fetch(FetchDescriptor<ExerciseEntry>())) ?? []
        return entries
            .filter { entry in
                guard let session = entry.session else { return false }
                if let excluded, session.persistentModelID == excluded.persistentModelID { return false }
                return session.date < date
                    && !entry.completedSets.isEmpty
                    && normalized(entry.exerciseName) == key
            }
            .max { ($0.session?.date ?? .distantPast) < ($1.session?.date ?? .distantPast) }
    }

    /// Legt ein neues Training für einen Plan an. Die Sätze jeder Übung werden
    /// mit den Werten des letzten Trainings dieser Übung vorbelegt.
    @discardableResult
    static func startSession(for plan: WorkoutPlan, date: Date = .now, in context: ModelContext) -> WorkoutSession {
        let session = WorkoutSession(date: date, planName: plan.name, colorHex: plan.colorHex)
        context.insert(session)
        session.plan = plan
        for (index, exercise) in plan.sortedExercises.enumerated() {
            addEntry(named: exercise.name, order: index, to: session, in: context)
        }
        return session
    }

    @discardableResult
    static func addEntry(named name: String, order: Int, to session: WorkoutSession, in context: ModelContext) -> ExerciseEntry {
        let entry = ExerciseEntry(exerciseName: name, order: order)
        session.entries.append(entry)

        if let last = lastEntry(for: name, before: session.date, excluding: session, in: context) {
            for (index, set) in last.completedSets.enumerated() {
                entry.sets.append(SetEntry(setNumber: index + 1, weight: set.weight, reps: set.reps))
            }
        }
        if entry.sets.isEmpty {
            entry.sets.append(SetEntry(setNumber: 1, weight: 0, reps: 0))
        }
        return entry
    }

    static func addSet(to entry: ExerciseEntry) {
        let last = entry.sortedSets.last
        entry.sets.append(
            SetEntry(
                setNumber: (last?.setNumber ?? 0) + 1,
                weight: last?.weight ?? 0,
                reps: last?.reps ?? 0
            )
        )
    }

    static func delete(_ set: SetEntry, from entry: ExerciseEntry, in context: ModelContext) {
        entry.sets.removeAll { $0.persistentModelID == set.persistentModelID }
        context.delete(set)
        for (index, remaining) in entry.sortedSets.enumerated() {
            remaining.setNumber = index + 1
        }
    }

    static func delete(_ entry: ExerciseEntry, from session: WorkoutSession, in context: ModelContext) {
        session.entries.removeAll { $0.persistentModelID == entry.persistentModelID }
        context.delete(entry)
        for (index, remaining) in session.sortedEntries.enumerated() {
            remaining.order = index
        }
    }

    /// Entfernt leere Sätze (0 kg und 0 Wiederholungen) und Übungen ohne Sätze.
    static func cleanUp(_ session: WorkoutSession, in context: ModelContext) {
        for entry in session.entries {
            for set in entry.sets where set.weight == 0 && set.reps == 0 {
                delete(set, from: entry, in: context)
            }
            if entry.sets.isEmpty {
                delete(entry, from: session, in: context)
            }
        }
    }

    /// Benennt eine Übung um – auch im bisherigen Verlauf, damit der Fortschritt erhalten bleibt.
    static func rename(_ exercise: Exercise, to newName: String, in context: ModelContext) {
        let oldKey = normalized(exercise.name)
        exercise.name = newName
        let entries = (try? context.fetch(FetchDescriptor<ExerciseEntry>())) ?? []
        for entry in entries where normalized(entry.exerciseName) == oldKey {
            entry.exerciseName = newName
        }
    }
}
