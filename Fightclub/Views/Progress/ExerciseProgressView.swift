import SwiftUI
import SwiftData
import Charts

enum ProgressMetric: String, CaseIterable, Identifiable {
    case maxWeight
    case oneRepMax
    case volume

    var id: String { rawValue }

    var title: String {
        switch self {
        case .maxWeight: "Max. Gewicht"
        case .oneRepMax: "1RM (geschätzt)"
        case .volume: "Volumen"
        }
    }

    var explanation: String {
        switch self {
        case .maxWeight: "Schwerster Satz pro Training."
        case .oneRepMax: "Geschätztes Maximalgewicht für eine Wiederholung (Epley-Formel)."
        case .volume: "Summe aus Gewicht × Wiederholungen aller Sätze eines Trainings."
        }
    }

    func value(for sets: [SetEntry]) -> Double {
        switch self {
        case .maxWeight:
            sets.map(\.weight).max() ?? 0
        case .oneRepMax:
            sets.map { $0.reps == 1 ? $0.weight : $0.weight * (1 + Double($0.reps) / 30) }.max() ?? 0
        case .volume:
            sets.reduce(0) { $0 + $1.weight * Double($1.reps) }
        }
    }
}

struct ProgressPoint: Identifiable {
    let id: PersistentIdentifier
    let date: Date
    let value: Double
    let sets: [SetEntry]
    let planName: String
}

struct ExerciseProgressView: View {
    @Query private var entries: [ExerciseEntry]

    @State private var selectedName: String?
    @State private var metric: ProgressMetric = .maxWeight
    @State private var selectedDate: Date?

    /// Alle bisher trainierten Übungen (ohne Duplikate), alphabetisch sortiert.
    private var exerciseNames: [String] {
        var seen = Set<String>()
        return entries
            .filter { $0.session != nil && !$0.completedSets.isEmpty }
            .sorted { ($0.session?.date ?? .distantPast) > ($1.session?.date ?? .distantPast) }
            .map(\.exerciseName)
            .filter { seen.insert(WorkoutHistory.normalized($0)).inserted }
            .sorted { $0.localizedCompare($1) == .orderedAscending }
    }

    private var currentName: String? {
        if let selectedName,
           exerciseNames.contains(where: { WorkoutHistory.normalized($0) == WorkoutHistory.normalized(selectedName) }) {
            return selectedName
        }
        return exerciseNames.first
    }

    private var points: [ProgressPoint] {
        guard let currentName else { return [] }
        let key = WorkoutHistory.normalized(currentName)
        return entries
            .compactMap { entry -> ProgressPoint? in
                guard let session = entry.session,
                      WorkoutHistory.normalized(entry.exerciseName) == key else { return nil }
                let sets = entry.completedSets
                let value = metric.value(for: sets)
                guard value > 0 else { return nil }
                return ProgressPoint(
                    id: entry.persistentModelID,
                    date: session.date,
                    value: value,
                    sets: sets,
                    planName: session.displayName
                )
            }
            .sorted { $0.date < $1.date }
    }

    var body: some View {
        NavigationStack {
            Group {
                if exerciseNames.isEmpty {
                    ContentUnavailableView(
                        "Noch kein Fortschritt",
                        systemImage: "chart.line.uptrend.xyaxis",
                        description: Text("Sobald du ein Training mit Gewichten und Wiederholungen abgeschlossen hast, siehst du hier deine Steigerung.")
                    )
                } else {
                    content
                }
            }
            .navigationTitle("Fortschritt")
        }
    }

    private var content: some View {
        let data = points
        return List {
            Section {
                Picker("Übung", selection: Binding(
                    get: { currentName ?? "" },
                    set: { selectedName = $0; selectedDate = nil }
                )) {
                    ForEach(exerciseNames, id: \.self) { name in
                        Text(name).tag(name)
                    }
                }
                .pickerStyle(.navigationLink)

                Picker("Kennzahl", selection: $metric) {
                    ForEach(ProgressMetric.allCases) { metric in
                        Text(metric.title).tag(metric)
                    }
                }
                .pickerStyle(.segmented)
                .listRowSeparator(.hidden)
            } footer: {
                Text(metric.explanation)
            }

            Section {
                StatsRow(points: data)
                ProgressChart(points: data, metric: metric, selectedDate: $selectedDate)
                    .frame(height: 240)
                    .padding(.vertical, 8)
            }

            Section("Verlauf") {
                ForEach(data.reversed()) { point in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(Format.shortDate(point.date))
                                .font(.headline)
                            Text(point.planName)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(valueText(point.value))
                                .font(.headline.monospacedDigit())
                        }
                        Text("\(Format.sets(point.sets)) kg")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func valueText(_ value: Double) -> String {
        metric == .volume ? Format.kg(value.rounded()) : Format.kg(value)
    }
}

private struct StatsRow: View {
    let points: [ProgressPoint]

    var body: some View {
        let first = points.first?.value ?? 0
        let last = points.last?.value ?? 0
        let best = points.map(\.value).max() ?? 0
        let delta = last - first

        HStack(spacing: 0) {
            stat("Start", Format.kg(first.rounded(toPlaces: 1)))
            Divider()
            stat("Aktuell", Format.kg(last.rounded(toPlaces: 1)))
            Divider()
            stat("Bestwert", Format.kg(best.rounded(toPlaces: 1)))
            Divider()
            stat(
                "Steigerung",
                (delta >= 0 ? "+" : "−") + Format.kg(abs(delta).rounded(toPlaces: 1)),
                systemImage: delta > 0 ? "arrow.up.right" : (delta < 0 ? "arrow.down.right" : nil)
            )
        }
        .padding(.vertical, 4)
    }

    private func stat(_ title: String, _ value: String, systemImage: String? = nil) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 2) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.caption2.bold())
                }
                Text(value)
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct ProgressChart: View {
    let points: [ProgressPoint]
    let metric: ProgressMetric
    @Binding var selectedDate: Date?

    private var selectedPoint: ProgressPoint? {
        guard let selectedDate else { return nil }
        return points.min {
            abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate))
        }
    }

    var body: some View {
        Chart {
            ForEach(points) { point in
                LineMark(
                    x: .value("Datum", point.date),
                    y: .value(metric.title, point.value)
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                .foregroundStyle(Color.accentColor)

                PointMark(
                    x: .value("Datum", point.date),
                    y: .value(metric.title, point.value)
                )
                .symbolSize(50)
                .foregroundStyle(Color.accentColor)
            }

            if let selectedPoint {
                RuleMark(x: .value("Datum", selectedPoint.date))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    .annotation(
                        position: .top,
                        spacing: 4,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        VStack(spacing: 2) {
                            Text(Format.kg(selectedPoint.value.rounded(toPlaces: 1)))
                                .font(.caption.bold().monospacedDigit())
                            Text(Format.shortDate(selectedPoint.date))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 6))
                    }

                PointMark(
                    x: .value("Datum", selectedPoint.date),
                    y: .value(metric.title, selectedPoint.value)
                )
                .symbolSize(120)
                .foregroundStyle(Color.accentColor)
            }
        }
        .chartYScale(domain: .automatic(includesZero: false))
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
        .overlay {
            if points.count == 1 {
                Text("Ab dem zweiten Training siehst du hier eine Linie.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 24)
            }
        }
    }
}

extension Double {
    func rounded(toPlaces places: Int) -> Double {
        let factor = pow(10, Double(places))
        return (self * factor).rounded() / factor
    }
}
