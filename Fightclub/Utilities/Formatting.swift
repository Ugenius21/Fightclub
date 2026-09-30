import Foundation

extension Locale {
    static let app = Locale(identifier: "de_DE")
}

extension Calendar {
    /// Gregorianischer Kalender mit Montag als erstem Wochentag.
    static let app: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = .app
        calendar.firstWeekday = 2
        calendar.timeZone = .current
        return calendar
    }()
}

enum Format {
    /// 80 → "80", 82.5 → "82,5"
    static func number(_ value: Double) -> String {
        value.formatted(
            .number
                .precision(.fractionLength(0...2))
                .grouping(.never)
                .locale(.app)
        )
    }

    static func kg(_ value: Double) -> String {
        "\(number(value)) kg"
    }

    /// Kompakte Darstellung der Sätze, z. B. "80 × 8 · 80 × 7 · 77,5 × 6"
    static func sets(_ sets: [SetEntry]) -> String {
        sets.map { "\(number($0.weight)) × \($0.reps)" }.joined(separator: " · ")
    }

    static func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.day(.twoDigits).month(.twoDigits).year().locale(.app))
    }

    static func dayMonth(_ date: Date) -> String {
        date.formatted(.dateTime.day(.twoDigits).month(.twoDigits).locale(.app))
    }

    static func longDate(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.wide).day().month(.wide).year().locale(.app))
    }

    static func monthYear(_ date: Date) -> String {
        date.formatted(.dateTime.month(.wide).year().locale(.app))
    }

    /// Parst Benutzereingaben wie "82,5" oder "82.5".
    static func parse(_ text: String) -> Double? {
        let normalized = text
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: ",", with: ".")
        return Double(normalized)
    }
}
