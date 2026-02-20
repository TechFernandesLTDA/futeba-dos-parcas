package com.futebadosparcas.ui.profile

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.datasource.ProfilePhotoDataSource
import com.futebadosparcas.data.model.AutoRatings
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.data.model.PerformanceRatingCalculator
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.toDataBadges
import com.futebadosparcas.util.toDataLocations
import com.futebadosparcas.util.toDataModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.Date
import kotlin.math.abs

class ProfileViewModel(
    private val userRepository: UserRepository,
    private val authRepository: AuthRepository,
    private val gameRepository: GameRepository,
    private val liveGameRepository: LiveGameRepository,
    private val gamificationRepository: GamificationRepository,
    private val statisticsRepository: StatisticsRepository,
    private val locationRepository: LocationRepository,
    private val notificationRepository: com.futebadosparcas.domain.repository.NotificationRepository,
    private val preferencesManager: com.futebadosparcas.util.PreferencesManager,
    private val profilePhotoDataSource: ProfilePhotoDataSource,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : ViewModel() {

    companion object {
        private const val TAG = "ProfileViewModel"

        /** Diferença mínima de rating para acionar atualização automática */
        private const val AUTO_RATING_DELTA_THRESHOLD = 0.3

        /** Mínimo de amostras adicionais antes de reavaliação */
        private const val AUTO_RATING_MIN_SAMPLE_INCREMENT = 3
    }

    private val _uiEvents = kotlinx.coroutines.channels.Channel<ProfileUiEvent>()
    val uiEvents = _uiEvents.receiveAsFlow()

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    val uiState: StateFlow<ProfileUiState> = _uiState

    private val _myLocations = MutableStateFlow<List<Location>>(emptyList())
    val myLocations: StateFlow<List<Location>> = _myLocations

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    private var statisticsListener: com.google.firebase.firestore.ListenerRegistration? = null
    private var unreadCountJob: kotlinx.coroutines.Job? = null
    private var loadProfileJob: kotlinx.coroutines.Job? = null

    init {
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        unreadCountJob?.cancel()
        unreadCountJob = viewModelScope.launch {
            notificationRepository.getUnreadCountFlow()
                .catch { e ->
                    AppLogger.e(TAG, "Erro ao observar notificações: ${e.message}", e)
                    _unreadCount.value = 0
                }
                .collect { count ->
                    _unreadCount.value = count
                }
        }
    }

    fun loadProfile() {
        // Cancelar job anterior para evitar coleções concorrentes
        loadProfileJob?.cancel()

        // Remover listener anterior para evitar race condition ao recarregar
        statisticsListener?.remove()
        statisticsListener = null

        loadProfileJob = viewModelScope.launch {
            if (_uiState.value !is ProfileUiState.Success) {
                _uiState.value = ProfileUiState.Loading
            }

            userRepository.observeCurrentUser()
                .catch { e ->
                    AppLogger.e(TAG, "Erro ao observar usuário: ${e.message}", e)
                    _uiState.value = ProfileUiState.Error(e.message ?: "Erro ao carregar perfil")
                }
                .collect { user ->
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
                    AppLogger.e(TAG, "Erro no listener de estatísticas: ${error.message}", error)
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    try {
                        val updatedStats = snapshot.toObject(com.futebadosparcas.domain.model.Statistics::class.java)
                        val currentState = _uiState.value

                        if (currentState is ProfileUiState.Success && updatedStats != null) {
                            _uiState.value = currentState.copy(statistics = updatedStats)
                            maybeUpdateAutoRatings(currentState.user, updatedStats)
                        }
                    } catch (e: Exception) {
                        AppLogger.w(TAG) { "Erro ao parsear estatísticas: ${e.message}" }
                    }
                }
            }
    }

    fun updateProfile(
        formData: ProfileFormData,
        photoUri: Uri?
    ) {
        viewModelScope.launch {
            val currentState = _uiState.value
            if (currentState !is ProfileUiState.Success) return@launch

            _uiState.value = ProfileUiState.Loading

            try {
                // Obter usuário atual
                val currentUserResult = userRepository.getCurrentUser()
                val currentUser = currentUserResult.getOrNull()

                if (currentUser == null) {
                    _uiState.value = ProfileUiState.Error("Usuário não encontrado")
                    return@launch
                }

                // Upload de foto se fornecida (usando ProfilePhotoDataSource com compressão)
                var photoUrl: String? = currentUser.photoUrl
                if (photoUri != null) {
                    val uploadResult = profilePhotoDataSource.uploadProfilePhoto(
                        userId = currentUser.id,
                        imageUri = photoUri
                    )
                    photoUrl = when (uploadResult) {
                        is ProfilePhotoDataSource.UploadResult.Success -> uploadResult.url
                        is ProfilePhotoDataSource.UploadResult.FileTooLarge -> {
                            AppLogger.w(TAG) { "Foto muito grande para upload" }
                            currentUser.photoUrl // Manter foto atual
                        }
                        is ProfilePhotoDataSource.UploadResult.InvalidImage -> {
                            AppLogger.w(TAG) { "Arquivo de imagem inválido" }
                            currentUser.photoUrl // Manter foto atual
                        }
                        is ProfilePhotoDataSource.UploadResult.Error -> {
                            AppLogger.e(TAG, "Erro no upload: ${uploadResult.message}")
                            currentUser.photoUrl // Manter foto atual
                        }
                        is ProfilePhotoDataSource.UploadResult.Progress -> {
                            // Progress não deveria ser retornado na versão simplificada
                            currentUser.photoUrl
                        }
                    }
                }

                // Criar usuário atualizado
                val updatedUser = currentUser.copy(
                    name = formData.name,
                    nickname = formData.nickname,
                    photoUrl = photoUrl,
                    strikerRating = formData.strikerRating,
                    midRating = formData.midRating,
                    defenderRating = formData.defenderRating,
                    gkRating = formData.gkRating,
                    preferredPosition = formData.primaryPosition,
                    primaryPosition = formData.primaryPosition,
                    secondaryPosition = formData.secondaryPosition,
                    playStyle = formData.playStyle,
                    experienceYears = formData.experienceYears,
                    birthDate = formData.birthDate?.time,
                    gender = formData.gender,
                    heightCm = formData.heightCm,
                    weightKg = formData.weightKg,
                    dominantFoot = formData.dominantFoot,
                    preferredFieldTypes = formData.preferredFieldTypes
                )

                // Atualizar no repositório
                val updateResult = userRepository.updateUser(updatedUser)

                updateResult.fold(
                    onSuccess = { updatedUserFromRepo ->
                        AppLogger.d(TAG) { "Perfil atualizado com sucesso." }
                        // Buscar dados atualizados do repositório
                        val refreshedUserResult = userRepository.getCurrentUser()
                        refreshedUserResult.fold(
                            onSuccess = { refreshedUser ->
                                // Buscar badges e estatísticas atualizadas
                                val badgesResult = gamificationRepository.getUserBadges(refreshedUser.id)
                                val badges = badgesResult.getOrNull()?.toDataBadges() ?: emptyList()

                                val statsResult = statisticsRepository.getUserStatistics(refreshedUser.id)
                                val stats = statsResult.getOrNull()?.toDataModel(refreshedUser.id)

                                _uiState.value = ProfileUiState.ProfileUpdateSuccess(
                                    user = refreshedUser,
                                    badges = badges,
                                    statistics = stats,
                                    isDevMode = isDevModeEnabled()
                                )
                            },
                            onFailure = { error ->
                                AppLogger.e(TAG, "Erro ao recarregar usuário: ${error.message}", error)
                                // Mesmo com erro ao recarregar, mostrar sucesso com o usuário atualizado
                                _uiState.value = ProfileUiState.ProfileUpdateSuccess(
                                    user = updatedUser,
                                    badges = emptyList(),
                                    statistics = null,
                                    isDevMode = isDevModeEnabled()
                                )
                            }
                        )
                    },
                    onFailure = { error ->
                        AppLogger.e(TAG, "Erro ao atualizar perfil: ${error.message}", error)
                        _uiState.value = ProfileUiState.Error(error.message ?: "Erro ao atualizar perfil")
                        // Tentar recarregar para voltar ao estado anterior
                        loadProfile()
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Exceção ao atualizar perfil: ${e.message}", e)
                _uiState.value = ProfileUiState.Error(e.message ?: "Erro ao atualizar perfil")
                // Recarregar em caso de exceção também
                loadProfile()
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

    private fun maybeUpdateAutoRatings(user: User, stats: com.futebadosparcas.domain.model.Statistics?) {
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
        if (auto.sampleSize >= user.autoRatingSamples + AUTO_RATING_MIN_SAMPLE_INCREMENT) return true

        val delta = maxOf(
            abs(user.autoStrikerRating - auto.striker),
            abs(user.autoMidRating - auto.mid),
            abs(user.autoDefenderRating - auto.defender),
            abs(user.autoGkRating - auto.gk)
        )
        return delta >= AUTO_RATING_DELTA_THRESHOLD
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
        // Cancelar jobs para evitar memory leaks
        loadProfileJob?.cancel()
        unreadCountJob?.cancel()
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
        val statistics: com.futebadosparcas.domain.model.Statistics?,
        val isDevMode: Boolean
    ) : ProfileUiState()
    data class ProfileUpdateSuccess(
        val user: User,
        val badges: List<com.futebadosparcas.data.model.UserBadge> = emptyList(),
        val statistics: com.futebadosparcas.domain.model.Statistics? = null,
        val isDevMode: Boolean = false
    ) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
    object LoggedOut : ProfileUiState()
    object DataReset : ProfileUiState()
}

sealed class ProfileUiEvent {
    object LoadComplete : ProfileUiEvent()
    object ProfileUpdated : ProfileUiEvent()
}
