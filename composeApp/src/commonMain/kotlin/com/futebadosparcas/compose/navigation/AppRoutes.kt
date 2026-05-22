package com.futebadosparcas.compose.navigation

/**
 * Rotas de navegação do composeApp (compartilhadas entre Android e iOS via CMP).
 *
 * Adicionar novas rotas aqui conforme a frota de telas (Bucket Core, Gamification,
 * Discovery, Power) for portada para commonMain nas próximas etapas.
 *
 * Refs: specs/feat-2026-05-16-ios-parity-cmp-phase3.md §3.1
 */
object AppRoutes {

    /** Tela inicial — placeholder até o Bucket Core portar HomeScreen real */
    const val HOME = "home"

    /** Tela "Novidades" — histórico de release notes (spec feat-2026-05-22, Fase G) */
    const val WHATS_NEW = "whats_new"

    // ─── Bucket Core (a ser adicionado pela frota) ────────────────────────────
    // const val GAMES = "games"
    // const val GAME_DETAIL = "game/{gameId}"
    // const val GROUPS = "groups"
    // const val GROUP_DETAIL = "group/{groupId}"
    // const val PROFILE = "profile"
    // const val LOGIN = "login"

    // ─── Bucket Gamification ─────────────────────────────────────────────────
    // const val RANKING = "ranking"
    // const val BADGES = "badges"

    // ─── Bucket Discovery ────────────────────────────────────────────────────
    // const val LOCATIONS = "locations"

    // ─── Bucket Power ────────────────────────────────────────────────────────
    // const val CASHBOX = "cashbox"
}
