package com.futebadosparcas.util

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.widget.Toast

/**
 * Clipboard Helper
 *
 * Provides utilities for copying and pasting content from the clipboard.
 *
 * Usage:
 * ```kotlin
 * lateinit var clipboardHelper: ClipboardHelper
 *
 * // Copy text to clipboard
 * clipboardHelper.copyText("Game ID: ABC123")
 *
 * // Copy with toast notification
 * clipboardHelper.copyTextWithToast("Game ID: ABC123", "Copiado!")
 *
 * // Get text from clipboard
 * val text = clipboardHelper.getText()
 *
 * // Check if clipboard has text
 * if (clipboardHelper.hasText()) {
 *     // Paste action
 * }
 * ```
 */
class ClipboardHelper constructor(
    private val context: Context
) {

    private val clipboardManager: ClipboardManager =
        context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

    /**
     * Copy plain text to clipboard
     */
    fun copyText(text: String, label: String = "Text") {
        val clip = ClipData.newPlainText(label, text)
        clipboardManager.setPrimaryClip(clip)
    }

    /**
     * Copy text with toast notification
     */
    fun copyTextWithToast(text: String, toastMessage: String = "Copiado para área de transferência") {
        copyText(text)
        Toast.makeText(context, toastMessage, Toast.LENGTH_SHORT).show()
    }

    /**
     * Copy URI to clipboard
     */
    fun copyUri(uri: Uri, label: String = "URI") {
        val clip = ClipData.newUri(context.contentResolver, label, uri)
        clipboardManager.setPrimaryClip(clip)
    }

    /**
     * Copy intent to clipboard
     */
    fun copyIntent(intent: android.content.Intent, label: String = "Intent") {
        val clip = ClipData.newIntent(label, intent)
        clipboardManager.setPrimaryClip(clip)
    }

    /**
     * Get text from clipboard
     */
    fun getText(): String? {
        if (!clipboardManager.hasPrimaryClip()) {
            return null
        }

        val clipData = clipboardManager.primaryClip ?: return null

        if (clipData.itemCount == 0) {
            return null
        }

        val item = clipData.getItemAt(0)
        return item.text?.toString()
    }

    /**
     * Get URI from clipboard
     */
    fun getUri(): Uri? {
        if (!clipboardManager.hasPrimaryClip()) {
            return null
        }

        val clipData = clipboardManager.primaryClip ?: return null

        if (clipData.itemCount == 0) {
            return null
        }

        val item = clipData.getItemAt(0)
        return item.uri
    }

    /**
     * Check if clipboard has any content
     */
    fun hasContent(): Boolean {
        return clipboardManager.hasPrimaryClip()
    }

    /**
     * Check if clipboard has text
     */
    fun hasText(): Boolean {
        if (!hasContent()) return false

        val clipData = clipboardManager.primaryClip ?: return false
        val description = clipData.description

        return description.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN) ||
                description.hasMimeType(ClipDescription.MIMETYPE_TEXT_HTML)
    }

    /**
     * Check if clipboard has URI
     */
    fun hasUri(): Boolean {
        if (!hasContent()) return false

        val clipData = clipboardManager.primaryClip ?: return false
        val description = clipData.description

        return description.hasMimeType(ClipDescription.MIMETYPE_TEXT_URILIST)
    }

    /**
     * Clear clipboard
     */
    fun clear() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            clipboardManager.clearPrimaryClip()
        } else {
            val clip = ClipData.newPlainText("", "")
            clipboardManager.setPrimaryClip(clip)
        }
    }

    /**
     * Add clipboard changed listener
     */
    fun addPrimaryClipChangedListener(listener: ClipboardManager.OnPrimaryClipChangedListener) {
        clipboardManager.addPrimaryClipChangedListener(listener)
    }

    /**
     * Remove clipboard changed listener
     */
    fun removePrimaryClipChangedListener(listener: ClipboardManager.OnPrimaryClipChangedListener) {
        clipboardManager.removePrimaryClipChangedListener(listener)
    }

    /**
     * Get clipboard description
     */
    fun getClipDescription(): ClipDescription? {
        return clipboardManager.primaryClipDescription
    }

    /**
     * Copy game ID with formatted message
     */
    fun copyGameId(gameId: String) {
        copyTextWithToast(gameId, "ID do jogo copiado")
    }

    /**
     * Copy group code
     */
    fun copyGroupCode(groupCode: String) {
        copyTextWithToast(groupCode, "Código do grupo copiado")
    }

    /**
     * Copy player statistics as formatted text
     */
    fun copyPlayerStats(
        playerName: String,
        games: Int,
        wins: Int,
        goals: Int,
        assists: Int
    ) {
        val stats = buildString {
            appendLine("📊 Estatísticas de $playerName")
            appendLine("Jogos: $games")
            appendLine("Vitórias: $wins")
            appendLine("Gols: $goals")
            appendLine("Assistências: $assists")
        }

        copyTextWithToast(stats, "Estatísticas copiadas")
    }

    /**
     * Copy ranking position
     */
    fun copyRankingPosition(position: Int, totalPlayers: Int, xp: Int) {
        val text = "Posição: $position° de $totalPlayers | XP: $xp"
        copyTextWithToast(text, "Ranking copiado")
    }

    /**
     * Copy game details
     */
    fun copyGameDetails(
        gameName: String,
        date: String,
        location: String,
        playerCount: Int
    ) {
        val details = buildString {
            appendLine("⚽ $gameName")
            appendLine("📅 $date")
            appendLine("📍 $location")
            appendLine("👥 $playerCount jogadores")
        }

        copyTextWithToast(details, "Detalhes do jogo copiados")
    }
}
