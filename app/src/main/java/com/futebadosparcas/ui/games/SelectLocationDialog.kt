package com.futebadosparcas.ui.games

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.repository.LocationRepository
import com.futebadosparcas.databinding.DialogSelectLocationBinding
import com.futebadosparcas.util.AppLogger
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.net.FetchPlaceRequest
import com.google.android.libraries.places.api.net.FindAutocompletePredictionsRequest
import com.google.android.libraries.places.api.net.PlacesClient
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.Normalizer
import javax.inject.Inject

// Função de extensão para normalizar strings na busca (remove acentos e converte para minúsculas)
private fun String.normalizeForSearch(): String {
    return Normalizer.normalize(this, Normalizer.Form.NFD)
        .replace("\\p{InCombiningDiacriticalMarks}+".toRegex(), "")
        .lowercase()
        .trim()
}

@AndroidEntryPoint
class SelectLocationDialog : DialogFragment() {

    private var _binding: DialogSelectLocationBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var locationRepository: LocationRepository

    private lateinit var placesClient: PlacesClient
    private lateinit var locationAdapter: LocationAdapter

    private var selectedLocation: Location? = null
    private var onLocationSelected: ((Location) -> Unit)? = null
    private var savedLocations: List<Location> = emptyList()
    private var searchJob: Job? = null

    companion object {
        private const val TAG = "SelectLocationDialog"

        fun newInstance(onLocationSelected: (Location) -> Unit): SelectLocationDialog {
            return SelectLocationDialog().apply {
                this.onLocationSelected = onLocationSelected
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NO_TITLE, R.style.Theme_FutebaDosParas_FullScreenDialog)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogSelectLocationBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        initPlacesClient()
        setupRecyclerView()
        setupSearch()
        setupButtons()
        loadSavedLocations()
    }

    private fun initPlacesClient() {
        if (!Places.isInitialized()) {
            Places.initialize(requireContext(), getString(R.string.google_maps_key))
        }
        placesClient = Places.createClient(requireContext())
    }

    private fun setupRecyclerView() {
        locationAdapter = LocationAdapter { location ->
            // Selecionar imediatamente ao clicar
            selectedLocation = location
            locationAdapter.setSelectedLocation(location.id)

            AppLogger.d(TAG) { "Local selecionado: ${location.name} (${location.id})" }

            // Se é um lugar do Google Places, buscar detalhes e salvar
            if (location.id.startsWith("places_") && location.placeId != null) {
                fetchPlaceDetailsAndSave(location.placeId!!)
            } else {
                // Chamar callback ANTES de fechar
                onLocationSelected?.invoke(location)
                dismiss()
            }
        }

        binding.rvLocations.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = locationAdapter
        }
    }

    private fun setupSearch() {
        binding.etSearchLocation.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val query = s?.toString() ?: ""
                searchJob?.cancel()

                if (query.length < 3) {
                    // Mostrar locais salvos
                    binding.tvRecentLocations.text = "Locais salvos"
                    locationAdapter.submitList(savedLocations)
                    updateEmptyState(savedLocations.isEmpty())
                    return
                }

                // Debounce de 300ms para evitar muitas requisicoes
                searchJob = lifecycleScope.launch {
                    delay(300)
                    searchPlaces(query)
                }
            }
        })
    }

    private fun searchPlaces(query: String) {
        binding.progressBar.visibility = View.VISIBLE
        binding.tvRecentLocations.text = "Resultados da busca"

        // Normalizar query para busca inteligente (remover acentos e case)
        val normalizedQuery = query.normalizeForSearch()

        // Primeiro, buscar nos locais salvos (busca em nome, endereço, cidade, bairro)
        val localResults = savedLocations.filter { location ->
            val matchName = location.name.normalizeForSearch().contains(normalizedQuery)
            val matchAddress = location.address.normalizeForSearch().contains(normalizedQuery)
            val matchCity = location.city?.normalizeForSearch()?.contains(normalizedQuery) == true
            val matchNeighborhood = location.neighborhood?.normalizeForSearch()?.contains(normalizedQuery) == true

            matchName || matchAddress || matchCity || matchNeighborhood
        }

        // Se encontrou localmente, mostrar
        if (localResults.isNotEmpty()) {
            locationAdapter.submitList(localResults)
            binding.progressBar.visibility = View.GONE
            updateEmptyState(false)
        }

        // Também buscar no Google Places
        val request = FindAutocompletePredictionsRequest.builder()
            .setQuery(query)
            .setCountries("BR")
            .setTypesFilter(listOf("establishment", "geocode"))
            .build()

        placesClient.findAutocompletePredictions(request)
            .addOnSuccessListener { response ->
                val predictions = response.autocompletePredictions
                if (predictions.isEmpty() && localResults.isEmpty()) {
                    updateEmptyState(true)
                } else {
                    // Converter predictions para Locations temporarias (sem ID)
                    val placesLocations = predictions.map { prediction ->
                        Location(
                            id = "places_${prediction.placeId}",
                            name = prediction.getPrimaryText(null).toString(),
                            address = prediction.getSecondaryText(null).toString(),
                            placeId = prediction.placeId
                        )
                    }

                    // Combinar resultados locais com do Places (locais primeiro)
                    val combinedResults = localResults + placesLocations.filter { place ->
                        localResults.none { it.placeId == place.placeId }
                    }

                    locationAdapter.submitList(combinedResults)
                    updateEmptyState(combinedResults.isEmpty())
                }
                binding.progressBar.visibility = View.GONE
            }
            .addOnFailureListener { exception ->
                AppLogger.e(TAG, "Erro ao buscar lugares", exception)
                // Mostrar apenas resultados locais
                locationAdapter.submitList(localResults)
                updateEmptyState(localResults.isEmpty())
                binding.progressBar.visibility = View.GONE
            }
    }

    private fun loadSavedLocations() {
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            val result = locationRepository.getAllLocations()
            result.fold(
                onSuccess = { locations ->
                    savedLocations = locations
                    locationAdapter.submitList(locations)
                    updateEmptyState(locations.isEmpty())
                },
                onFailure = { error ->
                    AppLogger.e(TAG, "Erro ao carregar locais salvos", error)
                    updateEmptyState(true)
                }
            )
            binding.progressBar.visibility = View.GONE
        }
    }

    private fun updateEmptyState(isEmpty: Boolean) {
        binding.tvEmptyState.visibility = if (isEmpty) View.VISIBLE else View.GONE
        binding.rvLocations.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }

    private fun setupButtons() {
        binding.btnCancelLocation.setOnClickListener {
            dismiss()
        }

        binding.btnConfirmLocation.setOnClickListener {
            selectedLocation?.let { location ->
                // Se é um lugar do Google Places, buscar detalhes e salvar
                if (location.id.startsWith("places_") && location.placeId != null) {
                    fetchPlaceDetailsAndSave(location.placeId!!)
                } else {
                    onLocationSelected?.invoke(location)
                    dismiss()
                }
            }
        }

        // binding.btnAddNewLocation.setOnClickListener {
        //     // Abrir dialog para adicionar novo local manualmente
        //     showAddLocationDialog()
        // }
    }

    private fun fetchPlaceDetailsAndSave(placeId: String) {
        binding.progressBar.visibility = View.VISIBLE
        binding.btnConfirmLocation.isEnabled = false

        val placeFields = listOf(
            Place.Field.ID,
            Place.Field.DISPLAY_NAME,
            Place.Field.FORMATTED_ADDRESS,
            Place.Field.LOCATION,
            Place.Field.ADDRESS_COMPONENTS
        )

        val request = FetchPlaceRequest.newInstance(placeId, placeFields)

        placesClient.fetchPlace(request)
            .addOnSuccessListener { response ->
                val place = response.place

                // Extrair cidade e estado dos componentes de endereco
                var city = ""
                var state = ""
                place.addressComponents?.asList()?.forEach { component ->
                    when {
                        component.types.contains("administrative_area_level_2") -> city = component.name
                        component.types.contains("administrative_area_level_1") -> state = component.shortName ?: component.name
                    }
                }

                lifecycleScope.launch {
                    val result = locationRepository.getOrCreateLocationFromPlace(
                        placeId = placeId,
                        name = place.displayName ?: "",
                        address = place.formattedAddress ?: "",
                        city = city,
                        state = state,
                        latitude = place.location?.latitude,
                        longitude = place.location?.longitude
                    )

                    result.fold(
                        onSuccess = { savedLocation ->
                            onLocationSelected?.invoke(savedLocation)
                            dismiss()
                        },
                        onFailure = { error ->
                            AppLogger.e(TAG, "Erro ao salvar local", error)
                            binding.progressBar.visibility = View.GONE
                            binding.btnConfirmLocation.isEnabled = true
                        }
                    )
                }
            }
            .addOnFailureListener { exception ->
                AppLogger.e(TAG, "Erro ao buscar detalhes do lugar", exception)
                binding.progressBar.visibility = View.GONE
                binding.btnConfirmLocation.isEnabled = true
            }
    }

    private fun showAddLocationDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(
            R.layout.dialog_add_location_manual, null
        )
        
        val etName = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etLocationName)
        val etAddress = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etLocationAddress)
        
        // Pre-fill with search query if available
        val query = binding.etSearchLocation.text.toString()
        if (query.isNotBlank()) {
            etName.setText(query)
        }
        
        android.app.AlertDialog.Builder(requireContext())
            .setTitle("Adicionar Novo Local")
            .setView(dialogView)
            .setPositiveButton("Salvar") { _, _ ->
                val name = etName.text?.toString()?.trim() ?: ""
                val address = etAddress.text?.toString()?.trim() ?: ""
                
                if (name.isNotBlank()) {
                    val newLocation = Location(
                        name = name,
                        address = address
                    )
                    
                    lifecycleScope.launch {
                        binding.progressBar.visibility = View.VISIBLE
                        val result = locationRepository.createLocation(newLocation)
                        result.fold(
                            onSuccess = { savedLocation ->
                                onLocationSelected?.invoke(savedLocation)
                                dismiss()
                            },
                            onFailure = { error ->
                                AppLogger.e(TAG, "Erro ao criar local", error)
                                binding.progressBar.visibility = View.GONE
                            }
                        )
                    }
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.apply {
            setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        searchJob?.cancel()
        _binding = null
    }
}
