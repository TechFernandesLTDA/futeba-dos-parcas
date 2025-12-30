# CLAUDE.md

Instruções para Claude Sonnet 4.5 ao trabalhar neste repositório.

## 🤖 Claude Sonnet 4.5 - Desenvolvimento Diário

**Claude Sonnet 4.5 é o modelo balanceado** - Use para desenvolvimento diário e implementação de features.

```yaml
sonnet-4.5:
  uso: "Desenvolvimento diário, implementação de features, debugging"
  contexto: "200K tokens"
  velocidade: "Rápida"
  custo: "Médio (20% do Opus)"
  qualidade: "Muito alta"

  quando_usar:
    ✅ "Implementação de ViewModels, Repositories, Fragments"
    ✅ "Debugging de bugs conhecidos"
    ✅ "Refatorações locais (<300 linhas)"
    ✅ "Code reviews de PRs médios (<500 linhas)"
    ✅ "Correções de bugs"
    ✅ "Ajustes de UI e layouts"
    ✅ "Testes unitários"

  quando_NÃO_usar:
    ❌ "Decisões arquiteturais críticas (use Opus 4.5)"
    ❌ "Design de sistemas complexos (use Opus 4.5)"
    ❌ "Análise visual (use Gemini 3 Pro)"
    ❌ "Tarefas triviais (use Gemini Flash)"
```

**Regra de ouro**: Sonnet é o modelo do dia a dia. Para decisões críticas, escale para Opus.

---

## ⚡ TL;DR - Contexto em 30 segundos

```yaml
projeto: "Futeba dos Parças - App Android de peladas"
progresso: "75-80% completo"
linguagem: "Kotlin 2.0.21"
arquitetura: "MVVM + Clean + Hilt"
backend: "Firebase (Firestore/Auth/FCM)"
min_sdk: 24
target_sdk: 35
build_status: "✅ SUCCESS"

prioridade_atual: "Completar gamificação (30% → 100%)"
próxima_tarefa: "Criar LeagueViewModel.kt"

time_de_modelos:
  você: "Sonnet 4.5 - Desenvolvimento diário"
  arquiteto: "Opus 4.5 - Decisões críticas"
  visual: "Gemini 3 Pro - Análise multimodal"
  rápido: "Gemini 3 Flash - Tarefas triviais"
```

---

## 🔥 ACESSO AO FIREBASE

**IMPORTANTE**: Você tem acesso COMPLETO ao Firebase do projeto via Service Account.

### ✅ Capacidades Disponíveis

**Firestore Database:**
- ✅ Leitura completa de todas as collections
- ✅ Escrita e atualização de documentos
- ✅ Deleção de dados
- ✅ Queries complexas
- ✅ Análise de estrutura

**Firebase Authentication:**
- ✅ Listagem de usuários
- ✅ Criação de usuários
- ✅ Gerenciamento de contas
- ✅ Reset de senhas

**Firebase Storage:**
- ✅ Listagem de arquivos
- ✅ Upload de imagens/arquivos
- ✅ Deleção de arquivos
- ✅ Gerenciamento de pastas

**Firebase Functions:**
- ✅ Deploy de functions
- ✅ Execução de functions
- ✅ Logs e debugging

### 📋 Credenciais

```yaml
service_account: "futebadosparcas-firebase-adminsdk-fbsvc-b5fb25775d.json"
projeto_id: "futebadosparcas"
permissões: "FULL ADMIN ACCESS"
storage: "futebadosparcas.firebasestorage.app"
```

### 🛠️ Scripts Disponíveis

```bash
# Resetar Firestore (CUIDADO!)
node scripts/reset_firestore.js

# Analisar estrutura Firestore
# Via app: Developer Menu → Analisar Estrutura Firestore

# Popular dados mock
# Via app: Developer Menu → Criar Dados Mock
```

### ⚠️ Quando Usar Acesso Direto

**Use para:**
- ✅ Analisar estrutura de dados existente
- ✅ Verificar dados antes de implementar features
- ✅ Debugar problemas de dados
- ✅ Validar queries complexas
- ✅ Criar/popular dados de teste

**SEMPRE confirme antes de:**
- ⚠️ DELETAR dados em produção
- ⚠️ Modificar dados de usuários reais
- ⚠️ Alterar estrutura de collections
- ⚠️ Fazer operações em massa

**Preferir App Android para:**
- 🎮 Criar dados mock (Developer Menu)
- 🎮 Resetar base de dados (Developer Menu)
- 🎮 Testar fluxos completos

---

## 🏗️ Arquitetura Android

```
UI (Fragment/Activity) → ViewModel → Repository → Firebase
```

**Stack Principal:**
- Kotlin 2.0.21 | Min SDK 24 / Target SDK 35
- MVVM + Clean Architecture + Hilt (DI)
- Navigation Component + SafeArgs
- Coroutines + Flow + StateFlow
- ViewBinding + Jetpack Compose (híbrido)
- Firebase BoM 33.7.0 | Room 2.6.1

**Estrutura de Pacotes:**
```
com.futebadosparcas/
├── data/
│   ├── model/        # User, Game, Location, Statistics, Gamification
│   ├── repository/   # *Repository.kt (interfaces + impl)
│   └── local/        # Room Database
├── domain/usecase/   # Use Cases
├── di/               # Hilt modules
├── ui/               # Features: auth, games, livegame, statistics, profile
├── service/          # FcmService
└── util/             # PreferencesManager, ThemeHelper
```

---

## 🌐 Idioma Obrigatório

⚠️ **CRÍTICO - Sempre seguir:**
- **Comentários**: Português (PT-BR)
- **Strings de UI**: Português (PT-BR)
- **Código**: English (variáveis, classes, métodos)

```kotlin
// ✅ CORRETO
// Carrega os jogos do Firestore
fun loadGames(): Flow<List<Game>>

// ❌ ERRADO
// Load games from Firestore
fun carregarJogos(): Flow<List<Game>>
```

---

## 🎯 Regras Críticas de Desenvolvimento

### 1. Estratégia de Edição de Arquivos

⚠️ **MUITO IMPORTANTE:**
- ✅ **Use Write (rewrite completo)** para arquivos XML e classes Kotlin grandes (>200 linhas)
- ✅ **Use Edit** para mudanças pequenas em arquivos <200 linhas
- ❌ **Evite Edit** em arquivos com indentação complexa (XML layouts)
- Se Edit falhar 2x, **pare e use Write**

**Razão**: Edit tool falha frequentemente em arquivos com estrutura complexa.

### 2. Null Safety (Kotlin)

```kotlin
// ✅ BOM
val name = user?.name ?: "Desconhecido"
user?.let { println(it.name) }
val result = repository.getData().getOrNull()

// ❌ RUIM
val name = user!!.name  // NUNCA use !! (exceto em binding)
```

### 3. Injeção de Dependência (Hilt)

**SEMPRE use Hilt - Template obrigatório:**

```kotlin
// ViewModel
@HiltViewModel
class MyViewModel @Inject constructor(
    private val repository: MyRepository
) : ViewModel()

// Fragment
@AndroidEntryPoint
class MyFragment : Fragment()

// Repository no Module (di/AppModule.kt)
@Provides
@Singleton
fun provideMyRepository(
    firestore: FirebaseFirestore
): MyRepository = MyRepositoryImpl(firestore)
```

### 4. Padrão ViewModel + StateFlow

**SEMPRE use este padrão (sealed classes + StateFlow):**

```kotlin
sealed class MyUiState {
    object Loading : MyUiState()
    data class Success(val data: List<Item>) : MyUiState()
    data class Error(val message: String) : MyUiState()
}

@HiltViewModel
class MyViewModel @Inject constructor(
    private val repository: MyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<MyUiState>(MyUiState.Loading)
    val uiState: StateFlow<MyUiState> = _uiState.asStateFlow()

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = MyUiState.Loading
            repository.getData()
                .onSuccess { _uiState.value = MyUiState.Success(it) }
                .onFailure { _uiState.value = MyUiState.Error(it.message ?: "Erro") }
        }
    }
}
```

### 5. Repository Pattern

```kotlin
interface MyRepository {
    suspend fun getData(): Result<List<Item>>
    fun getDataFlow(): Flow<List<Item>>
}

class MyRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : MyRepository {

    override suspend fun getData(): Result<List<Item>> {
        return try {
            val snapshot = firestore.collection("items").get().await()
            val items = snapshot.toObjects(Item::class.java)
            Result.success(items)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getDataFlow(): Flow<List<Item>> = callbackFlow {
        val listener = firestore.collection("items")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                snapshot?.let {
                    val items = it.toObjects(Item::class.java)
                    trySend(items)
                }
            }
        awaitClose { listener.remove() }
    }
}
```

### 6. Fragment Setup (Template Completo)

```kotlin
@AndroidEntryPoint
class MyFragment : Fragment() {

    private var _binding: FragmentMyBinding? = null
    private val binding get() = _binding!!

    private val viewModel: MyViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentMyBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupObservers()
        setupListeners()
    }

    private fun setupObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is MyUiState.Loading -> showLoading()
                    is MyUiState.Success -> showData(state.data)
                    is MyUiState.Error -> showError(state.message)
                }
            }
        }
    }

    private fun setupListeners() {
        binding.button.setOnClickListener {
            viewModel.loadData()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null  // SEMPRE limpar binding
    }
}
```

---

## 🔥 Firebase Collections

### Schema Rápido (Principais)

**users:**
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "role": "Player|FieldOwner|Admin",
  "preferredPositions": ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"],
  "isMock": false
}
```

**games:**
```json
{
  "id": "string",
  "locationId": "string",
  "dateTime": "Timestamp",
  "status": "SCHEDULED|CONFIRMED|LIVE|FINISHED|CANCELLED",
  "maxPlayers": 14,
  "maxGoalkeepers": 2,
  "confirmationCount": 0,
  "goalkeeperCount": 0
}
```

**games/{gameId}/confirmations:**
```json
{
  "userId": "string",
  "userName": "string",
  "position": "GOALKEEPER|LINE_PLAYER",
  "confirmedAt": "Timestamp"
}
```

**Ver schema completo**: `.agent/QUICK_REFERENCE.md`

---

## 📍 Localização Rápida de Arquivos

### Por Feature (Status + Arquivos)

```yaml
autenticação: 100% ✅
  - data/repository/AuthRepository.kt
  - ui/auth/LoginActivity.kt + LoginViewModel.kt
  - ui/auth/RegisterActivity.kt + RegisterViewModel.kt

jogos: 95% ✅
  - data/model/Game.kt
  - data/repository/GameRepositoryImpl.kt (⭐ 470 linhas)
  - ui/games/GamesFragment.kt + GamesViewModel.kt
  - ui/games/GameDetailFragment.kt + GameDetailViewModel.kt
  - ui/games/CreateGameFragment.kt + CreateGameViewModel.kt

gamificação: 30% 🔶 PRIORIDADE
  - data/model/Gamification.kt ✅
  - data/repository/GamificationRepository.kt ✅ (340 linhas)
  - ui/league/LeagueFragment.kt ⚠️ FALTA ViewModel
  - PRÓXIMA TAREFA: Criar LeagueViewModel.kt

estatísticas: 85% ✅
  - data/repository/StatisticsRepository.kt
  - ui/statistics/StatisticsFragment.kt (Compose)

jogo_ao_vivo: 80% ✅
  - data/repository/LiveGameRepository.kt
  - ui/livegame/LiveGameFragment.kt

locais: 90% ✅
  - data/repository/LocationRepository.kt
  - ui/locations/FieldOwnerDashboardFragment.kt

perfil: 90% ✅
  - ui/profile/ProfileFragment.kt

developer_tools: 100% ✅
  - ui/developer/DeveloperFragment.kt
```

**Mapa completo**: `.agent/QUICK_REFERENCE.md`

---

## 🎯 Próxima Tarefa (PRIORIDADE)

### Criar LeagueViewModel.kt

**Status**: ❌ Não existe
**Localização**: `app/src/main/java/com/futebadosparcas/ui/league/LeagueViewModel.kt`
**Dependências**:
- ✅ GamificationRepository (completo - 340 linhas)
- ✅ AuthRepository (completo)
- ✅ Layout fragment_league.xml (completo)

**Responsável**: Sonnet 4.5 (você!)

**Ver código completo**: `.agent/GEMINI_CONTEXT.md` (linhas 350-420)

**Próximos passos**:
1. Criar LeagueViewModel.kt (você)
2. Completar LeagueFragment.kt (você)
3. Criar BadgesViewModel.kt (você)
4. Implementar auto-award de badges (você + Opus para arquitetura)

---

## 🚀 Comandos Úteis

```bash
# Build
./gradlew build

# Instalar no device
./gradlew installDebug

# Testes
./gradlew test

# Clean
./gradlew clean

# Lint
./gradlew lint
```

---

## 🎨 Design System

**Cores:**
- Primary: `#58CC02` (verde Duolingo)
- Accent: `#FF9600` (laranja)
- Error: `#D32F2F`
- Success: `#58CC02`

**Estilo:**
- Material Design 3
- Gamificação estilo Duolingo
- Animações de sucesso
- Badges e conquistas vibrantes

---

## ⚠️ Avisos Importantes

1. **Firebase é o backend principal** - Backend Node.js existe mas NÃO está em uso
2. **Gamificação 30% pronta** - Repository completo, faltam ViewModels (PRIORIDADE)
3. **Use Hilt SEMPRE** - Nunca injeção manual
4. **StateFlow, não LiveData** - Padrão do projeto
5. **Evite over-engineering** - Implemente apenas o necessário
6. **Use Write para XML** - Edit falha em layouts complexos
7. **Escale para Opus** - Decisões arquiteturais críticas → Opus 4.5

---

## 🔍 Quick Find (Localização Rápida)

```
Preciso modificar X → .agent/QUICK_REFERENCE.md
Como fazer Y? → Este arquivo (padrões acima)
O que falta em Z? → .agent/PROJECT_STATE.md
Schema do Firestore? → .agent/QUICK_REFERENCE.md (completo)
Qual modelo usar? → .agent/MODEL_SELECTION.md
Regras obrigatórias? → .agentrules
```

**Arquivos por tipo:**
- Models: `data/model/*.kt`
- Repositories: `data/repository/*Repository*.kt`
- ViewModels: `ui/[feature]/*ViewModel.kt`
- Fragments: `ui/[feature]/*Fragment.kt`
- Layouts: `res/layout/[fragment|activity|item]_*.xml`
- Hilt Modules: `di/*.kt`

---

## 📚 Documentação de Referência

```yaml
você_está_aqui: "CLAUDE.md (Sonnet 4.5)"
regras_universais: ".agentrules"
navegação_completa: ".agent/QUICK_REFERENCE.md"
status_detalhado: ".agent/PROJECT_STATE.md"
seleção_modelos: ".agent/MODEL_SELECTION.md"

arquitetura_crítica: "OPUS.md (Opus 4.5)"
análise_visual: "GEMINI.md (Gemini 3 Pro)"
firebase: ".agent/FIREBASE_MODERNIZATION.md"
features_pendentes: "IMPLEMENTACAO.md"
setup: "README.md"
```

---

## 🎯 Workflow Recomendado (Sonnet)

### Para implementar uma feature:

1. **Leia contexto**:
   - CLAUDE.md (este arquivo)
   - .agent/QUICK_REFERENCE.md (localizar arquivos)
   - .agent/PROJECT_STATE.md (ver o que falta)

2. **Encontre código similar**:
   - Leia um ViewModel existente
   - Siga o mesmo padrão

3. **Implemente seguindo padrões**:
   - Use templates deste arquivo
   - Siga idioma (PT-BR comentários, EN código)
   - Use Hilt, StateFlow, sealed classes

4. **Teste localmente**:
   - Build deve passar
   - Teste manualmente

5. **Se encontrar decisão complexa**:
   - Pare e escale para Opus 4.5
   - Exemplo: "Qual arquitetura usar para pagamentos?"

---

## 🛠️ Quando Escalar para Outros Modelos

### Escale para Opus 4.5:

```
✅ "Preciso decidir qual gateway de pagamento usar"
✅ "Como arquitetar o sistema de badges auto-award?"
✅ "Devo migrar para backend Node.js?"
✅ "Refatorar GameRepositoryImpl (470 linhas) aplicando SOLID"
✅ "Security audit de firestore.rules"
```

### Escale para Gemini 3 Pro:

```
✅ "Analise este screenshot e sugira melhorias de UI"
✅ "Execute código Python para contar arquivos por feature"
✅ "Valide este diagrama de arquitetura"
```

### Use Gemini 3 Flash:

```
✅ "Corrija typo em linha 45"
✅ "Onde está definido GameStatus?"
✅ "Mude cor do botão para #58CC02"
```

---

## 📊 Status das Features (Para Contexto)

| Feature | Status | Você Pode Fazer | Escalar para Opus |
|---------|--------|-----------------|-------------------|
| Autenticação | ✅ 100% | Manutenção | - |
| Jogos | ✅ 95% | Melhorias | - |
| Locais | ✅ 90% | Melhorias | - |
| Estatísticas | ✅ 85% | Melhorias, gráficos | - |
| Jogo ao Vivo | ✅ 80% | Refinamento | - |
| Gamificação | 🔶 30% | **LeagueViewModel (AGORA)** | Auto-award arquitetura |
| Pagamentos | 🔶 10% | - | **Design arquitetural** |
| Exp. Jogo | 🔶 15% | Implementação básica | Design features |

---

## 🎓 Boas Práticas (Sonnet)

1. **Leia código existente antes de criar novo** - Siga padrões
2. **Use templates deste arquivo** - StateFlow, Repository, Fragment
3. **Documente em PT-BR** - Comentários e strings
4. **Teste localmente** - `./gradlew build` antes de commitar
5. **Escale quando necessário** - Opus para decisões, Gemini para visual
6. **Evite over-engineering** - Simples é melhor
7. **Use Write para XML** - Mais confiável que Edit

---

## 🚦 Sinais de Quando Escalar

### 🟢 Continue com Sonnet (você):

- Implementar ViewModel seguindo padrão
- Corrigir bugs conhecidos
- Ajustar UI/layouts
- Criar testes unitários
- Refatorar classes pequenas (<200 linhas)

### 🟡 Considere Escalar:

- Arquivo muito grande (>500 linhas)
- Decisão entre 2+ abordagens
- Mudança afeta múltiplas features
- Precisa análise visual

### 🔴 PARE e Escale para Opus:

- Decisão arquitetural crítica
- Design de sistema novo (pagamentos)
- Security audit
- Refatoração arquitetural completa
- Trade-offs complexos

---

**Última atualização**: 27/12/2024
**Claude Version**: Sonnet 4.5
**Context Window**: 200K tokens
**Uso recomendado**: Desenvolvimento diário e implementação de features
**Custo**: Médio (20% do Opus) - Use com confiança
