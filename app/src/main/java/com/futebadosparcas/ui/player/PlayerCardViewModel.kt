package com.futebadosparcas.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.data.repository.StatisticsRepository
import com.futebadosparcas.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PlayerCardViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val statisticsRepository: StatisticsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlayerCardUiState>(PlayerCardUiState.Loading)
    val uiState: StateFlow<PlayerCardUiState> = _uiState.asStateFlow()

    fun loadPlayerData(userId: String) {
        viewModelScope.launch {
            _uiState.value = PlayerCardUiState.Loading

            try {
                // Buscar dados do usuário
                val userResult = userRepository.getUserById(userId)
                
                if (userResult.isFailure) {
                    _uiState.value = PlayerCardUiState.Error("Usuário não encontrado")
                    return@launch
                }
                
                val user = userResult.getOrNull()
                if (user == null) {
                    _uiState.value = PlayerCardUiState.Error("Usuário não encontrado")
                    return@launch
                }

                // Buscar estatísticas
                val statsResult = statisticsRepository.getUserStatistics(userId)
                val statistics = statsResult.getOrNull()

                _uiState.value = PlayerCardUiState.Success(
                    user = user,
                    statistics = statistics
                )

            } catch (e: Exception) {
                _uiState.value = PlayerCardUiState.Error(e.message ?: "Erro ao carregar dados")
            }
        }
    }
}

sealed class PlayerCardUiState {
    object Loading : PlayerCardUiState()
    data class Success(
        val user: User,
        val statistics: UserStatistics?
    ) : PlayerCardUiState()
    data class Error(val message: String) : PlayerCardUiState()
}
