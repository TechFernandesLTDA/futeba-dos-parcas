package com.futebadosparcas.ui.profile

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.AutoRatings
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.model.PerformanceRatingCalculator
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.toDataBadges
import com.futebadosparcas.util.toDataLocations
import com.futebadosparcas.util.toDataModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import kotlin.math.abs

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val authRepository: AuthRepository,
    private val gameRepository: GameRepository,
    private val liveGameRepository: LiveGameRepository,
    private val gamificationRepository: GamificationRepository,
    private val statisticsRepository: StatisticsRepository,
    private val locationRepository: LocationRepository,
    private val preferencesManager: com.futebadosparcas.util.PreferencesManager,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage
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

            userRepository.observeCurrentUser().collect { user ->
                if (user != null) {
                    // Buscar badges do repositório de domínio e converter para modelo de dados
                    val badgesResult = gamificationRepository.getUserBadges(user.id)
                    val badges = badgesResult.getOrNull()?.toDataBadges() ?: emptyList()

                    // Carregar estatísticas do repositório de domínio e converter para modelo de dados
                    val statsResult = statisticsRepository.getUserStatistics(user.id)
                    val stats = statsResult.getOrNull()?.toDataModel(user.id)

                    _uiState.value = ProfileUiState.Success(user, badges, stats, isDevModeEnabled())

                    // Se esta é a primeira carga ou atualização, envie o evento
                    // Note: Em um fluxo contínuo, talvez não queiramos enviar LoadComplete a cada pequena mudança,
                    // mas para garantir que a UI pare de carregar na primeira vez, é útil.
                    if (_uiEvents.trySend(ProfileUiEvent.LoadComplete).isSuccess) {
                         // Event sent
                    }

                    // Iniciar listener de tempo real para estatísticas (se ainda não estiver ativo ou se o user mudar)
                    // Nota: O setupStatisticsRealTimeListener cuida de remover o anterior.
                    setupStatisticsRealTimeListener(user.id)
                    maybeUpdateAutoRatings(user, stats)

                    // Carregar locais se o usuário for dono de quadra
                    if (user.isFieldOwner()) {
                        loadMyLocations(user.id)
                    }
                } else {
                    // Se user for null (não logado ou erro), tratar conforme necessário.
                    // Se o estado anterior era Success/Loading, podemos cair aqui num logout.
                    // Por enquanto, não vamos forçar erro se apenas estiver recarregando, mas se for nulo persistentemente, é um problema.
                }
            }
        }
    }

    private fun loadMyLocations(userId: String) {
        viewModelScope.launch {
            locationRepository.getLocationsByOwner(userId).onSuccess { locations ->
                _myLocations.value = locations.toDataLocations()
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
        android.util.Log.d("ProfileViewModel", "updateProfile called.")
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading

            try {
                // Obter usuário atual
                val currentUserResult = userRepository.getCurrentUser()
                val currentUser = currentUserResult.getOrNull()

                if (currentUser == null) {
                    _uiState.value = ProfileUiState.Error("Usuário não encontrado")
                    return@launch
                }

                // Upload de foto se fornecida
                var photoUrl: String? = currentUser.photoUrl
                if (photoUri != null) {
                    try {
                        val userId = currentUser.id
                        val photoRef = storage.reference.child("profile_photos/$userId.jpg")
                        photoRef.putFile(photoUri).await()
                        val urlResult = photoRef.downloadUrl.await()
                        photoUrl = urlResult.toString()
                    } catch (e: Exception) {
                        android.util.Log.e("ProfileViewModel", "Erro ao fazer upload de foto", e)
                        // Continuar sem foto se o upload falhar
                    }
                }

                // Criar usuário atualizado
                val updatedUser = currentUser.copy(
                    name = name,
                    nickname = nickname,
                    photoUrl = photoUrl,
                    strikerRating = strikerRating,
                    midRating = midRating,
                    defenderRating = defenderRating,
                    gkRating = gkRating,
                    preferredPosition = primaryPosition,
                    primaryPosition = primaryPosition,
                    secondaryPosition = secondaryPosition,
                    playStyle = playStyle,
                    experienceYears = experienceYears,
                    birthDate = birthDate?.time,
                    gender = gender,
                    heightCm = heightCm,
                    weightKg = weightKg,
                    dominantFoot = dominantFoot,
                    preferredFieldTypes = preferredFieldTypes.map {
                        try {
                            com.futebadosparcas.domain.model.FieldType.valueOf(it.name)
                        } catch (e: Exception) {
                            com.futebadosparcas.domain.model.FieldType.SOCIETY
                        }
                    }
                )

                // Atualizar no repositório
                val updateResult = userRepository.updateUser(updatedUser)

                updateResult.fold(
                    onSuccess = {
                        _uiState.value = ProfileUiState.ProfileUpdateSuccess(updatedUser)
                    },
                    onFailure = { error ->
                        _uiState.value = ProfileUiState.Error(error.message ?: "Erro ao atualizar perfil")
                    }
                )
            } catch (e: Exception) {
                _uiState.value = ProfileUiState.Error(e.message ?: "Erro ao atualizar perfil")
            }
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
            val result = userRepository.updateAutoRatings(
                userId = user.id,
                autoStrikerRating = autoRatings.striker,
                autoMidRating = autoRatings.mid,
                autoDefenderRating = autoRatings.defender,
                autoGkRating = autoRatings.gk,
                autoRatingSamples = autoRatings.sampleSize
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
