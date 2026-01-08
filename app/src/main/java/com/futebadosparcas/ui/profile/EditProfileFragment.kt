package com.futebadosparcas.ui.profile

import android.app.DatePickerDialog
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.data.model.PerformanceRatingCalculator
import com.futebadosparcas.databinding.FragmentEditProfileBinding
import com.futebadosparcas.util.PreferencesManager
import com.google.android.material.textfield.MaterialAutoCompleteTextView
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class EditProfileFragment : Fragment() {

    private var _binding: FragmentEditProfileBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ProfileViewModel by viewModels()

    private var selectedImageUri: Uri? = null
    private var selectedBirthDate: Date? = null
    private val dateFormatter = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR"))

    private lateinit var genderEntries: Array<String>
    private lateinit var genderValues: Array<String>
    private lateinit var footEntries: Array<String>
    private lateinit var footValues: Array<String>
    private lateinit var positionEntries: Array<String>
    private lateinit var positionValues: Array<String>
    private lateinit var playStyleEntries: Array<String>
    private lateinit var playStyleValues: Array<String>

    @Inject
    lateinit var preferencesManager: PreferencesManager

    private var devModeClickCount = 0
    private var firstPhotoClickTime = 0L
    private var isUploadingPhoto = false

    private val selectImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            // Validar tamanho da imagem
            if (isImageSizeValid(it)) {
                selectedImageUri = it
                binding.ivProfile.setImageURI(it)
                Toast.makeText(
                    requireContext(),
                    "Imagem selecionada com sucesso",
                    Toast.LENGTH_SHORT
                ).show()
            } else {
                Toast.makeText(
                    requireContext(),
                    "Imagem muito grande. Tamanho máximo: 10 MB",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentEditProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupClickListeners()
        setupDropdowns()
        setupBirthDatePicker()
        observeViewModel()
        viewModel.loadProfile()
    }

    private fun setupClickListeners() {
        // Toolbar voltar
        binding.toolbar.setNavigationOnClickListener {
            findNavController().navigateUp()
        }

        // Card de foto clicável - abre seletor de imagens
        // E mantém o easter egg de dev mode (5 cliques em 2 segundos)
        binding.cardPhotoContainer.setOnClickListener {
            val currentTime = System.currentTimeMillis()

            // Reset se passou mais de 2 segundos desde o primeiro clique da sequência
            if (currentTime - firstPhotoClickTime > 2000) {
                devModeClickCount = 0
            }

            // Se é o primeiro clique da sequência, anota o tempo
            if (devModeClickCount == 0) {
                firstPhotoClickTime = currentTime
            }

            devModeClickCount++

            // Se atingiu 5 cliques em menos de 2 segundos, ativa dev mode
            if (devModeClickCount >= 5) {
                preferencesManager.setDevModeEnabled(true)
                Toast.makeText(requireContext(), "Opções de desenvolvedor ativadas", Toast.LENGTH_SHORT).show()
                devModeClickCount = 0
                firstPhotoClickTime = 0
            } else {
                // Caso contrário, abre seletor de foto
                selectImageLauncher.launch("image/*")
            }
        }

        // Botão Salvar (agora no final do formulário)
        binding.btnConfirm.setOnClickListener {
            confirmProfileChanges()
        }
    }

    private fun setupDropdowns() {
        genderEntries = resources.getStringArray(R.array.gender_entries)
        genderValues = resources.getStringArray(R.array.gender_values)
        footEntries = resources.getStringArray(R.array.dominant_foot_entries)
        footValues = resources.getStringArray(R.array.dominant_foot_values)
        positionEntries = resources.getStringArray(R.array.position_entries)
        positionValues = resources.getStringArray(R.array.position_values)
        playStyleEntries = resources.getStringArray(R.array.play_style_entries)
        playStyleValues = resources.getStringArray(R.array.play_style_values)

        binding.etGender.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, genderEntries)
        )
        binding.etDominantFoot.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, footEntries)
        )
        binding.etPrimaryPosition.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, positionEntries)
        )
        binding.etSecondaryPosition.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, positionEntries)
        )
        binding.etPlayStyle.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, playStyleEntries)
        )
    }

    private fun setupBirthDatePicker() {
        binding.tilBirthDate.setEndIconOnClickListener {
            openBirthDatePicker()
        }
        binding.etBirthDate.setOnClickListener {
            openBirthDatePicker()
        }
    }

    private fun openBirthDatePicker() {
        val calendar = Calendar.getInstance()
        selectedBirthDate?.let { calendar.time = it } ?: calendar.add(Calendar.YEAR, -18)

        DatePickerDialog(
            requireContext(),
            { _, year, month, dayOfMonth ->
                val selected = Calendar.getInstance().apply {
                    set(Calendar.YEAR, year)
                    set(Calendar.MONTH, month)
                    set(Calendar.DAY_OF_MONTH, dayOfMonth)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                selectedBirthDate = selected.time
                binding.etBirthDate.setText(dateFormatter.format(selected.time))
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    private fun mapEntryToValue(
        selected: String,
        entries: Array<String>,
        values: Array<String>
    ): String? {
        if (selected.isBlank()) return null
        val index = entries.indexOf(selected)
        return if (index >= 0 && index < values.size) values[index] else selected
    }

    private fun setDropdownValue(
        value: String?,
        entries: Array<String>,
        values: Array<String>,
        field: MaterialAutoCompleteTextView
    ) {
        if (value.isNullOrBlank()) {
            field.setText("", false)
            return
        }
        val index = values.indexOf(value)
        val displayValue = if (index >= 0 && index < entries.size) entries[index] else value
        field.setText(displayValue, false)
    }

    private fun formatRating(value: Double): String {
        if (value <= 0.0) return "-"
        return String.format(Locale.getDefault(), "%.1f", value)
    }

    private fun isImageSizeValid(uri: Uri): Boolean {
        return try {
            val cursor = requireContext().contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                val sizeIndex = it.getColumnIndex(android.provider.OpenableColumns.SIZE)
                it.moveToFirst()
                val sizeInBytes = it.getLong(sizeIndex)
                val sizeInMB = sizeInBytes / (1024 * 1024)
                sizeInMB <= 10 // Máximo de 10 MB
            } ?: false
        } catch (e: Exception) {
            true // Se não conseguir obter tamanho, permite o upload
        }
    }

    private fun confirmProfileChanges() {
        val name = binding.etName.text.toString()
        val nickname = binding.etNickname.text.toString()
        val preferredFieldTypes = mutableListOf<FieldType>()
        if (binding.cbSociety.isChecked) preferredFieldTypes.add(FieldType.SOCIETY)
        if (binding.cbFutsal.isChecked) preferredFieldTypes.add(FieldType.FUTSAL)
        if (binding.cbField.isChecked) preferredFieldTypes.add(FieldType.CAMPO)

        if (name.isNotBlank() && preferredFieldTypes.isNotEmpty()) {
            if (selectedImageUri != null) {
                isUploadingPhoto = true
            }

            val striker = binding.sliderStriker.value.toDouble()
            val mid = binding.sliderMid.value.toDouble()
            val def = binding.sliderDefender.value.toDouble()
            val gk = binding.sliderGk.value.toDouble()

            val gender = mapEntryToValue(binding.etGender.text.toString(), genderEntries, genderValues)
            val dominantFoot = mapEntryToValue(binding.etDominantFoot.text.toString(), footEntries, footValues)
            val primaryPosition = mapEntryToValue(binding.etPrimaryPosition.text.toString(), positionEntries, positionValues)
            val secondaryPosition = mapEntryToValue(binding.etSecondaryPosition.text.toString(), positionEntries, positionValues)
            val playStyle = mapEntryToValue(binding.etPlayStyle.text.toString(), playStyleEntries, playStyleValues)
            val experienceYears = binding.etExperienceYears.text?.toString()?.toIntOrNull()
            val heightCm = binding.etHeight.text?.toString()?.toIntOrNull()
            val weightKg = binding.etWeight.text?.toString()?.toIntOrNull()

            // Converter FieldType de domain para data.model temporariamente
            val legacyFieldTypes = preferredFieldTypes.map {
                com.futebadosparcas.data.model.FieldType.valueOf(it.name)
            }

            viewModel.updateProfile(
                name,
                nickname,
                legacyFieldTypes,
                selectedImageUri,
                striker,
                mid,
                def,
                gk,
                selectedBirthDate,
                gender,
                heightCm,
                weightKg,
                dominantFoot,
                primaryPosition,
                secondaryPosition,
                playStyle,
                experienceYears
            )
        } else {
            Toast.makeText(requireContext(), "Preencha o nome e selecione ao menos um tipo de campo", Toast.LENGTH_SHORT).show()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ProfileUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        // Animar card durante upload
                        if (isUploadingPhoto) {
                            animatePhotoUpload()
                            binding.uploadProgress.visibility = View.VISIBLE
                        }
                    }
                    is ProfileUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        isUploadingPhoto = false
                        binding.cardPhotoContainer.alpha = 1.0f
                        binding.uploadProgress.visibility = View.GONE
                        binding.etName.setText(state.user.name)
                        binding.etNickname.setText(state.user.nickname)
                        selectedBirthDate = state.user.birthDate?.let { java.util.Date(it) }
                        binding.etBirthDate.setText(
                            selectedBirthDate?.let { dateFormatter.format(it) } ?: ""
                        )

                        setDropdownValue(state.user.gender, genderEntries, genderValues, binding.etGender)
                        setDropdownValue(state.user.dominantFoot, footEntries, footValues, binding.etDominantFoot)
                        setDropdownValue(state.user.primaryPosition, positionEntries, positionValues, binding.etPrimaryPosition)
                        setDropdownValue(state.user.secondaryPosition, positionEntries, positionValues, binding.etSecondaryPosition)
                        setDropdownValue(state.user.playStyle, playStyleEntries, playStyleValues, binding.etPlayStyle)

                        binding.etHeight.setText(state.user.heightCm?.toString() ?: "")
                        binding.etWeight.setText(state.user.weightKg?.toString() ?: "")
                        binding.etExperienceYears.setText(state.user.experienceYears?.toString() ?: "")
                        state.user.photoUrl?.let {
                            binding.ivProfile.load(it) {
                                crossfade(true)
                                placeholder(R.drawable.ic_launcher_foreground)
                            }
                        }

                        binding.sliderStriker.value = kotlin.math.round(state.user.strikerRating).toFloat()
                        binding.sliderMid.value = kotlin.math.round(state.user.midRating).toFloat()
                        binding.sliderDefender.value = kotlin.math.round(state.user.defenderRating).toFloat()
                        binding.sliderGk.value = kotlin.math.round(state.user.gkRating).toFloat()

                        binding.cbSociety.isChecked = false
                        binding.cbFutsal.isChecked = false
                        binding.cbField.isChecked = false

                        state.user.preferredFieldTypes.forEach { fieldType ->
                            when (fieldType) {
                                FieldType.SOCIETY -> binding.cbSociety.isChecked = true
                                FieldType.FUTSAL -> binding.cbFutsal.isChecked = true
                                FieldType.CAMPO -> binding.cbField.isChecked = true
                                else -> {}
                            }
                        }

                        val autoRatings = state.statistics?.let { PerformanceRatingCalculator.fromStats(it) }
                        val sampleSize = autoRatings?.sampleSize ?: 0
                        binding.tvAutoRatingSubtitle.text = getString(
                            R.string.fragment_edit_profile_text_22,
                            sampleSize
                        )
                        binding.tvAutoStrikerValue.text = formatRating(autoRatings?.striker ?: 0.0)
                        binding.tvAutoMidValue.text = formatRating(autoRatings?.mid ?: 0.0)
                        binding.tvAutoDefValue.text = formatRating(autoRatings?.defender ?: 0.0)
                        binding.tvAutoGkValue.text = formatRating(autoRatings?.gk ?: 0.0)
                    }
                    is ProfileUiState.ProfileUpdateSuccess -> {
                        binding.progressBar.visibility = View.GONE
                        isUploadingPhoto = false
                        binding.cardPhotoContainer.alpha = 1.0f
                        binding.uploadProgress.visibility = View.GONE

                        // Recarregar a foto atualizada - adiciona timestamp para forçar novo fetch
                        state.user.photoUrl?.let { url ->
                            // Adiciona timestamp à URL para evitar cache em cloudflare/cdn
                            val urlWithTimestamp = if (url.contains("?")) {
                                "$url&ts=${System.currentTimeMillis()}"
                            } else {
                                "$url?ts=${System.currentTimeMillis()}"
                            }
                            binding.ivProfile.load(urlWithTimestamp) {
                                crossfade(true)
                                placeholder(R.drawable.ic_launcher_foreground)
                            }
                        }

                        Toast.makeText(requireContext(), "Perfil atualizado com sucesso!", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    }
                    is ProfileUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        isUploadingPhoto = false
                        binding.cardPhotoContainer.alpha = 1.0f
                        binding.uploadProgress.visibility = View.GONE
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_SHORT).show()
                    }
                    else -> {}
                }
            }
        }
    }

    private fun animatePhotoUpload() {
        val animation = android.animation.ObjectAnimator.ofFloat(
            binding.cardPhotoContainer,
            "alpha",
            1.0f,
            0.6f,
            1.0f
        ).apply {
            duration = 600
            repeatCount = android.animation.ValueAnimator.INFINITE
            repeatMode = android.animation.ValueAnimator.RESTART
        }
        animation.start()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
