import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            PlanListView()
                .tabItem { Label("Training", systemImage: "dumbbell.fill") }

            TrainingCalendarView()
                .tabItem { Label("Kalender", systemImage: "calendar") }

            ExerciseProgressView()
                .tabItem { Label("Fortschritt", systemImage: "chart.line.uptrend.xyaxis") }

            BodyWeightView()
                .tabItem { Label("Körpergewicht", systemImage: "scalemass.fill") }
        }
    }
}
