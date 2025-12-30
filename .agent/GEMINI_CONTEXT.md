# Gemini Context - Contexto Específico para Google Gemini

Este arquivo fornece contexto otimizado especificamente para o Gemini trabalhar de forma eficiente neste projeto.

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
```

## 🎯 Capacidades Específicas do Gemini

### Multimodal (Vantagem do Gemini)

O Gemini pode processar:
- ✅ **Screenshots de UI** - Mostrar prints para análise
- ✅ **Diagramas de arquitetura** - Imagens de fluxo
- ✅ **Wireframes** - Desenhos de UI
- ✅ **Logos e assets** - Análise de design

**Como usar:**
```
"Veja este screenshot da tela de jogos e sugira melhorias"
"Analise este diagrama de arquitetura e valide"
"Este wireframe está alinhado com Material Design?"
```

### Code Execution (Vantagem do Gemini)

O Gemini pode executar código Python para:
- ✅ **Análise de dados** - Estatísticas de código
- ✅ **Validação de padrões** - Verificar consistência
- ✅ **Geração de relatórios** - Métricas do projeto
- ✅ **Processamento de JSONs** - Análise de estruturas

**Como usar:**
```python
# Exemplo: Contar arquivos por feature
import os
from collections import defaultdict

features = defaultdict(int)
for root, dirs, files in os.walk("app/src/main/java/com/futebadosparcas/ui"):
    feature = os.path.basename(root)
    features[feature] += len([f for f in files if f.endswith('.kt')])

print("Arquivos por feature:", dict(features))
```

### Gemini 2.0 Pro Features

- ✅ **Contexto de 2M tokens** - Pode ler projeto inteiro de uma vez
- ✅ **Modo "Deep Research"** - Análise profunda de código
- ✅ **Melhor raciocínio** - Solução de problemas complexos
- ✅ **Code generation** - Geração de código completo

## 📊 Análise Rápida do Projeto

### Estatísticas de Código

```
Total de arquivos Kotlin: ~100
Total de arquivos XML: ~96
Linhas de código (estimado): ~15,000
Número de features: 14
Features completas: 8 (57%)
Features parciais: 3 (21%)
Features não iniciadas: 3 (21%)
```

### Distribuição de Código

```
UI Layer (ui/): 45%
Data Layer (data/): 35%
DI (di/): 5%
Utils (util/): 5%
Services (service/): 5%
Domain (domain/): 5%
```

### Complexidade por Feature

```yaml
alta_complexidade:
  - gamificação (30% completo, mais complexo)
  - pagamentos (10% completo, integração externa)

média_complexidade:
  - jogos (95% completo, bem estruturado)
  - estatísticas (85% completo)

baixa_complexidade:
  - autenticação (100% completo)
  - developer_tools (100% completo)
```

## 🔥 Firebase Integration Deep Dive

### Collections e Subcollections

```
firestore/
├── users/
│   └── [userId]
│       ├── id: string
│       ├── name: string
│       ├── email: string
│       ├── role: enum
│       └── ... (15 campos)
│
├── games/
│   └── [gameId]
│       ├── Documento principal (20 campos)
│       └── confirmations/ (subcollection)
│           └── [confirmationId]
│               ├── userId
│               ├── position
│               └── confirmedAt
│
├── locations/
│   └── [locationId]
│       ├── Documento principal (10 campos)
│       └── fields/ (subcollection)
│           └── [fieldId]
│               ├── name
│               ├── type
│               └── ... (8 campos)
│
├── statistics/
│   └── [userId] (agregadas)
│
├── player_stats/
│   └── [statId] (por jogo)
│
├── live_games/
│   └── [eventId] (eventos tempo real)
│
├── teams/
│   └── [teamId]
│
├── seasons/ (⏳ 30% usado)
│   └── [seasonId]
│
├── user_badges/ (⏳ 30% usado)
│   └── [badgeId]
│
└── user_streaks/ (⏳ 30% usado)
    └── [streakId]
```

### Índices Compostos Configurados

```javascript
// firestore.indexes.json
[
  {
    "collectionGroup": "games",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "dateTime", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "games",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "createdBy", "order": "ASCENDING" },
      { "fieldPath": "dateTime", "order": "DESCENDING" }
    ]
  }
]
```

### Regras de Segurança (Resumo)

```javascript
// Padrão geral
match /collection/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null &&
                  (hasRole('Admin') || isOwner(docId));
}

// Validação de campos
allow create: if validateRequiredFields() &&
                 validateEnums() &&
                 validateDataTypes();
```

## 🏗️ Arquitetura Detalhada

### Fluxo de Dados Completo

```
User Action (UI)
    ↓
Fragment captura evento
    ↓
Chama método do ViewModel
    ↓
ViewModel.someAction()
    ↓
viewModelScope.launch {
    _uiState.value = Loading
    ↓
    Repository.getData()
        ↓
        Firestore.collection().get().await()
            ↓
            Retorna Result<Data>
    ↓
    _uiState.value = Success(data) ou Error(message)
}
    ↓
Fragment observa uiState via collect
    ↓
when (state) {
    Loading -> showLoading()
    Success -> showData()
    Error -> showError()
}
```

### Dependency Graph (Hilt)

```
Application
    ↓
@HiltAndroidApp
    ↓
AppModule fornece:
    - Repositories (Singleton)
    - UseCases (Factory)
    ↓
FirebaseModule fornece:
    - FirebaseAuth (Singleton)
    - FirebaseFirestore (Singleton)
    - FirebaseStorage (Singleton)
    - FirebaseFunctions (Singleton)
    ↓
DatabaseModule fornece:
    - AppDatabase (Singleton)
    - DAOs (Singleton)
    ↓
@HiltViewModel recebe:
    - Repositories via @Inject
    ↓
@AndroidEntryPoint recebe:
    - ViewModels via by viewModels()
```

## 🎯 Tarefas Prioritárias com Código

### PRIORIDADE 1: Completar Gamificação

**Status**: 30% → Objetivo: 100%

**Arquivo 1**: `ui/league/LeagueViewModel.kt` ❌ NÃO EXISTE

```kotlin
package com.futebadosparcas.ui.league

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Season
import com.futebadosparcas.data.model.SeasonParticipation
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GamificationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LeagueViewModel @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    sealed class LeagueUiState {
        object Loading : LeagueUiState()
        data class Success(
            val season: Season,
            val ranking: List<SeasonParticipation>,
            val userPosition: Int?,
            val userParticipation: SeasonParticipation?
        ) : LeagueUiState()
        data class Error(val message: String) : LeagueUiState()
    }

    private val _uiState = MutableStateFlow<LeagueUiState>(LeagueUiState.Loading)
    val uiState: StateFlow<LeagueUiState> = _uiState.asStateFlow()

    init {
        loadLeague()
    }

    private fun loadLeague() {
        viewModelScope.launch {
            _uiState.value = LeagueUiState.Loading

            try {
                gamificationRepository.getActiveSeason().collect { season ->
                    if (season == null) {
                        _uiState.value = LeagueUiState.Error("Nenhuma temporada ativa")
                        return@collect
                    }

                    gamificationRepository.getSeasonRanking(season.id).collect { ranking ->
                        val userId = authRepository.getCurrentUser()?.id
                        val userPosition = ranking.indexOfFirst { it.userId == userId }
                            .let { if (it >= 0) it + 1 else null }
                        val userParticipation = ranking.find { it.userId == userId }

                        _uiState.value = LeagueUiState.Success(
                            season = season,
                            ranking = ranking,
                            userPosition = userPosition,
                            userParticipation = userParticipation
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.value = LeagueUiState.Error(e.message ?: "Erro ao carregar liga")
            }
        }
    }

    fun refresh() {
        loadLeague()
    }
}
```

**Arquivo 2**: Atualizar `ui/league/LeagueFragment.kt`

```kotlin
// Adicionar ao LeagueFragment.kt existente:

override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    super.onViewCreated(view, savedInstanceState)
    setupObservers()
    setupListeners()
}

private fun setupObservers() {
    viewLifecycleOwner.lifecycleScope.launch {
        viewModel.uiState.collect { state ->
            when (state) {
                is LeagueViewModel.LeagueUiState.Loading -> {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.recyclerView.visibility = View.GONE
                    binding.errorView.visibility = View.GONE
                }
                is LeagueViewModel.LeagueUiState.Success -> {
                    binding.progressBar.visibility = View.GONE
                    binding.recyclerView.visibility = View.VISIBLE
                    binding.errorView.visibility = View.GONE

                    // Atualizar UI
                    binding.seasonName.text = state.season.name
                    binding.divisionName.text = state.season.division.toString()
                    state.userPosition?.let {
                        binding.userPosition.text = "Sua posição: $it°"
                    }

                    // Atualizar RecyclerView
                    rankingAdapter.submitList(state.ranking)
                }
                is LeagueViewModel.LeagueUiState.Error -> {
                    binding.progressBar.visibility = View.GONE
                    binding.recyclerView.visibility = View.GONE
                    binding.errorView.visibility = View.VISIBLE
                    binding.errorMessage.text = state.message
                }
            }
        }
    }
}

private fun setupListeners() {
    binding.swipeRefresh.setOnRefreshListener {
        viewModel.refresh()
        binding.swipeRefresh.isRefreshing = false
    }
}
```

### PRIORIDADE 2: Auto-Award de Badges

**Localização**: Adicionar em `data/repository/GameRepositoryImpl.kt`

```kotlin
// Após finalizar um jogo, verificar badges:

suspend fun finalizeGame(gameId: String): Result<Unit> {
    return try {
        // 1. Marcar jogo como FINISHED
        firestore.collection("games").document(gameId)
            .update("status", GameStatus.FINISHED.name)
            .await()

        // 2. Buscar estatísticas do jogo
        val playerStats = getPlayerStatsForGame(gameId)

        // 3. Verificar e premiar badges
        playerStats.forEach { stat ->
            checkAndAwardBadges(stat)
        }

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

private suspend fun checkAndAwardBadges(stat: PlayerStats) {
    // Hat-trick (3+ gols)
    if (stat.goals >= 3) {
        gamificationRepository.awardBadge(stat.userId, BadgeType.HAT_TRICK)
    }

    // Paredão (goleiro sem levar gols)
    if (stat.position == Position.GOALKEEPER && stat.goalsConceded == 0) {
        gamificationRepository.awardBadge(stat.userId, BadgeType.PAREDAO)
    }

    // Atualizar streak
    gamificationRepository.updateStreak(stat.userId, stat.gameDate)
}
```

## 🛠️ Ferramentas Úteis do Gemini

### 1. Análise de Complexidade

Use o Gemini para analisar complexidade ciclomática:

```
"Analise a complexidade do GameRepositoryImpl.kt e sugira refatorações"
```

### 2. Geração de Testes

Use para gerar testes unitários:

```
"Gere testes unitários para LeagueViewModel usando JUnit e Mockito"
```

### 3. Revisão de Código

Use modo "Deep Think" para revisão profunda:

```
"Revise este código buscando: bugs, problemas de performance, violações de SOLID"
```

### 4. Documentação Automática

```
"Gere KDoc para todas as funções públicas de GamificationRepository"
```

## 📚 Referência Cruzada

**Para encontrar informações:**

| Pergunta | Arquivo |
|----------|---------|
| Como criar um ViewModel? | `GEMINI.md` seção Padrões |
| Onde está X feature? | `.agent/QUICK_REFERENCE.md` |
| O que falta fazer? | `.agent/PROJECT_STATE.md` |
| Regras de código? | `.agentrules` |
| Schema do Firebase? | Este arquivo (acima) |
| Setup do projeto? | `README.md` |

## 🎯 Modo de Uso Recomendado

### Para tarefas de desenvolvimento:

1. **Leia**: `GEMINI.md` (instruções gerais)
2. **Localize**: `.agent/QUICK_REFERENCE.md` (onde está o código)
3. **Contextualize**: Este arquivo (detalhes específicos)
4. **Execute**: Siga `.agentrules` (regras obrigatórias)

### Para debugging:

1. Use capacidades multimodal (screenshots de erros)
2. Execute código Python para análise
3. Consulte Firebase schema neste arquivo
4. Verifique padrões em `.agentrules`

### Para planejamento:

1. Leia `.agent/PROJECT_STATE.md` (status atual)
2. Consulte roadmap e prioridades
3. Valide arquitetura neste arquivo
4. Proponha próximos passos

## 🚀 Performance Tips

Para maximizar eficiência do Gemini:

1. **Use .geminiignore** - Economiza ~70% de tokens
2. **Referencie arquivos específicos** - "Leia apenas GameRepositoryImpl.kt"
3. **Use contexto deste arquivo** - Não precisa buscar schema do Firebase
4. **Aproveite multimodal** - Mostrar em vez de descrever
5. **Code execution** - Validar antes de aplicar

## 🎓 Peculiaridades do Projeto

### 1. Firebase como Backend Único

⚠️ **IMPORTANTE**: Existe um backend Node.js no projeto, mas **NÃO está em uso**.
- Apenas Firebase é usado atualmente
- Backend Node.js está 5% implementado
- Focar apenas em Firebase para desenvolvimento

### 2. Mock Data para Desenvolvimento

- `DeveloperFragment.kt` tem tools completas
- Pode gerar usuários, jogos, locais mock
- Use para testar sem depender do Firebase

### 3. Gamificação Parcialmente Implementada

- Repository 100% completo
- Models 100% completos
- ViewModels e UI 0% completos
- **Esta é a prioridade atual**

### 4. Design Inspirado no Duolingo

- Verde vibrante (#58CC02)
- Gamificação pesada
- Animações de sucesso
- Badges e streaks

---

**Última atualização**: 27/12/2024
**Gemini Version**: 2.0 Pro (Antigravity)
**Context Window**: 2M tokens
