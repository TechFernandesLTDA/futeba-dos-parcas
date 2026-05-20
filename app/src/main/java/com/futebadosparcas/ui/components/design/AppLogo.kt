package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Tamanhos padronizados da logo do Futeba dos Parças.
 *
 * - [Small] (32dp): top bars, list items
 * - [Medium] (64dp): cards de destaque, headers compactos
 * - [Large] (120dp): tela About, dialogs de boas-vindas
 * - [XLarge] (180dp): splash, onboarding hero
 */
enum class AppLogoSize(val dp: Dp) {
    Small(32.dp),
    Medium(64.dp),
    Large(120.dp),
    XLarge(180.dp)
}

/**
 * Formato visual da logo.
 *
 * - [Circle]: ideal para avatares/top bars
 * - [Rounded]: cards e splash (cantos 16dp)
 * - [Square]: hosting/sem clip
 */
enum class AppLogoShape {
    Circle,
    Rounded,
    Square
}

/**
 * Componente único e padronizado para renderizar a logo do app.
 *
 * Usa `ic_app_logo_full.png` (asset canônico — bola em campo verde) em vez de
 * `ic_launcher_foreground` (que é apenas o adaptive icon e tem safe-zone que
 * cropa o conteúdo visível). Centraliza tamanho, shape e contentDescription.
 *
 * Exemplo:
 * ```
 * AppLogo(size = AppLogoSize.Large, shape = AppLogoShape.Rounded)
 * ```
 */
@Composable
fun AppLogo(
    modifier: Modifier = Modifier,
    size: AppLogoSize = AppLogoSize.Medium,
    shape: AppLogoShape = AppLogoShape.Circle,
    contentDescription: String? = stringResource(R.string.app_name)
) {
    val shapeModifier = when (shape) {
        AppLogoShape.Circle -> Modifier.clip(CircleShape)
        AppLogoShape.Rounded -> Modifier.clip(RoundedCornerShape(16.dp))
        AppLogoShape.Square -> Modifier
    }

    Image(
        painter = painterResource(id = R.drawable.ic_app_logo_full),
        contentDescription = contentDescription,
        modifier = modifier
            .size(size.dp)
            .then(shapeModifier)
    )
}
