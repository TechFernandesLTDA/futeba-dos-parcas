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
import androidx.fragment.app.viewModels
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.ui.players.PlayerCardContent
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import dagger.hilt.android.AndroidEntryPoint
import java.io.File
import java.io.FileOutputStream

/**
 * BottomSheet do Cartão de Jogador com Jetpack Compose
 *
 * Substitui a implementação XML por uma versão Compose moderna
 * seguindo os padrões Material Design 3 do projeto.
 */
@AndroidEntryPoint
class PlayerCardBottomSheet : BottomSheetDialogFragment() {

    private val viewModel: PlayerCardViewModel by viewModels()
    private var userId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        userId = arguments?.getString(ARG_USER_ID)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            // Carregar dados imediatamente
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
                                onShare = { sharePlayerCard(this@apply) }
                            )
                        }
                        is PlayerCardUiState.Error -> {
                            // Mostrar erro e fechar
                            android.widget.Toast.makeText(
                                requireContext(),
                                uiState.message,
                                android.widget.Toast.LENGTH_SHORT
                            ).show()
                            dismiss()
                        }
                        is PlayerCardUiState.Loading -> {
                            // Estado de carregamento
                            com.futebadosparcas.ui.components.ShimmerPlayerCard()
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

                    // Tentar abrir diretamente no WhatsApp
                    setPackage("com.whatsapp")
                }

                try {
                    startActivity(shareIntent)
                } catch (e: Exception) {
                    // Se WhatsApp não estiver instalado, mostrar seletor geral
                    shareIntent.setPackage(null)
                    startActivity(Intent.createChooser(shareIntent, "Compartilhar via"))
                }
            } finally {
                // Reciclar bitmap para evitar memory leak
                bitmap.recycle()
            }

        } catch (e: Exception) {
            android.widget.Toast.makeText(
                requireContext(),
                "Erro ao compartilhar: ${e.message}",
                android.widget.Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun captureView(view: View): Bitmap {
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        view.draw(canvas)
        return bitmap
    }

    companion object {
        private const val ARG_USER_ID = "user_id"

        fun newInstance(userId: String): PlayerCardBottomSheet {
            return PlayerCardBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_USER_ID, userId)
                }
            }
        }
    }
}
