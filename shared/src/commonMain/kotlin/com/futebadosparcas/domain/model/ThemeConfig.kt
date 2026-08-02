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
 *
 * Os tres acentos M3 (primary/secondary/tertiary) DEVEM ser distintos: se
 * [tertiary] for null o engine faz fallback para [secondary], o que colapsa
 * os dois papeis na mesma cor (#3933). Sempre passe os tres.
 */
data class SeedColors(
    val primary: Int,  // Cor primaria em formato ARGB
    val secondary: Int, // Cor secundaria em formato ARGB
    val tertiary: Int? = null
)

/**
 * Configuracao de tema do aplicativo.
 *
 * Seeds canonicas mobile — fonte unica de verdade (espelham
 * `shared/design-tokens.json` -> brand/palette). NAO hardcodar estes hex em
 * outros arquivos: referencie [AppThemeConfig] (ou [DefaultSeeds]) para evitar
 * drift (issues #3933/#3934).
 *
 * - Primary:   #00852A (Futeba Green, WCAG AA — brand.primary)
 * - Secondary: #005FCC (Azul de destaque — palette.secondary.main, paridade web)
 * - Tertiary:  #FF6D00 (Laranja complementar — brand.tertiary, distinto do azul)
 */
data class AppThemeConfig(
    val seedColors: SeedColors = DefaultSeeds.toSeedColors(),
    val mode: ThemeMode = ThemeMode.LIGHT,
    val contrastLevel: ContrastLevel = ContrastLevel.NORMAL,
    val useDynamicColor: Boolean = false    // #2684: Material You dynamic color (Android 12+)
) {

    companion object {
        // Valor default real — tambem usado por ThemeRepositoryImpl e por testes.
        val DEFAULT = AppThemeConfig()
    }
}

/**
 * Seeds canonicas mobile (ARGB), espelhando `shared/design-tokens.json`.
 *
 * Centralizadas para que [AppThemeConfig] e [ThemeRepositoryImpl] leiam da
 * mesma fonte, em vez de cada um hardcodar hex literais (#3934 passo 2).
 */
object DefaultSeeds {
    const val PRIMARY_ARGB: Int = 0xFF00852A.toInt()   // #00852A — Verde Futeba AA
    const val SECONDARY_ARGB: Int = 0xFF005FCC.toInt() // #005FCC — Azul web (paridade)
    const val TERTIARY_ARGB: Int = 0xFFFF6D00.toInt()  // #FF6D00 — Laranja complementar

    fun toSeedColors(): SeedColors = SeedColors(
        primary = PRIMARY_ARGB,
        secondary = SECONDARY_ARGB,
        tertiary = TERTIARY_ARGB
    )
}
