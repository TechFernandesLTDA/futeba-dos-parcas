//
//  RankingsView.swift
//  Futeba dos Parças - iOS
//
//  Tela de rankings e ligas
//

import SwiftUI

enum RankingTab {
    case general
    case strikers
    case defenders
    case goalkeepers
}

struct RankingsView: View {
    @StateObject private var viewModel = RankingsViewModel()
    @State private var selectedTab: RankingTab = .general

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tabs
                RankingTabPicker(
                    selected: $selectedTab,
                    onTabChanged: { tab in
                        viewModel.loadRanking(for: tab)
                    }
                )
                .background(Color(uiColor: .systemGroupedBackground))
                .padding(.top, 8)

                // Conteúdo
                Group {
                    if viewModel.isLoading && viewModel.rankings.isEmpty {
                        LoadingView()
                    } else if viewModel.rankings.isEmpty {
                        EmptyRankingsView()
                    } else {
                        RankingsList(
                            rankings: viewModel.rankings,
                            currentUserId: viewModel.currentUserId
                        )
                    }
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Ranking")
            .refreshable {
                await viewModel.refresh()
            }
        }
        .task {
            await viewModel.loadRanking(for: selectedTab)
        }
    }
}

// MARK: - Ranking Tab Picker

struct RankingTabPicker: View {
    @Binding var selected: RankingTab
    let onTabChanged: (RankingTab) -> Void

    private let tabs: [(tab: RankingTab, title: String, icon: String)] = [
        (.general, "Geral", "trophy.fill"),
        (.strikers, "Atacantes", "figure.run"),
        (.defenders, "Defensores", "shield.fill"),
        (.goalkeepers, "Goleiros", "figure.indoor.football")
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(tabs, id: \.tab) { item in
                    RankingTabButton(
                        title: item.title,
                        icon: item.icon,
                        isSelected: selected == item.tab
                    ) {
                        withAnimation {
                            selected = item.tab
                            onTabChanged(item.tab)
                        }
                    }
                }
            }
            .padding(.horizontal)
        }
    }
}

struct RankingTabButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(isSelected ? .semibold : .regular)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                isSelected ?
                    LinearGradient(
                        colors: [Color.appPrimary, Color.appPrimary.opacity(0.8)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ) :
                    LinearGradient(
                        colors: [Color(uiColor: .tertiarySystemGroupedBackground)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
            )
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(isSelected ? Color.clear : Color.gray.opacity(0.3), lineWidth: 1)
            )
        }
    }
}

// MARK: - Rankings List

struct RankingsList: View {
    let rankings: [RankingEntry]
    let currentUserId: String

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Top 3 em destaque
                if rankings.count >= 3 {
                    TopThreeRankings(rankings: Array(rankings.prefix(3)))
                        .padding()
                }

                // Lista completa
                ForEach(Array(rankings.enumerated()), id: \.element.id) { index, entry in
                    RankingRow(
                        position: index + 1,
                        entry: entry,
                        isCurrentUser: entry.userId == currentUserId,
                        isHighlighted: index < 3
                    )
                }
            }
        }
    }
}

// MARK: - Top Three Rankings

struct TopThreeRankings: View {
    let rankings: [RankingEntry]

    var body: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // 2º lugar
            if rankings.count > 1 {
                PodiumPosition(
                    position: 2,
                    entry: rankings[1],
                    color: Color.silver,
                    height: 80
                )
            }

            // 1º lugar
            PodiumPosition(
                position: 1,
                entry: rankings[0],
                color: Color.gold,
                height: 100
            )

            // 3º lugar
            if rankings.count > 2 {
                PodiumPosition(
                    position: 3,
                    entry: rankings[2],
                    color: Color.bronze,
                    height: 60
                )
            }
        }
        .padding(.bottom, 8)
    }
}

struct PodiumPosition: View {
    let position: Int
    let entry: RankingEntry
    let color: Color
    let height: CGFloat

    var body: some View {
        VStack(spacing: 8) {
            // Posição
            Text("\(position)º")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(color)

            // Avatar
            AsyncImage(url: URL(string: entry.photoUrl ?? "")) {
                $0.resizable()
            } placeholder: {
                Circle()
                    .fill(color.opacity(0.3))
            }
            .frame(width: 50, height: 50)
            .clipShape(Circle())
            .overlay(
                Circle().stroke(color, lineWidth: 2)
            )

            // Nome
            Text(entry.firstName)
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)

            // Pontos
            Text("\(entry.points)")
                .font(.caption)
                .foregroundColor(.secondary)

            // Pódio
            RoundedRectangle(cornerRadius: 4)
                .fill(
                    LinearGradient(
                        colors: [color.opacity(0.8), color.opacity(0.4)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 50, height: height)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Ranking Row

struct RankingRow: View {
    let position: Int
    let entry: RankingEntry
    let isCurrentUser: Bool
    let isHighlighted: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Posição
            Text("\(position)")
                .font(.headline)
                .foregroundColor(isHighlighted ? positionColor : .secondary)
                .frame(width: 30)

            // Avatar
            AsyncImage(url: URL(string: entry.photoUrl ?? "")) {
                $0.resizable()
            } placeholder: {
                Circle()
                    .fill(Color.appSecondary.opacity(0.3))
            }
            .frame(width: 40, height: 40)
            .clipShape(Circle())
            .overlay(
                Circle().stroke(isCurrentUser ? Color.appPrimary : Color.clear, lineWidth: 2)
            )

            // Nome e info
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.subheadline)
                    .fontWeight(isCurrentUser ? .semibold : .regular)

                if let division = entry.division {
                    Text(division)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Pontos
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.points)")
                    .font(.headline)
                    .foregroundColor(isHighlighted ? positionColor : .primary)

                if let change = entry.positionChange {
                    HStack(spacing: 2) {
                        Image(systemName: changeIcon(for: change))
                            .font(.caption2)

                        Text(abs(change))
                            .font(.caption2)
                    }
                    .foregroundColor(changeColor(for: change))
                }
            }
        }
        .padding()
        .background(
            isCurrentUser ?
                Color.appPrimary.opacity(0.1) :
                Color(uiColor: .secondarySystemGroupedBackground)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isCurrentUser ? Color.appPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .padding(.horizontal)
        .padding(.vertical, 4)
    }

    private var positionColor: Color {
        switch position {
        case 1: return .gold
        case 2: return .silver
        case 3: return .bronze
        default: return .primary
        }
    }

    private func changeIcon(for change: Int) -> String {
        change > 0 ? "arrow.up" : change < 0 ? "arrow.down" : "minus"
    }

    private func changeColor(for change: Int) -> Color {
        change > 0 ? .green : change < 0 ? .red : .gray
    }
}

// MARK: - Empty Rankings View

struct EmptyRankingsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "trophy")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("Ranking não disponível")
                .font(.headline)

            Text("Jogue algumas partidas para aparecer no ranking!")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Models

struct RankingEntry: Identifiable {
    let id: String
    let userId: String
    let name: String
    let firstName: String
    let photoUrl: String?
    let points: Int
    let division: String?
    let positionChange: Int?
}

// MARK: - Gamification Colors

extension Color {
    static let gold = Color(red: 1.0, green: 0.84, blue: 0.0)
    static let silver = Color(red: 0.75, green: 0.75, blue: 0.75)
    static let bronze = Color(red: 0.8, green: 0.5, blue: 0.2)
}

// MARK: - Preview

#Preview {
    RankingsView()
}
