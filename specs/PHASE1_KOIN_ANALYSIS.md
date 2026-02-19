# Fase 1: Análise para Migração Hilt → Koin

## Sumário

| Item | Total |
|------|-------|
| Módulos Hilt | 12 |
| ViewModels com `@HiltViewModel` | 43 |
| Chamadas `hiltViewModel()` no NavGraph | 34 (AppNavGraph.kt) |
| Chamadas `hiltViewModel()` em telas/componentes | 21 (fora do NavGraph) |
| Activities com `@AndroidEntryPoint` | 4 (Login, Register, Main, Splash) |
| Activities com `@HiltAndroidApp` | 1 (FutebaApplication) |
| Services com `@AndroidEntryPoint` | 1 (FcmService) |

---

## Módulos Hilt Existentes e Equivalentes Koin

| Arquivo | Tipo Hilt | Escopo | Koin Equivalente | Complexidade |
|---------|-----------|--------|-----------------|--------------|
| `FirebaseModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Baixa |
| `DatabaseModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton + non-singleton DAOs | `module { single { ... }; factory { ... } }` | Baixa |
| `NetworkModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Baixa |
| `RepositoryModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Média |
| `AppModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Média |
| `UseCaseModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Baixa |
| `CacheModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Baixa |
| `DataStoreModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Baixa |
| `DispatchersModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton + Qualifiers | `module { single(named("io")) { Dispatchers.IO } }` | **Alta** — Hilt `@Qualifier` vira `named()` em Koin |
| `ImageModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Baixa |
| `ThemeModule.kt` | `@Module @InstallIn(SingletonComponent)` abstract `@Binds` | Singleton | `module { single<ThemeRepository> { ThemeRepositoryImpl(get()) } }` | Baixa — `@Binds` não existe em Koin, usa `single<Interface>` |
| `UtilModule.kt` | `@Module @InstallIn(SingletonComponent)` | Singleton | `module { single { ... } }` | Baixa |

---

## Dependências a Adicionar (`app/build.gradle.kts`)

```kotlin
// Koin para Android + Compose + ViewModel
val koinVersion = "4.1.1" // Última versão estável (Fev 2025)
implementation("io.insert-koin:koin-core:$koinVersion")
implementation("io.insert-koin:koin-android:$koinVersion")
implementation("io.insert-koin:koin-compose:$koinVersion")
implementation("io.insert-koin:koin-compose-viewmodel:$koinVersion")
implementation("io.insert-koin:koin-compose-viewmodel-navigation:$koinVersion")

// Koin WorkManager (substituto do HiltWorkerFactory)
implementation("io.insert-koin:koin-androidx-workmanager:$koinVersion")

// Koin para testes
testImplementation("io.insert-koin:koin-test:$koinVersion")
testImplementation("io.insert-koin:koin-test-junit4:$koinVersion")
androidTestImplementation("io.insert-koin:koin-test:$koinVersion")
androidTestImplementation("io.insert-koin:koin-test-junit4:$koinVersion")
```

---

## Dependências a Remover (`app/build.gradle.kts`)

```kotlin
// REMOVER — Hilt DI
implementation("com.google.dagger:hilt-android:2.59")
ksp("com.google.dagger:hilt-compiler:2.59")
implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

// REMOVER — Hilt WorkManager
implementation("androidx.hilt:hilt-work:1.2.0")
ksp("androidx.hilt:hilt-compiler:1.2.0")

// REMOVER — Hilt Testing
testImplementation("com.google.dagger:hilt-android-testing:2.59")
kspTest("com.google.dagger:hilt-compiler:2.59")
androidTestImplementation("com.google.dagger:hilt-android-testing:2.59")
kspAndroidTest("com.google.dagger:hilt-compiler:2.59")
```

Também remover do `plugins {}`:
```kotlin
// REMOVER
id("com.google.dagger.hilt.android")
```

---

## Lista de ViewModels para Converter (43 total)

### Root/Navigation ViewModels (no NavGraph)
1. `HomeViewModel` — `ui/home/HomeViewModel.kt`
2. `GamesViewModel` — `ui/games/GamesViewModel.kt`
3. `PlayersViewModel` — `ui/players/PlayersViewModel.kt`
4. `LeagueViewModel` — `ui/league/LeagueViewModel.kt`
5. `ProfileViewModel` — `ui/profile/ProfileViewModel.kt`
6. `StatisticsViewModel` — `ui/statistics/StatisticsViewModel.kt`
7. `RankingViewModel` — `ui/statistics/RankingViewModel.kt` (usado em Ranking + Evolution)
8. `BadgesViewModel` — `ui/badges/BadgesViewModel.kt`
9. `GameDetailViewModel` — `ui/games/GameDetailViewModel.kt`
10. `CreateGameViewModel` — `ui/games/CreateGameViewModel.kt`
11. `LiveGameViewModel` — `ui/livegame/LiveGameViewModel.kt`
12. `LiveStatsViewModel` — `ui/livegame/LiveStatsViewModel.kt`
13. `LiveEventsViewModel` — `ui/livegame/LiveEventsViewModel.kt`
14. `MVPVoteViewModel` — `ui/game_experience/MVPVoteViewModel.kt`
15. `GroupsViewModel` — `ui/groups/GroupsViewModel.kt` (usado em Groups + CreateGroup)
16. `GroupDetailViewModel` — `ui/groups/GroupDetailViewModel.kt`
17. `InviteViewModel` — `ui/groups/InviteViewModel.kt`
18. `CashboxViewModel` — `ui/groups/CashboxViewModel.kt`
19. `LocationsMapViewModel` — `ui/locations/LocationsMapViewModel.kt`
20. `LocationDetailViewModel` — `ui/locations/LocationDetailViewModel.kt`
21. `ManageLocationsViewModel` — `ui/locations/ManageLocationsViewModel.kt`
22. `FieldOwnerDashboardViewModel` — `ui/locations/FieldOwnerDashboardViewModel.kt`
23. `PreferencesViewModel` — `ui/preferences/PreferencesViewModel.kt`
24. `ThemeViewModel` — `ui/theme/ThemeViewModel.kt`
25. `DeveloperViewModel` — `ui/developer/DeveloperViewModel.kt`
26. `SettingsViewModel` — `ui/settings/SettingsViewModel.kt`
27. `SchedulesViewModel` — `ui/schedules/SchedulesViewModel.kt`
28. `NotificationsViewModel` — `ui/notifications/NotificationsViewModel.kt`
29. `UserManagementViewModel` — `ui/admin/UserManagementViewModel.kt`

### ViewModels fora do NavGraph (usados em telas/componentes)
30. `LoginViewModel` — `ui/auth/LoginViewModel.kt`
31. `RegisterViewModel` — `ui/auth/RegisterViewModel.kt`
32. `VoteResultViewModel` — `ui/game_experience/VoteResultViewModel.kt`
33. `TeamFormationViewModel` — `ui/games/teamformation/TeamFormationViewModel.kt`
34. `LocationSelectionViewModel` — `ui/games/LocationFieldDialogs.kt`
35. `FieldSelectionViewModel` — `ui/games/LocationFieldDialogs.kt`
36. `LocationSelectorViewModel` — `ui/games/LocationSelectorViewModel.kt`
37. `GameSummonViewModel` — `ui/groups/GameSummonViewModel.kt`
38. `GlobalSearchViewModel` — `ui/search/GlobalSearchViewModel.kt`
39. `PlayerCardViewModel` — `ui/player/PlayerCardViewModel.kt`
40. `PaymentViewModel` — `ui/payments/PaymentViewModel.kt`
41. `VoteResultViewModel` — `ui/game_experience/VoteResultViewModel.kt`
42. `BaseViewModel` (abstract) — `ui/base/BaseViewModel.kt` (não converte, base class)
43. `RankingPagingViewModel` (abstract) — `ui/components/design/PaginatedRankingList.kt` (não converte, base class)

---

## Mudanças de API: Hilt → Koin

### 1. Application

```kotlin
// ANTES (Hilt)
@HiltAndroidApp
class FutebaApplication : Application(), Configuration.Provider {
    @Inject lateinit var workerFactory: HiltWorkerFactory
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()
}

// DEPOIS (Koin)
class FutebaApplication : Application(), Configuration.Provider {
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(KoinWorkerFactory()).build()

    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidLogger()
            androidContext(this@FutebaApplication)
            workManagerFactory() // koin-androidx-workmanager
            modules(allModules)
        }
    }
}
```

### 2. Activities / Services

```kotlin
// ANTES
@AndroidEntryPoint
class MainActivityCompose : ComponentActivity() { ... }

// DEPOIS — sem anotações! Koin injeta via KoinComponent ou diretamente
class MainActivityCompose : ComponentActivity() { ... }
```

### 3. ViewModels

```kotlin
// ANTES (Hilt)
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repo: GameRepository
) : ViewModel()

// DEPOIS (Koin) — remover @HiltViewModel e @Inject
class HomeViewModel(
    private val repo: GameRepository
) : ViewModel()

// No módulo Koin:
val viewModelModule = module {
    viewModel { HomeViewModel(get()) }
}
```

### 4. Inject em Compose (NavGraph)

```kotlin
// ANTES
import androidx.hilt.navigation.compose.hiltViewModel
val viewModel: HomeViewModel = hiltViewModel()

// DEPOIS
import org.koin.compose.viewmodel.koinViewModel
val viewModel: HomeViewModel = koinViewModel()
```

### 5. Qualifiers de Dispatchers

```kotlin
// ANTES (Hilt) — anotações customizadas
@IoDispatcher
fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

// Injeção no ViewModel:
class MyViewModel @Inject constructor(
    @IoDispatcher private val dispatcher: CoroutineDispatcher
)

// DEPOIS (Koin) — named qualifiers
val dispatchersModule = module {
    single(named("io")) { Dispatchers.IO }
    single(named("default")) { Dispatchers.Default }
    single(named("main")) { Dispatchers.Main }
    single(named("unconfined")) { Dispatchers.Unconfined }
}

// Injeção no ViewModel:
class MyViewModel(
    private val dispatcher: CoroutineDispatcher = get(named("io"))
) : ViewModel()
```

### 6. Shared ViewModel entre telas (ex: ProfileViewModel entre Profile e EditProfile)

```kotlin
// ANTES (Hilt)
val parentEntry = remember { navController.getBackStackEntry(Screen.Profile.route) }
val viewModel: ProfileViewModel = hiltViewModel(parentEntry)

// DEPOIS (Koin)
val viewModel: ProfileViewModel = koinViewModel(
    viewModelStoreOwner = remember {
        navController.getBackStackEntry(Screen.Profile.route)
    }
)
```

### 7. @Binds (ThemeModule)

```kotlin
// ANTES (Hilt — abstract class com @Binds)
@Module
@InstallIn(SingletonComponent::class)
abstract class ThemeModule {
    @Binds @Singleton
    abstract fun bindThemeRepository(impl: ThemeRepositoryImpl): ThemeRepository
}

// DEPOIS (Koin — objeto direto)
val themeModule = module {
    single<ThemeRepository> { ThemeRepositoryImpl(get()) }
}
```

### 8. WorkManager com Workers

```kotlin
// ANTES — HiltWorker + HiltWorkerFactory
@HiltWorker
class CacheCleanupWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val repo: GameRepository
) : CoroutineWorker(context, workerParams)

// DEPOIS — KoinWorker
class CacheCleanupWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams), KoinComponent {
    private val repo: GameRepository by inject()
}
```

---

## Verificação de Módulos em Teste

```kotlin
// Adicionar nos testes para verificar todos os módulos:
class KoinModuleTest : KoinTest {
    @Test
    fun verifyKoinModules() {
        koin {
            modules(allModules)
        }.checkModules()
    }
}
```

---

## Versão Koin Recomendada

- **Versão estável**: `4.1.1` (lançada Fev 2025)
- **Compatibilidade confirmada**:
  - Kotlin 2.1.21 (projeto usa 2.2.10 — compatível, pois Koin 4.1.1 exige Kotlin 2.1+)
  - Compose Multiplatform 1.8.2 (projeto usa 1.7.3 — totalmente compatível)
  - AndroidX Lifecycle 2.9.3 (compatível com lifecycle 2.8+ do projeto)
  - WorkManager 2.10.3 (compatível)
- **wasmJs**: Koin 4.1.1 tem suporte a wasmJs (resolvido issue de UUID em WASM)
- **NÃO usar**: Koin 4.2.x (ainda em beta/RC — requer Kotlin 2.3+ e Compose 1.10+)

---

## Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Koin não tem compile-time safety (erros só em runtime) | Alta | Usar `checkModules()` em testes unitários; CI valida antes do merge |
| `@IoDispatcher` qualifier precisa de renomeação manual (43 ViewModels) | Alta | Busca global por `@IoDispatcher`, `@DefaultDispatcher`, etc. com regex |
| HiltWorkerFactory → KoinWorkerFactory: Workers precisam de refactor | Média | `CacheCleanupWorker` é o único Worker — refactor cirúrgico |
| FcmService com `@AndroidEntryPoint`: mudança de padrão | Média | FcmService vira `KoinComponent` com `by inject()` |
| Shared ViewModel (Profile ↔ EditProfile, Profile ↔ LevelJourney) | Média | API `koinViewModel(viewModelStoreOwner=...)` mantém comportamento |
| Testes Hilt (`HiltAndroidTest`, `@HiltAndroidRule`) precisam de reescrita | Alta | Substituir por `KoinTestRule` do `koin-test-junit4` |
| ViewModel em `LocationFieldDialogs.kt` (2 VMs em um arquivo) | Baixa | Extrair para arquivos dedicados antes da migração |

---

## Estratégia de Migração Recomendada (Fase 1)

### Ordem de execução:

1. **Adicionar dependências Koin** (sem remover Hilt ainda — coexistência temporária)
2. **Criar módulos Koin** paralelos em `di/koin/` (sem deletar `di/*.kt`)
3. **Inicializar Koin no Application** (junto ao Hilt temporariamente — válido durante migração)
4. **Migrar ViewModels por tela** (remover `@HiltViewModel`/`@Inject`, adicionar `viewModel { }`)
5. **Migrar NavGraph**: `hiltViewModel()` → `koinViewModel()`
6. **Migrar Activities**: remover `@AndroidEntryPoint`
7. **Migrar Workers**: `HiltWorker` → `KoinComponent`
8. **Migrar Services**: `FcmService` → `KoinComponent`
9. **Migrar testes**: `HiltAndroidTest` → `KoinTestRule`
10. **Remover Hilt**: deletar deps, plugins, anotações, módulos antigos
11. **Validar**: `./gradlew :app:testDebugUnitTest` + `checkModules()`

### Estimativa de escopo:
- **43 ViewModels** × ~5min = ~3.5h de conversões mecânicas
- **12 módulos** → **12 arquivos Koin** = ~2h
- **NavGraph** (34 chamadas): find/replace = ~30min
- **WorkManager + FcmService + Application** = ~1h
- **Testes** = ~2h
- **Total estimado**: ~10h de trabalho

---

## Arquivos de Configuração a Atualizar

| Arquivo | Mudança |
|---------|---------|
| `app/build.gradle.kts` | Trocar deps Hilt por Koin |
| `settings.gradle.kts` | Remover plugin Hilt se registrado |
| `FutebaApplication.kt` | `@HiltAndroidApp` → `startKoin { }` |
| `MainActivityCompose.kt` | Remover `@AndroidEntryPoint` |
| `LoginActivityCompose.kt` | Remover `@AndroidEntryPoint` |
| `RegisterActivityCompose.kt` | Remover `@AndroidEntryPoint` |
| `SplashActivityCompose.kt` | Remover `@AndroidEntryPoint` |
| `FcmService.kt` | `@AndroidEntryPoint` → `KoinComponent` |
| `CacheCleanupWorker.kt` | `@HiltWorker` → `KoinComponent` |
| `AppNavGraph.kt` | 34× `hiltViewModel()` → `koinViewModel()` |
| `di/*.kt` (12 arquivos) | Converter para módulos Koin |
