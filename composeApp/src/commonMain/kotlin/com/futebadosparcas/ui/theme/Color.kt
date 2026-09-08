package com.futebadosparcas.ui.theme

/**
 * #4098 — ThemePresets, GamificationColors, FieldTypeColors, GameStatusColors, and
 * BadgeRarityColors had no ComposeApp callers. The live CMP UI uses the runtime
 * Material [DynamicThemeEngine] ColorScheme instead, avoiding a second non-theme-aware
 * palette.
 */
