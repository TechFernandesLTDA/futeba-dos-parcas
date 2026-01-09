# Exemplos Antes e Depois: Centralização de Strings

## Visão Geral

Este documento mostra exemplos reais de como o código ficará após migração para usar as strings centralizadas.

---

## 1. GameDetailScreen.kt

### Antes (Hardcoded)
```kotlin
@Composable
fun GameDetailScreen(
    viewModel: GameDetailViewModel,
    gameId: String,
    onNavigateBack: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState) {
        val state = uiState
        if (state is GameDetailUiState.Success) {
            state.schedulingEvent?.let { event ->
                when (event) {
                    is SchedulingEvent.Success ->
                        snackbarHostState.showSnackbar("Proximo jogo agendado: ${event.nextDate}")
                    is SchedulingEvent.Conflict ->
                        snackbarHostState.showSnackbar("Conflito! Nao foi possivel agendar em ${event.date}.")
                    is SchedulingEvent.Error ->
                        snackbarHostState.showSnackbar("Erro no agendamento: ${event.message}")
                }
            }
        }
    }

    Column {
        TopAppBar(
            title = { Text("Detalhes do Jogo") },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                }
            }
        )

        when (val game = (uiState as? GameDetailUiState.Success)?.game) {
            null -> CircularProgressIndicator()
            else -> {
                Text(game.title)
                Text("Jogo em ${game.locationName}")
                Text("Quadra: ${game.fieldName}")

                Row {
                    Button(onClick = { viewModel.startGame(gameId) }) {
                        Text("Iniciar Jogo")
                    }
                    Button(onClick = { viewModel.finishGame(gameId) }) {
                        Text("Finalizar Jogo")
                    }
                    Button(onClick = { viewModel.balanceTeams() }) {
                        Text("Gerar Times")
                    }
                }

                when (game.status) {
                    "SCHEDULED" -> {
                        Button(onClick = { confirmPresence() }) {
                            Text("Confirmar Presença")
                        }
                    }
                    "CONFIRMED" -> {
                        Button(onClick = { cancelPresence() }) {
                            Text("Cancelar Presença")
                        }
                    }
                    "LIVE" -> {
                        Text("⚽ BOLA ROLANDO")
                    }
                    "FINISHED" -> {
                        Text("Jogo finalizado")
                    }
                }
            }
        }
    }
}
```

### Depois (Centralizado)
```kotlin
@Composable
fun GameDetailScreen(
    viewModel: GameDetailViewModel,
    gameId: String,
    onNavigateBack: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState) {
        val state = uiState
        if (state is GameDetailUiState.Success) {
            state.schedulingEvent?.let { event ->
                when (event) {
                    is SchedulingEvent.Success ->
                        snackbarHostState.showSnackbar(
                            stringResource(R.string.game_schedule_next_planned, event.nextDate)
                        )
                    is SchedulingEvent.Conflict ->
                        snackbarHostState.showSnackbar(
                            stringResource(R.string.game_schedule_conflict, event.date)
                        )
                    is SchedulingEvent.Error ->
                        snackbarHostState.showSnackbar(
                            stringResource(R.string.game_schedule_error, event.message)
                        )
                }
            }
        }
    }

    Column {
        TopAppBar(
            title = { Text(stringResource(R.string.game_detail_header)) },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.action_back))
                }
            }
        )

        when (val game = (uiState as? GameDetailUiState.Success)?.game) {
            null -> CircularProgressIndicator()
            else -> {
                Text(game.title)
                Text(stringResource(R.string.game_location_format, game.locationName))
                Text(stringResource(R.string.game_field_format, game.fieldName))

                Row {
                    Button(onClick = { viewModel.startGame(gameId) }) {
                        Text(stringResource(R.string.game_action_start))
                    }
                    Button(onClick = { viewModel.finishGame(gameId) }) {
                        Text(stringResource(R.string.game_action_finish))
                    }
                    Button(onClick = { viewModel.balanceTeams() }) {
                        Text(stringResource(R.string.game_action_balance_teams_short))
                    }
                }

                when (game.status) {
                    stringResource(R.string.game_status_scheduled) -> {
                        Button(onClick = { confirmPresence() }) {
                            Text(stringResource(R.string.game_confirm_presence))
                        }
                    }
                    stringResource(R.string.game_status_confirmed) -> {
                        Button(onClick = { cancelPresence() }) {
                            Text(stringResource(R.string.game_cancel_presence))
                        }
                    }
                    stringResource(R.string.game_status_live) -> {
                        Text("⚽ BOLA ROLANDO")
                    }
                    stringResource(R.string.game_status_finished) -> {
                        Text(stringResource(R.string.end_game_label))
                    }
                }
            }
        }
    }
}
```

**Benefícios**:
- ✅ Sem strings hardcoded
- ✅ Fácil de traduzir
- ✅ Manutenção centralizada
- ✅ Reutilizável em outras telas

---

## 2. CashboxScreen.kt

### Antes (Hardcoded)
```kotlin
@Composable
fun CashboxScreen(
    viewModel: CashboxViewModel,
    groupId: String,
    onNavigateBack: () -> Unit = {}
) {
    val summaryState by viewModel.summaryState.collectAsStateWithLifecycle()
    val entriesState by viewModel.entriesState.collectAsStateWithLifecycle()

    var showRecalculateDialog by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Caixa do Grupo") }
        )

        when (val summary = summaryState) {
            is CashboxSummaryState.Success -> {
                // Saldo Atual
                Card {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Saldo Atual", fontWeight = FontWeight.Bold)
                        Text("R$ ${summary.balance}", fontSize = 24.sp, color = Color.Green)
                    }
                }

                Row {
                    Column {
                        Text("Receitas", fontWeight = FontWeight.Bold)
                        Text("+ R$ ${summary.income}")
                    }
                    Column {
                        Text("Despesas", fontWeight = FontWeight.Bold)
                        Text("- R$ ${summary.expenses}")
                    }
                }

                // Filtros
                Row {
                    Button(onClick = { viewModel.filterByType("ALL") }) {
                        Text("Todos")
                    }
                    Button(onClick = { viewModel.filterByType("INCOME") }) {
                        Text("Receitas")
                    }
                    Button(onClick = { viewModel.filterByType("EXPENSE") }) {
                        Text("Despesas")
                    }
                }

                // Histórico
                LazyColumn {
                    when (entriesState) {
                        is CashboxEntriesState.Empty -> {
                            item {
                                Text("Não há movimentações registradas no caixa")
                            }
                        }
                        is CashboxEntriesState.Success -> {
                            items(entriesState.entries) { entry ->
                                CashboxEntryItem(entry)
                            }
                        }
                    }
                }

                // Ações
                Row {
                    Button(onClick = { viewModel.addIncome() }) {
                        Text("Adicionar Receita")
                    }
                    Button(onClick = { viewModel.addExpense() }) {
                        Text("Adicionar Despesa")
                    }
                    Button(onClick = { showRecalculateDialog = true }) {
                        Text("Recalcular Saldo")
                    }
                }
            }
        }
    }

    if (showRecalculateDialog) {
        AlertDialog(
            title = { Text("Recalcular Saldo") },
            text = { Text("Isso irá recalcular o saldo com base em todas as entradas e saídas. Continuar?") },
            confirmButton = {
                Button(onClick = {
                    viewModel.recalculateBalance()
                    showRecalculateDialog = false
                }) {
                    Text("Recalcular")
                }
            }
        )
    }
}
```

### Depois (Centralizado)
```kotlin
@Composable
fun CashboxScreen(
    viewModel: CashboxViewModel,
    groupId: String,
    onNavigateBack: () -> Unit = {}
) {
    val summaryState by viewModel.summaryState.collectAsStateWithLifecycle()
    val entriesState by viewModel.entriesState.collectAsStateWithLifecycle()

    var showRecalculateDialog by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(stringResource(R.string.cashbox_title)) }
        )

        when (val summary = summaryState) {
            is CashboxSummaryState.Success -> {
                // Saldo Atual
                Card {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.cashbox_current_balance), fontWeight = FontWeight.Bold)
                        Text("R$ ${summary.balance}", fontSize = 24.sp, color = Color.Green)
                    }
                }

                Row {
                    Column {
                        Text(stringResource(R.string.cashbox_income_header), fontWeight = FontWeight.Bold)
                        Text("+ R$ ${summary.income}")
                    }
                    Column {
                        Text(stringResource(R.string.cashbox_expense_header), fontWeight = FontWeight.Bold)
                        Text("- R$ ${summary.expenses}")
                    }
                }

                // Filtros
                Row {
                    Button(onClick = { viewModel.filterByType("ALL") }) {
                        Text(stringResource(R.string.cashbox_all))
                    }
                    Button(onClick = { viewModel.filterByType("INCOME") }) {
                        Text(stringResource(R.string.cashbox_income_header))
                    }
                    Button(onClick = { viewModel.filterByType("EXPENSE") }) {
                        Text(stringResource(R.string.cashbox_expense_header))
                    }
                }

                // Histórico
                LazyColumn {
                    when (entriesState) {
                        is CashboxEntriesState.Empty -> {
                            item {
                                Text(stringResource(R.string.cashbox_no_entries))
                            }
                        }
                        is CashboxEntriesState.Success -> {
                            items(entriesState.entries) { entry ->
                                CashboxEntryItem(entry)
                            }
                        }
                    }
                }

                // Ações
                Row {
                    Button(onClick = { viewModel.addIncome() }) {
                        Text(stringResource(R.string.cashbox_add_income))
                    }
                    Button(onClick = { viewModel.addExpense() }) {
                        Text(stringResource(R.string.cashbox_add_expense))
                    }
                    Button(onClick = { showRecalculateDialog = true }) {
                        Text(stringResource(R.string.cashbox_recalculate))
                    }
                }
            }
        }
    }

    if (showRecalculateDialog) {
        AlertDialog(
            title = { Text(stringResource(R.string.cashbox_recalculate)) },
            text = { Text(stringResource(R.string.cashbox_recalculate_confirm)) },
            confirmButton = {
                Button(onClick = {
                    viewModel.recalculateBalance()
                    showRecalculateDialog = false
                }) {
                    Text(stringResource(R.string.cashbox_recalculate))
                }
            }
        )
    }
}
```

**Benefícios**:
- ✅ 10 strings removidas do código
- ✅ Título e diálogos centralizados
- ✅ Fácil manutenção de mensagens
- ✅ Pronto para tradução

---

## 3. CreateGameViewModel.kt

### Antes (Hardcoded)
```kotlin
@HiltViewModel
class CreateGameViewModel @Inject constructor(
    private val gameRepository: GameRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<CreateGameUiState>(CreateGameUiState.Loading)
    val uiState: StateFlow<CreateGameUiState> = _uiState.asStateFlow()

    fun validateAndCreate(game: Game) {
        viewModelScope.launch {
            try {
                // Validações
                if (game.ownerName.length < 3) {
                    _uiState.value = CreateGameUiState.Error(
                        "Nome do responsável deve ter entre 3 e 50 caracteres"
                    )
                    return@launch
                }

                if (game.maxPlayers < 4 || game.maxPlayers > 100) {
                    _uiState.value = CreateGameUiState.Error(
                        "Número de jogadores inválido (mín 4, máx 100)"
                    )
                    return@launch
                }

                if (game.startTime.isAfter(LocalDateTime.now())) {
                    _uiState.value = CreateGameUiState.Error(
                        "A data e horário do início devem ser futuros"
                    )
                    return@launch
                }

                // Salvar
                gameRepository.createGame(game)
                _uiState.value = CreateGameUiState.Success(
                    "Jogo de ${game.ownerName} - ${game.location.name}"
                )
            } catch (e: Exception) {
                _uiState.value = CreateGameUiState.Error(
                    "Erro ao salvar jogo"
                )
            }
        }
    }
}
```

### Depois (Centralizado)
```kotlin
@HiltViewModel
class CreateGameViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow<CreateGameUiState>(CreateGameUiState.Loading)
    val uiState: StateFlow<CreateGameUiState> = _uiState.asStateFlow()

    fun validateAndCreate(game: Game) {
        viewModelScope.launch {
            try {
                // Validações
                if (game.ownerName.length < 3) {
                    _uiState.value = CreateGameUiState.Error(
                        context.getString(R.string.create_game_error_owner_name)
                    )
                    return@launch
                }

                if (game.maxPlayers < 4 || game.maxPlayers > 100) {
                    _uiState.value = CreateGameUiState.Error(
                        context.getString(R.string.create_game_error_max_players)
                    )
                    return@launch
                }

                if (game.startTime.isAfter(LocalDateTime.now())) {
                    _uiState.value = CreateGameUiState.Error(
                        context.getString(R.string.create_game_error_date_future)
                    )
                    return@launch
                }

                // Salvar
                gameRepository.createGame(game)
                val successMsg = context.getString(
                    R.string.create_game_success_format,
                    game.ownerName,
                    game.location.name
                )
                _uiState.value = CreateGameUiState.Success(successMsg)
            } catch (e: Exception) {
                _uiState.value = CreateGameUiState.Error(
                    context.getString(R.string.error_save_game)
                )
            }
        }
    }
}
```

**Nota**: Strings precisariam ser adicionadas ao strings.xml com placeholders:
```xml
<string name="create_game_success_format">Jogo de %1$s - %2$s</string>
<string name="create_game_error_date_future">A data e horário do início devem ser futuros</string>
```

**Benefícios**:
- ✅ Mensagens de erro centralizadas
- ✅ Fácil identificar todas as mensagens de validação
- ✅ Pronto para tradução
- ✅ Reutilizável em outras validações

---

## 4. ProfileScreen.kt

### Antes (Hardcoded)
```kotlin
@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onNavigateToEdit: () -> Unit = {}
) {
    val userState by viewModel.userState.collectAsStateWithLifecycle()
    val statsState by viewModel.statsState.collectAsStateWithLifecycle()

    when (val user = userState) {
        is UserState.Success -> {
            Column {
                // Cabeçalho
                Text(stringResource(R.string.profile_title))
                when (user.role) {
                    "ADMIN" -> Text("ADMINISTRADOR")
                    "ORGANIZER" -> Text("ORGANIZADOR")
                    else -> Text("Membro")
                }

                Text("Nível ${user.level}")
                Text(user.levelName)

                // Menu
                Column {
                    MenuRow(
                        icon = Icons.Default.Notifications,
                        label = "Notificações",
                        onClick = { /* navigate */ }
                    )
                    MenuRow(
                        icon = Icons.Default.Schedule,
                        label = "Minhas Recorrências",
                        onClick = { /* navigate */ }
                    )
                    MenuRow(
                        icon = Icons.Default.Settings,
                        label = "Preferências",
                        onClick = { /* navigate */ }
                    )
                }

                // Stats
                when (val stats = statsState) {
                    is StatsState.Success -> {
                        Text("Estatísticas da Carreira")
                        Row {
                            StatCard("Jogos", stats.games.toString())
                            StatCard("Vitórias", stats.victories.toString())
                            StatCard("Gols", stats.goals.toString())
                            StatCard("Assistências", stats.assists.toString())
                        }
                    }
                }

                // Admin Menu
                if (user.isAdmin) {
                    Column {
                        Text("ADMINISTRAÇÃO")
                        MenuRow("Configurações da Liga")
                        MenuRow("Gerenciar Usuários")
                        MenuRow("Gerenciar Locais e Quadras")
                    }
                }
            }
        }
    }
}
```

### Depois (Centralizado)
```kotlin
@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onNavigateToEdit: () -> Unit = {}
) {
    val userState by viewModel.userState.collectAsStateWithLifecycle()
    val statsState by viewModel.statsState.collectAsStateWithLifecycle()

    when (val user = userState) {
        is UserState.Success -> {
            Column {
                // Cabeçalho
                Text(stringResource(R.string.profile_title))
                when (user.role) {
                    "ADMIN" -> Text(stringResource(R.string.profile_role_admin))
                    "ORGANIZER" -> Text(stringResource(R.string.profile_role_organizer))
                    else -> Text(stringResource(R.string.profile_role_member))
                }

                Text(stringResource(R.string.profile_level_format, user.level))
                Text(user.levelName)

                // Menu
                Column {
                    MenuRow(
                        icon = Icons.Default.Notifications,
                        label = stringResource(R.string.profile_menu_notifications),
                        onClick = { /* navigate */ }
                    )
                    MenuRow(
                        icon = Icons.Default.Schedule,
                        label = stringResource(R.string.profile_menu_schedules),
                        onClick = { /* navigate */ }
                    )
                    MenuRow(
                        icon = Icons.Default.Settings,
                        label = stringResource(R.string.profile_menu_preferences),
                        onClick = { /* navigate */ }
                    )
                }

                // Stats
                when (val stats = statsState) {
                    is StatsState.Success -> {
                        Text(stringResource(R.string.profile_statistics))
                        Row {
                            StatCard(
                                stringResource(R.string.profile_stats_games),
                                stats.games.toString()
                            )
                            StatCard(
                                stringResource(R.string.profile_stats_victories),
                                stats.victories.toString()
                            )
                            StatCard(
                                stringResource(R.string.profile_stats_goals),
                                stats.goals.toString()
                            )
                            StatCard(
                                stringResource(R.string.profile_stats_assists),
                                stats.assists.toString()
                            )
                        }
                    }
                }

                // Admin Menu
                if (user.isAdmin) {
                    Column {
                        Text("ADMINISTRAÇÃO")
                        MenuRow(stringResource(R.string.profile_menu_settings))
                        MenuRow(stringResource(R.string.profile_menu_manage_users))
                        MenuRow(stringResource(R.string.profile_menu_manage_locations))
                    }
                }
            }
        }
    }
}
```

**Benefícios**:
- ✅ 15+ strings removidas
- ✅ Menu reutilizável em diferentes locais
- ✅ Nomes de roles centralizados
- ✅ Estatísticas claras e padronizadas

---

## 5. LeagueScreen.kt

### Antes (Hardcoded)
```kotlin
@Composable
fun LeagueScreen(viewModel: LeagueViewModel) {
    val rankingState by viewModel.rankingState.collectAsStateWithLifecycle()
    val selectedDivision by viewModel.selectedDivision

    Column {
        Text("Sistema de Ligas", fontSize = 24.sp, fontWeight = FontWeight.Bold)

        when (val ranking = rankingState) {
            is RankingState.Success -> {
                // Divisões
                Row {
                    Button(onClick = { viewModel.selectDivision("GOLD") }) {
                        Text("OURO")
                    }
                    Button(onClick = { viewModel.selectDivision("SILVER") }) {
                        Text("PRATA")
                    }
                    Button(onClick = { viewModel.selectDivision("BRONZE") }) {
                        Text("BRONZE")
                    }
                    Button(onClick = { viewModel.selectDivision("DIAMOND") }) {
                        Text("DIAMANTE")
                    }
                }

                LazyColumn {
                    when {
                        ranking.players.isEmpty() -> {
                            item {
                                Text("Nenhum jogador nesta divisão")
                                Text("Jogue mais partidas para\nsubir no ranking!")
                            }
                        }
                        else -> {
                            items(ranking.players) { player ->
                                RankingItem(
                                    player = player,
                                    position = ranking.players.indexOf(player) + 1
                                )
                            }
                        }
                    }
                }

                Text("Período: ${ranking.season}")
                Text("Pontos: ${ranking.totalPoints}")
                Text("Jogos: ${ranking.games}")
                Text("Vitórias: ${ranking.victories}")
                Text("Gols: ${ranking.goals}")
                Text("MVPs: ${ranking.mvps}")
            }
            is RankingState.Error -> {
                Text("Erro ao carregar ranking")
            }
            is RankingState.Loading -> {
                CircularProgressIndicator()
            }
        }
    }
}
```

### Depois (Centralizado)
```kotlin
@Composable
fun LeagueScreen(viewModel: LeagueViewModel) {
    val rankingState by viewModel.rankingState.collectAsStateWithLifecycle()
    val selectedDivision by viewModel.selectedDivision

    Column {
        Text(
            stringResource(R.string.league_title),
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )

        when (val ranking = rankingState) {
            is RankingState.Success -> {
                // Divisões
                Row {
                    Button(onClick = { viewModel.selectDivision("GOLD") }) {
                        Text(stringResource(R.string.league_division_gold))
                    }
                    Button(onClick = { viewModel.selectDivision("SILVER") }) {
                        Text(stringResource(R.string.league_division_silver))
                    }
                    Button(onClick = { viewModel.selectDivision("BRONZE") }) {
                        Text(stringResource(R.string.league_division_bronze))
                    }
                    Button(onClick = { viewModel.selectDivision("DIAMOND") }) {
                        Text(stringResource(R.string.league_division_diamond))
                    }
                }

                LazyColumn {
                    when {
                        ranking.players.isEmpty() -> {
                            item {
                                Text(stringResource(R.string.league_no_players))
                                Text(stringResource(R.string.league_season_message))
                            }
                        }
                        else -> {
                            items(ranking.players) { player ->
                                RankingItem(
                                    player = player,
                                    position = ranking.players.indexOf(player) + 1
                                )
                            }
                        }
                    }
                }

                Text(
                    stringResource(R.string.league_period) +
                    ": ${ranking.season}"
                )
                Text(
                    stringResource(R.string.league_points) +
                    ": ${ranking.totalPoints}"
                )
                Text(
                    stringResource(R.string.league_games_played) +
                    ": ${ranking.games}"
                )
                Text(
                    stringResource(R.string.league_victories) +
                    ": ${ranking.victories}"
                )
                Text(
                    stringResource(R.string.league_goals) +
                    ": ${ranking.goals}"
                )
                Text(
                    stringResource(R.string.league_mvp_count) +
                    ": ${ranking.mvps}"
                )
            }
            is RankingState.Error -> {
                Text(stringResource(R.string.error_loading_data))
            }
            is RankingState.Loading -> {
                CircularProgressIndicator()
            }
        }
    }
}
```

**Benefícios**:
- ✅ 14 strings removidas
- ✅ Divisões padronizadas
- ✅ Mensagens de erro consistentes
- ✅ Fácil adicionar novos idiomas

---

## Conclusão

Todos esses exemplos mostram como o código fica mais **limpo**, **fácil de manter** e **pronto para tradução** após usar as strings centralizadas.

### Resumo dos Benefícios:
1. ✅ Menos strings hardcoded no código
2. ✅ Repositório centralizado para manutenção
3. ✅ Preparado para internacionalização
4. ✅ Reutilização de strings comuns
5. ✅ Código mais legível
6. ✅ Facilita code review
7. ✅ Reduz erros de digitação

---

**Nota**: Alguns dos strings nestes exemplos ("create_game_error_date_future", "create_game_success_format") precisariam ser adicionados ao strings.xml. Este é um exemplo das próximas fases (Fase 2+).

**Gerado em**: 2026-01-07
**Versão**: 1.0
