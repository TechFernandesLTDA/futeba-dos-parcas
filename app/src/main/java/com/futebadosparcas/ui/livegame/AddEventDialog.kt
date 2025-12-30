package com.futebadosparcas.ui.livegame

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameEventType
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.databinding.DialogAddEventBinding
import com.futebadosparcas.data.repository.GameRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class AddEventDialog : DialogFragment() {

    private var _binding: DialogAddEventBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var gameRepository: GameRepository

    private val viewModel: LiveGameViewModel by viewModels(ownerProducer = { requireParentFragment() })

    private var team1: Team = Team()
    private var team2: Team = Team()
    private var gameId: String = ""

    private var selectedEventType = GameEventType.GOAL
    private var selectedTeam: Team? = null
    private val playerNames = mutableListOf<String>()
    private val playerIds = mutableMapOf<String, String>() // name -> id

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            gameId = it.getString(ARG_GAME_ID) ?: ""
            team1 = it.getSerializable(ARG_TEAM1) as? Team ?: Team()
            team2 = it.getSerializable(ARG_TEAM2) as? Team ?: Team()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogAddEventBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupEventTypeChips()
        setupTeamChips()
        setupButtons()
        loadPlayers()
    }

    private fun setupEventTypeChips() {
        binding.chipGroupEventType.setOnCheckedChangeListener { _, checkedId ->
            selectedEventType = when (checkedId) {
                R.id.chipGoal -> GameEventType.GOAL
                R.id.chipSave -> GameEventType.SAVE
                R.id.chipYellowCard -> GameEventType.YELLOW_CARD
                R.id.chipRedCard -> GameEventType.RED_CARD
                else -> GameEventType.GOAL
            }

            // Atualizar hints baseados no tipo
            when (selectedEventType) {
                GameEventType.GOAL -> {
                    binding.tilPlayer.hint = "Quem fez o Gol?"
                    binding.tilAssist.visibility = View.VISIBLE
                }
                GameEventType.SAVE -> {
                    binding.tilPlayer.hint = "Quem fez a Defesa?"
                    binding.tilAssist.visibility = View.GONE
                }
                GameEventType.YELLOW_CARD -> {
                    binding.tilPlayer.hint = "Quem tomou cartão Amarelo?"
                    binding.tilAssist.visibility = View.GONE
                }
                GameEventType.RED_CARD -> {
                    binding.tilPlayer.hint = "Quem tomou cartão Vermelho?"
                    binding.tilAssist.visibility = View.GONE
                }
                else -> {
                    binding.tilPlayer.hint = "Jogador"
                    binding.tilAssist.visibility = View.GONE
                }
            }
        }
    }

    private fun setupTeamChips() {
        // Ensure teams identify themselves clearly
        binding.chipTeam1.text = team1.name.ifEmpty { "Time 1" }
        binding.chipTeam2.text = team2.name.ifEmpty { "Time 2" }

        binding.chipGroupTeam.setOnCheckedChangeListener { _, checkedId ->
            selectedTeam = when (checkedId) {
                R.id.chipTeam1 -> team1
                R.id.chipTeam2 -> team2
                else -> team1
            }
            loadPlayers()
        }

        // Default selection
        // We need to set state of chips programmatically if not laid out yet?
        // Or just rely on default checked in XML? If XML has none, we force one.
        if (binding.chipGroupTeam.checkedChipId == View.NO_ID) {
            binding.chipTeam1.isChecked = true
            selectedTeam = team1
        } else {
             selectedTeam = when (binding.chipGroupTeam.checkedChipId) {
                 R.id.chipTeam1 -> team1
                 R.id.chipTeam2 -> team2
                 else -> team1
             }
        }
    }

    private fun loadPlayers() {
        lifecycleScope.launch {
            val team = selectedTeam ?: return@launch
            val confirmationsResult = gameRepository.getGameConfirmations(gameId)

             if (confirmationsResult.isSuccess) {
                val confirmations = confirmationsResult.getOrNull() ?: emptyList()
                // Filter players belonging to this team
                // IMPORTANT: The 'team' object must have 'playerIds' populated correctly.
                // If team.playerIds is empty (serialization issue?), this will fail to show players.
                // Fallback: IF team.playerIds is empty, we might want to show ALL confirmed players? No, that's confusing.
                // Let's assume LiveGameViewModel passed correct Teams.

                val teamConfirmations = confirmations.filter { team.playerIds.contains(it.userId) }

                playerNames.clear()
                playerIds.clear()

                teamConfirmations.forEach { conf ->
                    playerNames.add(conf.userName)
                    playerIds[conf.userName] = conf.userId
                }

                val adapter = ArrayAdapter(
                    requireContext(),
                    android.R.layout.simple_dropdown_item_1line,
                    playerNames
                )
                binding.actvPlayer.setAdapter(adapter)
                binding.actvAssist.setAdapter(adapter)
            }
        }
    }

    private fun setupButtons() {
        binding.btnCancel.setOnClickListener {
            dismiss()
        }

        binding.btnAdd.setOnClickListener {
            addEvent()
        }
    }

    private fun addEvent() {
        val playerName = binding.actvPlayer.text.toString()
        if (playerName.isEmpty()) {
            binding.tilPlayer.error = "Selecione um jogador"
            return
        }

        val playerId = playerIds[playerName] ?: return
        val team = selectedTeam ?: return
        val minute = binding.etMinute.text.toString().toIntOrNull() ?: 0

        val assistName = binding.actvAssist.text.toString()
        val assistId = if (assistName.isNotEmpty()) playerIds[assistName] else null

        when (selectedEventType) {
            GameEventType.GOAL -> {
                viewModel.addGoal(playerId, playerName, team.id, assistId, assistName, minute)
            }
            GameEventType.SAVE -> {
                viewModel.addSave(playerId, playerName, team.id, minute)
            }
            GameEventType.YELLOW_CARD -> {
                viewModel.addYellowCard(playerId, playerName, team.id, minute)
            }
            GameEventType.RED_CARD -> {
                viewModel.addRedCard(playerId, playerName, team.id, minute)
            }
            else -> {}
        }

        dismiss()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_GAME_ID = "game_id"
        private const val ARG_TEAM1 = "team1"
        private const val ARG_TEAM2 = "team2"

        fun newInstance(gameId: String, team1: Team, team2: Team) = AddEventDialog().apply {
            arguments = Bundle().apply {
                putString(ARG_GAME_ID, gameId)
                putSerializable(ARG_TEAM1, team1)
                putSerializable(ARG_TEAM2, team2)
            }
        }
    }
}
