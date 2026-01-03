package com.futebadosparcas.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.NotificationAction
import com.futebadosparcas.databinding.FragmentNotificationsBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class NotificationsFragment : Fragment() {

    private var _binding: FragmentNotificationsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: NotificationsViewModel by viewModels()
    private lateinit var adapter: NotificationsAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentNotificationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolbar()
        setupRecyclerView()
        setupListeners()
        observeViewModel()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }

        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_mark_all_read -> {
                    viewModel.markAllAsRead()
                    true
                }
                R.id.action_delete_old -> {
                    viewModel.deleteOldNotifications()
                    true
                }
                else -> false
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = NotificationsAdapter(
            onItemClick = { notification ->
                handleNotificationClick(notification)
            },
            onAcceptClick = { notification ->
                viewModel.handleNotificationAction(notification, accept = true)
            },
            onDeclineClick = { notification ->
                viewModel.handleNotificationAction(notification, accept = false)
            }
        )

        binding.rvNotifications.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = this@NotificationsFragment.adapter
        }
    }

    private fun setupListeners() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadNotifications()
        }
    }

    private fun handleNotificationClick(notification: AppNotification) {
        viewModel.markAsRead(notification.id)

        when (notification.referenceType) {
            "group" -> {
                notification.referenceId?.let { groupId ->
                    val action = NotificationsFragmentDirections
                        .actionNotificationsFragmentToGroupDetailFragment(groupId)
                    findNavController().navigate(action)
                }
            }
            "game" -> {
                notification.referenceId?.let { gameId ->
                    val action = NotificationsFragmentDirections
                        .actionNotificationsFragmentToGameDetailFragment(gameId)
                    findNavController().navigate(action)
                }
            }
            "invite" -> {
                // Show accept/decline options if not already handled
                if (notification.getActionTypeEnum() == NotificationAction.ACCEPT_DECLINE) {
                    // Action buttons should be visible in the item
                }
            }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                binding.swipeRefresh.isRefreshing = false

                when (state) {
                    is NotificationsUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.rvNotifications.visibility = View.GONE
                        binding.emptyView.visibility = View.GONE
                    }
                    is NotificationsUiState.Empty -> {
                        binding.progressBar.visibility = View.GONE
                        binding.rvNotifications.visibility = View.GONE
                        binding.emptyView.visibility = View.VISIBLE
                    }
                    is NotificationsUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.rvNotifications.visibility = View.VISIBLE
                        binding.emptyView.visibility = View.GONE
                        adapter.submitList(state.notifications)
                    }
                    is NotificationsUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.actionState.collect { state ->
                when (state) {
                    is NotificationActionState.Loading -> {
                        // Show loading indicator if needed
                    }
                    is NotificationActionState.Success -> {
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_SHORT).show()
                        viewModel.resetActionState()
                    }
                    is NotificationActionState.InviteAccepted -> {
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_SHORT).show()
                        viewModel.resetActionState()
                    }
                    is NotificationActionState.InviteDeclined -> {
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_SHORT).show()
                        viewModel.resetActionState()
                    }
                    is NotificationActionState.NavigateToGame -> {
                        val action = NotificationsFragmentDirections
                            .actionNotificationsFragmentToGameDetailFragment(state.gameId)
                        findNavController().navigate(action)
                        viewModel.resetActionState()
                    }
                    is NotificationActionState.Error -> {
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_LONG).show()
                        viewModel.resetActionState()
                    }
                    is NotificationActionState.Idle -> {
                        // Do nothing
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
