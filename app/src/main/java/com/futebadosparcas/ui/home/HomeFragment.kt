package com.futebadosparcas.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentHomeBinding
import androidx.compose.ui.platform.ViewCompositionStrategy
import com.futebadosparcas.ui.home.components.ExpressiveHubHeader
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.HapticManager
import com.futebadosparcas.util.setDebouncedRefreshListener
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    @javax.inject.Inject
    lateinit var hapticManager: HapticManager

    private val viewModel: HomeViewModel by viewModels()
    private lateinit var gamesAdapter: UpcomingGamesAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        observeViewModel()

        binding.swipeRefresh.setDebouncedRefreshListener(
            scope = viewLifecycleOwner.lifecycleScope,
            debounceTimeMs = 2000L
        ) {
            viewModel.loadHomeData()
        }

        viewModel.loadHomeData()

        binding.fabCreateGame.setOnClickListener {
            val action = HomeFragmentDirections.actionHomeToCreateGame(gameId = null)
            findNavController().navigate(action)
        }

        binding.btnMap?.setOnClickListener {
            findNavController().navigate(R.id.action_global_map)
        }

        binding.btnGroups?.setOnClickListener {
            findNavController().navigate(R.id.action_global_groups)
        }

        binding.btnNotifications?.setOnClickListener {
            findNavController().navigate(R.id.action_global_notifications)
        }
        
        // Clique no header para abrir Player Card
        binding.headerUserInfo.setOnClickListener {
            val currentUserId = viewModel.getCurrentUserId()
            if (currentUserId != null) {
                val playerCard = com.futebadosparcas.ui.player.PlayerCardDialog.newInstance(currentUserId)
                playerCard.show(childFragmentManager, "PlayerCard")
            }
        }
    }

    private fun setupRecyclerView() {
        gamesAdapter = UpcomingGamesAdapter { game ->
            val action = HomeFragmentDirections.actionHomeToGameDetail(game.id)
            findNavController().navigate(action)
        }

        binding.rvUpcomingGames.apply {
            adapter = gamesAdapter
            layoutManager = LinearLayoutManager(requireContext())
            setHasFixedSize(true)
            isNestedScrollingEnabled = false
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is HomeUiState.Loading -> {
                        if (!binding.swipeRefresh.isRefreshing) {
                            binding.shimmerViewContainer.visibility = View.VISIBLE
                            binding.shimmerViewContainer.startShimmer()
                        }
                        binding.layoutEmpty.root.visibility = View.GONE
                    }
                    is HomeUiState.Success -> {
                        binding.shimmerViewContainer.stopShimmer()
                        binding.shimmerViewContainer.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.layoutEmpty.root.visibility = if (state.games.isEmpty()) View.VISIBLE else View.GONE
                        binding.rvUpcomingGames.visibility = if (state.games.isEmpty()) View.GONE else View.VISIBLE
                        
                        // Bind Expressive Compose Header
                        binding.composeHeader.apply {
                            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
                            setContent {
                                FutebaTheme {
                                    ExpressiveHubHeader(
                                        user = state.user,
                                        summary = state.gamificationSummary,
                                        hapticManager = hapticManager,
                                        onProfileClick = {
                                            val playerCard = com.futebadosparcas.ui.player.PlayerCardDialog.newInstance(state.user.id)
                                            playerCard.show(childFragmentManager, "PlayerCard")
                                        }
                                    )
                                }
                            }
                        }

                        gamesAdapter.submitList(state.games)
                    }
                    is HomeUiState.Error -> {
                        binding.shimmerViewContainer.stopShimmer()
                        binding.shimmerViewContainer.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        com.google.android.material.snackbar.Snackbar.make(
                            binding.root,
                            state.message,
                            com.google.android.material.snackbar.Snackbar.LENGTH_LONG
                        ).setAction("Tentar Novamente") {
                            viewModel.loadHomeData()
                        }.show()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.unreadCount.collect { count ->
                val badge = binding.tvNotificationBadge
                if (count > 0) {
                    badge.text = if (count > 99) "99+" else count.toString()
                    badge.visibility = View.VISIBLE
                } else {
                    badge.visibility = View.GONE
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
