//
//  GamesViewModel.swift
//  Futeba dos Parças - iOS
//
//  ViewModel para a GamesView
//

import Foundation
import Combine

@MainActor
class GamesViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var games: [Game] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentFilter: GameFilter = .upcoming

    // MARK: - Dependencies

    private let gameRepository = IosRepositoryFactory.shared.createGameRepository()

    // MARK: - Data Loading

    func loadGames() async {
        await loadGamesForFilter(currentFilter)
    }

    func updateFilter(_ filter: GameFilter) {
        currentFilter = filter
        Task {
            await loadGamesForFilter(filter)
        }
    }

    private func loadGamesForFilter(_ filter: GameFilter) async {
        isLoading = true
        errorMessage = nil

        do {
            switch filter {
            case .all:
                games = []

            case .upcoming:
                let upcoming = try await gameRepository.getUpcomingGames()
                games = upcoming.map { toSwiftGame($0) }

            case .history:
                let all = try await gameRepository.getUpcomingGames()
                games = all.map { toSwiftGame($0) }

            case .live:
                let live = try await gameRepository.getLiveGames()
                games = live.map { toSwiftGame($0) }
            }

            isLoading = false
        } catch {
            self.errorMessage = error.localizedDescription
            self.isLoading = false
            self.games = []
        }
    }

    func refresh() async {
        await loadGamesForFilter(currentFilter)
    }

    // MARK: - Helpers

    private func toSwiftGame(_ game: GameRepositoryImpl.Game) -> Game {
        let players = game.confirmedPlayers.map { player in
            Game.Player(
                id: player.id,
                name: player.name,
                photoUrl: player.photoUrl
            )
        }

        return Game(
            id: game.id,
            date: game.date,
            locationName: game.locationName,
            maxPlayers: game.maxPlayers,
            confirmedPlayers: players,
            status: game.status,
            team1Score: game.team1Score,
            team2Score: game.team2Score
        )
    }
}

// MARK: - Game Filter Enum

enum GameFilter {
    case all
    case upcoming
    case history
    case live
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

struct Player: Identifiable, Equatable {
    let id: String
    let name: String
    let photoUrl: String?
}
