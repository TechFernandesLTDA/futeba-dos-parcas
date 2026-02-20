package com.futebadosparcas.ui.components

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.widget.Toast
import androidx.core.content.FileProvider
import coil3.imageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import com.futebadosparcas.domain.model.LevelTable
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.PlayerRatingRole
import com.futebadosparcas.domain.model.User
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
 * Utilitário para compartilhar o PlayerCard como imagem PNG
 * Usa Canvas nativo do Android para garantir renderização correta
 * Suporta tema claro/escuro do sistema
 */
object PlayerCardShareHelper {

    private const val CARD_WIDTH = 600
    private const val CARD_PADDING = 32f
    private const val CORNER_RADIUS = 32f

    private const val PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.futebadosparcas"

    // Cores do tema escuro
    private val DARK_BG = AndroidColor.parseColor("#1A1A2E")
    private val DARK_SURFACE = AndroidColor.parseColor("#2D2D44")
    private val DARK_DIVIDER = AndroidColor.parseColor("#3D3D5C")
    private val DARK_TEXT_PRIMARY = AndroidColor.parseColor("#FFFFFF")
    private val DARK_TEXT_SECONDARY = AndroidColor.parseColor("#8888AA")

    // Cores do tema claro
    private val LIGHT_BG = AndroidColor.parseColor("#FFFFFF")
    private val LIGHT_SURFACE = AndroidColor.parseColor("#F5F5F5")
    private val LIGHT_DIVIDER = AndroidColor.parseColor("#E0E0E0")
    private val LIGHT_TEXT_PRIMARY = AndroidColor.parseColor("#1A1A2E")
    private val LIGHT_TEXT_SECONDARY = AndroidColor.parseColor("#666688")

    // Cores fixas (usadas em ambos temas)
    private val GOLD_COLOR = AndroidColor.parseColor("#FFD700")
    private val GREEN_COLOR = AndroidColor.parseColor("#58CC02")
    private val ATTACK_COLOR = AndroidColor.parseColor("#FF6B6B")
    private val MID_COLOR = AndroidColor.parseColor("#4ECDC4")
    private val DEFENSE_COLOR = AndroidColor.parseColor("#45B7D1")
    private val GOALKEEPER_COLOR = AndroidColor.parseColor("#FFBE0B")

    /**
     * Compartilha o card do jogador como imagem PNG via WhatsApp ou outro app
     */
    fun shareAsImage(
        context: Context,
        user: User,
        stats: UserStatistics?,
        generatedBy: String = "Futeba dos Parças"
    ) {
        // Executar em coroutine para carregar foto
        CoroutineScope(Dispatchers.Main).launch {
            try {
                // Carregar foto do jogador
                val photoBitmap = loadUserPhoto(context, user.photoUrl)

                // Detectar tema
                val isDarkMode = (context.resources.configuration.uiMode and
                        Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

                // Criar bitmap usando Canvas nativo
                val bitmap = createPlayerCardBitmap(context, user, stats, generatedBy, isDarkMode, photoBitmap)

                // Salvar em arquivo
                val cachePath = File(context.cacheDir, "images")
                cachePath.mkdirs()
                val file = File(cachePath, "player_card_${user.id}_${System.currentTimeMillis()}.png")

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

                // Criar intent de compartilhamento
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, contentUri)
                    putExtra(
                        Intent.EXTRA_TEXT,
                        "⚽ Confira o cartão de ${user.getDisplayName()} no Futeba dos Parças!\n\n$PLAY_STORE_URL"
                    )
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    setPackage("com.whatsapp")
                }

                try {
                    context.startActivity(shareIntent)
                } catch (e: Exception) {
                    // Se WhatsApp não estiver instalado, mostrar seletor
                    shareIntent.setPackage(null)
                    context.startActivity(Intent.createChooser(shareIntent, "Compartilhar cartão via"))
                }

                // Reciclar bitmaps
                bitmap.recycle()
                photoBitmap?.recycle()

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
     * Carrega a foto do usuário usando Coil
     */
    private suspend fun loadUserPhoto(context: Context, photoUrl: String?): Bitmap? {
        if (photoUrl.isNullOrBlank()) return null

        return withContext(Dispatchers.IO) {
            try {
                val request = ImageRequest.Builder(context)
                    .data(photoUrl)
                    .size(200, 200)
                    .allowHardware(false)
                    .build()

                val result = context.imageLoader.execute(request)
                if (result is SuccessResult) {
                    (result.drawable as? android.graphics.drawable.BitmapDrawable)?.bitmap
                } else null
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    /**
     * Cria o bitmap do card usando Canvas nativo do Android
     */
    private fun createPlayerCardBitmap(
        context: Context,
        user: User,
        stats: UserStatistics?,
        generatedBy: String,
        isDarkMode: Boolean,
        photoBitmap: Bitmap?
    ): Bitmap {
        val dateFormat = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale.forLanguageTag("pt-BR"))
        val now = Date()

        // Cores baseadas no tema
        val bgColor = if (isDarkMode) DARK_BG else LIGHT_BG
        val surfaceColor = if (isDarkMode) DARK_SURFACE else LIGHT_SURFACE
        val dividerColor = if (isDarkMode) DARK_DIVIDER else LIGHT_DIVIDER
        val textPrimary = if (isDarkMode) DARK_TEXT_PRIMARY else LIGHT_TEXT_PRIMARY
        val textSecondary = if (isDarkMode) DARK_TEXT_SECONDARY else LIGHT_TEXT_SECONDARY

        // Calcular altura necessária
        val hasStats = stats != null
        val cardHeight = if (hasStats) 880 else 780

        val bitmap = Bitmap.createBitmap(CARD_WIDTH, cardHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Paints
        val bgPaint = Paint().apply {
            color = bgColor
            isAntiAlias = true
        }
        val textPaint = Paint().apply {
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }

        // Fundo com cantos arredondados
        val bgRect = RectF(0f, 0f, CARD_WIDTH.toFloat(), cardHeight.toFloat())
        canvas.drawRoundRect(bgRect, CORNER_RADIUS, CORNER_RADIUS, bgPaint)

        var yPos = CARD_PADDING + 20f

        // Header "FUTEBA DOS PARÇAS"
        textPaint.apply {
            color = GOLD_COLOR
            textSize = 28f
            textAlign = Paint.Align.CENTER
            letterSpacing = 0.15f
        }
        canvas.drawText("⚽ FUTEBA DOS PARÇAS", CARD_WIDTH / 2f, yPos, textPaint)
        yPos += 50f

        // Foto do jogador
        val photoRadius = 70f
        val photoCenterX = CARD_WIDTH / 2f
        val photoCenterY = yPos + photoRadius

        if (photoBitmap != null) {
            // Desenhar foto circular
            drawCircularBitmap(canvas, photoBitmap, photoCenterX, photoCenterY, photoRadius)
        } else {
            // Fallback: círculo com iniciais
            val photoBgPaint = Paint().apply {
                color = surfaceColor
                isAntiAlias = true
            }
            canvas.drawCircle(photoCenterX, photoCenterY, photoRadius, photoBgPaint)

            textPaint.apply {
                color = textPrimary
                textSize = 48f
                textAlign = Paint.Align.CENTER
            }
            val initials = user.getDisplayName().split(" ")
                .take(2)
                .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                .joinToString("")
            canvas.drawText(initials, photoCenterX, photoCenterY + 16f, textPaint)
        }

        // Badge de nível (canto inferior direito da foto)
        val badgePaint = Paint().apply {
            color = GOLD_COLOR
            isAntiAlias = true
        }
        val badgeRadius = 24f
        val badgeX = photoCenterX + photoRadius - 10f
        val badgeY = photoCenterY + photoRadius - 10f
        canvas.drawCircle(badgeX, badgeY, badgeRadius, badgePaint)

        textPaint.apply {
            color = AndroidColor.BLACK
            textSize = 22f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(user.level.toString(), badgeX, badgeY + 8f, textPaint)

        yPos = photoCenterY + photoRadius + 40f

        // Nome do jogador
        textPaint.apply {
            color = textPrimary
            textSize = 36f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            letterSpacing = 0.05f
        }
        canvas.drawText(user.getDisplayName().uppercase(), CARD_WIDTH / 2f, yPos, textPaint)
        yPos += 40f

        // Nível e título - CENTRALIZADO
        val levelName = LevelTable.getLevelName(user.level)
        val levelChipText = user.level.toString()

        // Calcular largura total para centralizar
        textPaint.textSize = 22f
        val levelNameWidth = textPaint.measureText(levelName)
        val chipWidth = 50f
        val totalWidth = chipWidth + 12f + levelNameWidth
        val startX = (CARD_WIDTH - totalWidth) / 2f

        // Chip do nível
        val chipRect = RectF(startX, yPos - 22f, startX + chipWidth, yPos + 8f)
        val chipPaint = Paint().apply {
            color = GOLD_COLOR
            isAntiAlias = true
        }
        canvas.drawRoundRect(chipRect, 8f, 8f, chipPaint)

        textPaint.apply {
            color = AndroidColor.BLACK
            textSize = 20f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(levelChipText, startX + chipWidth / 2f, yPos, textPaint)

        // Nome do nível
        textPaint.apply {
            color = GOLD_COLOR
            textSize = 22f
            textAlign = Paint.Align.LEFT
        }
        canvas.drawText(levelName, startX + chipWidth + 12f, yPos, textPaint)
        textPaint.textAlign = Paint.Align.CENTER
        yPos += 36f

        // XP
        textPaint.apply {
            color = GREEN_COLOR
            textSize = 24f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("${user.experiencePoints} XP", CARD_WIDTH / 2f, yPos, textPaint)
        yPos += 40f

        // Divider
        val dividerPaint = Paint().apply {
            color = dividerColor
            strokeWidth = 2f
        }
        canvas.drawLine(CARD_PADDING + 32f, yPos, CARD_WIDTH - CARD_PADDING - 32f, yPos, dividerPaint)
        yPos += 32f

        // Estatísticas (se disponíveis)
        if (stats != null) {
            val statsY = yPos
            val statSpacing = (CARD_WIDTH - CARD_PADDING * 2) / 4f

            drawStatItem(canvas, textPaint, CARD_PADDING + statSpacing * 0.5f, statsY, "JOGOS", stats.totalGames.toString(), textPrimary, textSecondary)
            drawStatItem(canvas, textPaint, CARD_PADDING + statSpacing * 1.5f, statsY, "GOLS", stats.totalGoals.toString(), textPrimary, textSecondary)
            drawStatItem(canvas, textPaint, CARD_PADDING + statSpacing * 2.5f, statsY, "ASSISTS", stats.totalAssists.toString(), textPrimary, textSecondary)
            drawStatItem(canvas, textPaint, CARD_PADDING + statSpacing * 3.5f, statsY, "MVPs", stats.bestPlayerCount.toString(), textPrimary, textSecondary)

            yPos += 70f
        }

        // Label "RATINGS"
        textPaint.apply {
            color = textSecondary
            textSize = 18f
            letterSpacing = 0.2f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("RATINGS", CARD_WIDTH / 2f, yPos, textPaint)
        yPos += 32f

        // Barras de rating
        val ratings = listOf(
            Triple("ATAQUE", user.getEffectiveRating(PlayerRatingRole.STRIKER), ATTACK_COLOR),
            Triple("MEIO", user.getEffectiveRating(PlayerRatingRole.MID), MID_COLOR),
            Triple("DEFESA", user.getEffectiveRating(PlayerRatingRole.DEFENDER), DEFENSE_COLOR),
            Triple("GOLEIRO", user.getEffectiveRating(PlayerRatingRole.GOALKEEPER), GOALKEEPER_COLOR)
        )

        for ((label, rating, color) in ratings) {
            drawRatingBar(canvas, textPaint, yPos, label, rating, color, textSecondary, surfaceColor)
            yPos += 40f
        }

        yPos += 16f

        // Divider final
        canvas.drawLine(CARD_PADDING + 64f, yPos, CARD_WIDTH - CARD_PADDING - 64f, yPos, dividerPaint)
        yPos += 28f

        // Footer - CENTRALIZADO
        textPaint.apply {
            color = textSecondary
            textSize = 14f
            letterSpacing = 0f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("Gerado em ${dateFormat.format(now)}", CARD_WIDTH / 2f, yPos, textPaint)
        yPos += 20f
        canvas.drawText("por $generatedBy", CARD_WIDTH / 2f, yPos, textPaint)
        yPos += 32f

        // Link do Play Store
        textPaint.apply {
            color = GOLD_COLOR
            textSize = 16f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("📲 Baixe o Futeba dos Parças!", CARD_WIDTH / 2f, yPos, textPaint)
        yPos += 18f

        textPaint.apply {
            color = GREEN_COLOR
            textSize = 12f
        }
        canvas.drawText(PLAY_STORE_URL, CARD_WIDTH / 2f, yPos, textPaint)

        return bitmap
    }

    /**
     * Desenha uma imagem circular no canvas
     */
    private fun drawCircularBitmap(canvas: Canvas, bitmap: Bitmap, centerX: Float, centerY: Float, radius: Float) {
        val scaledBitmap = Bitmap.createScaledBitmap(bitmap, (radius * 2).toInt(), (radius * 2).toInt(), true)

        val paint = Paint().apply {
            isAntiAlias = true
            shader = BitmapShader(scaledBitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        }

        // Ajustar posição do shader
        val matrix = android.graphics.Matrix()
        matrix.setTranslate(centerX - radius, centerY - radius)
        paint.shader.setLocalMatrix(matrix)

        canvas.drawCircle(centerX, centerY, radius, paint)
    }

    private fun drawStatItem(canvas: Canvas, paint: Paint, x: Float, y: Float, label: String, value: String, textPrimary: Int, textSecondary: Int) {
        paint.apply {
            color = textPrimary
            textSize = 32f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText(value, x, y, paint)

        paint.apply {
            color = textSecondary
            textSize = 12f
        }
        canvas.drawText(label, x, y + 20f, paint)
    }

    private fun drawRatingBar(canvas: Canvas, paint: Paint, y: Float, label: String, rating: Double, color: Int, textSecondary: Int, barBgColor: Int) {
        val barStartX = CARD_PADDING + 90f
        val barEndX = CARD_WIDTH - CARD_PADDING - 70f
        val barWidth = barEndX - barStartX
        val barHeight = 16f

        // Label
        paint.apply {
            this.color = textSecondary
            textSize = 16f
            textAlign = Paint.Align.LEFT
        }
        canvas.drawText(label, CARD_PADDING, y + 5f, paint)

        // Background da barra
        val barBgPaint = Paint().apply {
            this.color = barBgColor
            isAntiAlias = true
        }
        val bgRect = RectF(barStartX, y - 8f, barEndX, y - 8f + barHeight)
        canvas.drawRoundRect(bgRect, 8f, 8f, barBgPaint)

        // Barra preenchida
        val fillWidth = (barWidth * (rating / 5.0)).toFloat().coerceIn(0f, barWidth)
        val barFillPaint = Paint().apply {
            this.color = color
            isAntiAlias = true
        }
        val fillRect = RectF(barStartX, y - 8f, barStartX + fillWidth, y - 8f + barHeight)
        canvas.drawRoundRect(fillRect, 8f, 8f, barFillPaint)

        // Valor
        paint.apply {
            this.color = color
            textSize = 20f
            textAlign = Paint.Align.RIGHT
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText(String.format(Locale.getDefault(), "%.1f", rating), CARD_WIDTH - CARD_PADDING, y + 5f, paint)
    }
}
