package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Calendar
import java.util.Date

@IgnoreExtraProperties
data class User(
    @DocumentId
    val id: String = "",
    val email: String = "",
    val name: String = "",
    val phone: String? = null,
    val nickname: String? = null,
    @get:PropertyName("photo_url")
    @set:PropertyName("photo_url")
    var photoUrl: String? = null,
    @get:PropertyName("preferred_field_types")
    @set:PropertyName("preferred_field_types")
    var preferredFieldTypes: List<FieldType> = emptyList(),
    @get:PropertyName("is_searchable")
    @set:PropertyName("is_searchable")
    var isSearchable: Boolean = true,
    @get:PropertyName("is_profile_public")
    @set:PropertyName("is_profile_public")
    var isProfilePublic: Boolean = true,
    @get:PropertyName("fcm_token")
    @set:PropertyName("fcm_token")
    var fcmToken: String? = null,
    val role: String = UserRole.PLAYER.name,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,
    @ServerTimestamp
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null,
    
    // Ratings (0.0 - 5.0)
    @get:PropertyName("striker_rating")
    @set:PropertyName("striker_rating")
    var strikerRating: Double = 0.0,
    @get:PropertyName("mid_rating")
    @set:PropertyName("mid_rating")
    var midRating: Double = 0.0,
    @get:PropertyName("defender_rating")
    @set:PropertyName("defender_rating")
    var defenderRating: Double = 0.0,
    @get:PropertyName("gk_rating")
    @set:PropertyName("gk_rating")
    var gkRating: Double = 0.0,

    // Posição preferida do jogador (GOALKEEPER ou LINE_PLAYER)
    @get:PropertyName("preferred_position")
    @set:PropertyName("preferred_position")
    var preferredPosition: String? = null,

    // Informacoes pessoais e perfil do jogador
    @get:PropertyName("birth_date")
    @set:PropertyName("birth_date")
    var birthDate: Date? = null,
    @get:PropertyName("gender")
    @set:PropertyName("gender")
    var gender: String? = null,
    @get:PropertyName("height_cm")
    @set:PropertyName("height_cm")
    var heightCm: Int? = null,
    @get:PropertyName("weight_kg")
    @set:PropertyName("weight_kg")
    var weightKg: Int? = null,
    @get:PropertyName("dominant_foot")
    @set:PropertyName("dominant_foot")
    var dominantFoot: String? = null,
    @get:PropertyName("primary_position")
    @set:PropertyName("primary_position")
    var primaryPosition: String? = null,
    @get:PropertyName("secondary_position")
    @set:PropertyName("secondary_position")
    var secondaryPosition: String? = null,
    @get:PropertyName("play_style")
    @set:PropertyName("play_style")
    var playStyle: String? = null,
    @get:PropertyName("experience_years")
    @set:PropertyName("experience_years")
    var experienceYears: Int? = null,

    // Nível/XP do jogador para gamificação
    @get:PropertyName("level")
    @set:PropertyName("level")
    var level: Int = 1,

    @get:PropertyName("experience_points")
    @set:PropertyName("experience_points")
    var experiencePoints: Long = 0L,

    // Milestones ja conquistados (para evitar duplicacao)
    @get:PropertyName("milestones_achieved")
    @set:PropertyName("milestones_achieved")
    var milestonesAchieved: List<String> = emptyList(),

    // Ratings baseados em performance (0.0 - 5.0)
    @get:PropertyName("auto_striker_rating")
    @set:PropertyName("auto_striker_rating")
    var autoStrikerRating: Double = 0.0,
    @get:PropertyName("auto_mid_rating")
    @set:PropertyName("auto_mid_rating")
    var autoMidRating: Double = 0.0,
    @get:PropertyName("auto_defender_rating")
    @set:PropertyName("auto_defender_rating")
    var autoDefenderRating: Double = 0.0,
    @get:PropertyName("auto_gk_rating")
    @set:PropertyName("auto_gk_rating")
    var autoGkRating: Double = 0.0,
    @get:PropertyName("auto_rating_samples")
    @set:PropertyName("auto_rating_samples")
    var autoRatingSamples: Int = 0,
    @get:PropertyName("auto_rating_updated_at")
    @set:PropertyName("auto_rating_updated_at")
    var autoRatingUpdatedAt: Date? = null
) {
    // Construtor vazio necessario para Firestore
    constructor() : this(id = "")

    /**
     * Retorna o enum de Role do usuario
     *
     * CMD-10: O role é definido no campo 'role' do documento do usuário no Firestore.
     * Possíveis valores: "ADMIN", "FIELD_OWNER", "PLAYER" (padrão)
     *
     * O role é definido manualmente no banco ou via Cloud Functions.
     * Não existe custom claim do Firebase Auth - a verificação é feita
     * apenas no documento do usuário no Firestore.
     */
    @Exclude
    fun getRoleEnum(): UserRole = try {
        UserRole.valueOf(role.trim().uppercase())
    } catch (e: Exception) {
        UserRole.PLAYER
    }

    /**
     * Verifica se o usuario tem permissao de admin
     *
     * CMD-10: Padronização - admin é definido via UserRole.ADMIN
     * CMD-11: AUTHZ real - use esta função apenas para UI gating,
     * verificação real deve estar no Firestore rules.
     */
    @Exclude
    fun isAdmin(): Boolean = getRoleEnum() == UserRole.ADMIN

    /**
     * Verifica se o usuario e dono de quadra/local
     *
     * CMD-10: FIELD_OWNER é definido via UserRole.FIELD_OWNER
     * Admins também têm acesso a permissões de FIELD_OWNER.
     */
    @Exclude
    fun isFieldOwner(): Boolean = getRoleEnum() == UserRole.FIELD_OWNER || isAdmin()

    /**
     * Verifica se pode gerenciar locais e quadras
     *
     * CMD-11: Permissão para criar/editar locais próprios.
     * No backend, verificar também via ownerId no documento.
     */
    @Exclude
    fun canManageLocations(): Boolean = isFieldOwner()

    /**
     * Verifica se pode aprovar reservas
     *
     * CMD-11: Permissão para gerenciar reservas de locais próprios.
     */
    @Exclude
    fun canApproveBookings(): Boolean = isFieldOwner()

    /**
     * Verifica se pode ver estatisticas globais
     *
     * CMD-11: Apenas admins podem ver estatísticas globais de todos os usuários.
     */
    @Exclude
    fun canViewGlobalStats(): Boolean = isAdmin()

    /**
     * Verifica se pode gerenciar usuários (role, ban, etc)
     *
     * CMD-11: Apenas admins podem gerenciar outros usuários.
     * Esta verificação é apenas UI gating - a regra real está no Firestore.
     */
    @Exclude
    fun canManageUsers(): Boolean = isAdmin()

    /**
     * Retorna o nome de exibição (Apelido se houver, senão o Nome)
     */
    @Exclude
    fun getDisplayName(): String {
        return if (!nickname.isNullOrBlank()) nickname!! else name
    }

    /**
     * Calcula a idade com base na data de nascimento.
     */
    @Exclude
    fun getAge(): Int? {
        val birth = birthDate ?: return null
        val today = Calendar.getInstance()
        val birthCal = Calendar.getInstance().apply { time = birth }
        var age = today.get(Calendar.YEAR) - birthCal.get(Calendar.YEAR)
        if (today.get(Calendar.DAY_OF_YEAR) < birthCal.get(Calendar.DAY_OF_YEAR)) {
            age -= 1
        }
        return age
    }

    /**
     * Retorna a confianca das notas automaticas (0.0 - 1.0).
     */
    @Exclude
    fun getAutoRatingConfidence(): Double {
        if (autoRatingSamples <= 0) return 0.0
        return (autoRatingSamples / 20.0).coerceIn(0.0, 1.0)
    }

    /**
     * Retorna a nota manual do jogador para uma funcao.
     */
    @Exclude
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
    @Exclude
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
    @Exclude
    fun getEffectiveRating(role: PlayerRatingRole): Double {
        val manual = getManualRating(role)
        val auto = getAutoRating(role)
        if (auto <= 0.0) return manual
        if (manual <= 0.0) return auto

        val confidence = getAutoRatingConfidence()
        return ((manual * (1.0 - confidence)) + (auto * confidence)).coerceIn(0.0, 5.0)
    }
}

enum class PlayerRatingRole {
    STRIKER,
    MID,
    DEFENDER,
    GOALKEEPER
}

// Note: FieldType is defined in Location.kt

/**
 * Roles/papeis do sistema
 *
 * CMD-10: Definição padronizada de roles no sistema.
 *
 * Como o admin é definido:
 * - Campo 'role' no documento do usuário no Firestore (users/{userId})
 * - Valores possíveis: "ADMIN", "FIELD_OWNER", "PLAYER"
 * - Valor padrão para novos usuários: "PLAYER"
 * - Alteração de role é feita manualmente no banco ou via Cloud Function
 *
 * IMPORTANTE: Não usamos Custom Claims do Firebase Auth porque
 * requer SDK Admin para atualizar e pode ter latência. A verificação
 * é feita apenas no documento do usuário no Firestore.
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
 * ADMIN: Tudo - gerenciar usuarios, quadras, jogos, estatisticas globais
 * FIELD_OWNER: Cadastrar/editar seus locais, quadras, horarios, precos, fotos, aprovar reservas
 * PLAYER: Criar jogos (como dono do horario), confirmar presenca, ver estatisticas pessoais
 */
enum class UserRole(val displayName: String, val description: String) {
    /**
     * Administrador do sistema.
     * Tem acesso total a todas as funcionalidades.
     */
    ADMIN(
        displayName = "Administrador",
        description = "Acesso total ao sistema"
    ),
    /**
     * Dono de quadra/local.
     * Pode gerenciar seus próprios locais e quadras.
     */
    FIELD_OWNER(
        displayName = "Dono de Quadra",
        description = "Gerencia locais, quadras e reservas"
    ),
    /**
     * Jogador comum.
     * Pode criar jogos, confirmar presença e ver estatísticas pessoais.
     */
    PLAYER(
        displayName = "Jogador",
        description = "Cria jogos e confirma presença"
    );

    companion object {
        fun fromString(value: String?): UserRole {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: PLAYER
        }
    }
}
