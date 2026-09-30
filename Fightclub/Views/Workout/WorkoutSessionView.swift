import SwiftUI
import SwiftData

/// Erfassen bzw. Bearbeiten eines Trainings.
struct WorkoutSessionView: View {
    @Bindable var session: WorkoutSession
    /// `true`, wenn das Training gerade gestartet wurde (Vollbild mit "Abbrechen"/"Fertig").
    let isNew: Bool

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var showingAddExercise = false
    @State private var showingDiscardDialog = false
    @State private var showingDeleteDialog = false

    var body: some View {
        List {
            Section {
                HStack(spacing: 10) {
                    PlanColorDot(hex: session.displayColorHex, size: 16)
                    Text(session.displayName)
                        .font(.headline)
                }
                DatePicker("Datum", selection: $session.date, displayedComponents: [.date, .hourAndMinute])
            }

            ForEach(session.sortedEntries) { entry in
                ExerciseEntrySection(entry: entry, session: session)
            }

            Section {
                Button {
                    showingAddExercise = true
                } label: {
                    Label("Übung hinzufügen", systemImage: "plus.circle.fill")
                }
            }

            if !isNew {
                Section {
                    Button("Training löschen", role: .destructive) {
                        showingDeleteDialog = true
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(isNew ? "Training" : Format.shortDate(session.date))
        .navigationBarTitleDisplayMode(.inline)
        .keyboardDoneButton()
        .toolbar {
            if isNew {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { showingDiscardDialog = true }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig", action: finish)
                        .fontWeight(.semibold)
                }
            }
        }
        .onDisappear {
            if !isNew { try? context.save() }
        }
        .sheet(isPresented: $showingAddExercise) {
            AddExerciseSheet(
                title: "Übung hinzufügen",
                planToggleLabel: session.plan.map { "Auch zum Plan „\($0.name)“ hinzufügen" }
            ) { name, addToPlan in
                let order = (session.sortedEntries.last?.order ?? -1) + 1
                WorkoutHistory.addEntry(named: name, order: order, to: session, in: context)
                if addToPlan, let plan = session.plan {
                    plan.exercises.append(Exercise(name: name, order: (plan.sortedExercises.last?.order ?? -1) + 1))
                }
            }
        }
        .confirmationDialog("Training verwerfen?", isPresented: $showingDiscardDialog, titleVisibility: .visible) {
            Button("Training verwerfen", role: .destructive, action: deleteSession)
        } message: {
            Text("Alle Eingaben dieses Trainings gehen verloren.")
        }
        .confirmationDialog("Training löschen?", isPresented: $showingDeleteDialog, titleVisibility: .visible) {
            Button("Löschen", role: .destructive, action: deleteSession)
        }
    }

    /// Schließt zuerst die Ansicht und löscht das Training danach,
    /// damit die Ansicht nicht mehr auf ein gelöschtes Objekt zugreift.
    private func deleteSession() {
        let target = session
        let modelContext = context
        dismiss()
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(500))
            modelContext.delete(target)
            try? modelContext.save()
        }
    }

    private func finish() {
        WorkoutHistory.cleanUp(session, in: context)
        try? context.save()
        dismiss()
    }
}

/// Eine Übung mit ihren Sätzen (Satz · kg · Wiederholungen).
struct ExerciseEntrySection: View {
    @Bindable var entry: ExerciseEntry
    let session: WorkoutSession

    @Environment(\.modelContext) private var context
    @State private var previous: (date: Date, sets: String)?

    var body: some View {
        Section {
            HStack {
                Text("Satz").frame(width: 44)
                Text("kg").frame(maxWidth: .infinity)
                Text("Wdh.").frame(maxWidth: .infinity)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)

            ForEach(entry.sortedSets) { setEntry in
                SetRow(item: setEntry)
            }
            .onDelete { offsets in
                let sorted = entry.sortedSets
                for index in offsets {
                    WorkoutHistory.delete(sorted[index], from: entry, in: context)
                }
            }

            Button {
                withAnimation { WorkoutHistory.addSet(to: entry) }
            } label: {
                Label("Satz hinzufügen", systemImage: "plus")
                    .font(.subheadline.weight(.medium))
            }
        } header: {
            HStack {
                Text(entry.exerciseName)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .textCase(nil)
                Spacer()
                Menu {
                    Button(role: .destructive) {
                        withAnimation { WorkoutHistory.delete(entry, from: session, in: context) }
                    } label: {
                        Label("Übung aus Training entfernen", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.body)
                }
            }
        } footer: {
            if let previous {
                Label("Letztes Mal (\(Format.dayMonth(previous.date))): \(previous.sets) kg", systemImage: "clock.arrow.circlepath")
            } else {
                Text("Erstes Training dieser Übung")
            }
        }
        .task(id: entry.exerciseName) {
            if let last = WorkoutHistory.lastEntry(
                for: entry.exerciseName,
                before: session.date,
                excluding: session,
                in: context
            ), let date = last.session?.date {
                previous = (date, Format.sets(last.completedSets))
            } else {
                previous = nil
            }
        }
    }
}

private struct SetRow: View {
    @Bindable var item: SetEntry

    var body: some View {
        HStack(spacing: 12) {
            Text("\(item.setNumber)")
                .font(.headline.monospacedDigit())
                .frame(width: 32, height: 32)
                .background(Color(.secondarySystemFill), in: Circle())
                .frame(width: 44)

            NumberField(placeholder: "0", value: $item.weight)
                .frame(maxWidth: .infinity)

            NumberField(
                placeholder: "0",
                value: Binding(
                    get: { Double(item.reps) },
                    set: { item.reps = Int(min(max($0, 0), 9999)) }
                ),
                allowsDecimals: false
            )
            .frame(maxWidth: .infinity)
        }
    }
}
