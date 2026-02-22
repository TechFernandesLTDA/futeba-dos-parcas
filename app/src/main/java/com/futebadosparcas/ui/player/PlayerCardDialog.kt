package com.futebadosparcas.ui.player

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.core.content.FileProvider
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.ui.players.PlayerCardContent
import com.futebadosparcas.ui.theme.FutebaTheme
import java.io.File
import java.io.FileOutputStream
import org.koin.androidx.viewmodel.ext.android.viewModel
import com.futebadosparcas.R

class PlayerCardDialog : DialogFragment() {

    private val viewModel: PlayerCardViewModel by viewModel()
    private var userId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        userId = arguments?.getString(ARG_USER_ID)
        setStyle(STYLE_NO_TITLE, R.style.PlayerCardDialogStyle)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            
            // Load data immediately
            userId?.let { viewModel.loadPlayerData(it) }

            setContent {
                FutebaTheme {
                    val uiState = viewModel.uiState.collectAsStateWithLifecycle().value

                    when (uiState) {
                        is PlayerCardUiState.Success -> {
                            PlayerCardContent(
                                user = uiState.user,
                                stats = uiState.statistics,
                                onClose = { dismiss() },
                                onShare = { sharePlayerCard(this) }
                            )
                        }
                        is PlayerCardUiState.Error -> {
                            // Show error briefly or dismiss
                            // For simplicity, just dismiss on error or show empty/loading
                            dismiss()
                        }
                        is PlayerCardUiState.Loading -> {
                            // Loading State - could add a shimmer here ideally
                        }
                    }
                }
            }
        }
    }

    private fun sharePlayerCard(view: View) {
        try {
            val bitmap = captureView(view)

            try {
                val cachePath = File(requireContext().cacheDir, "images")
                cachePath.mkdirs()
                val file = File(cachePath, "player_card_${System.currentTimeMillis()}.png")

                FileOutputStream(file).use { out ->
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                }

                val contentUri = FileProvider.getUriForFile(
                    requireContext(),
                    "${requireContext().packageName}.fileprovider",
                    file
                )

                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, contentUri)
                    putExtra(Intent.EXTRA_TEXT, "Confira meu cartão de jogador no Futeba dos Parças! ⚽")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                startActivity(Intent.createChooser(shareIntent, "Compartilhar cartão"))
            } finally {
                // FIX: Recycle bitmap to prevent 50-200MB memory leak
                bitmap.recycle()
            }

        } catch (e: Exception) {
            android.widget.Toast.makeText(requireContext(), getString(R.string.error_sharing), android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    private fun captureView(view: View): Bitmap {
        // Measure and layout if needed (usually handled by View system, but to be safe for ComposeView)
        // Note: For ComposeView inside Dialog, it should be laid out.
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        view.draw(canvas)
        return bitmap
    }

    companion object {
        private const val ARG_USER_ID = "user_id"

        fun newInstance(userId: String): PlayerCardDialog {
            return PlayerCardDialog().apply {
                arguments = Bundle().apply {
                    putString(ARG_USER_ID, userId)
                }
            }
        }
    }
}
