package com.futebadosparcas.ui.preferences

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentPreferencesBinding
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.util.ThemeHelper
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class PreferencesFragment : Fragment() {

    private var _binding: FragmentPreferencesBinding? = null
    private val binding get() = _binding!!

    private val viewModel: PreferencesViewModel by viewModels()

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
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().navigateUp()
        }
    }

    private fun setupThemeSelector() {
        val currentTheme = preferencesManager.getThemePreference()
        updateThemeButtonSelection(currentTheme)

        binding.btnThemeLight.setOnClickListener {
            selectTheme("light")
        }

        binding.btnThemeDark.setOnClickListener {
            selectTheme("dark")
        }

        binding.btnThemeSystem.setOnClickListener {
            selectTheme("system")
        }
        
        binding.btnCustomizeColors.setOnClickListener {
            findNavController().navigate(R.id.action_preferences_to_themeSettings)
        }
    }

    private fun selectTheme(theme: String) {
        preferencesManager.setThemePreference(theme)
        updateThemeButtonSelection(theme)
        ThemeHelper.applyTheme(theme)
    }

    private fun updateThemeButtonSelection(theme: String) {
        val checkedId = when (theme) {
            "light" -> R.id.btnThemeLight
            "dark" -> R.id.btnThemeDark
            else -> R.id.btnThemeSystem
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

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
