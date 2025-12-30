package com.futebadosparcas.ui.badges

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.data.model.UserBadge
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GamificationRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * ViewModel da tela de Badges/Conquistas
 */
@HiltViewModel
class BadgesViewModel @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val authRepository: AuthRepository,
    private val firestore: FirebaseFirestore
) : ViewModel() {

    companion object {
        private const val TAG = "BadgesViewModel"
    }

    private val _uiState = MutableStateFlow<BadgesUiState>(BadgesUiState.Loading)
    val uiState: StateFlow<BadgesUiState> = _uiState

    init {
        loadBadges()
    }

    /**
     * Carrega badges do usuário com dados completos
     */
    fun loadBadges() {
        viewModelScope.launch {
            _uiState.value = BadgesUiState.Loading

            try {
                val userId = authRepository.getCurrentUserId()
                if (userId == null) {
                    _uiState.value = BadgesUiState.Error("Usuário não autenticado")
                    return@launch
                }

                // Buscar badges conquistadas
                val userBadgesResult = gamificationRepository.getUserBadges(userId)
                val userBadges = userBadgesResult.getOrElse { emptyList() }

                // Buscar dados completos de cada badge
                val badgesWithData = mutableListOf<BadgeWithData>()

                for (userBadge in userBadges) {
                    try {
                        val badgeDoc = firestore.collection("badges")
                            .document(userBadge.badgeId)
                            .get()
                            .await()

                        val badge = badgeDoc.toObject(Badge::class.java)
                        if (badge != null) {
                            badgesWithData.add(
                                BadgeWithData(
                                    userBadge = userBadge,
                                    badge = badge
                                )
                            )
                        }
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao buscar badge ${userBadge.badgeId}", e)
                    }
                }

                _uiState.value = BadgesUiState.Success(
                    allBadges = badgesWithData,
                    filteredBadges = badgesWithData,
                    totalUnlocked = badgesWithData.size,
                    selectedCategory = null
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar badges", e)
                _uiState.value = BadgesUiState.Error("Erro ao carregar conquistas: ${e.message}")
            }
        }
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
