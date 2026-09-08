package com.futebadosparcas.ui.theme

import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode

/** Keeps persisted enum values forward-compatible and gives iOS a safe SYSTEM default. */
internal fun themeModeFromPreference(value: String?): ThemeMode =
    runCatching { ThemeMode.valueOf(value.orEmpty()) }.getOrDefault(ThemeMode.SYSTEM)

internal fun contrastLevelFromPreference(value: String?): ContrastLevel =
    runCatching { ContrastLevel.valueOf(value.orEmpty()) }.getOrDefault(ContrastLevel.NORMAL)
