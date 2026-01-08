package com.futebadosparcas.ui.profile

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.AutoRatings
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.model.PerformanceRatingCalculator
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.data.repository.LocationRepository
import com.futebadosparcas.data.repository.UserRepository
import com.futebadosparcas.data.repository.UserRepositoryLegacy
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.abs

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val userRepositoryLegacy: UserRepositoryLegacy,
    private val authRepository: AuthRepository,
    private val gameRepository: GameRepository,
    private val liveGameRepository: LiveGameRepository,
    private val locationRepository: LocationRepository,
    private val gamificationRepository: com.futebadosparcas.data.repository.GamificationRepository,
    private val statisticsRepository: com.futebadosparcas.data.repository.IStatisticsRepository,
    private val preferencesManager: com.futebadosparcas.util.PreferencesManager,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : ViewModel() {

    private val _uiEvents = kotlinx.coroutines.channels.Channel<ProfileUiEvent>()
    val uiEvents = _uiEvents.receiveAsFlow()

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    val uiState: StateFlow<ProfileUiState> = _uiState

    private val _myLocations = MutableStateFlow<List<Location>>(emptyList())
    val myLocations: StateFlow<List<Location>> = _myLocations

    private var statisticsListener: com.google.firebase.firestore.ListenerRegistration? = null

    fun loadProfile() {
        // Remover listener anterior para evitar race condition ao recarregar
        statisticsListener?.remove()
        statisticsListener = null

        viewModelScope.launch {
            if (_uiState.value !is ProfileUiState.Success) {
                _uiState.value = ProfileUiState.Loading
            }

            val result = userRepository.getCurrentUser()

            result.fold(
                onSuccess = { user ->
                    val badgesResult = gamificationRepository.getUserBadges(user.id)
                    val badges = badgesResult.getOrNull() ?: emptyList()

                    // Carregar estatísticas
                    val statsResult = statisticsRepository.getUserStatistics(user.id)
                    val stats = statsResult.getOrNull()

                    _uiState.value = ProfileUiState.Success(user, badges, stats, isDevModeEnabled())
                    _uiEvents.send(ProfileUiEvent.LoadComplete)

                    // Iniciar listener de tempo real para estatísticas
                    setupStatisticsRealTimeListener(user.id)
                    maybeUpdateAutoRatings(user, stats)

                    // Carregar locais se o usuário for dono de quadra
                    if (user.isFieldOwner()) {
                        loadMyLocations(user.id)
                    }
                },
                onFailure = { error ->
                    _uiState.value = ProfileUiState.Error(error.message ?: "Erro ao carregar perfil")
                    _uiEvents.send(ProfileUiEvent.LoadComplete)
                }
            )
        }
    }

    private fun loadMyLocations(userId: String) {
        viewModelScope.launch {
            locationRepository.getLocationsByOwner(userId).onSuccess { locations ->
                _myLocations.value = locations
            }
        }
    }

    private fun setupStatisticsRealTimeListener(userId: String) {
        // Remover listener anterior se existir
        statisticsListener?.remove()

        // Configurar novo listener para atualizações em tempo real
        statisticsListener = firestore.collection("statistics")
            .document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    try {
                        val updatedStats = snapshot.toObject(com.futebadosparcas.data.model.UserStatistics::class.java)
                        val currentState = _uiState.value

                        if (currentState is ProfileUiState.Success && updatedStats != null) {
                            _uiState.value = currentState.copy(statistics = updatedStats)
                            maybeUpdateAutoRatings(currentState.user, updatedStats)
                        }
                    } catch (e: Exception) {
                        // Ignorar erros de parsing
                    }
                }
            }
    }

    fun updateProfile(
        name: String,
        nickname: String?,
        preferredFieldTypes: List<FieldType>,
        photoUri: Uri?,
        strikerRating: Double,
        midRating: Double,
        defenderRating: Double,
        gkRating: Double,
        birthDate: java.util.Date?,
        gender: String?,
        heightCm: Int?,
        weightKg: Int?,
        dominantFoot: String?,
        primaryPosition: String?,
        secondaryPosition: String?,
        playStyle: String?,
        experienceYears: Int?
    ) {
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading

            // Atualizar perfil com tudo de uma vez (foto, dados e ratings)
            val profileResult = userRepositoryLegacy.updateProfile(
                name,
                nickname,
                preferredFieldTypes,
                photoUri,
                strikerRating,
                midRating,
                defenderRating,
                gkRating,
                birthDate,
                gender,
                heightCm,
                weightKg,
                dominantFoot,
                primaryPosition,
                secondaryPosition,
                playStyle,
                experienceYears
            )

            profileResult.fold(
                onSuccess = { legacyUser ->
                    // Converter de data.model.User para domain.model.User
                    val domainUser = com.futebadosparcas.domain.model.User(
                        id = legacyUser.id,
                        email = legacyUser.email,
                        name = legacyUser.name,
                        phone = legacyUser.phone,
                        nickname = legacyUser.nickname,
                        photoUrl = legacyUser.photoUrl,
                        fcmToken = legacyUser.fcmToken,
                        isSearchable = legacyUser.isSearchable,
                        isProfilePublic = legacyUser.isProfilePublic,
                        role = legacyUser.role,
                        createdAt = legacyUser.createdAt?.time,
                        updatedAt = legacyUser.updatedAt?.time,
                        strikerRating = legacyUser.strikerRating,
                        midRating = legacyUser.midRating,
                        defenderRating = legacyUser.defenderRating,
                        gkRating = legacyUser.gkRating,
                        preferredPosition = legacyUser.preferredPosition,
                        preferredFieldTypes = legacyUser.preferredFieldTypes.map {
                            com.futebadosparcas.domain.model.FieldType.valueOf(it.name)
                        },
                        birthDate = legacyUser.birthDate?.time,
                        gender = legacyUser.gender,
                        heightCm = legacyUser.heightCm,
                        weightKg = legacyUser.weightKg,
                        dominantFoot = legacyUser.dominantFoot,
                        primaryPosition = legacyUser.primaryPosition,
                        secondaryPosition = legacyUser.secondaryPosition,
                        playStyle = legacyUser.playStyle,
                        experienceYears = legacyUser.experienceYears,
                        level = legacyUser.level,
                        experiencePoints = legacyUser.experiencePoints,
                        milestonesAchieved = legacyUser.milestonesAchieved,
                        autoStrikerRating = legacyUser.autoStrikerRating,
                        autoMidRating = legacyUser.autoMidRating,
                        autoDefenderRating = legacyUser.autoDefenderRating,
                        autoGkRating = legacyUser.autoGkRating,
                        autoRatingSamples = legacyUser.autoRatingSamples
                    )
                    _uiState.value = ProfileUiState.ProfileUpdateSuccess(domainUser)
                },
                onFailure = { error ->
                    _uiState.value = ProfileUiState.Error(error.message ?: "Erro ao atualizar perfil")
                }
            )
        }
    }

    fun logout() {
        authRepository.logout()
        _uiState.value = ProfileUiState.LoggedOut
    }

    fun resetAllData() {
        viewModelScope.launch {
            gameRepository.clearAll()
            liveGameRepository.clearAll()
            _uiState.value = ProfileUiState.DataReset
        }
    }

    fun enableDevMode() {
        preferencesManager.setDevModeEnabled(true)
        val currentState = _uiState.value
        if (currentState is ProfileUiState.Success) {
            _uiState.value = currentState.copy(isDevMode = true)
        }
    }

    fun isDevModeEnabled(): Boolean {
        return preferencesManager.isDevModeEnabled()
    }

    private fun maybeUpdateAutoRatings(user: User, stats: com.futebadosparcas.data.model.UserStatistics?) {
        if (stats == null || stats.totalGames < 3) return

        val autoRatings = PerformanceRatingCalculator.fromStats(stats)
        if (!shouldUpdateAutoRatings(user, autoRatings)) return

        viewModelScope.launch {
            val result = userRepositoryLegacy.updateAutoRatings(
                autoRatings.striker,
                autoRatings.mid,
                autoRatings.defender,
                autoRatings.gk,
                autoRatings.sampleSize
            )

            if (result.isSuccess) {
                updateUserStateWithAutoRatings(autoRatings)
            }
        }
    }

    private fun shouldUpdateAutoRatings(user: User, auto: AutoRatings): Boolean {
        if (auto.sampleSize <= 0) return false
        if (auto.sampleSize >= user.autoRatingSamples + 3) return true

        val delta = maxOf(
            abs(user.autoStrikerRating - auto.striker),
            abs(user.autoMidRating - auto.mid),
            abs(user.autoDefenderRating - auto.defender),
            abs(user.autoGkRating - auto.gk)
        )
        return delta >= 0.3
    }

    private fun updateUserStateWithAutoRatings(auto: AutoRatings) {
        val currentState = _uiState.value
        if (currentState is ProfileUiState.Success) {
            val updatedUser = currentState.user.copy(
                autoStrikerRating = auto.striker,
                autoMidRating = auto.mid,
                autoDefenderRating = auto.defender,
                autoGkRating = auto.gk,
                autoRatingSamples = auto.sampleSize
            )
            _uiState.value = currentState.copy(user = updatedUser)
        }
    }

    override fun onCleared() {
        super.onCleared()
        // Remover listener de tempo real ao destruir o ViewModel
        statisticsListener?.remove()
        // Fechar Channel para evitar memory leak
        _uiEvents.close()
    }
}

sealed class ProfileUiState {
    object Loading : ProfileUiState()
    data class Success(
        val user: User, 
        val badges: List<com.futebadosparcas.data.model.UserBadge>,
        val statistics: com.futebadosparcas.data.model.UserStatistics?,
        val isDevMode: Boolean
    ) : ProfileUiState()
    data class ProfileUpdateSuccess(val user: User) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
    object LoggedOut : ProfileUiState()
    object DataReset : ProfileUiState()
}

sealed class ProfileUiEvent {
    object LoadComplete : ProfileUiEvent()
}
