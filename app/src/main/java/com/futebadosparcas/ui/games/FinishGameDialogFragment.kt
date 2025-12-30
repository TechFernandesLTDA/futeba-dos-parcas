package com.futebadosparcas.ui.games

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.FrameLayout

import com.futebadosparcas.databinding.DialogFinishGameBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class FinishGameDialogFragment : BottomSheetDialogFragment() {

    private var _binding: DialogFinishGameBinding? = null
    private val binding get() = _binding!!

    private var onFinishListener: ((scoreA: Int, scoreB: Int, mvpId: String?) -> Unit)? = null
    private var teamAName: String = "Time A"
    private var teamBName: String = "Time B"
    private var initialScoreA: Int = 0
    private var initialScoreB: Int = 0

    private var gameEvents: List<com.futebadosparcas.data.model.GameEvent> = emptyList()
    private var mvpCandidates: List<Pair<String, String>> = emptyList() // Id, Name

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogFinishGameBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvTeamAName.text = teamAName
        binding.tvTeamBName.text = teamBName
        
        binding.etScoreA.setText(initialScoreA.toString())
        binding.etScoreB.setText(initialScoreB.toString())
        
        setupHighlights()
        setupMvpDropdown()
        setupListeners()
    }

    private fun setupHighlights() {
        if (gameEvents.isEmpty()) {
            binding.tvSummaryTitle.visibility = View.GONE
            binding.rvHighlights.visibility = View.GONE
        } else {
            binding.tvSummaryTitle.visibility = View.VISIBLE
            binding.rvHighlights.visibility = View.VISIBLE
            val adapter = com.futebadosparcas.ui.livegame.LiveEventsAdapter()
            binding.rvHighlights.layoutManager = androidx.recyclerview.widget.LinearLayoutManager(requireContext())
            binding.rvHighlights.adapter = adapter
            // Only show main events (goals and cards) as highlights
            val highlights = gameEvents.filter { 
                it.eventType == com.futebadosparcas.data.model.GameEventType.GOAL.name ||
                it.eventType == com.futebadosparcas.data.model.GameEventType.RED_CARD.name
            }.sortedBy { it.minute }
            adapter.submitList(highlights)
        }
    }

    private fun setupMvpDropdown() {
        if (mvpCandidates.isEmpty()) {
            binding.tvMvpTitle.visibility = View.GONE
            binding.tilMvp.visibility = View.GONE
        } else {
            val adapter = ArrayAdapter(
                requireContext(),
                android.R.layout.simple_dropdown_item_1line,
                mvpCandidates.map { it.second }
            )
            binding.actMvp.setAdapter(adapter)
        }
    }

    private fun setupListeners() {
        binding.btnFinish.setOnClickListener {
            val scoreAText = binding.etScoreA.text.toString()
            val scoreBText = binding.etScoreB.text.toString()
            
            val scoreA = scoreAText.toIntOrNull()
            val scoreB = scoreBText.toIntOrNull()
            
            if (scoreA == null || scoreA < 0) {
                binding.etScoreA.error = "Valor inválido"
                return@setOnClickListener
            }
            binding.etScoreA.error = null

            if (scoreB == null || scoreB < 0) {
                binding.etScoreB.error = "Valor inválido"
                return@setOnClickListener
            }
            binding.etScoreB.error = null
            
            // Get selected MVP ID
            val selectedName = binding.actMvp.text.toString()
            val selectedMvpId = mvpCandidates.find { it.second == selectedName }?.first
            
            onFinishListener?.invoke(scoreA, scoreB, selectedMvpId)
            dismiss()
        }
    }

    fun setArgs(
        teamAName: String,
        teamBName: String,
        scoreA: Int,
        scoreB: Int,
        events: List<com.futebadosparcas.data.model.GameEvent> = emptyList(),
        candidates: List<Pair<String, String>> = emptyList(),
        onFinish: (Int, Int, String?) -> Unit
    ) {
        this.teamAName = teamAName
        this.teamBName = teamBName
        this.initialScoreA = scoreA
        this.initialScoreB = scoreB
        this.gameEvents = events
        this.mvpCandidates = candidates
        this.onFinishListener = onFinish
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet) as FrameLayout?
            bottomSheet?.let { sheet ->
                BottomSheetBehavior.from(sheet).state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        return dialog
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "FinishGameDialogFragment"
    }
}
