# Migração CreateGameFragment → CreateGameScreen (Jetpack Compose)

## Resumo

Migração completa do `CreateGameFragment` (XML/ViewBinding) para `CreateGameScreen` (Jetpack Compose moderno), seguindo as diretrizes do projeto e preparado para Kotlin Multiplatform (KMP/iOS).

## Arquivos Criados

### 1. CreateGameScreen.kt
**Localização:** `app/src/main/java/com/futebadosparcas/ui/games/CreateGameScreen.kt`

**Responsabilidades:**
- Tela principal de criação/edição de jogos
- Material Design 3 completo
- Validação em tempo real de todos os campos
- Gestão de estados com StateFlow
- Animações suaves (AnimatedVisibility, slideIn/fadeIn)
- Accessibility (contentDescription, semantics)

**Features implementadas:**
- ✅ Seleção de Local e Quadra com cards visuais
- ✅ Date/Time Pickers Material3
- ✅ Seleção de Grupo (Dropdown)
- ✅ Visibilidade do jogo (GROUP_ONLY, PUBLIC_CLOSED, PUBLIC_OPEN)
- ✅ Recorrência com Switch + Dropdown
- ✅ Preço e máximo de jogadores
- ✅ Detecção e exibição de conflitos de horário
- ✅ Estados de Loading/Error/Success
- ✅ Validação completa antes de salvar

### 2. DateTimePickerDialogs.kt
**Localização:** `app/src/main/java/com/futebadosparcas/ui/games/DateTimePickerDialogs.kt`

**Componentes:**
- `DatePickerDialog`: Material3 DatePicker com validação de data futura
- `TimePickerDialog`: Material3 TimePicker (formato 24h)

**Features:**
- ✅ Suporte a valores iniciais (para edição)
- ✅ Callbacks claros (onDateSelected, onTimeSelected)
- ✅ Dialog dismiss handling
- ✅ Conversão LocalDate/LocalTime ↔ Calendar

### 3. LocationFieldDialogs.kt
**Localização:** `app/src/main/java/com/futebadosparcas/ui/games/LocationFieldDialogs.kt`

**Componentes:**

#### LocationSelectionDialog
- Dialog de seleção de local com busca integrada
- ViewModel: `LocationSelectionViewModel`
- Search com debounce (300ms)
- Normalização de strings (remove acentos) para busca inteligente
- Integração com Google Places API (estrutura preparada)
- Empty/Error/Loading states

#### FieldSelectionDialog
- Dialog de seleção de quadra/campo
- ViewModel: `FieldSelectionViewModel`
- Filtro por tipo (Society, Futsal, Campo)
- ScrollableTabRow para filtros
- Empty/Error/Loading states

**States implementados:**
- `LocationSelectionUiState`: Idle, Loading, Success, Error
- `FieldSelectionUiState`: Idle, Loading, Success, Error

## Integrações com ViewModel

### CreateGameViewModel (já existente)
O ViewModel já estava preparado para Compose. Os seguintes flows são observados:

```kotlin
- uiState: StateFlow<CreateGameUiState>
- selectedDate: StateFlow<LocalDate?>
- selectedTime: StateFlow<LocalTime?>
- selectedEndTime: StateFlow<LocalTime?>
- selectedLocation: StateFlow<Location?>
- selectedField: StateFlow<Field?>
- currentUser: StateFlow<String>
- availableGroups: StateFlow<List<UserGroup>>
- selectedGroup: StateFlow<UserGroup?>
- selectedVisibility: StateFlow<GameVisibility>
- timeConflicts: StateFlow<List<TimeConflict>>
- isEditing: StateFlow<Boolean>
```

### Métodos utilizados
```kotlin
viewModel.setDate(year, month, day)
viewModel.setTime(hour, minute)
viewModel.setEndTime(hour, minute)
viewModel.setLocation(location)
viewModel.setField(field)
viewModel.selectGroup(group)
viewModel.setVisibility(visibility)
viewModel.saveGame(gameId, ownerName, price, maxPlayers, recurrence)
viewModel.loadGame(gameId) // Para edição
```

## Strings Adicionadas

Arquivo: `app/src/main/res/values/strings.xml`

```xml
<!-- Create Game Screen (Compose) -->
<string name="create_game_edit_title">Editar Jogo</string>
<string name="create_game_section_location">Local e Quadra</string>
<string name="create_game_section_basic_info">Informacoes Basicas</string>
<string name="create_game_section_datetime">Data e Horario</string>
<string name="create_game_section_pricing">Preco e Jogadores</string>
<string name="create_game_error_owner_name">Nome do responsavel deve ter pelo menos 3 caracteres</string>
<string name="create_game_error_price">Preco invalido</string>
<string name="create_game_error_max_players">Numero de jogadores deve estar entre 4 e 100</string>
<string name="create_game_no_groups_warning">Voce precisa ser Dono ou Administrador de um grupo para criar jogos</string>
<string name="create_game_search_results">Resultados da Busca</string>
```

**Strings reutilizadas do Fragment:**
- Todas as strings do `fragment_create_game_*` foram mantidas
- Todas as strings do `dialog_select_location_*` e `dialog_select_field_*` foram mantidas

## Como Usar

### Navegação (Navigation Compose)

```kotlin
// No seu NavHost
composable(
    route = "createGame?gameId={gameId}",
    arguments = listOf(
        navArgument("gameId") {
            type = NavType.StringType
            nullable = true
            defaultValue = null
        }
    )
) { backStackEntry ->
    val gameId = backStackEntry.arguments?.getString("gameId")
    val hapticManager = hiltViewModel<YourMainViewModel>().hapticManager

    CreateGameScreen(
        gameId = gameId,
        hapticManager = hapticManager,
        onNavigateBack = { navController.popBackStack() },
        onGameCreated = { createdGameId ->
            navController.navigate("gameDetail/$createdGameId") {
                popUpTo("createGame") { inclusive = true }
            }
        }
    )
}
```

### Exemplo de Navegação

```kotlin
// Criar novo jogo
navController.navigate("createGame")

// Editar jogo existente
navController.navigate("createGame?gameId=$gameId")
```

## Validações Implementadas

### Campos obrigatórios
- ✅ Local selecionado
- ✅ Quadra selecionada
- ✅ Data do jogo (futura)
- ✅ Horário de início (futuro)
- ✅ Horário de término (após início)
- ✅ Nome do responsável (3-50 caracteres)
- ✅ Grupo selecionado
- ✅ Preço (≥ 0)
- ✅ Máximo de jogadores (4-100)

### Validações de negócio
- ✅ Data/hora não pode ser no passado
- ✅ Horário de término deve ser após início
- ✅ Detecção de conflitos de horário na mesma quadra
- ✅ Usuário deve ser Dono ou Admin de pelo menos um grupo

## Estados de UI

### Loading
- Exibe CircularProgressIndicator no botão de salvar
- Overlay semi-transparente sobre a tela durante save

### Error
- Card vermelho animado no topo com mensagem de erro
- Erros específicos em cada campo (TextField.supportingText)

### Success
- Haptic feedback (success)
- Navegação automática para tela de destino
- Callback `onGameCreated(gameId)` chamado

### Conflitos de Horário
- Card laranja animado com aviso de conflito
- Exibe detalhes do jogo conflitante
- Bloqueia salvamento até resolver

## Preparação para KMP/iOS

### ✅ Separação de responsabilidades
- Lógica 100% no ViewModel (compartilhável)
- UI 100% Compose (re-implementável em SwiftUI)

### ✅ Sem dependências Android-específicas na UI
- Apenas Compose APIs
- Material3 (cross-platform ready)
- Coroutines/Flow (KMP-ready)

### ✅ ViewModels independentes
- `LocationSelectionViewModel`: Pode ser movido para `shared/`
- `FieldSelectionViewModel`: Pode ser movido para `shared/`
- `CreateGameViewModel`: Já em camada `domain`

### 🔄 Próximos passos KMP
1. Mover ViewModels para `shared/src/commonMain/`
2. Criar interfaces para Google Places (expect/actual)
3. Implementar SwiftUI equivalente (iOS)

## Diferenças do Fragment Original

| Aspecto | Fragment (XML) | Screen (Compose) |
|---------|---------------|------------------|
| **Date/Time Pickers** | MaterialDatePicker, MaterialTimePicker | DatePicker, TimePicker (Material3 Compose) |
| **Location/Field Dialog** | DialogFragment com RecyclerView | Compose Dialog com LazyColumn |
| **Validação** | Manual no onClick | Em tempo real + validação final |
| **Estados** | View.VISIBLE/GONE | AnimatedVisibility |
| **Loading** | ProgressBar view | CircularProgressIndicator Composable |
| **Errors** | Snackbar | Card animado + TextField errors |
| **Haptics** | Injetado via Fragment | Passado como parâmetro |

## Accessibility

### Todos os componentes têm:
- ✅ contentDescription adequados
- ✅ semantics para leitores de tela
- ✅ Contraste de cores acessível (Material3)
- ✅ Touch targets ≥ 48dp

## Performance

### Otimizações aplicadas:
- ✅ `collectAsStateWithLifecycle` (cancela coleta quando fora de tela)
- ✅ `remember` para estados locais
- ✅ `derivedStateOf` onde apropriado
- ✅ LazyColumn com `key` para recomposição eficiente
- ✅ Debounce de 300ms na busca de locais

## Testes Recomendados

### Cenários de Teste

1. **Criar novo jogo**
   - Preencher todos os campos
   - Validar salvamento e navegação

2. **Editar jogo existente**
   - Carregar jogo
   - Verificar pré-preenchimento de campos
   - Salvar alterações

3. **Validações**
   - Tentar salvar com campos vazios
   - Tentar salvar com data passada
   - Tentar salvar com horário de término antes do início

4. **Conflitos**
   - Criar jogo com horário conflitante
   - Verificar exibição do aviso

5. **Grupos**
   - Usuário sem grupos: verificar mensagem de erro
   - Usuário com grupos: verificar dropdown funcional

## Comentários em PT-BR

Todos os comentários do código estão em Português (PT-BR), conforme diretrizes do projeto:

```kotlin
// Seção: Local e Quadra
// Seção: Informações básicas
// Validações de campo
// Estados de erro
// Estados de dialogs
// Preencher form quando carregar jogo para edição
```

## Arquitetura

```
CreateGameScreen (UI Layer - Compose)
    ↓
CreateGameViewModel (Domain Layer)
    ↓
GameRepository, LocationRepository (Data Layer)
    ↓
Firebase Firestore
```

## Próximas Melhorações Sugeridas

1. **Google Places Integration**
   - Completar integração no `LocationSelectionViewModel`
   - Adicionar autocomplete em tempo real

2. **Imagens**
   - Upload de foto do local/quadra
   - Visualização inline

3. **Mapa**
   - Visualizar local no mapa
   - Seleção via mapa

4. **Templates de Jogo**
   - Funcionalidade já existe no ViewModel
   - Criar UI Compose para templates

5. **Testes Automatizados**
   - Unit tests para ViewModels
   - UI tests com Compose Test
   - Screenshot tests

## Referências

- [Material3 Compose](https://m3.material.io/develop/android/jetpack-compose)
- [Kotlin Multiplatform](https://kotlinlang.org/docs/multiplatform.html)
- [Compose Navigation](https://developer.android.com/jetpack/compose/navigation)
- [Compose State](https://developer.android.com/jetpack/compose/state)

---

**Criado em:** 2026-01-05
**Autor:** Claude Sonnet 4.5 (Anthropic)
**Projeto:** Futeba dos Parças v1.4.0
