package com.futebadosparcas.util

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.LayoutInflater
import android.view.View
import androidx.core.content.FileProvider
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.databinding.LayoutShareCardBinding
import java.io.File
import java.io.FileOutputStream

object ShareCardHelper {

    fun shareGameResult(
        context: Context,
        game: Game,
        team1Name: String,
        team2Name: String,
        team1Score: Int,
        team2Score: Int
    ) {
        val binding = LayoutShareCardBinding.inflate(LayoutInflater.from(context))

        // Populate Data
        binding.tvDate.text = "${game.date} • ${game.locationName}"
        binding.tvTeam1Name.text = team1Name
        binding.tvTeam2Name.text = team2Name
        binding.tvTeam1Score.text = team1Score.toString()
        binding.tvTeam2Score.text = team2Score.toString()

        // Measure and Layout
        val width = 1080
        val height = 1080
        binding.root.measure(
            View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
        )
        binding.root.layout(0, 0, width, height)

        // Draw to Bitmap
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        binding.root.draw(canvas)

        // Save to File
        try {
            val cachePath = File(context.cacheDir, "images")
            cachePath.mkdirs()
            val stream = FileOutputStream("$cachePath/game_result.png")
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            stream.close()

            // Share Intent
            val newFile = File(cachePath, "game_result.png")
            val contentUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", newFile)

            if (contentUri != null) {
                val shareIntent = Intent()
                shareIntent.action = Intent.ACTION_SEND
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                shareIntent.setDataAndType(contentUri, context.contentResolver.getType(contentUri))
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri)
                shareIntent.type = "image/png"
                context.startActivity(Intent.createChooser(shareIntent, "Compartilhar Resultado"))
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
