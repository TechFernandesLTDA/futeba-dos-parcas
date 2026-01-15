package com.futebadosparcas.domain.model

/**
 * Modos de tema do aplicativo.
 */
enum class ThemeMode {
    LIGHT, DARK, SYSTEM
}

/**
 * Niveis de contraste para acessibilidade.
 */
enum class ContrastLevel {
    NORMAL, HIGH
}

/**
 * Cores de semente para geracao do tema Material 3.
 *
 * NOTA: Em Android, os valores Int sao representados como ARGB (Color Int).
 * Em outras plataformas, pode ser necessario adaptar (ex: UInt para iOS).
 */
data class SeedColors(
    val primary: Int,  // Cor primaria em formato ARGB
    val secondary: Int, // Cor secundaria em formato ARGB
    val tertiary: Int? = null
)

/**
 * Configuracao de tema do aplicativo.
 *
 * Valores padrao:
 * - Primary: #58CC02 (Futeba Green)
 * - Secondary: #FF9600 (Badge Orange)
 */
data class AppThemeConfig(
    val seedColors: SeedColors = SeedColors(
        primary = 0xFF58CC02.toInt(), // Verde Futeba (ARGB: FF 58 CC 02)
        secondary = 0xFFFF9600.toInt() // Laranja Badge (ARGB: FF FF 96 00)
    ),
    val mode: ThemeMode = ThemeMode.LIGHT,
    val contrastLevel: ContrastLevel = ContrastLevel.NORMAL
)
