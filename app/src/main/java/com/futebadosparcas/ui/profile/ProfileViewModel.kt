package com.futebadosparcas.ui.profile

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.data.repository.UserRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val authRepository: AuthRepository,
    private val gameRepository: GameRepository,
    private val liveGameRepository: LiveGameRepository,
    private val gamificationRepository: com.futebadosparcas.data.repository.GamificationRepository,
    private val statisticsRepository: com.futebadosparcas.data.repository.IStatisticsRepository,
    private val preferencesManager: com.futebadosparcas.util.PreferencesManager,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : ViewModel() {

    private val _uiEvents = kotlinx.coroutines.channels.Channel<ProfileUiEvent>()
    val uiEvents = _uiEvents.receiveAsFlow()

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    val uiState: StateFlow<ProfileUiState> = _uiState

    private var statisticsListener: com.google.firebase.firestore.ListenerRegistration? = null

    fun loadProfile() {
        viewModelScope.launch {
            if (_uiState.value !is ProfileUiState.Success) {
                _uiState.value = ProfileUiState.Loading
            }

            val result = userRepository.getCurrentUser()

            result.fold(
                onSuccess = { user ->
                    val badgesResult = gamificationRepository.getUserBadges(user.id)
                    val badges = badgesResult.getOrNull() ?: emptyList()

                    // Carregar estatísticas
                    val statsResult = statisticsRepository.getUserStatistics(user.id)
                    val stats = statsResult.getOrNull()

                    _uiState.value = ProfileUiState.Success(user, badges, stats, isDevModeEnabled())
                    _uiEvents.send(ProfileUiEvent.LoadComplete)

                    // Iniciar listener de tempo real para estatísticas
                    setupStatisticsRealTimeListener(user.id)
                },
                onFailure = { error ->
                    _uiState.value = ProfileUiState.Error(error.message ?: "Erro ao carregar perfil")
                    _uiEvents.send(ProfileUiEvent.LoadComplete)
                }
            )
        }
    }

    private fun setupStatisticsRealTimeListener(userId: String) {
        // Remover listener anterior se existir
        statisticsListener?.remove()

        // Configurar novo listener para atualizações em tempo real
        statisticsListener = firestore.collection("statistics")
            .document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    try {
                        val updatedStats = snapshot.toObject(com.futebadosparcas.data.model.UserStatistics::class.java)
                        val currentState = _uiState.value

                        if (currentState is ProfileUiState.Success && updatedStats != null) {
                            // Atualizar o estado com as novas estatísticas
                            _uiState.value = currentState.copy(statistics = updatedStats)
                        }
                    } catch (e: Exception) {
                        // Ignorar erros de parsing
                    }
                }
            }
    }

    fun updateProfile(
        name: String,
        nickname: String?,
        preferredFieldTypes: List<FieldType>,
        photoUri: Uri?,
        strikerRating: Double,
        midRating: Double,
        defenderRating: Double,
        gkRating: Double
    ) {
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading

            // Atualizar perfil com tudo de uma vez (foto, dados e ratings)
            val profileResult = userRepository.updateProfile(
                name,
                nickname,
                preferredFieldTypes,
                photoUri,
                strikerRating,
                midRating,
                defenderRating,
                gkRating
            )

            profileResult.fold(
                onSuccess = { user ->
                    _uiState.value = ProfileUiState.ProfileUpdateSuccess(user)
                },
                onFailure = { error ->
                    _uiState.value = ProfileUiState.Error(error.message ?: "Erro ao atualizar perfil")
                }
            )
        }
    }

    fun logout() {
        authRepository.logout()
        _uiState.value = ProfileUiState.LoggedOut
    }

    fun resetAllData() {
        viewModelScope.launch {
            gameRepository.clearAll()
            liveGameRepository.clearAll()
            _uiState.value = ProfileUiState.DataReset
        }
    }

    fun enableDevMode() {
        preferencesManager.setDevModeEnabled(true)
        val currentState = _uiState.value
        if (currentState is ProfileUiState.Success) {
            _uiState.value = currentState.copy(isDevMode = true)
        }
    }

    fun isDevModeEnabled(): Boolean {
        return preferencesManager.isDevModeEnabled()
    }

    override fun onCleared() {
        super.onCleared()
        // Remover listener de tempo real ao destruir o ViewModel
        statisticsListener?.remove()
    }
}

sealed class ProfileUiState {
    object Loading : ProfileUiState()
    data class Success(
        val user: User, 
        val badges: List<com.futebadosparcas.data.model.UserBadge>,
        val statistics: com.futebadosparcas.data.model.UserStatistics?,
        val isDevMode: Boolean
    ) : ProfileUiState()
    data class ProfileUpdateSuccess(val user: User) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
    object LoggedOut : ProfileUiState()
    object DataReset : ProfileUiState()
}

sealed class ProfileUiEvent {
    object LoadComplete : ProfileUiEvent()
}
