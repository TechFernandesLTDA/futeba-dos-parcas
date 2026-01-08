package com.futebadosparcas.platform.logging

/**
 * Logger multiplataforma para debug e monitoramento.
 *
 * Implementações:
 * - Android: android.util.Log
 * - iOS: NSLog / print
 *
 * Níveis de log:
 * - DEBUG (d): Informações de debug, removido em production
 * - INFO (i): Informações gerais sobre fluxo da aplicação
 * - WARNING (w): Avisos de problemas não-críticos
 * - ERROR (e): Erros que precisam atenção
 */
expect object PlatformLogger {
    fun d(tag: String, message: String)
    fun i(tag: String, message: String)
    fun w(tag: String, message: String)
    fun e(tag: String, message: String, throwable: Throwable? = null)
}
