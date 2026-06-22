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
    const val HOME_WELCOME = "Sua rodada começa aqui"
    const val HOME_SUBTITLE = "Jogos, grupos e perfil organizados de um jeito leve para acompanhar a próxima pelada."
    const val HOME_SECTION_QUICK_ACTIONS = "Acessos rápidos"
    const val HOME_SECTION_MATCHDAY = "Ritmo da semana"
    const val HOME_SECTION_TOOLS = "Ferramentas principais"
    const val HOME_ACTION_GAMES = "Ver jogos"
    const val HOME_ACTION_GROUPS = "Abrir grupos"
    const val HOME_ACTION_PROFILE = "Ajustar perfil"
    const val HOME_ACTION_WHATS_NEW = "Novidades"
    const val HOME_MATCHDAY_TITLE = "Próximas decisões"
    const val HOME_MATCHDAY_BODY = "Confirme presença, acompanhe quem já fechou o elenco e mantenha a rodada redonda."
    const val HOME_TOOLS_GAMES_TITLE = "Jogos"
    const val HOME_TOOLS_GAMES_BODY = "Consulte partidas abertas, detalhes do campo e status das confirmações."
    const val HOME_TOOLS_GROUPS_TITLE = "Grupos"
    const val HOME_TOOLS_GROUPS_BODY = "Centralize convites, combine a resenha e organize o núcleo da galera."
    const val HOME_TOOLS_PROFILE_TITLE = "Perfil"
    const val HOME_TOOLS_PROFILE_BODY = "Deixe cadastro, preferências e identidade do jogador em ordem."
    const val HOME_STATUS_LIVE = "Ao vivo"
    const val HOME_STATUS_UPDATED = "Atualizado"
    const val HOME_STATUS_PERSONAL = "Pessoal"

    // ---- SplashScreen ----
    const val SPLASH_APP_NAME = "Futeba dos Parças"
    const val SPLASH_CD_LOGO = "Futeba dos Parças"
    const val SPLASH_TAGLINE = "Organização da pelada com ritmo e clareza"
    const val SPLASH_PLATFORM_PREFIX = "Pronto para"

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

    // ---- Hubs de navegação composeApp ----
    const val GROUPS_HUB_TITLE = "Grupos"
    const val GROUPS_HUB_BODY = "Reúna a galera, oriente convites e mantenha a organização da rodada num só lugar."
    const val GROUPS_HUB_PRIMARY = "Ir para jogos"
    const val GROUPS_HUB_SECONDARY = "Ver novidades"
    const val PROFILE_HUB_TITLE = "Perfil"
    const val PROFILE_HUB_BODY = "Ajuste seus dados e deixe sua presença pronta para entrar em campo."
    const val PROFILE_HUB_PRIMARY = "Completar perfil"
    const val PROFILE_HUB_SECONDARY = "Ver estatísticas"
}
