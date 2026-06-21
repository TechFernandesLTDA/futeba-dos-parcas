package com.futebadosparcas.ui

/**
 * Strings de UI do composeApp centralizadas como constantes Kotlin.
 *
 * DECISÃO TÉCNICA (#2775): O composeApp já possui infra de composeResources
 * (compose.components.resources + pasta composeResources/values/strings.xml),
 * mas nenhuma tela usa ainda stringResource(Res.string.*). Migrar para
 * Res.string é o caminho correto para i18n iOS, mas exige wiring completo
 * de MR + MokoResources ou org.jetbrains.compose.resources — fora de escopo
 * deste bugfix. Por ora, as strings PT-BR são extraídas aqui como const val
 * para eliminar literais hardcoded nas telas e facilitar a migração futura.
 *
 * TODO: Após habilitar stringResource(Res.string.*) no composeApp (Fase 3+),
 * mover cada const val para composeResources/values/strings.xml e substituir
 * as referências por stringResource(Res.string.<chave>).
 */
internal object UiStrings {

    // ---- Navegação (HomeScreen) ----
    const val APP_NAME = "Futeba dos Parças"
    const val NAV_HOME = "Início"
    const val NAV_GAMES = "Jogos"
    const val NAV_GROUPS = "Grupos"
    const val NAV_PROFILE = "Perfil"
    const val CD_WHATS_NEW = "Novidades"

    // ---- HomeTab ----
    const val HOME_WELCOME = "Bem-vindo!"

    // ---- SplashScreen ----
    const val SPLASH_APP_NAME = "Futeba dos Parças"
    const val SPLASH_CD_LOGO = "Futeba dos Parças"

    // ---- Detalhe do jogo / Hub do organizador (#2671) ----
    // Ponto de entrada que cabea as telas reais de ui/core/ no NavHost,
    // tornando-as alcançáveis pela navegação (sem telas órfãs).
    const val GAME_DETAIL_TITLE = "Detalhes do Jogo"
    const val GAME_DETAIL_ORGANIZER_TOOLS = "Ferramentas do organizador"
    const val GAME_DETAIL_POST_GAME_REPORT = "Relatório pós-jogo"
    const val GAME_DETAIL_OWNER_STATS = "Estatísticas do organizador"
    const val GAME_DETAIL_INVITE_PLAYERS = "Convidar jogadores"
    const val GAME_DETAIL_BLOCKED_PLAYERS = "Jogadores bloqueados"
    const val CD_BACK = "Voltar"
}
