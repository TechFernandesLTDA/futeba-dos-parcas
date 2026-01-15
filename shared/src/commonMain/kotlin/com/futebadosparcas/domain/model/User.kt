package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Roles/papeis do sistema.
 *
 * CMD-10: Definição padronizada de roles no sistema (compartilhada KMP).
 *
 * Como o admin é definido:
 * - Campo 'role' no documento do usuário no Firestore (users/{userId})
 * - Valores possíveis: "ADMIN", "FIELD_OWNER", "PLAYER"
 * - Valor padrão para novos usuários: "PLAYER"
 * - Alteração de role é feita manualmente no banco ou via Cloud Function
 *
 * Matriz de Permissões (CMD-11):
 *
 * | Ação                    | ADMIN | FIELD_OWNER | PLAYER |
 * |-------------------------|-------|-------------|--------|
 * | Criar jogo              | ✓     | ✓           | ✓      |
 * | Editar qualquer jogo    | ✓     | próprios    | próprios|
 * | Deletar qualquer jogo   | ✓     | próprios    | próprios|
 * | Criar local             | ✓     | ✓           | ✗      |
 * | Editar qualquer local   | ✓     | próprios    | ✗      |
 * | Gerenciar usuários      | ✓     | ✗           | ✗      |
 * | Ver stats globais       | ✓     | ✓           | ✗      |
 * | Editar rankings         | ✓     | ✗           | ✗      |
 * | Ajustar XP              | ✓     | ✗           | ✗      |
 *
 * Veja também: UserPermissions.kt para matriz de permissões completa.
 */
@Serializable
enum class UserRole(val displayName: String, val description: String) {
    /**
     * Administrador do sistema.
     * Tem acesso total a todas as funcionalidades.
     */
    @SerialName("ADMIN")
    ADMIN("Administrador", "Acesso total ao sistema"),

    /**
     * Dono de quadra/local.
     * Pode gerenciar seus próprios locais e quadras.
     */
    @SerialName("FIELD_OWNER")
    FIELD_OWNER("Dono de Quadra", "Gerencia locais, quadras e reservas"),

    /**
     * Jogador comum.
     * Pode criar jogos, confirmar presença e ver estatísticas pessoais.
     */
    @SerialName("PLAYER")
    PLAYER("Jogador", "Cria jogos e confirma presença");

    companion object {
        fun fromString(value: String?): UserRole {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: PLAYER
        }
    }
}

/**
 * Roles de rating do jogador.
 */
@Serializable
enum class PlayerRatingRole {
    @SerialName("STRIKER")
    STRIKER,

    @SerialName("MID")
    MID,

    @SerialName("DEFENDER")
    DEFENDER,

    @SerialName("GOALKEEPER")
    GOALKEEPER
}

/**
 * Usuario do sistema (versao compartilhada KMP).
 */
@Serializable
data class User(
    val id: String = "",
    val email: String = "",
    val name: String = "",
    val phone: String? = null,
    val nickname: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("fcm_token") val fcmToken: String? = null,
    @SerialName("is_searchable") val isSearchable: Boolean = true,
    @SerialName("is_profile_public") val isProfilePublic: Boolean = true,
    val role: String = UserRole.PLAYER.name,
    @SerialName("created_at") val createdAt: Long? = null,
    @SerialName("updated_at") val updatedAt: Long? = null,

    // Ratings manuais (0.0 - 5.0)
    @SerialName("striker_rating") val strikerRating: Double = 0.0,
    @SerialName("mid_rating") val midRating: Double = 0.0,
    @SerialName("defender_rating") val defenderRating: Double = 0.0,
    @SerialName("gk_rating") val gkRating: Double = 0.0,

    // Posicao preferida
    @SerialName("preferred_position") val preferredPosition: String? = null,
    @SerialName("preferred_field_types") val preferredFieldTypes: List<FieldType> = emptyList(),

    // Informacoes pessoais
    @SerialName("birth_date") val birthDate: Long? = null,
    val gender: String? = null,
    @SerialName("height_cm") val heightCm: Int? = null,
    @SerialName("weight_kg") val weightKg: Int? = null,
    @SerialName("dominant_foot") val dominantFoot: String? = null,
    @SerialName("primary_position") val primaryPosition: String? = null,
    @SerialName("secondary_position") val secondaryPosition: String? = null,
    @SerialName("play_style") val playStyle: String? = null,
    @SerialName("experience_years") val experienceYears: Int? = null,

    // Gamificacao
    val level: Int = 1,
    @SerialName("experience_points") val experiencePoints: Long = 0L,
    @SerialName("milestones_achieved") val milestonesAchieved: List<String> = emptyList(),

    // Ratings automaticos
    @SerialName("auto_striker_rating") val autoStrikerRating: Double = 0.0,
    @SerialName("auto_mid_rating") val autoMidRating: Double = 0.0,
    @SerialName("auto_defender_rating") val autoDefenderRating: Double = 0.0,
    @SerialName("auto_gk_rating") val autoGkRating: Double = 0.0,
    @SerialName("auto_rating_samples") val autoRatingSamples: Int = 0
) {
    /**
     * Retorna o enum de Role do usuario.
     */
    fun getRoleEnum(): UserRole = UserRole.fromString(role)

    /**
     * Verifica se o usuario tem permissao de admin.
     */
    fun isAdmin(): Boolean = getRoleEnum() == UserRole.ADMIN

    /**
     * Verifica se o usuario e dono de quadra/local.
     */
    fun isFieldOwner(): Boolean = getRoleEnum() == UserRole.FIELD_OWNER || isAdmin()

    /**
     * Retorna o nome de exibicao (Apelido se houver, senao o Nome).
     */
    fun getDisplayName(): String = nickname?.takeIf { it.isNotBlank() } ?: name

    /**
     * Retorna a confianca das notas automaticas (0.0 - 1.0).
     */
    fun getAutoRatingConfidence(): Double {
        if (autoRatingSamples <= 0) return 0.0
        return (autoRatingSamples / 20.0).coerceIn(0.0, 1.0)
    }

    /**
     * Retorna a nota manual do jogador para uma funcao.
     */
    fun getManualRating(role: PlayerRatingRole): Double {
        return when (role) {
            PlayerRatingRole.STRIKER -> strikerRating
            PlayerRatingRole.MID -> midRating
            PlayerRatingRole.DEFENDER -> defenderRating
            PlayerRatingRole.GOALKEEPER -> gkRating
        }
    }

    /**
     * Retorna a nota automatica do jogador para uma funcao.
     */
    fun getAutoRating(role: PlayerRatingRole): Double {
        return when (role) {
            PlayerRatingRole.STRIKER -> autoStrikerRating
            PlayerRatingRole.MID -> autoMidRating
            PlayerRatingRole.DEFENDER -> autoDefenderRating
            PlayerRatingRole.GOALKEEPER -> autoGkRating
        }
    }

    /**
     * Retorna a nota efetiva (manual + automatica) para uma funcao.
     */
    fun getEffectiveRating(role: PlayerRatingRole): Double {
        val manual = getManualRating(role)
        val auto = getAutoRating(role)
        if (auto <= 0.0) return manual
        if (manual <= 0.0) return auto

        val confidence = getAutoRatingConfidence()
        return ((manual * (1.0 - confidence)) + (auto * confidence)).coerceIn(0.0, 5.0)
    }

    /**
     * Retorna a media geral do jogador.
     */
    fun getOverallRating(): Double {
        val ratings = listOf(
            getEffectiveRating(PlayerRatingRole.STRIKER),
            getEffectiveRating(PlayerRatingRole.MID),
            getEffectiveRating(PlayerRatingRole.DEFENDER)
        ).filter { it > 0 }

        return if (ratings.isEmpty()) 0.0 else ratings.average()
    }
}
