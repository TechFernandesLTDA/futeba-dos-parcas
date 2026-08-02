package com.futebadosparcas.util

import android.content.Intent
import android.net.Uri
import androidx.core.net.toUri
import com.futebadosparcas.ui.navigation.Screen
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/** Parses both verified web links and the legacy custom scheme. */
class DeepLinkHelper {
    companion object {
        const val SCHEME = "futebadosparcas"
        const val VERIFIED_HOST = "futebadosparcas.web.app"
        const val VERIFIED_HOST_BR = "futebadosparcas.com.br"
        const val LEGACY_HOST = "futebadosparcas.com"

        private val HTTPS_HOSTS = setOf(VERIFIED_HOST, VERIFIED_HOST_BR, LEGACY_HOST)
    }

    fun parse(intent: Intent?): DeepLink = parse(intent?.dataString)

    fun parse(uri: Uri): DeepLink = parse(uri.toString())

    /** String entry point keeps parsing deterministic and locally unit-testable. */
    fun parse(rawUrl: String?): DeepLink {
        if (rawUrl.isNullOrBlank()) return DeepLink.None

        val uri = runCatching { URI(rawUrl) }
            .getOrElse { return DeepLink.Invalid("Malformed URL") }
        val scheme = uri.scheme?.lowercase()
        if (scheme != SCHEME && scheme != "https") {
            return DeepLink.Invalid("Invalid scheme: ${uri.scheme}")
        }

        val isCustomScheme = scheme == SCHEME
        if (!isCustomScheme && uri.host?.lowercase() !in HTTPS_HOSTS) {
            return DeepLink.Invalid("Invalid host: ${uri.host}")
        }

        val segments = uri.rawPath.orEmpty()
            .split('/')
            .filter { it.isNotBlank() }
            .map(::decodeSegment)
        val type = if (isCustomScheme) uri.host?.lowercase() else segments.firstOrNull()?.lowercase()
        val values = if (isCustomScheme) segments else segments.drop(1)

        fun required(index: Int): String? {
            return values.getOrNull(index)?.takeIf { it.isNotBlank() }
        }

        return when (type) {
            "game" -> required(0)?.let(DeepLink::Game)
                ?: DeepLink.Invalid("Missing game ID")
            "group" -> required(0)?.let(DeepLink::Group)
                ?: DeepLink.Invalid("Missing group ID")
            "profile" -> required(0)?.let(DeepLink::Profile)
                ?: DeepLink.Invalid("Missing user ID")
            "join" -> required(0)?.let(DeepLink::GroupInvite)
                ?: DeepLink.Invalid("Missing invite code")
            "invite" -> required(0)?.let(DeepLink::FriendInvite)
                ?: DeepLink.Invalid("Missing invite code")
            "checkin" -> {
                val gameId = required(0)
                val token = required(1)
                if (gameId != null && token != null) DeepLink.CheckIn(gameId, token)
                else DeepLink.Invalid("Missing check-in data")
            }
            "badges" -> DeepLink.Badges
            "rankings", "ranking" -> DeepLink.Rankings
            null -> DeepLink.None
            else -> DeepLink.Invalid("Unknown path: $type")
        }
    }

    fun createGameLink(gameId: String): Uri = "$SCHEME://game/${Uri.encode(gameId)}".toUri()
    fun createGroupLink(groupId: String): Uri = "$SCHEME://group/${Uri.encode(groupId)}".toUri()
    fun createProfileLink(userId: String): Uri = "$SCHEME://profile/${Uri.encode(userId)}".toUri()
    fun createInviteLink(inviteCode: String): Uri = "$SCHEME://invite/${Uri.encode(inviteCode)}".toUri()
    fun createShareableGameLink(gameId: String): String =
        "https://$VERIFIED_HOST_BR/game/${Uri.encode(gameId)}"
    fun createShareableGroupLink(groupId: String): String =
        "https://$VERIFIED_HOST_BR/group/${Uri.encode(groupId)}"

    fun isValid(uri: Uri): Boolean = parse(uri).let { it !is DeepLink.Invalid && it !is DeepLink.None }

    private fun decodeSegment(value: String): String =
        runCatching { URLDecoder.decode(value, StandardCharsets.UTF_8.name()) }.getOrDefault(value)
}

sealed class DeepLink {
    data class Game(val gameId: String) : DeepLink()
    data class Group(val groupId: String) : DeepLink()
    data class Profile(val userId: String) : DeepLink()
    data class GroupInvite(val inviteCode: String) : DeepLink()
    data class FriendInvite(val inviteCode: String) : DeepLink()
    data class CheckIn(val gameId: String, val token: String) : DeepLink()
    data object Badges : DeepLink()
    data object Rankings : DeepLink()
    data object None : DeepLink()
    data class Invalid(val reason: String) : DeepLink()
}

/** Maps external contracts to existing native destinations without exposing URL data as routes. */
fun DeepLink.toNavigationRoute(): String? = when (this) {
    is DeepLink.Game -> Screen.GameDetail.createRoute(encodeRouteSegment(gameId))
    is DeepLink.CheckIn -> Screen.GameDetail.createRoute(encodeRouteSegment(gameId))
    is DeepLink.Group -> Screen.GroupDetail.createRoute(encodeRouteSegment(groupId))
    is DeepLink.Profile -> Screen.Profile.route
    is DeepLink.GroupInvite -> Screen.Groups.route
    is DeepLink.FriendInvite -> Screen.Home.route
    DeepLink.Badges -> Screen.Badges.route
    DeepLink.Rankings -> Screen.Ranking.route
    is DeepLink.Invalid, DeepLink.None -> null
}

private fun encodeRouteSegment(value: String): String =
    URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20")
