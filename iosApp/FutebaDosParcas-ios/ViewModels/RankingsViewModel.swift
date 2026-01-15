//
//  RankingsViewModel.swift
//  Futeba dos Parças - iOS
//
//  ViewModel para a RankingsView
//

import Foundation
import Combine

@MainActor
class RankingsViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var rankings: [RankingEntry] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentUserId: String = ""

    // MARK: - Dependencies

    private let rankingRepository = IosRepositoryFactory.shared.createRankingRepository()
    private let authRepository = IosRepositoryFactory.shared.createAuthRepository()

    // MARK: - Data Loading

    func loadRanking(for tab: RankingTab) async {
        isLoading = true
        errorMessage = nil

        do {
            // Carregar usuário atual
            let user = try await authRepository.getCurrentUser()
            self.currentUserId = user.id

            // Carregar ranking baseado na categoria
            switch tab {
            case .general:
                self.rankings = try await loadGeneralRanking()
            case .strikers:
                self.rankings = try await loadStrikersRanking()
            case .defenders:
                self.rankings = try await loadDefendersRanking()
            case .goalkeepers:
                self.rankings = try await loadGoalkeepersRanking()
            }

            isLoading = false
        } catch {
            self.errorMessage = error.localizedDescription
            self.isLoading = false
            self.rankings = []
        }
    }

    func refresh() async {
        // Recarregar com a tab atual
        await loadRanking(.general)
    }

    // MARK: - Private Methods

    private func loadGeneralRanking() async throws -> [RankingEntry] {
        // Simulação - na prática consultaria o Firestore
        return [
            RankingEntry(
                id: UUID().uuidString,
                userId: "user1",
                name: "João Silva",
                firstName: "João",
                photoUrl: nil,
                points: 1250,
                division: "Diamante",
                positionChange: 2
            ),
            RankingEntry(
                id: UUID().uuidString,
                userId: "user2",
                name: "Pedro Santos",
                firstName: "Pedro",
                photoUrl: nil,
                points: 1180,
                division: "Ouro",
                positionChange: -1
            ),
            RankingEntry(
                id: UUID().uuidString,
                userId: "user3",
                name: "Lucas Oliveira",
                firstName: "Lucas",
                photoUrl: nil,
                points: 1050,
                division: "Prata",
                positionChange: 0
            )
        ]
    }

    private func loadStrikersRanking() async throws -> [RankingEntry] {
        // Implementação futura
        return []
    }

    private func loadDefendersRanking() async throws -> [RankingEntry] {
        // Implementação futura
        return []
    }

    private func loadGoalkeepersRanking() async throws -> [RankingEntry] {
        // Implementação futura
        return []
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

enum RankingTab {
    case general
    case strikers
    case defenders
    case goalkeepers
}
