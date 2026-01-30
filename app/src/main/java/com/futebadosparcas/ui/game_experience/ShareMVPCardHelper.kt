package com.futebadosparcas.ui.game_experience

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.widget.Toast
import androidx.core.content.FileProvider
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.futebadosparcas.data.model.MVPVoteResult
import com.futebadosparcas.data.model.VoteCategory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Utilitário para gerar e compartilhar cards de resultado MVP.
 * Renderiza usando Canvas nativo do Android para compatibilidade.
 * Suporta temas claro/escuro.
 */
object ShareMVPCardHelper {

    private const val CARD_WIDTH = 600
    private const val CARD_HEIGHT = 800
    private const val CARD_PADDING = 32f
    private const val CORNER_RADIUS = 24f

    private const val PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.futebadosparcas"

    // Cores do tema escuro
    private val DARK_BG = AndroidColor.parseColor("#1A1A2E")
    private val DARK_SURFACE = AndroidColor.parseColor("#2D2D44")
    private val DARK_TEXT_PRIMARY = AndroidColor.parseColor("#FFFFFF")
    private val DARK_TEXT_SECONDARY = AndroidColor.parseColor("#8888AA")

    // Cores do tema claro
    private val LIGHT_BG = AndroidColor.parseColor("#FFFFFF")
    private val LIGHT_SURFACE = AndroidColor.parseColor("#F5F5F5")
    private val LIGHT_TEXT_PRIMARY = AndroidColor.parseColor("#1A1A2E")
    private val LIGHT_TEXT_SECONDARY = AndroidColor.parseColor("#666688")

    // Cores fixas (usadas em ambos temas)
    private val GOLD_COLOR = AndroidColor.parseColor("#FFD700")
    private val SILVER_COLOR = AndroidColor.parseColor("#E0E0E0")
    private val BRONZE_COLOR = AndroidColor.parseColor("#CD7F32")
    private val GREEN_COLOR = AndroidColor.parseColor("#58CC02")
    private val MVP_COLOR = AndroidColor.parseColor("#FFD700")
    private val GK_COLOR = AndroidColor.parseColor("#4CAF50")
    private val WORST_COLOR = AndroidColor.parseColor("#FF5722")

    /**
     * Gera e compartilha o card de resultado da votação.
     */
    fun shareResultCard(
        context: Context,
        category: VoteCategory,
        results: List<MVPVoteResult>,
        gameInfo: GameResultInfo?
    ) {
        if (results.isEmpty()) return

        CoroutineScope(Dispatchers.Main).launch {
            try {
                // Carregar fotos dos jogadores
                val photoBitmaps = mutableMapOf<String, Bitmap?>()
                results.take(3).forEach { result ->
                    photoBitmaps[result.playerId] = loadPlayerPhoto(context, result.playerPhoto)
                }

                // Detectar tema
                val isDarkMode = (context.resources.configuration.uiMode and
                        Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

                // Criar bitmap
                val bitmap = createResultCardBitmap(
                    context, category, results, gameInfo, isDarkMode, photoBitmaps
                )

                // Salvar em arquivo
                val cachePath = File(context.cacheDir, "images")
                cachePath.mkdirs()
                val file = File(cachePath, "mvp_result_${category.name}_${System.currentTimeMillis()}.png")

                withContext(Dispatchers.IO) {
                    FileOutputStream(file).use { out ->
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                    }
                }

                // Obter URI via FileProvider
                val contentUri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )

                // Texto de compartilhamento
                val winner = results.first()
                val categoryName = getCategoryDisplayName(category)
                val shareText = buildString {
                    append("🏆 ")
                    append(winner.playerName)
                    append(" foi eleito ")
                    append(categoryName)
                    append("!\n")
                    append("📊 ${winner.voteCount} votos (${winner.percentage.toInt()}%)\n\n")
                    if (gameInfo != null) {
                        append("⚽ ${gameInfo.team1Name} ${gameInfo.team1Score} x ${gameInfo.team2Score} ${gameInfo.team2Name}\n")
                        append("📍 ${gameInfo.location}\n\n")
                    }
                    append("Baixe o Futeba dos Parças!\n")
                    append(PLAY_STORE_URL)
                }

                // Criar intent de compartilhamento
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, contentUri)
                    putExtra(Intent.EXTRA_TEXT, shareText)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                // Tentar Instagram primeiro, senão abre seletor
                try {
                    shareIntent.setPackage("com.instagram.android")
                    context.startActivity(shareIntent)
                } catch (e: Exception) {
                    shareIntent.setPackage(null)
                    context.startActivity(Intent.createChooser(shareIntent, "Compartilhar resultado via"))
                }

                // Limpar recursos
                bitmap.recycle()
                photoBitmaps.values.forEach { it?.recycle() }

            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(
                    context,
                    "Erro ao compartilhar: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    /**
     * Carrega a foto do jogador usando Coil.
     */
    private suspend fun loadPlayerPhoto(context: Context, photoUrl: String?): Bitmap? {
        if (photoUrl.isNullOrBlank()) return null

        return withContext(Dispatchers.IO) {
            try {
                val request = ImageRequest.Builder(context)
                    .data(photoUrl)
                    .size(150, 150)
                    .allowHardware(false)
                    .build()

                val result = context.imageLoader.execute(request)
                if (result is SuccessResult) {
                    (result.drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap
                } else null
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Cria o bitmap do card de resultado usando Canvas nativo.
     */
    private fun createResultCardBitmap(
        context: Context,
        category: VoteCategory,
        results: List<MVPVoteResult>,
        gameInfo: GameResultInfo?,
        isDarkMode: Boolean,
        photoBitmaps: Map<String, Bitmap?>
    ): Bitmap {
        val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR"))

        // Cores baseadas no tema
        val bgColor = if (isDarkMode) DARK_BG else LIGHT_BG
        val surfaceColor = if (isDarkMode) DARK_SURFACE else LIGHT_SURFACE
        val textPrimary = if (isDarkMode) DARK_TEXT_PRIMARY else LIGHT_TEXT_PRIMARY
        val textSecondary = if (isDarkMode) DARK_TEXT_SECONDARY else LIGHT_TEXT_SECONDARY

        val categoryColor = when (category) {
            VoteCategory.MVP -> MVP_COLOR
            VoteCategory.BEST_GOALKEEPER -> GK_COLOR
            VoteCategory.WORST -> WORST_COLOR
            VoteCategory.CUSTOM -> GREEN_COLOR
        }

        val bitmap = Bitmap.createBitmap(CARD_WIDTH, CARD_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val paint = Paint().apply {
            isAntiAlias = true
        }

        // Fundo com cantos arredondados
        paint.color = bgColor
        val bgRect = RectF(0f, 0f, CARD_WIDTH.toFloat(), CARD_HEIGHT.toFloat())
        canvas.drawRoundRect(bgRect, CORNER_RADIUS, CORNER_RADIUS, paint)

        var yPos = CARD_PADDING + 20f

        // Header "FUTEBA DOS PARÇAS"
        paint.apply {
            color = GOLD_COLOR
            textSize = 24f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = 0.15f
        }
        canvas.drawText("⚽ FUTEBA DOS PARÇAS", CARD_WIDTH / 2f, yPos, paint)
        yPos += 50f

        // Categoria
        val categoryEmoji = when (category) {
            VoteCategory.MVP -> "🏆"
            VoteCategory.BEST_GOALKEEPER -> "🧤"
            VoteCategory.WORST -> "😅"
            VoteCategory.CUSTOM -> "⭐"
        }
        val categoryName = getCategoryDisplayName(category)

        paint.apply {
            color = categoryColor
            textSize = 28f
        }
        canvas.drawText("$categoryEmoji $categoryName", CARD_WIDTH / 2f, yPos, paint)
        yPos += 60f

        // Pódio
        val top3 = results.take(3)

        // Desenhar o vencedor (maior)
        val winner = top3.getOrNull(0)
        if (winner != null) {
            val winnerPhoto = photoBitmaps[winner.playerId]
            drawPodiumPlayer(
                canvas, paint,
                winner, winnerPhoto,
                CARD_WIDTH / 2f, yPos,
                80f, GOLD_COLOR, textPrimary, textSecondary,
                "1º", true
            )
            yPos += 180f

            // Segundo e terceiro lugar lado a lado
            val second = top3.getOrNull(1)
            val third = top3.getOrNull(2)

            if (second != null || third != null) {
                // Segundo lugar (esquerda)
                if (second != null) {
                    val secondPhoto = photoBitmaps[second.playerId]
                    drawPodiumPlayer(
                        canvas, paint,
                        second, secondPhoto,
                        CARD_WIDTH / 4f, yPos,
                        50f, SILVER_COLOR, textPrimary, textSecondary,
                        "2º", false
                    )
                }

                // Terceiro lugar (direita)
                if (third != null) {
                    val thirdPhoto = photoBitmaps[third.playerId]
                    drawPodiumPlayer(
                        canvas, paint,
                        third, thirdPhoto,
                        CARD_WIDTH * 3f / 4f, yPos,
                        50f, BRONZE_COLOR, textPrimary, textSecondary,
                        "3º", false
                    )
                }
                yPos += 140f
            }
        }

        // Info do jogo (se disponível)
        if (gameInfo != null) {
            yPos += 20f
            paint.apply {
                color = textSecondary
                textSize = 18f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            }
            canvas.drawText(
                "${gameInfo.team1Name} ${gameInfo.team1Score} x ${gameInfo.team2Score} ${gameInfo.team2Name}",
                CARD_WIDTH / 2f, yPos, paint
            )
            yPos += 24f
            paint.textSize = 14f
            canvas.drawText(gameInfo.location, CARD_WIDTH / 2f, yPos, paint)
            yPos += 20f
            canvas.drawText(gameInfo.date, CARD_WIDTH / 2f, yPos, paint)
        }

        // Footer
        yPos = CARD_HEIGHT - 60f
        paint.apply {
            color = GOLD_COLOR
            textSize = 16f
        }
        canvas.drawText("📲 Baixe o Futeba dos Parças!", CARD_WIDTH / 2f, yPos, paint)
        yPos += 22f
        paint.apply {
            color = GREEN_COLOR
            textSize = 12f
        }
        canvas.drawText(PLAY_STORE_URL, CARD_WIDTH / 2f, yPos, paint)

        return bitmap
    }

    /**
     * Desenha um jogador no pódio.
     */
    private fun drawPodiumPlayer(
        canvas: Canvas,
        paint: Paint,
        result: MVPVoteResult,
        photo: Bitmap?,
        centerX: Float,
        yPos: Float,
        photoRadius: Float,
        positionColor: Int,
        textPrimary: Int,
        textSecondary: Int,
        positionLabel: String,
        isWinner: Boolean
    ) {
        val photoCenterY = yPos + photoRadius

        // Foto circular
        if (photo != null) {
            drawCircularBitmap(canvas, photo, centerX, photoCenterY, photoRadius)
        } else {
            // Fallback: círculo com iniciais
            paint.color = positionColor
            canvas.drawCircle(centerX, photoCenterY, photoRadius, paint)

            paint.apply {
                color = AndroidColor.BLACK
                textSize = photoRadius * 0.6f
                textAlign = Paint.Align.CENTER
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
            val initials = result.playerName.split(" ")
                .take(2)
                .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                .joinToString("")
            canvas.drawText(initials, centerX, photoCenterY + photoRadius * 0.2f, paint)
        }

        // Badge de posição
        val badgeRadius = photoRadius * 0.35f
        val badgeX = centerX + photoRadius - badgeRadius * 0.5f
        val badgeY = photoCenterY + photoRadius - badgeRadius * 0.5f
        paint.color = positionColor
        canvas.drawCircle(badgeX, badgeY, badgeRadius, paint)

        paint.apply {
            color = AndroidColor.BLACK
            textSize = badgeRadius * 1.2f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(positionLabel, badgeX, badgeY + badgeRadius * 0.4f, paint)

        // Nome
        var nameY = photoCenterY + photoRadius + 28f
        paint.apply {
            color = textPrimary
            textSize = if (isWinner) 24f else 18f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val displayName = if (isWinner) {
            result.playerName
        } else {
            result.playerName.split(" ").firstOrNull() ?: result.playerName
        }
        canvas.drawText(displayName, centerX, nameY, paint)

        // Votos e porcentagem
        nameY += if (isWinner) 28f else 22f
        paint.apply {
            color = textSecondary
            textSize = if (isWinner) 18f else 14f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        canvas.drawText("${result.voteCount} votos (${result.percentage.toInt()}%)", centerX, nameY, paint)
    }

    /**
     * Desenha uma imagem circular no canvas.
     */
    private fun drawCircularBitmap(canvas: Canvas, bitmap: Bitmap, centerX: Float, centerY: Float, radius: Float) {
        val scaledBitmap = Bitmap.createScaledBitmap(bitmap, (radius * 2).toInt(), (radius * 2).toInt(), true)

        val paint = Paint().apply {
            isAntiAlias = true
            shader = BitmapShader(scaledBitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        }

        val matrix = android.graphics.Matrix()
        matrix.setTranslate(centerX - radius, centerY - radius)
        paint.shader.setLocalMatrix(matrix)

        canvas.drawCircle(centerX, centerY, radius, paint)
    }

    /**
     * Retorna o nome de exibição da categoria.
     */
    private fun getCategoryDisplayName(category: VoteCategory): String {
        return when (category) {
            VoteCategory.MVP -> "Craque da Partida"
            VoteCategory.BEST_GOALKEEPER -> "Melhor Goleiro"
            VoteCategory.WORST -> "Bola Murcha"
            VoteCategory.CUSTOM -> "Categoria Especial"
        }
    }
}
