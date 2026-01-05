package com.futebadosparcas.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.R
import com.futebadosparcas.ui.auth.LoginActivity
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

/**
 * Fragment que hospeda a ProfileScreen em Jetpack Compose
 *
 * Responsabilidades:
 * - Gerenciar navegação para outras telas
 * - Observar estado de logout e navegar para login
 * - Mostrar diálogo de confirmação de logout
 */
@AndroidEntryPoint
class ProfileFragment : Fragment() {

    private val viewModel: ProfileViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            // Define a estratégia de composição para corresponder ao ciclo de vida do Fragment
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)

            setContent {
                FutebaTheme {
                    ProfileScreen(
                        viewModel = viewModel,
                        onEditProfileClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_editProfileFragment)
                        },
                        onSettingsClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_preferencesFragment)
                        },
                        onNotificationsClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_notificationsFragment)
                        },
                        onAboutClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_aboutFragment)
                        },
                        onSchedulesClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_schedules)
                        },
                        onLevelJourneyClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_levelJourney)
                        },
                        onUserManagementClick = {
                            findNavController().navigate(R.id.userManagementFragment)
                        },
                        onMyLocationsClick = {
                            findNavController().navigate(R.id.fieldOwnerDashboardFragment)
                        },
                        onManageLocationsClick = {
                            findNavController().navigate(R.id.manageLocationsFragment)
                        },
                        onGamificationSettingsClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_gamificationSettings)
                        },
                        onDeveloperMenuClick = {
                            findNavController().navigate(R.id.action_profileFragment_to_developerFragment)
                        },
                        onLogoutClick = {
                            showLogoutConfirmation()
                        }
                    )
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        observeViewModel()
    }

    override fun onResume() {
        super.onResume()
        viewModel.loadProfile()
    }

    /**
     * Mostra diálogo de confirmação antes de fazer logout
     */
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

    /**
     * Observa estados do ViewModel que requerem ação do Fragment
     */
    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ProfileUiState.LoggedOut -> {
                        navigateToLogin()
                    }
                    else -> {
                        // Outros estados são tratados pelo Compose
                    }
                }
            }
        }

        // Observar eventos de UI para mostrar Toast quando dev mode é ativado
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                if (state is ProfileUiState.Success && state.isDevMode) {
                    // Verificar se acabou de ser ativado comparando com estado anterior
                    // Para evitar mostrar toast toda vez que recompõe
                    // Esta lógica simples pode ser melhorada com um evento único
                }
            }
        }
    }

    /**
     * Navega para a tela de login e limpa a pilha de navegação
     */
    private fun navigateToLogin() {
        val intent = Intent(requireContext(), LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        requireActivity().finish()
    }
}
