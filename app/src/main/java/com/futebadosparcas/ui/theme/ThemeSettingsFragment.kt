package com.futebadosparcas.ui.theme

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.ui.theme.ThemeSettingsScreen

import androidx.navigation.fragment.findNavController
import dagger.hilt.android.AndroidEntryPoint

import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.launch

@AndroidEntryPoint
class ThemeSettingsFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return inflater.inflate(com.futebadosparcas.R.layout.fragment_theme_settings, container, false)
    }

    private val viewModel: ThemeViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupToolbar(view)
        
        val composeContainer = view.findViewById<android.widget.FrameLayout>(com.futebadosparcas.R.id.composeContainer)
        composeContainer.addView(ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    ThemeSettingsScreen()
                }
            }
        })
        
        // Dynamic XML Toolbar Coloring
        val toolbar = view.findViewById<com.google.android.material.appbar.MaterialToolbar>(com.futebadosparcas.R.id.toolbar)
        val appBar = view.findViewById<com.google.android.material.appbar.AppBarLayout>(com.futebadosparcas.R.id.appBarLayout)
        
        lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) {
                viewModel.themeConfig.collect { config ->
                    // Observer placeholder
                    // We could update the status bar manually here if needed, but recreate() handles it better
                }
            }
        }
    }

    private fun setupToolbar(view: View) {
        val toolbar = view.findViewById<com.google.android.material.appbar.MaterialToolbar>(com.futebadosparcas.R.id.toolbar)
        toolbar.setNavigationOnClickListener {
             findNavController().navigateUp()
        }
    }
}
