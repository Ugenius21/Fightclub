import SwiftUI
import SwiftData
import Charts

enum WeightRange: String, CaseIterable, Identifiable {
    case month = "1M"
    case threeMonths = "3M"
    case sixMonths = "6M"
    case year = "1J"
    case all = "Alle"

    var id: String { rawValue }

    var startDate: Date? {
        let calendar = Calendar.app
        switch self {
        case .month: return calendar.date(byAdding: .month, value: -1, to: .now)
        case .threeMonths: return calendar.date(byAdding: .month, value: -3, to: .now)
        case .sixMonths: return calendar.date(byAdding: .month, value: -6, to: .now)
        case .year: return calendar.date(byAdding: .year, value: -1, to: .now)
        case .all: return nil
        }
    }
}

struct BodyWeightView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \BodyWeightEntry.date) private var entries: [BodyWeightEntry]

    @State private var range: WeightRange = .threeMonths
    @State private var editorEntry: BodyWeightEditorTarget?
    @State private var selectedDate: Date?

    private var visibleEntries: [BodyWeightEntry] {
        guard let start = range.startDate else { return entries }
        return entries.filter { $0.date >= start }
    }

    var body: some View {
        NavigationStack {
            Group {
                if entries.isEmpty {
                    ContentUnavailableView {
                        Label("Noch kein Körpergewicht", systemImage: "scalemass")
                    } description: {
                        Text("Trage regelmäßig dein Körpergewicht ein, um deinen Verlauf zu sehen.")
                    } actions: {
                        Button("Gewicht eintragen") { editorEntry = .new }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    list
                }
            }
            .navigationTitle("Körpergewicht")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        editorEntry = .new
                    } label: {
                        Label("Gewicht eintragen", systemImage: "plus")
                    }
                }
            }
            .sheet(item: $editorEntry) { target in
                BodyWeightEditor(target: target, lastWeight: entries.last?.weight)
            }
        }
    }

    private var list: some View {
        let visible = visibleEntries
        return List {
            Section {
                WeightSummary(entries: visible, latest: entries.last)

                Picker("Zeitraum", selection: $range) {
                    ForEach(WeightRange.allCases) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .listRowSeparator(.hidden)

                if visible.isEmpty {
                    Text("Keine Einträge in diesem Zeitraum.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 120)
                } else {
                    BodyWeightChart(entries: visible, selectedDate: $selectedDate)
                        .frame(height: 220)
                        .padding(.vertical, 8)
                }
            }

            Section("Einträge") {
                ForEach(Array(entries.enumerated().reversed()), id: \.element.persistentModelID) { index, entry in
                    Button {
                        editorEntry = .edit(entry)
                    } label: {
                        WeightRow(entry: entry, previous: index > 0 ? entries[index - 1] : nil)
                    }
                    .foregroundStyle(.primary)
                }
                .onDelete { offsets in
                    let reversed = Array(entries.reversed())
                    for index in offsets {
                        context.delete(reversed[index])
                    }
                }
            }
        }
    }
}

private struct WeightSummary: View {
    let entries: [BodyWeightEntry]
    let latest: BodyWeightEntry?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Aktuell")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(latest.map { Format.kg($0.weight) } ?? "–")
                    .font(.largeTitle.bold().monospacedDigit())
                if let latest {
                    Text(Format.shortDate(latest.date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let first = entries.first, let last = entries.last, entries.count > 1 {
                let delta = last.weight - first.weight
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Veränderung im Zeitraum")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text((delta > 0 ? "+" : delta < 0 ? "−" : "±") + Format.kg(abs(delta).rounded(toPlaces: 1)))
                        .font(.title3.bold().monospacedDigit())
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct WeightRow: View {
    let entry: BodyWeightEntry
    let previous: BodyWeightEntry?

    var body: some View {
        HStack {
            Text(Format.longDate(entry.date))
            Spacer()
            if let previous {
                let delta = (entry.weight - previous.weight).rounded(toPlaces: 1)
                if delta != 0 {
                    Text((delta > 0 ? "+" : "−") + Format.number(abs(delta)))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            Text(Format.kg(entry.weight))
                .font(.body.weight(.semibold).monospacedDigit())
        }
    }
}

private struct BodyWeightChart: View {
    let entries: [BodyWeightEntry]
    @Binding var selectedDate: Date?

    private var yDomain: ClosedRange<Double> {
        let weights = entries.map(\.weight)
        let low = (weights.min() ?? 0) - 1
        let high = (weights.max() ?? 0) + 1
        return low.rounded(.down)...high.rounded(.up)
    }

    private var selectedEntry: BodyWeightEntry? {
        guard let selectedDate else { return nil }
        return entries.min {
            abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate))
        }
    }

    var body: some View {
        Chart {
            ForEach(entries) { entry in
                AreaMark(
                    x: .value("Datum", entry.date),
                    yStart: .value("Basis", yDomain.lowerBound),
                    yEnd: .value("Gewicht", entry.weight)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.accentColor.opacity(0.25), Color.accentColor.opacity(0.02)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                LineMark(
                    x: .value("Datum", entry.date),
                    y: .value("Gewicht", entry.weight)
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                .foregroundStyle(Color.accentColor)

                if entries.count <= 40 {
                    PointMark(
                        x: .value("Datum", entry.date),
                        y: .value("Gewicht", entry.weight)
                    )
                    .symbolSize(40)
                    .foregroundStyle(Color.accentColor)
                }
            }

            if let selectedEntry {
                RuleMark(x: .value("Datum", selectedEntry.date))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    .annotation(
                        position: .top,
                        spacing: 4,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        VStack(spacing: 2) {
                            Text(Format.kg(selectedEntry.weight))
                                .font(.caption.bold().monospacedDigit())
                            Text(Format.shortDate(selectedEntry.date))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 6))
                    }

                PointMark(
                    x: .value("Datum", selectedEntry.date),
                    y: .value("Gewicht", selectedEntry.weight)
                )
                .symbolSize(120)
                .foregroundStyle(Color.accentColor)
            }
        }
        .chartYScale(domain: yDomain)
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.3))
                AxisValueLabel {
                    if let number = value.as(Double.self) {
                        Text(Format.number(number))
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                AxisValueLabel(format: .dateTime.day().month(.abbreviated).locale(.app))
            }
        }
        .chartXSelection(value: $selectedDate)
    }
}

// MARK: - Eintragen / Bearbeiten

enum BodyWeightEditorTarget: Identifiable {
    case new
    case edit(BodyWeightEntry)

    var id: String {
        switch self {
        case .new: "new"
        case .edit(let entry): "\(entry.persistentModelID.hashValue)"
        }
    }
}

private struct BodyWeightEditor: View {
    let target: BodyWeightEditorTarget
    let lastWeight: Double?

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var date = Date.now
    @State private var weight: Double = 0
    @State private var didLoad = false

    private var existing: BodyWeightEntry? {
        if case .edit(let entry) = target { return entry }
        return nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text("Gewicht")
                        Spacer()
                        NumberField(placeholder: "0,0", value: $weight)
                            .frame(width: 110)
                        Text("kg")
                            .foregroundStyle(.secondary)
                    }
                    DatePicker("Datum", selection: $date, displayedComponents: .date)
                }

                if existing != nil {
                    Section {
                        Button("Eintrag löschen", role: .destructive) {
                            let modelContext = context
                            let entry = existing
                            dismiss()
                            // Erst nach dem Schließen löschen, damit das Sheet
                            // nicht mehr auf den gelöschten Eintrag zugreift.
                            Task { @MainActor in
                                try? await Task.sleep(for: .milliseconds(400))
                                if let entry { modelContext.delete(entry) }
                                try? modelContext.save()
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .navigationTitle(existing == nil ? "Gewicht eintragen" : "Eintrag bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .keyboardDoneButton()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern", action: save)
                        .disabled(weight <= 0)
                }
            }
            .onAppear(perform: load)
        }
        .presentationDetents([.medium])
    }

    private func load() {
        guard !didLoad else { return }
        didLoad = true
        if let existing {
            date = existing.date
            weight = existing.weight
        } else if let lastWeight {
            weight = lastWeight
        }
    }

    private func save() {
        if let existing {
            existing.date = date
            existing.weight = weight
        } else {
            context.insert(BodyWeightEntry(date: date, weight: weight))
        }
        try? context.save()
        dismiss()
    }
}
