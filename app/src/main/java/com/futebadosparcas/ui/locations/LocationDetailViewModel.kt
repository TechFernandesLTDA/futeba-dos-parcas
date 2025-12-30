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
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import javax.inject.Inject

@HiltViewModel
class LocationDetailViewModel @Inject constructor(
    private val locationRepository: LocationRepository,
    private val userRepository: UserRepository
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
        instagram: String
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
                instagram = instagram
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
        instagram: String
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
            instagram = instagram
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

            var photosList = emptyList<String>()
            
            if (photoUri != null) {
                locationRepository.uploadFieldPhoto(photoUri).onSuccess { url ->
                    photosList = listOf(url)
                }.onFailure {
                     _uiState.value = LocationDetailUiState.Error("Erro ao fazer upload da imagem")
                     // Could return or continue without image. Continuing without image for now but showing error might be better. 
                     // Let's stop to be safe or maybe continue? User expects save. 
                     // Returning might be safer to let user retry.
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
                onSuccess = {
                    loadData(location.id, location)
                },
                onFailure = { error ->
                    _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao criar quadra")
                    loadData(location.id, location)
                }
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

            // Fetch existing to get photos if no new photo
            var currentPhotos = emptyList<String>()
            locationRepository.getFieldById(fieldId).onSuccess { 
                currentPhotos = it.photos 
            }

            if (photoUri != null) {
                 locationRepository.uploadFieldPhoto(photoUri).onSuccess { url ->
                    currentPhotos = listOf(url) // Request implies single photo for now, or append? Text says "Upload de fotos" but UI shows one. 
                    // Replacing for this implementation to match UI single ImageView. 
                }.onFailure {
                     _uiState.value = LocationDetailUiState.Error("Erro ao fazer upload da imagem")
                     return@launch
                }
            }
        
            val updatedField = Field(
                id = fieldId,
                locationId = location.id,
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
                 onSuccess = {
                     loadData(location.id, location)
                 },
                 onFailure = { error ->
                     _uiState.value = LocationDetailUiState.Error(error.message ?: "Erro ao enviar avaliação")
                 }
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
