package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Paleta semantica Compose (eventos de partida ao vivo, marcas).
 *
 * O ColorScheme Material 3 NAO vive mais aqui: ele e gerado em runtime pelo
 * [DynamicThemeEngine] a partir das seeds canonicas em `ThemeConfig.kt`
 * (issues #2683, #3933, #3934). O scheme estatico `FutebaLight/DarkColorScheme`
 * e os `md3_*` privados foram removidos — eram codigo morto que divergia do que
 * renderiza, e o gate de paridade agora valida as SEEDS, nao este arquivo.
 */

// ==========================================
// SEMANTIC COLORS COMPOSE (eventos de partida, marcas)
// ==========================================
//
// #4098: ThemePresets, GamificationColors, FieldTypeColors, GameStatusColors e
// BadgeRarityColors foram removidos — 0 consumidores no modulo e nao eram
// theme-aware. Cores fixas de gamificacao (ouro/prata/bronze do podio) vivem
// como constantes privadas na propria tela que as usa (PostGameReportScreen),
// com o foreground escolhido em runtime por DynamicThemeEngine.onColorFor(...).

/**
 * Cores para eventos de partida ao vivo
 */
object MatchEventColors {
    // Backgrounds claros para eventos
    val GoalBackground = Color(0xFFE8F5E9) // Verde claro
    val SubstitutionBackground = Color(0xFFFFF3E0) // Laranja claro
    val YellowCardBackground = Color(0xFFFFFDE7) // Amarelo claro
    val RedCardBackground = Color(0xFFFFEBEE) // Vermelho claro
    val FoulBackground = Color(0xFFF3E5F5) // Roxo claro

    // Cores de ícones/badges
    val YellowCard = Color(0xFFFDD835) // Cartão amarelo
    val RedCard = Color(0xFFE53935) // Cartão vermelho
}

/**
 * Cores de marcas/brands
 */
object BrandColors {
    val WhatsApp = Color(0xFF25D366) // Verde oficial WhatsApp
    val Pix = Color(0xFF00C9A7) // Verde-água Pix
}

