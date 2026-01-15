//
//  IosRepositoryFactory.swift
//  Futeba dos Parças - iOS
//
//  Factory para criar instâncias de repositories no iOS
//

import Foundation

/// Factory para criar repositories no iOS
class IosRepositoryFactory {
    static let shared = IosRepositoryFactory()

    private init() {}

    // MARK: - Repository Creators

    func createUserRepository() -> AuthRepository {
        return AuthRepositoryImpl()
    }

    func createAuthRepository() -> AuthRepository {
        return AuthRepositoryImpl()
    }

    func createGameRepository() -> GameRepository {
        return GameRepositoryImpl()
    }

    func createGroupRepository() -> GroupRepository {
        return GroupRepositoryImpl()
    }

    func createStatisticsRepository() -> StatisticsRepository {
        return StatisticsRepositoryImpl()
    }

    func createGamificationRepository() -> GamificationRepository {
        return GamificationRepositoryImpl()
    }

    func createRankingRepository() -> RankingRepository {
        return RankingRepositoryImpl()
    }

    func createLocationRepository() -> LocationRepository {
        return LocationRepositoryImpl()
    }

    func createNotificationRepository() -> NotificationRepository {
        return NotificationRepositoryImpl()
    }

    func createCashboxRepository() -> CashboxRepository {
        return CashboxRepositoryImpl()
    }

    func createLiveGameRepository() -> LiveGameRepository {
        return LiveGameRepositoryImpl()
    }
}

// MARK: - Common Result Type

enum AppError: LocalizedError {
    case networkError(String)
    case notFound(String)
    case unauthorized(String)
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .networkError(let msg):
            return "Erro de rede: \(msg)"
        case .notFound(let msg):
            return "Não encontrado: \(msg)"
        case .unauthorized(let msg):
            return "Não autorizado: \(msg)"
        case .unknown(let msg):
            return msg
        }
    }
}

// MARK: - Auth Repository

protocol AuthRepository {
    func getCurrentUser() async throws -> User
    func signIn(email: String, password: String) async throws -> User
    func signUp(email: String, password: String, name: String) async throws -> User
    func signOut()
    func resetPassword(email: String) async throws
    func getUserStreak(userId: String) async throws -> Int
}

class AuthRepositoryImpl: AuthRepository {
    private let db = FirebaseSetup.firestore
    private let auth = FirebaseSetup.auth

    func getCurrentUser() async throws -> User {
        guard let firebaseUser = auth.currentUser else {
            throw AppError.unauthorized("Usuário não logado")
        }

        return try await getUserById(firebaseUser.uid)
    }

    private func getUserById(_ userId: String) async throws -> User {
        let snapshot = try await db.collection("users").document(userId).getDocument()

        guard let data = snapshot.data() else {
            throw AppError.notFound("Usuário não encontrado")
        }

        return try decodeUser(data: data, id: userId)
    }

    private func decodeUser(data: [String: Any], id: String) throws -> User {
        guard let name = data["name"] as? String,
              let email = data["email"] as? String else {
            throw AppError.unknown("Dados inválidos")
        }

        return User(
            id: id,
            name: name,
            email: email,
            photoUrl: data["photoUrl"] as? String,
            level: data["level"] as? Int ?? 1,
            xp: (data["xp"] as? Int64) ?? 0,
            role: data["role"] as? String ?? "PLAYER"
        )
    }

    func signIn(email: String, password: String) async throws -> User {
        let result = try await auth.signIn(withEmail: email, password: password)
        return try await getUserById(result.user.uid)
    }

    func signUp(email: String, password: String, name: String) async throws -> User {
        let result = try await auth.createUser(withEmail: email, password: password)

        // Criar documento do usuário
        let user = User(
            id: result.user.uid,
            name: name,
            email: email,
            photoUrl: nil,
            level: 1,
            xp: 0,
            role: "PLAYER"
        )

        let data: [String: Any] = [
            "name": name,
            "email": email,
            "photoUrl": NSNull(),
            "level": 1,
            "xp": 0,
            "role": "PLAYER",
            "createdAt": FieldValue.serverTimestamp()
        ]

        try await db.collection("users").document(result.user.uid).setData(data)

        return user
    }

    func signOut() {
        try? auth.signOut()
    }

    func resetPassword(email: String) async throws {
        try await auth.sendPasswordReset(withEmail: email)
    }

    func getUserStreak(userId: String) async throws -> Int {
        let snapshot = try await db.collection("users").document(userId).getDocument()

        guard let data = snapshot.data() else {
            return 0
        }

        return data["currentStreak"] as? Int ?? 0
    }
}

// MARK: - Game Repository

protocol GameRepository {
    func getUpcomingGames() async throws -> [Game]
    func getLiveGames() async throws -> [Game]
    func getGameById(_ gameId: String) async throws -> Game
    func createGame(_ game: Game) async throws -> Game
    func updateGame(_ game: Game) async throws
    func deleteGame(_ gameId: String) async throws
}

class GameRepositoryImpl: GameRepository {
    private let db = FirebaseSetup.firestore
    private let auth = FirebaseSetup.auth

    func getUpcomingGames() async throws -> [Game] {
        guard let userId = auth.currentUser?.uid else {
            throw AppError.unauthorized("Usuário não logado")
        }

        let now = Date()
        let snapshot = try await db.collection("games")
            .whereField("date", isGreaterThan: now)
            .whereField("participants.\(userId)", isGreaterThan: "")
            .order(by: "date")
            .limit(to: 20)
            .getDocuments()

        return try snapshot.documents.compactMap { try decodeGame($0.data(), id: $0.documentID) }
    }

    func getLiveGames() async throws -> [Game] {
        let snapshot = try await db.collection("games")
            .whereField("status", isEqualTo: "IN_PROGRESS")
            .limit(to: 10)
            .getDocuments()

        return try snapshot.documents.compactMap { try decodeGame($0.data(), id: $0.documentID) }
    }

    func getGameById(_ gameId: String) async throws -> Game {
        let snapshot = try await db.collection("games").document(gameId).getDocument()

        guard let data = snapshot.data() else {
            throw AppError.notFound("Jogo não encontrado")
        }

        return try decodeGame(data: data, id: snapshot.documentID)
    }

    private func decodeGame(data: [String: Any], id: String) throws -> Game {
        guard let date = (data["date"] as? Timestamp)?.dateValue() else {
            throw AppError.unknown("Data inválida")
        }

        let confirmedPlayers = data["confirmedPlayers"] as? [[String: Any]] ?? []
        let players = confirmedPlayers.compactMap { playerData -> Game.Player? in
            guard let playerId = playerData["userId"] as? String,
                  let playerName = playerData["userName"] as? String else {
                return nil
            }
            return Game.Player(
                id: playerId,
                name: playerName,
                photoUrl: playerData["userPhoto"] as? String
            )
        }

        return Game(
            id: id,
            date: date,
            locationName: data["locationName"] as? String ?? "Local não definido",
            maxPlayers: data["maxPlayers"] as? Int ?? 10,
            confirmedPlayers: players,
            status: GameStatus(rawValue: data["status"] as? String ?? "SCHEDULED") ?? .scheduled,
            team1Score: data["team1Score"] as? Int ?? 0,
            team2Score: data["team2Score"] as? Int ?? 0
        )
    }

    func createGame(_ game: Game) async throws -> Game {
        guard let userId = auth.currentUser?.uid else {
            throw AppError.unauthorized("Usuário não logado")
        }

        var ref: DocumentReference?
        ref = db.collection("games").document()

        let data: [String: Any] = [
            "date": Timestamp(date: game.date),
            "locationName": game.locationName,
            "maxPlayers": game.maxPlayers,
            "status": "SCHEDULED",
            "team1Score": 0,
            "team2Score": 0,
            "createdBy": userId,
            "createdAt": FieldValue.serverTimestamp(),
            "confirmedPlayers": []
        ]

        try await ref?.setData(data)

        return Game(
            id: ref?.documentID ?? "",
            date: game.date,
            locationName: game.locationName,
            maxPlayers: game.maxPlayers,
            confirmedPlayers: [],
            status: .scheduled,
            team1Score: 0,
            team2Score: 0
        )
    }

    func updateGame(_ game: Game) async throws {
        let data: [String: Any] = [
            "locationName": game.locationName,
            "maxPlayers": game.maxPlayers,
            "status": game.status.rawValue,
            "team1Score": game.team1Score,
            "team2Score": game.team2Score
        ]

        try await db.collection("games").document(game.id).updateData(data)
    }

    func deleteGame(_ gameId: String) async throws {
        try await db.collection("games").document(gameId).delete()
    }
}

// MARK: - Statistics Repository

protocol StatisticsRepository {
    func getTotalGamesPlayed(userId: String) async throws -> Int
    func getTotalGoals(userId: String) async throws -> Int
    func getTotalAssists(userId: String) async throws -> Int
    func getTotalWins(userId: String) async throws -> Int
}

class StatisticsRepositoryImpl: StatisticsRepository {
    private let db = FirebaseSetup.firestore

    func getTotalGamesPlayed(userId: String) async throws -> Int {
        let snapshot = try await db.collection("statistics")
            .document(userId)
            .getDocument()

        guard let data = snapshot.data() else {
            return 0
        }

        return data["totalGames"] as? Int ?? 0
    }

    func getTotalGoals(userId: String) async throws -> Int {
        let snapshot = try await db.collection("statistics")
            .document(userId)
            .getDocument()

        guard let data = snapshot.data() else {
            return 0
        }

        return data["goals"] as? Int ?? 0
    }

    func getTotalAssists(userId: String) async throws -> Int {
        let snapshot = try await db.collection("statistics")
            .document(userId)
            .getDocument()

        guard let data = snapshot.data() else {
            return 0
        }

        return data["assists"] as? Int ?? 0
    }

    func getTotalWins(userId: String) async throws -> Int {
        let snapshot = try await db.collection("statistics")
            .document(userId)
            .getDocument()

        guard let data = snapshot.data() else {
            return 0
        }

        return data["wins"] as? Int ?? 0
    }
}

// MARK: - Gamification Repository

protocol GamificationRepository {
    func getRecentBadges(userId: String, limit: Int) async throws -> [Badge]
}

class GamificationRepositoryImpl: GamificationRepository {
    private let db = FirebaseSetup.firestore

    func getRecentBadges(userId: String, limit: Int) async throws -> [Badge] {
        let snapshot = try await db.collection("user_badges")
            .whereField("userId", isEqualTo: userId)
            .order(by: "unlockedAt", descending: true)
            .limit(to: limit)
            .getDocuments()

        return snapshot.documents.compactMap { doc -> Badge? in
            guard let data = doc.data(),
                  let badgeId = data["badgeId"] as? String else {
                return nil
            }

            return Badge(
                id: doc.documentID,
                name: getBadgeName(for: badgeId),
                emoji: getBadgeEmoji(for: badgeId)
            )
        }
    }

    private func getBadgeName(for id: String) -> String {
        switch id {
        case "first_game": return "Primeira Pelada"
        case "streak_5": return "Em Sequência"
        case "top_scorer": return "Artilheiro"
        case "mvp": return "MVP"
        default: return "Conquista"
        }
    }

    private func getBadgeEmoji(for id: String) -> String {
        switch id {
        case "first_game": return "⚽"
        case "streak_5": return "🔥"
        case "top_scorer": return "🥅"
        case "mvp": return "⭐"
        default: return "🏆"
        }
    }
}

// MARK: - Placeholders para outros repositories

protocol GroupRepository {}
class GroupRepositoryImpl: GroupRepository {}

protocol RankingRepository {}
class RankingRepositoryImpl: RankingRepository {}

protocol LocationRepository {}
class LocationRepositoryImpl: LocationRepository {}

protocol NotificationRepository {}
class NotificationRepositoryImpl: NotificationRepository {}

protocol CashboxRepository {}
class CashboxRepositoryImpl: CashboxRepository {}

protocol LiveGameRepository {}
class LiveGameRepositoryImpl: LiveGameRepository {}

// MARK: - Models

struct User {
    let id: String
    let name: String
    let email: String
    let photoUrl: String?
    let level: Int
    let xp: Long
    let role: String
}

struct Game {
    let id: String
    let date: Date
    let locationName: String
    let maxPlayers: Int
    let confirmedPlayers: [Player]
    let status: GameStatus
    let team1Score: Int
    let team2Score: Int

    struct Player {
        let id: String
        let name: String
        let photoUrl: String?
    }
}

enum GameStatus: String {
    case scheduled = "SCHEDULED"
    case confirmed = "CONFIRMED"
    case inProgress = "IN_PROGRESS"
    case finished = "FINISHED"
    case cancelled = "CANCELLED"
}

struct Badge {
    let id: String
    let name: String
    let emoji: String
}
