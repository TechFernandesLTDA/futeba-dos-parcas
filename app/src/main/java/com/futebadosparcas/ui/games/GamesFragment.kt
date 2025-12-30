package com.futebadosparcas.ui.games

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.google.android.material.snackbar.Snackbar
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentGamesBinding
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.setDebouncedRefreshListener
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class GamesFragment : Fragment() {

    private var _binding: FragmentGamesBinding? = null
    private val binding get() = _binding!!

    private val viewModel: GamesViewModel by viewModels()
    private lateinit var gamesAdapter: GamesAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentGamesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupHeader()
        setupClickListeners()
        observeViewModel()

        // Initial load is handled by init block in VM or we can call here explicitly
        // viewModel.loadGames() // Already called in init with ALL

    }

    private fun setupHeader() {
        binding.btnNotifications.setOnClickListener {
            findNavController().navigate(R.id.action_global_notifications)
        }
        binding.btnGroups.setOnClickListener {
            findNavController().navigate(R.id.action_global_groups)
        }
        binding.btnMap.setOnClickListener {
            findNavController().navigate(R.id.action_global_map)
        }
    }

    private var allGames: List<GameWithConfirmations> = emptyList()
    private var currentFilterId: Int = R.id.chipAll

    private fun setupClickListeners() {
        binding.fabCreateGame.setOnClickListener {
            findNavController().navigate(R.id.action_games_to_createGame)
        }

        binding.btnEmptyAction.setOnClickListener {
            findNavController().navigate(R.id.action_games_to_createGame)
        }

        binding.swipeRefresh.setDebouncedRefreshListener(
            scope = viewLifecycleOwner.lifecycleScope,
            debounceTimeMs = 2000L
        ) {
            val filterType = when (binding.chipGroupFilters.checkedChipId) {
                R.id.chipOpen -> com.futebadosparcas.data.repository.GameFilterType.OPEN
                R.id.chipMyGames -> com.futebadosparcas.data.repository.GameFilterType.MY_GAMES
                else -> com.futebadosparcas.data.repository.GameFilterType.ALL
            }
            viewModel.loadGames(filterType)
        }

        binding.btnRetry.setOnClickListener {
            val filterType = when (binding.chipGroupFilters.checkedChipId) {
                R.id.chipOpen -> com.futebadosparcas.data.repository.GameFilterType.OPEN
                R.id.chipMyGames -> com.futebadosparcas.data.repository.GameFilterType.MY_GAMES
                else -> com.futebadosparcas.data.repository.GameFilterType.ALL
            }
            viewModel.loadGames(filterType)
        }

        binding.chipGroupFilters.setOnCheckedChangeListener { _, checkedId ->
            currentFilterId = checkedId
            val filterType = when (checkedId) {
                R.id.chipOpen -> com.futebadosparcas.data.repository.GameFilterType.OPEN
                R.id.chipMyGames -> com.futebadosparcas.data.repository.GameFilterType.MY_GAMES
                else -> com.futebadosparcas.data.repository.GameFilterType.ALL
            }
            viewModel.loadGames(filterType)
        }
    }

    private fun filterGames() {
        // Agora a filtragem é feita no ViewModel, aqui apenas atualizamos a UI baseada no allGames recebido
        gamesAdapter.submitList(allGames)
        
        if (allGames.isEmpty()) {
             // Se estamos num filtro específico e vazio, mostra empty
             // Se bem que o VM já manda Empty state se vazio, mas se vier Success([]) precisamos tratar
            binding.layoutEmpty.visibility = View.VISIBLE
            binding.rvGames.visibility = View.GONE
        } else {
             binding.layoutEmpty.visibility = View.GONE
             binding.rvGames.visibility = View.VISIBLE
        }
    }

    private fun setupRecyclerView() {
        gamesAdapter = GamesAdapter(
            onGameClick = { game ->
                try {
                    val action = GamesFragmentDirections.actionGamesToGameDetail(game.id)
                    findNavController().navigate(action)
                } catch (e: Exception) {
                    AppLogger.e(TAG, "ERRO na navegação: ${e.message}", e)
                }
            },
            onQuickConfirm = { game ->
                // Confirmar presença diretamente via ViewModel
                viewModel.quickConfirmPresence(game.id)
                showSnackbar("Confirmando presença em ${game.locationName}...")
            },
            onMapClick = { game ->
                try {
                    val address = game.locationAddress.ifEmpty { game.locationName }
                    val gmmIntentUri = android.net.Uri.parse("geo:0,0?q=${android.net.Uri.encode(address)}")
                    val mapIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, gmmIntentUri)
                    mapIntent.setPackage("com.google.android.apps.maps")
                    startActivity(mapIntent)
                } catch (e: Exception) {
                   showSnackbar("Não foi possível abrir o mapa", isError = true)
                }
            },
            onGameLongClick = { game ->
                // Long press desabilitado para usuários comuns - funcionalidade removida por segurança
                // A exclusão de jogos deve ser feita apenas através da tela de detalhes pelo owner/admin
                AppLogger.d(TAG) { "Long press no jogo ${game.id} - ação desabilitada" }
            }
        )

        binding.rvGames.apply {
            adapter = gamesAdapter
            layoutManager = LinearLayoutManager(requireContext())
            setHasFixedSize(true)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is GamesUiState.Loading -> showLoading()
                    is GamesUiState.Success -> {
                        showSuccess()
                        allGames = state.games
                        filterGames()
                    }
                    is GamesUiState.Error -> showError(state.message)
                    is GamesUiState.Empty -> showEmpty()
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.unreadCount.collect { count ->
                binding.tvNotificationBadge.apply {
                    text = count.toString()
                    visibility = if (count > 0) View.VISIBLE else View.GONE
                }
            }
        }
    }

    private fun showLoading() {
        binding.apply {
            if (!swipeRefresh.isRefreshing) {
                shimmerViewContainer.visibility = View.VISIBLE
                shimmerViewContainer.startShimmer()
                rvGames.visibility = View.GONE
            } else {
                // If refreshing, keep list visible or at least don't start shimmer over it
                // usually we keep list
            }
            progressBar.visibility = View.GONE // Ensure old progress bar is gone
            layoutEmpty.visibility = View.GONE
            layoutError.visibility = View.GONE
        }
    }

    private fun showSuccess() {
        binding.apply {
            shimmerViewContainer.stopShimmer()
            shimmerViewContainer.visibility = View.GONE
            progressBar.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            layoutEmpty.visibility = View.GONE
            layoutError.visibility = View.GONE
            rvGames.visibility = View.VISIBLE
        }
    }

    private fun showEmpty() {
        binding.apply {
            shimmerViewContainer.stopShimmer()
            shimmerViewContainer.visibility = View.GONE
            progressBar.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            layoutEmpty.visibility = View.VISIBLE
            layoutError.visibility = View.GONE
            rvGames.visibility = View.GONE
        }
    }

    private fun showError(message: String) {
        binding.apply {
            shimmerViewContainer.stopShimmer()
            shimmerViewContainer.visibility = View.GONE
            progressBar.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            layoutEmpty.visibility = View.GONE
            layoutError.visibility = View.VISIBLE
            rvGames.visibility = View.GONE
            tvErrorMessage.text = message
        }

        AppLogger.e(TAG, "Erro: $message")
        showSnackbar(message, isError = true)
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

    companion object {
        private const val TAG = "GamesFragment"
    }
}
