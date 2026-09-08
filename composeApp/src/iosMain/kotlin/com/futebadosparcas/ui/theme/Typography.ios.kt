package com.futebadosparcas.ui.theme

import androidx.compose.ui.text.font.FontFamily
import androidx.compose.runtime.Composable

/** iOS intentionally uses SF via FontFamily.Default; Poppins is never resolved here (#4109). */
@Composable
internal actual fun rememberPlatformTypographyFontFamily(): FontFamily = FontFamily.Default
