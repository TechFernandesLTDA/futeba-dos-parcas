package com.futebadosparcas.domain.authorization

import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserRole

/**
 * Matriz de permissões do sistema.
 *
 * CMD-10: Padronização de definição de admin e UserRole no domain
 * CMD-11: AUTHZ real com matriz de permissões
 *
 * Define quem pode fazer o que no sistema, baseado em UserRole.
 * Permissões são verificadas tanto no cliente (UI gating) quanto no backend (Firestore rules).
 */
object UserPermissions {

    /**
     * Ações do sistema que requerem autorização.
     */
    enum class Action {
        // Gerenciamento de usuários
        MANAGE_USERS,
        VIEW_ALL_USERS,
        CHANGE_USER_ROLE,

        // Gerenciamento de jogos
        CREATE_GAME,
        EDIT_ANY_GAME,
        DELETE_ANY_GAME,
        CONFIRM_PRESENCE_ANY_GAME,
        EDIT_GAME_STATS,

        // Gerenciamento de locais/quadras
        CREATE_LOCATION,
        EDIT_ANY_LOCATION,
        DELETE_ANY_LOCATION,
        MANAGE_OWN_LOCATIONS,

        // Gerenciamento de grupos
        CREATE_GROUP,
        EDIT_ANY_GROUP,
        DELETE_ANY_GROUP,
        MANAGE_GROUP_CASHBOX,

        // Rankings e Estatísticas
        VIEW_GLOBAL_STATS,
        EDIT_RANKINGS,
        ADJUST_XP,

        // Sistema
        MANAGE_NOTIFICATIONS,
        ACCESS_ADMIN_PANEL,
        MANAGE_BADGES,
        MANAGE_CHALLENGES
    }

    /**
     * Matriz de permissões por role.
     *
     * ADMIN      : Acesso total
     * FIELD_OWNER: Gestão de locais próprios
     * PLAYER     : Operações básicas de jogo
     */
    private val rolePermissions: Map<UserRole, Set<Action>> = mapOf(
        UserRole.ADMIN to setOf(
            // Gerenciamento de usuários
            Action.MANAGE_USERS,
            Action.VIEW_ALL_USERS,
            Action.CHANGE_USER_ROLE,

            // Gerenciamento de jogos (todos)
            Action.CREATE_GAME,
            Action.EDIT_ANY_GAME,
            Action.DELETE_ANY_GAME,
            Action.CONFIRM_PRESENCE_ANY_GAME,
            Action.EDIT_GAME_STATS,

            // Gerenciamento de locais (todos)
            Action.CREATE_LOCATION,
            Action.EDIT_ANY_LOCATION,
            Action.DELETE_ANY_LOCATION,
            Action.MANAGE_OWN_LOCATIONS,

            // Gerenciamento de grupos
            Action.CREATE_GROUP,
            Action.EDIT_ANY_GROUP,
            Action.DELETE_ANY_GROUP,
            Action.MANAGE_GROUP_CASHBOX,

            // Rankings e estatísticas
            Action.VIEW_GLOBAL_STATS,
            Action.EDIT_RANKINGS,
            Action.ADJUST_XP,

            // Sistema
            Action.MANAGE_NOTIFICATIONS,
            Action.ACCESS_ADMIN_PANEL,
            Action.MANAGE_BADGES,
            Action.MANAGE_CHALLENGES
        ),

        UserRole.FIELD_OWNER to setOf(
            // Jogos
            Action.CREATE_GAME,
            Action.EDIT_ANY_GAME, // Pode editar jogos que criou
            Action.EDIT_GAME_STATS,

            // Locais (apenas próprios)
            Action.CREATE_LOCATION,
            Action.MANAGE_OWN_LOCATIONS,

            // Grupos
            Action.CREATE_GROUP,
            Action.MANAGE_GROUP_CASHBOX,

            // Estatísticas limitadas
            Action.VIEW_GLOBAL_STATS
        ),

        UserRole.PLAYER to setOf(
            // Jogos básicos
            Action.CREATE_GAME,
            Action.EDIT_ANY_GAME, // Apenas próprios jogos
            Action.CONFIRM_PRESENCE_ANY_GAME, // Apenas própria presença

            // Grupos
            Action.CREATE_GROUP,
            Action.MANAGE_GROUP_CASHBOX // Se for admin do grupo
        )
    )

    /**
     * Verifica se um usuário tem permissão para uma ação.
     *
     * CMD-11: AUTHZ real - verifica permissão no domínio,
     * não apenas na UI.
     *
     * @param user Usuário a ser verificado
     * @param action Ação a ser executada
     * @return true se o usuário tem permissão, false caso contrário
     */
    fun hasPermission(user: User?, action: Action): Boolean {
        if (user == null) return false

        val role = user.getRoleEnum()
        val permissions = rolePermissions[role] ?: return false

        return action in permissions
    }

    /**
     * Verifica se o usuário é administrador.
     *
     * CMD-10: Padronização - admin é definido via UserRole.ADMIN
     * no campo 'role' do documento do usuário no Firestore.
     *
     * @param user Usuário a ser verificado
     * @return true se o usuário é ADMIN
     */
    fun isAdmin(user: User?): Boolean {
        return user?.getRoleEnum() == UserRole.ADMIN
    }

    /**
     * Verifica se o usuário é dono de quadra.
     *
     * CMD-10: Padronização - FIELD_OWNER é definido via UserRole.FIELD_OWNER.
     * Admins também têm acesso a todas as permissões de FIELD_OWNER.
     *
     * @param user Usuário a ser verificado
     * @return true se o usuário é FIELD_OWNER ou ADMIN
     */
    fun isFieldOwner(user: User?): Boolean {
        if (user == null) return false
        val role = user.getRoleEnum()
        return role == UserRole.FIELD_OWNER || role == UserRole.ADMIN
    }

    /**
     * Verifica se um usuário pode gerenciar um recurso baseado em ownership.
     *
     * Combina verificação de permissão com verificação de dono do recurso.
     *
     * @param user Usuário a ser verificado
     * @param action Ação a ser executada
     * @param resourceOwnerId ID do dono do recurso
     * @return true se o usuário tem permissão ou é o dono do recurso
     */
    fun canManageResource(
        user: User?,
        action: Action,
        resourceOwnerId: String?
    ): Boolean {
        if (user == null) return false

        // Admin pode tudo
        if (isAdmin(user)) return true

        // Dono do recurso pode gerenciar
        if (resourceOwnerId != null && user.id == resourceOwnerId) {
            return true
        }

        // Verifica permissão específica do role
        return hasPermission(user, action)
    }

    /**
     * Verifica se um usuário pode editar dados de outro usuário.
     *
     * Regras:
     * - ADMIN pode editar qualquer usuário
     * - Usuário pode editar próprio perfil
     *
     * @param actor Usuário que está realizando a ação
     * @param targetUser Usuário alvo da edição
     * @return true se o actor pode editar o targetUser
     */
    fun canEditUser(actor: User?, targetUser: User?): Boolean {
        if (actor == null || targetUser == null) return false
        return isAdmin(actor) || actor.id == targetUser.id
    }

    /**
     * Verifica se um usuário pode excluir um recurso.
     *
     * Regras:
     * - ADMIN pode excluir qualquer recurso
     * - Dono do recurso pode excluir
     *
     * @param user Usuário a ser verificado
     * @param resourceOwnerId ID do dono do recurso
     * @return true se o usuário pode excluir o recurso
     */
    fun canDeleteResource(user: User?, resourceOwnerId: String?): Boolean {
        if (user == null) return false
        return isAdmin(user) || user.id == resourceOwnerId
    }
}

/**
 * Extensões convenientes para User.
 */
val User.isAdmin: Boolean
    get() = UserPermissions.isAdmin(this)

val User.isFieldOwner: Boolean
    get() = UserPermissions.isFieldOwner(this)

val User.canManageLocations: Boolean
    get() = isAdmin || getRoleEnum() == UserRole.FIELD_OWNER

val User.canViewGlobalStats: Boolean
    get() = isAdmin

fun User.hasPermission(action: UserPermissions.Action): Boolean {
    return UserPermissions.hasPermission(this, action)
}

fun User.canManageResource(action: UserPermissions.Action, resourceOwnerId: String?): Boolean {
    return UserPermissions.canManageResource(this, action, resourceOwnerId)
}
