package com.futebadosparcas.ui.publicgames

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

data class PublicGame(
    val id: String = "",
    val locationName: String = "",
    val locationAddress: String = "",
    val date: String = "",
    val time: String = "",
    val fieldType: String = "",
    val playersCount: Int = 0,
    val maxPlayers: Int = 0
)

sealed class PublicGamesUiState {
    data object Loading : PublicGamesUiState()
    data class Success(val games: List<PublicGame>) : PublicGamesUiState()
    data object Empty : PublicGamesUiState()
    data class Error(val message: String) : PublicGamesUiState()
}

sealed class JoinGameState {
    data object Idle : JoinGameState()
    data object Loading : JoinGameState()
    data object Success : JoinGameState()
    data class Error(val message: String) : JoinGameState()
}

class PublicGamesViewModel(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions
) : ViewModel() {

    private val _uiState = MutableStateFlow<PublicGamesUiState>(PublicGamesUiState.Loading)
    val uiState: StateFlow<PublicGamesUiState> = _uiState.asStateFlow()

    private val _joinState = MutableStateFlow<JoinGameState>(JoinGameState.Idle)
    val joinState: StateFlow<JoinGameState> = _joinState.asStateFlow()

    private var loadJob: Job? = null
    private var joinJob: Job? = null

    init {
        load()
    }

    fun load() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = PublicGamesUiState.Loading
            try {
                val today = java.time.LocalDate.now().toString()
                val games = firestore.collection("games")
                    .whereEqualTo("is_public", true)
                    .whereEqualTo("visibility", "PUBLIC_OPEN")
                    .whereEqualTo("status", "SCHEDULED")
                    .whereGreaterThanOrEqualTo("dateTime", Timestamp.now())
                    .orderBy("dateTime")
                    .limit(50)
                    .get()
                    .await()

                val result = games.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val date = data["date"] as? String ?: ""
                    if (date < today) return@mapNotNull null
                    PublicGame(
                        id = doc.id,
                        locationName = data["location_name"] as? String ?: "",
                        locationAddress = data["location_address"] as? String ?: "",
                        date = data["date"] as? String ?: "",
                        time = data["time"] as? String ?: "",
                        fieldType = data["field_type"] as? String ?: "SOCIETY",
                        playersCount = (data["players_count"] as? Long)?.toInt() ?: 0,
                        maxPlayers = (data["max_players"] as? Long)?.toInt() ?: 0
                    )
                }

                _uiState.value = if (result.isEmpty()) PublicGamesUiState.Empty
                else PublicGamesUiState.Success(result)
            } catch (e: Exception) {
                _uiState.value = PublicGamesUiState.Error(
                    e.message ?: "Erro ao carregar peladas"
                )
            }
        }
    }

    fun joinGame(gameId: String, userId: String) {
        _joinState.value = JoinGameState.Loading
        joinJob?.cancel()
        joinJob = viewModelScope.launch {
            try {
                if (userId.isBlank() || auth.currentUser?.uid.isNullOrBlank()) {
                    error("Usuário não autenticado")
                }

                functions
                    .getHttpsCallable("joinPublicGame")
                    .call(
                        mapOf(
                            "gameId" to gameId,
                            "position" to "FIELD",
                            "isCasualPlayer" to false
                        )
                    )
                    .await()
                _joinState.value = JoinGameState.Success
                load()
            } catch (e: Exception) {
                _joinState.value = JoinGameState.Error(
                    e.message ?: "Erro ao entrar na pelada"
                )
            }
        }
    }

    override fun onCleared() {
        loadJob?.cancel()
        joinJob?.cancel()
        super.onCleared()
    }
}
