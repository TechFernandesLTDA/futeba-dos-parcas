package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
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

    // Rastreamento de atividade (#4 - Validação Firebase)
    @get:PropertyName("last_active_at")
    @set:PropertyName("last_active_at")
    var lastActiveAt: Date? = null,

    // Soft delete para LGPD compliance (#5 - Validação Firebase)
    @get:PropertyName("deleted_at")
    @set:PropertyName("deleted_at")
    var deletedAt: Date? = null,

    // Motivo da exclusão (LGPD)
    @get:PropertyName("deletion_reason")
    @set:PropertyName("deletion_reason")
    var deletionReason: String? = null,

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
    // Bloco de inicializacao para normalizar valores e garantir integridade
    init {
        // Normaliza ratings para o range válido (0.0 - 5.0)
        strikerRating = strikerRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)
        midRating = midRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)
        defenderRating = defenderRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)
        gkRating = gkRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)

        // Normaliza auto-ratings para o range válido (0.0 - 5.0)
        autoStrikerRating = autoStrikerRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)
        autoMidRating = autoMidRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)
        autoDefenderRating = autoDefenderRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)
        autoGkRating = autoGkRating.coerceIn(ValidationHelper.RATING_MIN, ValidationHelper.RATING_MAX)

        // Normaliza level para o range válido (0 - 10)
        level = level.coerceIn(ValidationHelper.LEVEL_MIN, ValidationHelper.LEVEL_MAX)

        // Garante que XP não seja negativo
        experiencePoints = experiencePoints.coerceAtLeast(ValidationHelper.XP_MIN)

        // Garante que amostras de auto-rating não seja negativo
        autoRatingSamples = autoRatingSamples.coerceAtLeast(0)
    }

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
        return nickname?.takeIf { it.isNotBlank() } ?: name
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

    // ==================== VALIDAÇÃO ====================

    /**
     * Valida todos os campos do usuário antes de salvar.
     *
     * @param requireEmail Se true, email é obrigatório
     * @param requireName Se true, nome é obrigatório
     * @return Lista de erros de validação (vazia se tudo válido)
     */
    @Exclude
    fun validate(requireEmail: Boolean = false, requireName: Boolean = true): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()

        // Validação de nome
        if (requireName) {
            val nameResult = ValidationHelper.validateName(name, "nome")
            if (nameResult is ValidationResult.Invalid) {
                errors.add(nameResult)
            }
        }

        // Validação de email (se fornecido ou obrigatório)
        if (requireEmail || email.isNotBlank()) {
            if (email.isNotBlank() && !ValidationHelper.isValidEmail(email)) {
                errors.add(
                    ValidationResult.Invalid(
                        "email",
                        "Formato de email inválido",
                        com.futebadosparcas.domain.validation.ValidationErrorCode.INVALID_EMAIL
                    )
                )
            } else if (requireEmail && email.isBlank()) {
                errors.add(
                    ValidationResult.Invalid(
                        "email",
                        "Email é obrigatório",
                        com.futebadosparcas.domain.validation.ValidationErrorCode.REQUIRED_FIELD
                    )
                )
            }
        }

        // Validação de ratings (já normalizados no init, mas verifica por segurança)
        if (!ValidationHelper.isValidRating(strikerRating)) {
            errors.add(ValidationResult.Invalid("striker_rating", "Rating de atacante inválido"))
        }
        if (!ValidationHelper.isValidRating(midRating)) {
            errors.add(ValidationResult.Invalid("mid_rating", "Rating de meio-campo inválido"))
        }
        if (!ValidationHelper.isValidRating(defenderRating)) {
            errors.add(ValidationResult.Invalid("defender_rating", "Rating de zagueiro inválido"))
        }
        if (!ValidationHelper.isValidRating(gkRating)) {
            errors.add(ValidationResult.Invalid("gk_rating", "Rating de goleiro inválido"))
        }

        // Validação de nível
        if (!ValidationHelper.isValidLevel(level)) {
            errors.add(ValidationResult.Invalid("level", "Nível inválido (deve ser entre 0 e 10)"))
        }

        // Validação de XP
        if (!ValidationHelper.isValidXP(experiencePoints)) {
            errors.add(ValidationResult.Invalid("experience_points", "XP não pode ser negativo"))
        }

        // Validação de timestamps
        val timestampResult = ValidationHelper.validateTimestampOrder(createdAt, updatedAt)
        if (timestampResult is ValidationResult.Invalid) {
            errors.add(timestampResult)
        }

        return errors
    }

    /**
     * Verifica se o usuário é válido para salvar.
     */
    @Exclude
    fun isValid(requireEmail: Boolean = false, requireName: Boolean = true): Boolean {
        return validate(requireEmail, requireName).isEmpty()
    }

    /**
     * Verifica se o usuário foi soft-deleted (#5 - LGPD compliance).
     */
    @Exclude
    fun isDeleted(): Boolean = deletedAt != null

    /**
     * Marca o usuário como deletado (soft delete) para LGPD compliance.
     *
     * @param reason Motivo da exclusão (opcional)
     */
    @Exclude
    fun softDelete(reason: String? = null) {
        deletedAt = Date()
        deletionReason = reason
        updatedAt = Date()
    }

    /**
     * Atualiza o timestamp de última atividade (#4 - Rastreamento).
     */
    @Exclude
    fun updateLastActive() {
        lastActiveAt = Date()
    }

    /**
     * Verifica se o usuário está inativo por mais de X dias.
     *
     * @param days Número de dias para considerar inativo
     * @return true se o usuário está inativo
     */
    @Exclude
    fun isInactive(days: Int = 30): Boolean {
        val lastActive = lastActiveAt ?: createdAt ?: return true
        val now = Date()
        val diffMs = now.time - lastActive.time
        val diffDays = diffMs / (1000 * 60 * 60 * 24)
        return diffDays > days
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
enum class UserRole(
    val displayName: String,
    val description: String,
    val gamePermissions: Set<String>,
    val groupPermissions: Set<String>,
    val userPermissions: Set<String>,
    val locationPermissions: Set<String>
) {
    /**
     * Administrador do sistema.
     * Tem acesso total a todas as funcionalidades.
     */
    ADMIN(
        displayName = "Administrador",
        description = "Acesso total ao sistema",
        gamePermissions = setOf(
            "ViewAllGames", "ViewOwnedGames", "ViewParticipatedGames",
            "ViewAllHistory", "ViewOwnHistory",
            "EditAllGames", "EditOwnedGames",
            "DeleteAllGames", "DeleteOwnedGames",
            "JoinAllGames", "ManageAllConfirmations", "ManageOwnConfirmations",
            "FinalizeAllGames", "FinalizeOwnedGames",
            "ViewAllPlayerStats", "ViewOwnStats"
        ),
        groupPermissions = setOf(
            "ViewAllGroups", "EditAllGroups", "EditOwnedGroups",
            "ManageAllMembers", "ManageOwnMembers"
        ),
        userPermissions = setOf(
            "ViewAllProfiles", "EditAllProfiles", "EditOwnProfile",
            "BanUsers", "ChangeUserRoles"
        ),
        locationPermissions = setOf(
            "ViewAllLocations", "EditAllLocations", "EditOwnedLocations",
            "ApproveAllReservations", "ApproveOwnReservations"
        )
    ),

    /**
     * Dono de quadra/local.
     * Pode gerenciar seus próprios locais e quadras.
     */
    FIELD_OWNER(
        displayName = "Dono de Quadra",
        description = "Gerencia locais, quadras e reservas",
        gamePermissions = setOf(
            "ViewOwnedGames", "ViewParticipatedGames",
            "ViewOwnHistory",
            "EditOwnedGames",
            "DeleteOwnedGames",
            "ManageOwnConfirmations",
            "FinalizeOwnedGames",
            "ViewOwnStats"
        ),
        groupPermissions = setOf(
            "EditOwnedGroups", "ManageOwnMembers"
        ),
        userPermissions = setOf(
            "ViewAllProfiles", "EditOwnProfile"
        ),
        locationPermissions = setOf(
            "ViewAllLocations", "EditOwnedLocations", "ApproveOwnReservations"
        )
    ),

    /**
     * Jogador comum.
     * Pode criar jogos, confirmar presença e ver estatísticas pessoais.
     */
    PLAYER(
        displayName = "Jogador",
        description = "Cria jogos e confirma presença",
        gamePermissions = setOf(
            "ViewOwnedGames", "ViewParticipatedGames",
            "ViewOwnHistory",
            "EditOwnedGames",
            "DeleteOwnedGames",
            "ManageOwnConfirmations",
            "FinalizeOwnedGames",
            "ViewOwnStats"
        ),
        groupPermissions = setOf(
            "EditOwnedGroups", "ManageOwnMembers"
        ),
        userPermissions = setOf(
            "ViewAllProfiles", "EditOwnProfile"
        ),
        locationPermissions = setOf(
            "ViewAllLocations"
        )
    );

    /**
     * Verifica se o role tem uma permissão específica de jogo.
     */
    fun hasGamePermission(permission: String): Boolean = permission in gamePermissions

    /**
     * Verifica se o role tem uma permissão específica de grupo.
     */
    fun hasGroupPermission(permission: String): Boolean = permission in groupPermissions

    /**
     * Verifica se o role tem uma permissão específica de usuário.
     */
    fun hasUserPermission(permission: String): Boolean = permission in userPermissions

    /**
     * Verifica se o role tem uma permissão específica de local.
     */
    fun hasLocationPermission(permission: String): Boolean = permission in locationPermissions

    /**
     * Verifica se é admin (atalho comum).
     */
    fun isAdmin(): Boolean = this == ADMIN

    /**
     * Verifica se pode ver todos os jogos.
     */
    fun canViewAllGames(): Boolean = hasGamePermission("ViewAllGames")

    /**
     * Verifica se pode ver todo o histórico.
     */
    fun canViewAllHistory(): Boolean = hasGamePermission("ViewAllHistory")

    /**
     * Verifica se pode editar qualquer jogo.
     */
    fun canEditAllGames(): Boolean = hasGamePermission("EditAllGames")

    /**
     * Verifica se pode entrar em qualquer jogo.
     */
    fun canJoinAllGames(): Boolean = hasGamePermission("JoinAllGames")

    companion object {
        fun fromString(value: String?): UserRole {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: PLAYER
        }
    }
}
