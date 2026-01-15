//
//  HomeView.swift
//  Futeba dos Parças - iOS
//
//  Tela inicial do app
//

import SwiftUI

struct HomeView: View {
    @StateObject private var viewModel = HomeViewModel()
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    // Header com info do usuário
                    UserGreetingHeader(user: viewModel.currentUser)
                        .padding(.horizontal)

                    // Widget de sequência
                    if let streak = viewModel.userStreak {
                        StreakWidget(streak: streak)
                            .padding(.horizontal)
                    }

                    // Próximos jogos
                    Section(title: "Próximos Jogos") {
                        ForEach(viewModel.upcomingGames) { game in
                            GameCard(game: game)
                        }
                    }

                    // Jogos ao vivo
                    if !viewModel.liveGames.isEmpty {
                        Section(title: "Ao Vivo") {
                            ForEach(viewModel.liveGames) { game in
                                LiveGameCard(game: game)
                            }
                        }
                    }

                    // Badges recentes
                    if !viewModel.recentBadges.isEmpty {
                        Section(title: "Conquistas Recentes") {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(viewModel.recentBadges) { badge in
                                        BadgeCard(badge: badge)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                }
                .padding(.vertical)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Futeba dos Parças")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        // Abrir notificações
                    } label: {
                        Image(systemName: "bell")
                            .overlay(
                                Circle()
                                    .fill(Color.red)
                                    .frame(width: 8, height: 8)
                                    .offset(x: 8, y: -8),
                                alignment: .topTrailing
                            )
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
        .task {
            await viewModel.loadData()
        }
    }
}

// MARK: - User Greeting Header

struct UserGreetingHeader: View {
    let user: User?

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(greeting)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)

                if let name = user?.name {
                    Text("Bem-vindo, \(name)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Avatar do usuário
            AsyncImage(url: URL(string: user?.photoUrl ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle()
                    .fill(Color.appSecondary.opacity(0.3))
                    .overlay {
                        Image(systemName: "person.fill")
                            .foregroundColor(.appSecondary)
                    }
            }
            .frame(width: 50, height: 50)
            .clipShape(Circle())
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Bom dia!"
        case 12..<18: return "Boa tarde!"
        default: return "Boa noite!"
        }
    }
}

// MARK: - Streak Widget

struct StreakWidget: View {
    let streak: Int

    var body: some View {
        HStack {
            Image(systemName: "flame.fill")
                .foregroundColor(.orange)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text("Sequência de Jogos")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("\(streak) jogos seguidos")
                    .font(.headline)
            }

            Spacer()

            Text("🔥")
                .font(.largeTitle)
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color.orange.opacity(0.2), Color.yellow.opacity(0.2)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Section Header

struct Section<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundColor(.primary)
                .padding(.horizontal)

            content
        }
    }
}

// MARK: - Game Card

struct GameCard: View {
    let game: Game

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(game.formattedDate)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text(game.formattedTime)
                        .font(.title3)
                        .fontWeight(.semibold)
                }

                Spacer()

                StatusBadge(status: game.status)
            }

            HStack {
                Image(systemName: "mappin.circle.fill")
                    .foregroundColor(.appPrimary)

                Text(game.locationName)
                    .font(.subheadline)
                    .lineLimit(1)
            }

            // Confirmations
            HStack {
                HStack(spacing: -8) {
                    ForEach(game.confirmedPlayers.prefix(5), id: \.id) { player in
                        AsyncImage(url: URL(string: player.photoUrl ?? "")) {
                            $0.resizable()
                        } placeholder: {
                            Circle()
                                .fill(Color.appSecondary)
                        }
                        .frame(width: 32, height: 32)
                        .clipShape(Circle())
                        .overlay(
                            Circle().stroke(Color(uiColor: .systemBackground), lineWidth: 2)
                        )
                    }

                    if game.confirmedPlayers.count > 5 {
                        Text("+\(game.confirmedPlayers.count - 5)")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                }

                Spacer()

                Text("\(game.confirmedPlayers.count)/\(game.maxPlayers)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Live Game Card

struct LiveGameCard: View {
    let game: Game

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "circle.fill")
                    .foregroundColor(.red)
                    .font(.caption)

                Text("AO VIVO")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.red)

                Spacer()

                Text(game.locationName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack {
                VStack {
                    Text("\(game.team1Score)")
                        .font(.system(size: 36, weight: .bold))
                    Text("Time 1")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Text("VS")
                    .font(.headline)
                    .foregroundColor(.secondary)

                Spacer()

                VStack {
                    Text("\(game.team2Score)")
                        .font(.system(size: 36, weight: .bold))
                    Text("Time 2")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color.red.opacity(0.1), Color.orange.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.red.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: GameStatus

    var body: some View {
        Text(statusText)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .clipShape(Capsule())
    }

    private var statusText: String {
        switch status {
        case .scheduled: return "Agendado"
        case .confirmed: return "Confirmado"
        case .inProgress: return "Ao Vivo"
        case .finished: return "Finalizado"
        case .cancelled: return "Cancelado"
        }
    }

    private var statusColor: Color {
        switch status {
        case .scheduled: return .blue
        case .confirmed: return .green
        case .inProgress: return .red
        case .finished: return .gray
        case .cancelled: return .red
        }
    }
}

// MARK: - Badge Card

struct BadgeCard: View {
    let badge: Badge

    var body: some View {
        VStack(spacing: 8) {
            Text(badge.emoji)
                .font(.system(size: 40))

            Text(badge.name)
                .font(.caption)
                .fontWeight(.medium)
                .multilineTextAlignment(.center)
        }
        .frame(width: 80)
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Models (simplificados para SwiftUI)

struct Game: Identifiable, Equatable {
    let id: String
    let date: Date
    let locationName: String
    let maxPlayers: Int
    let confirmedPlayers: [Player]
    let status: GameStatus
    let team1Score: Int
    let team2Score: Int

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd/MM"
        return formatter.string(from: date)
    }

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

struct Player: Identifiable, Equatable {
    let id: String
    let name: String
    let photoUrl: String?
}

struct Badge: Identifiable, Equatable {
    let id: String
    let name: String
    let emoji: String
}

enum GameStatus: String, Equatable {
    case scheduled
    case confirmed
    case inProgress
    case finished
    case cancelled
}

// MARK: - Preview

#Preview {
    HomeView()
}
