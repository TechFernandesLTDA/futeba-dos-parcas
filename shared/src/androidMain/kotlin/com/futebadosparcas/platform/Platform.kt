package com.futebadosparcas.platform

import android.os.Build

/**
 * Implementacao Android da classe Platform.
 *
 * Usa android.os.Build para identificar a versao do Android.
 */
actual class Platform actual constructor() {
    actual val name: String = "Android ${Build.VERSION.SDK_INT}"
    actual val isAndroid: Boolean = true
    actual val isIOS: Boolean = false
}
