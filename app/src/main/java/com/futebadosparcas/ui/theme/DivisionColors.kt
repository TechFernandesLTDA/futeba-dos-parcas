package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.LeagueDivision

/** Tokens de identidade e foreground das divisoes da Liga. */
object DivisionColors {
    val Bronze = GamificationColors.Bronze
    val Silver = GamificationColors.Silver
    val Gold = GamificationColors.Gold
    val Diamond = GamificationColors.Diamond

    val BronzeLightText = GamificationTextColors.Bronze
    val SilverLightText = GamificationTextColors.Silver
    val GoldLightText = GamificationTextColors.Gold
    val DiamondLightText = GamificationTextColors.Diamond

    val BronzeDarkText = GamificationTextColorsDark.Bronze
    val SilverDarkText = GamificationTextColorsDark.Silver
    val GoldDarkText = GamificationTextColorsDark.Gold
    val DiamondDarkText = GamificationTextColorsDark.Diamond

    // Alto contraste (light): tons mais escuros para o veu #B9D1EC da legenda (#4099).
    // No dark HIGH os *DarkText acima ja passam AAA e sao reutilizados.
    val BronzeHighContrastLightText = GamificationTextColorsHighContrast.Bronze
    val SilverHighContrastLightText = GamificationTextColorsHighContrast.Silver
    val GoldHighContrastLightText = GamificationTextColorsHighContrast.Gold
    val DiamondHighContrastLightText = GamificationTextColorsHighContrast.Diamond
}

fun divisionColor(division: LeagueDivision): Color = when (division) {
    LeagueDivision.BRONZE -> DivisionColors.Bronze
    LeagueDivision.PRATA -> DivisionColors.Silver
    LeagueDivision.OURO -> DivisionColors.Gold
    LeagueDivision.DIAMANTE -> DivisionColors.Diamond
}

/**
 * Foreground da divisao pela combinacao {light, dark} x {NORMAL, HIGH}.
 *
 * O scheme HIGH ([DynamicThemeEngine] -> [HighContrastLightColorScheme]) troca o
 * `primaryContainer` (#8CFB8F -> #1565C0) e os tokens light padrao reprovam AA na
 * legenda da Liga; por isso o nivel de contraste faz parte da resolucao (#4099).
 * Com [ContrastLevel.NORMAL] o resultado e identico ao validado no #4093.
 */
fun divisionTextColor(
    division: LeagueDivision,
    isDarkTheme: Boolean,
    contrastLevel: ContrastLevel = ContrastLevel.NORMAL
): Color = when (contrastLevel) {
    ContrastLevel.NORMAL -> when (division) {
        LeagueDivision.BRONZE -> if (isDarkTheme) DivisionColors.BronzeDarkText else DivisionColors.BronzeLightText
        LeagueDivision.PRATA -> if (isDarkTheme) DivisionColors.SilverDarkText else DivisionColors.SilverLightText
        LeagueDivision.OURO -> if (isDarkTheme) DivisionColors.GoldDarkText else DivisionColors.GoldLightText
        LeagueDivision.DIAMANTE -> if (isDarkTheme) DivisionColors.DiamondDarkText else DivisionColors.DiamondLightText
    }
    ContrastLevel.HIGH -> when (division) {
        LeagueDivision.BRONZE ->
            if (isDarkTheme) DivisionColors.BronzeDarkText else DivisionColors.BronzeHighContrastLightText
        LeagueDivision.PRATA ->
            if (isDarkTheme) DivisionColors.SilverDarkText else DivisionColors.SilverHighContrastLightText
        LeagueDivision.OURO ->
            if (isDarkTheme) DivisionColors.GoldDarkText else DivisionColors.GoldHighContrastLightText
        LeagueDivision.DIAMANTE ->
            if (isDarkTheme) DivisionColors.DiamondDarkText else DivisionColors.DiamondHighContrastLightText
    }
}

/** Foreground da divisao para o tema e nivel de contraste EFETIVOS do [FutebaTheme]. */
@Composable
fun divisionTextColor(division: LeagueDivision): Color =
    divisionTextColor(division, LocalIsDarkTheme.current, LocalContrastLevel.current)
