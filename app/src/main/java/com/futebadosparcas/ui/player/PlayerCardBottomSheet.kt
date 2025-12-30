package com.futebadosparcas.ui.player

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.FileProvider
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.databinding.BottomSheetPlayerCardBinding
import com.futebadosparcas.util.LevelHelper
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Locale

@AndroidEntryPoint
class PlayerCardBottomSheet : BottomSheetDialogFragment() {

    private var _binding: BottomSheetPlayerCardBinding? = null
    private val binding get() = _binding!!

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
        _binding = BottomSheetPlayerCardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupClickListeners()
        observeViewModel()

        // Carregar dados do jogador
        userId?.let { viewModel.loadPlayerData(it) }
    }

    private fun setupClickListeners() {
        binding.btnShare.setOnClickListener {
            sharePlayerCard()
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
                        // Mostrar erro
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
        if (!user.photoUrl.isNullOrEmpty()) {
            binding.ivPlayerPhoto.load(user.photoUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_player_placeholder)
                error(R.drawable.ic_player_placeholder)
                transformations(CircleCropTransformation())
            }
        } else {
            binding.ivPlayerPhoto.setImageResource(R.drawable.ic_player_placeholder)
        }

        // Nome
        binding.tvPlayerName.text = user.name

        // Membro desde
        user.createdAt?.let { date ->
            val format = SimpleDateFormat("MMM yyyy", Locale("pt", "BR"))
            binding.tvMemberSince.text = "Membro desde ${format.format(date)}"
        } ?: run {
            binding.tvMemberSince.text = "Membro desde 2024"
        }

        // Nível e XP
        binding.tvLevel.text = user.level.toString()
        binding.tvLevelName.text = com.futebadosparcas.data.model.LevelTable.getLevelName(user.level)

        val nextLevelXP = LevelHelper.getXPForNextLevel(user.level)
        binding.tvXpProgress.text = "${user.experiencePoints} / $nextLevelXP XP"
        
        val percentage = LevelHelper.getProgressPercentage(user.experiencePoints)
        binding.progressXp.progress = percentage

        // Estatísticas
        binding.tvTotalGames.text = stats?.totalGames?.toString() ?: "0"
        binding.tvTotalGoals.text = stats?.totalGoals?.toString() ?: "0"
        binding.tvTotalAssists.text = stats?.totalAssists?.toString() ?: "0"
        binding.tvWins.text = stats?.gamesWon?.toString() ?: "0"
        binding.tvMvp.text = stats?.bestPlayerCount?.toString() ?: "0"
        binding.tvSaves.text = stats?.totalSaves?.toString() ?: "0"

        // Habilidades (Ratings)
        binding.tvStrikerRating.text = String.format("%.1f", user.strikerRating)
        binding.progressStriker.progress = ((user.strikerRating / 5.0) * 100).toInt()

        binding.tvMidRating.text = String.format("%.1f", user.midRating)
        binding.progressMid.progress = ((user.midRating / 5.0) * 100).toInt()

        binding.tvDefenderRating.text = String.format("%.1f", user.defenderRating)
        binding.progressDefender.progress = ((user.defenderRating / 5.0) * 100).toInt()

        binding.tvGkRating.text = String.format("%.1f", user.gkRating)
        binding.progressGk.progress = ((user.gkRating / 5.0) * 100).toInt()
    }

    private fun sharePlayerCard() {
        try {
            // Capturar o card como bitmap
            val bitmap = captureView(binding.bottomSheet)
            
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

        fun newInstance(userId: String): PlayerCardBottomSheet {
            return PlayerCardBottomSheet().apply {
                arguments = Bundle().apply {
                    putString(ARG_USER_ID, userId)
                }
            }
        }
    }
}
