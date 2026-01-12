# MIGRATION MODERN UI - Futeba dos Parças

> Plano de migração para Compose (Android) e preparação iOS.
> Última atualização: 2025-01-10

---

## 1. ESTADO ATUAL

| Plataforma | UI Framework | Status | % Migrado |
|------------|--------------|--------|-----------|
| **Android** | XML + Compose | Híbrido | ~45% Compose |
| **iOS** | N/A | Preparação KMP | 0% |

### 1.1 Inventário Android

| Categoria | XML | Compose | Total |
|-----------|-----|---------|-------|
| Fragments | 38 | - | 38 |
| Screens | - | 33 | 33 |
| Layouts XML | ~40 | - | ~40 |

### 1.2 Coexistência

**Padrão atual:**
```kotlin
// Fragment wrapper hospeda Screen Compose
class ExampleFragment : Fragment() {
    override fun onCreateView(...): View {
        binding.composeView.setContent {
            ExampleScreen(viewModel)
        }
        return binding.root
    }
}
```

---

## 2. ESTRATÉGIA DE MIGRAÇÃO

### 2.1 Princípios

1. **Sem reescrita total** - migração incremental
2. **Funcionalidade primeiro** - não bloquear novas features
3. **Coexistência aceitável** - XML e Compose lado a lado
4. **Delete após confirmação** - remover XML apenas após validar

### 2.2 Abordagem

```
┌─────────────────────────────────────────────────────────┐
│  FASE 1: Novas Features (100% Compose)                 │
│  ─────────────────────────────────────────────────────  │
│  Criar novas telas apenas em Compose                   │
├─────────────────────────────────────────────────────────┤
│  FASE 2: Migração por Feature                          │
│  ─────────────────────────────────────────────────────  │
│  Escolher feature, migrar completamente, testar        │
├─────────────────────────────────────────────────────────┤
│  FASE 3: Refactor Visual                               │
│  ─────────────────────────────────────────────────────  │
│  Ajustar UI consistente após migração                  │
├─────────────────────────────────────────────────────────┤
│  FASE 4: Remoção Legado                                │
│  ─────────────────────────────────────────────────────  │
│  Remover XML layouts, ViewBinding desnecessário        │
└─────────────────────────────────────────────────────────┘
```

---

## 3. GUIA DE MIGRAÇÃO

### 3.1 Passo a Passo

#### Passo 1: Criar Screen ao lado do Fragment

```
app/src/main/java/com/futebadosparcas/ui/feature/
├── FeatureFragment.kt     (XML, existe)
└── FeatureScreen.kt       (NOVO, Compose)
```

#### Passo 2: Migrar ViewModel

```kotlin
// ViewModel geralmente não precisa mudar
// Apenas adicionar StateFlow se ainda não tiver
```

#### Passo 3: Implementar Screen Compose

```kotlin
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel = hiltViewModel(),
    onNavigate: (String) -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    FeatureContent(
        state = state,
        onAction = { viewModel.handleAction(it) },
        onNavigate = onNavigate
    )
}
```

#### Passo 4: Atualizar Fragment Wrapper

```kotlin
class FeatureFragment : Fragment() {
    private val viewModel: FeatureViewModel by viewModels()
    private var _binding: FragmentFeatureBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(...): View {
        _binding = FragmentFeatureBinding.inflate(...)
        return binding.root
    }

    override fun onViewCreated(...) {
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

#### Passo 5: Testar

- [ ] Funcionalidade idêntica
- [ ] Estados de loading/error/empty
- [ ] Navegação funcionando
- [ ] Orientação landscape/portrait

#### Passo 6: Remover XML (opcional, após validação)

```
// Remover:
- fragment_feature.xml
- ViewBinding desnecessário
```

---

## 4. PRIORIDADE DE MIGRAÇÃO

### 4.1 Critérios

| Prioridade | Critério | Exemplo |
|------------|----------|---------|
| **Alta** | Feature muito usada, bugs visuais | Games, Profile |
| **Média** | Feature moderadamente usada | Statistics, Badges |
| **Baixa** | Feature pouco usada, estável | Settings, About |

### 4.2 Roadmap Sugerido

| Fase | Feature | Complexidade | Ganho |
|------|---------|--------------|-------|
| 1 | Games | Alta | Alto |
| 1 | Game Detail | Alta | Alto |
| 2 | Profile | Média | Alto |
| 2 | Groups | Média | Médio |
| 3 | Statistics | Média | Médio |
| 3 | League | Baixa | Médio |
| 4 | Settings | Baixa | Baixo |

---

## 5. PADRÕES COMPOSE

### 5.1 Screen Pattern

```kotlin
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel = hiltViewModel(),
    onNavigate: (String) -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    Scaffold(
        topBar = { FeatureTopBar() },
        floatingActionButton = { FeatureFab() }
    ) { padding ->
        FeatureContent(
            state = state,
            onAction = { viewModel.handleAction(it) },
            modifier = Modifier.padding(padding)
        )
    }
}

@Composable
private fun FeatureContent(
    state: FeatureUiState,
    onAction: (FeatureAction) -> Unit,
    modifier: Modifier = Modifier
) {
    when (state) {
        is FeatureUiState.Loading -> LoadingState()
        is FeatureUiState.Success -> SuccessState(state.data, onAction)
        is FeatureUiState.Error -> ErrorState(state.message, onAction)
    }
}
```

### 5.2 Lista com Items

```kotlin
@Composable
private fun SuccessState(
    items: List<Item>,
    onAction: (FeatureAction) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(
            items = items,
            key = { it.id }  // OBRIGATÓRIO
        ) { item ->
            FeatureItem(
                item = item,
                onClick = { onAction(FeatureAction.Select(item)) }
            )
        }
    }
}
```

### 5.3 Dialogs

```kotlin
@Composable
fun FeatureDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.dialog_title)) },
        text = { Text(stringResource(R.string.dialog_message)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
```

---

## 6. COEXISTÊNCIA COM NAVEGAÇÃO

### 6.1 Continuar Usando nav_graph.xml

```xml
<fragment
    android:id="@+id/featureFragment"
    android:name="com.futebadosparcas.ui.feature.FeatureFragment"
    android:label="@string/feature_title">
    <!-- Arguments, actions, etc. -->
</fragment>
```

### 6.2 Navegação Compose (Futuro)

**ASSUMPTION:** Migrar para Compose Navigation quando:
- 80%+ das telas forem Compose
- Navigation Component offer APIs estáveis
- Validação completa

```kotlin
// Futuro - ainda não usar
NavHost(navController, startDestination = "home") {
    composable("home") { HomeScreen() }
    composable("games") { GamesScreen() }
}
```

---

## 7. IOS PREPARAÇÃO

### 7.1 KMP Domain Layer

**Já compartilhado:**
- Models
- Use Cases
- Services (XPCalculator, TeamBalancer)

**Próximos passos:**
```
shared/src/commonMain/kotlin/com/futebadosparcas/
├── domain/           ✅ 90% pronto
│   ├── model/        ✅
│   ├── usecase/      ⚠️  completar
│   └── service/      ✅
└── data/             ⏳ 40% (iOS implementation)
```

### 7.2 iOS UI (Futuro)

**Opções:**
1. **SwiftUI** + KMP shared framework
2. **UIKit** + KMP shared framework
3. **KMP Compose** (quando maduro)

**Decisão:** Aguardar KMP Compose ou SwiftUI (a avaliar em 2025)

---

## 8. RISCOS E MITIGAÇÃO

### 8.1 Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Diferença visual | Média | Baixo | Screenshot comparado |
| Bug em migração | Média | Médio | Testes manuais |
| Performance | Baixa | Alto | Medir com Profiler |
| Aprendizado | Alta | Médio | Documentação |

### 8.2 Rollback

**Se Compose introduzir bug crítico:**
1. Reverter PR
2. Continuar usando versão XML
3. Corrigir e tentar novamente

---

## 9. MÉTRICAS DE SUCESSO

### 9.1 Técnicas

- [ ] % de telas em Compose
- [ ] Tamanho do APK
- [ ] Tempo de renderização
- [ ] Taxa de jank

### 9.2 Qualidade

- [ ] Consistência visual
- [ ] Acessibilidade mantida
- [ ] Funcionalidade idêntica
- [ ] Performance igual ou melhor

---

## 10. RECURSOS

### 10.1 Aprendizado

- [Compose Pathway](https://developer.android.com/courses/jetpack-compose/course)
- [Compose Samples](https://github.com/android/compose-samples)
- [Now in Android](https://github.com/android/nowinandroid)

### 10.2 Ferramentas

- **Compose Preview** no Android Studio
- **Layout Inspector** para debug
- **Compose Compiler Metrics** para otimização

---

## 11. TIMELINE

| Trimestre | Foco | Entrega |
|-----------|------|---------|
| **Q1 2025** | Games + GameDetail | PRs completos |
| **Q2 2025** | Profile + Groups | PRs completos |
| **Q3 2025** | Statistics + League | PRs completos |
| **Q4 2025** | Remoção XML massiva | Limpeza |
| **2026** | Avaliar iOS UI | Decisão |

---

## 12. DECISÕES PENDENTES

| Decisão | Quando | Quem |
|---------|--------|------|
| Migrar para Compose Navigation | 80% Compose | Tech Lead |
| Iniciar projeto iOS | Domain 100% KMP | Produto + Tech |
| Adotar KMP Compose | Quando estável | Tech Lead |
