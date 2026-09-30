import SwiftUI
import SwiftData
import UIKit

/// Farbiger Punkt für einen Trainingsplan.
struct PlanColorDot: View {
    let hex: String
    var size: CGFloat = 14

    var body: some View {
        Circle()
            .fill(Color(hex: hex))
            .frame(width: size, height: size)
    }
}

/// Auswahl einer Planfarbe aus der Palette oder über den Farbwähler.
struct ColorPalettePicker: View {
    @Binding var hex: String

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 5)

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(PlanColor.palette, id: \.hex) { color in
                    Button {
                        hex = color.hex
                    } label: {
                        Circle()
                            .fill(Color(hex: color.hex))
                            .frame(width: 40, height: 40)
                            .overlay {
                                if hex.uppercased() == color.hex.uppercased() {
                                    Image(systemName: "checkmark")
                                        .font(.headline.bold())
                                        .foregroundStyle(Color.readableText(onHex: color.hex))
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(color.name)
                }
            }

            ColorPicker(
                "Eigene Farbe",
                selection: Binding(
                    get: { Color(hex: hex) },
                    set: { hex = $0.hexString }
                ),
                supportsOpacity: false
            )
        }
        .padding(.vertical, 4)
    }
}

/// Textfeld für Zahlen, das Komma und Punkt als Dezimaltrennzeichen akzeptiert
/// und den Wert bei jeder Eingabe sofort übernimmt.
struct NumberField: View {
    let placeholder: String
    @Binding var value: Double
    var allowsDecimals = true

    @State private var text = ""

    var body: some View {
        TextField(placeholder, text: $text)
            .keyboardType(allowsDecimals ? .decimalPad : .numberPad)
            .multilineTextAlignment(.center)
            .monospacedDigit()
            .padding(.vertical, 8)
            .padding(.horizontal, 6)
            .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
            .onAppear { text = Self.text(for: value) }
            .onChange(of: text) { _, newValue in
                if newValue.isEmpty {
                    value = 0
                } else if let parsed = Format.parse(newValue) {
                    value = allowsDecimals ? parsed : parsed.rounded(.down)
                }
            }
            .onChange(of: value) { _, newValue in
                // Nur übernehmen, wenn der Wert von außen geändert wurde.
                if Format.parse(text) ?? 0 != newValue {
                    text = Self.text(for: newValue)
                }
            }
    }

    private static func text(for value: Double) -> String {
        value == 0 ? "" : Format.number(value)
    }
}

extension View {
    /// Fügt über der Tastatur einen "Fertig"-Knopf hinzu, der die Tastatur schließt.
    func keyboardDoneButton() -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Fertig") {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil
                    )
                }
                .fontWeight(.semibold)
            }
        }
    }
}

/// Sheet zum Hinzufügen einer Übung mit Vorschlägen aus bereits bekannten Übungen.
struct AddExerciseSheet: View {
    let title: String
    /// Wird nur angezeigt, wenn die Übung zusätzlich im Plan gespeichert werden kann.
    var planToggleLabel: String?
    let onAdd: (_ name: String, _ addToPlan: Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @Query private var exercises: [Exercise]
    @Query private var entries: [ExerciseEntry]

    @State private var name = ""
    @State private var addToPlan = true
    @FocusState private var focused: Bool

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var suggestions: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for candidate in exercises.map(\.name) + entries.map(\.exerciseName) {
            let key = WorkoutHistory.normalized(candidate)
            guard !key.isEmpty, !seen.contains(key) else { continue }
            seen.insert(key)
            result.append(candidate)
        }
        let query = WorkoutHistory.normalized(name)
        return result
            .filter { query.isEmpty || WorkoutHistory.normalized($0).contains(query) }
            .filter { WorkoutHistory.normalized($0) != query }
            .sorted { $0.localizedCompare($1) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name der Übung, z. B. Bankdrücken", text: $name)
                        .focused($focused)
                        .submitLabel(.done)
                        .onSubmit(add)
                    if let planToggleLabel {
                        Toggle(planToggleLabel, isOn: $addToPlan)
                    }
                }

                if !suggestions.isEmpty {
                    Section("Vorschläge") {
                        ForEach(suggestions, id: \.self) { suggestion in
                            Button(suggestion) { name = suggestion }
                                .foregroundStyle(.primary)
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Hinzufügen", action: add)
                        .disabled(trimmedName.isEmpty)
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium, .large])
    }

    private func add() {
        guard !trimmedName.isEmpty else { return }
        onAdd(trimmedName, planToggleLabel != nil && addToPlan)
        dismiss()
    }
}
