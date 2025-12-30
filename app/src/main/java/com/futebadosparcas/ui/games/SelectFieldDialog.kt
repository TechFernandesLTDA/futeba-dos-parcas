package com.futebadosparcas.ui.games

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.repository.LocationRepository
import com.futebadosparcas.databinding.DialogSelectFieldBinding
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SelectFieldDialog : DialogFragment() {

    private var _binding: DialogSelectFieldBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var locationRepository: LocationRepository

    private lateinit var fieldAdapter: FieldAdapter

    private var selectedField: Field? = null
    private var location: Location? = null
    private var allFields: List<Field> = emptyList()
    private var onFieldSelected: ((Field) -> Unit)? = null

    companion object {
        private const val TAG = "SelectFieldDialog"
        private const val ARG_LOCATION_ID = "location_id"
        private const val ARG_LOCATION_NAME = "location_name"

        fun newInstance(
            location: Location,
            onFieldSelected: (Field) -> Unit
        ): SelectFieldDialog {
            return SelectFieldDialog().apply {
                arguments = Bundle().apply {
                    putString(ARG_LOCATION_ID, location.id)
                    putString(ARG_LOCATION_NAME, location.name)
                }
                this.location = location
                this.onFieldSelected = onFieldSelected
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
        _binding = DialogSelectFieldBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val locationName = arguments?.getString(ARG_LOCATION_NAME) ?: ""
        binding.tvLocationName.text = locationName

        setupRecyclerView()
        setupFilterChips()
        setupButtons()
        loadFields()
    }

    private fun setupRecyclerView() {
        fieldAdapter = FieldAdapter { field ->
            selectedField = field
            fieldAdapter.setSelectedField(field.id)
            binding.btnConfirmField.isEnabled = true
        }

        binding.rvFields.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = fieldAdapter
        }
    }

    private fun setupFilterChips() {
        binding.chipGroupFieldType.setOnCheckedStateChangeListener { _, checkedIds ->
            val filteredFields = when {
                // Nenhum chip selecionado ou chip "Todos" selecionado
                checkedIds.isEmpty() || checkedIds.contains(R.id.chipAll) -> allFields
                // Filtros específicos
                checkedIds.contains(R.id.chipSociety) -> allFields.filter { it.type == FieldType.SOCIETY.name }
                checkedIds.contains(R.id.chipFutsal) -> allFields.filter { it.type == FieldType.FUTSAL.name }
                checkedIds.contains(R.id.chipCampo) -> allFields.filter { it.type == FieldType.CAMPO.name }
                // Fallback: mostrar todos
                else -> allFields
            }

            fieldAdapter.submitList(filteredFields)
            updateEmptyState(filteredFields.isEmpty())
        }
    }

    private fun loadFields() {
        val locationId = arguments?.getString(ARG_LOCATION_ID) ?: return

        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            val result = locationRepository.getFieldsByLocation(locationId)
            result.fold(
                onSuccess = { fields ->
                    allFields = fields
                    fieldAdapter.submitList(fields)
                    updateEmptyState(fields.isEmpty())
                },
                onFailure = { error ->
                    AppLogger.e(TAG, "Erro ao carregar quadras", error)
                    updateEmptyState(true)
                }
            )
            binding.progressBar.visibility = View.GONE
        }
    }

    private fun updateEmptyState(isEmpty: Boolean) {
        binding.tvEmptyState.visibility = if (isEmpty) View.VISIBLE else View.GONE
        binding.rvFields.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }

    private fun setupButtons() {
        binding.btnCancelField.setOnClickListener {
            dismiss()
        }

        binding.btnConfirmField.setOnClickListener {
            selectedField?.let { field ->
                onFieldSelected?.invoke(field)
                dismiss()
            }
        }
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.apply {
            setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
