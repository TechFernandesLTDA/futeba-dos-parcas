package com.futebadosparcas.ui.locations

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.model.LocationReview
import com.futebadosparcas.data.repository.LocationRepository
import com.futebadosparcas.data.repository.UserRepository
import com.futebadosparcas.data.repository.AddressRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import javax.inject.Inject

@HiltViewModel
class LocationDetailViewModel @Inject constructor(
    private val locationRepository: LocationRepository,
    private val userRepository: UserRepository,
    private val addressRepository: AddressRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocationDetailUiState>(LocationDetailUiState.Loading)
    val uiState: StateFlow<LocationDetailUiState> = _uiState

    private var currentLocation: Location? = null

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
        country: String
    ) {
         viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading
            
            val userId = userRepository.getCurrentUserId()
            if (userId == null) {
                _uiState.value = LocationDetailUiState.Error("Usuário não autenticado")
                return@launch
            }

            val newLocation = Location(
                ownerId = userId,
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
                // Address fields
                cep = cep,
                street = street,
                number = number,
                complement = complement,
                // neighborhood, passed as arg above
                city = city,
                state = state,
                country = country
            )

            locationRepository.createLocation(newLocation).fold(
                onSuccess = { location ->
                    currentLocation = location
                    _uiState.value = LocationDetailUiState.Success(location, emptyList())
                },
                onFailure = { error ->
                     _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao criar local")
                }
            )
        }
    }

    fun loadLocation(locationId: String) {
        viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading
            
            // We need both Location and its Fields
            val locResult = locationRepository.getLocationById(locationId)
            
            locResult.fold(
                onSuccess = { location ->
                    currentLocation = location
                    loadData(location.id, location)
                },
                onFailure = { error ->
                    _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao carregar local")
                }
            )
        }
    }
    
    private fun loadData(locationId: String, location: Location) {
        viewModelScope.launch {
            val fieldsDeferred = async { locationRepository.getFieldsByLocation(locationId) }
            val reviewsDeferred = async { locationRepository.getLocationReviews(locationId) }

            val fieldsResult = fieldsDeferred.await()
            val reviewsResult = reviewsDeferred.await()

            if (fieldsResult.isSuccess) {
                 _uiState.value = LocationDetailUiState.Success(
                     location, 
                     fieldsResult.getOrNull() ?: emptyList(),
                     reviewsResult.getOrNull() ?: emptyList()
                 )
            } else {
                 _uiState.value = LocationDetailUiState.Error(fieldsResult.exceptionOrNull()?.message ?: "Erro ao carregar dados")
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
        country: String
    ) {
        val location = currentLocation ?: return
        
        val updatedLocation = location.copy(
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
            country = country
        )
        
        viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading
            locationRepository.updateLocation(updatedLocation).fold(
                onSuccess = {
                    currentLocation = updatedLocation
                    // Reload to refresh UI properly
                    loadData(updatedLocation.id, updatedLocation)
                },
                onFailure = { error ->
                    _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao atualizar local")
                }
            )
        }
    }
    
    fun searchCep(cep: String) {
        viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading
            addressRepository.getAddressByCep(cep).fold(
                onSuccess = { address ->
                    val currentState = currentLocation ?: Location()
                    val updated = currentState.copy(
                        cep = address.cep,
                        street = address.street,
                        neighborhood = address.neighborhood,
                        city = address.city,
                        state = address.state,
                        country = address.country,
                        // Update full address text as preview logic
                        address = "${address.street}, ${address.neighborhood}, ${address.city} - ${address.state}"
                    )
                    currentLocation = updated
                    
                    val currentSuccess = uiState.value as? LocationDetailUiState.Success
                    _uiState.value = LocationDetailUiState.Success(
                        location = updated,
                        fields = currentSuccess?.fields ?: emptyList(),
                        reviews = currentSuccess?.reviews ?: emptyList()
                    )
                },
                onFailure = {
                     _uiState.value = LocationDetailUiState.Error("CEP não encontrado: ${it.message}")
                     // Ideally restore success state after showing error, or use one-shot event
                }
            )
        }
    }

    fun updateCoordinates(fullAddress: String) {
        viewModelScope.launch {
             // Keep loading state optional or add specific loading field
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
        // Implementation remains same
        viewModelScope.launch {
            _uiState.value = LocationDetailUiState.Loading
            var photosList = emptyList<String>()
            if (photoUri != null) {
                locationRepository.uploadFieldPhoto(photoUri).onSuccess { url -> photosList = listOf(url) }
                    .onFailure { 
                         _uiState.value = LocationDetailUiState.Error("Erro ao fazer upload da imagem")
                         return@launch
                    }
            }
            val newField = Field(
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
            locationRepository.createField(newField).fold(
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
                _uiState.value = LocationDetailUiState.Error("Usuário não autenticado")
                return@launch
            }

            // Check permissions
            // We need the existing field to check its managers if we don't have it locally in current args?
            // But we can check location owner first.
            val isOwner = location.ownerId == currentUser.id
            val isAdmin = currentUser.role == "ADMIN" // Assuming role string match or enum
            
            // Allow update if Owner, Admin. If Manager, we need to check specific field permission.
            // We fetch the field to check managers.
            
            var currentField: Field? = null
             locationRepository.getFieldById(fieldId).onSuccess { 
                currentField = it
            }.onFailure {
                _uiState.value = LocationDetailUiState.Error("Quadra não encontrada")
                return@launch
            }
            
            val field = currentField!!
            val isManager = field.managers.contains(currentUser.id)

            if (!isOwner && !isAdmin && !isManager) {
                 _uiState.value = LocationDetailUiState.Error("Sem permissão para editar esta quadra")
                 return@launch
            }

            // Manager restrictions: Cannot change isActive? User said "Gerenciador não pode: Alterar dados críticos (ativo/inativo)".
            if (isManager && !isOwner && !isAdmin) {
                if (isActive != field.isActive) {
                     _uiState.value = LocationDetailUiState.Error("Gerentes não podem alterar status Ativo/Inativo")
                     return@launch
                }
            }
            
            // Requirements: "Owner can update info but NEVER activate/inactivate or delete"
            // If Owner (but not Admin), prevent changing isActive
            if (isOwner && !isAdmin) {
                if (isActive != field.isActive) {
                     _uiState.value = LocationDetailUiState.Error("Apenas Administradores podem alterar o status Ativo/Inativo")
                     return@launch
                }
            }

            var currentPhotos = field.photos
            if (photoUri != null) {
                 locationRepository.uploadFieldPhoto(photoUri).onSuccess { url ->
                    currentPhotos = listOf(url) 
                }.onFailure {
                     _uiState.value = LocationDetailUiState.Error("Erro ao fazer upload da imagem")
                     return@launch
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

            locationRepository.updateField(updatedField).fold(
                onSuccess = {
                    loadData(location.id, location)
                },
                onFailure = { error ->
                    _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao atualizar quadra")
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
                 _uiState.value = LocationDetailUiState.Error("Usuário não logado")
                 return@launch
             }
             val review = LocationReview(
                 locationId = location.id,
                 userId = currentUser.id,
                 userName = currentUser.name,
                 userPhotoUrl = currentUser.photoUrl,
                 rating = rating,
                 comment = comment
             )
             locationRepository.addLocationReview(review).fold(
                 onSuccess = { loadData(location.id, location) },
                 onFailure = { error -> _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao enviar avaliação") }
             )
        }
    }
}

sealed class LocationDetailUiState {
    object Loading : LocationDetailUiState()
    data class Success(
        val location: Location, 
        val fields: List<Field>, 
        val reviews: List<LocationReview> = emptyList()
    ) : LocationDetailUiState()
    data class Error(val message: String) : LocationDetailUiState()
}
