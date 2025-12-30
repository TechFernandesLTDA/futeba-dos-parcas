package com.futebadosparcas.ui.locations

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.databinding.FragmentLocationDetailBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class LocationDetailFragment : Fragment() {

    private var _binding: FragmentLocationDetailBinding? = null
    private val binding get() = _binding!!

    private val viewModel: LocationDetailViewModel by viewModels()
    
    private lateinit var fieldAdapter: FieldAdapter
    private lateinit var reviewsAdapter: ReviewsAdapter
    private var locationId: String? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLocationDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        locationId = arguments?.getString("locationId")

        setupRecyclerView()
        setupListeners()
        observeViewModel()

        if (locationId != null) {
            viewModel.loadLocation(locationId!!)
            // binding.tvTitle.text = "Editar Local"
            binding.btnSaveLocation.text = "Salvar Alterações"
        } else {
            // binding.tvTitle.text = "Novo Local"
            binding.btnSaveLocation.text = "Criar Local"
            // Para novo local, talvez esconder seção de quadras até salvar?
            // Ou permitir adicionar se a lógica do ViewModel suportar (precisa de locationId).
            // A lógica atual addField(location = currentLocation) precisa que currentLocation exista.
            // Se currentLocation == null, addField falha (return).
            // createLocation seta currentLocation.
            // Então usuário deve Salvar (Criar) primeiro.
            
            binding.tvFieldsHeader.visibility = View.GONE
            binding.btnAddField.visibility = View.GONE
            binding.rvFields.visibility = View.GONE
            
            binding.tvAmenitiesHeader.visibility = View.VISIBLE
            binding.chipGroupAmenities.visibility = View.VISIBLE
        }
    }

    private fun setupRecyclerView() {
        fieldAdapter = FieldAdapter { field ->
            showFieldDialog(field)
        }
        binding.rvFields.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = fieldAdapter
        }

        // reviewsAdapter = ReviewsAdapter()
        // binding.rvReviews.apply { // Se não tiver no layout, vai falhar (tem no XML)
        //      layoutManager = LinearLayoutManager(context)
        //      adapter = reviewsAdapter
        // }
    }

    private fun setupListeners() {
        binding.btnSaveLocation.setOnClickListener {
            saveLocation()
        }
        
        binding.btnAddField.setOnClickListener {
             showFieldDialog(null)
        }
        
        // binding.btnAddReview.setOnClickListener {
        //     showAddReviewDialog()
        // }

        binding.toolbar.setNavigationOnClickListener {
            parentFragmentManager.popBackStack()
        }
    }
    
    private fun showFieldDialog(field: Field?) {
        val dialog = FieldEditDialog(field) { name, type, price, isActive, photoUri, surface, isCovered, dimensions ->
            if (field == null) {
                viewModel.addField(name, type, price, isActive, photoUri, surface, isCovered, dimensions)
            } else {
                viewModel.updateField(field.id, name, type, price, isActive, photoUri, surface, isCovered, dimensions)
            }
        }
        dialog.show(parentFragmentManager, FieldEditDialog.TAG)
    }

    private fun saveLocation() {
        val name = binding.etName.text.toString()
        val address = binding.etAddress.text.toString()
        val phone = binding.etPhone.text.toString()
        val openTime = binding.etOpenTime.text.toString().ifBlank { "08:00" }
        val closeTime = binding.etCloseTime.text.toString().ifBlank { "23:00" }
        
        val minDurationStr = binding.actvMinDuration.text.toString()
        val minDuration = minDurationStr.toIntOrNull() ?: 60

        val neighborhood = binding.actvNeighborhood.text.toString()
        val region = binding.actvRegion.text.toString()
        val description = binding.etDescription.text.toString()
        val instagram = binding.etInstagram.text.toString()
        val isActive = binding.switchIsActive.isChecked
        
        val amenities = mutableListOf<String>()
        if (binding.chipLockerRoom.isChecked) amenities.add("Vestiário")
        if (binding.chipBar.isChecked) amenities.add("Bar")
        if (binding.chipBBQ.isChecked) amenities.add("Churrasqueira")
        if (binding.chipParking.isChecked) amenities.add("Estacionamento")
        if (binding.chipWifi.isChecked) amenities.add("Wi-Fi")
        if (binding.chipGrandstand.isChecked) amenities.add("Arquibancada")

        if (name.isBlank() || address.isBlank()) {
            Toast.makeText(requireContext(), "Nome e Endereço são obrigatórios", Toast.LENGTH_SHORT).show()
            return
        }

        if (locationId != null) {
            viewModel.updateLocation(name, address, phone, openTime, closeTime, minDuration, region, neighborhood, description, amenities, isActive, instagram)
        } else {
            viewModel.createLocation(name, address, phone, openTime, closeTime, minDuration, region, neighborhood, description, amenities, isActive, instagram)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is LocationDetailUiState.Loading -> {
                        // Show loading?
                    }
                    is LocationDetailUiState.Success -> {
                        populateUi(state.location)
                        fieldAdapter.submitList(state.fields)
                        // reviewsAdapter.submitList(state.reviews)
                        
                        // Show fields section now that we have location
                        if (locationId == null && state.location.id.isNotEmpty()) {
                             locationId = state.location.id
                             binding.tvFieldsHeader.visibility = View.VISIBLE
                             binding.btnAddField.visibility = View.VISIBLE
                             binding.rvFields.visibility = View.VISIBLE
                             // binding.tvTitle.text = "Editar Local"
                             binding.btnSaveLocation.text = "Salvar Alterações"
                        }
                    }
                    is LocationDetailUiState.Error -> {
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun populateUi(location: Location) {
        // Only set text if view is not focused to avoid overwriting user while typing?
        // But this is usually called on load or after save.
        
        if (binding.etName.text.isNullOrBlank()) binding.etName.setText(location.name)
        if (binding.etAddress.text.isNullOrBlank()) binding.etAddress.setText(location.address)
        if (binding.etPhone.text.isNullOrBlank()) binding.etPhone.setText(location.phone)
        if (binding.etOpenTime.text.isNullOrBlank()) binding.etOpenTime.setText(location.openingTime)
        if (binding.etCloseTime.text.isNullOrBlank()) binding.etCloseTime.setText(location.closingTime)
        
        binding.actvMinDuration.setText(location.minGameDurationMinutes.toString(), false)
        binding.actvNeighborhood.setText(location.neighborhood, false)
        binding.actvRegion.setText(location.region, false)
        
        if (binding.etDescription.text.isNullOrBlank()) binding.etDescription.setText(location.description)
        if (binding.etInstagram.text.isNullOrBlank()) binding.etInstagram.setText(location.instagram)
        
        binding.switchIsActive.isChecked = location.isActive
        
        // Amenities
        binding.chipLockerRoom.isChecked = location.amenities.contains("Vestiário")
        binding.chipBar.isChecked = location.amenities.contains("Bar")
        binding.chipBBQ.isChecked = location.amenities.contains("Churrasqueira")
        binding.chipParking.isChecked = location.amenities.contains("Estacionamento")
        binding.chipWifi.isChecked = location.amenities.contains("Wi-Fi")
        binding.chipGrandstand.isChecked = location.amenities.contains("Arquibancada")
    }

    private fun showAddReviewDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_add_review, null)
        val ratingBar = dialogView.findViewById<android.widget.RatingBar>(R.id.ratingBar)
        val etComment = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etComment)

        MaterialAlertDialogBuilder(requireContext())
            .setView(dialogView)
            .setPositiveButton("Enviar") { _, _ ->
                val rating = ratingBar.rating
                val comment = etComment.text.toString()
                if (rating > 0.0f) {
                    viewModel.addReview(rating, comment)
                } else {
                    Toast.makeText(requireContext(), "Selecione uma nota", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
