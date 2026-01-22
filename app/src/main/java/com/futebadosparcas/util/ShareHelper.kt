package com.futebadosparcas.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Share Helper
 *
 * Provides utilities for sharing content (text, images, files) with other apps.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var shareHelper: ShareHelper
 *
 * // Share text
 * shareHelper.shareText("Confira meu ranking!", "Compartilhar")
 *
 * // Share game invitation
 * shareHelper.shareGameInvite(
 *     gameName = "Pelada do Sábado",
 *     date = "15/06 às 15h",
 *     location = "Arena do Bairro"
 * )
 *
 * // Share image
 * shareHelper.shareImage(imageFile, "Compartilhar foto")
 * ```
 */
@Singleton
class ShareHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    /**
     * Share plain text
     */
    fun shareText(text: String, title: String = "Compartilhar") {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }

        val chooser = Intent.createChooser(intent, title)
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    /**
     * Share text with subject (useful for email)
     */
    fun shareTextWithSubject(text: String, subject: String, title: String = "Compartilhar") {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, text)
        }

        val chooser = Intent.createChooser(intent, title)
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    /**
     * Share image file
     */
    fun shareImage(imageFile: File, title: String = "Compartilhar imagem") {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            imageFile
        )

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val chooser = Intent.createChooser(intent, title)
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    /**
     * Share multiple images
     */
    fun shareImages(imageFiles: List<File>, title: String = "Compartilhar imagens") {
        val uris = imageFiles.map { file ->
            FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
        }

        val intent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = "image/*"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val chooser = Intent.createChooser(intent, title)
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    /**
     * Share file
     */
    fun shareFile(file: File, mimeType: String = "*/*", title: String = "Compartilhar arquivo") {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val chooser = Intent.createChooser(intent, title)
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    /**
     * Share game invitation
     */
    fun shareGameInvite(gameName: String, date: String, location: String) {
        val message = buildString {
            appendLine("🏆 Convite para jogar!")
            appendLine()
            appendLine("Jogo: $gameName")
            appendLine("Data: $date")
            appendLine("Local: $location")
            appendLine()
            appendLine("Vamos jogar? ⚽")
        }

        shareText(message, "Convidar para jogo")
    }

    /**
     * Share ranking position
     */
    fun shareRankingPosition(
        position: Int,
        totalPlayers: Int,
        xp: Int,
        division: String
    ) {
        val message = buildString {
            appendLine("🏅 Meu ranking no Futeba dos Parças!")
            appendLine()
            appendLine("Posição: $position° de $totalPlayers jogadores")
            appendLine("XP: $xp pontos")
            appendLine("Divisão: $division")
            appendLine()
            appendLine("Baixe o app e venha jogar! ⚽")
        }

        shareText(message, "Compartilhar ranking")
    }

    /**
     * Share player statistics
     */
    fun sharePlayerStats(
        playerName: String,
        games: Int,
        wins: Int,
        goals: Int,
        assists: Int
    ) {
        val winRate = if (games > 0) (wins * 100 / games) else 0

        val message = buildString {
            appendLine("📊 Estatísticas de $playerName")
            appendLine()
            appendLine("Jogos: $games")
            appendLine("Vitórias: $wins ($winRate%)")
            appendLine("Gols: $goals")
            appendLine("Assistências: $assists")
            appendLine()
            appendLine("Futeba dos Parças ⚽")
        }

        shareText(message, "Compartilhar estatísticas")
    }

    /**
     * Share badge achievement
     */
    fun shareBadgeUnlocked(badgeName: String, badgeDescription: String) {
        val message = buildString {
            appendLine("🎖️ Badge desbloqueada!")
            appendLine()
            appendLine("$badgeName")
            appendLine()
            appendLine(badgeDescription)
            appendLine()
            appendLine("Futeba dos Parças ⚽")
        }

        shareText(message, "Compartilhar conquista")
    }

    /**
     * Share app download link
     */
    fun shareAppLink() {
        val message = buildString {
            appendLine("⚽ Futeba dos Parças")
            appendLine()
            appendLine("O melhor app para organizar suas peladas!")
            appendLine()
            appendLine("Baixe agora:")
            appendLine("https://play.google.com/store/apps/details?id=${context.packageName}")
        }

        shareText(message, "Compartilhar app")
    }

    /**
     * Share via specific app
     */
    fun shareViaApp(text: String, packageName: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            setPackage(packageName)
        }

        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            // App not installed, fallback to regular share
            shareText(text)
        }
    }

    /**
     * Share via WhatsApp
     */
    fun shareViaWhatsApp(text: String) {
        shareViaApp(text, "com.whatsapp")
    }

    /**
     * Share via Telegram
     */
    fun shareViaTelegram(text: String) {
        shareViaApp(text, "org.telegram.messenger")
    }

    /**
     * Share via Instagram
     */
    fun shareViaInstagram(imageFile: File) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            imageFile
        )

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_STREAM, uri)
            setPackage("com.instagram.android")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            // Instagram not installed
            android.util.Log.e("ShareHelper", "Instagram not installed", e)
        }
    }

    /**
     * Share via email
     */
    fun shareViaEmail(
        to: Array<String>,
        subject: String,
        body: String
    ) {
        val intent = Intent(Intent.ACTION_SENDTO).apply {
            data = Uri.parse("mailto:")
            putExtra(Intent.EXTRA_EMAIL, to)
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, body)
        }

        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.e("ShareHelper", "No email app installed", e)
        }
    }

    companion object {
        /**
         * Common app package names
         */
        const val PACKAGE_WHATSAPP = "com.whatsapp"
        const val PACKAGE_TELEGRAM = "org.telegram.messenger"
        const val PACKAGE_INSTAGRAM = "com.instagram.android"
        const val PACKAGE_FACEBOOK = "com.facebook.katana"
        const val PACKAGE_TWITTER = "com.twitter.android"
    }
}
