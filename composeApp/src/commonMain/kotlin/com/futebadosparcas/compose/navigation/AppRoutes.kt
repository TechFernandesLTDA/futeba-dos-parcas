package com.futebadosparcas.compose.navigation

import com.futebadosparcas.domain.model.DeepLinkRoute

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

    /** Cadastro por e-mail e senha (#4424). Aberto pelo "Criar conta" do Login. */
    const val REGISTER = "register"
    const val GAMES = "games"
    const val CREATE_GAME = "create_game"
    const val GAME_DETAIL = "game/{gameId}"
    const val GROUPS = "groups"
    const val GROUP_DETAIL = "group/{groupId}"
    const val PROFILE = "profile"
    const val PROFILE_SETUP = "profile_setup"

    // ─── Bucket Core — ferramentas do organizador / pós-jogo (#2671) ──────────
    // Telas reais já existentes em ui/core/ cabeadas a partir do detalhe do jogo
    // (hub do organizador). Eliminam telas órfãs no NavHost (AC#4 da #2671).
    /** Relatório pós-jogo (presentes, pagamentos, placar, MVP). */
    const val POST_GAME_REPORT = "post_game_report/{gameId}"

    /** Estatísticas do organizador (jogos organizados, presença média, receita). */
    const val OWNER_STATS = "owner_stats/{ownerId}"

    /** Formação dos times de um jogo (requer gameId). */
    const val TEAM_FORMATION = "team_formation/{gameId}"

    /** Votação pós-jogo; indisponibilidade é apresentada explicitamente enquanto não portada. */
    const val MVP_VOTING = "mvp_voting/{gameId}"

    /** Convidar jogadores para um grupo (requer groupId). */
    const val INVITE_PLAYERS = "invite_players/{groupId}"

    /** Jogadores bloqueados de um grupo/jogo. */
    const val BLOCKED_PLAYERS = "blocked_players"

    // ─── Preferências ────────────────────────────────────────────────────────
    /** Tema (Claro / Escuro / Sistema + alto contraste) — paridade com Android/Web (#4097). */
    const val THEME_SETTINGS = "theme_settings"

    /** Exclusão de conta (#4391/#4401, App Store 5.1.1(v)). Acesso pelo hub de Perfil. */
    const val DELETE_ACCOUNT = "delete_account"

    // ─── Bucket Gamification ─────────────────────────────────────────────────
    const val RANKING = "ranking"
    const val BADGES = "badges"

    // ─── Bucket Discovery ────────────────────────────────────────────────────
    const val LOCATIONS = "locations"

    // ─── Bucket Power ────────────────────────────────────────────────────────
    const val CASHBOX = "cashbox"

    /**
     * Rota concreta para o hub de detalhe de jogo.
     *
     * Mantém a montagem de path em um único ponto enquanto a navegação
     * commonMain migra para argumentos tipados completos.
     */
    fun gameDetail(gameId: String): String =
        "game/${requireRouteId(gameId, "gameId")}"

    /**
     * Rota concreta para o detalhe de um grupo (B12).
     */
    fun groupDetail(groupId: String): String =
        "group/${requireRouteId(groupId, "groupId")}"

    /**
     * Rota concreta para a tela de convite de jogadores.
     *
     * O ID ainda chega do contexto do jogo/hub até a tela completa de grupo ser
     * portada para o composeApp, mas já não usamos placeholders fixos.
     */
    fun invitePlayers(groupId: String): String =
        "invite_players/${requireRouteId(groupId, "groupId")}"

    fun postGameReport(gameId: String): String =
        "post_game_report/${requireRouteId(gameId, "gameId")}"

    fun ownerStats(ownerId: String): String =
        "owner_stats/${requireRouteId(ownerId, "ownerId")}"

    fun teamFormation(gameId: String): String =
        "team_formation/${requireRouteId(gameId, "gameId")}"

    fun mvpVoting(gameId: String): String =
        "mvp_voting/${requireRouteId(gameId, "gameId")}"

    /**
     * Resolve uma URL de Universal Link / Deep Link (#4426) para uma rota do NavHost
     * do `composeApp`. Suporta `/game/{id}`, `/invite/{code}`, `/group/{id}` e `/ranking`.
     */
    fun resolveDeepLink(url: String): String? {
        val trimmed = url.trim()
        if (trimmed.isEmpty() || !DeepLinkRoute.isValidDeepLink(trimmed)) return null
        return runCatching {
            when (val parsed = DeepLinkRoute.parse(trimmed)) {
                is DeepLinkRoute.GameDetail -> gameDetail(parsed.gameId)
                is DeepLinkRoute.GameInvite -> gameDetail(parsed.gameId)
                is DeepLinkRoute.LiveGame -> gameDetail(parsed.gameId)
                is DeepLinkRoute.InviteByCode -> invitePlayers(parsed.inviteCode)
                is DeepLinkRoute.GroupInvite -> groupDetail(parsed.groupId)
                is DeepLinkRoute.GroupDetail -> groupDetail(parsed.groupId)
                is DeepLinkRoute.GroupRanking -> RANKING
                is DeepLinkRoute.Ranking -> RANKING
                is DeepLinkRoute.MyProfile, is DeepLinkRoute.UserProfile -> PROFILE
                is DeepLinkRoute.LocationDetail -> LOCATIONS
                else -> null
            }
        }.getOrNull()
    }

    private fun requireRouteId(value: String, name: String): String {
        val trimmed = value.trim()
        require(trimmed.isNotEmpty()) { "$name must not be blank" }
        require('/' !in trimmed) { "$name must not contain '/'" }
        return trimmed
    }
}
