package com.futebadosparcas.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Dimensões padronizadas do Material Design 3 para o Futeba dos Parças.
 *
 * Todas as dimensões devem usar estas constantes para garantir consistência
 * em toda a aplicação e evitar valores hardcoded.
 *
 * Baseado no Material Design 3 Type Scale e Spacing System.
 */
object AppDimensions {

    // ==========================================
    // SPACING - Sistema de espaçamento MD3
    // ==========================================
    val spacing_none = 0.dp
    val spacing_extraSmall = 4.dp
    val spacing_small = 8.dp
    val spacing_medium = 12.dp
    val spacing_large = 16.dp
    val spacing_extraLarge = 24.dp
    val spacing_huge = 32.dp
    val spacing_massive = 48.dp

    // Aliases para compatibilidade com código existente
    val spacing_xl = spacing_extraLarge
    val spacing_xxl = spacing_huge

    // ==========================================
    // PADDING - Padding interno de containers
    // ==========================================
    val padding_screen = spacing_large
    val padding_card = spacing_large
    val padding_button = 16.dp
    val padding_chip = 8.dp
    val padding_dialog = 24.dp
    val padding_medium = spacing_medium

    // ==========================================
    // BORDERS - Border radius
    // ==========================================
    val radius_small = 8.dp
    val radius_medium = 12.dp
    val radius_large = 16.dp
    val radius_extraLarge = 20.dp
    val radius_full = 28.dp

    // ==========================================
    // ICONS - Tamanhos de ícones
    // ==========================================
    val icon_small = 16.dp
    val icon_medium = 24.dp
    val icon_large = 32.dp
    val icon_extraLarge = 48.dp

    // ==========================================
    // AVATARS - Tamanhos de avatar
    // ==========================================
    val avatar_small = 32.dp
    val avatar_medium = 48.dp
    val avatar_large = 64.dp
    val avatar_extraLarge = 96.dp

    // ==========================================
    // ELEVATION - Sombras
    // ==========================================
    val elevation_none = 0.dp
    val elevation_small = 1.dp
    val elevation_medium = 4.dp
    val elevation_large = 8.dp

    // ==========================================
    // HEIGHTS - Alturas de componentes
    // ==========================================
    val height_button = 40.dp
    val height_button_large = 48.dp
    val height_input = 56.dp
    val height_nav_bar = 56.dp
    val height_top_bar = 56.dp
    val height_tab_row = 48.dp
    val height_list_item = 72.dp

    // ==========================================
    // WIDTHS - Larguras de componentes
    // ==========================================
    val width_avatar_small = avatar_small
    val width_avatar_medium = avatar_medium
    val width_avatar_large = avatar_large
    val width_rank_badge = 32.dp
    val width_stat_chip = 80.dp

    // ==========================================
    // SPECIFIC - Dimensões específicas
    // ==========================================
    val progress_height = 4.dp
    val divider_thickness = 1.dp
    val badge_size_small = 16.dp
    val badge_size_medium = 24.dp
    val shimmer_item_height = 80.dp
    val card_min_height = 120.dp

    // ==========================================
    // RANKING ESPECÍFICO
    // ==========================================
    val ranking_podium_height = 180.dp
    val ranking_item_height = 72.dp
    val ranking_my_position_height = 60.dp
    val rank_badge_size = 40.dp

    // ==========================================
    // GAMIFICATION
    // ==========================================
    val xp_bar_height = 6.dp
    val level_badge_height = 20.dp
    val milestone_icon_size = 24.dp
    val streak_fire_size = 20.dp
}

/**
 * Aliases mais curtos para uso frequente
 */
val Dp.none: Dp get() = 0.dp
val Dp.xs: Dp get() = 4.dp
val Dp.sm: Dp get() = 8.dp
val Dp.md: Dp get() = 12.dp
val Dp.lg: Dp get() = 16.dp
val Dp.xl: Dp get() = 24.dp
val Dp.xxl: Dp get() = 32.dp
