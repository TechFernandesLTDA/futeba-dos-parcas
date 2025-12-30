package com.futebadosparcas.ui.games

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import com.futebadosparcas.R
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.databinding.DialogSelectPositionBinding

class SelectPositionDialog : DialogFragment() {

    private var _binding: DialogSelectPositionBinding? = null
    private val binding get() = _binding!!

    private var selectedPosition: PlayerPosition = PlayerPosition.FIELD
    private var maxGoalkeepers = 3
    private var currentGoalkeepers = 0
    private var onPositionSelected: ((PlayerPosition) -> Unit)? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogSelectPositionBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        arguments?.let {
            maxGoalkeepers = it.getInt(ARG_MAX_GOALKEEPERS, 3)
            currentGoalkeepers = it.getInt(ARG_CURRENT_GOALKEEPERS, 0)
        }

        setupUI()
        setupButtons()
    }

    private fun setupUI() {
        // Atualizar info de vagas de goleiro
        val availableSlots = maxGoalkeepers - currentGoalkeepers
        binding.tvGoalkeeperSlots.text = "$availableSlots de $maxGoalkeepers vagas disponíveis"

        // Desabilitar goleiro se nao houver vagas
        if (availableSlots <= 0) {
            binding.cardGoalkeeper.isEnabled = false
            binding.cardGoalkeeper.alpha = 0.5f
            binding.tvGoalkeeperSlots.text = "Vagas esgotadas"
            binding.tvGoalkeeperSlots.setTextColor(requireContext().getColor(R.color.error))

            // Selecionar linha por padrao
            selectField()
        } else {
            // Selecionar linha por padrao
            selectField()

            // Configurar cliques
            binding.cardGoalkeeper.setOnClickListener {
                selectGoalkeeper()
            }

            binding.cardField.setOnClickListener {
                selectField()
            }
        }
    }

    private fun selectGoalkeeper() {
        selectedPosition = PlayerPosition.GOALKEEPER

        binding.cardGoalkeeper.strokeColor = requireContext().getColor(R.color.primary)
        binding.cardGoalkeeper.strokeWidth = 4

        binding.cardField.strokeColor = requireContext().getColor(R.color.divider)
        binding.cardField.strokeWidth = 2
    }

    private fun selectField() {
        selectedPosition = PlayerPosition.FIELD

        binding.cardField.strokeColor = requireContext().getColor(R.color.primary)
        binding.cardField.strokeWidth = 4

        binding.cardGoalkeeper.strokeColor = requireContext().getColor(R.color.divider)
        binding.cardGoalkeeper.strokeWidth = 2
    }

    private fun setupButtons() {
        binding.btnCancelPosition.setOnClickListener {
            dismiss()
        }

        binding.btnConfirmPosition.setOnClickListener {
            onPositionSelected?.invoke(selectedPosition)
            dismiss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_MAX_GOALKEEPERS = "max_goalkeepers"
        private const val ARG_CURRENT_GOALKEEPERS = "current_goalkeepers"

        fun newInstance(
            maxGoalkeepers: Int = 3,
            currentGoalkeepers: Int = 0,
            onPositionSelected: (PlayerPosition) -> Unit
        ) = SelectPositionDialog().apply {
            arguments = Bundle().apply {
                putInt(ARG_MAX_GOALKEEPERS, maxGoalkeepers)
                putInt(ARG_CURRENT_GOALKEEPERS, currentGoalkeepers)
            }
            this.onPositionSelected = onPositionSelected
        }
    }
}
