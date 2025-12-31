package com.futebadosparcas.ui.player

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.core.content.FileProvider
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.databinding.DialogPlayerCardBinding
import com.futebadosparcas.util.LevelHelper
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Locale

@AndroidEntryPoint
class PlayerCardDialog : DialogFragment() {

    private var _binding: DialogPlayerCardBinding? = null
    private val binding get() = _binding!!

    private val viewModel: PlayerCardViewModel by viewModels()
    
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
        dialog?.window?.apply {
            setBackgroundDrawable(android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT))
            requestFeature(android.view.Window.FEATURE_NO_TITLE)
        }
        
        _binding = DialogPlayerCardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupClickListeners()
        observeViewModel()

        userId?.let { viewModel.loadPlayerData(it) }
    }

    private fun setupClickListeners() {
        binding.btnClose.setOnClickListener {
            dismiss()
        }
        
        binding.btnShareWhatsapp.setOnClickListener {
            sharePlayerCard()
        }
        
        // Fechar ao clicar no fundo (fora do card)
        binding.root.setOnClickListener {
            dismiss()
        }
        
        // Impedir que cliques no card fechem o dialog
        binding.playerCard.setOnClickListener {
            // Não fazer nada - previne o dismiss
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is PlayerCardUiState.Loading -> {
                        // Mostrar loading se necessário
                    }
                    is PlayerCardUiState.Success -> {
                        bindPlayerData(state)
                    }
                    is PlayerCardUiState.Error -> {
                        android.widget.Toast.makeText(
                            requireContext(),
                            state.message,
                            android.widget.Toast.LENGTH_SHORT
                        ).show()
                        dismiss()
                    }
                }
            }
        }
    }

    private fun bindPlayerData(state: PlayerCardUiState.Success) {
        val user = state.user
        val stats = state.statistics

        // Foto
        binding.ivPlayerPhoto.loadProfileImage(user.photoUrl)

        // Nome
        binding.tvPlayerName.text = user.getDisplayName()

        // Nível e XP
        binding.tvLevel.text = user.level.toString()
        binding.tvLevelName.text = com.futebadosparcas.data.model.LevelTable.getLevelName(user.level)

        val nextLevelXP = LevelHelper.getXPForNextLevel(user.level)
        binding.tvXpProgress.text = "${user.experiencePoints} / $nextLevelXP"
        
        val percentage = LevelHelper.getProgressPercentage(user.experiencePoints)
        binding.progressXp.progress = percentage

        // Estatísticas
        binding.tvTotalGames.text = stats?.totalGames?.toString() ?: "0"
        binding.tvTotalGoals.text = stats?.totalGoals?.toString() ?: "0"
        binding.tvTotalAssists.text = stats?.totalAssists?.toString() ?: "0"
        binding.tvWins.text = stats?.gamesWon?.toString() ?: "0"
        binding.tvMvp.text = stats?.bestPlayerCount?.toString() ?: "0"
        binding.tvSaves.text = stats?.totalSaves?.toString() ?: "0"

        // Habilidades (Ratings) - Circular Progress
        binding.tvStrikerRating.text = String.format("%.1f", user.strikerRating)
        binding.progressStriker.progress = ((user.strikerRating / 5.0) * 100).toInt()

        binding.tvMidRating.text = String.format("%.1f", user.midRating)
        binding.progressMid.progress = ((user.midRating / 5.0) * 100).toInt()

        binding.tvDefenderRating.text = String.format("%.1f", user.defenderRating)
        binding.progressDefender.progress = ((user.defenderRating / 5.0) * 100).toInt()

        binding.tvGkRating.text = String.format("%.1f", user.gkRating)
        binding.progressGk.progress = ((user.gkRating / 5.0) * 100).toInt()

        // Timestamp
        val dateFormat = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale("pt", "BR"))
        binding.tvCardTimestamp.text = "Gerado em ${dateFormat.format(java.util.Date())}"
    }

    private fun sharePlayerCard() {
        try {
            // Capturar o FrameLayout inteiro (inclui margem transparente)
            val bitmap = captureView(binding.root)
            
            // Salvar em cache
            val cachePath = File(requireContext().cacheDir, "images")
            cachePath.mkdirs()
            val file = File(cachePath, "player_card_${System.currentTimeMillis()}.png")
            
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }
            
            // Obter URI usando FileProvider
            val contentUri = FileProvider.getUriForFile(
                requireContext(),
                "${requireContext().packageName}.fileprovider",
                file
            )
            
            // Criar intent de compartilhamento
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_TEXT, "Confira meu cartão de jogador no Futeba dos Parças! ⚽")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                setPackage("com.whatsapp")
            }
            
            try {
                startActivity(shareIntent)
            } catch (e: Exception) {
                shareIntent.setPackage(null)
                startActivity(Intent.createChooser(shareIntent, "Compartilhar via"))
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

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
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
