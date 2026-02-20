package com.futebadosparcas.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.toDataModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PlayerCardViewModel(
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
                val statsResult = statisticsRepository.getStatistics(userId)
                val statistics = statsResult.getOrNull()?.toDataModel(userId)

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
        val statistics: Statistics?
    ) : PlayerCardUiState()
    data class Error(val message: String) : PlayerCardUiState()
}
