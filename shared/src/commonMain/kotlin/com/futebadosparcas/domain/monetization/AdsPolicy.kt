package com.futebadosparcas.domain.monetization

/**
 * Onde o banner pode aparecer. É uma LISTA DE PERMISSÃO: tela que não está aqui nunca
 * mostra anúncio. As telas críticas (pagamento, Pix, recibo, caixa, login, onboarding,
 * erro, jogo ao vivo, admin, dono de quadra, exclusão de conta) ficam de fora por construção;
 * a lista de bloqueio abaixo é uma segunda trava, caso alguém acrescente uma rota permitida
 * com nome sensível por engano.
 *
 * As rotas do Android (`Screen.*`) e do iOS (`AppRoutes.*`) usam os mesmos nomes de raiz.
 */
object AdsPolicy {

    /** Telas raiz de navegação onde o banner pode ficar (rodapé, sem cobrir ação). */
    val BANNER_ALLOWED_ROUTES: Set<String> = setOf(
        "home",
        "games",
        "players",
        "league",
        "groups",
        "ranking",
        "profile",
    )

    /** Trecho de rota que veta o banner mesmo que a rota esteja na lista de permissão. */
    private val BLOCKED_ROUTE_FRAGMENTS: List<String> = listOf(
        "payment", "pay", "pix", "receipt", "recibo", "cashbox", "checkout",
        "login", "register", "welcome", "onboarding", "verification", "setup",
        "error", "erro", "not_found",
        "live", "admin", "owner", "field_owner", "delete", "developer",
        "subscription", "sem_anuncios", "remove_ads",
    )

    fun isBannerRouteAllowed(route: String?): Boolean {
        val clean = route?.substringBefore('?')?.trim()?.lowercase().orEmpty()
        if (clean.isEmpty()) return false
        if (clean !in BANNER_ALLOWED_ROUTES) return false
        return BLOCKED_ROUTE_FRAGMENTS.none { clean.contains(it) }
    }
}
