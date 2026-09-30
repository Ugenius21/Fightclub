import SwiftUI
import SwiftData

/// Erstellt einen neuen Trainingsplan oder bearbeitet Name und Farbe eines bestehenden.
struct PlanEditorView: View {
    let plan: WorkoutPlan?

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var plans: [WorkoutPlan]

    @State private var name = ""
    @State private var colorHex = PlanColor.defaultHex
    @State private var didLoad = false

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("z. B. Push, Pull, Beine", text: $name)
                }

                Section {
                    ColorPalettePicker(hex: $colorHex)
                } header: {
                    Text("Farbe")
                } footer: {
                    Text("In dieser Farbe werden die Trainingstage im Kalender markiert.")
                }

                Section("Vorschau") {
                    HStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(hex: colorHex))
                            .frame(width: 36, height: 36)
                            .overlay {
                                Text("1")
                                    .font(.headline)
                                    .foregroundStyle(Color.readableText(onHex: colorHex))
                            }
                        Text(trimmedName.isEmpty ? "Trainingsplan" : trimmedName)
                            .font(.headline)
                    }
                }
            }
            .navigationTitle(plan == nil ? "Neuer Trainingsplan" : "Plan bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern", action: save)
                        .disabled(trimmedName.isEmpty)
                }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !didLoad else { return }
        didLoad = true
        if let plan {
            name = plan.name
            colorHex = plan.colorHex
        } else {
            colorHex = PlanColor.nextUnused(excluding: plans.map(\.colorHex))
        }
    }

    private func save() {
        if let plan {
            plan.name = trimmedName
            plan.colorHex = colorHex
            // Auch die gespeicherten Kopien in den Trainings aktualisieren,
            // damit der Kalender nach einem Löschen des Plans stimmt.
            for session in plan.sessions {
                session.planName = trimmedName
                session.colorHex = colorHex
            }
        } else {
            context.insert(WorkoutPlan(name: trimmedName, colorHex: colorHex))
        }
        try? context.save()
        dismiss()
    }
}
