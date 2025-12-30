package com.futebadosparcas.ui.game_experience

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import androidx.recyclerview.widget.GridLayoutManager
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.databinding.FragmentMvpVoteBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MVPVoteFragment : Fragment() {

    private var _binding: FragmentMvpVoteBinding? = null
    private val binding get() = _binding!!

    private val viewModel: MVPVoteViewModel by viewModels()
    // Assuming navArgs will be generated. If not, I'll use arguments manually to be safe or add to nav graph later.
    // private val args: MVPVoteFragmentArgs by navArgs() 
    // For now I'll adhere to manual argument extraction to avoid compilation error if NavGraph isn't updated by me yet.
    
    private lateinit var adapter: VoteCandidatesAdapter
    private var gameId: String = ""

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentMvpVoteBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        gameId = arguments?.getString("gameId") ?: run {
            Toast.makeText(requireContext(), "Erro: Jogo não identificado", Toast.LENGTH_SHORT).show()
            findNavController().popBackStack()
            return
        }

        setupUI()
        observeViewModel()
        
        viewModel.loadCandidates(gameId)
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }

        adapter = VoteCandidatesAdapter { candidate ->
            val state = viewModel.uiState.value
            if (state is MVPVoteUiState.Voting) {
                viewModel.submitVote(gameId, candidate.userId, state.currentCategory)
            }
        }

        binding.rvCandidates.layoutManager = GridLayoutManager(requireContext(), 2)
        binding.rvCandidates.adapter = adapter

        binding.btnFinish.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.btnOwnerFinish.setOnClickListener {
             viewModel.finalizeVoting(gameId)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collectLatest { state ->
                when (state) {
                    is MVPVoteUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.votingContainer.visibility = View.GONE
                        binding.finishedContainer.visibility = View.GONE
                    }
                    is MVPVoteUiState.AlreadyVoted -> {
                        binding.progressBar.visibility = View.GONE
                        binding.votingContainer.visibility = View.GONE
                        binding.finishedContainer.visibility = View.VISIBLE
                        // Show owner finish button if owner
                        binding.btnOwnerFinish.visibility = if (state.isOwner) View.VISIBLE else View.GONE
                    }
                    is MVPVoteUiState.Voting -> {
                        binding.progressBar.visibility = View.GONE
                        binding.votingContainer.visibility = View.VISIBLE
                        binding.finishedContainer.visibility = View.GONE
                        
                        updateCategoryUI(state.currentCategory)
                        adapter.submitList(state.candidates)
                    }
                    is MVPVoteUiState.Finished -> {
                        binding.progressBar.visibility = View.GONE
                        binding.votingContainer.visibility = View.GONE
                        binding.finishedContainer.visibility = View.VISIBLE
                        binding.lottieSuccess.playAnimation()
                        
                        // Auto-navigate back after a short delay to see success
                        viewLifecycleOwner.lifecycleScope.launch {
                            kotlinx.coroutines.delay(2500)
                            if (isAdded) {
                                findNavController().popBackStack()
                            }
                        }
                    }
                    is MVPVoteUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_LONG).show()
                        if (state.message.contains("confirmado")) { // "Nenhum jogador confirmado"
                             findNavController().popBackStack()
                        }
                    }
                }
            }
        }
    }

    private fun updateCategoryUI(category: VoteCategory) {
        when (category) {
            VoteCategory.MVP -> {
                binding.tvCategoryTitle.text = "Quem foi o CRAQUE?"
                binding.tvCategoryDescription.text = "O melhor jogador da partida"
                binding.toolbar.title = "Votação (1/3)"
            }
            VoteCategory.BEST_GOALKEEPER -> {
                binding.tvCategoryTitle.text = "Melhor Goleiro?"
                binding.tvCategoryDescription.text = "Quem fechou o gol?"
                binding.toolbar.title = "Votação (2/3)"
            }
            VoteCategory.WORST -> {
                binding.tvCategoryTitle.text = "Bola Murcha?"
                binding.tvCategoryDescription.text = "Quem não jogou nada hoje?"
                binding.toolbar.title = "Votação (3/3)"
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
