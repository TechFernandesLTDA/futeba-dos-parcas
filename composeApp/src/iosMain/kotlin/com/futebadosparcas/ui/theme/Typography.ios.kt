package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontFamily

/**
 * #2670/#4109: iOS usa a fonte de sistema (SF), aproximando a UI do HIG.
 *
 * Decisão registrada: SF no iOS, NÃO a fonte de marca (Android/wasmJs). Este `actual`
 * não referencia nenhum acessor `Res.font.*` — os `.ttf` da fonte de marca vivem em
 * `nonIosMain` e não são empacotados no `ComposeApp.framework`.
 */
@Composable
internal actual fun rememberPlatformFontFamily(): FontFamily = FontFamily.Default
