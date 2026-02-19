package com.futebadosparcas.ui.developer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.util.MockDataHelper
import com.futebadosparcas.util.LocationSeeder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class DeveloperViewModel(
    private val locationSeeder: LocationSeeder
) : ViewModel() {

    private val _uiState = MutableStateFlow<DeveloperUiState>(DeveloperUiState.Idle)
    val uiState: StateFlow<DeveloperUiState> = _uiState

    fun generateMockData() {
        viewModelScope.launch {
            _uiState.value = DeveloperUiState.Loading
            try {
                val result = MockDataHelper.createMockHistoricalData()
                if (result.isSuccess) {
                    _uiState.value = DeveloperUiState.Success(result.getOrNull() ?: "Dados gerados com sucesso")
                } else {
                    _uiState.value = DeveloperUiState.Error(result.exceptionOrNull()?.message ?: "Erro desconhecido")
                }
            } catch (e: Exception) {
                 _uiState.value = DeveloperUiState.Error(e.message ?: "Erro ao gerar dados")
            }
        }
    }

    fun resetMockData() {
        viewModelScope.launch {
            _uiState.value = DeveloperUiState.Loading
            try {
                val result = MockDataHelper.clearAllMockData()
                _uiState.value = DeveloperUiState.Success(result.getOrNull() ?: "Dados resetados com sucesso")
            } catch (e: Exception) {
                _uiState.value = DeveloperUiState.Error(e.message ?: "Erro ao resetar dados")
            }
        }
    }

    fun cleanUpData() {
        viewModelScope.launch {
            _uiState.value = DeveloperUiState.Loading
            try {
                val resultGames = MockDataHelper.cleanUpInvalidGames()
                val resultStats = MockDataHelper.cleanUpMockStats()
                val resultInvites = MockDataHelper.cleanUpPendingInvitesAndSummons()
                
                val msg1 = resultGames.getOrNull() ?: "Jogos ok"
                val msg2 = resultStats.getOrNull() ?: "Stats erro"
                val msg3 = resultInvites.getOrNull() ?: "Invites ok"
                
                _uiState.value = DeveloperUiState.Success("$msg1\n$msg2\n$msg3")
            } catch (e: Exception) {
                 _uiState.value = DeveloperUiState.Error(e.message ?: "Erro na limpeza")
            }
        }
    }

    fun populateFieldsForAllLocations() {
        viewModelScope.launch {
            _uiState.value = DeveloperUiState.Loading
            try {
                locationSeeder.seedFieldsForAllLocations(viewModelScope)
                _uiState.value = DeveloperUiState.Success("Quadras adicionadas com sucesso aos locais!")
            } catch (e: Exception) {
                _uiState.value = DeveloperUiState.Error(e.message ?: "Erro ao popular quadras")
            }
        }
    }

    fun analyzeFirestore() {
        viewModelScope.launch {
            _uiState.value = DeveloperUiState.Loading
            try {
                val report = com.futebadosparcas.util.FirestoreAnalyzer.analyzeDatabase()
                val formattedReport = com.futebadosparcas.util.FirestoreAnalyzer.formatReport(report)
                
                // Log do relatório completo
                com.futebadosparcas.util.AppLogger.i("FirestoreAnalysis") { formattedReport }
                
                _uiState.value = DeveloperUiState.Success(
                    "Análise concluída! Verifique o Logcat para ver o relatório completo."
                )
            } catch (e: Exception) {
                _uiState.value = DeveloperUiState.Error(e.message ?: "Erro ao analisar Firestore")
            }
        }
    }
}

sealed class DeveloperUiState {
    object Idle : DeveloperUiState()
    object Loading : DeveloperUiState()
    data class Success(val message: String) : DeveloperUiState()
    data class Error(val message: String) : DeveloperUiState()
}
