package com.futebadosparcas.domain.authorization

import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserRole

/**
 * Matriz de permissões do sistema.
 *
 * CMD-10: Padronização de definição de admin e UserRole no domain
 * CMD-11: AUTHZ real com matriz de permissões
 * Issue #1039: Renomeia ações `*_ANY_*` enganosas — flags globais NÃO implicam acesso "any".
 *
 * Define quem pode fazer o que no sistema, baseado em UserRole.
 * Permissões são verificadas tanto no cliente (UI gating) quanto no backend (Firestore rules).
 *
 * ## Convenção de nomes (issue #1039)
 *
 * - `EDIT_GAME`: flag global "pode editar jogos". Caller DEVE combinar com
 *   `canManageResource(action, game.ownerId)` para validar ownership. Sem combinar,
 *   PLAYER/FIELD_OWNER veriam permissão "pode" mas a regra Firestore bloqueia.
 *
 * - `CONFIRM_OWN_PRESENCE`: flag global "pode confirmar presença". Backend valida
 *   que o jogador só altera o próprio status na lista de presença.
 *
 * - `MANAGE_GROUP_CASHBOX`: flag global "pode gerenciar cashbox". PLAYER NÃO tem
 *   essa permissão no matrix global — caller DEVE verificar role do user no
 *   `groups/{groupId}.admins[]` (ou claim equivalente) antes de permitir operação.
 */
object UserPermissions {

    /**
     * Ações do sistema que requerem autorização.
     *
     * IMPORTANTE: ações com sufixo `_ANY_*` foram REMOVIDAS (issue #1039) por induzirem
     * erro de leitura. Aliases @Deprecated existem no companion object para compat temporário.
     */
    enum class Action {
        // Gerenciamento de usuários
        MANAGE_USERS,
        VIEW_ALL_USERS,
        CHANGE_USER_ROLE,

        // Gerenciamento de jogos
        CREATE_GAME,

        /**
         * Flag global: usuário pode editar jogos.
         * Caller DEVE combinar com [canManageResource] para validar ownership/admin.
         */
        EDIT_GAME,
        DELETE_ANY_GAME,

        /**
         * Flag global: usuário pode confirmar presença em jogo.
         * Backend valida que só pode alterar a própria presença.
         */
        CONFIRM_OWN_PRESENCE,
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

        /**
         * Flag global: usuário pertence a um role que pode gerenciar cashbox.
         * **Não** implica acesso a qualquer grupo — caller DEVE verificar se o user
         * é admin do grupo específico (via `groups/{groupId}.admins[]` ou similar).
         */
        MANAGE_GROUP_CASHBOX,

        // Rankings e Estatísticas
        VIEW_GLOBAL_STATS,
        EDIT_RANKINGS,
        ADJUST_XP,

        // Sistema
        MANAGE_NOTIFICATIONS,
        ACCESS_ADMIN_PANEL,
        MANAGE_BADGES,
        MANAGE_CHALLENGES;

        companion object {
            /**
             * Alias deprecado (issue #1039) — antiga `EDIT_ANY_GAME`. Use [EDIT_GAME] +
             * `canManageResource(action, game.ownerId)`. Será removido em release futura.
             */
            @Deprecated(
                "Use EDIT_GAME + canManageResource(action, game.ownerId) para validar ownership",
                ReplaceWith("EDIT_GAME"),
                DeprecationLevel.WARNING
            )
            val EDIT_ANY_GAME: Action = EDIT_GAME

            /**
             * Alias deprecado (issue #1039) — antiga `CONFIRM_PRESENCE_ANY_GAME`. Use
             * [CONFIRM_OWN_PRESENCE]. Backend já restringe ao próprio user.
             */
            @Deprecated(
                "Use CONFIRM_OWN_PRESENCE — não implicava 'any' presença mesmo antes",
                ReplaceWith("CONFIRM_OWN_PRESENCE"),
                DeprecationLevel.WARNING
            )
            val CONFIRM_PRESENCE_ANY_GAME: Action = CONFIRM_OWN_PRESENCE
        }
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
            Action.EDIT_GAME,
            Action.DELETE_ANY_GAME,
            Action.CONFIRM_OWN_PRESENCE,
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
            // NOTA GAP-1: EDIT_GAME e EDIT_GAME_STATS REMOVIDAS do matrix global do
            // FIELD_OWNER. Backend (firestore.rules) só permite edit/update game se
            // `isAdmin() || isGameOwner(gameId)`. FIELD_OWNER genérico (não dono do
            // jogo) NÃO consegue. Caller DEVE usar `canManageResource(EDIT_GAME,
            // game.ownerId)` — ownership check passa quando o user é dono mesmo
            // sem a flag global.

            // Locais (apenas próprios)
            Action.CREATE_LOCATION,
            Action.MANAGE_OWN_LOCATIONS,

            // Grupos
            Action.CREATE_GROUP,
            Action.MANAGE_GROUP_CASHBOX, // Caller deve verificar role no grupo específico

            // Estatísticas limitadas
            Action.VIEW_GLOBAL_STATS
        ),

        UserRole.PLAYER to setOf(
            // Jogos básicos
            Action.CREATE_GAME,
            Action.EDIT_GAME, // Apenas próprios jogos — caller valida ownership
            Action.CONFIRM_OWN_PRESENCE, // Backend restringe a própria presença

            // Grupos
            Action.CREATE_GROUP
            // NOTA #1039: MANAGE_GROUP_CASHBOX REMOVIDA do matrix global do PLAYER.
            // Player que for admin de um grupo específico tem acesso via checagem
            // explícita no caller (groups/{groupId}.admins[]), não pela flag global.
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

    /**
     * Verifica se um usuário é gerente de um local específico.
     *
     * Issue #1039: este helper NÃO conflita com [Action.MANAGE_OWN_LOCATIONS] —
     * `MANAGE_OWN_LOCATIONS` é flag de role (pode criar locais próprios),
     * `isLocationManager` é consulta a `location.managers[]` (delegação de gestão
     * por dono do local). FIELD_OWNER pode ter ambos; PLAYER pode ser manager
     * de um local específico sem ter `MANAGE_OWN_LOCATIONS`.
     *
     * @param location Local a ser verificado
     * @param userId ID do usuário
     * @return true se userId está em location.managers
     */
    fun isLocationManager(location: Location?, userId: String?): Boolean {
        if (location == null || userId.isNullOrBlank()) return false
        return location.managers.contains(userId)
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
