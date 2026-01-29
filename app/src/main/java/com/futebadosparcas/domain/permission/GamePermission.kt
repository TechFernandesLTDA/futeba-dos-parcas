package com.futebadosparcas.domain.permission

/**
 * Permissões relacionadas a jogos.
 *
 * Cada permissão representa uma ação específica que um usuário pode ou não realizar.
 * As permissões são agrupadas por categoria para facilitar o gerenciamento.
 */
sealed class GamePermission {
    // ========== Visualização ==========

    /** Pode ver todos os jogos do sistema (admin) */
    data object ViewAllGames : GamePermission()

    /** Pode ver jogos que criou (é owner) */
    data object ViewOwnedGames : GamePermission()

    /** Pode ver jogos que participou (tem confirmação) */
    data object ViewParticipatedGames : GamePermission()

    /** Pode ver histórico de todos os jogos (admin) */
    data object ViewAllHistory : GamePermission()

    /** Pode ver histórico dos próprios jogos */
    data object ViewOwnHistory : GamePermission()

    // ========== Edição ==========

    /** Pode editar qualquer jogo (admin) */
    data object EditAllGames : GamePermission()

    /** Pode editar jogos que criou */
    data object EditOwnedGames : GamePermission()

    // ========== Exclusão ==========

    /** Pode excluir qualquer jogo (admin) */
    data object DeleteAllGames : GamePermission()

    /** Pode excluir jogos que criou (antes de iniciar) */
    data object DeleteOwnedGames : GamePermission()

    // ========== Gerenciamento ==========

    /** Pode entrar em qualquer jogo (admin) */
    data object JoinAllGames : GamePermission()

    /** Pode gerenciar confirmações de qualquer jogo (admin) */
    data object ManageAllConfirmations : GamePermission()

    /** Pode gerenciar confirmações dos próprios jogos */
    data object ManageOwnConfirmations : GamePermission()

    /** Pode finalizar qualquer jogo (admin) */
    data object FinalizeAllGames : GamePermission()

    /** Pode finalizar jogos que criou */
    data object FinalizeOwnedGames : GamePermission()

    // ========== Estatísticas ==========

    /** Pode ver estatísticas de todos os jogadores (admin) */
    data object ViewAllPlayerStats : GamePermission()

    /** Pode ver estatísticas próprias */
    data object ViewOwnStats : GamePermission()
}

/**
 * Permissões relacionadas a grupos.
 */
sealed class GroupPermission {
    /** Pode ver todos os grupos (admin) */
    data object ViewAllGroups : GroupPermission()

    /** Pode editar qualquer grupo (admin) */
    data object EditAllGroups : GroupPermission()

    /** Pode editar grupos que administra */
    data object EditOwnedGroups : GroupPermission()

    /** Pode gerenciar membros de qualquer grupo (admin) */
    data object ManageAllMembers : GroupPermission()

    /** Pode gerenciar membros dos próprios grupos */
    data object ManageOwnMembers : GroupPermission()
}

/**
 * Permissões relacionadas a usuários.
 */
sealed class UserPermission {
    /** Pode ver perfil de qualquer usuário */
    data object ViewAllProfiles : UserPermission()

    /** Pode editar qualquer perfil (admin) */
    data object EditAllProfiles : UserPermission()

    /** Pode editar próprio perfil */
    data object EditOwnProfile : UserPermission()

    /** Pode banir usuários (admin) */
    data object BanUsers : UserPermission()

    /** Pode alterar roles de usuários (admin) */
    data object ChangeUserRoles : UserPermission()
}

/**
 * Permissões relacionadas a locais/quadras.
 */
sealed class LocationPermission {
    /** Pode ver todos os locais */
    data object ViewAllLocations : LocationPermission()

    /** Pode editar qualquer local (admin) */
    data object EditAllLocations : LocationPermission()

    /** Pode editar locais que administra (field owner) */
    data object EditOwnedLocations : LocationPermission()

    /** Pode aprovar reservas de qualquer local (admin) */
    data object ApproveAllReservations : LocationPermission()

    /** Pode aprovar reservas dos próprios locais */
    data object ApproveOwnReservations : LocationPermission()
}
