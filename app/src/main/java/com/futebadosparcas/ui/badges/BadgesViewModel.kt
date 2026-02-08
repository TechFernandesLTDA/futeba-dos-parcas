package com.futebadosparcas.ui.badges

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.data.model.UserBadge
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * ViewModel da tela de Badges/Conquistas.
 *
 * OTIMIZACOES APLICADAS:
 * - Cache in-memory de 2 minutos para evitar re-fetch ao navegar de volta
 * - Batch fetch de badges (whereIn chunked) em vez de N+1 queries sequenciais
 * - async/awaitAll para queries paralelas em chunks
 */
@HiltViewModel
class BadgesViewModel @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val authRepository: AuthRepository,
    private val firestore: FirebaseFirestore
) : ViewModel() {

    companion object {
        private const val TAG = "BadgesViewModel"
        private const val CACHE_DURATION_MS = 120_000L // 2 minutos de cache
    }

    private val _uiState = MutableStateFlow<BadgesUiState>(BadgesUiState.Loading)
    val uiState: StateFlow<BadgesUiState> = _uiState

    private var loadJob: Job? = null

    // Cache in-memory para evitar queries repetidas ao navegar de volta
    private var cachedState: BadgesUiState.Success? = null
    private var lastLoadTime: Long = 0

    init {
        loadBadges()
    }

    /**
     * Carrega badges do usuario com dados completos.
     *
     * OTIMIZACAO P2 #28: Cache in-memory de 2 minutos.
     * OTIMIZACAO P1 Network #1: Batch fetch via whereIn (N+1 → 1-2 queries).
     *
     * @param forceRefresh Se true, ignora o cache e busca dados frescos.
     */
    fun loadBadges(forceRefresh: Boolean = false) {
        // Verificar cache antes de buscar do servidor
        val now = System.currentTimeMillis()
        val cached = cachedState
        if (!forceRefresh && cached != null && (now - lastLoadTime) < CACHE_DURATION_MS) {
            AppLogger.d(TAG) { "Cache HIT para badges (age=${now - lastLoadTime}ms)" }
            _uiState.value = cached
            return
        }

        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = BadgesUiState.Loading

            try {
                val userId = authRepository.getCurrentUserId()
                if (userId == null) {
                    _uiState.value = BadgesUiState.Error("Usuário não autenticado")
                    return@launch
                }

                // Buscar badges conquistadas pelo usuario
                val userBadgesResult = gamificationRepository.getUserBadges(userId)
                val userBadges = userBadgesResult.getOrElse { emptyList() }

                if (userBadges.isEmpty()) {
                    _uiState.value = BadgesUiState.Empty
                    return@launch
                }

                // OTIMIZACAO: Batch fetch de badge definitions via whereIn (chunks de 10)
                // Antes: N queries sequenciais (1 por badge) = 200-500ms cada = 2-5s total
                // Depois: ceil(N/10) queries paralelas = 100-200ms total
                val badgeIds = userBadges.map { it.badgeId }.distinct()
                val badgeDefinitions = fetchBadgeDefinitionsBatch(badgeIds)

                // Montar BadgeWithData combinando user badges com definitions
                val badgesWithData = userBadges.mapNotNull { userBadge ->
                    val badge = badgeDefinitions[userBadge.badgeId] ?: return@mapNotNull null
                    val dataUserBadge = com.futebadosparcas.data.model.UserBadge(
                        id = userBadge.id,
                        userId = userBadge.userId,
                        badgeId = userBadge.badgeId,
                        unlockedAt = userBadge.unlockedAt?.let { java.util.Date(it) }
                    )
                    BadgeWithData(userBadge = dataUserBadge, badge = badge)
                }

                if (badgesWithData.isEmpty()) {
                    _uiState.value = BadgesUiState.Empty
                } else {
                    val successState = BadgesUiState.Success(
                        allBadges = badgesWithData,
                        filteredBadges = badgesWithData,
                        totalUnlocked = badgesWithData.size,
                        selectedCategory = null
                    )
                    _uiState.value = successState

                    // Salvar no cache
                    cachedState = successState
                    lastLoadTime = System.currentTimeMillis()
                    AppLogger.d(TAG) { "Cache PUT para badges (${badgesWithData.size} itens)" }
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar badges", e)
                _uiState.value = BadgesUiState.Error("Erro ao carregar conquistas: ${e.message}")
            }
        }
    }

    /**
     * Busca definicoes de badges em batch usando whereIn (chunks de 10).
     * Substitui N queries sequenciais por ceil(N/10) queries paralelas.
     *
     * @return Map de badgeId -> Badge definition
     */
    private suspend fun fetchBadgeDefinitionsBatch(badgeIds: List<String>): Map<String, Badge> {
        if (badgeIds.isEmpty()) return emptyMap()

        val results = mutableMapOf<String, Badge>()

        // Usar coroutineScope para structured concurrency
        // (garante que children sao cancelados se o caller for cancelado)
        coroutineScope {
            val deferredChunks = badgeIds.chunked(10).map { chunk ->
                async {
                    try {
                        val snapshot = firestore.collection("badges")
                            .whereIn(FieldPath.documentId(), chunk)
                            .get()
                            .await()

                        snapshot.documents.mapNotNull { doc ->
                            val badge = doc.toObject(Badge::class.java)
                            if (badge != null) doc.id to badge else null
                        }
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao buscar batch de badges", e)
                        emptyList()
                    }
                }
            }

            // Aguardar todos os chunks em paralelo
            deferredChunks.awaitAll().forEach { pairs ->
                pairs.forEach { (id, badge) -> results[id] = badge }
            }
        }

        return results
    }

    /**
     * Filtra badges por categoria
     */
    fun filterByCategory(category: BadgeCategory?) {
        val currentState = _uiState.value
        if (currentState is BadgesUiState.Success) {
            val filteredBadges = if (category == null) {
                currentState.allBadges
            } else {
                currentState.allBadges.filter { badgeWithData ->
                    getCategoryForBadgeType(badgeWithData.badge.type) == category
                }
            }

            _uiState.value = currentState.copy(
                filteredBadges = filteredBadges,
                selectedCategory = category
            )
        }
    }

    /**
     * Retorna a categoria de uma badge baseado no tipo
     */
    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }

    private fun getCategoryForBadgeType(type: BadgeType): BadgeCategory {
        return when (type) {
            BadgeType.HAT_TRICK,
            BadgeType.PAREDAO,
            BadgeType.ARTILHEIRO_MES -> BadgeCategory.PERFORMANCE

            BadgeType.FOMINHA,
            BadgeType.STREAK_7,
            BadgeType.STREAK_30 -> BadgeCategory.PRESENCA

            BadgeType.ORGANIZADOR_MASTER,
            BadgeType.INFLUENCER -> BadgeCategory.COMUNIDADE

            BadgeType.LENDA,
            BadgeType.FAIXA_PRETA,
            BadgeType.MITO -> BadgeCategory.NIVEL
        }
    }
}

/**
 * Estados da UI da tela de Badges
 */
sealed class BadgesUiState {
    object Loading : BadgesUiState()
    object Empty : BadgesUiState()
    data class Error(val message: String) : BadgesUiState()
    data class Success(
        val allBadges: List<BadgeWithData>,
        val filteredBadges: List<BadgeWithData>,
        val totalUnlocked: Int,
        val selectedCategory: BadgeCategory?
    ) : BadgesUiState()
}

/**
 * Badge com dados completos
 */
data class BadgeWithData(
    val userBadge: UserBadge,
    val badge: Badge
)

/**
 * Categorias de badges
 */
enum class BadgeCategory(val displayName: String) {
    PERFORMANCE("Desempenho"),
    PRESENCA("Presença"),
    COMUNIDADE("Comunidade"),
    NIVEL("Nível")
}
