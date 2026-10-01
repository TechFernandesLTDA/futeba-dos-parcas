package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.poppins_bold
import com.futebadosparcas.compose.resources.poppins_light
import com.futebadosparcas.compose.resources.poppins_medium
import com.futebadosparcas.compose.resources.poppins_regular
import com.futebadosparcas.compose.resources.poppins_semibold
import org.jetbrains.compose.resources.Font

/**
 * #2675/#4109 — Família de fonte Poppins carregada via composeResources.
 *
 * Vive no source set intermediário `nonIosMain` (Android + wasmJs), e os `.ttf` ficam em
 * `composeApp/src/nonIosMain/composeResources/font/`. Como os recursos do Compose são
 * empacotados por source set, o iOS NÃO recebe os ~788 KB de Poppins nem gera os
 * acessores `Res.font.poppins_*` — o iOS usa a fonte de sistema (SF, HIG), ver
 * `Typography.ios.kt`.
 *
 * Os pesos são os MESMOS usados no Android (`app/src/main/res/font/poppins_*.ttf`),
 * garantindo paridade visual entre Android e web.
 *
 * O carregamento de fonte via `org.jetbrains.compose.resources.Font(...)` é @Composable
 * no Compose Multiplatform (resolve o asset de forma assíncrona), por isso a família
 * precisa ser construída dentro de um contexto @Composable.
 */
@Composable
internal fun rememberPoppinsFontFamily(): FontFamily = FontFamily(
    Font(Res.font.poppins_light, FontWeight.Light),
    Font(Res.font.poppins_regular, FontWeight.Normal),
    Font(Res.font.poppins_medium, FontWeight.Medium),
    Font(Res.font.poppins_semibold, FontWeight.SemiBold),
    Font(Res.font.poppins_bold, FontWeight.Bold)
)
