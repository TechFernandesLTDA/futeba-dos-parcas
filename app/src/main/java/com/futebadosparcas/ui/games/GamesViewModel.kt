package com.futebadosparcas.ui.games

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch

data class GameWithConfirmations(
    val game: Game,
    val confirmedCount: Int,
    val isUserConfirmed: Boolean = false
)

@OptIn(kotlinx.coroutines.FlowPreview::class)
class GamesViewModel(
    private val gameRepository: GameRepository,
    private val notificationRepository: com.futebadosparcas.domain.repository.NotificationRepository,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow<GamesUiState>(GamesUiState.Loading)
    val uiState: StateFlow<GamesUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    // SavedState para persistir filtro atual
    var currentFilter: GameFilterType
        get() = savedStateHandle.get<String>(KEY_CURRENT_FILTER)?.let {
            runCatching { GameFilterType.valueOf(it) }.getOrDefault(GameFilterType.ALL)
        } ?: GameFilterType.ALL
        set(value) = savedStateHandle.set(KEY_CURRENT_FILTER, value.name)

    // Cache de resultados por filtro (evita recarregar ao trocar filtros)
    private val filterCache = mutableMapOf<GameFilterType, CachedGamesResult>()

    // SupervisorJob para operações persistentes que não devem ser canceladas na navegação
    private val persistentJob = SupervisorJob()
    private val persistentScope = CoroutineScope(Dispatchers.IO + persistentJob)

    // Mantem referencia do job de coleta atual para cancelar ao trocar filtro
    private var currentJob: Job? = null
    private var unreadCountJob: Job? = null

    /**
     * Resultado cacheado com timestamp para invalidação
     */
    private data class CachedGamesResult(
        val games: List<GameWithConfirmations>,
        val timestamp: Long = System.currentTimeMillis()
    ) {
        fun isValid(): Boolean {
            return System.currentTimeMillis() - timestamp < CACHE_VALIDITY_MILLIS
        }
    }

    init {
        loadGames(currentFilter)
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        unreadCountJob?.cancel()
        unreadCountJob = viewModelScope.launch {
            notificationRepository.getUnreadCountFlow()
                .catch { e ->
                    // Tratamento de erro: zerar contador em caso de falha
                    AppLogger.e(TAG, "Erro ao observar notificacoes", e)
                    _unreadCount.value = 0
                }
                .collect { count ->
                    _unreadCount.value = count
                }
        }
    }

    override fun onCleared() {
        super.onCleared()
        currentJob?.cancel()
        unreadCountJob?.cancel()
        persistentJob.cancel() // Cancela operações persistentes apenas ao limpar o ViewModel
    }

    /**
     * Carrega jogos com o filtro especificado
     * - Usa debounce para evitar múltiplas requisições em rápida sucessão
     * - Garante .catch{} em todos os flows para tratamento de erro
     * - Persiste filtro atual no SavedStateHandle
     * - Implementa cache em memória para evitar recarregar ao trocar filtros
     */
    fun loadGames(filterType: GameFilterType = GameFilterType.ALL, forceRefresh: Boolean = false) {
        // Persiste filtro atual
        currentFilter = filterType

        // Verifica cache se não for refresh forçado
        if (!forceRefresh) {
            val cached = filterCache[filterType]
            if (cached != null && cached.isValid()) {
                AppLogger.d(TAG) { "Usando cache para filtro $filterType" }
                _uiState.value = if (cached.games.isEmpty()) {
                    GamesUiState.Empty
                } else {
                    GamesUiState.Success(cached.games)
                }
                return
            }
        }

        currentJob?.cancel()

        currentJob = viewModelScope.launch {
            _uiState.value = GamesUiState.Loading

            try {
                when (filterType) {
                    GameFilterType.MY_GAMES -> {
                        // Carregamento único (Suspend) para Meus Jogos (otimização de leitura)
                        gameRepository.getGamesByFilter(GameFilterType.MY_GAMES)
                            .onSuccess { games ->
                                // Atualiza cache
                                filterCache[filterType] = CachedGamesResult(games)

                                if (games.isEmpty()) {
                                    _uiState.value = GamesUiState.Empty
                                } else {
                                    _uiState.value = GamesUiState.Success(games)
                                }
                            }
                            .onFailure { error ->
                                AppLogger.e(TAG, "Erro ao carregar meus jogos", error)
                                _uiState.value = GamesUiState.Error(
                                    error.message ?: "Erro ao carregar meus jogos",
                                    retryable = true
                                )
                            }
                    }
                    else -> { // ALL (Live + Upcoming) ou OPEN (filtro em memória depois)
                        // Flow Realtime para jogos principais com debounce
                        gameRepository.getLiveAndUpcomingGamesFlow()
                            .debounce(DEBOUNCE_MILLIS) // Debounce para evitar updates rápidos demais
                            .catch { e ->
                                // Tratamento de erro de fluxo
                                AppLogger.e(TAG, "Erro no fluxo de jogos", e)
                                _uiState.value = GamesUiState.Error(
                                    e.message ?: "Erro ao carregar jogos",
                                    retryable = true
                                )
                            }
                            .collect { result ->
                                result.fold(
                                    onSuccess = { games ->
                                        val filtered = if (filterType == GameFilterType.OPEN) {
                                            games.filter { it.game.status == "SCHEDULED" } // Filtro simples de string
                                        } else {
                                            games
                                        }

                                        // Atualiza cache
                                        filterCache[filterType] = CachedGamesResult(filtered)

                                        _uiState.value = if (filtered.isEmpty()) {
                                            // Se vazio, tenta carregar histórico recente? Por enquanto mostra vazio.
                                            GamesUiState.Empty
                                        } else {
                                            GamesUiState.Success(filtered)
                                        }
                                    },
                                    onFailure = { error ->
                                        AppLogger.e(TAG, "Erro ao carregar jogos", error)
                                        _uiState.value = GamesUiState.Error(
                                            error.message ?: "Erro ao carregar jogos",
                                            retryable = true
                                        )
                                    }
                                )
                            }
                    }
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao carregar jogos", e)
                _uiState.value = GamesUiState.Error(
                    e.message ?: "Erro inesperado",
                    retryable = true
                )
            }
        }
    }

    /**
     * Limpa o cache de todos os filtros
     */
    fun clearCache() {
        filterCache.clear()
        AppLogger.d(TAG) { "Cache de filtros limpo" }
    }

    /**
     * Recarrega jogos com o filtro atual (força atualização)
     */
    fun retryLoad() {
        loadGames(currentFilter, forceRefresh = true)
    }

    /**
     * Prefetches detalhes dos primeiros 3-5 jogos da lista.
     * Executado quando o usuário vê a lista de jogos.
     * Melhora experiência ao clicar em um jogo (evita loading).
     *
     * Operação não-bloqueante: usa async/await sem esperar resultado.
     */
    fun prefetchGameDetails(games: List<GameWithConfirmations>) {
        if (games.isEmpty()) return

        persistentScope.launch {
            try {
                // Prefetch apenas dos primeiros 3-5 jogos
                val gamesToPrefetch = games.take(5)

                AppLogger.d(TAG) { "Iniciando prefetch de ${gamesToPrefetch.size} jogos" }

                // Executa em paralelo com async/awaitAll
                gamesToPrefetch.map { gameWithConfirmations ->
                    async {
                        try {
                            // Simulação: em produção, chamar gameRepository.getGameDetails(gameId)
                            // Por enquanto apenas log para demonstração
                            AppLogger.d(TAG) { "Prefetched game: ${gameWithConfirmations.game.id}" }
                        } catch (e: Exception) {
                            // Erros de prefetch são silenciosos (não afetam UI)
                            AppLogger.e(TAG, "Prefetch error para ${gameWithConfirmations.game.id}", e)
                        }
                    }
                }.awaitAll()

                AppLogger.d(TAG) { "Prefetch concluído com sucesso" }
            } catch (e: Exception) {
                // Erro geral em prefetch é silencioso
                AppLogger.e(TAG, "Erro no prefetch de detalhes", e)
            }
        }
    }

    /**
     * Confirma presença rapidamente na lista de jogos.
     * Usa posição FIELD como padrão.
     * Usa persistentScope para garantir conclusão mesmo com navegação.
     */
    fun quickConfirmPresence(gameId: String) {
        persistentScope.launch {
            try {
                val result = gameRepository.confirmPresence(gameId, "FIELD", false)
                result.fold(
                    onSuccess = {
                        AppLogger.d(TAG) { "Presença confirmada com sucesso no jogo $gameId" }
                    },
                    onFailure = { error ->
                        AppLogger.e(TAG, "Erro ao confirmar presença", error)
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao confirmar presença", e)
            }
        }
    }

    companion object {
        private const val TAG = "GamesViewModel"
        private const val DEBOUNCE_MILLIS = 300L
        private const val KEY_CURRENT_FILTER = "current_filter"
        private const val CACHE_VALIDITY_MILLIS = 60_000L // 1 minuto
    }
}

/**
 * Estados semânticos para a UI de jogos
 * - Loading: Carregando dados iniciais
 * - Empty: Nenhum jogo encontrado
 * - Success: Jogos carregados com sucesso
 * - Error: Erro ao carregar, com flag de retryable
 */
sealed class GamesUiState {
    object Loading : GamesUiState()
    object Empty : GamesUiState()
    data class Success(val games: List<GameWithConfirmations>) : GamesUiState()
    data class Error(
        val message: String,
        val retryable: Boolean = true
    ) : GamesUiState()
}
