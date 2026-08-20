package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
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
    divisionTextColor(division, LocalIsDarkTheme.current)
