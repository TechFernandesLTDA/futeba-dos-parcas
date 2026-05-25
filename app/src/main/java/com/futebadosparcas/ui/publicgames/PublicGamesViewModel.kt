package com.futebadosparcas.ui.publicgames

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ktx.toObjects
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.google.firebase.firestore.FieldValue

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
    private val firestore: FirebaseFirestore
) : ViewModel() {

    private val _uiState = MutableStateFlow<PublicGamesUiState>(PublicGamesUiState.Loading)
    val uiState: StateFlow<PublicGamesUiState> = _uiState.asStateFlow()

    private val _joinState = MutableStateFlow<JoinGameState>(JoinGameState.Idle)
    val joinState: StateFlow<JoinGameState> = _joinState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = PublicGamesUiState.Loading
            try {
                val today = java.time.LocalDate.now().toString()
                val games = firestore.collection("games")
                    .whereEqualTo("is_public", true)
                    .whereEqualTo("visibility", "PUBLIC_OPEN")
                    .whereEqualTo("status", "SCHEDULED")
                    .whereGreaterThanOrEqualTo("date", today)
                    .orderBy("date")
                    .limit(50)
                    .get()
                    .await()

                val result = games.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
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
        viewModelScope.launch {
            try {
                firestore.collection("games").document(gameId)
                    .update(
                        "players", FieldValue.arrayUnion(userId),
                        "players_count", FieldValue.increment(1)
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
}
