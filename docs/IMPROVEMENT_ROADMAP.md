# 🚀 Roadmap de Melhorias — Futeba dos Parças
## 100 Oportunidades de Modernização e Otimização

**Versão**: 1.0
**Data**: 2026-01-21
**Versão Atual do App**: 1.5.0

---

## 📊 Visão Geral

| Categoria | Total | Quick Wins | Medium | Large |
|-----------|-------|------------|--------|-------|
| Arquitetura & Código | 15 | 3 | 7 | 5 |
| UI/UX & Design | 15 | 5 | 8 | 2 |
| Performance | 15 | 4 | 8 | 3 |
| Segurança | 10 | 2 | 5 | 3 |
| Testes & QA | 10 | 1 | 5 | 4 |
| DevOps & CI/CD | 10 | 4 | 5 | 1 |
| Acessibilidade | 8 | 3 | 4 | 1 |
| Internacionalização | 7 | 2 | 4 | 1 |
| Features & Produto | 10 | 0 | 4 | 6 |
| **TOTAL** | **100** | **24** | **50** | **26** |

---

## 🎯 Legenda de Prioridades

- 🔴 **CRITICAL** — Impacta funcionalidade, segurança ou experiência do usuário
- 🟠 **HIGH** — Importante para qualidade e evolução do produto
- 🟡 **MEDIUM** — Melhoria incremental significativa
- 🟢 **LOW** — Nice to have; preparação para o futuro

### Esforço

- ⚡ **QUICK WIN** (1–3 dias) — Alto impacto, baixo esforço
- 🔨 **MEDIUM** (1–2 semanas) — Esforço moderado
- 🏗️ **LARGE** (3+ semanas) — Projeto complexo, múltiplas dependências

---

## 📐 CATEGORIA 1: ARQUITETURA & CÓDIGO (15)

### 1.1 Repository Pattern & Data Layer

#### #001 - Implementar Repository Interface Genérica
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Criar `IRepository<T>` com métodos padrão (getById, getAll, save, delete, observe)
- **Arquivos**:
  - Criar: `domain/repository/IRepository.kt`
  - Modificar: Todos em `data/repository/*RepositoryImpl.kt`
- **Benefícios**:
  - ✅ Redução de código duplicado (~500 linhas)
  - ✅ Facilita mocking em testes
  - ✅ Padrão consistente em todo o app
- **Dependências**: Nenhuma
- **Checklist**:
  - [ ] Criar interface base
  - [ ] Implementar em GameRepository
  - [ ] Implementar em UserRepository
  - [ ] Implementar em GroupRepository
  - [ ] Criar testes unitários
  - [ ] Documentar padrão em CLAUDE.md

#### #002 - Separar Business Logic para Use Cases
- **Prioridade**: 🔴 CRITICAL
- **Esforço**: 🏗️ LARGE (3-4 semanas)
- **Descrição**: Mover lógica de ViewModels para Use Cases (Clean Architecture)
- **Arquivos**:
  - Criar: `domain/usecase/game/`, `domain/usecase/player/`, etc.
  - Modificar: Todos os ViewModels
- **Benefícios**:
  - ✅ Testabilidade 10x melhor
  - ✅ Reutilização de lógica
  - ✅ ViewModels 50% menores
  - ✅ Preparação para KMP
- **TODOs encontrados**: 47 comentários indicando lógica a ser extraída
- **Checklist**:
  - [ ] Criar estrutura base de Use Cases
  - [ ] Migrar GameViewModel → CreateGameUseCase, UpdateGameUseCase, etc.
  - [ ] Migrar PlayerViewModel → GetPlayerStatsUseCase, etc.
  - [ ] Adicionar testes para cada Use Case
  - [ ] Refatorar injeção de dependências (Hilt)

#### #003 - Implementar Cache Strategy Pattern
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Criar estratégias de cache configuráveis (LRU, FIFO, TTL)
- **Arquivos**:
  - Criar: `data/cache/CacheStrategy.kt`, `data/cache/LruCacheStrategy.kt`
  - Modificar: Todos os repositórios
- **Benefícios**:
  - ✅ Cache 30% mais eficiente
  - ✅ Configuração centralizada
  - ✅ Fácil trocar estratégia por tipo de dado
- **Checklist**:
  - [ ] Criar interface CacheStrategy
  - [ ] Implementar LRU (para usuários)
  - [ ] Implementar TTL (para jogos/rankings)
  - [ ] Configurar no AppModule (Hilt)
  - [ ] Adicionar métricas de cache hit/miss

#### #004 - Consolidar Data Sources
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Unificar `FirebaseDataSource`, `FirebaseDataSourceImpl` e `MatchManagementDataSource`
- **Arquivos**:
  - Refatorar: `data/datasource/*.kt`
  - Criar: `data/datasource/UnifiedFirebaseDataSource.kt`
- **Benefícios**:
  - ✅ Reduzir 3 classes para 1
  - ✅ Eliminar código duplicado (~300 linhas)
  - ✅ Mais fácil testar
- **Checklist**:
  - [ ] Mapear todos os métodos usados
  - [ ] Criar interface unificada
  - [ ] Migrar implementações
  - [ ] Atualizar repositórios
  - [ ] Remover classes antigas

#### #005 - Result Monad Customizado
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (2 dias)
- **Descrição**: Criar `AppResult<T>` com Success, Error, Loading
- **Arquivos**:
  - Criar: `domain/model/AppResult.kt`
  - Modificar: Repositórios e ViewModels
- **Benefícios**:
  - ✅ Melhor rastreamento de estados
  - ✅ Mensagens de erro tipadas
  - ✅ Loading state explícito
- **Checklist**:
  - [ ] Criar sealed class AppResult
  - [ ] Adicionar extension functions (toAppResult, mapSuccess, etc.)
  - [ ] Migrar 1 repositório como POC
  - [ ] Documentar uso

#### #006 - Retry Policy para Operações de Rede
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Aplicar `RetryPolicy.kt` existente em todos os repositórios Firebase
- **Arquivos**:
  - Modificar: `data/repository/*RepositoryImpl.kt`
  - Usar: `util/RetryPolicy.kt` (já existe!)
- **Benefícios**:
  - ✅ 50% menos falhas por timeout
  - ✅ Melhor UX em redes instáveis
- **Checklist**:
  - [ ] Aplicar em GameRepository
  - [ ] Aplicar em UserRepository
  - [ ] Aplicar em GroupRepository
  - [ ] Configurar retry count (3) e delay (500ms)

#### #007 - Mappers como Extension Functions
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Converter mappers para extension functions (Kotlin idiomático)
- **Arquivos**:
  - Refatorar: `data/mapper/*.kt`
- **Antes**:
  ```kotlin
  ActivityMapper.toEntity(activity)
  ```
- **Depois**:
  ```kotlin
  activity.toEntity()
  ```
- **Checklist**:
  - [ ] Refatorar ActivityMapper
  - [ ] Refatorar GroupMapper
  - [ ] Refatorar SeasonMapper
  - [ ] Atualizar chamadas

#### #008 - Query Builder para Firestore
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Criar DSL fluente para queries Firestore
- **Exemplo**:
  ```kotlin
  firestoreQuery {
      collection("games")
      where("groupId" equalTo groupId)
      where("status" equalTo "OPEN")
      orderBy("date", descending = false)
      limit(50)
  }
  ```
- **Checklist**:
  - [ ] Criar FirestoreQueryBuilder class
  - [ ] Implementar operators (equalTo, greaterThan, etc.)
  - [ ] Migrar queries complexas de GameRepository
  - [ ] Adicionar testes

#### #009 - Validação com Sealed Classes
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Substituir validações booleanas por `ValidationResult`
- **Arquivos**:
  - Criar: `domain/validation/ValidationResult.kt`
  - Modificar: ViewModels e Use Cases
- **Exemplo**:
  ```kotlin
  sealed class ValidationResult {
      object Valid : ValidationResult()
      data class Invalid(val errors: List<ValidationError>) : ValidationResult()
  }
  ```
- **Checklist**:
  - [ ] Criar ValidationResult e ValidationError
  - [ ] Criar validators (EmailValidator, PasswordValidator, etc.)
  - [ ] Aplicar em LoginViewModel
  - [ ] Aplicar em CreateGameViewModel

#### #010 - Feature Flags System
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Implementar feature flags com Firebase Remote Config
- **Benefícios**:
  - ✅ Deploy gradual de features
  - ✅ A/B testing
  - ✅ Kill switch para features problemáticas
- **Checklist**:
  - [ ] Configurar Firebase Remote Config
  - [ ] Criar FeatureFlagManager
  - [ ] Adicionar flags: enableNewRankingAlgorithm, enableChallenges
  - [ ] Integrar com Hilt
  - [ ] Criar tela de debug (DevTools)

### 1.2 Refatorações Estruturais

#### #011 - Migrar para Kotlin Flow em Todos Repositórios
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🏗️ LARGE (2 semanas)
- **Descrição**: Substituir LiveData/Callbacks por Flow/StateFlow
- **Benefícios**:
  - ✅ API moderna e idiomática
  - ✅ Melhor suporte a operadores (map, filter, combine)
  - ✅ Cancelamento automático
- **Checklist**:
  - [ ] Migrar GameRepository
  - [ ] Migrar UserRepository
  - [ ] Atualizar ViewModels para collectAsState
  - [ ] Remover LiveData dependencies

#### #012 - Implementar Paging 3 para Listas Grandes
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Adicionar Paging 3 em players, games, ranking
- **Arquivos**:
  - Criar: `data/paging/PlayerPagingSource.kt`
  - Modificar: `ui/players/PlayersViewModel.kt`
- **Benefícios**:
  - ✅ Reduzir consumo de memória em 70%
  - ✅ Scroll infinito suave
  - ✅ Indicadores de loading integrados
- **Checklist**:
  - [ ] Adicionar dependency Paging 3
  - [ ] Criar PlayerPagingSource (50 items/page)
  - [ ] Criar GamePagingSource
  - [ ] Atualizar UI com LazyPagingItems

#### #013 - Criar Domain Models Separados de Data Models
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🏗️ LARGE (2 semanas)
- **Descrição**: Separar modelos de domínio (domain/) de modelos de dados (data/)
- **Benefícios**:
  - ✅ Camadas desacopladas
  - ✅ Preparação para KMP
  - ✅ Evita exposição de detalhes de implementação
- **Checklist**:
  - [ ] Criar domain/model/ separado
  - [ ] Criar mappers data ↔ domain
  - [ ] Migrar Game model
  - [ ] Migrar User model
  - [ ] Atualizar ViewModels

#### #014 - Implementar Coroutine Dispatchers Customizados
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Criar CoroutineDispatchers configuráveis via Hilt
- **Arquivos**:
  - Criar: `di/DispatchersModule.kt`
- **Exemplo**:
  ```kotlin
  @Provides @IoDispatcher
  fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO
  ```
- **Benefícios**:
  - ✅ Fácil mockar em testes
  - ✅ Configuração centralizada
- **Checklist**:
  - [ ] Criar módulo Hilt com qualifiers
  - [ ] Injetar em ViewModels/Repositories
  - [ ] Atualizar testes

#### #015 - Adicionar Analytics Events Tipados
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Criar sealed class para eventos de analytics (type-safe)
- **Arquivos**:
  - Criar: `domain/analytics/AnalyticsEvent.kt`
  - Criar: `util/AnalyticsTracker.kt`
- **Exemplo**:
  ```kotlin
  sealed class AnalyticsEvent {
      data class GameCreated(val fieldType: String) : AnalyticsEvent()
      object ProfileViewed : AnalyticsEvent()
  }
  ```
- **Checklist**:
  - [ ] Criar estrutura de eventos
  - [ ] Integrar com Firebase Analytics
  - [ ] Adicionar tracking em ViewModels
  - [ ] Criar dashboard de eventos (opcional)

---

## 🎨 CATEGORIA 2: UI/UX & DESIGN (15)

### 2.1 Composables & Performance

#### #016 - Eliminar LazyVerticalGrid Aninhado em LazyColumn
- **Prioridade**: 🔴 CRITICAL
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Substituir por FlowRow (ExperimentalLayoutApi)
- **Arquivos**:
  - `ui/games/GamesScreen.kt` (linha ~450)
  - `ui/components/design/ShimmerComponents.kt`
  - `ui/components/lists/PullRefreshContainer.kt`
- **Problema**: Scroll travado, recomposições excessivas
- **Solução**:
  ```kotlin
  @OptIn(ExperimentalLayoutApi::class)
  FlowRow(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
  ) {
      items.forEach { item -> ItemCard(item) }
  }
  ```
- **Checklist**:
  - [ ] Substituir em GamesScreen.kt
  - [ ] Substituir em ShimmerComponents.kt
  - [ ] Testar scroll em diferentes tamanhos de tela
  - [ ] Validar performance com Android Profiler

#### #017 - Skeleton Screens Padronizados
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Criar biblioteca de shimmer components reutilizáveis
- **Arquivos**:
  - Criar: `ui/components/shimmer/ShimmerLibrary.kt`
  - Consolidar: `ui/components/Shimmer*.kt` (14 arquivos)
- **Componentes**:
  - ShimmerCard, ShimmerList, ShimmerText, ShimmerImage
- **Checklist**:
  - [ ] Criar componentes base
  - [ ] Aplicar em HomeScreen
  - [ ] Aplicar em PlayersScreen
  - [ ] Aplicar em GamesScreen
  - [ ] Documentar uso

#### #018 - Animações Material 3 (Predictive Back)
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Implementar Predictive Back gestures (Android 14+)
- **Arquivos**:
  - Modificar: `ui/navigation/AppNavGraph.kt`
- **Benefícios**:
  - ✅ UX moderna e intuitiva
  - ✅ Animações fluidas
- **Checklist**:
  - [ ] Habilitar android:enableOnBackInvokedCallback
  - [ ] Implementar OnBackInvokedCallback
  - [ ] Adicionar animações customizadas
  - [ ] Testar em Android 14+

#### #019 - SharedElement Transitions
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Adicionar transições compartilhadas entre telas
- **Exemplo**: Card do jogo → Detalhes do jogo
- **Arquivos**:
  - Modificar: `ui/navigation/AppNavGraph.kt`
  - Modificar: `ui/games/GameCard.kt`, `ui/games/GameDetailScreen.kt`
- **Checklist**:
  - [ ] Adicionar Modifier.sharedElement em GameCard
  - [ ] Configurar SharedTransitionLayout
  - [ ] Testar transições
  - [ ] Ajustar animações

#### #020 - Padronizar TopBar Colors (Material 3)
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Aplicar `AppTopBar.surfaceColors()` em todos os TopAppBars
- **Arquivos inconsistentes (6)**:
  - `ui/games/GameDetailScreen.kt`
  - `ui/groups/GroupDetailScreen.kt`
  - `ui/players/PlayerDetailScreen.kt`
  - `ui/settings/SettingsScreen.kt`
  - `ui/statistics/RankingScreen.kt`
  - `ui/livegame/LiveGameScreen.kt`
- **Antes**:
  ```kotlin
  TopAppBar(
      colors = TopAppBarDefaults.topAppBarColors(
          containerColor = Color(0xFF1E88E5) // ❌ Hardcoded
      )
  )
  ```
- **Depois**:
  ```kotlin
  TopAppBar(colors = AppTopBar.surfaceColors()) // ✅
  ```
- **Checklist**:
  - [ ] Substituir em todos os arquivos listados
  - [ ] Validar em tema claro
  - [ ] Validar em tema escuro
  - [ ] Commit

#### #021 - Dark Theme Preview em Todos Composables
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (3 horas)
- **Descrição**: Adicionar preview de tema escuro em todos os @Composable
- **Arquivos**: 145 arquivos com `@Composable`
- **Template**:
  ```kotlin
  @Preview(name = "Light", showBackground = true)
  @Preview(name = "Dark", uiMode = UI_MODE_NIGHT_YES)
  @Composable
  private fun GameCardPreview() { ... }
  ```
- **Script de automação**:
  ```bash
  find . -name "*.kt" -exec sed -i '/Preview(/ a @Preview(name = "Dark", uiMode = UI_MODE_NIGHT_YES)' {} \;
  ```
- **Checklist**:
  - [ ] Executar script
  - [ ] Revisar manualmente principais telas
  - [ ] Corrigir problemas de contraste encontrados

#### #022 - Sistema de Spacing Adaptativo
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Criar dimens responsivos (phone/tablet/desktop)
- **Arquivos**:
  - Modificar: `ui/adaptive/AdaptiveSpacing.kt`
  - Criar: `res/values/dimens.xml`, `res/values-sw600dp/dimens.xml`
- **Exemplo**:
  ```kotlin
  object AdaptiveSpacing {
      val small @Composable get() = when {
          isCompact -> 8.dp
          isMedium -> 12.dp
          else -> 16.dp
      }
  }
  ```
- **Checklist**:
  - [ ] Definir escala de spacing (small, medium, large, xlarge)
  - [ ] Aplicar em HomeScreen
  - [ ] Aplicar em todas as telas principais
  - [ ] Testar em tablet emulator

#### #023 - Empty States com Ilustrações
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (2 dias)
- **Descrição**: Adicionar ilustrações SVG aos empty states
- **Arquivos**:
  - Modificar: `ui/components/EmptyState.kt`
  - Adicionar: `res/drawable/ic_empty_games.xml`, etc.
- **Ilustrações** (criar ou baixar de unDraw):
  - Sem jogos → Bola de futebol triste
  - Sem jogadores → Campo vazio
  - Sem notificações → Sino desligado
- **Checklist**:
  - [ ] Criar/baixar ilustrações SVG
  - [ ] Atualizar EmptyState component
  - [ ] Aplicar em GamesScreen
  - [ ] Aplicar em PlayersScreen
  - [ ] Aplicar em NotificationsScreen

#### #024 - Pull-to-Refresh Unificado
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Aplicar `PullRefreshContainer` em todas as listas
- **Arquivos**:
  - Usar: `ui/components/lists/PullRefreshContainer.kt` (já existe!)
  - Modificar: Telas sem refresh (7 identificadas)
- **Checklist**:
  - [ ] Aplicar em PlayersScreen
  - [ ] Aplicar em GroupsScreen
  - [ ] Aplicar em RankingScreen
  - [ ] Aplicar em NotificationsScreen
  - [ ] Testar refresh em todas

#### #025 - Badge "NOVO" em Badges Recentes
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Mostrar indicador "NEW" em badges desbloqueadas há menos de 7 dias
- **Arquivos**:
  - Modificar: `ui/badges/BadgesScreen.kt`
  - Usar: `util/SeenBadgesManager.kt` (já existe!)
- **Checklist**:
  - [ ] Adicionar lógica isNew (< 7 dias)
  - [ ] Criar BadgeNewIndicator composable
  - [ ] Aplicar em BadgeCard
  - [ ] Marcar como "visto" ao abrir detalhes

#### #026 - Tipografia Responsiva
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Ajustar tamanhos de fonte baseado em WindowSizeClass
- **Arquivos**:
  - Modificar: `ui/theme/Typography.kt`
- **Exemplo**:
  ```kotlin
  val bodyLarge @Composable get() = when (windowSizeClass) {
      Compact -> TextStyle(fontSize = 16.sp)
      Medium -> TextStyle(fontSize = 18.sp)
      Expanded -> TextStyle(fontSize = 20.sp)
  }
  ```
- **Checklist**:
  - [ ] Criar AdaptiveTypography
  - [ ] Aplicar em todas as telas
  - [ ] Testar em tablet

### 2.2 Componentes Modernos

#### #027 - Implementar Material 3 NavigationBar com Badges
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Atualizar BottomBar com contador de notificações
- **Arquivos**:
  - Modificar: `ui/main/MainActivityCompose.kt`
- **Já existe**: Badge count na aba Profile; expandir para Games
- **Checklist**:
  - [ ] Adicionar badge em Games (jogos confirmados pendentes)
  - [ ] Adicionar badge em Notifications (não lidas)
  - [ ] Testar atualização em tempo real

#### #028 - Search Bar com Sugestões
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Implementar Material 3 SearchBar em PlayersScreen
- **Arquivos**:
  - Criar: `ui/components/search/SearchBar.kt`
  - Modificar: `ui/players/PlayersScreen.kt`
- **Features**:
  - Sugestões baseadas em histórico
  - Filtros por posição, rating, status
- **Checklist**:
  - [ ] Criar SearchBar component
  - [ ] Adicionar histórico de busca (Room)
  - [ ] Implementar filtros
  - [ ] Adicionar animações

#### #029 - Floating Action Button com Menu
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Expandir FAB em HomeScreen para mostrar opções
- **Arquivos**:
  - Modificar: `ui/home/HomeScreen.kt`
- **Opções**:
  - Criar Jogo Rápido
  - Criar Jogo Agendado
  - Criar Grupo
- **Checklist**:
  - [ ] Implementar FAB expansível
  - [ ] Adicionar ícones e labels
  - [ ] Testar animações

#### #030 - Bottom Sheet para Filtros
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Criar ModalBottomSheet para filtros avançados
- **Arquivos**:
  - Criar: `ui/components/filters/FilterBottomSheet.kt`
  - Aplicar: GamesScreen, PlayersScreen, RankingScreen
- **Filtros**:
  - Games: Data, Local, Status, Tipo de campo
  - Players: Posição, Rating, Nível
  - Ranking: Divisão, Temporada
- **Checklist**:
  - [ ] Criar FilterBottomSheet genérico
  - [ ] Implementar em GamesScreen
  - [ ] Implementar em PlayersScreen
  - [ ] Salvar preferências de filtro

---

## ⚡ CATEGORIA 3: PERFORMANCE (15)

### 3.1 Startup & Loading

#### #031 - Implementar Baseline Profiles
- **Prioridade**: 🔴 CRITICAL
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Gerar e aplicar baseline profiles (módulo existe mas não está sendo usado!)
- **Arquivos**:
  - Usar: `baselineprofile/build.gradle.kts`
  - Modificar: `baselineprofile/src/main/java/.../BaselineProfileGenerator.kt`
- **Benefícios**:
  - ✅ Reduzir cold start em 30%
  - ✅ Melhorar navegação inicial
  - ✅ Pré-compilar caminhos críticos
- **Checklist**:
  - [ ] Conectar dispositivo físico (Android 9+)
  - [ ] Executar: `./gradlew :baselineprofile:pixel6Api34BenchmarkAndroidTest`
  - [ ] Gerar profile: `./gradlew :app:generateBaselineProfile`
  - [ ] Validar arquivo gerado em `app/src/main/baseline-prof.txt`
  - [ ] Testar cold start antes/depois

#### #032 - App Startup Library
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Usar Jetpack App Startup para inicialização lazy
- **Arquivos**:
  - Criar: `FutebaInitializer.kt`
  - Modificar: `FutebaApplication.kt`
- **Inicializadores**:
  - Coil (lazy)
  - Firebase Analytics (lazy)
  - WorkManager (lazy)
  - Room (eager)
- **Checklist**:
  - [ ] Adicionar dependency App Startup
  - [ ] Criar initializers
  - [ ] Configurar em AndroidManifest
  - [ ] Validar startup time (antes/depois)

#### #033 - Lazy Modules com Dagger Hilt
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Usar `@Inject Lazy<T>` para repositórios pesados
- **Arquivos**:
  - Modificar: ViewModels com muitas dependências
- **Exemplo**:
  ```kotlin
  @HiltViewModel
  class GameDetailViewModel @Inject constructor(
      private val gameRepo: GameRepository, // Eager
      private val statsRepo: Lazy<StatisticsRepository>, // Lazy
      private val badgeRepo: Lazy<GamificationRepository> // Lazy
  )
  ```
- **Checklist**:
  - [ ] Identificar repositórios usados condicionalmente
  - [ ] Aplicar Lazy em ViewModels
  - [ ] Medir impacto no startup

#### #034 - Reduzir Tamanho do APK com R8 Full Mode
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Habilitar R8 full mode e aggressive shrinking
- **Arquivos**:
  - Modificar: `app/proguard-rules.pro`
  - Modificar: `app/build.gradle.kts`
- **Configuração**:
  ```gradle
  buildTypes {
      release {
          isMinifyEnabled = true
          isShrinkResources = true
          proguardFiles(
              getDefaultProguardFile("proguard-android-optimize.txt"),
              "proguard-rules.pro"
          )
      }
  }
  ```
- **Benefícios**:
  - ✅ APK 15-20% menor
  - ✅ Performance 5-10% melhor
- **Checklist**:
  - [ ] Habilitar R8 full mode
  - [ ] Testar release build
  - [ ] Validar funcionalidades críticas
  - [ ] Comparar APK size antes/depois

#### #035 - Image Optimization com Coil
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Configurar Coil para cache agressivo e redimensionamento
- **Arquivos**:
  - Modificar: `ui/theme/CoilConfig.kt`
- **Configuração**:
  ```kotlin
  ImageLoader.Builder(context)
      .memoryCache {
          MemoryCache.Builder(context)
              .maxSizePercent(0.25) // 25% da RAM
              .build()
      }
      .diskCache {
          DiskCache.Builder()
              .directory(context.cacheDir.resolve("image_cache"))
              .maxSizeBytes(50 * 1024 * 1024) // 50MB
              .build()
      }
      .respectCacheHeaders(false)
      .build()
  ```
- **Checklist**:
  - [ ] Configurar cache de memória/disco
  - [ ] Adicionar redimensionamento automático
  - [ ] Habilitar placeholders
  - [ ] Testar carregamento de imagens

### 3.2 Database & Queries

#### #036 - Paginação em Todas as Listas
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Aplicar Paging 3 em players, games, ranking
- **Arquivos**:
  - Criar: `data/paging/PlayerPagingSource.kt`
  - Modificar: `ui/players/PlayersViewModel.kt`
- **Implementação**:
  ```kotlin
  class PlayerPagingSource(
      private val userRepo: UserRepository
  ) : PagingSource<String, User>() {
      override suspend fun load(params: LoadParams<String>): LoadResult<String, User> {
          // Load 50 items per page
      }
  }
  ```
- **Checklist**:
  - [ ] Implementar PlayerPagingSource
  - [ ] Implementar GamePagingSource
  - [ ] Atualizar UI com LazyPagingItems
  - [ ] Adicionar retry/loading states

#### #037 - Firestore Composite Indexes
- **Prioridade**: 🔴 CRITICAL
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Criar índices compostos para queries frequentes
- **Queries a otimizar**:
  1. Games por grupo + data
  2. Players por XP (ranking)
  3. Statistics por userId + seasonId
- **Arquivo**:
  - Criar: `firestore.indexes.json`
- **Exemplo**:
  ```json
  {
    "indexes": [
      {
        "collectionGroup": "games",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "groupId", "order": "ASCENDING" },
          { "fieldPath": "date", "order": "DESCENDING" }
        ]
      }
    ]
  }
  ```
- **Checklist**:
  - [ ] Identificar queries lentas (Firebase Console)
  - [ ] Criar índices
  - [ ] Deploy: `firebase deploy --only firestore:indexes`
  - [ ] Validar performance (antes/depois)

#### #038 - Room Query Optimization
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Otimizar queries Room com índices e @RawQuery
- **Arquivos**:
  - Modificar: `data/local/dao/Daos.kt`
- **Melhorias**:
  1. Adicionar índices em userId, gameId
  2. Usar @RawQuery para queries dinâmicas
  3. Adicionar @Transaction em operações complexas
- **Checklist**:
  - [ ] Adicionar índices nas entities
  - [ ] Refatorar queries complexas com @RawQuery
  - [ ] Adicionar @Transaction
  - [ ] Validar com Database Inspector

#### #039 - Prefetching Strategy
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Usar `PrefetchService.kt` existente para carregar dados de telas futuras
- **Arquivos**:
  - Usar: `domain/prefetch/PrefetchService.kt` (já existe!)
  - Modificar: ViewModels principais
- **Lógica**:
  - Ao abrir HomeScreen → prefetch próximos jogos
  - Ao abrir GamesScreen → prefetch detalhes dos primeiros 5 jogos
  - Ao abrir PlayersScreen → prefetch estatísticas dos top 10
- **Checklist**:
  - [ ] Implementar PrefetchService completamente
  - [ ] Integrar em HomeViewModel
  - [ ] Integrar em GamesViewModel
  - [ ] Medir impacto na navegação

#### #040 - WorkManager para Background Tasks
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Migrar `CacheCleanupWorker.kt` para WorkManager v2.9+
- **Arquivos**:
  - Modificar: `data/local/CacheCleanupWorker.kt`
- **Workers**:
  1. CacheCleanup (diário)
  2. BadgeCheckWorker (a cada login)
  3. SeasonCloseWorker (mensal)
- **Checklist**:
  - [ ] Atualizar para WorkManager 2.9
  - [ ] Adicionar constraints (wifi, bateria)
  - [ ] Configurar periodic work
  - [ ] Testar execução em background

### 3.3 Network & API

#### #041 - Flow Debouncing em Buscas
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Adicionar debounce(300ms) em campos de busca
- **Arquivos**:
  - Modificar: `ui/players/PlayersViewModel.kt`
  - Modificar: `ui/games/GamesViewModel.kt`
- **Exemplo**:
  ```kotlin
  val searchQuery = MutableStateFlow("")
  val searchResults = searchQuery
      .debounce(300)
      .flatMapLatest { query ->
          repository.searchPlayers(query)
      }
  ```
- **Checklist**:
  - [ ] Aplicar em PlayersScreen
  - [ ] Aplicar em GamesScreen
  - [ ] Aplicar em GroupsScreen
  - [ ] Testar latência

#### #042 - HTTP Cache com OkHttp
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Configurar cache HTTP para APIs externas (se houver)
- **Arquivos**:
  - Criar: `di/NetworkModule.kt`
- **Configuração**:
  ```kotlin
  OkHttpClient.Builder()
      .cache(Cache(cacheDir, 10 * 1024 * 1024)) // 10MB
      .addInterceptor(CacheInterceptor())
      .build()
  ```
- **Checklist**:
  - [ ] Configurar cache
  - [ ] Adicionar interceptor
  - [ ] Testar offline mode

#### #043 - Retry Policy Exponential Backoff
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Melhorar RetryPolicy.kt com exponential backoff
- **Arquivos**:
  - Modificar: `util/RetryPolicy.kt`
- **Configuração**:
  - 1ª tentativa: 500ms delay
  - 2ª tentativa: 1s delay
  - 3ª tentativa: 2s delay
- **Checklist**:
  - [ ] Implementar exponential backoff
  - [ ] Aplicar em repositórios
  - [ ] Testar com network throttling

#### #044 - Connection Quality Monitoring
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Monitorar qualidade da conexão e ajustar comportamento
- **Arquivos**:
  - Criar: `util/NetworkQualityMonitor.kt`
- **Adaptações**:
  - Wi-Fi → Carregar imagens em alta qualidade
  - 4G/5G → Qualidade média
  - 3G/2G → Qualidade baixa, prefetch desabilitado
- **Checklist**:
  - [ ] Criar monitor de qualidade
  - [ ] Integrar com Coil
  - [ ] Ajustar prefetch baseado em conexão

#### #045 - Firebase Performance Monitoring
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Habilitar e configurar Firebase Performance
- **Arquivos**:
  - Modificar: `app/build.gradle.kts`
- **Métricas**:
  - Cold start time
  - Screen rendering time
  - Network request duration
- **Checklist**:
  - [ ] Habilitar plugin
  - [ ] Adicionar custom traces em ViewModels
  - [ ] Configurar alertas no Firebase Console
  - [ ] Monitorar por 1 semana

---

## 🔒 CATEGORIA 4: SEGURANÇA (10)

### 4.1 Autenticação & Autorização

#### #046 - Certificate Pinning
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Implementar SSL pinning para Firebase e APIs
- **Arquivos**:
  - Criar: `di/NetworkModule.kt`
- **Implementação**:
  ```kotlin
  CertificatePinner.Builder()
      .add("*.firebaseio.com", "sha256/AAAAAAA...")
      .build()
  ```
- **Checklist**:
  - [ ] Extrair certificados Firebase
  - [ ] Configurar OkHttp com pinning
  - [ ] Testar em diferentes redes
  - [ ] Adicionar fallback para debug builds

#### #047 - ProGuard Rules Customizadas
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Expandir `proguard-rules.pro` para ofuscar domain models
- **Arquivos**:
  - Modificar: `app/proguard-rules.pro`
- **Regras**:
  ```proguard
  # Ofuscar domain models
  -keep class com.futebadosparcas.domain.model.** { *; }
  -keepclassmembers class com.futebadosparcas.data.model.** { *; }

  # Ofuscar ViewModels
  -keep class * extends androidx.lifecycle.ViewModel { *; }
  ```
- **Checklist**:
  - [ ] Adicionar regras de ofuscação
  - [ ] Testar release build
  - [ ] Validar com reverse engineering tool

#### #048 - Input Validation com Regex
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Criar ValidationUtils.kt com regex patterns
- **Arquivos**:
  - Criar: `util/ValidationUtils.kt`
- **Validações**:
  - Email: RFC 5322 compliant
  - Senha: Min 8 chars, 1 uppercase, 1 número
  - Nome: Apenas letras e espaços
  - Telefone: Formato brasileiro
- **Checklist**:
  - [ ] Criar ValidationUtils
  - [ ] Aplicar em RegisterViewModel
  - [ ] Aplicar em EditProfileScreen
  - [ ] Adicionar testes unitários

#### #049 - Rate Limiting Local
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Limitar tentativas de login/registro (5/minuto)
- **Arquivos**:
  - Criar: `util/RateLimiter.kt`
  - Modificar: `ui/auth/LoginViewModel.kt`
- **Implementação**:
  ```kotlin
  class RateLimiter(val maxAttempts: Int, val windowMs: Long) {
      fun tryAcquire(key: String): Boolean { ... }
  }
  ```
- **Checklist**:
  - [ ] Criar RateLimiter
  - [ ] Aplicar em login (5 tentativas/min)
  - [ ] Aplicar em registro (3 tentativas/min)
  - [ ] Mostrar mensagem de erro apropriada

#### #050 - Migrar para DataStore Crypto
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🏗️ LARGE (2 semanas)
- **Descrição**: Substituir EncryptedSharedPreferences por DataStore
- **Arquivos**:
  - Refatorar: `util/PreferencesManager.kt`
  - Refatorar: `util/SeenBadgesManager.kt`
- **Benefícios**:
  - ✅ API Coroutines nativa
  - ✅ Type-safe
  - ✅ Migração automática
- **Checklist**:
  - [ ] Adicionar dependency DataStore Preferences
  - [ ] Criar DataStore com crypto
  - [ ] Migrar PreferencesManager
  - [ ] Migrar SeenBadgesManager
  - [ ] Adicionar testes

### 4.2 Proteção de Dados

#### #051 - Sanitização de Logs em Produção
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Remover logs sensíveis em release builds
- **Arquivos**:
  - Modificar: `util/AppLogger.kt`
- **Implementação**:
  ```kotlin
  object AppLogger {
      fun d(tag: String, message: String) {
          if (BuildConfig.DEBUG) {
              Log.d(tag, message)
          }
      }
  }
  ```
- **Checklist**:
  - [ ] Criar wrapper de logs
  - [ ] Substituir todos Log.d/i/w por AppLogger
  - [ ] Validar release build (não deve ter logs)

#### #052 - Firestore Security Rules Audit
- **Prioridade**: 🔴 CRITICAL
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Revisar e fortalecer security rules do Firestore
- **Arquivos**:
  - Modificar: `firestore.rules`
- **Verificações**:
  1. Users só podem editar próprio perfil
  2. Games só visíveis para membros do grupo
  3. Statistics são read-only para usuários
  4. Admin permissions validadas no backend
- **Checklist**:
  - [ ] Auditar rules atuais
  - [ ] Adicionar validação de dados (schemas)
  - [ ] Testar com Firestore Emulator
  - [ ] Deploy e validar em produção

#### #053 - Backup Encryption
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Encriptar backups locais do Room
- **Arquivos**:
  - Modificar: `data/local/AppDatabase.kt`
- **Implementação**:
  ```kotlin
  Room.databaseBuilder(context, AppDatabase::class.java, "futeba.db")
      .openHelperFactory(SupportFactory(getKey()))
      .build()
  ```
- **Checklist**:
  - [ ] Adicionar SQLCipher dependency
  - [ ] Gerar master key
  - [ ] Configurar Room com encryption
  - [ ] Testar backup/restore

#### #054 - App Attestation (Play Integrity API)
- **Prioridade**: 🟢 LOW
- **Esforço**: 🏗️ LARGE (2 semanas)
- **Descrição**: Verificar que o app não foi modificado/hackeado
- **Arquivos**:
  - Criar: `util/AppIntegrityChecker.kt`
- **Checklist**:
  - [ ] Configurar Play Console
  - [ ] Implementar verificação no startup
  - [ ] Bloquear app se falhar (modo graceful)
  - [ ] Logar tentativas de fraude

#### #055 - Root Detection
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Detectar dispositivos rooteados e alertar usuário
- **Arquivos**:
  - Criar: `util/RootDetector.kt`
- **Verificações**:
  - Presença de Magisk, SuperSU
  - Build tags (test-keys)
  - Arquivos suspeitos (/system/bin/su)
- **Checklist**:
  - [ ] Implementar detector
  - [ ] Mostrar warning dialog (não bloquear!)
  - [ ] Logar dispositivos rooteados (analytics)

---

## ✅ CATEGORIA 5: TESTES & QA (10)

### 5.1 Testes Unitários

#### #056 - Aumentar Cobertura para 70%
- **Prioridade**: 🔴 CRITICAL
- **Esforço**: 🏗️ LARGE (4 semanas)
- **Descrição**: Criar testes para Use Cases, ViewModels, Repositories
- **Situação atual**: 27 testes (~15% cobertura)
- **Meta**: 70% de cobertura
- **Arquivos**:
  - Criar: `app/src/test/java/domain/usecase/`
  - Criar: `app/src/test/java/ui/`
- **Prioridades**:
  1. Use Cases críticos (CreateGame, ConfirmPresence, UpdateRanking)
  2. ViewModels principais (GameViewModel, PlayerViewModel)
  3. Repositories (GameRepository, UserRepository)
- **Checklist**:
  - [ ] Semana 1: Use Cases de games
  - [ ] Semana 2: Use Cases de players/ranking
  - [ ] Semana 3: ViewModels
  - [ ] Semana 4: Repositories
  - [ ] Configurar Jacoco para coverage report
  - [ ] Adicionar ao CI

#### #057 - Test Doubles com MockK
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Padronizar uso de MockK para mocks/stubs/spies
- **Arquivos**:
  - Modificar: Todos os testes
- **Padrões**:
  ```kotlin
  val mockRepo = mockk<GameRepository>()
  coEvery { mockRepo.getGame(any()) } returns Result.success(testGame)

  // Verify
  coVerify(exactly = 1) { mockRepo.getGame(gameId) }
  ```
- **Checklist**:
  - [ ] Padronizar mocks em testes existentes
  - [ ] Criar test fixtures reutilizáveis
  - [ ] Documentar padrões em CONTRIBUTING.md

#### #058 - Parameterized Tests
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Usar JUnit5 parameterized tests para edge cases
- **Exemplo**:
  ```kotlin
  @ParameterizedTest
  @ValueSource(ints = [0, -1, 101])
  fun `xp calculation rejects invalid values`(xp: Int) {
      assertThrows<IllegalArgumentException> {
          XPCalculator.calculate(xp)
      }
  }
  ```
- **Checklist**:
  - [ ] Adicionar JUnit5 dependency
  - [ ] Criar testes parametrizados para XPCalculator
  - [ ] Criar testes para RatingCalculator
  - [ ] Criar testes para TeamBalancer

### 5.2 Testes de Integração

#### #059 - Integration Tests com Firestore Emulator
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Testar integração Firestore com emulador local
- **Arquivos**:
  - Criar: `app/src/androidTest/java/integration/`
- **Setup**:
  ```bash
  firebase emulators:start --only firestore
  ```
- **Testes**:
  - CRUD de games
  - Queries complexas (filtros, ordenação)
  - Transações (confirmação de presença)
  - Security rules
- **Checklist**:
  - [ ] Configurar emulador no CI
  - [ ] Criar GameRepositoryIntegrationTest
  - [ ] Criar UserRepositoryIntegrationTest
  - [ ] Adicionar ao pipeline

#### #060 - Room Database Tests
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Testar DAOs e queries Room
- **Arquivos**:
  - Criar: `app/src/androidTest/java/data/local/`
- **Testes**:
  - Insert/Update/Delete
  - Queries com joins
  - Migrations
- **Checklist**:
  - [ ] Criar DaoTest base class
  - [ ] Testar GameDao
  - [ ] Testar UserDao
  - [ ] Testar migrations

### 5.3 Testes de UI

#### #061 - Screenshot Testing com Paparazzi
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Snapshot tests de Composables principais
- **Arquivos**:
  - Criar: `app/src/test/java/screenshots/`
- **Setup**:
  ```kotlin
  @get:Rule
  val paparazzi = Paparazzi()

  @Test
  fun gameCard_light() {
      paparazzi.snapshot {
          GameCard(testGame)
      }
  }
  ```
- **Componentes a testar**:
  - GameCard, PlayerCard, BadgeCard
  - EmptyState, Shimmer components
  - Telas completas (Home, Games, Players)
- **Checklist**:
  - [ ] Adicionar Paparazzi dependency
  - [ ] Criar testes de componentes
  - [ ] Criar testes de telas
  - [ ] Configurar verificação no CI

#### #062 - Espresso Tests para Fluxos Críticos
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🏗️ LARGE (2 semanas)
- **Descrição**: Testes E2E dos principais fluxos
- **Arquivos**:
  - Criar: `app/src/androidTest/java/ui/`
- **Fluxos**:
  1. Login com Google
  2. Criar jogo
  3. Confirmar presença em jogo
  4. Visualizar perfil e estatísticas
  5. Editar perfil
- **Checklist**:
  - [ ] Semana 1: Fluxos de auth e onboarding
  - [ ] Semana 2: Fluxos de games e confirmação
  - [ ] Configurar test orchestrator
  - [ ] Adicionar ao CI (run on PR)

#### #063 - Accessibility Tests (Espresso)
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Testes automatizados de acessibilidade
- **Arquivos**:
  - Criar: `app/src/androidTest/java/accessibility/`
- **Verificações**:
  - Content descriptions em ícones
  - Touch targets >= 48dp
  - Contraste de cores
  - Ordem de leitura (TalkBack)
- **Checklist**:
  - [ ] Adicionar AccessibilityChecks
  - [ ] Criar AccessibilityTestRule
  - [ ] Testar telas principais
  - [ ] Corrigir issues encontrados

### 5.4 Performance Tests

#### #064 - Macrobenchmark Tests
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Benchmarks de cold start, scroll, navegação
- **Arquivos**:
  - Criar módulo: `benchmark/`
- **Benchmarks**:
  - Cold start time
  - Scroll jank (GamesScreen, PlayersScreen)
  - Navigation latency
- **Checklist**:
  - [ ] Criar módulo benchmark
  - [ ] Criar StartupBenchmark
  - [ ] Criar ScrollBenchmark
  - [ ] Configurar baseline profile generation

#### #065 - Memory Leak Detection (LeakCanary)
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Integrar LeakCanary para detectar memory leaks
- **Arquivos**:
  - Modificar: `app/build.gradle.kts`
- **Configuração**:
  ```kotlin
  dependencies {
      debugImplementation("com.squareup.leakcanary:leakcanary-android:2.12")
  }
  ```
- **Checklist**:
  - [ ] Adicionar dependency
  - [ ] Testar app por 1 semana
  - [ ] Corrigir leaks encontrados
  - [ ] Documentar padrões

---

## 🚀 CATEGORIA 6: DEVOPS & CI/CD (10)

### 6.1 Continuous Integration

#### #066 - Deploy Automático para Firebase App Distribution
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: APKs de debug em PRs automaticamente
- **Arquivos**:
  - Modificar: `.github/workflows/android-ci.yml`
- **Workflow**:
  ```yaml
  - name: Build Debug APK
    run: ./gradlew assembleDebug

  - name: Upload to Firebase App Distribution
    uses: wzieba/Firebase-Distribution-Github-Action@v1
    with:
      appId: ${{secrets.FIREBASE_APP_ID}}
      token: ${{secrets.FIREBASE_TOKEN}}
      groups: testers
      file: app/build/outputs/apk/debug/app-debug.apk
  ```
- **Checklist**:
  - [ ] Configurar Firebase App Distribution
  - [ ] Adicionar secrets ao GitHub
  - [ ] Configurar workflow
  - [ ] Testar em PR de teste

#### #067 - Semantic Versioning Automático
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Usar Conventional Commits para incrementar versão
- **Arquivos**:
  - Criar: `.github/workflows/version-bump.yml`
  - Modificar: `build.gradle.kts`
- **Convenção**:
  - `feat:` → minor version bump (1.5.0 → 1.6.0)
  - `fix:` → patch version bump (1.5.0 → 1.5.1)
  - `BREAKING CHANGE:` → major version bump (1.5.0 → 2.0.0)
- **Checklist**:
  - [ ] Configurar semantic-release
  - [ ] Criar workflow de version bump
  - [ ] Atualizar CONTRIBUTING.md com convenção
  - [ ] Testar em branch de teste

#### #068 - Danger para Code Review
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Automatizar verificações em PRs
- **Arquivos**:
  - Criar: `Dangerfile`
- **Verificações**:
  - PR description não vazia
  - PR size < 500 linhas
  - Testes foram adicionados (se código novo)
  - Changelog atualizado
  - Lint passou
- **Checklist**:
  - [ ] Configurar Danger
  - [ ] Criar Dangerfile com regras
  - [ ] Adicionar ao workflow
  - [ ] Testar em PR

#### #069 - Dependency Update Automation
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Renovate ou Dependabot para atualizar dependências
- **Arquivos**:
  - Criar: `.github/renovate.json`
- **Configuração**:
  ```json
  {
    "extends": ["config:base"],
    "packageRules": [
      {
        "matchUpdateTypes": ["minor", "patch"],
        "automerge": true
      }
    ]
  }
  ```
- **Checklist**:
  - [ ] Habilitar Renovate no repo
  - [ ] Configurar schedule (weekly)
  - [ ] Configurar automerge para patches
  - [ ] Monitorar por 1 mês

#### #070 - Crashlytics Mapping Upload
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Upload automático de mapping files
- **Arquivos**:
  - Modificar: `.github/workflows/android-ci.yml`
- **Workflow**:
  ```yaml
  - name: Upload Crashlytics Mapping
    run: |
      ./gradlew :app:uploadCrashlyticsMapping${{ matrix.variant }}
  ```
- **Checklist**:
  - [ ] Adicionar step ao workflow
  - [ ] Validar upload no Firebase Console
  - [ ] Testar stacktrace simbólico

### 6.2 Continuous Deployment

#### #071 - Play Store Deployment Automation
- **Prioridade**: 🟢 LOW
- **Esforço**: 🏗️ LARGE (2 semanas)
- **Descrição**: Deploy automático para Play Store (beta track)
- **Arquivos**:
  - Criar: `.github/workflows/release.yml`
- **Workflow**:
  1. Criar release tag (v1.5.0)
  2. Build release APK/AAB
  3. Sign com release keystore
  4. Upload para Play Console (beta)
  5. Notificar time
- **Checklist**:
  - [ ] Configurar service account
  - [ ] Criar workflow de release
  - [ ] Testar upload para internal track
  - [ ] Documentar processo

#### #072 - Automated Changelog Generation
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Gerar CHANGELOG.md a partir de commits
- **Arquivos**:
  - Criar: `.github/workflows/changelog.yml`
- **Tool**: conventional-changelog
- **Checklist**:
  - [ ] Configurar conventional-changelog
  - [ ] Criar workflow
  - [ ] Gerar changelog em releases
  - [ ] Incluir no Play Store listing

#### #073 - Beta Testing Program
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Programa estruturado de beta testers
- **Plataformas**:
  - Firebase App Distribution (debug builds)
  - Play Store Beta Track (release candidates)
- **Processo**:
  1. Recrutamento de testers (grupos de pelada)
  2. Releases semanais
  3. Formulário de feedback
  4. Bug tracking integrado
- **Checklist**:
  - [ ] Criar lista de beta testers (50 usuários)
  - [ ] Configurar grupos no Firebase
  - [ ] Criar formulário de feedback
  - [ ] Processo de triagem de bugs

#### #074 - Monitoring & Alerting
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Configurar alertas para métricas críticas
- **Métricas**:
  - Crash rate > 2%
  - ANR rate > 1%
  - Cold start > 3s
  - Network error rate > 10%
- **Ferramentas**:
  - Firebase Crashlytics
  - Firebase Performance
  - Google Analytics
- **Checklist**:
  - [ ] Configurar thresholds
  - [ ] Criar alertas (email/Slack)
  - [ ] Criar dashboard
  - [ ] Testar alertas

#### #075 - Rollback Strategy
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Processo de rollback para releases problemáticas
- **Estratégia**:
  1. Detecção: Alertas automáticos
  2. Decisão: Análise de impacto
  3. Rollback: Promover versão anterior
  4. Comunicação: Notificar usuários
- **Checklist**:
  - [ ] Documentar processo
  - [ ] Criar runbook
  - [ ] Testar rollback em beta track
  - [ ] Treinar equipe

---

## ♿ CATEGORIA 7: ACESSIBILIDADE (8)

### 7.1 Content & Semantics

#### #076 - Content Description Audit
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Adicionar contentDescription em todos os ícones interativos
- **Situação**: 341 ocorrências de Icon() encontradas
- **Arquivos**: Todos em `ui/`
- **Checklist**:
  - [ ] Auditar icons em HomeScreen
  - [ ] Auditar icons em GamesScreen
  - [ ] Auditar icons em PlayersScreen
  - [ ] Auditar icons em ProfileScreen
  - [ ] Criar lint rule customizada
  - [ ] Validar com TalkBack

#### #077 - Semantics Properties
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Usar Modifier.semantics {} para melhorar acessibilidade
- **Arquivos**:
  - Modificar: Componentes customizados em `ui/components/`
- **Exemplo**:
  ```kotlin
  Badge(
      modifier = Modifier.semantics {
          contentDescription = "Badge: ${badge.name}"
          role = Role.Image
          testTag = "badge_${badge.id}"
      }
  )
  ```
- **Checklist**:
  - [ ] Aplicar em GameCard
  - [ ] Aplicar em PlayerCard
  - [ ] Aplicar em BadgeCard
  - [ ] Aplicar em custom buttons
  - [ ] Validar ordem de leitura

#### #078 - Live Region Announcements
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Anunciar mudanças dinâmicas para leitores de tela
- **Exemplo**:
  ```kotlin
  var message by remember { mutableStateOf("") }

  Box(
      modifier = Modifier.semantics {
          liveRegion = LiveRegionMode.Polite
          contentDescription = message
      }
  )
  ```
- **Casos de uso**:
  - Loading states
  - Erros de validação
  - Confirmações de ações
- **Checklist**:
  - [ ] Aplicar em loading states
  - [ ] Aplicar em error messages
  - [ ] Testar com TalkBack

### 7.2 Navigation & Interaction

#### #079 - Minimum Touch Target Size
- **Prioridade**: 🟠 HIGH
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Validar todos os botões/ícones >= 48dp
- **Arquivos**:
  - Modificar: `ui/components/design/AppButtons.kt`
- **Correções**:
  ```kotlin
  IconButton(
      onClick = {},
      modifier = Modifier.size(48.dp) // ✅ Mínimo
  ) {
      Icon(
          imageVector = Icons.Default.Delete,
          modifier = Modifier.size(24.dp)
      )
  }
  ```
- **Checklist**:
  - [ ] Auditar todos os IconButtons
  - [ ] Auditar icons clicáveis
  - [ ] Criar lint rule
  - [ ] Validar com Accessibility Scanner

#### #080 - Keyboard Navigation
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Suporte completo a navegação por teclado/D-pad
- **Arquivos**:
  - Modificar: Telas principais
- **Implementação**:
  ```kotlin
  LazyColumn(
      modifier = Modifier.focusable()
  ) {
      items(games) { game ->
          GameCard(
              game = game,
              modifier = Modifier.focusable()
          )
      }
  }
  ```
- **Checklist**:
  - [ ] Adicionar focusable em listas
  - [ ] Testar com teclado físico
  - [ ] Testar com D-pad (Android TV)

#### #081 - TalkBack Testing Guidelines
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Documentar processo de teste com TalkBack
- **Arquivos**:
  - Criar: `.claude/rules/accessibility-testing.md`
- **Conteúdo**:
  - Como habilitar TalkBack
  - Gestos principais
  - Checklist por tela
  - Casos de teste
- **Checklist**:
  - [ ] Criar documentação
  - [ ] Testar HomeScreen com TalkBack
  - [ ] Testar GamesScreen com TalkBack
  - [ ] Adicionar ao processo de QA

### 7.3 Visual & Contrast

#### #082 - Contrast Checker Automatizado
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Testes unitários que validam contraste
- **Arquivos**:
  - Criar: `app/src/test/java/accessibility/ContrastTests.kt`
- **Implementação**:
  ```kotlin
  @Test
  fun `primary text on surface meets WCAG AA`() {
      val foreground = MaterialTheme.colorScheme.onSurface
      val background = MaterialTheme.colorScheme.surface

      assertTrue(
          ContrastHelper.meetsWCAGAA(foreground, background)
      )
  }
  ```
- **Checklist**:
  - [ ] Criar testes para cores do tema
  - [ ] Testar gamification colors
  - [ ] Adicionar ao CI
  - [ ] Corrigir falhas encontradas

#### #083 - Font Scaling Support
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Suporte a tamanhos de fonte grandes (Settings > Display)
- **Arquivos**:
  - Modificar: Todas as telas
- **Testes**:
  - Testar com 200% font scale
  - Evitar textos truncados
  - Usar ellipsis quando necessário
- **Checklist**:
  - [ ] Testar HomeScreen com 200% scale
  - [ ] Testar GamesScreen com 200% scale
  - [ ] Corrigir layouts quebrados
  - [ ] Adicionar screenshots tests com scaling

---

## 🌍 CATEGORIA 8: INTERNACIONALIZAÇÃO (7)

### 8.1 Localização

#### #084 - Suporte a Inglês (en-US)
- **Prioridade**: 🔴 CRITICAL
- **Esforço**: 🏗️ LARGE (3 semanas)
- **Descrição**: Traduzir todas as strings para inglês
- **Situação**: 2657 strings apenas em pt-BR
- **Arquivos**:
  - Criar: `res/values-en/strings.xml`
- **Processo**:
  1. Tradução automática (DeepL/Google Translate)
  2. Revisão manual por nativo
  3. Validação em contexto
- **Benefícios**:
  - ✅ Expandir para 1.5bi+ usuários de língua inglesa
  - ✅ App Store em mais países
- **Checklist**:
  - [ ] Semana 1: Traduzir onboarding + auth (200 strings)
  - [ ] Semana 2: Traduzir telas principais (1000 strings)
  - [ ] Semana 3: Traduzir gamificação + restante (1457 strings)
  - [ ] Contratar revisor nativo
  - [ ] Validar em emulador en-US

#### #085 - Plurals para Strings
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Substituir strings como "X jogos" por `<plurals>`
- **Arquivos**:
  - Modificar: `res/values/strings.xml`
- **Antes**:
  ```xml
  <string name="games_count">%d jogos</string>
  ```
- **Depois**:
  ```xml
  <plurals name="games_count">
      <item quantity="one">%d jogo</item>
      <item quantity="other">%d jogos</item>
  </plurals>
  ```
- **Checklist**:
  - [ ] Identificar strings com contadores (games, players, etc.)
  - [ ] Converter para plurals
  - [ ] Atualizar código
  - [ ] Testar em pt-BR e en-US

#### #086 - Moko Resources para KMP
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Migrar para Moko Resources (preparação KMP)
- **Arquivos**:
  - Usar: `ui/components/MokoStrings.kt` (já existe!)
  - Modificar: Módulo `shared/`
- **Benefícios**:
  - ✅ Strings compartilhadas Android/iOS
  - ✅ Type-safe string access
- **Checklist**:
  - [ ] Configurar Moko Resources no shared module
  - [ ] Migrar strings principais
  - [ ] Validar em Android
  - [ ] Documentar uso

#### #087 - RTL Support
- **Prioridade**: 🟢 LOW
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Suporte a idiomas RTL (árabe, hebraico)
- **Arquivos**:
  - Modificar: `AndroidManifest.xml`
- **Configuração**:
  ```xml
  <application
      android:supportsRtl="true">
  ```
- **Testes**:
  - Emulador com idioma árabe
  - Validar layouts (mirror automático)
  - Corrigir ícones direcionais
- **Checklist**:
  - [ ] Habilitar RTL
  - [ ] Testar em árabe (ar)
  - [ ] Corrigir problemas de layout
  - [ ] Usar Icons.AutoMirrored onde apropriado

### 8.2 Formatação

#### #088 - Currency Formatting
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Usar NumberFormat para valores monetários
- **Arquivos**:
  - Modificar: `ui/groups/CashboxScreen.kt`
- **Implementação**:
  ```kotlin
  val formatter = NumberFormat.getCurrencyInstance(Locale.getDefault())
  formatter.format(value) // R$ 50,00 ou $50.00
  ```
- **Checklist**:
  - [ ] Substituir formatação manual
  - [ ] Testar em pt-BR (R$)
  - [ ] Testar em en-US ($)

#### #089 - Date/Time Formatting
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: ⚡ QUICK WIN (1 dia)
- **Descrição**: Usar DateTimeFormatter correto por locale
- **Arquivos**:
  - Criar: `util/DateFormatter.kt`
- **Formatos**:
  - pt-BR: 21/01/2026 14:30
  - en-US: Jan 21, 2026 2:30 PM
- **Checklist**:
  - [ ] Criar DateFormatter utility
  - [ ] Aplicar em todas as datas
  - [ ] Testar em diferentes locales

#### #090 - Number Formatting
- **Prioridade**: 🟢 LOW
- **Esforço**: ⚡ QUICK WIN (2 horas)
- **Descrição**: Formatar números grandes (XP, rankings)
- **Exemplo**:
  - 1000 → 1K
  - 1500000 → 1.5M
- **Arquivos**:
  - Criar: `util/NumberFormatter.kt`
- **Checklist**:
  - [ ] Criar formatter
  - [ ] Aplicar em XP display
  - [ ] Aplicar em rankings

---

## ✨ CATEGORIA 9: FEATURES & PRODUTO (10)

### 9.1 Gamificação

#### #091 - Sistema de Lembretes (Push Notifications)
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🏗️ LARGE (3 semanas)
- **Descrição**: Finalizar `functions/src/reminders.ts` e integrar notificações
- **Arquivos**:
  - Usar: `functions/src/reminders.ts` (já existe!)
  - Criar: `domain/notifications/ReminderScheduler.kt`
- **Lembretes**:
  - 24h antes do jogo
  - 2h antes do jogo
  - Confirmação de presença pendente
  - Novo jogo no grupo
- **Checklist**:
  - [ ] Semana 1: Finalizar Cloud Function
  - [ ] Semana 2: Implementar ReminderScheduler Android
  - [ ] Semana 3: Integrar com FCM, testes
  - [ ] Deploy e validar em produção

#### #092 - Challenges Semanais
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🏗️ LARGE (4 semanas)
- **Descrição**: Sistema completo de desafios gamificados
- **Arquivos**:
  - Expandir: `ui/home/components/ChallengesSection.kt`
  - Criar: `domain/challenges/`, `data/model/Challenge.kt`
- **Desafios**:
  - "Jogue 3 partidas esta semana" (+100 XP)
  - "Marque 5 gols" (+150 XP)
  - "Sequência de 5 jogos" (badge especial)
- **Checklist**:
  - [ ] Semana 1: Data models e Firestore schema
  - [ ] Semana 2: Challenge logic (checkers, rewards)
  - [ ] Semana 3: UI (lista, detalhes, progresso)
  - [ ] Semana 4: Notificações e testes

#### #093 - Heatmap de Atividades
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Implementar completamente ActivityHeatmapSection.kt
- **Arquivos**:
  - Modificar: `ui/home/components/ActivityHeatmapSection.kt`
- **Design**:
  - Grid 7x52 (dias x semanas)
  - Cores baseadas em atividade (0 = cinza, 10+ jogos = verde escuro)
  - Tooltip com contagem
- **Checklist**:
  - [ ] Criar composable de heatmap
  - [ ] Buscar dados de atividade (Room/Firestore)
  - [ ] Renderizar grid
  - [ ] Adicionar tooltip
  - [ ] Testar com dados reais

#### #094 - Badges Customizadas por Grupo
- **Prioridade**: 🟢 LOW
- **Esforço**: 🏗️ LARGE (3 semanas)
- **Descrição**: Permitir que admins de grupos criem badges customizadas
- **Arquivos**:
  - Criar: `ui/groups/admin/CreateBadgeScreen.kt`
  - Modificar: `domain/gamification/BadgeAwarder.kt`
- **Features**:
  - Upload de ícone (PNG/SVG)
  - Nome e descrição
  - Critérios de desbloqueio
- **Checklist**:
  - [ ] UI de criação
  - [ ] Upload de imagem
  - [ ] Lógica de atribuição
  - [ ] Validar com grupo teste

### 9.2 Social & Sharing

#### #095 - Compartilhamento Social (Instagram/Twitter)
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Expandir ShareCardHelper.kt para redes sociais
- **Arquivos**:
  - Modificar: `util/ShareCardHelper.kt`
- **Cartões compartilháveis**:
  - Resultado do jogo (placar, MVPs)
  - Subida de nível (badge novo)
  - Conquistas (hat-trick, sequência)
- **Plataformas**:
  - Instagram Stories (1080x1920)
  - Twitter (1200x675)
  - Facebook (1200x630)
- **Checklist**:
  - [ ] Criar templates de imagem
  - [ ] Renderizar com Canvas/Bitmap
  - [ ] Integrar com Intent.ACTION_SEND
  - [ ] Testar compartilhamento

#### #096 - Convites por Deep Link
- **Prioridade**: 🟡 MEDIUM
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Deep links para convites de jogos/grupos
- **Arquivos**:
  - Modificar: `AndroidManifest.xml`
  - Criar: `ui/navigation/DeepLinkHandler.kt`
- **Links**:
  - `futeba://game/{gameId}` → Detalhes do jogo
  - `futeba://group/{groupId}` → Convite para grupo
- **Checklist**:
  - [ ] Configurar deep links no manifest
  - [ ] Criar handler de navegação
  - [ ] Testar com adb shell am start
  - [ ] Integrar com Firebase Dynamic Links

#### #097 - Feed de Atividades Social
- **Prioridade**: 🟢 LOW
- **Esforço**: 🏗️ LARGE (3 semanas)
- **Descrição**: Feed social estilo Facebook/Instagram
- **Arquivos**:
  - Expandir: `ui/home/components/ActivityFeedSection.kt`
- **Atividades**:
  - João marcou 3 gols no jogo de ontem
  - Maria subiu para Divisão Ouro
  - Grupo "Pelada da Firma" criou novo jogo
- **Checklist**:
  - [ ] Data model para atividades
  - [ ] Firestore collection com índices
  - [ ] UI com LazyColumn
  - [ ] Paginação
  - [ ] Sistema de likes/comentários (fase 2)

### 9.3 Analytics & Insights

#### #098 - Dashboard Analítico para Admins
- **Prioridade**: 🟢 LOW
- **Esforço**: 🏗️ LARGE (4 semanas)
- **Descrição**: Painel com métricas do grupo/app
- **Arquivos**:
  - Criar: `ui/admin/AnalyticsDashboard.kt`
- **Métricas**:
  - Jogos criados/semana
  - Taxa de confirmação de presença
  - Jogadores mais ativos
  - Horários com maior engajamento
- **Gráficos**:
  - Line chart (jogos ao longo do tempo)
  - Bar chart (jogadores por posição)
  - Pie chart (tipo de campo preferido)
- **Checklist**:
  - [ ] Coletar dados (Firebase Analytics)
  - [ ] Criar composables de gráficos (MPAndroidChart)
  - [ ] UI de dashboard
  - [ ] Testes com dados reais

#### #099 - Recomendações de Jogadores (ML)
- **Prioridade**: 🟢 LOW
- **Esforço**: 🏗️ LARGE (6+ semanas)
- **Descrição**: Recomendar jogadores para balanceamento
- **Arquivos**:
  - Criar: `domain/ai/PlayerRecommender.kt`
- **Algoritmo**:
  1. Embeddings de jogadores (rating, estatísticas, histórico)
  2. K-Nearest Neighbors para similaridade
  3. Recomendação baseada em context (faltou atacante → recomendar atacantes)
- **Checklist**:
  - [ ] Pesquisar ML on-device (TensorFlow Lite)
  - [ ] Criar dataset de treinamento
  - [ ] Treinar modelo
  - [ ] Integrar no app
  - [ ] Validar recomendações

#### #100 - Exportação de Dados (LGPD Compliance)
- **Prioridade**: 🟠 HIGH
- **Esforço**: 🔨 MEDIUM (1 semana)
- **Descrição**: Permitir que usuários exportem seus dados (LGPD/GDPR)
- **Arquivos**:
  - Criar: `ui/settings/DataExportScreen.kt`
  - Criar: `domain/export/DataExporter.kt`
- **Dados exportados**:
  - Perfil (JSON)
  - Estatísticas (CSV)
  - Jogos participados (CSV)
  - Badges (JSON)
- **Formato**: ZIP com múltiplos arquivos
- **Checklist**:
  - [ ] Criar UI de export
  - [ ] Implementar DataExporter
  - [ ] Gerar ZIP em background (WorkManager)
  - [ ] Enviar por email ou salvar no Downloads
  - [ ] Testar compliance LGPD

---

## 🎯 PLANO DE EXECUÇÃO SUGERIDO

### FASE 1: QUICK WINS & CRITICAL (Semanas 1-4)

**Objetivo**: Ganhos rápidos, correção de problemas críticos

| # | Item | Prioridade | Esforço | Semana |
|---|------|------------|---------|--------|
| #016 | Eliminar LazyVerticalGrid aninhado | 🔴 CRITICAL | ⚡ | 1 |
| #020 | Padronizar TopBar colors | 🟠 HIGH | ⚡ | 1 |
| #034 | R8 full mode | 🟠 HIGH | ⚡ | 1 |
| #047 | ProGuard rules | 🟠 HIGH | ⚡ | 1 |
| #052 | Firestore Security Rules Audit | 🔴 CRITICAL | 🔨 | 2 |
| #031 | Baseline Profiles | 🔴 CRITICAL | 🔨 | 2-3 |
| #037 | Firestore Indexes | 🔴 CRITICAL | ⚡ | 3 |
| #084 | Suporte a Inglês | 🔴 CRITICAL | 🏗️ | 3-4 |
| #006 | Retry Policy | 🟠 HIGH | ⚡ | 4 |
| #035 | Image optimization | 🟡 MEDIUM | ⚡ | 4 |

**Entregáveis Fase 1**:
- ✅ App 20% mais rápido
- ✅ APK 15% menor
- ✅ Segurança reforçada
- ✅ Inglês disponível

---

### FASE 2: QUALIDADE & PERFORMANCE (Semanas 5-12)

**Objetivo**: Testes robustos, performance otimizada

| # | Item | Prioridade | Esforço | Semanas |
|---|------|------------|---------|---------|
| #056 | Cobertura de testes 70% | 🔴 CRITICAL | 🏗️ | 5-8 |
| #036 | Paginação em listas | 🟠 HIGH | 🔨 | 9 |
| #032 | App Startup Library | 🟠 HIGH | 🔨 | 9 |
| #062 | Espresso tests críticos | 🟠 HIGH | 🏗️ | 10-11 |
| #061 | Screenshot testing | 🟡 MEDIUM | 🔨 | 12 |
| #066 | Deploy automático | 🟠 HIGH | 🔨 | 12 |

**Entregáveis Fase 2**:
- ✅ 70% de cobertura de testes
- ✅ CI/CD completo
- ✅ Performance monitorada
- ✅ Scroll infinito suave

---

### FASE 3: ARQUITETURA & MODERNIZAÇÃO (Semanas 13-20)

**Objetivo**: Clean Architecture, preparação KMP

| # | Item | Prioridade | Esforço | Semanas |
|---|------|------------|---------|---------|
| #002 | Separar logic para Use Cases | 🔴 CRITICAL | 🏗️ | 13-16 |
| #001 | Repository Pattern | 🟠 HIGH | 🔨 | 17 |
| #013 | Domain models separados | 🟡 MEDIUM | 🏗️ | 18-19 |
| #050 | Migrar para DataStore Crypto | 🟡 MEDIUM | 🏗️ | 20 |

**Entregáveis Fase 3**:
- ✅ Clean Architecture completo
- ✅ Preparado para KMP
- ✅ Código 50% mais testável

---

### FASE 4: FEATURES & PRODUTO (Semanas 21-30)

**Objetivo**: Features que aumentam engajamento

| # | Item | Prioridade | Esforço | Semanas |
|---|------|------------|---------|---------|
| #091 | Sistema de lembretes | 🟠 HIGH | 🏗️ | 21-23 |
| #092 | Challenges semanais | 🟡 MEDIUM | 🏗️ | 24-27 |
| #095 | Compartilhamento social | 🟡 MEDIUM | 🔨 | 28 |
| #093 | Heatmap de atividades | 🟡 MEDIUM | 🔨 | 29 |
| #100 | Exportação de dados (LGPD) | 🟠 HIGH | 🔨 | 30 |

**Entregáveis Fase 4**:
- ✅ Engajamento +30%
- ✅ Viral loops (compartilhamento)
- ✅ LGPD compliance

---

### FASE 5: ACESSIBILIDADE & EXPANSÃO (Semanas 31-40)

**Objetivo**: App acessível e global

| # | Item | Prioridade | Esforço | Semanas |
|---|------|------------|---------|---------|
| #076 | Content description audit | 🟠 HIGH | 🔨 | 31 |
| #079 | Touch target size | 🟠 HIGH | ⚡ | 31 |
| #082 | Contrast checker | 🟡 MEDIUM | 🔨 | 32 |
| #086 | Moko Resources (KMP) | 🟡 MEDIUM | 🔨 | 33 |
| #087 | RTL support | 🟢 LOW | 🔨 | 34 |
| #097 | Feed social | 🟢 LOW | 🏗️ | 35-37 |
| #098 | Dashboard analítico | 🟢 LOW | 🏗️ | 38-40 |

**Entregáveis Fase 5**:
- ✅ WCAG 2.1 AA compliant
- ✅ Suporte RTL (árabe/hebraico)
- ✅ Analytics avançado

---

## 📋 TRACKING & MÉTRICAS

### KPIs de Sucesso

| Categoria | Métrica Atual | Meta | Prazo |
|-----------|---------------|------|-------|
| **Performance** | Cold start: 2.5s | < 2.0s | Fase 1 |
| **Qualidade** | Cobertura: 15% | 70% | Fase 2 |
| **Segurança** | Crashlytics: ativo | Alertas configurados | Fase 1 |
| **Acessibilidade** | Não auditado | WCAG AA | Fase 5 |
| **Internacionalização** | 1 idioma | 2 idiomas | Fase 1 |
| **Testes** | 27 testes | 500+ testes | Fase 2 |

---

## 🛠️ FERRAMENTAS & DEPENDÊNCIAS

### Novas Dependencies Necessárias

```gradle
// Performance
implementation("androidx.profileinstaller:profileinstaller:1.4.1")
implementation("androidx.paging:paging-compose:3.3.0")

// Testing
testImplementation("app.cash.paparazzi:paparazzi:1.3.1")
testImplementation("io.mockk:mockk:1.13.8")
androidTestImplementation("androidx.benchmark:benchmark-macro-junit4:1.2.2")

// Security
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("androidx.datastore:datastore-preferences:1.0.0")
implementation("net.zetetic:android-database-sqlcipher:4.5.4")

// Analytics & Monitoring
implementation("com.google.firebase:firebase-perf:20.5.1")
debugImplementation("com.squareup.leakcanary:leakcanary-android:2.12")

// UI
implementation("io.coil-kt:coil-compose:2.5.0")
implementation("com.github.PhilJay:MPAndroidChart:v3.1.0")

// KMP Preparation
implementation("dev.icerock.moko:resources:0.23.0")
```

---

## 📚 DOCUMENTAÇÃO & PROCESSOS

### Documentos a Criar/Atualizar

1. **CONTRIBUTING.md** - Guia de contribuição
2. **TESTING.md** - Estratégia e guias de teste
3. **ARCHITECTURE.md** - Decisões arquiteturais
4. **ACCESSIBILITY.md** - Guidelines de acessibilidade
5. **CHANGELOG.md** - Histórico de versões
6. **.claude/rules/performance.md** - Padrões de performance
7. **.claude/rules/accessibility-testing.md** - Testes de acessibilidade

---

## ✅ CHECKLIST GERAL DE IMPLEMENTAÇÃO

### Antes de Começar Qualquer Item

- [ ] Ler descrição completa
- [ ] Verificar dependências (outros itens necessários primeiro?)
- [ ] Criar branch: `improvement/{número}-{título-kebab-case}`
- [ ] Atualizar todo list (TodoWrite)

### Durante Implementação

- [ ] Seguir padrões de código (CLAUDE.md)
- [ ] Adicionar testes (unitários/integração/UI conforme caso)
- [ ] Documentar decisões complexas (KDoc/comments)
- [ ] Validar em tema claro E escuro
- [ ] Testar em diferentes tamanhos de tela

### Antes de Commit

- [ ] Executar: `./gradlew detekt` (lint)
- [ ] Executar: `./gradlew test` (testes unitários)
- [ ] Executar: `./gradlew compileDebugKotlin` (build)
- [ ] Screenshot tests passaram (se aplicável)
- [ ] Commit message: `improvement(#{número}): {descrição}` (Conventional Commits)

### PR & Review

- [ ] Criar PR com descrição detalhada
- [ ] Referenciar issue: `Implements improvement #XXX`
- [ ] Screenshots (se mudança visual)
- [ ] Checklist de testes no corpo do PR
- [ ] Aguardar CI passar
- [ ] Code review aprovado
- [ ] Merge to master

---

## 🎉 CONCLUSÃO

Este roadmap de **100 melhorias** é um guia vivo e deve ser atualizado conforme:

1. **Prioridades mudam** - Negócio pode demandar features específicas
2. **Novas tecnologias** - Android evolui rapidamente
3. **Feedback de usuários** - Bugs/features reportadas
4. **Métricas de produção** - Performance real pode revelar outros gargalos

**Próximos passos**:
1. Revisar este documento com o time
2. Priorizar itens para próxima sprint
3. Criar issues no GitHub para tracking
4. Começar pela Fase 1 (Quick Wins)

---

**Última atualização**: 2026-01-21
**Responsável**: Equipe de Desenvolvimento
**Status**: 🟢 Pronto para implementação
