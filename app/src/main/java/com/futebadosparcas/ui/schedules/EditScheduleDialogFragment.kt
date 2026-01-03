package com.futebadosparcas.ui.schedules

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import com.futebadosparcas.data.model.RecurrenceType
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.databinding.DialogEditScheduleBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.timepicker.MaterialTimePicker
import com.google.android.material.timepicker.TimeFormat
import java.util.Locale

class EditScheduleDialogFragment : BottomSheetDialogFragment() {

    private var _binding: DialogEditScheduleBinding? = null
    private val binding get() = _binding!!

    private var onSave: ((Schedule) -> Unit)? = null
    private lateinit var schedule: Schedule

    companion object {
        fun newInstance(schedule: Schedule, onSave: (Schedule) -> Unit): EditScheduleDialogFragment {
            val fragment = EditScheduleDialogFragment()
            fragment.schedule = schedule
            fragment.onSave = onSave
            return fragment
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogEditScheduleBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        setupClickListeners()
    }

    private fun setupUI() {
        binding.etName.setText(schedule.name)
        binding.etTime.setText(schedule.time)

        // Day of Week
        val days = arrayOf("Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado")
        val dayAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, days)
        binding.actvDayOfWeek.setAdapter(dayAdapter)
        binding.actvDayOfWeek.setText(days[schedule.dayOfWeek], false)

        // Recurrence Frequency
        val frequencies = arrayOf("Semanal", "Quinzenal", "Mensal")
        val freqAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, frequencies)
        binding.actvRecurrence.setAdapter(freqAdapter)
        
        val currentFreqStr = when(schedule.recurrenceType) {
            RecurrenceType.weekly -> "Semanal"
            RecurrenceType.biweekly -> "Quinzenal"
            RecurrenceType.monthly -> "Mensal"
        }
        binding.actvRecurrence.setText(currentFreqStr, false)
    }

    private fun setupClickListeners() {
        binding.etTime.setOnClickListener {
            val timeParts = schedule.time.split(":")
            val hour = timeParts.getOrNull(0)?.toIntOrNull() ?: 19
            val minute = timeParts.getOrNull(1)?.toIntOrNull() ?: 0

            val picker = MaterialTimePicker.Builder()
                .setTimeFormat(TimeFormat.CLOCK_24H)
                .setHour(hour)
                .setMinute(minute)
                .setTitleText("Selecione o Horário")
                .build()

            picker.addOnPositiveButtonClickListener {
                val formattedTime = String.format(Locale.getDefault(), "%02d:%02d", picker.hour, picker.minute)
                binding.etTime.setText(formattedTime)
            }
            picker.show(parentFragmentManager, "TIME_PICKER")
        }

        binding.btnCancel.setOnClickListener {
            dismiss()
        }

        binding.btnSave.setOnClickListener {
            val updatedSchedule = schedule.copy(
                name = binding.etName.text.toString(),
                time = binding.etTime.text.toString(),
                dayOfWeek = when(binding.actvDayOfWeek.text.toString()) {
                    "Domingo" -> 0
                    "Segunda-feira" -> 1
                    "Terça-feira" -> 2
                    "Quarta-feira" -> 3
                    "Quinta-feira" -> 4
                    "Sexta-feira" -> 5
                    "Sábado" -> 6
                    else -> schedule.dayOfWeek
                },
                recurrenceType = when(binding.actvRecurrence.text.toString()) {
                    "Semanal" -> RecurrenceType.weekly
                    "Quinzenal" -> RecurrenceType.biweekly
                    "Mensal" -> RecurrenceType.monthly
                    else -> schedule.recurrenceType
                }
            )
            onSave?.invoke(updatedSchedule)
            dismiss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
