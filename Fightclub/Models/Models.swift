import Foundation
import SwiftData

/// Ein Trainingsplan bzw. Trainingstag, z. B. "Push", "Pull" oder "Beine".
@Model
final class WorkoutPlan {
    var name: String = ""
    var colorHex: String = PlanColor.defaultHex
    var createdAt: Date = Date()

    @Relationship(deleteRule: .cascade, inverse: \Exercise.plan)
    var exercises: [Exercise] = []

    /// Beim Löschen eines Plans bleiben die absolvierten Trainings erhalten.
    @Relationship(deleteRule: .nullify, inverse: \WorkoutSession.plan)
    var sessions: [WorkoutSession] = []

    init(name: String, colorHex: String, createdAt: Date = .now) {
        self.name = name
        self.colorHex = colorHex
        self.createdAt = createdAt
    }

    var sortedExercises: [Exercise] {
        exercises.sorted { $0.order < $1.order }
    }

    var lastSession: WorkoutSession? {
        sessions.max { $0.date < $1.date }
    }
}

/// Eine Übung innerhalb eines Trainingsplans, z. B. "Bankdrücken".
@Model
final class Exercise {
    var name: String = ""
    var order: Int = 0
    var plan: WorkoutPlan?

    init(name: String, order: Int) {
        self.name = name
        self.order = order
    }
}

/// Ein absolviertes Training an einem bestimmten Tag.
@Model
final class WorkoutSession {
    var date: Date = Date()
    /// Name und Farbe werden gespeichert, damit das Training im Kalender
    /// auch dann noch korrekt angezeigt wird, wenn der Plan gelöscht wurde.
    var planName: String = ""
    var colorHex: String = PlanColor.defaultHex
    var plan: WorkoutPlan?

    @Relationship(deleteRule: .cascade, inverse: \ExerciseEntry.session)
    var entries: [ExerciseEntry] = []

    init(date: Date, planName: String, colorHex: String) {
        self.date = date
        self.planName = planName
        self.colorHex = colorHex
    }

    var displayName: String { plan?.name ?? planName }
    var displayColorHex: String { plan?.colorHex ?? colorHex }

    var sortedEntries: [ExerciseEntry] {
        entries.sorted { $0.order < $1.order }
    }
}

/// Eine Übung innerhalb eines absolvierten Trainings mit ihren Sätzen.
@Model
final class ExerciseEntry {
    var exerciseName: String = ""
    var order: Int = 0
    var session: WorkoutSession?

    @Relationship(deleteRule: .cascade, inverse: \SetEntry.entry)
    var sets: [SetEntry] = []

    init(exerciseName: String, order: Int) {
        self.exerciseName = exerciseName
        self.order = order
    }

    var sortedSets: [SetEntry] {
        sets.sorted { $0.setNumber < $1.setNumber }
    }

    /// Sätze, die tatsächlich ausgeführt wurden (mindestens eine Wiederholung).
    var completedSets: [SetEntry] {
        sortedSets.filter { $0.reps > 0 }
    }
}

/// Ein einzelner Satz: Gewicht in kg und Wiederholungen.
@Model
final class SetEntry {
    var setNumber: Int = 1
    var weight: Double = 0
    var reps: Int = 0
    var entry: ExerciseEntry?

    init(setNumber: Int, weight: Double, reps: Int) {
        self.setNumber = setNumber
        self.weight = weight
        self.reps = reps
    }
}

/// Ein Eintrag für das Körpergewicht.
@Model
final class BodyWeightEntry {
    var date: Date = Date()
    var weight: Double = 0

    init(date: Date, weight: Double) {
        self.date = date
        self.weight = weight
    }
}
