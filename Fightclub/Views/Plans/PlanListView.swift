import SwiftUI
import SwiftData

struct PlanListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \WorkoutPlan.createdAt) private var plans: [WorkoutPlan]

    @State private var showingNewPlan = false
    @State private var planToDelete: WorkoutPlan?
    @State private var activeSession: WorkoutSession?

    var body: some View {
        NavigationStack {
            Group {
                if plans.isEmpty {
                    emptyState
                } else {
                    planList
                }
            }
            .navigationTitle("Fightclub")
            .navigationDestination(for: WorkoutPlan.self) { plan in
                PlanDetailView(plan: plan)
            }
            .navigationDestination(for: WorkoutSession.self) { session in
                WorkoutSessionView(session: session, isNew: false)
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingNewPlan = true
                    } label: {
                        Label("Neuer Trainingsplan", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingNewPlan) {
                PlanEditorView(plan: nil)
            }
            .fullScreenCover(item: $activeSession) { session in
                NavigationStack {
                    WorkoutSessionView(session: session, isNew: true)
                }
            }
            .confirmationDialog(
                "Trainingsplan löschen?",
                isPresented: Binding(
                    get: { planToDelete != nil },
                    set: { if !$0 { planToDelete = nil } }
                ),
                titleVisibility: .visible,
                presenting: planToDelete
            ) { plan in
                Button("„\(plan.name)“ löschen", role: .destructive) {
                    context.delete(plan)
                    planToDelete = nil
                }
            } message: { _ in
                Text("Bereits absolvierte Trainings bleiben im Kalender und im Fortschritt erhalten.")
            }
        }
    }

    private var planList: some View {
        List {
            Section {
                ForEach(plans) { plan in
                    NavigationLink(value: plan) {
                        PlanRow(plan: plan)
                    }
                    .swipeActions(edge: .leading) {
                        Button {
                            activeSession = WorkoutHistory.startSession(for: plan, in: context)
                        } label: {
                            Label("Starten", systemImage: "play.fill")
                        }
                        .tint(Color(hex: plan.colorHex))
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            planToDelete = plan
                        } label: {
                            Label("Löschen", systemImage: "trash")
                        }
                    }
                }
            } header: {
                Text("Trainingspläne")
            } footer: {
                Text("Wische nach rechts, um ein Training direkt zu starten.")
            }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Noch keine Trainingspläne", systemImage: "dumbbell")
        } description: {
            Text("Erstelle deinen ersten Trainingsplan, z. B. „Push“, und füge die passenden Übungen hinzu.")
        } actions: {
            Button("Trainingsplan erstellen") { showingNewPlan = true }
                .buttonStyle(.borderedProminent)
            Button("Beispielpläne anlegen (Push, Pull, Beine)") {
                SampleData.insertPlans(into: context)
            }
        }
    }
}

private struct PlanRow: View {
    let plan: WorkoutPlan

    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(hex: plan.colorHex))
                .frame(width: 44, height: 44)
                .overlay {
                    Text(plan.name.prefix(1).uppercased())
                        .font(.title3.bold())
                        .foregroundStyle(Color.readableText(onHex: plan.colorHex))
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(plan.name)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var subtitle: String {
        let count = plan.exercises.count
        let exercises = count == 1 ? "1 Übung" : "\(count) Übungen"
        if let last = plan.lastSession {
            return "\(exercises) · zuletzt am \(Format.dayMonth(last.date))"
        }
        return exercises
    }
}
