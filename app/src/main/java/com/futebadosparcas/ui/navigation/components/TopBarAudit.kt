package com.futebadosparcas.ui.navigation.components

/**
 * CMD-18 - Auditoria de TopBars
 *
 * Este arquivo documenta o status de todas as TopBars do app
 * e garante que nenhum icone seja decorativo.
 *
 * Legenda:
 * - [OK] TopBar padronizada com AppTopBar
 * - [MIGR] Migrada para AppTopBar (mas usa custom wrapper)
 * - [TODO] Precisa migrar
 *
 * ## Telas Migradas (usando AppTopBar):
 *
 * | Tela | TopBar | Menu Actions | Map Action | Status |
 * |------|--------|-------------|------------|--------|
 * | LocationsMapScreen | AppTopBar.Secondary | - | - | [OK] |
 * | LocationDetailScreen | AppTopBar.WithMenu | Save | - | [OK] |
 * | PreferencesScreen | AppTopBar.Secondary | - | - | [OK] |
 * | NotificationsScreen | Custom TopBar | MarkAll, DeleteOld | - | [TODO] |
 * | GameDetailScreen | Custom TopBar | WhatsApp, Share, Vote | - | [TODO] |
 * | GroupDetailScreen | Custom TopBar | Invite, Cashbox, etc | - | [TODO] |
 * | BadgesScreen | Custom TopBar | - | - | [TODO] |
 * | UserManagementScreen | Custom TopBar | - | - | [TODO] |
 *
 * ## Telas Pendentes:
 *
 * - SchedulesScreen
 * - CreateGameScreen
 * - CreateGroupScreen
 * - InvitePlayersScreen
 * - CashboxScreen
 * - EditProfileScreen
 * - GamificationSettingsScreen
 * - ManageLocationsScreen
 * - FieldOwnerDashboardScreen
 * - DevToolsScreen
 * - TacticalBoardScreen
 * - MVPVoteScreen
 * - LiveGameScreen
 *
 * ## Convencoes Estabelecidas:
 *
 * 1. **TopBar padrão**: `AppTopBar.Secondary()`
 * 2. **Com menu**: `AppTopBar.WithMenu()`
 * 3. **Com badge**: `AppTopBar.WithBadge()`
 * 4. **Com mapa**: `AppTopBar.WithMapAction()`
 * 5. **Primary (root)**: `AppTopBar.Primary()`
 *
 * 6. **Cores**:
 *    - containerColor = MaterialTheme.colorScheme.primary
 *    - contentColor = MaterialTheme.colorScheme.onPrimary
 *    - OU surface/surfaceVariant para fundo claro
 *
 * 7. **Icones**:
 *    - Tamanho: 24dp
 *    - Hit area: 48dp
 *    - Nenhum icone decorativo (todos tem onClick)
 *
 * 8. **Titulo**:
 *    - 18sp Bold
 *    - maxLines = 1
 *    - overflow = TextOverflow.Ellipsis
 *
 * ## Plano de Migracao:
 *
 * Fase 1 (Completado):
 * - [x] Criar AppTopBar com variants
 * - [x] Criar MapIconBehavior
 * - [x] Migrar LocationsMapScreen
 * - [x] Migrar LocationDetailScreen
 * - [x] Migrar PreferencesScreen
 *
 * Fase 2 (Pendente):
 * - [ ] Migrar NotificationsScreen (com menu actions)
 * - [ ] Migrar GameDetailScreen (com menu actions)
 * - [ ] Migrar GroupDetailScreen (com menu actions extenso)
 * - [ ] Migrar BadgesScreen
 * - [ ] Migrar UserManagementScreen
 *
 * Fase 3 (Pendente):
 * - [ ] Migrar telas de criacao/edicao
 * - [ ] Migrar telas de configuracao
 * - [ ] Remover TopBars ad-hoc das telas restantes
 *
 * ## Checklist para migracao de uma tela:
 *
 * - [ ] Substituir TopAppBar por AppTopBar.Secondary
 * - [ ] Remover imports duplicados (Icons, TopAppBar, etc)
 * - [ ] Adicionar import de AppTopBar
 * - [ ] Verificar se todos os icones tem onClick
 * - [ ] Adicionar contentDescription para icones
 * - [ ] Testar navegacao
 * - [ ] Testar estados (loading, error, etc)
 */

/**
 * Helper para migrar TopBars ad-hoc para AppTopBar.
 *
 * Uso:
 * ```
 * // Antes:
 * TopAppBar(
 *     title = { Text("Minha Tela") },
 *     navigationIcon = { ... },
 *     actions = { ... }
 * )
 *
 * // Depois:
 * AppTopBar.Secondary(
 *     title = "Minha Tela",
 *     onNavigateBack = { navController.popBackStack() },
 *     actions = {
 *         // Acoes inline (max 2)
 *     }
 * )
 * ```
 *
 * Para telas com menu extenso, use:
 * ```
 * AppTopBar.WithMenu(
 *     title = "Minha Tela",
 *     onNavigateBack = { navController.popBackStack() },
 *     menuItems = listOf(
 *         AppTopBarMenuItem(
 *             textResId = Res.string.action_one,
 *             icon = Icons.Default.ActionOne,
 *             onClick = { ... },
 *             showInline = true // ou false para menu dropdown
 *         )
 *     )
 * )
 * ```
 */
object TopBarMigrationGuide {

    /**
     * Lista de padroes de TopBar encontrados no app.
     */
    enum class TopBarPattern(val description: String) {
        BASIC_TOP_APP_BAR("TopAppBar basica com titulo e back"),
        TOP_APP_BAR_WITH_ACTIONS("TopAppBar com actions na direita"),
        TOP_APP_BAR_WITH_MENU("TopAppBar com menu overflow"),
        TOP_APP_BAR_WITH_BADGE("TopAppBar com badge de contagem"),
        CENTER_ALIGNED_TOP_APP_BAR("CenterAlignedTopAppBar"),
        CUSTOM_TOP_BAR("TopBar customizada com logica complexa"),
        NO_TOP_BAR("Tela sem TopBar (root destination)")
    }

    /**
     * Mapeia cada padrao para o componente AppTopBar correspondente.
     */
    fun getMigrationTarget(pattern: TopBarPattern): String {
        return when (pattern) {
            TopBarPattern.BASIC_TOP_APP_BAR -> "AppTopBar.Secondary()"
            TopBarPattern.TOP_APP_BAR_WITH_ACTIONS -> "AppTopBar.Secondary() com actions parameter"
            TopBarPattern.TOP_APP_BAR_WITH_MENU -> "AppTopBar.WithMenu()"
            TopBarPattern.TOP_APP_BAR_WITH_BADGE -> "AppTopBar.WithBadge()"
            TopBarPattern.CENTER_ALIGNED_TOP_APP_BAR -> "AppTopBar.Secondary() (CenterAligned sera deprecated)"
            TopBarPattern.CUSTOM_TOP_BAR -> "AppTopBar.WithMenu() ou customizar AppTopBar"
            TopBarPattern.NO_TOP_BAR -> "N/A (root destination usa BottomNav)"
        }
    }

    /**
     * Verifica se todos os icones da TopBar tem onClick.
     *
 * CMD-18: Nenhum icone de top bar pode ser decorativo.
     */
    fun validateTopBarActions(
        hasBackButton: Boolean,
        onBackClick: (() -> Unit)?,
        actions: List<TopBarAction>
    ): ValidationResult {
        val errors = mutableListOf<String>()

        if (hasBackButton && onBackClick == null) {
            errors.add("Botao de voltar presente mas sem onClick")
        }

        actions.forEachIndexed { index, action ->
            if (action.onClick == null) {
                errors.add("Action[$index] (${action.description}) nao tem onClick")
            }
        }

        return ValidationResult(
            isValid = errors.isEmpty(),
            errors = errors
        )
    }

    /**
     * Resultado da validacao.
     */
    data class ValidationResult(
        val isValid: Boolean,
        val errors: List<String>
    )
}

/**
 * Representa uma acao de TopBar para validacao.
 */
data class TopBarAction(
    val description: String,
    val onClick: (() -> Unit)?,
    val contentDescription: String?
)
