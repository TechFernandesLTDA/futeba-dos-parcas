package com.futebadosparcas.ui.theme

import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.runtime.Composable
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.poppins_bold
import com.futebadosparcas.compose.resources.poppins_light
import com.futebadosparcas.compose.resources.poppins_medium
import com.futebadosparcas.compose.resources.poppins_regular
import com.futebadosparcas.compose.resources.poppins_semibold
import org.jetbrains.compose.resources.Font

@Composable
internal actual fun rememberPlatformTypographyFontFamily(): FontFamily = FontFamily(
    Font(Res.font.poppins_light, FontWeight.Light),
    Font(Res.font.poppins_regular, FontWeight.Normal),
    Font(Res.font.poppins_medium, FontWeight.Medium),
    Font(Res.font.poppins_semibold, FontWeight.SemiBold),
    Font(Res.font.poppins_bold, FontWeight.Bold)
)
