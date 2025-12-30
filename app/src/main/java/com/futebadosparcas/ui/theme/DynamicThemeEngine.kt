package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.futebadosparcas.data.model.AppThemeConfig
import com.google.android.material.color.utilities.Hct
import com.google.android.material.color.utilities.TonalPalette

object DynamicThemeEngine {

    fun generateColorScheme(
        config: AppThemeConfig,
        isDark: Boolean
    ): ColorScheme {
        val primaryInt = config.seedColors.primary
        val secondaryInt = config.seedColors.secondary
        val tertiaryInt = config.seedColors.tertiary ?: secondaryInt

        // Material Color Utilities Logic
        val primaryPalette = TonalPalette.fromInt(primaryInt)
        val secondaryPalette = TonalPalette.fromInt(secondaryInt)
        val tertiaryPalette = TonalPalette.fromInt(tertiaryInt)
        
        // Neutral palette derived from primary with very low chroma
        val neutralPalette = TonalPalette.fromHueAndChroma(Hct.fromInt(primaryInt).hue, 6.0)
        val neutralVariantPalette = TonalPalette.fromHueAndChroma(Hct.fromInt(primaryInt).hue, 8.0)

        // Semantic Colors (Fixed)
        val errorColor = if(isDark) Color(0xFFFFB4AB) else Color(0xFFBA1A1A)
        val onErrorColor = if(isDark) Color(0xFF690005) else Color.White
        val errorContainerColor = if(isDark) Color(0xFF93000A) else Color(0xFFFFDAD6)
        val onErrorContainerColor = if(isDark) Color(0xFFFFDAD6) else Color(0xFF410002)

        return if (isDark) {
             darkColorScheme(
                primary = Color(primaryPalette.tone(80)),
                onPrimary = Color(primaryPalette.tone(20)),
                primaryContainer = Color(primaryPalette.tone(30)),
                onPrimaryContainer = Color(primaryPalette.tone(90)),
                
                secondary = Color(secondaryPalette.tone(80)),
                onSecondary = Color(secondaryPalette.tone(20)),
                secondaryContainer = Color(secondaryPalette.tone(30)),
                onSecondaryContainer = Color(secondaryPalette.tone(90)),
                
                tertiary = Color(tertiaryPalette.tone(80)),
                onTertiary = Color(tertiaryPalette.tone(20)),
                tertiaryContainer = Color(tertiaryPalette.tone(30)),
                onTertiaryContainer = Color(tertiaryPalette.tone(90)),

                background = Color(0xFF1D1B20), // Standard M3 Dark Background (matches XML)
                onBackground = Color(0xFFE6E1E5), // Standard M3 OnBackground
                
                surface = Color(0xFF1D1B20),    // Standard M3 Dark Surface (matches XML)
                onSurface = Color(0xFFE6E1E5),    // Standard M3 OnSurface
                surfaceVariant = Color(neutralVariantPalette.tone(30)),
                onSurfaceVariant = Color(neutralVariantPalette.tone(80)),
                
                outline = Color(neutralVariantPalette.tone(60)),
                outlineVariant = Color(neutralVariantPalette.tone(30)),
                
                error = errorColor,
                onError = onErrorColor,
                errorContainer = errorContainerColor,
                onErrorContainer = onErrorContainerColor
            )
        } else {
             lightColorScheme(
                primary = Color(primaryInt), // Use exact XML color
                onPrimary = Color.White,
                primaryContainer = Color(primaryPalette.tone(90)),
                onPrimaryContainer = Color(primaryPalette.tone(10)),
                
                secondary = Color(secondaryInt), // Use exact XML color
                onSecondary = Color.White,
                secondaryContainer = Color(secondaryPalette.tone(90)),
                onSecondaryContainer = Color(secondaryPalette.tone(10)),

                tertiary = Color(tertiaryInt), // Use exact XML color
                onTertiary = Color.White,
                tertiaryContainer = Color(tertiaryPalette.tone(90)),
                onTertiaryContainer = Color(tertiaryPalette.tone(10)),

                background = Color(neutralPalette.tone(100)), // Pure White to match XML
                onBackground = Color(neutralPalette.tone(10)),
                
                surface = Color(neutralPalette.tone(100)),
                onSurface = Color(neutralPalette.tone(10)),
                surfaceVariant = Color(neutralVariantPalette.tone(90)),
                onSurfaceVariant = Color(neutralVariantPalette.tone(30)),
                
                outline = Color(neutralVariantPalette.tone(50)),
                outlineVariant = Color(neutralVariantPalette.tone(80)),

                surfaceTint = Color.Transparent, // Disable M3 tonal tinting to stay clean White
                error = errorColor,
                onError = onErrorColor,
                errorContainer = errorContainerColor,
                onErrorContainer = onErrorContainerColor
            )
        }
    }
}
