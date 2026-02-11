package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Cores disponiveis para os coletes/times (versao KMP).
 * Cada cor tem um valor hexadecimal para renderizacao.
 */
// NOTA: TeamColor nao usa @Serializable para evitar bug do
// compilador Kotlin 2.2.x com enums + companion object.
// Serializado como String nos modelos que o referenciam.
enum class TeamColor(val displayName: String, val hexValue: Long) {
    BLUE("Azul", 0xFF2196F3),
    RED("Vermelho", 0xFFF44336),
    GREEN("Verde", 0xFF4CAF50),
    YELLOW("Amarelo", 0xFFFFEB3B),
    WHITE("Branco", 0xFFFFFFFF),
    BLACK("Preto", 0xFF212121),
    ORANGE("Laranja", 0xFFFF9800),
    PURPLE("Roxo", 0xFF9C27B0),
    PINK("Rosa", 0xFFE91E63),
    CYAN("Ciano", 0xFF00BCD4);

    companion object {
        fun fromName(name: String): TeamColor {
            return entries.find { it.name.equals(name, ignoreCase = true) } ?: BLUE
        }
    }
}

/**
 * Par de jogadores que devem ficar juntos durante o sorteio.
 * Usado para manter amigos, casais, pai-filho no mesmo time.
 */
@Serializable
data class PlayerPair(
    @SerialName("player1_id") val player1Id: String = "",
    @SerialName("player2_id") val player2Id: String = "",
    @SerialName("player1_name") val player1Name: String = "",
    @SerialName("player2_name") val player2Name: String = ""
) {
    /**
     * Verifica se o jogador faz parte deste par.
     */
    fun containsPlayer(playerId: String): Boolean =
        player1Id == playerId || player2Id == playerId

    /**
     * Retorna o ID do outro jogador do par.
     */
    fun getPartner(playerId: String): String? = when (playerId) {
        player1Id -> player2Id
        player2Id -> player1Id
        else -> null
    }
}

/**
 * Configuracoes para o sorteio de times.
 */
@Serializable
data class DraftSettings(
    @SerialName("number_of_teams") val numberOfTeams: Int = 2,
    val balanced: Boolean = true,
    @SerialName("consider_positions") val considerPositions: Boolean = true,
    @SerialName("goalkeepers_per_team") val goalkeepersPerTeam: Int = 1,
    val pairs: List<PlayerPair> = emptyList(),
    @SerialName("team_colors") val teamColors: Map<Int, TeamColor> = emptyMap(),
    @SerialName("captain_picks_mode") val captainPicksMode: Boolean = false,
    @SerialName("captain1_id") val captain1Id: String? = null,
    @SerialName("captain2_id") val captain2Id: String? = null,
    @SerialName("pick_timer_seconds") val pickTimerSeconds: Int = 30
) {
    init {
        require(numberOfTeams in MIN_TEAMS..MAX_TEAMS) {
            "numberOfTeams deve estar entre $MIN_TEAMS e $MAX_TEAMS: $numberOfTeams"
        }
        require(goalkeepersPerTeam >= 0) {
            "goalkeepersPerTeam nao pode ser negativo: $goalkeepersPerTeam"
        }
        require(pickTimerSeconds in MIN_PICK_TIMER..MAX_PICK_TIMER) {
            "pickTimerSeconds deve estar entre $MIN_PICK_TIMER e $MAX_PICK_TIMER: $pickTimerSeconds"
        }
    }

    companion object {
        const val MIN_TEAMS = 2
        const val MAX_TEAMS = 8
        const val DEFAULT_TEAMS = 2
        const val MIN_PICK_TIMER = 10
        const val MAX_PICK_TIMER = 120
        const val DEFAULT_PICK_TIMER = 30
    }
}

/**
 * Forca/Overall de um time calculado.
 * Logica pura compartilhavel entre plataformas.
 */
@Serializable
data class TeamStrength(
    @SerialName("team_id") val teamId: String,
    @SerialName("team_name") val teamName: String,
    @SerialName("overall_rating") val overallRating: Float,
    @SerialName("attack_rating") val attackRating: Float,
    @SerialName("defense_rating") val defenseRating: Float,
    @SerialName("midfield_rating") val midfieldRating: Float,
    @SerialName("goalkeeper_rating") val goalkeeperRating: Float,
    @SerialName("player_count") val playerCount: Int,
    @SerialName("has_goalkeeper") val hasGoalkeeper: Boolean
) {
    /**
     * Retorna a diferenca percentual em relacao a outro time.
     */
    fun getDifferencePercent(other: TeamStrength): Float {
        if (overallRating == 0f && other.overallRating == 0f) return 0f
        val max = maxOf(overallRating, other.overallRating)
        return kotlin.math.abs(overallRating - other.overallRating) / max * 100
    }

    /**
     * Verifica se o time esta balanceado com outro (diferenca < 5%).
     */
    fun isBalancedWith(other: TeamStrength): Boolean {
        return getDifferencePercent(other) < 5f
    }

    override fun toString(): String =
        "TeamStrength($teamName: OVR=${"%.1f".format(overallRating)}, " +
            "ATK=${"%.1f".format(attackRating)}, DEF=${"%.1f".format(defenseRating)}, " +
            "MID=${"%.1f".format(midfieldRating)}, GK=${"%.1f".format(goalkeeperRating)}, " +
            "players=$playerCount, hasGK=$hasGoalkeeper)"
}

/**
 * Comparacao entre dois times.
 */
@Serializable
data class TeamComparison(
    val team1: TeamStrength,
    val team2: TeamStrength,
    @SerialName("is_balanced") val isBalanced: Boolean,
    @SerialName("difference_percent") val differencePercent: Float
)

/**
 * Historico de confrontos entre dois grupos de jogadores.
 * Usado para exibir estatisticas de "Time A vs Time B".
 */
@Serializable
data class HeadToHeadHistory(
    @SerialName("team1_player_ids") val team1PlayerIds: List<String> = emptyList(),
    @SerialName("team2_player_ids") val team2PlayerIds: List<String> = emptyList(),
    @SerialName("total_matches") val totalMatches: Int = 0,
    @SerialName("team1_wins") val team1Wins: Int = 0,
    @SerialName("team2_wins") val team2Wins: Int = 0,
    val draws: Int = 0,
    @SerialName("last_matches") val lastMatches: List<HeadToHeadMatch> = emptyList()
) {
    /**
     * Retorna string formatada do historico.
     * Ex: "Ultimos 5: 3V 1E 1D"
     */
    fun getFormattedHistory(): String {
        return "Ultimos ${lastMatches.size}: ${team1Wins}V ${draws}E ${team2Wins}D"
    }
}

/**
 * Representa uma partida no historico de confrontos.
 */
@Serializable
data class HeadToHeadMatch(
    @SerialName("game_id") val gameId: String,
    val date: String,
    @SerialName("team1_score") val team1Score: Int,
    @SerialName("team2_score") val team2Score: Int,
    val winner: Int // 0 = team1, 1 = team2, -1 = draw
)

/**
 * Sugestao de rotacao de times.
 * Sugere trocas para evitar times sempre iguais.
 */
@Serializable
data class TeamRotationSuggestion(
    @SerialName("player1_id") val player1Id: String,
    @SerialName("player1_name") val player1Name: String,
    @SerialName("player2_id") val player2Id: String,
    @SerialName("player2_name") val player2Name: String,
    val reason: String,
    @SerialName("improvement_score") val improvementScore: Float
)

/**
 * Jogador preparado para exibicao no draft com todas as infos necessarias.
 */
@Serializable
data class DraftPlayer(
    val id: String,
    val name: String,
    @SerialName("photo_url") val photoUrl: String? = null,
    val position: PlayerPosition = PlayerPosition.LINE,
    @SerialName("overall_rating") val overallRating: Float = 0f,
    @SerialName("striker_rating") val strikerRating: Float = 0f,
    @SerialName("mid_rating") val midRating: Float = 0f,
    @SerialName("defender_rating") val defenderRating: Float = 0f,
    @SerialName("gk_rating") val gkRating: Float = 0f,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("is_paired") val isPaired: Boolean = false,
    @SerialName("paired_with_id") val pairedWithId: String? = null,
    @SerialName("paired_with_name") val pairedWithName: String? = null
)
