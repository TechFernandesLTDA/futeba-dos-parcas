package com.futebadosparcas.platform.firebase

import com.google.firebase.firestore.DocumentSnapshot

/**
 * Helper functions para ler campos de LivePlayerStats manualmente.
 * Usado porque não podemos usar toObject() com modelos Android data.model no KMP.
 */

/**
 * Lê o número de gols de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getGoals(): Int = getLong("goals")?.toInt() ?: 0

/**
 * Lê o número de assistências de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getAssists(): Int = getLong("assists")?.toInt() ?: 0

/**
 * Lê o número de defesas de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getSaves(): Int = getLong("saves")?.toInt() ?: 0

/**
 * Lê o número de cartões amarelos de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getYellowCards(): Int = getLong("yellow_cards")?.toInt() ?: 0

/**
 * Lê o número de cartões vermelhos de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getRedCards(): Int = getLong("red_cards")?.toInt() ?: 0

/**
 * Verifica se um snapshot de live_player_stats existe.
 */
internal fun DocumentSnapshot.hasPlayerStats(): Boolean = exists()
