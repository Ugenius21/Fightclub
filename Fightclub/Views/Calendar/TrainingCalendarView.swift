import SwiftUI
import SwiftData

struct TrainingCalendarView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \WorkoutSession.date) private var sessions: [WorkoutSession]
    @Query(sort: \WorkoutPlan.createdAt) private var plans: [WorkoutPlan]

    @State private var month = Calendar.app.startOfMonth(for: .now)
    @State private var selectedDay = Calendar.app.startOfDay(for: .now)
    @State private var activeSession: WorkoutSession?

    private let calendar = Calendar.app

    private var sessionsByDay: [Date: [WorkoutSession]] {
        Dictionary(grouping: sessions) { calendar.startOfDay(for: $0.date) }
    }

    private var sessionsInMonth: [WorkoutSession] {
        sessions.filter { calendar.isDate($0.date, equalTo: month, toGranularity: .month) }
    }

    private var selectedSessions: [WorkoutSession] {
        sessionsByDay[selectedDay] ?? []
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    MonthGrid(
                        month: month,
                        selectedDay: $selectedDay,
                        sessionsByDay: sessionsByDay,
                        onPrevious: { changeMonth(by: -1) },
                        onNext: { changeMonth(by: 1) },
                        onToday: goToToday
                    )
                    .listRowInsets(EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12))
                }

                if !plans.isEmpty || !sessionsInMonth.isEmpty {
                    Section("Trainings im \(month.formatted(.dateTime.month(.wide).locale(.app)))") {
                        MonthLegend(sessions: sessionsInMonth)
                    }
                }

                Section(Format.longDate(selectedDay)) {
                    if selectedSessions.isEmpty {
                        Text("An diesem Tag wurde nicht trainiert.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(selectedSessions) { session in
                        NavigationLink(value: session) {
                            SessionRow(session: session)
                        }
                    }

                    if !plans.isEmpty {
                        Menu {
                            ForEach(plans) { plan in
                                Button(plan.name) { logWorkout(for: plan) }
                            }
                        } label: {
                            Label(
                                calendar.isDateInToday(selectedDay) ? "Training starten" : "Training nachtragen",
                                systemImage: "plus.circle.fill"
                            )
                        }
                    }
                }
            }
            .navigationTitle("Kalender")
            .navigationDestination(for: WorkoutSession.self) { session in
                WorkoutSessionView(session: session, isNew: false)
            }
            .fullScreenCover(item: $activeSession) { session in
                NavigationStack {
                    WorkoutSessionView(session: session, isNew: true)
                }
            }
        }
    }

    private func changeMonth(by value: Int) {
        guard let newMonth = calendar.date(byAdding: .month, value: value, to: month) else { return }
        withAnimation(.easeInOut(duration: 0.2)) { month = newMonth }
    }

    private func goToToday() {
        withAnimation(.easeInOut(duration: 0.2)) {
            month = calendar.startOfMonth(for: .now)
            selectedDay = calendar.startOfDay(for: .now)
        }
    }

    private func logWorkout(for plan: WorkoutPlan) {
        let date: Date
        if calendar.isDateInToday(selectedDay) {
            date = .now
        } else {
            date = calendar.date(bySettingHour: 12, minute: 0, second: 0, of: selectedDay) ?? selectedDay
        }
        activeSession = WorkoutHistory.startSession(for: plan, date: date, in: context)
    }
}

// MARK: - Monatsraster

private struct MonthGrid: View {
    let month: Date
    @Binding var selectedDay: Date
    let sessionsByDay: [Date: [WorkoutSession]]
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onToday: () -> Void

    private let calendar = Calendar.app
    private let weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)

    /// Tage des Monats; `nil` für die Leerfelder vor dem ersten Tag.
    private var days: [Date?] {
        guard let range = calendar.range(of: .day, in: .month, for: month) else { return [] }
        let firstWeekday = calendar.component(.weekday, from: month)
        let leading = (firstWeekday - calendar.firstWeekday + 7) % 7
        let dates: [Date?] = range.compactMap { day in
            calendar.date(byAdding: .day, value: day - 1, to: month)
        }
        return Array(repeating: nil, count: leading) + dates
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Button(action: onPrevious) {
                    Image(systemName: "chevron.left")
                        .font(.headline)
                        .frame(width: 36, height: 36)
                }
                Spacer()
                Button(action: onToday) {
                    Text(Format.monthYear(month))
                        .font(.title3.bold())
                        .foregroundStyle(.primary)
                }
                Spacer()
                Button(action: onNext) {
                    Image(systemName: "chevron.right")
                        .font(.headline)
                        .frame(width: 36, height: 36)
                }
            }
            .buttonStyle(.borderless)

            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(weekdays, id: \.self) { weekday in
                    Text(weekday)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                    if let day {
                        DayCell(
                            date: day,
                            colors: colors(for: day),
                            isSelected: calendar.isDate(day, inSameDayAs: selectedDay),
                            isToday: calendar.isDateInToday(day)
                        )
                        .onTapGesture { selectedDay = day }
                    } else {
                        Color.clear.frame(height: 44)
                    }
                }
            }
        }
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 30)
                .onEnded { value in
                    guard abs(value.translation.width) > abs(value.translation.height) else { return }
                    if value.translation.width < 0 {
                        onNext()
                    } else {
                        onPrevious()
                    }
                }
        )
    }

    /// Eindeutige Planfarben der Trainings an diesem Tag.
    private func colors(for day: Date) -> [String] {
        var seen = Set<String>()
        return (sessionsByDay[day] ?? [])
            .sorted { $0.date < $1.date }
            .map(\.displayColorHex)
            .filter { seen.insert($0.uppercased()).inserted }
    }
}

private struct DayCell: View {
    let date: Date
    let colors: [String]
    let isSelected: Bool
    let isToday: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)

        ZStack {
            if colors.isEmpty {
                shape.fill(Color(.secondarySystemFill).opacity(0.5))
            } else {
                // Bei mehreren Trainings an einem Tag wird die Fläche aufgeteilt.
                HStack(spacing: 0) {
                    ForEach(colors, id: \.self) { hex in
                        Color(hex: hex)
                    }
                }
                .clipShape(shape)
            }

            Text("\(Calendar.app.component(.day, from: date))")
                .font(.callout.weight(isToday || !colors.isEmpty ? .bold : .regular))
                .monospacedDigit()
                .foregroundStyle(textColor)
        }
        .frame(height: 44)
        .overlay {
            if isSelected {
                shape.strokeBorder(Color.primary, lineWidth: 2.5)
            } else if isToday {
                shape.strokeBorder(Color.accentColor, lineWidth: 2)
            }
        }
        .contentShape(shape)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var textColor: Color {
        if let first = colors.first {
            return Color.readableText(onHex: first)
        }
        return isToday ? .accentColor : .primary
    }
}

// MARK: - Legende & Zeilen

private struct MonthLegend: View {
    let sessions: [WorkoutSession]

    private var groups: [(name: String, hex: String, count: Int)] {
        let grouped = Dictionary(grouping: sessions) { $0.displayName }
        return grouped
            .map { (name: $0.key, hex: $0.value.first?.displayColorHex ?? PlanColor.defaultHex, count: $0.value.count) }
            .sorted { $0.count == $1.count ? $0.name < $1.name : $0.count > $1.count }
    }

    var body: some View {
        if sessions.isEmpty {
            Text("Noch keine Trainings in diesem Monat.")
                .foregroundStyle(.secondary)
        } else {
            HStack {
                Text("Gesamt")
                    .fontWeight(.semibold)
                Spacer()
                Text(sessions.count == 1 ? "1 Training" : "\(sessions.count) Trainings")
                    .foregroundStyle(.secondary)
            }
            ForEach(groups, id: \.name) { group in
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(hex: group.hex))
                        .frame(width: 18, height: 18)
                    Text(group.name)
                    Spacer()
                    Text("\(group.count)×")
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
        }
    }
}

private struct SessionRow: View {
    let session: WorkoutSession

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(hex: session.displayColorHex))
                .frame(width: 8, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(session.displayName)
                    .font(.headline)
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }

    private var summary: String {
        let names = session.sortedEntries.map(\.exerciseName)
        let time = session.date.formatted(.dateTime.hour().minute().locale(.app))
        return names.isEmpty ? time : "\(time) · \(names.joined(separator: ", "))"
    }
}

extension Calendar {
    func startOfMonth(for date: Date) -> Date {
        let components = dateComponents([.year, .month], from: date)
        return self.date(from: components) ?? startOfDay(for: date)
    }
}
