package com.futebadosparcas.util

import android.content.Intent
import android.net.Uri
import androidx.core.net.toUri
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Deep Link Helper
 *
 * Handles deep link parsing and validation for the app.
 * Supports various deep link formats for navigation.
 *
 * Supported formats:
 * - futebadosparcas://game/{gameId}
 * - futebadosparcas://group/{groupId}
 * - futebadosparcas://profile/{userId}
 * - futebadosparcas://invite/{inviteCode}
 * - https://futebadosparcas.com/game/{gameId}
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var deepLinkHelper: DeepLinkHelper
 *
 * val deepLink = deepLinkHelper.parse(intent)
 * when (deepLink) {
 *     is DeepLink.Game -> navigateToGame(deepLink.gameId)
 *     is DeepLink.Group -> navigateToGroup(deepLink.groupId)
 *     else -> { /* Handle unknown */ }
 * }
 * ```
 */
@Singleton
class DeepLinkHelper @Inject constructor() {

    companion object {
        const val SCHEME = "futebadosparcas"
        const val HOST = "futebadosparcas.com"

        // Path patterns
        const val PATH_GAME = "game"
        const val PATH_GROUP = "group"
        const val PATH_PROFILE = "profile"
        const val PATH_INVITE = "invite"
        const val PATH_BADGES = "badges"
        const val PATH_RANKINGS = "rankings"
    }

    /**
     * Parse deep link from Intent
     */
    fun parse(intent: Intent?): DeepLink {
        val uri = intent?.data ?: return DeepLink.None

        return parse(uri)
    }

    /**
     * Parse deep link from Uri
     */
    fun parse(uri: Uri): DeepLink {
        // Validate scheme
        if (uri.scheme != SCHEME && uri.scheme != "https") {
            return DeepLink.Invalid("Invalid scheme: ${uri.scheme}")
        }

        // Validate host for https URLs
        if (uri.scheme == "https" && uri.host != HOST) {
            return DeepLink.Invalid("Invalid host: ${uri.host}")
        }

        // Parse path segments
        val pathSegments = uri.pathSegments
        if (pathSegments.isEmpty()) {
            return DeepLink.None
        }

        val type = pathSegments[0]
        val id = pathSegments.getOrNull(1)

        return when (type) {
            PATH_GAME -> {
                if (id.isNullOrBlank()) {
                    DeepLink.Invalid("Missing game ID")
                } else {
                    DeepLink.Game(id)
                }
            }
            PATH_GROUP -> {
                if (id.isNullOrBlank()) {
                    DeepLink.Invalid("Missing group ID")
                } else {
                    DeepLink.Group(id)
                }
            }
            PATH_PROFILE -> {
                if (id.isNullOrBlank()) {
                    DeepLink.Invalid("Missing user ID")
                } else {
                    DeepLink.Profile(id)
                }
            }
            PATH_INVITE -> {
                if (id.isNullOrBlank()) {
                    DeepLink.Invalid("Missing invite code")
                } else {
                    DeepLink.Invite(id)
                }
            }
            PATH_BADGES -> DeepLink.Badges
            PATH_RANKINGS -> DeepLink.Rankings
            else -> DeepLink.Invalid("Unknown path: $type")
        }
    }

    /**
     * Create deep link Uri
     */
    fun createGameLink(gameId: String): Uri {
        return "$SCHEME://$PATH_GAME/$gameId".toUri()
    }

    fun createGroupLink(groupId: String): Uri {
        return "$SCHEME://$PATH_GROUP/$groupId".toUri()
    }

    fun createProfileLink(userId: String): Uri {
        return "$SCHEME://$PATH_PROFILE/$userId".toUri()
    }

    fun createInviteLink(inviteCode: String): Uri {
        return "$SCHEME://$PATH_INVITE/$inviteCode".toUri()
    }

    /**
     * Create shareable HTTPS link
     */
    fun createShareableGameLink(gameId: String): String {
        return "https://$HOST/$PATH_GAME/$gameId"
    }

    fun createShareableGroupLink(groupId: String): String {
        return "https://$HOST/$PATH_GROUP/$groupId"
    }

    /**
     * Validate deep link
     */
    fun isValid(uri: Uri): Boolean {
        return parse(uri) !is DeepLink.Invalid && parse(uri) !is DeepLink.None
    }
}

/**
 * Deep Link types
 */
sealed class DeepLink {
    data class Game(val gameId: String) : DeepLink()
    data class Group(val groupId: String) : DeepLink()
    data class Profile(val userId: String) : DeepLink()
    data class Invite(val inviteCode: String) : DeepLink()
    object Badges : DeepLink()
    object Rankings : DeepLink()
    object None : DeepLink()
    data class Invalid(val reason: String) : DeepLink()
}
