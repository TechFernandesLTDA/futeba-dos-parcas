package com.futebadosparcas.ui.locations

import android.net.Uri
import com.futebadosparcas.util.AppLogger
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.datasource.FieldPhotoDataSource
import com.futebadosparcas.data.model.Field as AndroidField
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.Location as AndroidLocation
import com.futebadosparcas.data.model.LocationReview as AndroidLocationReview
import com.futebadosparcas.data.model.User as AndroidUser
import com.futebadosparcas.domain.model.Field
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.LocationReview
import com.futebadosparcas.domain.model.User as KmpUser
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.repository.AddressRepository as KmpAddressRepository
import com.futebadosparcas.util.LocationAnalytics
import com.futebadosparcas.util.LocationEditTracker
import com.futebadosparcas.util.LocationError
import com.futebadosparcas.util.LocationErrorHandler
import com.futebadosparcas.util.LocationSources
import com.futebadosparcas.util.RecoveryAction
import com.futebadosparcas.util.toAndroidField
import com.futebadosparcas.util.toAndroidLocation
import com.futebadosparcas.util.toAndroidLocationReview
import com.futebadosparcas.util.toAndroidUser
import com.futebadosparcas.util.toKmpField
import com.futebadosparcas.util.toKmpLocation
import com.futebadosparcas.util.toKmpLocationReview
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import javax.inject.Inject

private const val TAG = "LocationDetailViewModel"

@HiltViewModel
class LocationDetailViewModel @Inject constructor(
    private val locationRepository: LocationRepository,
    private val userRepository: UserRepository,
    private val addressRepository: KmpAddressRepository,
    private val locationAnalytics: LocationAnalytics,
    private val fieldPhotoDataSource: FieldPhotoDataSource
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocationDetailUiState>(LocationDetailUiState.Success(AndroidLocation(), emptyList()))
    val uiState: StateFlow<LocationDetailUiState> = _uiState

    private val _fieldOwners = MutableStateFlow<List<AndroidUser>>(emptyList())
    val fieldOwners: StateFlow<List<AndroidUser>> = _fieldOwners

    private var currentLocation: AndroidLocation? = null

    // Job tracking para evitar race conditions
    private var loadLocationJob: Job? = null
    private var loadDataJob: Job? = null

    // Armazena a fonte de navegação para rastreamento
    private var navigationSource: String = LocationSources.LIST

    init {
        loadFieldOwners()
    }

    /**
     * Define a fonte de navegação para rastreamento de analytics.
     * Deve ser chamado antes de loadLocation quando aplicável.
     */
    fun setNavigationSource(source: String) {
        navigationSource = source
    }

    private fun loadFieldOwners() {
        viewModelScope.launch {
            userRepository.getFieldOwners().onSuccess { owners ->
                _fieldOwners.value = owners.map { it.toAndroidUser() }
            }
        }
    }

    fun createLocation(
        name: String,
        address: String,
        phone: String?,
        openingTime: String,
        closingTime: String,
        minDuration: Int,
        region: String,
        neighborhood: String,
        description: String,
        amenities: List<String>,
        isActive: Boolean,
        instagram: String,
        cep: String,
        street: String,
        number: String,
        complement: String,
        city: String,
        state: String,
        country: String,
        selectedOwnerId: String? = null
    ) {
         viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading

            val currentUserId = userRepository.getCurrentUserId()
            if (currentUserId == null) {
                _uiState.value = LocationDetailUiState.Error.auth("Usuário não autenticado")
                return@launch
            }

            val finalOwnerId = selectedOwnerId ?: currentUserId

            val newLocation = AndroidLocation(
                ownerId = finalOwnerId,
                name = name,
                address = address,
                phone = phone,
                openingTime = openingTime,
                closingTime = closingTime,
                minGameDurationMinutes = minDuration,
                region = region,
                neighborhood = neighborhood,
                description = description,
                amenities = amenities,
                isActive = isActive,
                instagram = instagram,
                cep = cep,
                street = street,
                number = number,
                complement = complement,
                city = city,
                state = state,
                country = country,
                createdAt = java.util.Date()
            )

            // Validar antes de salvar
            val validationErrors = newLocation.validate()
            if (validationErrors.isNotEmpty()) {
                _uiState.value = LocationDetailUiState.Error(
                    validationErrors.joinToString(", ") { it.message }
                )
                return@launch
            }

            locationRepository.createLocation(newLocation.toKmpLocation()).fold(
                onSuccess = { kmpLocation ->
                    currentLocation = kmpLocation.toAndroidLocation()
                    // Rastreia criação de local
                    locationAnalytics.trackLocationCreated(kmpLocation.id)
                    _uiState.value = LocationDetailUiState.Success(kmpLocation.toAndroidLocation(), emptyList())
                },
                onFailure = { error ->
                     _uiState.value = LocationDetailUiState.Error.fromThrowable(error)
                }
            )
        }
    }

    fun loadLocation(locationId: String) {
        // Cancelar job anterior para evitar race conditions
        loadLocationJob?.cancel()
        loadLocationJob = viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading

            val locResult = locationRepository.getLocationById(locationId)

            locResult.fold(
                onSuccess = { kmpLocation ->
                    currentLocation = kmpLocation.toAndroidLocation()
                    // Rastreia abertura de detalhes do local
                    locationAnalytics.trackLocationDetailOpened(
                        locationId = kmpLocation.id,
                        source = navigationSource
                    )
                    loadData(kmpLocation.id, kmpLocation.toAndroidLocation())
                },
                onFailure = { error ->
                    _uiState.value = LocationDetailUiState.Error.fromThrowable(error)
                }
            )
        }
    }

    private fun loadData(locationId: String, location: AndroidLocation) {
        // Cancelar job anterior para evitar race conditions
        loadDataJob?.cancel()
        loadDataJob = viewModelScope.launch {
            val fieldsDeferred = async { locationRepository.getFieldsByLocation(locationId) }
            val reviewsDeferred = async { locationRepository.getLocationReviews(locationId) }

            val fieldsResult = fieldsDeferred.await()
            val reviewsResult = reviewsDeferred.await()

            if (fieldsResult.isSuccess) {
                 _uiState.value = LocationDetailUiState.Success(
                     location,
                     fieldsResult.getOrNull()?.map { it.toAndroidField() } ?: emptyList(),
                     reviewsResult.getOrNull()?.map { it.toAndroidLocationReview() } ?: emptyList()
                 )
            } else {
                 val exception = fieldsResult.exceptionOrNull()
                 _uiState.value = if (exception != null) {
                     LocationDetailUiState.Error.fromThrowable(exception)
                 } else {
                     LocationDetailUiState.Error("Erro ao carregar dados")
                 }
            }
        }
    }

    fun updateLocation(
        name: String,
        address: String,
        phone: String?,
        openingTime: String,
        closingTime: String,
        minDuration: Int,
        region: String,
        neighborhood: String,
        description: String,
        amenities: List<String>,
        isActive: Boolean,
        instagram: String,
        cep: String,
        street: String,
        number: String,
        complement: String,
        city: String,
        state: String,
        country: String,
        selectedOwnerId: String? = null
    ) {
        val location = currentLocation ?: return

        val fullAddress = "${street}, ${number} - ${city}"
        val finalOwnerId = selectedOwnerId ?: location.ownerId

        val updatedLocation = location.copy(
            ownerId = finalOwnerId,
            name = name,
            address = fullAddress,
            phone = phone,
            openingTime = openingTime,
            closingTime = closingTime,
            minGameDurationMinutes = minDuration,
            region = region,
            neighborhood = neighborhood,
            description = description,
            amenities = amenities,
            isActive = isActive,
            instagram = instagram,
            cep = cep,
            street = street,
            number = number,
            complement = complement,
            city = city,
            state = state,
            country = country,
            updatedAt = java.util.Date()
        )

        // Validar antes de salvar
        val validationErrors = updatedLocation.validate()
        if (validationErrors.isNotEmpty()) {
            _uiState.value = LocationDetailUiState.Error(
                validationErrors.joinToString(", ") { it.message }
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading
            locationRepository.updateLocation(updatedLocation.toKmpLocation()).fold(
                onSuccess = { kmpLocation ->
                    currentLocation = updatedLocation
                    loadData(updatedLocation.id, updatedLocation)
                },
                onFailure = { error ->
                    _uiState.value = LocationDetailUiState.Error.fromThrowable(error)
                }
            )
        }
    }

    fun searchCep(cep: String) {
        viewModelScope.launch {
            val currentSuccess = uiState.value as? LocationDetailUiState.Success

            addressRepository.getAddressByCep(cep).fold(
                onSuccess = { address ->
                    val currentState = currentLocation ?: AndroidLocation()
                    val updated = currentState.copy(
                        cep = address.cep,
                        street = address.street,
                        neighborhood = address.neighborhood,
                        city = address.city,
                        state = address.state,
                        country = address.country,
                        address = "${address.street}, ${address.neighborhood}, ${address.city} - ${address.state}"
                    )
                    currentLocation = updated

                    _uiState.value = LocationDetailUiState.Success(
                        location = updated,
                        fields = currentSuccess?.fields ?: emptyList(),
                        reviews = currentSuccess?.reviews ?: emptyList()
                    )
                },
                onFailure = {
                    _uiState.value = LocationDetailUiState.Error("CEP não encontrado: ${it.message}")
                    kotlinx.coroutines.delay(100)
                    if (currentSuccess != null) {
                        _uiState.value = currentSuccess
                    }
                }
            )
        }
    }

    fun updateCoordinates(fullAddress: String) {
        viewModelScope.launch {
             addressRepository.getGeocode(fullAddress).onSuccess { latLng ->
                 val current = currentLocation ?: return@onSuccess
                 val updated = current.copy(
                     latitude = latLng.latitude,
                     longitude = latLng.longitude
                 )
                 currentLocation = updated
                 val currentSuccess = uiState.value as? LocationDetailUiState.Success
                 if (currentSuccess != null) {
                     _uiState.value = LocationDetailUiState.Success(
                            location = updated,
                            fields = currentSuccess.fields,
                            reviews = currentSuccess.reviews
                     )
                 }
             }
        }
    }

    fun addField(
        name: String,
        type: FieldType,
        price: Double,
        isActive: Boolean,
        photoUri: Uri?,
        surface: String?,
        isCovered: Boolean,
        dimensions: String?
    ) {
        val location = currentLocation ?: return
        viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading

            // Gerar ID temporário para o field (será substituído pelo ID real após criação)
            val tempFieldId = System.currentTimeMillis().toString()

            // Upload da foto usando FieldPhotoDataSource (com validação e compressão)
            var photosList = emptyList<String>()
            if (photoUri != null) {
                AppLogger.d(TAG) { "Uploading field photo for new field in location: ${location.id}" }

                when (val result = fieldPhotoDataSource.uploadFieldPhoto(location.id, tempFieldId, photoUri)) {
                    is FieldPhotoDataSource.UploadResult.Success -> {
                        AppLogger.d(TAG) { "Field photo uploaded successfully: ${result.url}" }
                        photosList = listOf(result.url)
                    }
                    is FieldPhotoDataSource.UploadResult.FileTooLarge -> {
                        AppLogger.w(TAG) { "Field photo too large" }
                        _uiState.value = LocationDetailUiState.Error("Imagem muito grande. O tamanho máximo é 3MB.")
                        return@launch
                    }
                    is FieldPhotoDataSource.UploadResult.InvalidImage -> {
                        AppLogger.w(TAG) { "Invalid field photo" }
                        _uiState.value = LocationDetailUiState.Error("Arquivo inválido. Selecione uma imagem JPEG, PNG ou WebP.")
                        return@launch
                    }
                    is FieldPhotoDataSource.UploadResult.Error -> {
                        AppLogger.e(TAG, "Error uploading field photo: ${result.message}")
                        _uiState.value = LocationDetailUiState.Error("Erro ao fazer upload da imagem: ${result.message}")
                        return@launch
                    }
                    is FieldPhotoDataSource.UploadResult.Progress -> {
                        // Progresso não deveria ser retornado na versão simplificada
                    }
                }
            }

            val newField = AndroidField(
                locationId = location.id,
                name = name,
                type = type.name,
                hourlyPrice = price,
                isActive = isActive,
                photos = photosList,
                surface = surface,
                isCovered = isCovered,
                dimensions = dimensions
            )
            locationRepository.createField(newField.toKmpField()).fold(
                onSuccess = { loadData(location.id, location) },
                onFailure = { error -> _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao criar quadra") }
            )
        }
    }

    fun updateField(
        fieldId: String,
        name: String,
        type: FieldType,
        price: Double,
        isActive: Boolean,
        photoUri: Uri?,
        surface: String?,
        isCovered: Boolean,
        dimensions: String?
    ) {
        val location = currentLocation ?: return

        viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading

            val currentUser = userRepository.getCurrentUser().getOrNull()
            if (currentUser == null) {
                _uiState.value = LocationDetailUiState.Error.auth("Usuário não autenticado")
                return@launch
            }

            val isOwner = location.ownerId == currentUser.id
            val isLocationManager = location.managers.contains(currentUser.id)
            val isAdmin = currentUser.role == "ADMIN"

            var currentField: AndroidField? = null
             locationRepository.getFieldById(fieldId).onSuccess {
                currentField = it.toAndroidField()
            }.onFailure {
                _uiState.value = LocationDetailUiState.Error("Quadra não encontrada")
                return@launch
            }

            val field = currentField!!
            val isFieldManager = field.managers.contains(currentUser.id)

            // Verifica permissao: deve ser owner do local, gerente do local, gerente do campo, ou admin
            if (!isOwner && !isLocationManager && !isFieldManager && !isAdmin) {
                 _uiState.value = LocationDetailUiState.Error.auth("Sem permissão para editar esta quadra", "permission_denied")
                 return@launch
            }

            // Gerentes de campo nao podem alterar status Ativo/Inativo
            if (isFieldManager && !isOwner && !isLocationManager && !isAdmin) {
                if (isActive != field.isActive) {
                     _uiState.value = LocationDetailUiState.Error.auth("Gerentes de campo não podem alterar status Ativo/Inativo", "permission_denied")
                     return@launch
                }
            }

            // Owners e gerentes do local nao podem alterar status Ativo/Inativo (apenas admin)
            if ((isOwner || isLocationManager) && !isAdmin) {
                if (isActive != field.isActive) {
                     _uiState.value = LocationDetailUiState.Error.auth("Apenas Administradores podem alterar o status Ativo/Inativo", "permission_denied")
                     return@launch
                }
            }

            var currentPhotos = field.photos
            if (photoUri != null) {
                AppLogger.d(TAG) { "Uploading field photo for field: $fieldId in location: ${location.id}" }

                when (val result = fieldPhotoDataSource.uploadFieldPhoto(location.id, fieldId, photoUri)) {
                    is FieldPhotoDataSource.UploadResult.Success -> {
                        AppLogger.d(TAG) { "Field photo uploaded successfully: ${result.url}" }
                        currentPhotos = listOf(result.url)
                    }
                    is FieldPhotoDataSource.UploadResult.FileTooLarge -> {
                        AppLogger.w(TAG) { "Field photo too large" }
                        _uiState.value = LocationDetailUiState.Error("Imagem muito grande. O tamanho máximo é 3MB.")
                        return@launch
                    }
                    is FieldPhotoDataSource.UploadResult.InvalidImage -> {
                        AppLogger.w(TAG) { "Invalid field photo" }
                        _uiState.value = LocationDetailUiState.Error("Arquivo inválido. Selecione uma imagem JPEG, PNG ou WebP.")
                        return@launch
                    }
                    is FieldPhotoDataSource.UploadResult.Error -> {
                        AppLogger.e(TAG, "Error uploading field photo: ${result.message}")
                        _uiState.value = LocationDetailUiState.Error("Erro ao fazer upload da imagem: ${result.message}")
                        return@launch
                    }
                    is FieldPhotoDataSource.UploadResult.Progress -> {
                        // Progresso não deveria ser retornado na versão simplificada
                    }
                }
            }

            val updatedField = field.copy(
                name = name,
                type = type.name,
                hourlyPrice = price,
                isActive = isActive,
                photos = currentPhotos,
                surface = surface,
                isCovered = isCovered,
                dimensions = dimensions
            )

            locationRepository.updateField(updatedField.toKmpField()).fold(
                onSuccess = {
                    loadData(location.id, location)
                },
                onFailure = { error ->
                    _uiState.value = LocationDetailUiState.Error.fromThrowable(error)
                    loadData(location.id, location)
                }
            )
        }
    }

    fun addReview(rating: Float, comment: String) {
        val location = currentLocation ?: return
        viewModelScope.launch {
             _uiState.value = LocationDetailUiState.Loading
             val currentUserResult = userRepository.getCurrentUser()
             val currentUser = currentUserResult.getOrNull()
             if (currentUser == null) {
                 _uiState.value = LocationDetailUiState.Error.auth("Usuário não logado")
                 return@launch
             }
             val review = AndroidLocationReview(
                 locationId = location.id,
                 userId = currentUser.id,
                 userName = currentUser.name,
                 userPhotoUrl = currentUser.photoUrl,
                 rating = rating,
                 comment = comment
             )
             locationRepository.addLocationReview(review.toKmpLocationReview()).fold(
                 onSuccess = { loadData(location.id, location) },
                 onFailure = { error -> _uiState.value = LocationDetailUiState.Error.fromThrowable(error) }
             )
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadLocationJob?.cancel()
        loadDataJob?.cancel()
    }
}

sealed class LocationDetailUiState {
    data object Loading : LocationDetailUiState()
    data class Success(
        val location: AndroidLocation,
        val fields: List<AndroidField>,
        val reviews: List<AndroidLocationReview> = emptyList()
    ) : LocationDetailUiState()

    /**
     * Estado de erro com informações contextuais para recuperação.
     *
     * @param message Mensagem de erro para exibição
     * @param errorType Tipo categorizado do erro para tratamento específico
     * @param recoveryAction Ação sugerida para recuperação do erro
     * @param originalThrowable Exceção original para logging/debug (opcional)
     */
    data class Error(
        val message: String,
        val errorType: LocationError = LocationErrorHandler.fromMessage(message),
        val recoveryAction: RecoveryAction = LocationErrorHandler.getRecoveryAction(
            LocationErrorHandler.fromMessage(message)
        ),
        val originalThrowable: Throwable? = null
    ) : LocationDetailUiState() {

        companion object {
            /**
             * Cria um estado de erro a partir de um Throwable.
             * Categoriza automaticamente o erro e determina a ação de recuperação.
             */
            fun fromThrowable(throwable: Throwable): Error {
                val errorType = LocationErrorHandler.categorizeError(throwable)
                return Error(
                    message = throwable.message ?: "Erro desconhecido",
                    errorType = errorType,
                    recoveryAction = LocationErrorHandler.getRecoveryAction(errorType),
                    originalThrowable = throwable
                )
            }

            /**
             * Cria um estado de erro de validação com campos específicos.
             */
            fun validation(fields: List<String>, message: String): Error {
                val errorType = LocationError.Validation(fields)
                return Error(
                    message = message,
                    errorType = errorType,
                    recoveryAction = RecoveryAction.FixFields(fields)
                )
            }

            /**
             * Cria um estado de erro de autenticação.
             */
            fun auth(message: String, reason: String = "not_authenticated"): Error {
                val errorType = LocationError.Auth(reason)
                return Error(
                    message = message,
                    errorType = errorType,
                    recoveryAction = LocationErrorHandler.getRecoveryAction(errorType)
                )
            }
        }
    }
}
