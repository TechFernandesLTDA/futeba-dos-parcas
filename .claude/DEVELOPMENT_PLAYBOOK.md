# DEVELOPMENT PLAYBOOK - Futeba dos Parças

> Guia prático de desenvolvimento e revisão.
> Última atualização: 2025-01-10

---

## 1. FLUXO DE TRABALHO

### 1.1 Ciclo de Vida de uma Tarefa

```
1. Planejamento
   ├─ Entender requisito
   ├─ Identificar arquivos envolvidos
   └─ Planejar PRs (se grande)

2. Desenvolvimento
   ├─ Criar branch: feature/nome-da-feature
   ├─ Implementar seguindo RULES.md
   ├─ Testar manualmente
   └─ Rodar validação local

3. Revisão
   ├─ Abrir PR com descrição clara
   ├─ Aguardar feedback
   └─ Ajustar se necessário

4. Merge
   ├─ Approvals obtidos
   ├─ CI passando
   └─ Squash merge para main
```

### 1.2 Convenção de Branches

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Feature | `feature/` | `feature/add-cashbox-filters` |
| Bugfix | `bugfix/` | `bugfix/fix-game-crash` |
| Refactor | `refactor/` | `refactor/migrate-to-compose` |
| Hotfix | `hotfix/` | `hotfix/crashlytics-fix` |
| Release | `release/` | `release/1.4.3` |

---

## 2. COMO TRABALHAR

### 2.1 Implementar Nova Feature

#### Passo 1: Domain
```kotlin
// shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/
data class FeatureModel(
    val id: String,
    val name: String
)

// shared/src/commonMain/kotlin/com/futebadosparcas/domain/usecase/
class GetFeatureUseCase(
    private val repository: FeatureRepository
) {
    operator fun invoke(): Flow<List<FeatureModel>> {
        return repository.getFeatures()
    }
}
```

#### Passo 2: Data
```kotlin
// app/src/main/java/com/futebadosparcas/data/repository/
class FeatureRepositoryImpl(
    private val firestore: FirebaseFirestore
) : FeatureRepository {

    override fun getFeatures(): Flow<List<FeatureModel>> = flow {
        val snapshot = firestore.collection("features")
            .get()
            .await()
        val items = snapshot.toObjects<FeatureDto>()
            .map { it.toDomain() }
        emit(items)
    }
}
```

#### Passo 3: DI
```kotlin
// app/src/main/java/com/futebadosparcas/di/AppModule.kt
@Provides
@Singleton
fun provideFeatureRepository(
    firestore: FirebaseFirestore
): FeatureRepository {
    return FeatureRepositoryImpl(firestore)
}
```

#### Passo 4: Strings
```xml
<!-- app/src/main/res/values/strings.xml -->
<string name="feature_title">Título da Feature</string>
<string name="feature_empty">Nenhum item encontrado</string>
<string name="feature_error">Erro ao carregar</string>
```

#### Passo 5: ViewModel
```kotlin
@HiltViewModel
class FeatureViewModel @Inject constructor(
    private val getFeatureUseCase: GetFeatureUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<FeatureUiState>(FeatureUiState.Loading)
    val uiState: StateFlow<FeatureUiState> = _uiState

    private var loadJob: Job? = null

    fun loadFeatures() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            getFeatureUseCase()
                .catch { e ->
                    _uiState.value = FeatureUiState.Error(
                        message = e.message ?: "Erro desconhecido"
                    )
                }
                .collect { items ->
                    _uiState.value = if (items.isEmpty()) {
                        FeatureUiState.Empty
                    } else {
                        FeatureUiState.Success(items)
                    }
                }
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}

sealed class FeatureUiState {
    object Loading : FeatureUiState()
    data class Success(val items: List<FeatureModel>) : FeatureUiState()
    data class Error(val message: String) : FeatureUiState()
    object Empty : FeatureUiState()
}
```

#### Passo 6: Screen
```kotlin
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel = hiltViewModel(),
    onNavigate: (String) -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadFeatures()
    }

    FeatureContent(
        state = state,
        onNavigate = onNavigate
    )
}

@Composable
private fun FeatureContent(
    state: FeatureUiState,
    onNavigate: (String) -> Unit
) {
    when (state) {
        is FeatureUiState.Loading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
        is FeatureUiState.Success -> {
            LazyColumn {
                items(state.items, key = { it.id }) { item ->
                    FeatureItem(
                        item = item,
                        onClick = { onNavigate(item.id) }
                    )
                }
            }
        }
        is FeatureUiState.Error -> {
            ErrorContent(
                message = state.message,
                onRetry = { /* Retry */ }
            )
        }
        is FeatureUiState.Empty -> {
            EmptyContent(
                message = stringResource(R.string.feature_empty)
            )
        }
    }
}
```

#### Passo 7: Fragment (wrapper)
```kotlin
class FeatureFragment : Fragment() {
    private val viewModel: FeatureViewModel by viewModels()
    private var _binding: FragmentFeatureBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentFeatureBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.composeView.setContent {
            FutebaDosParcasTheme {
                FeatureScreen(viewModel) { destination ->
                    findNavController().navigate(destination)
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
```

#### Passo 8: Navigation
```xml
<!-- nav_graph.xml -->
<fragment
    android:id="@+id/featureFragment"
    android:name="com.futebadosparcas.ui.feature.FeatureFragment"
    android:label="@string/feature_title">
    <argument
        android:name="featureId"
        app:argType="string"
        app:nullable="true" />
</fragment>
```

### 2.2 Adicionar Nova String

```xml
<!-- Sempre em strings.xml -->
<string name="nome_descritivo">Texto que aparece na tela</string>

<!-- Com parâmetros -->
<string name="bem_vindo_usuario">Bem-vindo, %1$s!</string>

// Uso no código
getString(R.string.bem_vindo_usuario, userName)
```

### 2.3 Adicionar Novo Repository

1. Criar interface em `shared/` (se KMP) ou `app/domain/repository/`
2. Implementar em `app/data/repository/`
3. Adicionar provider em `AppModule.kt`
4. Injetar no ViewModel via Hilt

---

## 3. CODE REVIEW

### 3.1 Checklist para Revisão

**Funcionalidade:**
- [ ] Requisito implementado corretamente
- [ ] Edge cases tratados
- [ ] Estados de loading/error/empty

**Código:**
- [ ] Segue RULES.md
- [ ] Sem strings hardcoded
- [ ] Job tracking no ViewModel
- [ ] `.catch {}` em Flows
- [ ] Comentários em PT-BR quando necessário

**Testes:**
- [ ] Testes unitários para lógica complexa
- [ ] Testes passando localmente

**Performance:**
- [ ] `key` em LazyColumn items
- [ ] `collectAsStateWithLifecycle()`
- [ ] Imagens com Coil/placeholder

### 3.2 Como Dar Feedback

**Bom:**
```
A implementação está boa, mas sugiro:
1. Extrair a lógica de XP para um UseCase separado
2. Adicionar tratamento de erro no catch {}
3. Usar stringResource() para o texto do botão
```

**Ruim:**
```
Está errado, refaz.
```

---

## 4. MIGRAÇÃO PARA COMPOSE

### 4.1 Quando Migrar

| Critério | Ação |
|----------|------|
| Feature nova | 100% Compose |
| Bug simples | Mantiver XML |
| Refactor visual | Avaliar custo/benefício |
| Performance issue | Priorizar Compose |

### 4.2 Processo de Migração

```
1. Criar Screen.kt ao lado do Fragment existente
2. Copiar lógica do ViewModel (ou criar novo)
3. Implementar UI em Compose
4. Testar lado a lado
5. Substituir Fragment por Screen wrapper
6. Remover XML layout
```

### 4.3 Padrão de Wrapper

```kotlin
class LegacyFragment : Fragment() {
    private val viewModel: LegacyViewModel by viewModels()
    private var _binding: FragmentLegacyBinding? = null

    override fun onCreateView(...): View {
        _binding = FragmentLegacyBinding.inflate(...)
        binding.composeView.setContent {
            LegacyScreen(viewModel)
        }
        return binding.root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
```

---

## 5. DEBUGGING

### 5.1 Logs

```kotlin
// Usar AppLogger (não Log direto)
AppLogger.d("GamesViewModel", "Loading games")
AppLogger.e("GamesViewModel", "Failed to load", exception)

// Em release, logs são desabilitados automaticamente
```

### 5.2 Timber (se disponível)

```kotlin
// Alternativa: usar Timber
Timber.d("Loading games")
Timber.e(exception, "Failed to load")
```

### 5.3 Firebase Crashlytics

```kotlin
// Log non-fatal exceptions
try {
    riskyOperation()
} catch (e: Exception) {
    FirebaseCrashlytics.getInstance().recordException(e)
}
```

### 5.4 Debugger

1. Set breakpoint em linha de código
2. Attach debugger ao processo
3. Usar "Evaluate Expression" para inspecionar

---

## 6. TESTES

### 6.1 Escrever Teste Unitário

```kotlin
@Test
fun `loadGames success returns games`() = runTest {
    // Given
    val repository = mockk<GameRepository>()
    coEvery { repository.getUpcomingGames(any()) } returns flowOf(
        listOf(mockGame1, mockGame2)
    )
    val viewModel = GamesViewModel(repository)

    // When
    viewModel.loadGames()
    advanceUntilIdle()

    // Then
    assertThat(viewModel.uiState.value)
        .isInstanceOf(GamesUiState.Success::class.java)
}
```

### 6.2 Testar ViewModel

```kotlin
@Test
fun `error state when repository fails`() = runTest {
    // Given
    coEvery { repository.getData() } throws Exception("Network error")

    // When
    viewModel.loadData()

    // Then
    assertThat(viewModel.uiState.value)
        .isInstanceOf(UiState.Error::class.java)
}
```

---

## 7. VERSÃO E RELEASE

### 7.1 Incrementar Versão

```kotlin
// app/build.gradle.kts
defaultConfig {
    versionCode = 16        // ← SEMPRE incrementar
    versionName = "1.4.3"   // ← Semantic versioning
}
```

### 7.2 Gerar Release APK

```bash
# 1. Atualizar versão
# 2. ./gradlew assembleRelease
# 3. APK em app/build/outputs/apk/release/
```

### 7.3 Changelog

Manter em arquivo ou GitHub Releases:
```
## [1.4.3] - 2025-01-15
### Added
- Filtro de caixa por data
### Fixed
- Crash ao confirmar presença
### Changed
- Migrado CreateGame para Compose
```

---

## 8. TRABALHO REMOTO

### 8.1 Comandos Úteis

```bash
# Status do git
git status

# Branch atual
git branch --show-current

# Últimos commits
git log --oneline -10

# Stash temp changes
git stash push -m "WIP work"
git stash pop
```

### 8.2 Resolver Conflitos

```bash
# 1. Pull upstream
git fetch origin main
git rebase origin/main

# 2. Resolver conflitos marcados
# 3. git add <arquivos>
# 4. git rebase --continue
```

---

## 9. DÍVIDA TÉCNICA

### 9.1 Registrar Technical Debt

```kotlin
// TODO: Migrar para Compose
// FIXME: Tratar edge case quando X é null
// HACK: Workaround para bug do Firestore
```

### 9.2 Priorizar Pagamento

| Critério | Prioridade |
|----------|------------|
| Impacto em usuário final | Alta |
| Impacto em performance | Alta |
| Bloqueia nova feature | Média |
| Código duplicado | Média |
| Visual/inconsistência | Baixa |

---

## 10. RECURSOS DA EQUIPE

### 10.1 Canais de Comunicação

- **Crash/Bug:** Imediato
- **Dúvida técnica:** Até 24h
- **Revisão de código:** Até 48h

### 10.2 Documentação

- `.claude/PROJECT_MAP.md` - Visão geral
- `.claude/RULES.md` - Regras completas
- `.claude/RULES_SHORT.md` - Referência rápida
- `.claude/ARCHITECTURE.md` - Arquitetura
- `.claude/DEVELOPMENT_PLAYBOOK.md` - Este documento
