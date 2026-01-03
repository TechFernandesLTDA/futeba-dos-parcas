package com.futebadosparcas.ui.preferences

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentPreferencesBinding
import com.futebadosparcas.data.model.ThemeMode
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.ui.theme.ThemeViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class PreferencesFragment : Fragment() {

    private var _binding: FragmentPreferencesBinding? = null
    private val binding get() = _binding!!

    private val viewModel: PreferencesViewModel by viewModels()
    private val themeViewModel: ThemeViewModel by viewModels()

    @Inject
    lateinit var preferencesManager: PreferencesManager

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPreferencesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolbar()
        setupThemeSelector()
        setupProfileVisibilitySwitch()
        setupDeveloperButton()
        observeViewModel()
        observeThemeConfig()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().navigateUp()
        }
    }

    private fun setupThemeSelector() {
        binding.btnThemeLight.setOnClickListener {
            selectTheme(ThemeMode.LIGHT)
        }

        binding.btnThemeDark.setOnClickListener {
            selectTheme(ThemeMode.DARK)
        }

        binding.btnThemeSystem.setOnClickListener {
            selectTheme(ThemeMode.SYSTEM)
        }
        
        binding.btnCustomizeColors.setOnClickListener {
            findNavController().navigate(R.id.action_preferences_to_themeSettings)
        }
    }

    private fun selectTheme(mode: ThemeMode) {
        val themeString = when (mode) {
            ThemeMode.LIGHT -> "light"
            ThemeMode.DARK -> "dark"
            ThemeMode.SYSTEM -> "system"
        }
        preferencesManager.setThemePreference(themeString)
        themeViewModel.setThemeMode(mode)
        updateThemeButtonSelection(mode)
    }

    private fun updateThemeButtonSelection(mode: ThemeMode) {
        val checkedId = when (mode) {
            ThemeMode.LIGHT -> R.id.btnThemeLight
            ThemeMode.DARK -> R.id.btnThemeDark
            ThemeMode.SYSTEM -> R.id.btnThemeSystem
        }
        binding.toggleGroupTheme.check(checkedId)
    }

    private fun setupProfileVisibilitySwitch() {
        binding.switchProfileVisibility.setOnCheckedChangeListener { _, isChecked ->
            viewModel.setProfileVisibility(isChecked)
        }
    }

    private fun setupDeveloperButton() {
        if (preferencesManager.isDevModeEnabled()) {
            binding.tvDeveloperHeader.visibility = View.VISIBLE
            binding.cardDeveloper.visibility = View.VISIBLE
            binding.cardDeveloper.setOnClickListener {
                findNavController().navigate(R.id.action_preferences_to_developer)
            }
        } else {
            binding.tvDeveloperHeader.visibility = View.GONE
            binding.cardDeveloper.visibility = View.GONE
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isSearchable.collect { isChecked ->
                binding.switchProfileVisibility.setOnCheckedChangeListener(null)
                binding.switchProfileVisibility.isChecked = isChecked
                setupProfileVisibilitySwitch()
            }
        }
    }

    private fun observeThemeConfig() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) {
                themeViewModel.themeConfig.collect { config ->
                    updateThemeButtonSelection(config.mode)
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
