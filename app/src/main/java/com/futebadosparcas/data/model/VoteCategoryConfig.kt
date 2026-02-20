package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Configuracao de categoria de votacao para grupos (#52).
 *
 * Permite que grupos definam categorias customizaveis alem das padroes
 * (MVP, Melhor Goleiro, Bola Murcha).
 *
 * Armazenado em: groups/{groupId}/vote_categories/{categoryId}
 */
@IgnoreExtraProperties
data class VoteCategoryConfig(
    @DocumentId
    val id: String = "",

    /**
     * Nome da categoria (ex: "Melhor Defensor", "Gol Mais Bonito")
     */
    val name: String = "",

    /**
     * Descricao da categoria
     */
    val description: String = "",

    /**
     * Emoji para exibicao (ex: "⚽", "🏆", "🧤")
     */
    val emoji: String = "🏆",

    /**
     * Se a categoria esta ativa para votacao
     */
    @get:PropertyName("is_active")
    @set:PropertyName("is_active")
    var isActive: Boolean = true,

    /**
     * Tipo da categoria (default ou custom)
     */
    @get:PropertyName("category_type")
    @set:PropertyName("category_type")
    var categoryType: String = VoteCategoryType.CUSTOM.name,

    /**
     * Se a categoria eh restrita a goleiros
     * (apenas goleiros podem votar e ser votados)
     */
    @get:PropertyName("for_goalkeepers_only")
    @set:PropertyName("for_goalkeepers_only")
    var forGoalkeepersOnly: Boolean = false,

    /**
     * Se a categoria eh restrita a jogadores de linha
     * (apenas jogadores de linha podem votar e ser votados)
     */
    @get:PropertyName("for_field_players_only")
    @set:PropertyName("for_field_players_only")
    var forFieldPlayersOnly: Boolean = false,

    /**
     * Ordem de exibicao na votacao
     */
    @get:PropertyName("display_order")
    @set:PropertyName("display_order")
    var displayOrder: Int = 0,

    /**
     * XP bonus concedido ao vencedor desta categoria
     * (0 para usar valor padrao do sistema)
     */
    @get:PropertyName("xp_bonus")
    @set:PropertyName("xp_bonus")
    var xpBonus: Int = 0,

    /**
     * ID do grupo dono desta categoria
     */
    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String = "",

    /**
     * ID do usuario que criou a categoria
     */
    @get:PropertyName("created_by")
    @set:PropertyName("created_by")
    var createdBy: String = "",

    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,

    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null
) {
    constructor() : this(id = "")

    /**
     * Retorna o VoteCategory correspondente para uso no sistema de votacao
     */
    @Exclude
    fun toVoteCategory(): VoteCategory {
        return when (categoryType) {
            VoteCategoryType.MVP.name -> VoteCategory.MVP
            VoteCategoryType.BEST_GOALKEEPER.name -> VoteCategory.BEST_GOALKEEPER
            VoteCategoryType.WORST.name -> VoteCategory.WORST
            else -> VoteCategory.CUSTOM
        }
    }

    /**
     * Verifica se um jogador pode votar nesta categoria
     */
    @Exclude
    fun canPlayerVote(isGoalkeeper: Boolean): Boolean {
        return when {
            forGoalkeepersOnly && !isGoalkeeper -> false
            forFieldPlayersOnly && isGoalkeeper -> false
            else -> true
        }
    }

    /**
     * Verifica se um jogador pode ser votado nesta categoria
     */
    @Exclude
    fun canPlayerBeVoted(isGoalkeeper: Boolean): Boolean {
        return when {
            forGoalkeepersOnly && !isGoalkeeper -> false
            forFieldPlayersOnly && isGoalkeeper -> false
            else -> true
        }
    }
}

/**
 * Tipo de categoria de votacao
 */
enum class VoteCategoryType(val displayName: String, val isDefault: Boolean) {
    MVP("Craque da Partida", true),
    BEST_GOALKEEPER("Melhor Goleiro", true),
    WORST("Bola Murcha", true),
    CUSTOM("Personalizada", false);

    companion object {
        fun getDefaults(): List<VoteCategoryType> = entries.filter { it.isDefault }

        fun fromString(value: String?): VoteCategoryType {
            return entries.find { it.name == value } ?: CUSTOM
        }
    }
}

/**
 * Configuracoes de XP para vencedores de votacao (#57).
 * Define quanto XP cada posicao no podium recebe.
 */
object VoteXpRewards {
    // MVP (1o lugar)
    const val MVP_FIRST_PLACE = 100
    const val MVP_SECOND_PLACE = 50
    const val MVP_THIRD_PLACE = 25

    // Melhor Goleiro
    const val GK_FIRST_PLACE = 75
    const val GK_SECOND_PLACE = 40
    const val GK_THIRD_PLACE = 20

    // Bola Murcha (penalidade)
    const val WORST_FIRST_PLACE = -25

    // Streak bonus (#59)
    const val MVP_STREAK_3X_BONUS = 50
    const val MVP_STREAK_5X_BONUS = 100
    const val MVP_STREAK_10X_BONUS = 200

    /**
     * Retorna o XP para uma posicao no podium
     */
    fun getXpForPosition(category: VoteCategory, position: Int): Int {
        return when (category) {
            VoteCategory.MVP -> when (position) {
                1 -> MVP_FIRST_PLACE
                2 -> MVP_SECOND_PLACE
                3 -> MVP_THIRD_PLACE
                else -> 0
            }
            VoteCategory.BEST_GOALKEEPER -> when (position) {
                1 -> GK_FIRST_PLACE
                2 -> GK_SECOND_PLACE
                3 -> GK_THIRD_PLACE
                else -> 0
            }
            VoteCategory.WORST -> if (position == 1) WORST_FIRST_PLACE else 0
            VoteCategory.CUSTOM -> when (position) {
                1 -> 50
                2 -> 25
                3 -> 10
                else -> 0
            }
        }
    }

    /**
     * Retorna o bonus de streak de MVP
     */
    fun getStreakBonus(streakCount: Int): Int {
        return when {
            streakCount >= 10 -> MVP_STREAK_10X_BONUS
            streakCount >= 5 -> MVP_STREAK_5X_BONUS
            streakCount >= 3 -> MVP_STREAK_3X_BONUS
            else -> 0
        }
    }
}

/**
 * Categorias padrao pre-definidas para novos grupos
 */
object DefaultVoteCategories {
    fun createDefaults(groupId: String, createdBy: String): List<VoteCategoryConfig> {
        return listOf(
            VoteCategoryConfig(
                id = "mvp",
                name = "Craque da Partida",
                description = "O melhor jogador da partida",
                emoji = "⭐",
                isActive = true,
                categoryType = VoteCategoryType.MVP.name,
                displayOrder = 0,
                xpBonus = VoteXpRewards.MVP_FIRST_PLACE,
                groupId = groupId,
                createdBy = createdBy
            ),
            VoteCategoryConfig(
                id = "best_gk",
                name = "Melhor Goleiro",
                description = "Quem fechou o gol?",
                emoji = "🧤",
                isActive = true,
                categoryType = VoteCategoryType.BEST_GOALKEEPER.name,
                forGoalkeepersOnly = false, // Todos votam, mas so goleiros podem ganhar
                displayOrder = 1,
                xpBonus = VoteXpRewards.GK_FIRST_PLACE,
                groupId = groupId,
                createdBy = createdBy
            ),
            VoteCategoryConfig(
                id = "worst",
                name = "Bola Murcha",
                description = "Quem nao jogou nada hoje?",
                emoji = "😅",
                isActive = true,
                categoryType = VoteCategoryType.WORST.name,
                displayOrder = 2,
                xpBonus = VoteXpRewards.WORST_FIRST_PLACE,
                groupId = groupId,
                createdBy = createdBy
            )
        )
    }

    /**
     * Exemplos de categorias customizadas que o grupo pode adicionar
     */
    fun getExampleCustomCategories(): List<VoteCategoryConfig> {
        return listOf(
            VoteCategoryConfig(
                name = "Melhor Defensor",
                description = "O jogador que mais segurou atras",
                emoji = "🛡️",
                forFieldPlayersOnly = true
            ),
            VoteCategoryConfig(
                name = "Gol Mais Bonito",
                description = "O gol mais plastico da partida",
                emoji = "⚽"
            ),
            VoteCategoryConfig(
                name = "Fair Play",
                description = "O jogador mais esportivo",
                emoji = "🤝"
            ),
            VoteCategoryConfig(
                name = "Revela\u00e7\u00e3o",
                description = "O jogador que mais surpreendeu",
                emoji = "🌟"
            )
        )
    }
}

/**
 * Configurações de votação do grupo (#51-60)
 *
 * Define como a votação funciona no grupo:
 * - Categorias ativas
 * - Tempo limite para votação
 * - Se votação é obrigatória
 */
@IgnoreExtraProperties
data class VotingSettings(
    /**
     * Se a votação está habilitada no grupo
     */
    @get:PropertyName("is_enabled")
    @set:PropertyName("is_enabled")
    var isEnabled: Boolean = true,

    /**
     * Tempo limite para votação em minutos após o fim do jogo
     */
    @get:PropertyName("voting_timeout_minutes")
    @set:PropertyName("voting_timeout_minutes")
    var votingTimeoutMinutes: Int = 60,

    /**
     * Se a votação é obrigatória para receber XP do jogo
     */
    @get:PropertyName("is_mandatory")
    @set:PropertyName("is_mandatory")
    var isMandatory: Boolean = false,

    /**
     * Se permite votação anônima
     */
    @get:PropertyName("allow_anonymous")
    @set:PropertyName("allow_anonymous")
    var allowAnonymous: Boolean = false,

    /**
     * Categorias de votação ativas
     */
    @get:PropertyName("active_categories")
    @set:PropertyName("active_categories")
    var activeCategories: List<String> = listOf(
        VoteCategoryType.MVP.name,
        VoteCategoryType.BEST_GOALKEEPER.name,
        VoteCategoryType.WORST.name
    )
) {
    constructor() : this(isEnabled = true)
}
