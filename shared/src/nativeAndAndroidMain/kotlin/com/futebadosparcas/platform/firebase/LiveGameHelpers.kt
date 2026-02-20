package com.futebadosparcas.platform.firebase

import dev.gitlive.firebase.firestore.DocumentSnapshot

/**
 * Funções auxiliares para leitura de campos de LivePlayerStats.
 * Usado porque não podemos usar toObject() com modelos Android data.model no KMP.
 */

/**
 * Lê o número de gols de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getGoals(): Int = get<Long?>("goals")?.toInt() ?: 0

/**
 * Lê o número de assistências de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getAssists(): Int = get<Long?>("assists")?.toInt() ?: 0

/**
 * Lê o número de defesas de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getSaves(): Int = get<Long?>("saves")?.toInt() ?: 0

/**
 * Lê o número de cartões amarelos de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getYellowCards(): Int = get<Long?>("yellow_cards")?.toInt() ?: 0

/**
 * Lê o número de cartões vermelhos de um snapshot de forma segura.
 */
internal fun DocumentSnapshot.getRedCards(): Int = get<Long?>("red_cards")?.toInt() ?: 0

/**
 * Verifica se um snapshot de live_player_stats existe.
 */
internal fun DocumentSnapshot.hasPlayerStats(): Boolean = exists
