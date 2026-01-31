package com.futebadosparcas.domain.model

/**
 * Rotas de deep link do aplicativo.
 * Compatível com Android e iOS (Universal Links).
 *
 * Esquemas suportados:
 * - futeba:// (custom scheme)
 * - https://futeba.app (universal link)
 * - https://futebadosparcas.page.link (Firebase Dynamic Links)
 */
sealed class DeepLinkRoute(
    val path: String,
    val requiresAuth: Boolean = true
) {
    /**
     * Extrai parâmetros da URL
     */
    abstract fun extractParams(url: String): Map<String, String>

    /**
     * Gera URL completa para compartilhamento
     */
    abstract fun toShareableUrl(): String

    // ==================== Jogos ====================

    /**
     * Detalhes de um jogo específico
     * Exemplo: futeba://game/abc123 ou https://futeba.app/game/abc123
     */
    data class GameDetail(val gameId: String) : DeepLinkRoute("/game/{gameId}") {
        override fun extractParams(url: String): Map<String, String> = mapOf("gameId" to gameId)
        override fun toShareableUrl(): String = "$BASE_URL/game/$gameId"

        companion object {
            fun fromUrl(url: String): GameDetail? {
                val regex = Regex(".*/game/([^/?]+)")
                return regex.find(url)?.groupValues?.get(1)?.let { GameDetail(it) }
            }
        }
    }

    /**
     * Convite para jogo (confirmação rápida)
     * Exemplo: futeba://game/abc123/join?token=xyz
     */
    data class GameInvite(
        val gameId: String,
        val inviteToken: String? = null
    ) : DeepLinkRoute("/game/{gameId}/join", requiresAuth = true) {
        override fun extractParams(url: String): Map<String, String> = buildMap {
            put("gameId", gameId)
            inviteToken?.let { put("token", it) }
        }
        override fun toShareableUrl(): String = buildString {
            append("$BASE_URL/game/$gameId/join")
            inviteToken?.let { append("?token=$it") }
        }

        companion object {
            fun fromUrl(url: String): GameInvite? {
                val regex = Regex(".*/game/([^/?]+)/join(?:\\?token=([^&]+))?")
                val match = regex.find(url) ?: return null
                return GameInvite(
                    gameId = match.groupValues[1],
                    inviteToken = match.groupValues.getOrNull(2)?.takeIf { it.isNotEmpty() }
                )
            }
        }
    }

    /**
     * Jogo ao vivo (placar em tempo real)
     * Exemplo: futeba://game/abc123/live
     */
    data class LiveGame(val gameId: String) : DeepLinkRoute("/game/{gameId}/live") {
        override fun extractParams(url: String): Map<String, String> = mapOf("gameId" to gameId)
        override fun toShareableUrl(): String = "$BASE_URL/game/$gameId/live"

        companion object {
            fun fromUrl(url: String): LiveGame? {
                val regex = Regex(".*/game/([^/?]+)/live")
                return regex.find(url)?.groupValues?.get(1)?.let { LiveGame(it) }
            }
        }
    }

    // ==================== Grupos ====================

    /**
     * Detalhes de um grupo
     * Exemplo: futeba://group/xyz789
     */
    data class GroupDetail(val groupId: String) : DeepLinkRoute("/group/{groupId}") {
        override fun extractParams(url: String): Map<String, String> = mapOf("groupId" to groupId)
        override fun toShareableUrl(): String = "$BASE_URL/group/$groupId"

        companion object {
            fun fromUrl(url: String): GroupDetail? {
                val regex = Regex(".*/group/([^/?]+)(?:/)?$")
                return regex.find(url)?.groupValues?.get(1)?.let { GroupDetail(it) }
            }
        }
    }

    /**
     * Convite para grupo
     * Exemplo: futeba://group/xyz789/join?code=ABC123
     */
    data class GroupInvite(
        val groupId: String,
        val inviteCode: String? = null
    ) : DeepLinkRoute("/group/{groupId}/join") {
        override fun extractParams(url: String): Map<String, String> = buildMap {
            put("groupId", groupId)
            inviteCode?.let { put("code", it) }
        }
        override fun toShareableUrl(): String = buildString {
            append("$BASE_URL/group/$groupId/join")
            inviteCode?.let { append("?code=$it") }
        }

        companion object {
            fun fromUrl(url: String): GroupInvite? {
                val regex = Regex(".*/group/([^/?]+)/join(?:\\?code=([^&]+))?")
                val match = regex.find(url) ?: return null
                return GroupInvite(
                    groupId = match.groupValues[1],
                    inviteCode = match.groupValues.getOrNull(2)?.takeIf { it.isNotEmpty() }
                )
            }
        }
    }

    // ==================== Perfil ====================

    /**
     * Perfil de usuário
     * Exemplo: futeba://profile/user123
     */
    data class UserProfile(val userId: String) : DeepLinkRoute("/profile/{userId}") {
        override fun extractParams(url: String): Map<String, String> = mapOf("userId" to userId)
        override fun toShareableUrl(): String = "$BASE_URL/profile/$userId"

        companion object {
            fun fromUrl(url: String): UserProfile? {
                val regex = Regex(".*/profile/([^/?]+)")
                return regex.find(url)?.groupValues?.get(1)?.let { UserProfile(it) }
            }
        }
    }

    /**
     * Próprio perfil do usuário logado
     */
    data object MyProfile : DeepLinkRoute("/profile") {
        override fun extractParams(url: String): Map<String, String> = emptyMap()
        override fun toShareableUrl(): String = "$BASE_URL/profile"
    }

    // ==================== Locais ====================

    /**
     * Detalhes de um local
     * Exemplo: futeba://location/loc123
     */
    data class LocationDetail(val locationId: String) : DeepLinkRoute("/location/{locationId}") {
        override fun extractParams(url: String): Map<String, String> = mapOf("locationId" to locationId)
        override fun toShareableUrl(): String = "$BASE_URL/location/$locationId"

        companion object {
            fun fromUrl(url: String): LocationDetail? {
                val regex = Regex(".*/location/([^/?]+)")
                return regex.find(url)?.groupValues?.get(1)?.let { LocationDetail(it) }
            }
        }
    }

    // ==================== Notificações ====================

    /**
     * Tela de notificações
     */
    data object Notifications : DeepLinkRoute("/notifications") {
        override fun extractParams(url: String): Map<String, String> = emptyMap()
        override fun toShareableUrl(): String = "$BASE_URL/notifications"
    }

    /**
     * Notificação específica
     */
    data class NotificationDetail(val notificationId: String) : DeepLinkRoute("/notification/{notificationId}") {
        override fun extractParams(url: String): Map<String, String> = mapOf("notificationId" to notificationId)
        override fun toShareableUrl(): String = "$BASE_URL/notification/$notificationId"

        companion object {
            fun fromUrl(url: String): NotificationDetail? {
                val regex = Regex(".*/notification/([^/?]+)")
                return regex.find(url)?.groupValues?.get(1)?.let { NotificationDetail(it) }
            }
        }
    }

    // ==================== Rankings ====================

    /**
     * Tela de ranking geral
     */
    data object Ranking : DeepLinkRoute("/ranking") {
        override fun extractParams(url: String): Map<String, String> = emptyMap()
        override fun toShareableUrl(): String = "$BASE_URL/ranking"
    }

    /**
     * Ranking de grupo específico
     */
    data class GroupRanking(val groupId: String) : DeepLinkRoute("/group/{groupId}/ranking") {
        override fun extractParams(url: String): Map<String, String> = mapOf("groupId" to groupId)
        override fun toShareableUrl(): String = "$BASE_URL/group/$groupId/ranking"

        companion object {
            fun fromUrl(url: String): GroupRanking? {
                val regex = Regex(".*/group/([^/?]+)/ranking")
                return regex.find(url)?.groupValues?.get(1)?.let { GroupRanking(it) }
            }
        }
    }

    // ==================== Desafios ====================

    /**
     * Tela de desafios semanais
     */
    data object Challenges : DeepLinkRoute("/challenges") {
        override fun extractParams(url: String): Map<String, String> = emptyMap()
        override fun toShareableUrl(): String = "$BASE_URL/challenges"
    }

    // ==================== Compartilhamento ====================

    /**
     * Compartilhar resultado de jogo
     * Exemplo: futeba://share/result/game123
     */
    data class ShareGameResult(val gameId: String) : DeepLinkRoute("/share/result/{gameId}") {
        override fun extractParams(url: String): Map<String, String> = mapOf("gameId" to gameId)
        override fun toShareableUrl(): String = "$BASE_URL/share/result/$gameId"

        companion object {
            fun fromUrl(url: String): ShareGameResult? {
                val regex = Regex(".*/share/result/([^/?]+)")
                return regex.find(url)?.groupValues?.get(1)?.let { ShareGameResult(it) }
            }
        }
    }

    /**
     * Card de MVP compartilhável
     */
    data class ShareMvpCard(
        val gameId: String,
        val playerId: String
    ) : DeepLinkRoute("/share/mvp/{gameId}/{playerId}") {
        override fun extractParams(url: String): Map<String, String> = mapOf(
            "gameId" to gameId,
            "playerId" to playerId
        )
        override fun toShareableUrl(): String = "$BASE_URL/share/mvp/$gameId/$playerId"

        companion object {
            fun fromUrl(url: String): ShareMvpCard? {
                val regex = Regex(".*/share/mvp/([^/?]+)/([^/?]+)")
                val match = regex.find(url) ?: return null
                return ShareMvpCard(
                    gameId = match.groupValues[1],
                    playerId = match.groupValues[2]
                )
            }
        }
    }

    companion object {
        const val BASE_URL = "https://futeba.app"
        const val CUSTOM_SCHEME = "futeba"
        const val DYNAMIC_LINK_DOMAIN = "futebadosparcas.page.link"

        /**
         * Esquemas de URL suportados
         */
        val supportedSchemes = listOf(
            CUSTOM_SCHEME,
            "https"
        )

        /**
         * Hosts suportados para deep links
         */
        val supportedHosts = listOf(
            "futeba.app",
            "www.futeba.app",
            DYNAMIC_LINK_DOMAIN
        )

        /**
         * Parseia uma URL e retorna a rota correspondente
         */
        fun parse(url: String): DeepLinkRoute? {
            // Normaliza a URL
            val normalizedUrl = url
                .replace("$CUSTOM_SCHEME://", "$BASE_URL/")
                .trimEnd('/')

            // Tenta cada parser em ordem de especificidade
            return GameInvite.fromUrl(normalizedUrl)
                ?: LiveGame.fromUrl(normalizedUrl)
                ?: ShareMvpCard.fromUrl(normalizedUrl)
                ?: ShareGameResult.fromUrl(normalizedUrl)
                ?: GameDetail.fromUrl(normalizedUrl)
                ?: GroupInvite.fromUrl(normalizedUrl)
                ?: GroupRanking.fromUrl(normalizedUrl)
                ?: GroupDetail.fromUrl(normalizedUrl)
                ?: UserProfile.fromUrl(normalizedUrl)
                ?: LocationDetail.fromUrl(normalizedUrl)
                ?: NotificationDetail.fromUrl(normalizedUrl)
                ?: parseStaticRoutes(normalizedUrl)
        }

        /**
         * Parseia rotas estáticas (sem parâmetros)
         */
        private fun parseStaticRoutes(url: String): DeepLinkRoute? {
            return when {
                url.endsWith("/profile") -> MyProfile
                url.endsWith("/notifications") -> Notifications
                url.endsWith("/ranking") -> Ranking
                url.endsWith("/challenges") -> Challenges
                else -> null
            }
        }

        /**
         * Verifica se uma URL é um deep link válido do app
         */
        fun isValidDeepLink(url: String): Boolean {
            if (url.startsWith("$CUSTOM_SCHEME://")) return true

            return supportedHosts.any { host ->
                url.contains(host, ignoreCase = true)
            }
        }
    }
}

/**
 * Resultado do parsing de deep link.
 */
sealed class DeepLinkResult {
    data class Success(val route: DeepLinkRoute) : DeepLinkResult()
    data class RequiresAuth(val route: DeepLinkRoute) : DeepLinkResult()
    data class Invalid(val url: String, val reason: String) : DeepLinkResult()
    data object NotADeepLink : DeepLinkResult()
}

/**
 * Helper para processar deep links.
 */
object DeepLinkProcessor {
    /**
     * Processa uma URL e retorna o resultado apropriado.
     */
    fun process(url: String, isAuthenticated: Boolean): DeepLinkResult {
        if (!DeepLinkRoute.isValidDeepLink(url)) {
            return DeepLinkResult.NotADeepLink
        }

        val route = DeepLinkRoute.parse(url)
            ?: return DeepLinkResult.Invalid(url, "Rota não reconhecida")

        return if (route.requiresAuth && !isAuthenticated) {
            DeepLinkResult.RequiresAuth(route)
        } else {
            DeepLinkResult.Success(route)
        }
    }
}
