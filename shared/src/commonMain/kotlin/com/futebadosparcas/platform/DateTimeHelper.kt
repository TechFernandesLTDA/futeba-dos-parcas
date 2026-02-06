package com.futebadosparcas.platform

/**
 * Helper multiplataforma para operacoes de data/hora que requerem
 * formatacao baseada em patterns (platform-specific).
 *
 * Para operacoes basicas de data/hora que NAO precisam de patterns,
 * use [com.futebadosparcas.domain.util.DateTimeUtils] (pure Kotlin, kotlinx-datetime).
 *
 * Implementacoes:
 * - Android: java.text.SimpleDateFormat / java.time.format.DateTimeFormatter
 * - iOS: NSDateFormatter
 *
 * Patterns suportados (baseados em Unicode TR35):
 * - "dd/MM/yyyy" -> "06/02/2026"
 * - "HH:mm" -> "19:30"
 * - "dd/MM/yyyy HH:mm" -> "06/02/2026 19:30"
 * - "EEEE, dd 'de' MMMM" -> "sexta-feira, 06 de fevereiro"
 * - "MMM yyyy" -> "fev 2026"
 */
expect object DateTimeHelper {
    /**
     * Retorna o timestamp atual em milissegundos (epoch).
     */
    fun now(): Long

    /**
     * Formata um timestamp (milissegundos desde epoch) usando um pattern.
     *
     * @param timestamp Milissegundos desde epoch (UTC)
     * @param pattern Pattern de formatacao (ex: "dd/MM/yyyy HH:mm")
     * @return String formatada no fuso horario local do dispositivo
     */
    fun formatDate(timestamp: Long, pattern: String): String
}
