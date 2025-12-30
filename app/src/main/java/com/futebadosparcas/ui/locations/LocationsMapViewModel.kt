package com.futebadosparcas.ui.locations

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LocationsMapViewModel @Inject constructor(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _locations = MutableLiveData<List<Location>>()
    val locations: LiveData<List<Location>> = _locations

    fun loadLocations() {
        viewModelScope.launch {
            locationRepository.getAllLocations().fold(
                onSuccess = { 
                    _locations.value = it 
                },
                onFailure = { 
                    AppLogger.e("LocationsMapVM", "Error loading locations", it)
                }
            )
        }
    }
}
