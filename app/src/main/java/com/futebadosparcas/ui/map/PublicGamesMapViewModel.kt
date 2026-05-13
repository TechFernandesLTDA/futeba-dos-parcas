package com.futebadosparcas.ui.map

import androidx.lifecycle.ViewModel
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class PublicGamesMapViewModel(
    private val firestore: FirebaseFirestore
) : ViewModel() {

    private val _uiState = MutableStateFlow<PublicGamesMapUiState>(PublicGamesMapUiState.Loading)
    val uiState: StateFlow<PublicGamesMapUiState> = _uiState.asStateFlow()

    private var gamesListener: ListenerRegistration? = null

    init {
        loadPublicGames()
    }

    fun loadPublicGames() {
        gamesListener?.remove()
        _uiState.value = PublicGamesMapUiState.Loading

        gamesListener = firestore.collection(Game.COLLECTION)
            .whereEqualTo("is_public", true)
            .whereIn("status", listOf("SCHEDULED", "CONFIRMED"))
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e("PublicGamesMapVM", "Error listening to public games", error)
                    _uiState.value = PublicGamesMapUiState.Error(
                        error.message ?: "Erro ao carregar jogos"
                    )
                    return@addSnapshotListener
                }

                val games = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Game::class.java)
                } ?: emptyList()

                _uiState.value = if (games.isEmpty()) {
                    PublicGamesMapUiState.Empty
                } else {
                    val markers = games.map { game ->
                        MapGameMarker(
                            gameId = game.id,
                            title = game.fieldName.ifBlank { game.locationName },
                            locationName = game.locationName,
                            latitude = game.locationLat ?: 0.0,
                            longitude = game.locationLng ?: 0.0,
                            dateTime = "${game.date} ${game.time}",
                            confirmedPlayers = game.playersCount,
                            maxPlayers = game.maxPlayers,
                            price = game.dailyPrice,
                            gameType = game.gameType,
                            hasVacancies = game.playersCount < game.maxPlayers
                        )
                    }
                    PublicGamesMapUiState.Success(markers)
                }
            }
    }

    override fun onCleared() {
        super.onCleared()
        gamesListener?.remove()
    }
}

sealed class PublicGamesMapUiState {
    object Loading : PublicGamesMapUiState()
    data class Success(val games: List<MapGameMarker>) : PublicGamesMapUiState()
    object Empty : PublicGamesMapUiState()
    data class Error(val message: String) : PublicGamesMapUiState()
}
