package com.futebadosparcas.performance

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object BundleAnalyzer {
    private val _analysisState = MutableStateFlow<BundleAnalysisState>(BundleAnalysisState.Idle)
    val analysisState: StateFlow<BundleAnalysisState> = _analysisState.asStateFlow()
    
    private val moduleRegistry = mutableMapOf<String, ModuleInfo>()
    private val dependencyGraph = mutableMapOf<String, Set<String>>()
    
    data class ModuleInfo(
        val name: String,
        val category: ModuleCategory,
        val estimatedSize: String,
        val loadPriority: Int,
        val isLoaded: Boolean = false,
        val dependencies: List<String> = emptyList()
    )
    
    enum class ModuleCategory {
        CORE,
        UI,
        NAVIGATION,
        FIREBASE,
        GAMIFICATION,
        ADMIN,
        TACTICAL,
        VOTING,
        SETTINGS,
        UTILS
    }
    
    sealed class BundleAnalysisState {
        object Idle : BundleAnalysisState()
        object Analyzing : BundleAnalysisState()
        data class Complete(val report: BundleReport) : BundleAnalysisState()
        data class Error(val message: String) : BundleAnalysisState()
    }
    
    data class BundleReport(
        val totalModules: Int,
        val loadedModules: Int,
        val categories: Map<ModuleCategory, CategoryStats>,
        val suggestions: List<OptimizationSuggestion>,
        val estimatedSavings: String,
        val loadOrder: List<String>
    )
    
    data class CategoryStats(
        val moduleName: String,
        val moduleCount: Int,
        val loadedCount: Int,
        val estimatedSize: String,
        val usagePercentage: Double
    )
    
    data class OptimizationSuggestion(
        val type: SuggestionType,
        val module: String,
        val description: String,
        val potentialSavings: String,
        val priority: Int
    )
    
    enum class SuggestionType {
        LAZY_LOAD,
        CODE_SPLIT,
        REMOVE_UNUSED,
        OPTIMIZE_IMPORTS,
        DEFER_LOAD
    }
    
    fun registerModule(
        name: String,
        category: ModuleCategory,
        estimatedSize: String = "~50 KB",
        loadPriority: Int = 5,
        dependencies: List<String> = emptyList()
    ) {
        moduleRegistry[name] = ModuleInfo(
            name = name,
            category = category,
            estimatedSize = estimatedSize,
            loadPriority = loadPriority,
            dependencies = dependencies
        )
        
        dependencyGraph[name] = dependencies.toSet()
        WebPerformance.markModuleLoaded(name)
    }
    
    fun markModuleLoaded(moduleName: String) {
        moduleRegistry[moduleName]?.let { current ->
            moduleRegistry[moduleName] = current.copy(isLoaded = true)
        }
        WebPerformance.markModuleLoaded(moduleName)
    }
    
    fun analyze(): BundleReport {
        val loadedModules = WebPerformance.getLoadedModules()
        
        val categories = moduleRegistry.values
            .groupBy { it.category }
            .mapValues { (category, modules) ->
                CategoryStats(
                    moduleName = category.name,
                    moduleCount = modules.size,
                    loadedCount = modules.count { it.name in loadedModules },
                    estimatedSize = modules.sumOf { parseSize(it.estimatedSize) }.let { formatSize(it) },
                    usagePercentage = if (modules.isNotEmpty()) {
                        modules.count { it.name in loadedModules }.toDouble() / modules.size * 100
                    } else 0.0
                )
            }
        
        val suggestions = generateOptimizationSuggestions(loadedModules)
        
        val loadOrder = moduleRegistry.values
            .sortedBy { it.loadPriority }
            .map { it.name }
        
        val totalEstimated = moduleRegistry.values.sumOf { parseSize(it.estimatedSize) }
        val loadedEstimated = moduleRegistry.values
            .filter { it.name in loadedModules }
            .sumOf { parseSize(it.estimatedSize) }
        
        val savings = totalEstimated - loadedEstimated
        
        return BundleReport(
            totalModules = moduleRegistry.size,
            loadedModules = loadedModules.size,
            categories = categories,
            suggestions = suggestions,
            estimatedSavings = formatSize(savings),
            loadOrder = loadOrder
        )
    }
    
    fun runAnalysis() {
        _analysisState.value = BundleAnalysisState.Analyzing
        
        try {
            val report = analyze()
            _analysisState.value = BundleAnalysisState.Complete(report)
        } catch (e: Exception) {
            _analysisState.value = BundleAnalysisState.Error(e.message ?: "Analysis failed")
        }
    }
    
    private fun generateOptimizationSuggestions(loadedModules: Set<String>): List<OptimizationSuggestion> {
        val suggestions = mutableListOf<OptimizationSuggestion>()
        
        moduleRegistry.values.forEach { module ->
            if (!module.isLoaded && module.name !in loadedModules) {
                if (module.category in listOf(
                    ModuleCategory.ADMIN,
                    ModuleCategory.TACTICAL,
                    ModuleCategory.VOTING
                )) {
                    suggestions.add(
                        OptimizationSuggestion(
                            type = SuggestionType.LAZY_LOAD,
                            module = module.name,
                            description = "Módulo '${module.name}' pode ser carregado sob demanda",
                            potentialSavings = module.estimatedSize,
                            priority = 3
                        )
                    )
                }
            }
            
            if (module.loadPriority > 7) {
                suggestions.add(
                    OptimizationSuggestion(
                        type = SuggestionType.DEFER_LOAD,
                        module = module.name,
                        description = "Módulo '${module.name}' pode ter carregamento adiado",
                        potentialSavings = module.estimatedSize,
                        priority = 2
                    )
                )
            }
        }
        
        if (loadedModules.size > 30) {
            suggestions.add(
                OptimizationSuggestion(
                    type = SuggestionType.CODE_SPLIT,
                    module = "Global",
                    description = "Considere dividir o bundle em chunks menores (atualmente ${loadedModules.size} módulos)",
                    potentialSavings = "~20%",
                    priority = 1
                )
            )
        }
        
        return suggestions.sortedBy { it.priority }
    }
    
    fun getCodeSplittingRecommendations(): List<CodeSplitRecommendation> {
        return listOf(
            CodeSplitRecommendation(
                chunkName = "core",
                description = "Módulos essenciais - carregar imediatamente",
                modules = listOf(
                    "FirebaseManager",
                    "WebRouter",
                    "Theme"
                ),
                estimatedSize = "~500 KB"
            ),
            CodeSplitRecommendation(
                chunkName = "main-ui",
                description = "Interface principal - carregar após core",
                modules = listOf(
                    "HomeScreenWeb",
                    "GamesTab",
                    "GroupsTab",
                    "PlayersTab",
                    "LocationsTab"
                ),
                estimatedSize = "~800 KB"
            ),
            CodeSplitRecommendation(
                chunkName = "game-management",
                description = "Gerenciamento de jogos - lazy load",
                modules = listOf(
                    "GameDetailScreenWeb",
                    "CreateGameDialog",
                    "LiveGameTab",
                    "MvpVotingTab"
                ),
                estimatedSize = "~400 KB"
            ),
            CodeSplitRecommendation(
                chunkName = "tactical",
                description = "Quadro tático - lazy load",
                modules = listOf(
                    "TacticalBoardScreen",
                    "FieldCanvas",
                    "FormationSelector"
                ),
                estimatedSize = "~300 KB"
            ),
            CodeSplitRecommendation(
                chunkName = "admin",
                description = "Painel admin - lazy load (apenas para admins)",
                modules = listOf(
                    "AdminTab",
                    "AdminScreens",
                    "UserManagementScreen",
                    "ReportsCard"
                ),
                estimatedSize = "~350 KB"
            ),
            CodeSplitRecommendation(
                chunkName = "gamification",
                description = "Gamificação - lazy load",
                modules = listOf(
                    "BadgesScreen",
                    "XpHistoryScreen",
                    "LevelJourneyScreen"
                ),
                estimatedSize = "~250 KB"
            ),
            CodeSplitRecommendation(
                chunkName = "settings",
                description = "Configurações - lazy load",
                modules = listOf(
                    "SettingsTab",
                    "ThemeSelector",
                    "DeveloperToolsScreen"
                ),
                estimatedSize = "~200 KB"
            )
        )
    }
    
    fun getImportOptimizations(): List<ImportOptimization> {
        return listOf(
            ImportOptimization(
                file = "HomeScreenWeb.kt",
                suggestion = "Usar imports específicos ao invés de '*' para material3",
                currentImport = "import androidx.compose.material3.*",
                recommendedImport = "Importar apenas componentes usados",
                estimatedSavings = "~15 KB"
            ),
            ImportOptimization(
                file = "GamesTab.kt",
                suggestion = "Remover imports não utilizados",
                currentImport = "import androidx.compose.ui.window.Dialog",
                recommendedImport = "Manter apenas se Dialog for usado diretamente",
                estimatedSavings = "~5 KB"
            ),
            ImportOptimization(
                file = "GroupsTab.kt",
                suggestion = "Otimizar imports de animação",
                currentImport = "import androidx.compose.animation.core.*",
                recommendedImport = "Importar apenas animações específicas usadas",
                estimatedSavings = "~10 KB"
            ),
            ImportOptimization(
                file = "FirebaseManager.kt",
                suggestion = "Considerar code splitting para funções de admin",
                currentImport = "Todas as funções em um arquivo",
                recommendedImport = "Separar funções de admin em módulo dedicado",
                estimatedSavings = "~50 KB"
            )
        )
    }
    
    private fun parseSize(sizeStr: String): Long {
        val regex = """~?(\d+(?:\.\d+)?)\s*(KB|MB)""".toRegex(RegexOption.IGNORE_CASE)
        val match = regex.find(sizeStr) ?: return 0L
        
        val value = match.groupValues[1].toDouble()
        val unit = match.groupValues[2].uppercase()
        
        return when (unit) {
            "KB" -> (value * 1024).toLong()
            "MB" -> (value * 1024 * 1024).toLong()
            else -> 0L
        }
    }
    
    private fun formatSize(bytes: Long): String {
        return when {
            bytes >= 1024 * 1024 -> "~${(bytes / (1024.0 * 1024.0)).toInt()} MB"
            bytes >= 1024 -> "~${(bytes / 1024.0).toInt()} KB"
            else -> "~$bytes B"
        }
    }
    
    fun reset() {
        moduleRegistry.clear()
        dependencyGraph.clear()
        _analysisState.value = BundleAnalysisState.Idle
    }
}

data class CodeSplitRecommendation(
    val chunkName: String,
    val description: String,
    val modules: List<String>,
    val estimatedSize: String
)

data class ImportOptimization(
    val file: String,
    val suggestion: String,
    val currentImport: String,
    val recommendedImport: String,
    val estimatedSavings: String
)

fun initializeDefaultModules() {
    BundleAnalyzer.apply {
        registerModule("FirebaseManager", BundleAnalyzer.ModuleCategory.FIREBASE, "~150 KB", 1)
        registerModule("WebRouter", BundleAnalyzer.ModuleCategory.NAVIGATION, "~80 KB", 1)
        registerModule("Theme", BundleAnalyzer.ModuleCategory.UI, "~50 KB", 1)
        
        registerModule("HomeScreenWeb", BundleAnalyzer.ModuleCategory.UI, "~120 KB", 2)
        registerModule("GamesTab", BundleAnalyzer.ModuleCategory.UI, "~100 KB", 2)
        registerModule("GroupsTab", BundleAnalyzer.ModuleCategory.UI, "~90 KB", 2)
        registerModule("PlayersTab", BundleAnalyzer.ModuleCategory.UI, "~80 KB", 2)
        registerModule("LocationsTab", BundleAnalyzer.ModuleCategory.UI, "~70 KB", 2)
        registerModule("RankingTab", BundleAnalyzer.ModuleCategory.UI, "~60 KB", 2)
        
        registerModule("GameDetailScreenWeb", BundleAnalyzer.ModuleCategory.UI, "~100 KB", 5)
        registerModule("CreateGameDialog", BundleAnalyzer.ModuleCategory.UI, "~50 KB", 5)
        registerModule("LiveGameTab", BundleAnalyzer.ModuleCategory.UI, "~80 KB", 5)
        
        registerModule("TacticalBoardScreen", BundleAnalyzer.ModuleCategory.TACTICAL, "~150 KB", 8)
        registerModule("FieldCanvas", BundleAnalyzer.ModuleCategory.TACTICAL, "~100 KB", 8)
        registerModule("FormationSelector", BundleAnalyzer.ModuleCategory.TACTICAL, "~40 KB", 8)
        
        registerModule("MvpVotingTab", BundleAnalyzer.ModuleCategory.VOTING, "~60 KB", 7)
        registerModule("BolaMurchaVotingTab", BundleAnalyzer.ModuleCategory.VOTING, "~50 KB", 7)
        
        registerModule("AdminTab", BundleAnalyzer.ModuleCategory.ADMIN, "~80 KB", 9)
        registerModule("UserManagementScreen", BundleAnalyzer.ModuleCategory.ADMIN, "~70 KB", 9)
        registerModule("ReportsCard", BundleAnalyzer.ModuleCategory.ADMIN, "~40 KB", 9)
        
        registerModule("BadgesScreen", BundleAnalyzer.ModuleCategory.GAMIFICATION, "~60 KB", 6)
        registerModule("XpHistoryScreen", BundleAnalyzer.ModuleCategory.GAMIFICATION, "~50 KB", 6)
        registerModule("LevelJourneyScreen", BundleAnalyzer.ModuleCategory.GAMIFICATION, "~70 KB", 6)
        
        registerModule("SettingsTab", BundleAnalyzer.ModuleCategory.SETTINGS, "~50 KB", 7)
        registerModule("ThemeSelector", BundleAnalyzer.ModuleCategory.SETTINGS, "~30 KB", 7)
        registerModule("DeveloperToolsScreen", BundleAnalyzer.ModuleCategory.SETTINGS, "~40 KB", 10)
    }
}
