package com.futebadosparcas.domain.permission

import com.futebadosparcas.data.model.UserRole
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

/**
 * Gerenciador centralizado de permissões.
 *
 * Este manager é responsável por:
 * - Verificar permissões do usuário atual
 * - Cachear o role do usuário para evitar queries repetidas
 * - Fornecer métodos de conveniência para verificações comuns
 *
 * Uso:
 * ```kotlin
 * lateinit var permissionManager: PermissionManager
 *
 * // Verificar se pode ver todos os jogos
 * if (permissionManager.canViewAllGames()) { ... }
 *
 * // Verificar se pode editar um jogo específico
 * if (permissionManager.canEditGame(gameOwnerId)) { ... }
 * ```
 */
class PermissionManager constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    companion object {
        private const val TAG = "PermissionManager"
    }

    // ========== Cache do Role ==========

    @Volatile
    private var cachedRole: UserRole? = null

    @Volatile
    private var cachedUid: String? = null

    /**
     * Obtém o role do usuário atual.
     * Resultado é cacheado para evitar queries repetidas.
     */
    suspend fun getCurrentUserRole(): UserRole {
        val uid = auth.currentUser?.uid ?: return UserRole.PLAYER

        // Verificar cache
        if (cachedUid == uid) {
            cachedRole?.let { return it }
        }

        return try {
            val userDoc = firestore.collection("users").document(uid).get().await()
            // Extrai apenas o campo 'role' sem deserializar o User inteiro
            // Evita crash por incompatibilidade de tipos (ex: birth_date Long vs Date)
            val roleStr = userDoc.getString("role")
            val role = UserRole.fromString(roleStr)

            // Atualizar cache
            cachedUid = uid
            cachedRole = role

            AppLogger.d(TAG) { "Role do usuário $uid: ${role.name}" }
            role
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao obter role do usuário", e)
            UserRole.PLAYER
        }
    }

    /**
     * Invalida o cache do role.
     * Chamar quando o usuário fizer logout ou quando o role for alterado.
     */
    fun invalidateCache() {
        cachedRole = null
        cachedUid = null
        AppLogger.d(TAG) { "Cache de permissões invalidado" }
    }

    /**
     * Obtém o UID do usuário atual.
     */
    fun getCurrentUserId(): String? = auth.currentUser?.uid

    // ========== Verificações de Admin ==========

    /**
     * Verifica se o usuário atual é admin.
     */
    suspend fun isAdmin(): Boolean = getCurrentUserRole().isAdmin()

    /**
     * Versão síncrona (usa cache, pode estar desatualizado).
     * Use apenas quando não puder usar suspend function.
     */
    fun isAdminCached(): Boolean = cachedRole?.isAdmin() ?: false

    // ========== Permissões de Jogos ==========

    /**
     * Verifica se pode ver todos os jogos (admin only).
     */
    suspend fun canViewAllGames(): Boolean = getCurrentUserRole().canViewAllGames()

    /**
     * Verifica se pode ver todo o histórico (admin only).
     */
    suspend fun canViewAllHistory(): Boolean = getCurrentUserRole().canViewAllHistory()

    /**
     * Verifica se pode editar todos os jogos (admin only).
     */
    suspend fun canEditAllGames(): Boolean = getCurrentUserRole().canEditAllGames()

    /**
     * Verifica se pode entrar em qualquer jogo (admin only).
     */
    suspend fun canJoinAllGames(): Boolean = getCurrentUserRole().canJoinAllGames()

    /**
     * Verifica se pode editar um jogo específico.
     *
     * @param gameOwnerId ID do dono do jogo
     * @param coOrganizerIds IDs dos co-organizadores (opcional)
     * @return true se pode editar
     */
    suspend fun canEditGame(
        gameOwnerId: String,
        coOrganizerIds: List<String> = emptyList()
    ): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            // Admin pode editar qualquer jogo
            role.canEditAllGames() -> true
            // Dono pode editar
            gameOwnerId == uid -> true
            // Co-organizador pode editar
            uid in coOrganizerIds -> true
            else -> false
        }
    }

    /**
     * Verifica se pode ver um jogo específico.
     *
     * @param gameOwnerId ID do dono do jogo
     * @param isUserConfirmed Se o usuário está confirmado no jogo
     * @param isPublicGame Se o jogo é público
     * @param userGroupIds IDs dos grupos do usuário
     * @param gameGroupId ID do grupo do jogo (se for GROUP_ONLY)
     */
    suspend fun canViewGame(
        gameOwnerId: String,
        isUserConfirmed: Boolean = false,
        isPublicGame: Boolean = false,
        userGroupIds: List<String> = emptyList(),
        gameGroupId: String? = null
    ): Boolean {
        val uid = getCurrentUserId() ?: return isPublicGame
        val role = getCurrentUserRole()

        return when {
            // Admin vê tudo
            role.canViewAllGames() -> true
            // Dono vê seu jogo
            gameOwnerId == uid -> true
            // Usuário confirmado vê o jogo
            isUserConfirmed -> true
            // Jogo público - todos veem
            isPublicGame -> true
            // Jogo de grupo - membros veem
            gameGroupId != null && gameGroupId in userGroupIds -> true
            else -> false
        }
    }

    /**
     * Verifica se pode ver o histórico de um jogo.
     *
     * Regras:
     * - Admin vê todo histórico
     * - Dono do jogo vê seu histórico
     * - Participantes veem o histórico dos jogos que participaram
     */
    suspend fun canViewGameHistory(
        gameOwnerId: String,
        didUserParticipate: Boolean
    ): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            // Admin vê todo histórico
            role.canViewAllHistory() -> true
            // Dono vê seu histórico
            gameOwnerId == uid -> true
            // Participante vê histórico do jogo
            didUserParticipate -> true
            else -> false
        }
    }

    /**
     * Verifica se pode finalizar um jogo.
     */
    suspend fun canFinalizeGame(gameOwnerId: String): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            role.hasGamePermission("FinalizeAllGames") -> true
            gameOwnerId == uid && role.hasGamePermission("FinalizeOwnedGames") -> true
            else -> false
        }
    }

    /**
     * Verifica se pode deletar um jogo.
     */
    suspend fun canDeleteGame(gameOwnerId: String): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            role.hasGamePermission("DeleteAllGames") -> true
            gameOwnerId == uid && role.hasGamePermission("DeleteOwnedGames") -> true
            else -> false
        }
    }

    /**
     * Verifica se pode gerenciar confirmações de um jogo.
     */
    suspend fun canManageConfirmations(gameOwnerId: String): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            role.hasGamePermission("ManageAllConfirmations") -> true
            gameOwnerId == uid && role.hasGamePermission("ManageOwnConfirmations") -> true
            else -> false
        }
    }

    // ========== Permissões de Grupos ==========

    /**
     * Verifica se pode editar um grupo.
     */
    suspend fun canEditGroup(groupAdminId: String): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            role.hasGroupPermission("EditAllGroups") -> true
            groupAdminId == uid && role.hasGroupPermission("EditOwnedGroups") -> true
            else -> false
        }
    }

    /**
     * Verifica se pode gerenciar membros de um grupo.
     */
    suspend fun canManageGroupMembers(groupAdminId: String): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            role.hasGroupPermission("ManageAllMembers") -> true
            groupAdminId == uid && role.hasGroupPermission("ManageOwnMembers") -> true
            else -> false
        }
    }

    // ========== Permissões de Usuários ==========

    /**
     * Verifica se pode editar o perfil de um usuário.
     */
    suspend fun canEditUserProfile(profileUserId: String): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            role.hasUserPermission("EditAllProfiles") -> true
            profileUserId == uid && role.hasUserPermission("EditOwnProfile") -> true
            else -> false
        }
    }

    /**
     * Verifica se pode banir usuários.
     */
    suspend fun canBanUsers(): Boolean = getCurrentUserRole().hasUserPermission("BanUsers")

    /**
     * Verifica se pode alterar roles de usuários.
     */
    suspend fun canChangeUserRoles(): Boolean = getCurrentUserRole().hasUserPermission("ChangeUserRoles")

    // ========== Permissões de Locais ==========

    /**
     * Verifica se pode editar um local.
     */
    suspend fun canEditLocation(locationOwnerId: String): Boolean {
        val uid = getCurrentUserId() ?: return false
        val role = getCurrentUserRole()

        return when {
            role.hasLocationPermission("EditAllLocations") -> true
            locationOwnerId == uid && role.hasLocationPermission("EditOwnedLocations") -> true
            else -> false
        }
    }

    // ========== Helpers ==========

    /**
     * Retorna um objeto com todas as permissões do usuário atual.
     * Útil para passar para a UI de uma vez.
     */
    suspend fun getUserPermissions(): UserPermissions {
        val role = getCurrentUserRole()
        val uid = getCurrentUserId()

        return UserPermissions(
            isAdmin = role.isAdmin(),
            canViewAllGames = role.canViewAllGames(),
            canViewAllHistory = role.canViewAllHistory(),
            canEditAllGames = role.canEditAllGames(),
            canJoinAllGames = role.canJoinAllGames(),
            canBanUsers = role.hasUserPermission("BanUsers"),
            canChangeRoles = role.hasUserPermission("ChangeUserRoles"),
            userId = uid
        )
    }
}

/**
 * DTO com permissões do usuário para uso na UI.
 */
data class UserPermissions(
    val isAdmin: Boolean,
    val canViewAllGames: Boolean,
    val canViewAllHistory: Boolean,
    val canEditAllGames: Boolean,
    val canJoinAllGames: Boolean,
    val canBanUsers: Boolean,
    val canChangeRoles: Boolean,
    val userId: String?
)
