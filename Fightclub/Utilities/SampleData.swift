import Foundation
import SwiftData

enum SampleData {
    static let plans: [(name: String, hex: String, exercises: [String])] = [
        ("Push", "#E53935", ["Bankdrücken", "Schrägbankdrücken", "Butterfly", "Schulterdrücken", "Seitheben", "Trizepsdrücken"]),
        ("Pull", "#43A047", ["Klimmzüge", "Langhantelrudern", "Latziehen", "Face Pulls", "Bizepscurls"]),
        ("Beine", "#1E88E5", ["Kniebeugen", "Beinpresse", "Rumänisches Kreuzheben", "Beinstrecker", "Beinbeuger", "Wadenheben"]),
    ]

    static func insertPlans(into context: ModelContext) {
        for (offset, template) in plans.enumerated() {
            let plan = WorkoutPlan(
                name: template.name,
                colorHex: template.hex,
                createdAt: Date.now.addingTimeInterval(Double(offset))
            )
            context.insert(plan)
            for (index, name) in template.exercises.enumerated() {
                plan.exercises.append(Exercise(name: name, order: index))
            }
        }
        try? context.save()
    }
}
