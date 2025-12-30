package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

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

    // Nível/XP do jogador para gamificação
    @get:PropertyName("level")
    @set:PropertyName("level")
    var level: Int = 1,

    @get:PropertyName("experience_points")
    @set:PropertyName("experience_points")
    var experiencePoints: Int = 0,

    // Milestones ja conquistados (para evitar duplicacao)
    @get:PropertyName("milestones_achieved")
    @set:PropertyName("milestones_achieved")
    var milestonesAchieved: List<String> = emptyList()
) {
    // Construtor vazio necessario para Firestore
    constructor() : this(id = "")

    /**
     * Retorna o enum de Role do usuario
     */
    fun getRoleEnum(): UserRole = try {
        UserRole.valueOf(role.trim().uppercase())
    } catch (e: Exception) {
        UserRole.PLAYER
    }

    /**
     * Verifica se o usuario tem permissao de admin
     */
    fun isAdmin(): Boolean = getRoleEnum() == UserRole.ADMIN

    /**
     * Verifica se o usuario e dono de quadra/local
     */
    fun isFieldOwner(): Boolean = getRoleEnum() == UserRole.FIELD_OWNER || isAdmin()

    /**
     * Verifica se pode gerenciar locais e quadras
     */
    fun canManageLocations(): Boolean = isFieldOwner()

    /**
     * Verifica se pode aprovar reservas
     */
    fun canApproveBookings(): Boolean = isFieldOwner()

    /**
     * Verifica se pode ver estatisticas globais
     */
    /**
     * Verifica se pode ver estatisticas globais
     */
    fun canViewGlobalStats(): Boolean = isAdmin()

    /**
     * Retorna o nome de exibição (Apelido se houver, senão o Nome)
     */
    fun getDisplayName(): String {
        return if (!nickname.isNullOrBlank()) nickname else name
    }
}

// Note: FieldType is defined in Location.kt

/**
 * Roles/papeis do sistema
 * 
 * ADMIN: Tudo - gerenciar usuarios, quadras, jogos, estatisticas globais
 * FIELD_OWNER: Cadastrar/editar seus locais, quadras, horarios, precos, fotos, aprovar reservas
 * PLAYER: Criar jogos (como dono do horario), confirmar presenca, ver estatisticas pessoais
 */
enum class UserRole(val displayName: String, val description: String) {
    ADMIN(
        displayName = "Administrador",
        description = "Acesso total ao sistema"
    ),
    FIELD_OWNER(
        displayName = "Dono de Quadra",
        description = "Gerencia locais, quadras e reservas"
    ),
    PLAYER(
        displayName = "Jogador",
        description = "Cria jogos e confirma presença"
    );

    companion object {
        fun fromString(value: String?): UserRole {
            return entries.find { it.name == value } ?: PLAYER
        }
    }
}
