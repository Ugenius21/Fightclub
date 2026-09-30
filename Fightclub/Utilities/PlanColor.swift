import SwiftUI
import UIKit

/// Vordefinierte Farben, aus denen für jeden Trainingsplan eine gewählt werden kann.
enum PlanColor {
    static let defaultHex = "#E53935"

    static let palette: [(name: String, hex: String)] = [
        ("Rot", "#E53935"),
        ("Blau", "#1E88E5"),
        ("Grün", "#43A047"),
        ("Orange", "#FB8C00"),
        ("Lila", "#8E24AA"),
        ("Türkis", "#00ACC1"),
        ("Pink", "#D81B60"),
        ("Gelb", "#FDD835"),
        ("Braun", "#6D4C41"),
        ("Grau", "#546E7A"),
    ]

    /// Die erste Farbe der Palette, die noch von keinem Plan verwendet wird.
    static func nextUnused(excluding used: [String]) -> String {
        let usedSet = Set(used.map { $0.uppercased() })
        return palette.first { !usedSet.contains($0.hex.uppercased()) }?.hex ?? defaultHex
    }
}

extension Color {
    init(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        var rgb: UInt64 = 0
        _ = Scanner(string: value).scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255
        let g = Double((rgb >> 8) & 0xFF) / 255
        let b = Double(rgb & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }

    var hexString: String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        func clamp(_ v: CGFloat) -> Int { Int((min(max(v, 0), 1) * 255).rounded()) }
        return String(format: "#%02X%02X%02X", clamp(r), clamp(g), clamp(b))
    }

    /// Schwarz oder Weiß – je nachdem, was auf dieser Farbe besser lesbar ist.
    static func readableText(onHex hex: String) -> Color {
        var value = hex
        if value.hasPrefix("#") { value.removeFirst() }
        var rgb: UInt64 = 0
        _ = Scanner(string: value).scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255
        let g = Double((rgb >> 8) & 0xFF) / 255
        let b = Double(rgb & 0xFF) / 255
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b
        return luminance > 0.7 ? .black : .white
    }
}
