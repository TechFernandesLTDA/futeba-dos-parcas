package com.futebadosparcas.ui.theme

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
    // SPACING - Sistema de espaçamento MD3 (escala 8dp)
    // ==========================================
    // #2750: fonte canônica ÚNICA de espaçamento. O antigo objeto `Spacing`
    // (xs=4, sm=8, md=16, lg=24, xl=32) foi colapsado aqui — usar AppDimensions.
    val spacing_none = 0.dp
    val spacing_extraSmall = 4.dp
    val spacing_small = 8.dp
    val spacing_medium = 16.dp
    // #2956: spacing_large volta ao valor canônico da escala 8dp (24dp).
    // spacing_extraLarge fica como alias legado para o mesmo passo para evitar
    // churn excessivo em call-sites já ajustados antes da unificação.
    val spacing_large = 24.dp
    val spacing_extraLarge = 24.dp
    val spacing_huge = 32.dp
    val spacing_massive = 48.dp

    // Aliases para compatibilidade (#2750: alinhados com AdaptiveSpacing)
    val spacing_md = spacing_medium       // 16dp
    val spacing_lg = spacing_large        // 24dp
    val spacing_xl = spacing_huge         // 32dp
    val spacing_xxl = spacing_massive     // 48dp

    // ==========================================
    // PADDING - Padding interno de containers
    // ==========================================
    val padding_screen = spacing_medium
    val padding_card = spacing_medium
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
    val radius_extraLarge = 28.dp
    val radius_full = 999.dp

    // Aliases alinhados com web (radii) e composeApp (Shape)
    val radius_xs = spacing_extraSmall   // 4dp
    val radius_sm = radius_small         // 8dp
    val radius_md = radius_medium        // 12dp
    val radius_lg = radius_large         // 16dp
    val radius_xl = radius_extraLarge    // 28dp

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
    // ELEVATION - Sombras (chrome flutuante)
    // ==========================================
    // NOTA (#2689): Para cards de CONTEÚDO, prefira elevação TONAL via surfaceContainer*
    // (ver AppCards.kt). ShadowElevation fica reservado para chrome FLUTUANTE:
    //
    //   elevation_none  → cards de conteúdo (tonal: surfaceContainerLowest/Low/Container)
    //   elevation_small → nav bar / top bar (sombra sutil de separação)
    //   elevation_medium → dropdown sutil / chip selecionado
    //   elevation_large  → menu dropdown / popover
    //   elevation_modal  → dialog / bottom sheet / modal
    //
    // Mapeamento tonal recomendado para cards (#2689):
    //   surfaceContainerLowest (nível 0) → CompactCard (info secundária)
    //   surfaceContainerLow    (nível 1) → AppCard / HorizontalAppCard (padrão)
    //   surfaceContainer       (nível 2) → cards de destaque neutro
    //   surfaceContainerHigh   (nível 3) → cards de ação primária
    //   surfaceContainerHighest (nível 4) → cards de máximo destaque
    val elevation_none = 0.dp
    val elevation_small = 1.dp    // nav / chrome sutil
    val elevation_medium = 4.dp   // dropdown sutil
    val elevation_large = 8.dp    // menu / popover
    val elevation_modal = 16.dp   // dialog / modal

    // Aliases semânticos (#2754)
    val elevation_nav = elevation_small
    val elevation_card = elevation_medium
    val elevation_dropdown = elevation_large
    val elevation_overlay = elevation_large

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

// NOTA (#2143): os aliases de extensão Dp.md/Dp.lg foram removidos por estarem
// sem uso e por conflitarem com a convenção do projeto (md=16dp, lg=24dp).
// Eles definiam md=12dp/lg=16dp, criando ambiguidade.
// Use AppDimensions.spacing_* ou AdaptiveSpacing para espaçamento.
