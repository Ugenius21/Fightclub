import SwiftUI
import SwiftData

@main
struct FightclubApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.locale, .app)
        }
        .modelContainer(for: [
            WorkoutPlan.self,
            Exercise.self,
            WorkoutSession.self,
            ExerciseEntry.self,
            SetEntry.self,
            BodyWeightEntry.self,
        ])
    }
}
