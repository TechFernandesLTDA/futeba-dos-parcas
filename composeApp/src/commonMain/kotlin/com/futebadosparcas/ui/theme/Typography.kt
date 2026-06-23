package com.futebadosparcas.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.poppins_bold
import com.futebadosparcas.compose.resources.poppins_light
import com.futebadosparcas.compose.resources.poppins_medium
import com.futebadosparcas.compose.resources.poppins_regular
import com.futebadosparcas.compose.resources.poppins_semibold
import org.jetbrains.compose.resources.Font

/**
 * #2675 — Família de fonte Poppins carregada via composeResources (cross-platform).
 *
 * Os arquivos .ttf vivem em `composeApp/src/commonMain/composeResources/font/` e são
 * os MESMOS pesos usados no Android (`app/src/main/res/font/poppins_*.ttf`), garantindo
 * paridade visual entre Android e iOS.
 *
 * O carregamento de fonte via `org.jetbrains.compose.resources.Font(...)` é @Composable
 * no Compose Multiplatform (resolve o asset de forma assíncrona), por isso a família
 * precisa ser construída dentro de um contexto @Composable — daí
 * `rememberPoppinsFontFamily()` em vez de uma `val` top-level.
 */
@Composable
private fun rememberPoppinsFontFamily(): FontFamily = FontFamily(
    Font(Res.font.poppins_light, FontWeight.Light),
    Font(Res.font.poppins_regular, FontWeight.Normal),
    Font(Res.font.poppins_medium, FontWeight.Medium),
    Font(Res.font.poppins_semibold, FontWeight.SemiBold),
    Font(Res.font.poppins_bold, FontWeight.Bold)
)

/**
 * #2675/#2670 — Typography Material 3 do app usando a fonte apropriada por plataforma.
 *
 * Android e wasmJs mantêm Poppins para paridade com a superfície principal. iOS passa
 * por `platformTypographyFontFamily(...)` e usa a fonte de sistema do target, aproximando
 * a UI do HIG/SF sem duplicar escalas tipográficas.
 *
 * Dynamic Type / acessibilidade: todas as medidas usam `sp` (unidade escalável), então
 * a tipografia respeita o ajuste de tamanho de fonte do sistema onde a plataforma o
 * propaga ao Compose. No iOS, o Compose Multiplatform (até CMP 1.10) NÃO expõe uma API
 * pública para ler o nível de Dynamic Type do UIKit dentro do Compose; o uso de `sp`
 * garante o melhor comportamento disponível sem inventar API inexistente.
 *
 * É @Composable porque depende de `rememberPoppinsFontFamily()`.
 */
@Composable
fun rememberFutebaTypography(): Typography {
    val appFontFamily = platformTypographyFontFamily(rememberPoppinsFontFamily())
    return Typography(
        displayLarge = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Normal,
            fontSize = 57.sp,
            lineHeight = 64.sp,
            letterSpacing = (-0.25).sp
        ),
        displayMedium = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Normal,
            fontSize = 45.sp,
            lineHeight = 52.sp,
            letterSpacing = 0.sp
        ),
        displaySmall = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Normal,
            fontSize = 36.sp,
            lineHeight = 44.sp,
            letterSpacing = 0.sp
        ),
        headlineLarge = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 32.sp,
            lineHeight = 40.sp,
            letterSpacing = 0.sp
        ),
        headlineMedium = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 28.sp,
            lineHeight = 36.sp,
            letterSpacing = 0.sp
        ),
        headlineSmall = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 24.sp,
            lineHeight = 32.sp,
            letterSpacing = 0.sp
        ),
        titleLarge = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 22.sp,
            lineHeight = 28.sp,
            letterSpacing = 0.sp
        ),
        titleMedium = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Medium,
            fontSize = 16.sp,
            lineHeight = 24.sp,
            letterSpacing = 0.15.sp
        ),
        titleSmall = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            letterSpacing = 0.1.sp
        ),
        bodyLarge = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Normal,
            fontSize = 16.sp,
            lineHeight = 24.sp,
            letterSpacing = 0.5.sp
        ),
        bodyMedium = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Normal,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            letterSpacing = 0.25.sp
        ),
        bodySmall = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Normal,
            fontSize = 12.sp,
            lineHeight = 16.sp,
            letterSpacing = 0.4.sp
        ),
        labelLarge = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            letterSpacing = 0.1.sp
        ),
        labelMedium = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Medium,
            fontSize = 12.sp,
            lineHeight = 16.sp,
            letterSpacing = 0.5.sp
        ),
        labelSmall = TextStyle(
            fontFamily = appFontFamily,
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            lineHeight = 16.sp,
            letterSpacing = 0.5.sp
        )
    )
}

internal expect fun platformTypographyFontFamily(appFontFamily: FontFamily): FontFamily
