package com.futebadosparcas.ui.settings

import com.futebadosparcas.domain.model.ThemeMode
import platform.UIKit.UIApplication
import platform.UIKit.UIUserInterfaceStyle
import platform.UIKit.UIUserInterfaceStyleDark
import platform.UIKit.UIUserInterfaceStyleLight
import platform.UIKit.UIUserInterfaceStyleUnspecified
import platform.UIKit.UIWindow

/**
 * iOS: força (ou libera) o `UIUserInterfaceStyle` das janelas do app (#4097).
 *
 * Com o override aplicado, o trait collection da hierarquia passa a refletir a
 * escolha do usuário; assim a status bar (`UIStatusBarStyleDefault`) e qualquer
 * chrome nativo (alerts, share sheet) acompanham o mesmo modo do Compose.
 * `Unspecified` devolve o controle ao sistema (`UIUserInterfaceStyle = Automatic`
 * do `Info.plist`), preservando o comportamento do #4095 quando o modo é SYSTEM.
 */
internal actual fun applyPlatformThemeMode(mode: ThemeMode) {
    val style: UIUserInterfaceStyle = when (mode) {
        ThemeMode.LIGHT -> UIUserInterfaceStyleLight
        ThemeMode.DARK -> UIUserInterfaceStyleDark
        ThemeMode.SYSTEM -> UIUserInterfaceStyleUnspecified
    }
    UIApplication.sharedApplication.windows
        .mapNotNull { it as? UIWindow }
        .forEach { window -> window.overrideUserInterfaceStyle = style }
}
