package com.futebadosparcas.ui.players

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentPlayersBinding
import com.futebadosparcas.ui.components.FutebaTopBar
import com.futebadosparcas.data.model.PlayerRatingRole
import com.futebadosparcas.data.model.User
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.util.Locale

@AndroidEntryPoint
class PlayersFragment : Fragment() {

    private var _binding: FragmentPlayersBinding? = null
    private val binding get() = _binding!!

    private val viewModel: PlayersViewModel by viewModels()
    private lateinit var adapter: PlayersAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPlayersBinding.inflate(inflater, container, false)
        return binding.root
    }

    private var isComparisonMode = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupRecyclerView()
        setupTopBar()
        setupHeader()
        setupListeners()
        observeViewModel()

    }

    private fun setupTopBar() {
        binding.composeTopBar.apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                val unreadCount by viewModel.unreadCount.collectAsState()
                FutebaTheme {
                    FutebaTopBar(
                        unreadCount = unreadCount,
                        onNavigateNotifications = { findNavController().navigate(com.futebadosparcas.R.id.action_global_notifications) },
                        onNavigateGroups = { findNavController().navigate(com.futebadosparcas.R.id.action_global_groups) },
                        onNavigateMap = { findNavController().navigate(com.futebadosparcas.R.id.action_global_map) }
                    )
                }
            }
        }
    }

    private fun setupHeader() {
        binding.btnCompare.setOnClickListener {
            toggleComparisonMode()
        }

    }

    private fun toggleComparisonMode() {
        isComparisonMode = !isComparisonMode
        adapter.setSelectionMode(isComparisonMode)
        
        if (isComparisonMode) {
            android.widget.Toast.makeText(requireContext(), "Selecione 2 jogadores para comparar", android.widget.Toast.LENGTH_SHORT).show()
            binding.btnCompare.setIconResource(com.futebadosparcas.R.drawable.ic_close)
            binding.btnCompare.setIconTintResource(com.futebadosparcas.R.color.error)
        } else {
            binding.btnCompare.setIconResource(com.futebadosparcas.R.drawable.ic_compare)
            binding.btnCompare.setIconTintResource(com.futebadosparcas.R.color.on_surface_variant)
        }
    }

    private fun checkComparisonSelection() {
        val selectedIds = adapter.getSelectedIds()
        if (selectedIds.size == 2) {
            val list = viewModel.uiState.value
            if (list is PlayersUiState.Success) {
                val u1 = list.players.find { it.id == selectedIds.elementAt(0) }
                val u2 = list.players.find { it.id == selectedIds.elementAt(1) }
                
                if (u1 != null && u2 != null) {
                    // Delega para o ViewModel buscar dados e atualizar estado
                    viewModel.loadComparisonData(u1, u2)
                } else {
                     android.widget.Toast.makeText(requireContext(), "Erro: Jogadores selecionados não encontrados.", android.widget.Toast.LENGTH_SHORT).show()
                     toggleComparisonMode()
                }
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = PlayersAdapter(
            onInviteClick = { user ->
                viewModel.invitePlayer(user)
            },
            onItemClick = { user -> 
                if (isComparisonMode) {
                    adapter.toggleSelection(user.id)
                    checkComparisonSelection()
                } else {
                    val playerCard = com.futebadosparcas.ui.player.PlayerCardDialog.newInstance(user.id)
                    playerCard.show(childFragmentManager, "PlayerCard")
                }
            }
        )
        binding.rvPlayers.apply {
            layoutManager = androidx.recyclerview.widget.LinearLayoutManager(context)
            adapter = this@PlayersFragment.adapter
        }
    }

    private fun setupListeners() {
        binding.etSearch.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                viewModel.searchPlayers(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })

        // Filtro por tipo de campo
        binding.chipGroupFieldType.setOnCheckedStateChangeListener { _, checkedIds ->
            val checkedId = checkedIds.firstOrNull() ?: View.NO_ID
            val fieldType = when (checkedId) {
                com.futebadosparcas.R.id.chipSociety -> com.futebadosparcas.data.model.FieldType.SOCIETY
                com.futebadosparcas.R.id.chipFutsal -> com.futebadosparcas.data.model.FieldType.FUTSAL
                com.futebadosparcas.R.id.chipCampo -> com.futebadosparcas.data.model.FieldType.CAMPO
                else -> null // chipAll
            }
            viewModel.setFieldTypeFilter(fieldType)
        }

        // Ordenação
        binding.chipGroupSort.setOnCheckedStateChangeListener { _, checkedIds ->
            val checkedId = checkedIds.firstOrNull() ?: View.NO_ID
            val sortOption = when (checkedId) {
                com.futebadosparcas.R.id.chipSortStriker -> PlayersViewModel.SortOption.BEST_STRIKER
                com.futebadosparcas.R.id.chipSortGK -> PlayersViewModel.SortOption.BEST_GK
                else -> PlayersViewModel.SortOption.NAME // chipSortName
            }
            viewModel.setSortOption(sortOption)
        }
        // Swipe Refresh
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadPlayers(binding.etSearch.text.toString())
        }
    }



    private fun observeViewModel() {
        // UI State Observer
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is PlayersUiState.Loading -> {
                        if (!binding.swipeRefresh.isRefreshing) {
                            binding.progressBar.visibility = View.VISIBLE
                        }
                        binding.rvPlayers.visibility = View.GONE
                    }
                    is PlayersUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.rvPlayers.visibility = View.VISIBLE
                        adapter.submitList(state.players)
                    }
                    is PlayersUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        android.widget.Toast.makeText(requireContext(), state.message, android.widget.Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        // Comparison State Observer
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.comparisonState.collect { state ->
                when (state) {
                    is ComparisonUiState.Ready -> {
                        if (childFragmentManager.findFragmentByTag(ComparePlayersDialogFragment.TAG) == null) {
                             val dialog = ComparePlayersDialogFragment()
                             dialog.setPlayers(state.user1, state.stats1, state.user2, state.stats2)
                             dialog.show(childFragmentManager, ComparePlayersDialogFragment.TAG)
                             
                             // Close mode and reset state
                             toggleComparisonMode()
                             viewModel.resetComparison()
                        }
                    }
                    is ComparisonUiState.Error -> {
                        android.widget.Toast.makeText(requireContext(), state.message, android.widget.Toast.LENGTH_SHORT).show()
                        viewModel.resetComparison()
                    }
                    is ComparisonUiState.Loading -> {
                        // Poderia mostrar loading especifico
                    }
                    ComparisonUiState.Idle -> {}
                }
            }
        }

        // Invite Events Observer
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.inviteEvent.collect { event ->
                when(event) {
                    is InviteUiEvent.InviteSent -> {
                        android.widget.Toast.makeText(requireContext(), "Convite enviado para ${event.userName}", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    is InviteUiEvent.Error -> {
                        android.widget.Toast.makeText(requireContext(), event.message, android.widget.Toast.LENGTH_LONG).show()
                    }
                    is InviteUiEvent.ShowGroupSelection -> {
                        showGroupSelectionDialog(event.groups, event.targetUser)
                    }
                }
            }
        }
    }

    private fun showGroupSelectionDialog(groups: List<com.futebadosparcas.data.model.UserGroup>, user: com.futebadosparcas.data.model.User) {
        val groupNames = groups.map { it.groupName }.toTypedArray()
        com.google.android.material.dialog.MaterialAlertDialogBuilder(requireContext())
            .setTitle("Convidar ${user.getDisplayName()} para:")
            .setItems(groupNames) { _, which ->
                val selectedGroup = groups[which]
                viewModel.sendInvite(selectedGroup.groupId, user)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }



    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
