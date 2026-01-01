package com.futebadosparcas.ui.main

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.futebadosparcas.R
import com.futebadosparcas.databinding.ActivityMainBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @javax.inject.Inject
    lateinit var badgeAwarder: com.futebadosparcas.domain.gamification.BadgeAwarder

    @javax.inject.Inject
    lateinit var firestore: com.google.firebase.firestore.FirebaseFirestore

    @javax.inject.Inject
    lateinit var postGameEventEmitter: com.futebadosparcas.domain.ranking.PostGameEventEmitter

    private lateinit var binding: ActivityMainBinding

    @javax.inject.Inject
    lateinit var themeRepository: com.futebadosparcas.data.repository.ThemeRepository
    
    @javax.inject.Inject
    lateinit var notificationRepository: com.futebadosparcas.data.repository.NotificationRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Hilt Dependency Injection happens in super.onCreate()
        // So we must access repository AFTER it, but BEFORE setContentView to apply theme
        applyDynamicTheme()
        
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Habilita o modo edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Adiciona padding para evitar sobreposição com as barras do sistema
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.updatePadding(top = systemBars.top)
            insets
        }

        setupNavigation()
        observeGamificationEvents()
        observePostGameEvents()
        observeThemeChanges()
        observeNotifications()
    }

    private fun setupNavigation() {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHostFragment.navController

        // Configurar bottom navigation
        binding.bottomNavigation.setupWithNavController(navController)
        
        // Corrigir bug: sempre navegar para o destino raiz ao clicar no bottom nav
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.homeFragment -> {
                    navController.popBackStack(R.id.homeFragment, false)
                    navController.navigate(R.id.homeFragment)
                    true
                }
                R.id.gamesFragment -> {
                    navController.popBackStack(R.id.gamesFragment, false)
                    navController.navigate(R.id.gamesFragment)
                    true
                }
                R.id.playersFragment -> {
                    navController.popBackStack(R.id.playersFragment, false)
                    navController.navigate(R.id.playersFragment)
                    true
                }
                R.id.leagueFragment -> {
                    navController.popBackStack(R.id.leagueFragment, false)
                    navController.navigate(R.id.leagueFragment)
                    true
                }
                R.id.statisticsFragment -> {
                    navController.popBackStack(R.id.statisticsFragment, false)
                    navController.navigate(R.id.statisticsFragment)
                    true
                }
                R.id.profileFragment -> {
                    navController.popBackStack(R.id.profileFragment, false)
                    navController.navigate(R.id.profileFragment)
                    true
                }
                else -> false
            }
        }
    }

    private fun observeGamificationEvents() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                badgeAwarder.newBadges.collect { userBadge ->
                    com.futebadosparcas.ui.badges.dialog.BadgeUnlockDialog
                        .newInstance(userBadge.badgeId, firestore)
                        .show(supportFragmentManager, com.futebadosparcas.ui.badges.dialog.BadgeUnlockDialog.TAG)
                }
            }
        }
    }

    private fun observePostGameEvents() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                postGameEventEmitter.postGameEvents.collect { summary ->
                    showPostGameDialog(summary)
                }
            }
        }
    }

    private fun applyDynamicTheme() {
        // Use runBlocking to synchronously get preference before UI rendering
        val config: com.futebadosparcas.data.model.AppThemeConfig = kotlinx.coroutines.runBlocking {
            themeRepository.themeConfig.first()
        }
        
        config.let { themeConfig ->
            val themeId = when(themeConfig.seedColors.primary) {
                0xFF1CB0F6.toInt() -> R.style.Theme_FutebaDosParcas_Blue
                0xFFFF9600.toInt() -> R.style.Theme_FutebaDosParcas_Orange
                0xFFCE82FF.toInt() -> R.style.Theme_FutebaDosParcas_Purple
                0xFFFF4B4B.toInt() -> R.style.Theme_FutebaDosParcas_Red
                0xFF2B70C9.toInt() -> R.style.Theme_FutebaDosParcas_Navy
                else -> R.style.Theme_FutebaDosParcas // Green/Default
            }
            setTheme(themeId)
        }
    }
    
    // Listen for changes to recreate activity
    private fun observeThemeChanges() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                 // We need to skip the initial value because it was already applied in onCreate
                 // However, stateFlow replays latest.
                 // Simple diff: Current theme vs New theme
                 var currentPrimary = 0
                 themeRepository.themeConfig.collect { themeConfig ->
                     if (currentPrimary != 0 && currentPrimary != themeConfig.seedColors.primary) {
                         recreate()
                     }
                     currentPrimary = themeConfig.seedColors.primary
                 }
            }
        }
    }
    
    private fun observeNotifications() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                notificationRepository.getUnreadCountFlow().collect { count ->
                    // Atualiza badge no ícone de notificações (se existir no menu)
                    // Como não temos ícone de notificações no bottom nav, vamos adicionar no HomeFragment
                    // ou criar um badge visual customizado
                    updateNotificationBadge(count)
                }
            }
        }
    }
    
    private fun updateNotificationBadge(count: Int) {
        try {
            val badge = binding.bottomNavigation.getOrCreateBadge(R.id.profileFragment)
            if (count > 0) {
                badge.isVisible = true
                badge.number = count
                badge.backgroundColor = getColor(R.color.badge_background) // Ensure color exists or use generic
                badge.badgeTextColor = getColor(R.color.badge_text)
            } else {
                badge.isVisible = false
                badge.clearNumber()
            }
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Erro ao atualizar badge", e)
        }
    }

    private fun showPostGameDialog(summary: com.futebadosparcas.ui.statistics.PostGameSummary) {
        // Encontra o NavHostFragment e mostra o dialog Compose
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as? NavHostFragment

        navHostFragment?.childFragmentManager?.let { fm ->
            com.futebadosparcas.ui.statistics.PostGameDialogFragment
                .newInstance(summary)
                .show(fm, "PostGameDialog")
        }
    }
}
