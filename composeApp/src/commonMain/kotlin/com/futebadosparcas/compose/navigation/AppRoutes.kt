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

    /** Tela inicial do shell compartilhado (dashboard + atalhos principais). */
    const val HOME = "home"

    /** Tela "Novidades" — histórico de release notes (spec feat-2026-05-22, Fase G) */
    const val WHATS_NEW = "whats_new"

    // ─── Bucket Core ──────────────────────────────────────────────────────────
    const val WELCOME = "welcome"

    /** Onboarding de permissões (notificações, localização, câmera, microfone). #2671 */
    const val PERMISSION_ONBOARDING = "permission_onboarding"
    const val LOGIN = "login"
    const val GAMES = "games"
    const val GAME_DETAIL = "game/{gameId}"
    const val GROUPS = "groups"
    const val GROUP_DETAIL = "group/{groupId}"
    const val PROFILE = "profile"
    const val PROFILE_SETUP = "profile_setup"

    // ─── Bucket Core — ferramentas do organizador / pós-jogo (#2671) ──────────
    // Telas reais já existentes em ui/core/ cabeadas a partir do detalhe do jogo
    // (hub do organizador). Eliminam telas órfãs no NavHost (AC#4 da #2671).
    /** Relatório pós-jogo (presentes, pagamentos, placar, MVP). */
    const val POST_GAME_REPORT = "post_game_report"

    /** Estatísticas do organizador (jogos organizados, presença média, receita). */
    const val OWNER_STATS = "owner_stats"

    /** Convidar jogadores para um grupo (requer groupId). */
    const val INVITE_PLAYERS = "invite_players/{groupId}"

    /** Jogadores bloqueados de um grupo/jogo. */
    const val BLOCKED_PLAYERS = "blocked_players"

    // ─── Bucket Gamification ─────────────────────────────────────────────────
    const val RANKING = "ranking"
    const val BADGES = "badges"

    // ─── Bucket Discovery ────────────────────────────────────────────────────
    const val LOCATIONS = "locations"

    // ─── Bucket Power ────────────────────────────────────────────────────────
    const val CASHBOX = "cashbox"
}
