package com.futebadosparcas.ui.theme

import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * Implementação Android de readSystemReduceMotion (#2735).
 *
 * Lê Settings.Global.ANIMATOR_DURATION_SCALE: valor 0 indica que o usuário
 * desabilitou animações nas Opções do Desenvolvedor (ou via acessibilidade).
 * Retorna false em caso de exceção (permissão negada) como fallback seguro.
 */
@Composable
internal actual fun readSystemReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        try {
            Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE
            ) == 0f
        } catch (e: Exception) {
            false
        }
    }
}
