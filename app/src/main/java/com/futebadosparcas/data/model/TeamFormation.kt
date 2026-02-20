package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Cores disponiveis para os coletes/times.
 * Cada cor tem um valor hexadecimal para renderizacao.
 */
enum class TeamColor(
    val displayName: String,
    val hexValue: Long
) {
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
@IgnoreExtraProperties
data class PlayerPair(
    val player1Id: String = "",
    val player2Id: String = "",
    @get:PropertyName("player1_name")
    @set:PropertyName("player1_name")
    var player1Name: String = "",
    @get:PropertyName("player2_name")
    @set:PropertyName("player2_name")
    var player2Name: String = ""
) {
    constructor() : this(player1Id = "")

    /**
     * Verifica se o jogador faz parte deste par.
     */
    @Exclude
    fun containsPlayer(playerId: String): Boolean =
        player1Id == playerId || player2Id == playerId

    /**
     * Retorna o outro jogador do par.
     */
    @Exclude
    fun getPartner(playerId: String): String? = when (playerId) {
        player1Id -> player2Id
        player2Id -> player1Id
        else -> null
    }
}

/**
 * Configuracoes para o sorteio de times.
 */
data class DraftSettings(
    val numberOfTeams: Int = 2,
    val balanced: Boolean = true,
    val considerPositions: Boolean = true,
    val goalkeepersPerTeam: Int = 1,
    val pairs: List<PlayerPair> = emptyList(),
    val teamColors: Map<Int, TeamColor> = mapOf(0 to TeamColor.BLUE, 1 to TeamColor.RED),
    val captainPicksMode: Boolean = false,
    val captain1Id: String? = null,
    val captain2Id: String? = null,
    val pickTimerSeconds: Int = 30
)

/**
 * Estado do draft quando usando modo de capitaes.
 */
sealed class DraftState {
    /** Aguardando inicio do draft */
    object WaitingToStart : DraftState()

    /** Selecionando capitaes */
    data class SelectingCaptains(
        val captain1Id: String? = null,
        val captain2Id: String? = null
    ) : DraftState()

    /** Draft em andamento - vez de um capitao escolher */
    data class InProgress(
        val currentPickerId: String,
        val currentPickerName: String,
        val pickNumber: Int,
        val team1Picks: List<String>,
        val team2Picks: List<String>,
        val remainingPlayers: List<String>,
        val timerSeconds: Int,
        val isTeam1Turn: Boolean
    ) : DraftState()

    /** Draft finalizado */
    data class Completed(
        val team1: List<String>,
        val team2: List<String>
    ) : DraftState()
}

/**
 * Animacao de revelacao de jogador no draft.
 */
data class DraftRevealAnimation(
    val playerId: String,
    val playerName: String,
    val playerPhoto: String?,
    val teamIndex: Int,
    val teamName: String,
    val teamColor: TeamColor,
    val isRevealing: Boolean = false,
    val revealDelayMs: Long = 0
)

/**
 * Formacao de time favorita/salva.
 * Permite salvar e reutilizar formacoes frequentes.
 */
@IgnoreExtraProperties
data class SavedTeamFormation(
    @DocumentId
    val id: String = "",
    @get:PropertyName("owner_id")
    @set:PropertyName("owner_id")
    var ownerId: String = "",
    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String? = null,
    val name: String = "",
    @get:PropertyName("team1_player_ids")
    @set:PropertyName("team1_player_ids")
    var team1PlayerIds: List<String> = emptyList(),
    @get:PropertyName("team2_player_ids")
    @set:PropertyName("team2_player_ids")
    var team2PlayerIds: List<String> = emptyList(),
    @get:PropertyName("team1_name")
    @set:PropertyName("team1_name")
    var team1Name: String = "Time 1",
    @get:PropertyName("team2_name")
    @set:PropertyName("team2_name")
    var team2Name: String = "Time 2",
    @get:PropertyName("team1_color")
    @set:PropertyName("team1_color")
    var team1Color: String = TeamColor.BLUE.name,
    @get:PropertyName("team2_color")
    @set:PropertyName("team2_color")
    var team2Color: String = TeamColor.RED.name,
    @get:PropertyName("times_used")
    @set:PropertyName("times_used")
    var timesUsed: Int = 0,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,
    @ServerTimestamp
    @get:PropertyName("last_used_at")
    @set:PropertyName("last_used_at")
    var lastUsedAt: Date? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun getTeam1ColorEnum(): TeamColor = TeamColor.fromName(team1Color)

    @Exclude
    fun getTeam2ColorEnum(): TeamColor = TeamColor.fromName(team2Color)

    /**
     * Retorna todos os IDs de jogadores nesta formacao.
     */
    @Exclude
    fun getAllPlayerIds(): List<String> = team1PlayerIds + team2PlayerIds

    /**
     * Verifica se todos os jogadores fornecidos estao presentes nesta formacao.
     */
    @Exclude
    fun containsAllPlayers(playerIds: List<String>): Boolean {
        val allPlayers = getAllPlayerIds().toSet()
        return playerIds.all { it in allPlayers }
    }
}

/**
 * Historico de confrontos entre dois grupos de jogadores.
 * Usado para exibir estatisticas de "Time A vs Time B".
 */
data class HeadToHeadHistory(
    val team1PlayerIds: Set<String>,
    val team2PlayerIds: Set<String>,
    val totalMatches: Int = 0,
    val team1Wins: Int = 0,
    val team2Wins: Int = 0,
    val draws: Int = 0,
    val lastMatches: List<HeadToHeadMatch> = emptyList()
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
data class HeadToHeadMatch(
    val gameId: String,
    val date: String,
    val team1Score: Int,
    val team2Score: Int,
    val winner: Int // 0 = team1, 1 = team2, -1 = draw
)

/**
 * Sugestao de rotacao de times.
 * Sugere trocas para evitar times sempre iguais.
 */
data class TeamRotationSuggestion(
    val player1Id: String,
    val player1Name: String,
    val player2Id: String,
    val player2Name: String,
    val reason: String,
    val improvementScore: Float
)

/**
 * Forca/Overall de um time calculado.
 */
data class TeamStrength(
    val teamId: String,
    val teamName: String,
    val overallRating: Float,
    val attackRating: Float,
    val defenseRating: Float,
    val midfieldRating: Float,
    val goalkeeperRating: Float,
    val playerCount: Int,
    val hasGoalkeeper: Boolean
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
}

/**
 * Comparacao entre dois times.
 */
data class TeamComparison(
    val team1: TeamStrength,
    val team2: TeamStrength,
    val isBalanced: Boolean,
    val differencePercent: Float,
    val headToHead: HeadToHeadHistory?
)

/**
 * Jogador preparado para exibicao no draft com todas as infos necessarias.
 */
data class DraftPlayer(
    val id: String,
    val name: String,
    val photoUrl: String?,
    val position: PlayerPosition,
    val overallRating: Float,
    val strikerRating: Float,
    val midRating: Float,
    val defenderRating: Float,
    val gkRating: Float,
    val teamId: String? = null,
    val isPaired: Boolean = false,
    val pairedWithId: String? = null,
    val pairedWithName: String? = null
)
