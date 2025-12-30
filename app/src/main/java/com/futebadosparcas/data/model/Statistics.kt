package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId

/**
 * Estatisticas do usuario.
 *
 * IMPORTANTE: Os nomes dos campos NO FIRESTORE devem ser em camelCase
 * para que as queries orderBy funcionem corretamente.
 * Ex: orderBy("totalGoals") requer campo "totalGoals" no documento.
 */
data class UserStatistics(
    @DocumentId
    val id: String = "", // mesmo ID do usuario
    var totalGames: Int = 0,
    var totalGoals: Int = 0,
    var totalAssists: Int = 0,
    var totalSaves: Int = 0,
    var totalYellowCards: Int = 0,
    var totalRedCards: Int = 0,
    var bestPlayerCount: Int = 0,
    var worstPlayerCount: Int = 0,
    var bestGoalCount: Int = 0,
    var gamesWon: Int = 0,
    var gamesLost: Int = 0,
    var gamesDraw: Int = 0
) {
    constructor() : this(id = "")

    val presenceRate: Double
        get() = if (totalGames > 0) 1.0 else 0.0

    val avgGoalsPerGame: Double
        get() = if (totalGames > 0) totalGoals.toDouble() / totalGames else 0.0

    val avgSavesPerGame: Double
        get() = if (totalGames > 0) totalSaves.toDouble() / totalGames else 0.0

    val totalCards: Int
        get() = totalYellowCards + totalRedCards
}

data class RankingEntry(
    val userId: String = "",
    val userName: String = "",
    val userPhoto: String? = null,
    val value: Int = 0,
    val totalGames: Int = 0,
    val average: Double = 0.0
) {
    constructor() : this(userId = "")
}
