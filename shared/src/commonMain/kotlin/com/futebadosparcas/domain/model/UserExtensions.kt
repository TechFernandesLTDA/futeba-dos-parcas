package com.futebadosparcas.domain.model

/**
 * Extension properties para User - compatibilidade com codigo Android legado.
 *
 * O codigo Android ainda referencia propriedades como `user.isAdmin` (property)
 * em vez de `user.isAdmin()` (method). Estas extensions permitem ambos.
 */

/**
 * Propriedade isAdmin para compatibilidade.
 * Retorna true se o usuario e ADMIN.
 */
val User.isAdmin: Boolean
    get() = isAdmin()

/**
 * Verifica se usuario pode ver todos os jogos.
 * ADMIN e FIELD_OWNER podem ver todos os jogos.
 */
val User.canViewAllGames: Boolean
    get() = isAdmin() || isFieldOwner()

/**
 * Verifica se usuario pode ver todo o historico.
 * ADMIN e FIELD_OWNER podem ver historico completo.
 */
val User.canViewAllHistory: Boolean
    get() = isAdmin() || isFieldOwner()

/**
 * Verifica se usuario pode editar todos os jogos.
 * Apenas ADMIN pode editar todos os jogos.
 */
val User.canEditAllGames: Boolean
    get() = isAdmin()

/**
 * Verifica se usuario pode entrar em todos os jogos.
 * ADMIN pode entrar em qualquer jogo.
 */
val User.canJoinAllGames: Boolean
    get() = isAdmin()

/**
 * Verifica se usuario tem permissao em um jogo especifico.
 * Retorna true se for admin, dono ou co-organizador do jogo.
 *
 * @param game Jogo a verificar
 * @return true se tem permissao
 */
fun User.hasGamePermission(game: Game): Boolean {
    if (isAdmin()) return true
    if (game.ownerId == id) return true
    if (game.coOrganizers.contains(id)) return true
    return false
}

/**
 * Verifica se usuario tem permissao em um grupo.
 * Por enquanto, sempre retorna true (sem controle de permissao de grupo).
 *
 * TODO: Implementar controle de permissoes de grupo quando houver spec.
 */
fun User.hasGroupPermission(groupId: String): Boolean {
    // TODO: Implementar quando houver sistema de permissoes de grupo
    return true
}

/**
 * Verifica se usuario tem permissao sobre outro usuario.
 * ADMIN pode gerenciar qualquer usuario.
 *
 * @param userId ID do usuario alvo
 * @return true se tem permissao
 */
fun User.hasUserPermission(userId: String): Boolean {
    if (isAdmin()) return true
    if (id == userId) return true // Usuario pode gerenciar a si mesmo
    return false
}

/**
 * Verifica se usuario tem permissao sobre um local.
 * ADMIN e FIELD_OWNER podem gerenciar locais.
 * Donos podem gerenciar seus proprios locais.
 *
 * @param ownerId ID do dono do local
 * @return true se tem permissao
 */
fun User.hasLocationPermission(ownerId: String): Boolean {
    if (isAdmin()) return true
    if (isFieldOwner() && id == ownerId) return true
    return false
}
