# Guia de Uso: Strings Centralizadas

## Como Usar as Strings em Diferentes Contextos

### 1. Em Jetpack Compose

#### Texto Simples
```kotlin
// ❌ Antes (Hardcoded)
Text("Confirmar Presença")

// ✅ Depois (Centralizado)
Text(stringResource(R.string.game_confirm_presence))
```

#### Com Formatação
```kotlin
// ❌ Antes
Text("Rating: ${rating.toInt()}")

// ✅ Depois
Text(stringResource(R.string.league_rating_format) + rating.toInt())
// Ou melhor ainda, se a string tiver placeholder
val ratingText = stringResource(R.string.league_rating_format, rating.toInt())
Text(ratingText)
```

#### Em Snackbars
```kotlin
// ❌ Antes
snackbarHostState.showSnackbar("Jogo cancelado com sucesso")

// ✅ Depois
snackbarHostState.showSnackbar(stringResource(R.string.game_cancelled_success))
```

#### Em Diálogos
```kotlin
// ❌ Antes
AlertDialog(
    title = { Text("Editar Grupo") },
    message = { Text("Tem certeza que deseja arquivar o grupo?") }
)

// ✅ Depois
AlertDialog(
    title = { Text(stringResource(R.string.dialog_edit_group)) },
    message = { Text(stringResource(R.string.confirm_archive_group)) }
)
```

### 2. Em ViewModels (para Error Messages)

```kotlin
// ❌ Antes
_uiState.value = GameUiState.Error("Erro ao carregar jogo")

// ✅ Depois
_uiState.value = GameUiState.Error(
    context.getString(R.string.error_loading_game)
)
```

### 3. Em Repositories

```kotlin
// ❌ Antes (Hardcoded)
if (locations.isEmpty()) {
    throw Exception("Nenhum local cadastrado")
}

// ✅ Depois (Context required)
if (locations.isEmpty()) {
    val message = context.getString(R.string.location_no_registered)
    throw Exception(message)
}
```

## Exemplos por Categoria

### Game Status
```kotlin
// Verificar status
val statusText = when(gameStatus) {
    "SCHEDULED" -> stringResource(R.string.game_status_scheduled)
    "CONFIRMED" -> stringResource(R.string.game_status_confirmed)
    "LIVE" -> stringResource(R.string.game_status_live)
    "FINISHED" -> stringResource(R.string.game_status_finished)
    else -> stringResource(R.string.error_unknown)
}

Text(statusText)
```

### Game Actions with Buttons
```kotlin
// Lista de ações disponíveis
Row {
    Button(onClick = { startGame() }) {
        Text(stringResource(R.string.game_action_start))
    }

    Button(onClick = { balanceTeams() }) {
        Text(stringResource(R.string.game_action_balance_teams_short))
    }

    Button(onClick = { finishGame() }) {
        Text(stringResource(R.string.game_action_finish))
    }
}
```

### Error Handling Pattern
```kotlin
// Em ViewModel
try {
    loadGames()
} catch (e: Exception) {
    _uiState.value = GameUiState.Error(
        when {
            e is NetworkException ->
                context.getString(R.string.error_network)
            e is FirebaseException ->
                context.getString(R.string.error_loading_games)
            else ->
                context.getString(R.string.error_unknown)
        }
    )
}
```

### Day of Week Display
```kotlin
// Formatar recorrências
val dayOfWeekText = when(dayOfWeek) {
    Calendar.SUNDAY -> stringResource(R.string.day_sunday)
    Calendar.MONDAY -> stringResource(R.string.day_monday)
    Calendar.TUESDAY -> stringResource(R.string.day_tuesday)
    Calendar.WEDNESDAY -> stringResource(R.string.day_wednesday)
    Calendar.THURSDAY -> stringResource(R.string.day_thursday)
    Calendar.FRIDAY -> stringResource(R.string.day_friday)
    Calendar.SATURDAY -> stringResource(R.string.day_saturday)
    else -> stringResource(R.string.error_unknown)
}

Text("Recorrente: $dayOfWeekText às 19:00")
```

### Profile Display
```kotlin
// Exibir perfil do usuário
Column {
    Text(stringResource(R.string.profile_title))

    Row {
        Text(stringResource(R.string.profile_stats_games))
        Text(user.gamesCount.toString())
    }

    Row {
        Text(stringResource(R.string.profile_stats_goals))
        Text(user.totalGoals.toString())
    }

    Row {
        Text(stringResource(R.string.profile_stats_assists))
        Text(user.totalAssists.toString())
    }
}
```

### Location Management
```kotlin
// Formulário de criação de local
Column {
    OutlinedTextField(
        label = { Text(stringResource(R.string.location_address)) },
        value = address,
        onValueChange = { address = it }
    )

    OutlinedTextField(
        label = { Text(stringResource(R.string.location_neighborhood)) },
        value = neighborhood,
        onValueChange = { neighborhood = it }
    )

    OutlinedTextField(
        label = { Text(stringResource(R.string.location_zipcode)) },
        value = zipcode,
        onValueChange = { zipcode = it }
    )

    Button(onClick = { saveLocation() }) {
        Text(stringResource(R.string.action_save))
    }
}
```

### League Display
```kotlin
// Exibir ranking
Column {
    Text(stringResource(R.string.league_title))

    Text(stringResource(R.string.league_my_position))
    Text("#15")

    Text(stringResource(R.string.league_games_played))
    Text("15")

    Text(stringResource(R.string.league_victories))
    Text("10")

    Text(stringResource(R.string.league_goals))
    Text("25")
}
```

### Confirmation Dialogs
```kotlin
// Deletar jogo
fun showDeleteConfirmation(gameId: String, ownerName: String) {
    AlertDialog(
        onDismissRequest = { },
        title = { Text(stringResource(R.string.confirm_delete_group)) },
        text = { Text("Tem certeza?") },
        confirmButton = {
            Button(onClick = { deleteGame(gameId) }) {
                Text(stringResource(R.string.action_delete))
            }
        },
        dismissButton = {
            Button(onClick = { }) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}
```

### Badge Rarity
```kotlin
// Exibir raridade de badge
val rarityLabel = when(badge.rarity) {
    BadgeRarity.COMUM -> stringResource(R.string.badge_rarity_comum)
    BadgeRarity.RARO -> stringResource(R.string.badge_rarity_raro)
    BadgeRarity.LENDARIO -> stringResource(R.string.badge_rarity_lendario)
}

Text(rarityLabel)
```

## Dicas Importantes

### 1. Sempre Usar stringResource() em Compose
```kotlin
// ❌ Não faça isso
Text("Confirmar")

// ✅ Sempre use
Text(stringResource(R.string.action_confirm))
```

### 2. Para Formatação com Placeholders
Se você precisa inserir dados dinâmicos, use placeholders na string XML:

```xml
<!-- Em strings.xml -->
<string name="game_location_format">Jogo em %1$s</string>
```

```kotlin
// Em Compose
val locationText = stringResource(R.string.game_location_format, locationName)
Text(locationText)
```

### 3. Adicionar Novas Strings
Quando precisa de uma nova string:

1. Adicione ao `strings.xml` seguindo o padrão
2. Use imediatamente em seu código
3. Reutilize em outros locais quando possível

```xml
<!-- Novo exemplo -->
<string name="feature_new_action">Minha Nova Ação</string>
```

```kotlin
Button(onClick = { doSomething() }) {
    Text(stringResource(R.string.feature_new_action))
}
```

### 4. Evitar Anti-patterns

```kotlin
// ❌ Não concatene strings hardcoded
Text(stringResource(R.string.action_confirm) + " Jogador")

// ✅ Use uma string com placeholder
// strings.xml: <string name="confirm_player">Confirmar %1$s</string>
Text(stringResource(R.string.confirm_player, "Jogador"))

// ❌ Não use em condições
if (status == "CONFIRMED") { }

// ✅ Compare com constantes
if (status == GameStatus.CONFIRMED.value) { }
```

## Checklist para Code Review

Ao revisar código com strings:

- [ ] Todas as strings visíveis ao usuário estão em `strings.xml`?
- [ ] O padrão de nomenclatura está sendo seguido?
- [ ] Não há duplicação de strings?
- [ ] Todas as strings em português?
- [ ] Strings complexas têm placeholders apropriados?
- [ ] Erros mostram mensagens amigáveis ao usuário?

## Ferramenta: Encontrar Strings Hardcoded

Para encontrar strings que ainda precisam ser centralizadas:

```bash
# Buscar strings com aspas duplas e letras maiúsculas
grep -r "\"[A-Z]" app/src/main/java/com/futebadosparcas/ui --include="*.kt"

# Contar strings por arquivo
grep -r "\"[A-Z]" app/src/main/java/com/futebadosparcas --include="*.kt" | \
cut -d: -f1 | sort | uniq -c | sort -rn
```

## Próximas Migrações

### Fase 2: Arquivos Prioritários
1. `GameDetailScreen.kt` (73 strings)
2. `FirebaseDataSourceImpl.kt` (59 strings)
3. `MockDataHelper.kt` (58 strings)

### Migração Típica
```kotlin
// ❌ Antes
AppLogger.e(TAG, "Erro ao carregar jogo", exception)
_uiState.value = GameUiState.Error("Erro ao carregar jogo")

// ✅ Depois
val errorMsg = context.getString(R.string.error_loading_game)
AppLogger.e(TAG, errorMsg, exception)
_uiState.value = GameUiState.Error(errorMsg)
```

---

**Última Atualização**: 2026-01-07
**Versão**: 1.0
