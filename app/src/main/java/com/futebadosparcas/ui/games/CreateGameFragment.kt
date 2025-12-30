package com.futebadosparcas.ui.games

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.futebadosparcas.R
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.databinding.FragmentCreateGameBinding
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.threeten.bp.format.DateTimeFormatter
import android.text.Editable
import android.text.TextWatcher
import java.util.Calendar

@AndroidEntryPoint
class CreateGameFragment : Fragment() {

    private var _binding: FragmentCreateGameBinding? = null
    private val binding get() = _binding!!

    private val viewModel: CreateGameViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCreateGameBinding.inflate(inflater, container, false)
        return binding.root
    }

    private val args: CreateGameFragmentArgs by navArgs()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        setupClickListeners()
        setupValidation()
        observeViewModel()

        args.gameId?.let { id ->
            viewModel.loadGame(id)
            binding.btnSaveGame.text = "Salvar Alterações"
            binding.tvTitle.text = "Editar Jogo"
        }
    }

    private fun setupUI() {
        val recurrenceOptions = resources.getStringArray(R.array.recurrence_options)
        val recurrenceAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, recurrenceOptions)
        binding.actvRecurrence.setAdapter(recurrenceAdapter)
    }

    private fun setupValidation() {
        val textWatcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                binding.tilOwnerName.error = null
                binding.tilPrice.error = null
                binding.tilMaxPlayers.error = null
            }
            override fun afterTextChanged(s: Editable?) {}
        }

        binding.etOwnerName.addTextChangedListener(textWatcher)
        binding.etPrice.addTextChangedListener(textWatcher)
        binding.etMaxPlayers.addTextChangedListener(textWatcher)

        // For non-text fields, errors are cleared in their respective pickers/dialogs if needed
    }

    private fun setupClickListeners() {
        binding.btnCancel.setOnClickListener {
            findNavController().popBackStack()
        }

        // Selecionar Local
        binding.cardSelectLocation.setOnClickListener {
            showLocationDialog()
        }

        // Selecionar Quadra (apenas se local já foi selecionado)
        binding.cardSelectField.setOnClickListener {
            viewModel.selectedLocation.value?.let { location ->
                showFieldDialog(location)
            }
        }

        binding.etDate.setOnClickListener {
            showDatePicker()
        }

        binding.etTime.setOnClickListener {
            showTimePicker(isEndTime = false)
        }

        binding.etEndTime.setOnClickListener {
            showTimePicker(isEndTime = true)
        }

        binding.switchRecurrence.setOnCheckedChangeListener { _, isChecked ->
            binding.tilRecurrence.visibility = if (isChecked) View.VISIBLE else View.GONE
        }

        binding.btnSaveGame.setOnClickListener {
            val recurrenceMap = mapOf(
                "Semanal" to "weekly",
                "Quinzenal" to "biweekly",
                "Mensal" to "monthly",
                "Não se repete" to "none"
            )

            viewModel.saveGame(
                gameId = args.gameId,
                ownerName = binding.etOwnerName.text.toString(),
                price = binding.etPrice.text.toString().toDoubleOrNull() ?: 0.0,
                maxPlayers = binding.etMaxPlayers.text.toString().toIntOrNull() ?: 14,
                recurrence = if (binding.switchRecurrence.isChecked) {
                    recurrenceMap[binding.actvRecurrence.text.toString()] ?: "none"
                } else {
                    "none"
                }
            )
        }
    }

    private fun showLocationDialog() {
        val dialog = SelectLocationDialog.newInstance { location ->
            viewModel.setLocation(location)
        }
        dialog.show(parentFragmentManager, "SelectLocationDialog")
    }

    private fun showFieldDialog(location: Location) {
        val dialog = SelectFieldDialog.newInstance(location) { field ->
            viewModel.setField(field)
        }
        dialog.show(parentFragmentManager, "SelectFieldDialog")
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Observar estado da UI
                launch {
                    viewModel.uiState.collect { state ->
                        binding.progressBar.visibility = if (state is CreateGameUiState.Loading) View.VISIBLE else View.GONE

                        when (state) {
                            is CreateGameUiState.Success -> {
                                val message = if (args.gameId != null) "Jogo atualizado!" else "Jogo agendado!"
                                showSnackbar(message)
                                findNavController().popBackStack()
                            }
                            is CreateGameUiState.Editing -> {
                                val game = state.game
                                binding.etOwnerName.setText(game.ownerName)
                                binding.etPrice.setText(game.dailyPrice.toString())
                                binding.etMaxPlayers.setText(game.maxPlayers.toString())
                                val hasRecurrence = game.recurrence != "none" && game.recurrence.isNotEmpty()
                                binding.switchRecurrence.isChecked = hasRecurrence
                                binding.tilRecurrence.visibility = if (hasRecurrence) View.VISIBLE else View.GONE
                                
                                binding.actvRecurrence.setText(
                                    when(game.recurrence) {
                                        "weekly" -> "Semanal"
                                        "biweekly" -> "Quinzenal"
                                        "monthly" -> "Mensal"
                                        else -> "Semanal" // Default value if turning recurrence on
                                    },
                                    false
                                )
                            }
                            is CreateGameUiState.Error -> {
                                showSnackbar(state.message, isError = true)
                                handleValidationError(state.message)
                                viewModel.clearConflictState()
                            }
                            is CreateGameUiState.ConflictDetected -> {
                                binding.cardConflictWarning.visibility = View.VISIBLE
                                val conflicts = state.conflicts
                                if (conflicts.isNotEmpty()) {
                                    val conflict = conflicts.first()
                                    binding.tvConflictMessage.text = "Conflito com ${conflict.conflictingGame.ownerName} (${conflict.conflictingGame.time} - ${conflict.conflictingGame.endTime})"
                                }
                            }
                            else -> {
                                binding.cardConflictWarning.visibility = View.GONE
                            }
                        }
                    }
                }

                // Observar local selecionado
                launch {
                    viewModel.selectedLocation.collect { location ->
                        if (location != null) {
                            binding.tvSelectedLocation.text = location.name
                            binding.tvLocationAddress.text = location.getFullAddress()
                            binding.tvLocationAddress.visibility = View.VISIBLE
                            binding.cardSelectField.visibility = View.VISIBLE
                        } else {
                            binding.tvSelectedLocation.text = "Toque para selecionar"
                            binding.tvLocationAddress.visibility = View.GONE
                            binding.cardSelectField.visibility = View.GONE
                        }
                    }
                }

                // Observar quadra selecionada
                launch {
                    viewModel.selectedField.collect { field ->
                        if (field != null) {
                            binding.tvSelectedField.text = field.name
                            binding.chipFieldType.visibility = View.VISIBLE
                            binding.chipFieldType.text = field.getTypeEnum().displayName
                            binding.chipFieldType.setChipBackgroundColorResource(
                                when (field.getTypeEnum()) {
                                    FieldType.FUTSAL -> R.color.chip_futsal
                                    FieldType.SOCIETY -> R.color.chip_society
                                    FieldType.CAMPO -> R.color.chip_campo
                                    else -> R.color.chip_society
                                }
                            )
                        } else {
                            binding.tvSelectedField.text = "Toque para selecionar"
                            binding.chipFieldType.visibility = View.GONE
                        }
                    }
                }

                // Observar conflitos
                launch {
                    viewModel.timeConflicts.collect { conflicts ->
                        if (conflicts.isEmpty()) {
                            binding.cardConflictWarning.visibility = View.GONE
                        }
                    }
                }

                launch {
                    viewModel.selectedDate.collect { date ->
                        date?.let {
                            val formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")
                            binding.etDate.setText(it.format(formatter))
                        }
                    }
                }

                launch {
                    viewModel.selectedTime.collect { time ->
                        time?.let {
                            val formatter = DateTimeFormatter.ofPattern("HH:mm")
                            binding.etTime.setText(it.format(formatter))
                        }
                    }
                }

                launch {
                    viewModel.selectedEndTime.collect { time ->
                        time?.let {
                            val formatter = DateTimeFormatter.ofPattern("HH:mm")
                            binding.etEndTime.setText(it.format(formatter))
                        }
                    }
                }

                launch {
                    viewModel.currentUser.collect { name ->
                        if (binding.etOwnerName.text.isNullOrEmpty()) {
                            binding.etOwnerName.setText(name)
                        }
                    }
                }

                // Observar grupos disponíveis
                launch {
                    viewModel.availableGroups.collect { groups ->
                        if (groups.isNotEmpty()) {
                            binding.tilGroup.visibility = View.VISIBLE
                            binding.actvGroup.isEnabled = true
                            binding.btnSaveGame.isEnabled = true
                            
                            val groupNames = groups.map { it.groupName }
                            val groupAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, groupNames)
                            binding.actvGroup.setAdapter(groupAdapter)
                            
                            binding.actvGroup.setOnItemClickListener { _, _, position, _ ->
                                val selectedGroup = groups[position]
                                viewModel.selectGroup(selectedGroup)
                            }
                        } else {
                            binding.tilGroup.visibility = View.VISIBLE
                            binding.actvGroup.isEnabled = false
                            binding.actvGroup.setText("Crie um grupo primeiro", false)
                            binding.btnSaveGame.isEnabled = false
                            showSnackbar("Você precisa criar um grupo antes de agendar um jogo", isError = true)
                        }
                    }
                }

                // Observar grupo selecionado (para carregar em edição)
                launch {
                    viewModel.selectedGroup.collect { group ->
                        if (group != null) {
                            binding.actvGroup.setText(group.groupName, false)
                        } else {
                            binding.actvGroup.setText("", false)
                        }
                    }
                }
            }
        }
    }

    private fun showDatePicker() {
        // Configurar para não permitir datas passadas
        val constraintsBuilder = com.google.android.material.datepicker.CalendarConstraints.Builder()
            .setStart(System.currentTimeMillis()) // Data mínima é hoje
            .setValidator(com.google.android.material.datepicker.DateValidatorPointForward.now())

        val datePicker = com.google.android.material.datepicker.MaterialDatePicker.Builder.datePicker()
            .setTitleText("Selecione a data do jogo")
            .setSelection(com.google.android.material.datepicker.MaterialDatePicker.todayInUtcMilliseconds())
            .setCalendarConstraints(constraintsBuilder.build())
            .setTheme(com.google.android.material.R.style.ThemeOverlay_Material3_MaterialCalendar)
            .build()

        datePicker.addOnPositiveButtonClickListener { selection ->
            val calendar = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
            calendar.timeInMillis = selection

            viewModel.setDate(
                calendar.get(Calendar.YEAR),
                calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH)
            )
        }

        datePicker.show(parentFragmentManager, "DATE_PICKER")
    }

    private fun showTimePicker(isEndTime: Boolean) {
        val hour = if (isEndTime) 20 else 19
        val minute = 0

        val timePicker = com.google.android.material.timepicker.MaterialTimePicker.Builder()
            .setTimeFormat(com.google.android.material.timepicker.TimeFormat.CLOCK_24H)
            .setHour(hour)
            .setMinute(minute)
            .setTitleText(if (isEndTime) "Horário de término" else "Horário de início")
            .setInputMode(com.google.android.material.timepicker.MaterialTimePicker.INPUT_MODE_CLOCK)
            .build()

        timePicker.addOnPositiveButtonClickListener {
            if (isEndTime) {
                viewModel.setEndTime(timePicker.hour, timePicker.minute)
            } else {
                viewModel.setTime(timePicker.hour, timePicker.minute)
            }
        }

        timePicker.show(parentFragmentManager, "TIME_PICKER")
    }

    private fun handleValidationError(message: String) {
        when {
            message.contains("local", ignoreCase = true) -> showSnackbar(message, isError = true)
            message.contains("quadra", ignoreCase = true) -> showSnackbar(message, isError = true)
            message.contains("data", ignoreCase = true) -> binding.tilDate.error = message
            message.contains("início", ignoreCase = true) -> binding.tilTime.error = message
            message.contains("término", ignoreCase = true) -> binding.tilEndTime.error = message
            message.contains("responsável", ignoreCase = true) -> binding.tilOwnerName.error = message
            message.contains("preço", ignoreCase = true) -> binding.tilPrice.error = message
            message.contains("jogadores", ignoreCase = true) -> binding.tilMaxPlayers.error = message
        }
    }

    private fun showSnackbar(message: String, isError: Boolean = false) {
        val snackbar = Snackbar.make(binding.root, message, Snackbar.LENGTH_LONG)
        if (isError) {
            snackbar.setBackgroundTint(requireContext().getColor(R.color.error))
            snackbar.setTextColor(requireContext().getColor(R.color.on_error))
        }
        snackbar.show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
