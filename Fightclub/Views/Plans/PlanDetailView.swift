import SwiftUI
import SwiftData

struct PlanDetailView: View {
    @Bindable var plan: WorkoutPlan

    @Environment(\.modelContext) private var context

    @State private var showingEditor = false
    @State private var showingAddExercise = false
    @State private var activeSession: WorkoutSession?
    @State private var exerciseToRename: Exercise?
    @State private var renameText = ""

    private var recentSessions: [WorkoutSession] {
        Array(plan.sessions.sorted { $0.date > $1.date }.prefix(5))
    }

    var body: some View {
        List {
            Section {
                Button {
                    activeSession = WorkoutHistory.startSession(for: plan, in: context)
                } label: {
                    Label("Training starten", systemImage: "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: plan.colorHex))
                .foregroundStyle(Color.readableText(onHex: plan.colorHex))
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            Section {
                ForEach(plan.sortedExercises) { exercise in
                    PlanExerciseRow(exercise: exercise)
                        .contextMenu {
                            Button {
                                renameText = exercise.name
                                exerciseToRename = exercise
                            } label: {
                                Label("Umbenennen", systemImage: "pencil")
                            }
                            Button(role: .destructive) {
                                deleteExercise(exercise)
                            } label: {
                                Label("Aus Plan entfernen", systemImage: "trash")
                            }
                        }
                }
                .onDelete(perform: deleteExercises)
                .onMove(perform: moveExercises)

                Button {
                    showingAddExercise = true
                } label: {
                    Label("Übung hinzufügen", systemImage: "plus.circle.fill")
                }
            } header: {
                Text("Übungen")
            } footer: {
                if !plan.exercises.isEmpty {
                    Text("Beim Start eines Trainings werden die Werte vom letzten Mal übernommen.")
                }
            }

            if !recentSessions.isEmpty {
                Section("Letzte Trainings") {
                    ForEach(recentSessions) { session in
                        NavigationLink(value: session) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(Format.longDate(session.date))
                                Text(session.entries.count == 1 ? "1 Übung" : "\(session.entries.count) Übungen")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(plan.name)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    showingEditor = true
                } label: {
                    Label("Plan bearbeiten", systemImage: "paintpalette")
                }
                EditButton()
            }
        }
        .sheet(isPresented: $showingEditor) {
            PlanEditorView(plan: plan)
        }
        .sheet(isPresented: $showingAddExercise) {
            AddExerciseSheet(title: "Übung hinzufügen") { name, _ in
                plan.exercises.append(Exercise(name: name, order: (plan.sortedExercises.last?.order ?? -1) + 1))
            }
        }
        .fullScreenCover(item: $activeSession) { session in
            NavigationStack {
                WorkoutSessionView(session: session, isNew: true)
            }
        }
        .alert(
            "Übung umbenennen",
            isPresented: Binding(
                get: { exerciseToRename != nil },
                set: { if !$0 { exerciseToRename = nil } }
            )
        ) {
            TextField("Name", text: $renameText)
            Button("Abbrechen", role: .cancel) { exerciseToRename = nil }
            Button("Sichern") {
                let name = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
                if let exercise = exerciseToRename, !name.isEmpty {
                    WorkoutHistory.rename(exercise, to: name, in: context)
                }
                exerciseToRename = nil
            }
        } message: {
            Text("Der bisherige Verlauf wird ebenfalls umbenannt.")
        }
    }

    private func deleteExercise(_ exercise: Exercise) {
        plan.exercises.removeAll { $0.persistentModelID == exercise.persistentModelID }
        context.delete(exercise)
        renumber(plan.sortedExercises)
    }

    private func deleteExercises(at offsets: IndexSet) {
        let sorted = plan.sortedExercises
        for index in offsets {
            deleteExercise(sorted[index])
        }
    }

    private func moveExercises(from source: IndexSet, to destination: Int) {
        var sorted = plan.sortedExercises
        sorted.move(fromOffsets: source, toOffset: destination)
        renumber(sorted)
    }

    private func renumber(_ exercises: [Exercise]) {
        for (index, exercise) in exercises.enumerated() {
            exercise.order = index
        }
    }
}

private struct PlanExerciseRow: View {
    let exercise: Exercise

    @Environment(\.modelContext) private var context
    @State private var lastSummary: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(exercise.name)
            if let lastSummary {
                Text(lastSummary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .task(id: exercise.name) {
            if let last = WorkoutHistory.lastEntry(for: exercise.name, in: context),
               let date = last.session?.date {
                lastSummary = "Zuletzt \(Format.dayMonth(date)): \(Format.sets(last.completedSets)) kg"
            } else {
                lastSummary = nil
            }
        }
    }
}
