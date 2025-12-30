package com.futebadosparcas.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import coil.load
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentProfileBinding
import com.futebadosparcas.ui.auth.LoginActivity
import com.futebadosparcas.util.LevelHelper
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ProfileViewModel by viewModels()
    private val badgesAdapter = UserBadgesAdapter()

    // Lista de animadores ativos para cancelar ao destruir a view
    private val activeAnimators = mutableListOf<android.animation.ValueAnimator>()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.rvBadges.adapter = badgesAdapter
        setupSwipeRefresh()
        setupClickListeners()
        observeViewModel()

        // Set version in About subtitle
        binding.tvAboutSubtitle.text = "Versão ${com.futebadosparcas.BuildConfig.VERSION_NAME}"
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadProfile()
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.loadProfile()
    }

    private var avatarClickCount = 0
    private var lastAvatarClickTime = 0L

    private fun setupClickListeners() {
        binding.btnEditProfile.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_editProfileFragment)
        }

        binding.btnLogout.setOnClickListener {
            showLogoutConfirmation()
        }

        binding.cardNotifications.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_notificationsFragment)
        }
        binding.cardNotifications.visibility = View.VISIBLE

        binding.cardPreferences.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_preferencesFragment)
        }

        binding.cardSchedules.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_schedules)
        }

        binding.cardAbout.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_aboutFragment)
        }

        binding.cardUserManagement.setOnClickListener {
            findNavController().navigate(R.id.userManagementFragment)
        }

        binding.cardMyLocations.setOnClickListener {
            findNavController().navigate(R.id.fieldOwnerDashboardFragment)
        }

        binding.cardManageLocations.setOnClickListener {
            findNavController().navigate(R.id.manageLocationsFragment)
        }

        binding.cardDeveloperMenu.setOnClickListener {
             findNavController().navigate(R.id.action_profileFragment_to_developerFragment)
        }

        binding.cardLeagueSettings.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_gamificationSettings)
        }

        // Clique no card de nivel para ver jornada de evolucao
        binding.cardLevel.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_levelJourney)
        }

        // Secret Tap Logic
        binding.avatarCard.setOnClickListener {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastAvatarClickTime > 1000) {
                avatarClickCount = 0
            }
            lastAvatarClickTime = currentTime
            avatarClickCount++

            if (avatarClickCount == 7) {
                viewModel.enableDevMode()
                Toast.makeText(requireContext(), "Modo Desenvolvedor Ativado! Verifique o menu abaixo.", Toast.LENGTH_LONG).show()
                avatarClickCount = 0
            }
        }
    }

    private fun showLogoutConfirmation() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Sair")
            .setMessage("Tem certeza que deseja sair da sua conta?")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Sair") { _, _ ->
                viewModel.logout()
            }
            .show()
    }


    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiEvents.collect { event: ProfileUiEvent ->
                when (event) {
                    is ProfileUiEvent.LoadComplete -> {
                        binding.swipeRefresh.isRefreshing = false
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ProfileUiState.Loading -> {
                        binding.shimmerLayout.visibility = View.VISIBLE
                        binding.shimmerLayout.startShimmer()
                        binding.progressBar.visibility = View.GONE
                        binding.contentGroup.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                    }
                    is ProfileUiState.Success -> {
                        binding.shimmerLayout.stopShimmer()
                        binding.shimmerLayout.visibility = View.GONE
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        
                        // Fade in do conteúdo
                        binding.contentGroup.apply {
                            alpha = 0f
                            visibility = View.VISIBLE
                            animate()
                                .alpha(1f)
                                .setDuration(300)
                                .start()
                        }

                        binding.tvUserName.text = state.user.name
                        binding.tvUserEmail.text = state.user.email

                        // Update Role Badge
                        when {
                            state.user.isAdmin() -> {
                                binding.chipUserRole.text = "ADMINISTRADOR"
                                binding.chipUserRole.setChipBackgroundColorResource(R.color.error)
                                binding.chipUserRole.visibility = View.VISIBLE
                            }
                            state.user.isFieldOwner() -> {
                                binding.chipUserRole.text = "ORGANIZADOR"
                                binding.chipUserRole.setChipBackgroundColorResource(R.color.secondary)
                                binding.chipUserRole.visibility = View.VISIBLE
                            }
                            else -> {
                                binding.chipUserRole.visibility = View.GONE
                            }
                        }

                        if (state.user.photoUrl != null) {
                            binding.ivProfileImage.visibility = View.VISIBLE
                            binding.tvUserInitials.visibility = View.GONE
                            // Adiciona timestamp para forçar novo fetch e evitar cache stale
                            val url = state.user.photoUrl!!
                            val urlWithTimestamp = if (url.contains("?")) {
                                "$url&ts=${System.currentTimeMillis()}"
                            } else {
                                "$url?ts=${System.currentTimeMillis()}"
                            }
                            binding.ivProfileImage.load(urlWithTimestamp) {
                                crossfade(true)
                                placeholder(R.drawable.ic_launcher_foreground)
                            }
                        } else {
                            binding.ivProfileImage.visibility = View.GONE
                            binding.tvUserInitials.visibility = View.VISIBLE
                            binding.tvUserInitials.text = getInitials(state.user.name)
                        }

                        // Role-based visibility
                        val isAdmin = state.user.isAdmin()
                        val isFieldOwner = state.user.isFieldOwner()

                        binding.tvAdminSection.visibility = if (isAdmin || isFieldOwner) View.VISIBLE else View.GONE
                        
                        binding.cardUserManagement.visibility = 
                            if (isAdmin) View.VISIBLE else View.GONE
                        
                        binding.cardMyLocations.visibility = 
                            if (isFieldOwner) View.VISIBLE else View.GONE
                        
                        binding.cardLeagueSettings.visibility =
                            if (isAdmin) View.VISIBLE else View.GONE
                        
                        binding.cardManageLocations.visibility =
                            if (isAdmin) View.VISIBLE else View.GONE


                        // Field Preferences
                        val prefs = state.user.preferredFieldTypes
                        updatePreferenceIcon(binding.ivSociety, prefs.contains(com.futebadosparcas.data.model.FieldType.SOCIETY))
                        updatePreferenceIcon(binding.ivFutsal, prefs.contains(com.futebadosparcas.data.model.FieldType.FUTSAL))
                        updatePreferenceIcon(binding.ivField, prefs.contains(com.futebadosparcas.data.model.FieldType.CAMPO))
                        
                        // Dev Mode
                         binding.cardDeveloperMenu.visibility = 
                            if (state.isDevMode) View.VISIBLE else View.GONE

                        // Ratings com animação
                        animateRating(binding.tvRatingAtaValue, binding.pbRatingAta, 0.0, state.user.strikerRating)
                        animateRating(binding.tvRatingMeiValue, binding.pbRatingMei, 0.0, state.user.midRating)
                        animateRating(binding.tvRatingDefValue, binding.pbRatingDef, 0.0, state.user.defenderRating)
                        animateRating(binding.tvRatingGolValue, binding.pbRatingGol, 0.0, state.user.gkRating)

                        // XP e Nível com animação
                        updateLevelCard(state.user.level, state.user.experiencePoints)

                        // Estatísticas reais do Firestore
                        val stats = state.statistics
                        binding.tvStatsGames.text = stats?.totalGames?.toString() ?: "0"
                        binding.tvStatsGoals.text = stats?.totalGoals?.toString() ?: "0"
                        binding.tvStatsWins.text = stats?.gamesWon?.toString() ?: "0"
                        binding.tvStatsAssists.text = stats?.totalAssists?.toString() ?: "0"
                        binding.tvStatsDraws.text = stats?.gamesDraw?.toString() ?: "0"
                        binding.tvStatsWorst.text = stats?.worstPlayerCount?.toString() ?: "0"
                        binding.tvStatsBestGoal.text = stats?.bestGoalCount?.toString() ?: "0"
                        binding.tvStatsMvp.text = stats?.bestPlayerCount?.toString() ?: "0"
                        binding.tvStatsSaves.text = stats?.totalSaves?.toString() ?: "0"
                        binding.tvStatsCards.text = stats?.totalCards?.toString() ?: "0"

                        // Média de gols
                        val avgGoals = stats?.avgGoalsPerGame?.let { String.format("%.1f", it) } ?: "0.0"
                        binding.tvStatsAvgGoals.text = avgGoals
                        
                        // Badges
                        if (state.badges.isNotEmpty()) {
                            binding.tvBadgesTitle.visibility = View.VISIBLE
                            binding.rvBadges.visibility = View.VISIBLE
                            badgesAdapter.submitList(state.badges)
                        } else {
                            binding.tvBadgesTitle.visibility = View.GONE
                            binding.rvBadges.visibility = View.GONE
                        }
                    }
                    is ProfileUiState.Error -> {
                        binding.shimmerLayout.stopShimmer()
                        binding.shimmerLayout.visibility = View.GONE
                        binding.progressBar.visibility = View.GONE
                        binding.contentGroup.visibility = View.VISIBLE
                        binding.swipeRefresh.isRefreshing = false
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_SHORT).show()
                    }
                    is ProfileUiState.LoggedOut -> {
                        navigateToLogin()
                    }
                    else -> {}
                }
            }
        }
    }

    private fun animateRating(
        textView: TextView,
        progressIndicator: com.google.android.material.progressindicator.LinearProgressIndicator,
        from: Double,
        to: Double
    ) {
        val animator = android.animation.ValueAnimator.ofFloat(from.toFloat(), to.toFloat()).apply {
            duration = 1000
            addUpdateListener { anim ->
                if (_binding == null) {
                    anim.cancel()
                    return@addUpdateListener
                }
                val value = anim.animatedValue as Float
                textView.text = String.format("%.1f", value)
                val progress = ((value / 5.0) * 100).toInt()
                progressIndicator.setProgressCompat(progress, true)
            }
        }
        activeAnimators.add(animator)
        animator.start()
    }

    /**
     * Atualiza o card de XP/Nível com base no nível e XP do usuário
     */
    private fun updateLevelCard(level: Int, totalXP: Int) {
        // Atualizar nível
        binding.tvCurrentLevel.text = "Nível $level"

        // Calcular progresso no nível atual
        val (currentXP, neededXP) = LevelHelper.getProgressInCurrentLevel(totalXP)
        val percentage = LevelHelper.getProgressPercentage(totalXP)

        // Atualizar textos de XP
        binding.tvCurrentXp.text = "$currentXP XP"
        binding.tvNextLevelXp.text = "Faltam $neededXP XP para o próximo nível"
        binding.tvXpPercentage.text = "$percentage%"
        binding.tvLevelTitle.text = LevelHelper.getLevelTitle(level)

        // Atualizar mensagem motivacional
        binding.tvXpQuote.text = LevelHelper.getMotivationalMessage(totalXP)

        // Animar barra de progresso
        val xpAnimator = android.animation.ValueAnimator.ofInt(0, percentage).apply {
            duration = 1200
            addUpdateListener { animator ->
                // Verificar se a view ainda existe antes de atualizar
                if (_binding == null) {
                    animator.cancel()
                    return@addUpdateListener
                }
                val value = animator.animatedValue as Int
                binding.pbLevelXp.progress = value
            }
        }
        activeAnimators.add(xpAnimator)
        xpAnimator.start()

        // Atualizar badge de nível (pode ser customizado com diferentes ícones por nível)
        val levelTitle = LevelHelper.getLevelTitle(level)
        binding.ivLevelIcon.contentDescription = levelTitle
    }

    private fun getInitials(name: String): String {
        val parts = name.trim().split(" ")
        return when {
            parts.size >= 2 -> "${parts.first().first()}${parts.last().first()}".uppercase()
            parts.isNotEmpty() -> parts.first().take(2).uppercase()
            else -> "??"
        }
    }

    private fun updatePreferenceIcon(view: android.widget.ImageView, isEnabled: Boolean) {
        view.alpha = if (isEnabled) 1.0f else 0.2f
    }

    private fun navigateToLogin() {
        val intent = Intent(requireContext(), LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        requireActivity().finish()
    }

    override fun onDestroyView() {
        // Cancelar todos os animadores ativos para evitar crashes
        activeAnimators.forEach { it.cancel() }
        activeAnimators.clear()
        
        super.onDestroyView()
        _binding = null
    }
}
