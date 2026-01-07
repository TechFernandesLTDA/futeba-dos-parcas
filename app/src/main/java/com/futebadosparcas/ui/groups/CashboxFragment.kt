package com.futebadosparcas.ui.groups

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * CashboxFragment - Gestão financeira do grupo
 *
 * Migrado para Jetpack Compose com CashboxScreen.kt
 */
@AndroidEntryPoint
class CashboxFragment : Fragment() {

    private val viewModel: CashboxViewModel by viewModels()
    private val args: CashboxFragmentArgs by navArgs()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(
                ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
            )

            setContent {
                FutebaTheme {
                    CashboxScreen(
                        viewModel = viewModel,
                        groupId = args.groupId,
                        onNavigateBack = {
                            if (isAdded) {
                                findNavController().popBackStack()
                            }
                        }
                    )
                }
            }
        }
    }
}
