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
import com.futebadosparcas.ui.components.SyncStatusBanner
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.futebadosparcas.ui.components.FutebaTopBar
import com.futebadosparcas.ui.home.components.ActivityFeedSection
import com.futebadosparcas.ui.home.components.PublicGamesSuggestions
import com.futebadosparcas.ui.home.components.StreakWidget
import com.futebadosparcas.ui.home.components.ChallengesSection
import com.futebadosparcas.ui.home.components.RecentBadgesCarousel
import com.futebadosparcas.ui.home.components.WelcomeEmptyState
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
        setupTopBar()
        setupComposeViews()
        observeViewModel()

        binding.swipeRefresh.setDebouncedRefreshListener(
            scope = viewLifecycleOwner.lifecycleScope,
            debounceTimeMs = 2000L
        ) {
            viewModel.loadHomeData()
        }

        viewModel.loadHomeData()



        binding.btnViewToggle?.setOnClickListener {
            viewModel.toggleViewMode()
        }
        
        // O clique no header é gerenciado pelo componente Compose ExpressiveHubHeader
        // para maior precisão e haptic feedback.
    }

    private fun setupRecyclerView() {
        gamesAdapter = UpcomingGamesAdapter { game ->
            val action = HomeFragmentDirections.actionHomeToGameDetail(game.id)
            findNavController().navigate(action)
        }

        binding.rvUpcomingGames.apply {
            adapter = gamesAdapter
            layoutManager = LinearLayoutManager(requireContext())
            setHasFixedSize(false)
            isNestedScrollingEnabled = false
        }

        gamesAdapter.registerAdapterDataObserver(object : androidx.recyclerview.widget.RecyclerView.AdapterDataObserver() {
            override fun onChanged() {
                _binding?.rvUpcomingGames?.post { _binding?.rvUpcomingGames?.requestLayout() }
            }

            override fun onItemRangeInserted(positionStart: Int, itemCount: Int) {
                _binding?.rvUpcomingGames?.post { _binding?.rvUpcomingGames?.requestLayout() }
            }

            override fun onItemRangeRemoved(positionStart: Int, itemCount: Int) {
                _binding?.rvUpcomingGames?.post { _binding?.rvUpcomingGames?.requestLayout() }
            }
        })
    }

    private fun setupComposeViews() {
        binding.composeConnectionStatus.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val isOnline by viewModel.isOnline.collectAsState()
                FutebaTheme {
                    SyncStatusBanner(isConnected = isOnline)
                }
            }
        }

        binding.composeStreak.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val uiState by viewModel.uiState.collectAsState()
                FutebaTheme {
                    if (uiState is HomeUiState.Success) {
                        val streak = (uiState as HomeUiState.Success).streak
                        StreakWidget(streak = streak)
                    }
                }
            }
        }

        binding.composeActivityFeed.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val uiState by viewModel.uiState.collectAsState()
                FutebaTheme {
                    if (uiState is HomeUiState.Success) {
                        val activities = (uiState as HomeUiState.Success).activities
                        ActivityFeedSection(activities = activities)
                    }
                }
            }
        }

        binding.composePublicGames.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val uiState by viewModel.uiState.collectAsState()
                FutebaTheme {
                    if (uiState is HomeUiState.Success) {
                        val publicGames = (uiState as HomeUiState.Success).publicGames
                        PublicGamesSuggestions(
                            games = publicGames,
                            onGameClick = { game ->
                                val action = HomeFragmentDirections.actionHomeToGameDetail(game.id)
                                findNavController().navigate(action)
                            }
                        )
                    }
                }
            }
        }

        binding.composeChallenges.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val uiState by viewModel.uiState.collectAsState()
                FutebaTheme {
                    if (uiState is HomeUiState.Success) {
                        val challenges = (uiState as HomeUiState.Success).challenges
                        ChallengesSection(challenges = challenges)
                    }
                }
            }
        }

        binding.composeStats?.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                 val uiState by viewModel.uiState.collectAsState()
                 FutebaTheme {
                     if (uiState is HomeUiState.Success) {
                         val stats = (uiState as HomeUiState.Success).statistics
                         com.futebadosparcas.ui.home.components.ExpandableStatsSection(statistics = stats ?: com.futebadosparcas.data.model.UserStatistics())
                     }
                 }
            }
        }
        
        binding.composeHeatmap?.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                 val uiState by viewModel.uiState.collectAsState()
                 FutebaTheme {
                     if (uiState is HomeUiState.Success) {
                         val activities = (uiState as HomeUiState.Success).activities
                         com.futebadosparcas.ui.home.components.ActivityHeatmapSection(activities = activities)
                     }
                 }
            }
        }

        binding.composeBadges.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val uiState by viewModel.uiState.collectAsState()
                FutebaTheme {
                    if (uiState is HomeUiState.Success) {
                        val badges = (uiState as HomeUiState.Success).recentBadges
                        RecentBadgesCarousel(badges = badges)
                    }
                }
            }
        }
    }

    private fun setupTopBar() {
        binding.composeTopBar.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val unreadCount by viewModel.unreadCount.collectAsState()
                FutebaTheme {
                    FutebaTopBar(
                        unreadCount = unreadCount,
                        onNavigateNotifications = { findNavController().navigate(R.id.action_global_notifications) },
                        onNavigateGroups = { findNavController().navigate(R.id.action_global_groups) },
                        onNavigateMap = { findNavController().navigate(R.id.action_global_map) }
                    )
                }
            }
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
                        binding.composeEmptyState.visibility = View.GONE
                    }
                    is HomeUiState.Success -> {
                        binding.shimmerViewContainer.stopShimmer()
                        binding.shimmerViewContainer.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.composeEmptyState.visibility = if (state.games.isEmpty()) View.VISIBLE else View.GONE
                        binding.rvUpcomingGames.visibility = if (state.games.isEmpty()) View.GONE else View.VISIBLE

                        // Configurar estado vazio com dados do usuário
                        if (state.games.isEmpty()) {
                            binding.composeEmptyState.apply {
                                setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
                                setContent {
                                    FutebaTheme {
                                        WelcomeEmptyState(
                                            userName = state.user.getDisplayName(),
                                            userLevel = state.user.level
                                        )
                                    }
                                }
                            }
                        }
                        
                        // Handle View Mode Toggle
                        val layoutManager = if (state.isGridView) {
                            androidx.recyclerview.widget.GridLayoutManager(requireContext(), 2)
                        } else {
                            LinearLayoutManager(requireContext())
                        }
                        
                        // Only change if different to avoid reset scroll
                        if (binding.rvUpcomingGames.layoutManager?.javaClass != layoutManager.javaClass) {
                            binding.rvUpcomingGames.layoutManager = layoutManager
                            binding.rvUpcomingGames.post { binding.rvUpcomingGames.requestLayout() }
                        }
                        
                        binding.btnViewToggle?.setIconResource(
                            if (state.isGridView) R.drawable.ic_view_list else R.drawable.ic_grid_view
                        )
                        
                        // Bind Expressive Compose Header
                        binding.composeHeader.apply {
                            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
                            setContent {
                                FutebaTheme {
                                    ExpressiveHubHeader(
                                        user = state.user,
                                        summary = state.gamificationSummary,
                                        statistics = state.statistics,
                                        hapticManager = hapticManager,
                                        onProfileClick = {
                                            if (!isAdded) return@ExpressiveHubHeader
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
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
