package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Categorias de votacao para jogo.
 * Inclui categorias padrão e customizáveis.
 */
@Serializable
enum class VoteCategory(val displayName: String, val isDefault: Boolean = true) {
    @SerialName("MVP")
    MVP("Craque da Partida", true),

    @SerialName("WORST")
    WORST("Bola Murcha", true),

    @SerialName("BEST_GOALKEEPER")
    BEST_GOALKEEPER("Melhor Goleiro", true),

    @SerialName("CUSTOM")
    CUSTOM("Categoria Personalizada", false)
}

/**
 * Categoria customizada definida pelo grupo.
 */
@Serializable
data class CustomVoteCategory(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val emoji: String = "",
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("created_at") val createdAt: Long = 0,
    @SerialName("for_goalkeepers_only") val forGoalkeepersOnly: Boolean = false,
    @SerialName("for_field_players_only") val forFieldPlayersOnly: Boolean = false
)

/**
 * Configurações de votação do grupo.
 */
@Serializable
data class VotingSettings(
    @SerialName("is_anonymous") val isAnonymous: Boolean = false,
    @SerialName("voting_timeout_hours") val votingTimeoutHours: Int = 24,
    @SerialName("show_top_3") val showTop3: Boolean = true,
    @SerialName("separate_goalkeeper_voting") val separateGoalkeeperVoting: Boolean = false,
    @SerialName("allow_skip_vote") val allowSkipVote: Boolean = true,
    @SerialName("custom_categories") val customCategories: List<CustomVoteCategory> = emptyList(),
    @SerialName("enabled_categories") val enabledCategories: List<String> = listOf(
        VoteCategory.MVP.name,
        VoteCategory.BEST_GOALKEEPER.name,
        VoteCategory.WORST.name
    )
)

/**
 * Voto de um jogador para outro em uma categoria (MVP, Melhor Goleiro, Bola Murcha).
 * Colecao: mvp_votes
 * ID do documento: {gameId}_{voterId}_{category}
 */
@Serializable
data class MVPVote(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("voter_id") val voterId: String = "",
    @SerialName("voted_player_id") val votedPlayerId: String = "",
    val category: VoteCategory = VoteCategory.MVP,
    @SerialName("custom_category_id") val customCategoryId: String? = null,
    @SerialName("voted_at") val votedAt: Long? = null,
    @SerialName("skipped") val skipped: Boolean = false
)

/**
 * Avaliação de atributos de um jogador por outro (1-5 estrelas).
 * Atributos: Defesa, Ataque, Técnica, Raça, Fair Play.
 */
@Serializable
data class AttributeRating(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("rater_id") val raterId: String = "",
    @SerialName("rated_player_id") val ratedPlayerId: String = "",
    @SerialName("defense") val defense: Int = 0, // 1-5
    @SerialName("attack") val attack: Int = 0, // 1-5
    @SerialName("technique") val technique: Int = 0, // 1-5
    @SerialName("hustle") val hustle: Int = 0, // 1-5 - Raça
    @SerialName("fair_play") val fairPlay: Int = 0, // 1-5
    @SerialName("rated_at") val ratedAt: Long? = null
) {
    /**
     * Calcula a média geral dos atributos.
     */
    fun calculateOverall(): Double {
        val sum = defense + attack + technique + hustle + fairPlay
        return if (sum > 0) sum / 5.0 else 0.0
    }
}

/**
 * Streak de MVP consecutivos de um jogador.
 */
@Serializable
data class MVPStreak(
    @SerialName("user_id") val userId: String = "",
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("max_streak") val maxStreak: Int = 0,
    @SerialName("last_mvp_game_id") val lastMvpGameId: String = "",
    @SerialName("updated_at") val updatedAt: Long = 0
)

/**
 * Resultado da votacao para exibicao.
 */
@Serializable
data class MVPVoteResult(
    val playerId: String = "",
    val playerName: String = "",
    val playerPhoto: String? = null,
    val voteCount: Int = 0,
    val percentage: Double = 0.0,
    val position: Int = 0, // 1 = Ouro, 2 = Prata, 3 = Bronze
    val category: VoteCategory = VoteCategory.MVP,
    @SerialName("voters") val voters: List<String> = emptyList() // IDs dos votantes (vazio se anônimo)
)

/**
 * Resultado completo da votação com podium (top 3).
 */
@Serializable
data class VoteResultWithPodium(
    val category: VoteCategory,
    @SerialName("custom_category_id") val customCategoryId: String? = null,
    @SerialName("custom_category_name") val customCategoryName: String? = null,
    val results: List<MVPVoteResult> = emptyList(),
    @SerialName("total_votes") val totalVotes: Int = 0,
    @SerialName("skipped_count") val skippedCount: Int = 0,
    @SerialName("is_anonymous") val isAnonymous: Boolean = false
) {
    val gold: MVPVoteResult? get() = results.getOrNull(0)
    val silver: MVPVoteResult? get() = results.getOrNull(1)
    val bronze: MVPVoteResult? get() = results.getOrNull(2)
}

/**
 * Dados para card de compartilhamento do MVP.
 */
@Serializable
data class MVPShareCardData(
    @SerialName("player_id") val playerId: String = "",
    @SerialName("player_name") val playerName: String = "",
    @SerialName("player_photo") val playerPhoto: String? = null,
    @SerialName("game_date") val gameDate: String = "",
    @SerialName("game_location") val gameLocation: String = "",
    @SerialName("team1_score") val team1Score: Int = 0,
    @SerialName("team2_score") val team2Score: Int = 0,
    @SerialName("vote_count") val voteCount: Int = 0,
    @SerialName("vote_percentage") val votePercentage: Double = 0.0,
    @SerialName("mvp_streak") val mvpStreak: Int = 0,
    val category: VoteCategory = VoteCategory.MVP
)

/**
 * Placar ao vivo de um jogo (legado - ver LiveScore em LiveGame.kt para a versao KMP).
 * Mantido para compatibilidade com codigo Android existente.
 */
@Serializable
data class LiveGameScore(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("team1_id") val team1Id: String = "",
    @SerialName("team1_score") val team1Score: Int = 0,
    @SerialName("team2_id") val team2Id: String = "",
    @SerialName("team2_score") val team2Score: Int = 0,
    @SerialName("started_at") val startedAt: Long? = null,
    @SerialName("finished_at") val finishedAt: Long? = null
)

/**
 * Evento de jogo para compatibilidade com Android.
 * Ver GameEvent em LiveGame.kt para a versao KMP completa.
 */
@Serializable
data class GameEventData(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("event_type") val eventType: String = GameEventType.GOAL.name,
    @SerialName("player_id") val playerId: String = "",
    @SerialName("player_name") val playerName: String = "",
    @SerialName("team_id") val teamId: String = "",
    @SerialName("assisted_by_id") val assistedById: String? = null,
    @SerialName("assisted_by_name") val assistedByName: String? = null,
    val minute: Int = 0,
    @SerialName("created_at") val createdAt: Long? = null
)
