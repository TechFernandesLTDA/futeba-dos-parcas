package com.futebadosparcas.ui.main

import android.os.Bundle
import android.os.Build
import android.content.res.Configuration
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.ui.graphics.toArgb
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.futebadosparcas.R
import com.futebadosparcas.data.model.ThemeMode
import com.futebadosparcas.databinding.ActivityMainBinding
import com.futebadosparcas.ui.adaptive.WindowSizeClass
import com.futebadosparcas.ui.theme.DynamicThemeEngine
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @javax.inject.Inject
    lateinit var badgeAwarder: com.futebadosparcas.domain.gamification.BadgeAwarder

    @javax.inject.Inject
    lateinit var firestore: com.google.firebase.firestore.FirebaseFirestore

    @javax.inject.Inject
    lateinit var postGameEventEmitter: com.futebadosparcas.domain.ranking.PostGameEventEmitter

    private lateinit var binding: ActivityMainBinding

    /** Indica se está usando NavigationRail (tablets) ou BottomNav (phones) */
    private val isUsingNavigationRail: Boolean
        get() = !WindowSizeClass.fromActivity(this).isCompact

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
        setupWindowInsets()

        applySystemBars()
        setupNavigation()
        observeGamificationEvents()
        observePostGameEvents()
        observeThemeChanges()
        observeNotifications()
    }

    private fun setupWindowInsets() {
        if (isUsingNavigationRail) {
            // Tablets: NavigationRail - padding apenas no topo
            ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
                val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.updatePadding(top = systemBars.top)
                // NavigationRail lida com seu próprio padding
                binding.navigationRail?.updatePadding(
                    top = systemBars.top,
                    bottom = systemBars.bottom
                )
                insets
            }
        } else {
            // Phones: BottomNav - padding no topo e bottom nav
            val bottomNavBasePadding = binding.bottomNavigation.paddingBottom
            ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
                val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.updatePadding(top = systemBars.top)
                binding.bottomNavigation.updatePadding(bottom = bottomNavBasePadding + systemBars.bottom)
                insets
            }
        }
    }

    private fun setupNavigation() {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHostFragment.navController

        if (isUsingNavigationRail) {
            // Configurar NavigationRail para tablets
            setupNavigationRail(navController)
        } else {
            // Configurar BottomNavigation para phones
            setupBottomNavigation(navController)
        }
    }

    private fun setupNavigationRail(navController: NavController) {
        binding.navigationRail?.let { rail ->
            rail.setupWithNavController(navController)

            // Corrigir navegação: sempre navegar para o destino raiz
            rail.setOnItemSelectedListener { item ->
                navigateToDestination(navController, item.itemId)
            }
        }
    }

    private fun setupBottomNavigation(navController: NavController) {
        binding.bottomNavigation.setupWithNavController(navController)

        // Corrigir bug: sempre navegar para o destino raiz ao clicar no bottom nav
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            navigateToDestination(navController, item.itemId)
        }
    }

    private fun navigateToDestination(navController: NavController, itemId: Int): Boolean {
        return when (itemId) {
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

    // Conjunto de badges já exibidas nesta sessão para evitar duplicatas
    private val shownBadgeIds = mutableSetOf<String>()

    private fun observeGamificationEvents() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                badgeAwarder.newBadges.collect { userBadge ->
                    // Verificar se já existe um dialog aberto ou se esta badge já foi exibida
                    val existingDialog = supportFragmentManager.findFragmentByTag(
                        com.futebadosparcas.ui.badges.dialog.BadgeUnlockDialog.TAG
                    )

                    // Verificar tambem se ja foi vista anteriormente (persistido)
                    val alreadySeen = com.futebadosparcas.util.SeenBadgesManager.hasBeenSeen(
                        this@MainActivity,
                        userBadge.badgeId
                    )

                    if (existingDialog == null &&
                        !shownBadgeIds.contains(userBadge.badgeId) &&
                        !alreadySeen) {
                        shownBadgeIds.add(userBadge.badgeId)
                        com.futebadosparcas.ui.badges.dialog.BadgeUnlockDialog
                            .newInstance(userBadge.badgeId, firestore)
                            .show(supportFragmentManager, com.futebadosparcas.ui.badges.dialog.BadgeUnlockDialog.TAG)
                    }
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
                 var currentConfig: com.futebadosparcas.data.model.AppThemeConfig? = null
                 themeRepository.themeConfig.collect { themeConfig ->
                     if (currentConfig != null && currentConfig != themeConfig) {
                         recreate()
                     }
                     currentConfig = themeConfig
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
            if (isUsingNavigationRail) {
                // Atualiza badge no NavigationRail
                binding.navigationRail?.let { rail ->
                    val badge = rail.getOrCreateBadge(R.id.profileFragment)
                    if (count > 0) {
                        badge.isVisible = true
                        badge.number = count
                        badge.backgroundColor = getColor(R.color.badge_background)
                        badge.badgeTextColor = getColor(R.color.badge_text)
                    } else {
                        badge.isVisible = false
                        badge.clearNumber()
                    }
                }
            } else {
                // Atualiza badge no BottomNavigation
                val badge = binding.bottomNavigation.getOrCreateBadge(R.id.profileFragment)
                if (count > 0) {
                    badge.isVisible = true
                    badge.number = count
                    badge.backgroundColor = getColor(R.color.badge_background)
                    badge.badgeTextColor = getColor(R.color.badge_text)
                } else {
                    badge.isVisible = false
                    badge.clearNumber()
                }
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

    @Suppress("DEPRECATION")
    private fun applySystemBars() {
        val themeConfig = runBlocking {
            themeRepository.themeConfig.first()
        }
        val isDark = when (themeConfig.mode) {
            ThemeMode.LIGHT -> false
            ThemeMode.DARK -> true
            ThemeMode.SYSTEM -> isSystemInDarkMode()
        }
        val colorScheme = DynamicThemeEngine.generateColorScheme(themeConfig, isDark)

        window.statusBarColor = colorScheme.surface.toArgb()
        window.navigationBarColor = colorScheme.surfaceVariant.toArgb()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
        }

        val insetsController = WindowCompat.getInsetsController(window, binding.root)
        insetsController.isAppearanceLightStatusBars = !isDark
        insetsController.isAppearanceLightNavigationBars = !isDark
    }

    private fun isSystemInDarkMode(): Boolean {
        val currentNightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return currentNightMode == Configuration.UI_MODE_NIGHT_YES
    }
}
