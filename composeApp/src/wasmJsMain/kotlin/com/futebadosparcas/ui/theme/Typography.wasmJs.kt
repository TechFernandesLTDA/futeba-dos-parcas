package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontFamily

/** #4109: wasmJs usa Poppins (paridade com a superfície principal). Família vem de `nonIosMain`. */
@Composable
internal actual fun rememberPlatformFontFamily(): FontFamily = rememberPoppinsFontFamily()
