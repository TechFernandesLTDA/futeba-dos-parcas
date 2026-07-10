package com.futebadosparcas.ui.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.RealtimeTelemetry
import com.futebadosparcas.util.RealtimeTelemetryFlow
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/** Bounds simples, inclusive, com suporte a viewport que cruza o antimeridiano. */
data class MapViewport(
    val north: Double,
    val south: Double,
    val east: Double,
    val west: Double
) {
    fun contains(latitude: Double, longitude: Double): Boolean {
        if (latitude !in south..north) return false
        return if (west <= east) longitude in west..east
        else longitude >= west || longitude <= east
    }
}

internal fun mergeGameMarkers(
    preferred: List<MapGameMarker>,
    additional: List<MapGameMarker>
): List<MapGameMarker> = (preferred + additional)
    .distinctBy { it.gameId }
    .sortedBy { it.gameId }

internal fun filterGameMarkersForViewport(
    games: List<MapGameMarker>,
    viewport: MapViewport?
): List<MapGameMarker> = viewport?.let { bounds ->
    games.filter { bounds.contains(it.latitude, it.longitude) }
} ?: games

class PublicGamesMapViewModel(
    private val firestore: FirebaseFirestore,
    private val realtimeTelemetry: RealtimeTelemetry = RealtimeTelemetry.disabled()
) : ViewModel() {

    private val _uiState = MutableStateFlow<PublicGamesMapUiState>(PublicGamesMapUiState.Loading)
    val uiState: StateFlow<PublicGamesMapUiState> = _uiState.asStateFlow()

    private var gamesListener: ListenerRegistration? = null
    private var loadMoreJob: Job? = null
    private var firstPage = emptyList<MapGameMarker>()
    private var history = emptyList<MapGameMarker>()
    private var cursor: DocumentSnapshot? = null
    private var viewport: MapViewport? = null
    private var hasMore = false
    private val realtimeTracker = realtimeTelemetry.tracker(RealtimeTelemetryFlow.PUBLIC_GAMES_MAP)

    init {
        loadPublicGames()
    }

    /**
     * Primeira pagina realtime. A ordenacao por documentId e compativel com o
     * schema atual e evita um hard cap silencioso; paginas seguintes sao explicitas.
     */
    fun loadPublicGames() {
        when (_uiState.value) {
            is PublicGamesMapUiState.Error -> realtimeTracker.startReconnect()
            PublicGamesMapUiState.Loading -> Unit
            else -> realtimeTracker.startApply()
        }
        gamesListener?.remove()
        loadMoreJob?.cancel()
        firstPage = emptyList()
        history = emptyList()
        cursor = null
        hasMore = false
        _uiState.value = PublicGamesMapUiState.Loading

        gamesListener = baseQuery().addSnapshotListener { snapshot, error ->
            if (error != null) {
                realtimeTracker.recordError()
                AppLogger.e(TAG, "Error listening to public games", error)
                _uiState.value = PublicGamesMapUiState.Error(
                    error.message ?: "Erro ao carregar jogos"
                )
                return@addSnapshotListener
            }

            val documents = snapshot?.documents.orEmpty()
            firstPage = documents.mapNotNull { it.toMarker() }
            cursor = documents.lastOrNull()
            hasMore = documents.size == PAGE_SIZE.toInt()
            realtimeTracker.recordApply()
            render()
        }
    }

    fun loadMore() {
        val pageCursor = cursor ?: return
        if (!hasMore || loadMoreJob?.isActive == true) return
        realtimeTracker.startApply()
        render(isLoadingMore = true)
        loadMoreJob = viewModelScope.launch {
            runCatching {
                baseQuery().startAfter(pageCursor).get().await().documents
            }.onSuccess { documents ->
                realtimeTracker.recordApply()
                history = mergeGameMarkers(history, documents.mapNotNull { it.toMarker() })
                cursor = documents.lastOrNull() ?: cursor
                hasMore = documents.size == PAGE_SIZE.toInt()
                render()
            }.onFailure { error ->
                realtimeTracker.recordError()
                AppLogger.e(TAG, "Error loading more public games", error)
                val loaded = mergeGameMarkers(firstPage, history)
                _uiState.value = if (loaded.isEmpty()) {
                    PublicGamesMapUiState.Error(error.message ?: "Erro ao carregar jogos")
                } else {
                    PublicGamesMapUiState.Success(
                        games = filterGameMarkersForViewport(loaded, viewport),
                        hasMore = hasMore,
                        loadMoreError = error.message
                    )
                }
            }
        }
    }

    /** Pode ser conectado ao camera-idle sem nova leitura ou perda do cursor. */
    fun updateViewport(bounds: MapViewport?) {
        viewport = bounds
        render()
    }

    private fun baseQuery(): Query = firestore.collection(Game.COLLECTION)
        .whereEqualTo("is_public", true)
        .whereIn("status", listOf("SCHEDULED", "CONFIRMED"))
        .orderBy(FieldPath.documentId())
        .limit(PAGE_SIZE)

    private fun DocumentSnapshot.toMarker(): MapGameMarker? {
        val game = toObject(Game::class.java)?.let { parsed ->
            if (parsed.id.isBlank()) parsed.copy(id = id) else parsed
        } ?: return null
        val latitude = game.locationLat ?: return null
        val longitude = game.locationLng ?: return null
        return MapGameMarker(
            gameId = game.id,
            title = game.fieldName.ifBlank { game.locationName },
            locationName = game.locationName,
            latitude = latitude,
            longitude = longitude,
            dateTime = "${game.date} ${game.time}",
            confirmedPlayers = game.playersCount,
            maxPlayers = game.maxPlayers,
            price = game.dailyPrice,
            gameType = game.gameType,
            hasVacancies = game.playersCount < game.maxPlayers
        )
    }

    private fun render(isLoadingMore: Boolean = false) {
        val loaded = mergeGameMarkers(firstPage, history)
        _uiState.value = if (loaded.isEmpty()) {
            PublicGamesMapUiState.Empty
        } else {
            PublicGamesMapUiState.Success(
                games = filterGameMarkersForViewport(loaded, viewport),
                hasMore = hasMore,
                isLoadingMore = isLoadingMore
            )
        }
    }

    override fun onCleared() {
        gamesListener?.remove()
        loadMoreJob?.cancel()
        super.onCleared()
    }

    companion object {
        private const val TAG = "PublicGamesMapVM"
        internal const val PAGE_SIZE = 200L
    }
}

sealed class PublicGamesMapUiState {
    data object Loading : PublicGamesMapUiState()
    data class Success(
        val games: List<MapGameMarker>,
        val hasMore: Boolean = false,
        val isLoadingMore: Boolean = false,
        val loadMoreError: String? = null
    ) : PublicGamesMapUiState()
    data object Empty : PublicGamesMapUiState()
    data class Error(val message: String) : PublicGamesMapUiState()
}
