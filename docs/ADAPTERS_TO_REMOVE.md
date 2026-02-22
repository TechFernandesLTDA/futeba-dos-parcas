# Repository Adapters a Remover (após Task #1)

**Status:** ⏸️ BLOQUEADO - Aguardando Task #1 (consolidar-models)

## Lista de Adapters

### 1. ActivityRepositoryAdapter
- **Arquivo:** `app/src/main/java/com/futebadosparcas/data/repository/ActivityRepositoryAdapter.kt`
- **Conversões:** `Activity` (Android ↔ KMP) via `ActivityMapper`
- **Injeção Koin:** Linha 147-149 de `RepositoryKoinModule.kt`
- **Usado em:** `HomeViewModel` (linha 39)

### 2. StatisticsRepositoryAdapter
- **Arquivo:** `app/src/main/java/com/futebadosparcas/data/repository/StatisticsRepositoryAdapter.kt`
- **Conversões:** `UserStatistics` (KMP → Android) via `toDataModel(userId)`
- **Injeção Koin:** Linha 151-153 de `RepositoryKoinModule.kt`

### 3. GameRequestRepositoryAdapter
- **Arquivo:** `app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryAdapters.kt` (linhas 31-84)
- **Conversões:** `GameJoinRequest` (KMP → Android)
- **Injeção Koin:** Linha 155-157 de `RepositoryKoinModule.kt`

### 4. GameSummonRepositoryAdapter
- **Arquivo:** `app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryAdapters.kt` (linhas 89-152)
- **Conversões:** `GameSummon`, `UpcomingGame` (KMP → Android), `PlayerPosition` (Android → KMP)
- **Injeção Koin:** Linha 159-161 de `RepositoryKoinModule.kt`

### 5. GameExperienceRepositoryAdapter
- **Arquivo:** `app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryAdapters.kt` (linhas 157-185)
- **Conversões:** `MVPVote`, `VoteCategory` (Android ↔ KMP)
- **Injeção Koin:** Linha 163-165 de `RepositoryKoinModule.kt`

### 6. GameEventsRepositoryAdapter
- **Arquivo:** `app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryAdapters.kt` (linhas 190-211)
- **Conversões:** `GameEvent` (Android ↔ KMP), `LiveGameScore` (KMP → Android)
- **Injeção Koin:** Linha 167-169 de `RepositoryKoinModule.kt`

### 7. GameTeamRepositoryAdapter
- **Arquivo:** `app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryAdapters.kt` (linhas 216-246)
- **Conversões:** `Team` (Android ↔ KMP)
- **Injeção Koin:** Linha 171-173 de `RepositoryKoinModule.kt`

---

## Interfaces Android a Remover

Após remover adapters, deletar as interfaces Android (que usam modelos Android):

1. `app/src/main/java/com/futebadosparcas/data/repository/ActivityRepository.kt`
2. `app/src/main/java/com/futebadosparcas/data/repository/StatisticsRepository.kt`
3. `app/src/main/java/com/futebadosparcas/data/repository/GameRepositories.kt` (contém 5 interfaces)

---

## Imports a Atualizar em ViewModels

Substituir interfaces Android por interfaces KMP domain:

### Exemplo: HomeViewModel
```kotlin
// ANTES
import com.futebadosparcas.data.repository.ActivityRepository

class HomeViewModel(
    private val activityRepository: ActivityRepository
)

// DEPOIS
import com.futebadosparcas.domain.repository.ActivityRepository

class HomeViewModel(
    private val activityRepository: ActivityRepository
)
```

### Comandos para encontrar referências:
```bash
# ActivityRepository
grep -r "com.futebadosparcas.data.repository.ActivityRepository" app/src/main/java/

# StatisticsRepository
grep -r "com.futebadosparcas.data.repository.StatisticsRepository" app/src/main/java/

# GameRequestRepository
grep -r "com.futebadosparcas.data.repository.GameRequestRepository" app/src/main/java/

# GameSummonRepository
grep -r "com.futebadosparcas.data.repository.GameSummonRepository" app/src/main/java/

# GameExperienceRepository
grep -r "com.futebadosparcas.data.repository.GameExperienceRepository" app/src/main/java/

# GameEventsRepository
grep -r "com.futebadosparcas.data.repository.GameEventsRepository" app/src/main/java/

# GameTeamRepository
grep -r "com.futebadosparcas.data.repository.GameTeamRepository" app/src/main/java/
```

---

## Mudanças no RepositoryKoinModule.kt

### Remover imports (linhas 21, 23-27, 31):
```kotlin
import com.futebadosparcas.data.repository.ActivityRepositoryAdapter
import com.futebadosparcas.data.repository.GameEventsRepositoryAdapter
import com.futebadosparcas.data.repository.GameExperienceRepositoryAdapter
import com.futebadosparcas.data.repository.GameRequestRepositoryAdapter
import com.futebadosparcas.data.repository.GameSummonRepositoryAdapter
import com.futebadosparcas.data.repository.GameTeamRepositoryAdapter
import com.futebadosparcas.data.repository.StatisticsRepositoryAdapter
```

### Remover bindings de adapters (linhas 147-173):
```kotlin
// DELETAR TODO ESTE BLOCO:
// Adaptadores para compatibilidade com UI Android
single<com.futebadosparcas.data.repository.ActivityRepository> {
    ActivityRepositoryAdapter(get())
}

single<com.futebadosparcas.data.repository.StatisticsRepository> {
    StatisticsRepositoryAdapter(get())
}

single<com.futebadosparcas.data.repository.GameRequestRepository> {
    GameRequestRepositoryAdapter(get())
}

single<com.futebadosparcas.data.repository.GameSummonRepository> {
    GameSummonRepositoryAdapter(get())
}

single<com.futebadosparcas.data.repository.GameExperienceRepository> {
    GameExperienceRepositoryAdapter(get())
}

single<com.futebadosparcas.data.repository.GameEventsRepository> {
    GameEventsRepositoryAdapter(get())
}

single<com.futebadosparcas.data.repository.GameTeamRepository> {
    GameTeamRepositoryAdapter(get())
}
```

---

## Checklist de Execução (após Task #1)

- [ ] Task #1 completa (models consolidados)
- [ ] Buscar todas as referências aos 7 adapters
- [ ] Atualizar imports em ViewModels (Android → domain)
- [ ] Atualizar RepositoryKoinModule (remover bindings de adapters)
- [ ] Deletar 3 arquivos de adapters
- [ ] Deletar 3 arquivos de interfaces Android
- [ ] Verificar se há mappers a remover (ex: `ActivityMapper`)
- [ ] Build: `./gradlew :app:compileDebugKotlin`
- [ ] Testes: `./gradlew :app:testDebugUnitTest`
- [ ] Detekt: `./gradlew detekt`
- [ ] Lint: `./gradlew lint`

---

## Documentação Completa

Para plano detalhado com todos os passos, consulte: `/docs/ADAPTER_REMOVAL_PLAN.md`
