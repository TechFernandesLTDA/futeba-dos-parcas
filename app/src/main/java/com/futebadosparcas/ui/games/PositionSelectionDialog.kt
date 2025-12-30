package com.futebadosparcas.ui.games

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.futebadosparcas.R
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.databinding.DialogPositionSelectionBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

/**
 * Dialog para seleção de posição (Goleiro/Linha) ao confirmar presença
 */
class PositionSelectionDialog : BottomSheetDialogFragment() {

    private var _binding: DialogPositionSelectionBinding? = null
    private val binding get() = _binding!!

    private var selectedPosition: PlayerPosition? = null
    private var onPositionSelected: ((PlayerPosition) -> Unit)? = null

    private var goalkeeperCount: Int = 0
    private var fieldCount: Int = 0
    private var maxGoalkeepers: Int = 2
    private var maxField: Int = 12

    companion object {
        private const val ARG_GOALKEEPER_COUNT = "goalkeeper_count"
        private const val ARG_FIELD_COUNT = "field_count"
        private const val ARG_MAX_GOALKEEPERS = "max_goalkeepers"
        private const val ARG_MAX_FIELD = "max_field"

        fun newInstance(
            goalkeeperCount: Int,
            fieldCount: Int,
            maxGoalkeepers: Int = 2,
            maxField: Int = 12,
            onPositionSelected: (PlayerPosition) -> Unit
        ): PositionSelectionDialog {
            return PositionSelectionDialog().apply {
                arguments = Bundle().apply {
                    putInt(ARG_GOALKEEPER_COUNT, goalkeeperCount)
                    putInt(ARG_FIELD_COUNT, fieldCount)
                    putInt(ARG_MAX_GOALKEEPERS, maxGoalkeepers)
                    putInt(ARG_MAX_FIELD, maxField)
                }
                this.onPositionSelected = onPositionSelected
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            goalkeeperCount = it.getInt(ARG_GOALKEEPER_COUNT, 0)
            fieldCount = it.getInt(ARG_FIELD_COUNT, 0)
            maxGoalkeepers = it.getInt(ARG_MAX_GOALKEEPERS, 2)
            maxField = it.getInt(ARG_MAX_FIELD, 12)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogPositionSelectionBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupUI()
        setupListeners()
        updateCounts()
    }

    private fun setupUI() {
        // Desabilitar goleiro se já estiver cheio
        if (goalkeeperCount >= maxGoalkeepers) {
            binding.cardGoalkeeper.isEnabled = false
            binding.cardGoalkeeper.alpha = 0.5f
        }

        // Desabilitar linha se já estiver cheio
        if (fieldCount >= maxField) {
            binding.cardField.isEnabled = false
            binding.cardField.alpha = 0.5f
        }
    }

    private fun setupListeners() {
        binding.cardGoalkeeper.setOnClickListener {
            if (goalkeeperCount < maxGoalkeepers) {
                selectPosition(PlayerPosition.GOALKEEPER)
            }
        }

        binding.cardField.setOnClickListener {
            if (fieldCount < maxField) {
                selectPosition(PlayerPosition.FIELD)
            }
        }

        binding.btnCancel.setOnClickListener {
            dismiss()
        }

        binding.btnConfirm.setOnClickListener {
            selectedPosition?.let { position ->
                onPositionSelected?.invoke(position)
                dismiss()
            }
        }
    }

    private fun selectPosition(position: PlayerPosition) {
        selectedPosition = position

        // Atualizar UI
        when (position) {
            PlayerPosition.GOALKEEPER -> {
                // Goleiro selecionado
                binding.cardGoalkeeper.strokeWidth = 4
                binding.cardGoalkeeper.strokeColor = requireContext().getColor(R.color.primary)
                binding.cardGoalkeeper.setCardBackgroundColor(requireContext().getColor(R.color.primary_container))
                binding.ivGoalkeeperCheck.visibility = View.VISIBLE

                // Desmarcar linha
                binding.cardField.strokeWidth = 2
                binding.cardField.strokeColor = requireContext().getColor(R.color.divider)
                binding.cardField.setCardBackgroundColor(requireContext().getColor(android.R.color.transparent))
                binding.ivFieldCheck.visibility = View.GONE
            }
            PlayerPosition.FIELD -> {
                // Linha selecionado
                binding.cardField.strokeWidth = 4
                binding.cardField.strokeColor = requireContext().getColor(R.color.primary)
                binding.cardField.setCardBackgroundColor(requireContext().getColor(R.color.primary_container))
                binding.ivFieldCheck.visibility = View.VISIBLE

                // Desmarcar goleiro
                binding.cardGoalkeeper.strokeWidth = 2
                binding.cardGoalkeeper.strokeColor = requireContext().getColor(R.color.divider)
                binding.cardGoalkeeper.setCardBackgroundColor(requireContext().getColor(android.R.color.transparent))
                binding.ivGoalkeeperCheck.visibility = View.GONE
            }
        }

        // Habilitar botão confirmar
        binding.btnConfirm.isEnabled = true
    }

    private fun updateCounts() {
        binding.tvGoalkeeperCount.text = "Goleiros: $goalkeeperCount/$maxGoalkeepers"
        binding.tvFieldCount.text = "Linha: $fieldCount/$maxField"

        // Avisos de lotação
        if (goalkeeperCount >= maxGoalkeepers) {
            binding.tvGoalkeeperCount.setTextColor(requireContext().getColor(R.color.error))
        }
        if (fieldCount >= maxField) {
            binding.tvFieldCount.setTextColor(requireContext().getColor(R.color.error))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
