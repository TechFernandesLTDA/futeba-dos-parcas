package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Paleta semantica Compose (gamificacao, campos, status, marcas).
 *
 * O ColorScheme Material 3 NAO vive mais aqui: ele e gerado em runtime pelo
 * [DynamicThemeEngine] a partir das seeds canonicas em `ThemeConfig.kt`
 * (issues #2683, #3933, #3934). O scheme estatico `FutebaLight/DarkColorScheme`
 * e os `md3_*` privados foram removidos — eram codigo morto que divergia do que
 * renderiza, e o gate de paridade agora valida as SEEDS, nao este arquivo.
 */

// ==========================================
// SEMANTIC COLORS COMPOSE (Gamificação)
// Para uso em Compose com cores especiais
// ==========================================

object ThemePresets {
    val Green = Color(0xFF00852A)
    val Blue = Color(0xFF1CB0F6)
    val Orange = Color(0xFFFF9600)
    val Purple = Color(0xFFCE82FF)
    val Red = Color(0xFFFF4B4B)
    val Navy = Color(0xFF2B70C9)

    val All = listOf(Green, Blue, Orange, Purple, Red, Navy)
}

/**
 * Cores especiais para gamificação
 */
object GamificationColors {
    val Gold = Color(0xFFFFD700)
    val Silver = Color(0xFFE0E0E0)
    val Bronze = Color(0xFFCD7F32)
    val Diamond = Color(0xFFB9F2FF)

    val Purple = Color(0xFF6200EA)
    val PurpleLight = Color(0xFFB388FF)

    val XpGreen = Color(0xFF00852A)  // WCAG AA
    val Xp = Color(0xFF9C27B0)       // Purple XP
    val XpLightGreen = Color(0xFF64DD17)
    val Level = Color(0xFF00BCD4)     // Cyan level
    val Mvp = Color(0xFFFFD700)       // Gold MVP
    val Streak = Color(0xFFFF5722)    // Orange streak
    val LevelUpGold = Color(0xFFFFAB00)

    val Platinum = Color(0xFF00E676)   // Platinum division
    val Champion = Color(0xFFE91E63)   // Champion division

    // Contraste para texto/ícones
    val DiamondDark = Color(0xFF008394) // Cyan 700
    val SilverDark = Color(0xFF616161) // Grey 700

    val FireStart = Color(0xFFFF9800) // Orange
    val FireEnd = Color(0xFFF44336) // Red

    // Gradient Variants
    val GoldLight = Color(0xFFFFE082)
    val BronzeLight = Color(0xFFE6A370)
}

/**
 * Cores para tipos de campo
 */
object FieldTypeColors {
    val Society = Color(0xFF2E7D32) // Verde escuro
    val Futsal = Color(0xFF1565C0) // Azul profundo
    val Campo = Color(0xFF558B2F) // Verde campo
    val Areia = Color(0xFFF9A825) // Amarelo areia
    val Outros = Color(0xFF757575) // Cinza neutro

    // Legacy aliases
    val Grass = Color(0xFF388E3C)
    val Synthetic = Color(0xFF4CAF50)
    val Sand = Color(0xFFFBC02D)
}

/**
 * Cores para status de jogos
 */
object GameStatusColors {
    val Scheduled = Color(0xFF388E3C) // Verde
    val InProgress = Color(0xFF1976D2) // Azul
    val Finished = Color(0xFF616161) // Cinza
    val Cancelled = Color(0xFFD32F2F) // Vermelho
    val Full = Color(0xFFFF6F00) // Laranja
    val Warning = Color(0xFFE6A300) // Amarelo/Laranja aviso
}

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

/**
 * Cores para raridades de badges
 */
object BadgeRarityColors {
    val Common = Color(0xFF8E8E8E) // Cinza
    val Rare = Color(0xFF2196F3) // Azul
    val Epic = Color(0xFF9C27B0) // Roxo
    val Legendary = Color(0xFFFF9800) // Laranja/Dourado
}
