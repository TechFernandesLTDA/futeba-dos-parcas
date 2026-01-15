//
//  HomeViewModel.swift
//  Futeba dos Parças - iOS
//
//  ViewModel para a HomeView - conecta com o código Kotlin compartilhado
//

import Foundation
import Combine

@MainActor
class HomeViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var currentUser: User?
    @Published var upcomingGames: [Game] = []
    @Published var liveGames: [Game] = []
    @Published var recentBadges: [Badge] = []
    @Published var userStreak: Int?
    @Published var isLoading = false
    @Published var errorMessage: String?

    // MARK: - Dependencies

    private let gameRepository = IosRepositoryFactory.shared.createGameRepository()
    private let userRepository = IosRepositoryFactory.shared.createUserRepository()
    private let gamificationRepository = IosRepositoryFactory.shared.createGamificationRepository()

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        setupBindings()
    }

    // MARK: - Data Loading

    func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            // Carregar usuário atual
            let user = try await userRepository.getCurrentUser()
            self.currentUser = user

            // Carregar jogos em paralelo
            async let upcoming = gameRepository.getUpcomingGames()
            async let live = gameRepository.getLiveGames()
            async let badges = gamificationRepository.getRecentBadges(userId: user.id, limit: 5)
            async let streak = userRepository.getUserStreak(userId: user.id)

            // Aguardar resultados
            let (upcomingGames, liveGames, recentBadges, streak) = try await (upcoming, live, badges, streak)

            self.upcomingGames = upcomingGames
            self.liveGames = liveGames
            self.recentBadges = recentBadges
            self.userStreak = streak

            isLoading = false
        } catch {
            self.errorMessage = error.localizedDescription
            self.isLoading = false
        }
    }

    func refresh() async {
        await loadData()
    }

    // MARK: - Setup

    private func setupBindings() {
        // Configurar listeners em tempo real se necessário
    }
}

// MARK: - User Model (Swift)

struct User {
    let id: String
    let name: String
    let email: String
    let photoUrl: String?
    let level: Int
    let xp: Long
    let role: String
}

// MARK: - Game Model (Swift)

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

// MARK: - Player Model (Swift)

struct Player: Identifiable, Equatable {
    let id: String
    let name: String
    let photoUrl: String?
}

// MARK: - Badge Model (Swift)

struct Badge: Identifiable, Equatable {
    let id: String
    let name: String
    let emoji: String
}

// MARK: - GameStatus Enum

enum GameStatus: String {
    case scheduled = "SCHEDULED"
    case confirmed = "CONFIRMED"
    case inProgress = "IN_PROGRESS"
    case finished = "FINISHED"
    case cancelled = "CANCELLED"
}
