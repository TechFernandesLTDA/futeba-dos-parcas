package com.futebadosparcas.util

import android.util.Log
import com.futebadosparcas.BuildConfig

/**
 * Wrapper de logging que só executa em builds de debug.
 * Evita custo de formatação de strings e I/O em produção.
 */
object AppLogger {

    /**
     * Log de debug - apenas em builds DEBUG
     */
    inline fun d(tag: String, message: () -> String) {
        if (BuildConfig.DEBUG) {
            Log.d(tag, message())
        }
    }

    /**
     * Log de info - apenas em builds DEBUG
     */
    inline fun i(tag: String, message: () -> String) {
        if (BuildConfig.DEBUG) {
            Log.i(tag, message())
        }
    }

    /**
     * Log de warning - apenas em builds DEBUG
     */
    inline fun w(tag: String, message: () -> String) {
        if (BuildConfig.DEBUG) {
            Log.w(tag, message())
        }
    }

    /**
     * Log de erro - SEMPRE executa (erros são importantes para diagnóstico)
     * Em produção, considerar enviar para Crashlytics
     */
    fun e(tag: String, message: String, throwable: Throwable? = null) {
        Log.e(tag, message, throwable)
        // TODO: Adicionar Firebase Crashlytics.log() aqui se desejado
    }

    /**
     * Log de tempo de execução - apenas em builds DEBUG
     */
    inline fun timing(tag: String, operation: String, block: () -> Unit) {
        if (BuildConfig.DEBUG) {
            val startTime = System.currentTimeMillis()
            block()
            val elapsed = System.currentTimeMillis() - startTime
            Log.d(tag, "$operation completed in ${elapsed}ms")
        } else {
            block()
        }
    }
}
