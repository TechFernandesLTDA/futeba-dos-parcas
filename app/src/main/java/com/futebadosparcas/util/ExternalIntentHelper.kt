package com.futebadosparcas.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast
import androidx.annotation.StringRes
import com.futebadosparcas.R

/**
 * Abre Intents externos (e-mail, navegador, Play Store) sem derrubar o app (#4376).
 *
 * Se nenhum app resolve o Intent, `startActivity` lanca [ActivityNotFoundException];
 * aqui a excecao e capturada e o usuario recebe um aviso (Toast).
 */
object ExternalIntentHelper {

    private const val TAG = "ExternalIntentHelper"

    /**
     * @return true se a Activity foi iniciada; false se nao havia app para tratar o Intent.
     */
    fun startActivitySafely(
        context: Context,
        intent: Intent,
        @StringRes errorMessageRes: Int = R.string.error_no_app_to_handle_action
    ): Boolean {
        return try {
            context.startActivity(intent)
            true
        } catch (e: ActivityNotFoundException) {
            Log.w(TAG, "Nenhum app para tratar o Intent: ${e.message}")
            Toast.makeText(context, errorMessageRes, Toast.LENGTH_SHORT).show()
            false
        } catch (e: SecurityException) {
            Log.w(TAG, "Intent externo nao permitido: ${e.message}")
            Toast.makeText(context, errorMessageRes, Toast.LENGTH_SHORT).show()
            false
        }
    }
}
