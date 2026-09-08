package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.util.ContrastHelper

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
}

fun divisionColor(division: LeagueDivision): Color = when (division) {
    LeagueDivision.BRONZE -> DivisionColors.Bronze
    LeagueDivision.PRATA -> DivisionColors.Silver
    LeagueDivision.OURO -> DivisionColors.Gold
    LeagueDivision.DIAMANTE -> DivisionColors.Diamond
}

fun divisionTextColor(division: LeagueDivision, isDarkTheme: Boolean): Color = when (division) {
    LeagueDivision.BRONZE -> if (isDarkTheme) DivisionColors.BronzeDarkText else DivisionColors.BronzeLightText
    LeagueDivision.PRATA -> if (isDarkTheme) DivisionColors.SilverDarkText else DivisionColors.SilverLightText
    LeagueDivision.OURO -> if (isDarkTheme) DivisionColors.GoldDarkText else DivisionColors.GoldLightText
    LeagueDivision.DIAMANTE -> if (isDarkTheme) DivisionColors.DiamondDarkText else DivisionColors.DiamondLightText
}

@Composable
fun divisionTextColor(division: LeagueDivision): Color =
    divisionTextColor(division, LocalIsDarkTheme.current, MaterialTheme.colorScheme)

/** Preserve the identity foreground when readable on every actual League surface. */
fun divisionTextColor(division: LeagueDivision, isDarkTheme: Boolean, scheme: ColorScheme): Color {
    val preferred = divisionTextColor(division, isDarkTheme)
    val identity = divisionColor(division)
    val card = identity.copy(alpha = 0.1f).compositeOver(scheme.surface)
    val backgrounds = listOf(
        identity.copy(alpha = 0.18f).compositeOver(scheme.surfaceVariant),
        identity.copy(alpha = 0.2f).compositeOver(card),
        identity.copy(alpha = 0.1f).compositeOver(scheme.background),
        scheme.primaryContainer.copy(alpha = 0.3f).compositeOver(scheme.surface)
    )
    fun minimumContrast(color: Color) = backgrounds.minOf { ContrastHelper.getContrastRatio(color, it) }
    if (minimumContrast(preferred) >= 4.5f) return preferred
    return listOf(scheme.onSurface, Color.Black, Color.White).maxBy { minimumContrast(it) }
}
