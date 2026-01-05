package com.futebadosparcas.util

import android.content.Context
import android.content.SharedPreferences

/**
 * Gerencia o rastreamento de badges ja visualizadas pelo usuario.
 * Usa SharedPreferences para persistir os IDs de badges vistas.
 */
object SeenBadgesManager {

    private const val PREFS_NAME = "seen_badges_prefs"
    private const val KEY_SEEN_BADGES = "seen_badge_ids"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Verifica se uma badge ja foi vista pelo usuario.
     */
    fun hasBeenSeen(context: Context, badgeId: String): Boolean {
        val seenBadges = getSeenBadgeIds(context)
        return seenBadges.contains(badgeId)
    }

    /**
     * Marca uma badge como vista.
     */
    fun markAsSeen(context: Context, badgeId: String) {
        val seenBadges = getSeenBadgeIds(context).toMutableSet()
        seenBadges.add(badgeId)
        saveSeenBadgeIds(context, seenBadges)
    }

    /**
     * Retorna o conjunto de IDs de badges vistas.
     */
    fun getSeenBadgeIds(context: Context): Set<String> {
        return getPrefs(context).getStringSet(KEY_SEEN_BADGES, emptySet()) ?: emptySet()
    }

    /**
     * Salva o conjunto de IDs de badges vistas.
     */
    private fun saveSeenBadgeIds(context: Context, badgeIds: Set<String>) {
        getPrefs(context).edit()
            .putStringSet(KEY_SEEN_BADGES, badgeIds)
            .apply()
    }

    /**
     * Limpa todas as badges vistas (para debug/testes).
     */
    fun clearAll(context: Context) {
        getPrefs(context).edit()
            .remove(KEY_SEEN_BADGES)
            .apply()
    }
}
