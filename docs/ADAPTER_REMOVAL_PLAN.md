# Plano de Remoção de Repository Adapters

**Status:** BLOQUEADO - Aguardando Task #1 (Consolidar models no shared/commonMain)

## Contexto

Os 7 repository adapters em `app/src/main/java/com/futebadosparcas/data/repository/` foram criados para fazer a ponte entre:
- **Interfaces Android** (usam modelos Android em `data.model.*`)
- **Interfaces KMP** (usam modelos KMP em `domain.model.*`)

Esses adapters convertem entre os dois conjuntos de modelos, mas só podem ser removidos após a consolidação dos models no KMP.

## Adapters Identificados

### 1. ActivityRepositoryAdapter
**Arquivo:** `ActivityRepositoryAdapter.kt`
**Conversões:**
- `Activity` (Android ↔ KMP) via `ActivityMapper`

**Métodos:**
- `getRecentActivities(limit: Int): Result<List<Activity>>`
- `getRecentActivitiesFlow(limit: Int): Flow<List<Activity>>`
- `createActivity(activity: Activity): Result<Unit>`
- `getUserActivities(userId: String, limit: Int): Result<List<Activity>>`

**Interface Android:** `com.futebadosparcas.data.repository.ActivityRepository`
**Interface KMP:** `com.futebadosparcas.domain.repository.ActivityRepository`
**Implementação KMP:** `com.futebadosparcas.data.ActivityRepositoryImpl` (shared/androidMain)

**Usado por:**
- `HomeViewModel` (linha 39)

---

### 2. StatisticsRepositoryAdapter
**Arquivo:** `StatisticsRepositoryAdapter.kt`
**Conversões:**
- `UserStatistics` (KMP → Android) via `toDataModel(userId)`

**Métodos:**
- `getUserStatistics(userId: String): Result<UserStatistics>`

**Interface Android:** `com.futebadosparcas.data.repository.StatisticsRepository`
**Interface KMP:** `com.futebadosparcas.domain.repository.StatisticsRepository`
**Implementação KMP:** `com.futebadosparcas.data.StatisticsRepositoryImpl` (shared/androidMain)

---

### 3-7. GameRepositoryAdapters
**Arquivo:** `GameRepositoryAdapters.kt` (contém 5 adapters)

#### 3. GameRequestRepositoryAdapter
**Conversões:**
- `GameJoinRequest` (KMP → Android)

**Métodos:** 10 métodos relacionados a solicitações de participação em jogos

**Interface Android:** `com.futebadosparcas.data.repository.GameRequestRepository`
**Interface KMP:** `com.futebadosparcas.domain.repository.GameRequestRepository`

#### 4. GameSummonRepositoryAdapter
**Conversões:**
- `GameSummon` (KMP → Android)
- `UpcomingGame` (KMP → Android)
- `PlayerPosition` (Android → KMP)

**Métodos:** 12 métodos relacionados a convocações de jogos

**Interface Android:** `com.futebadosparcas.data.repository.GameSummonRepository`
**Interface KMP:** `com.futebadosparcas.domain.repository.GameSummonRepository`

#### 5. GameExperienceRepositoryAdapter
**Conversões:**
- `MVPVote` (Android ↔ KMP)
- `VoteCategory` (Android ↔ KMP)

**Métodos:** 6 métodos relacionados a votação MVP

**Interface Android:** `com.futebadosparcas.data.repository.GameExperienceRepository`
**Interface KMP:** `com.futebadosparcas.domain.repository.GameExperienceRepository`

#### 6. GameEventsRepositoryAdapter
**Conversões:**
- `GameEvent` (Android ↔ KMP)
- `LiveGameScore` (KMP → Android)

**Métodos:** 4 métodos relacionados a eventos de jogo

**Interface Android:** `com.futebadosparcas.data.repository.GameEventsRepository`
**Interface KMP:** `com.futebadosparcas.domain.repository.GameEventsRepository`

#### 7. GameTeamRepositoryAdapter
**Conversões:**
- `Team` (Android ↔ KMP)

**Métodos:** 5 métodos relacionados a gerenciamento de times

**Interface Android:** `com.futebadosparcas.data.repository.GameTeamRepository`
**Interface KMP:** `com.futebadosparcas.domain.repository.GameTeamRepository`

---

## Dependência Bloqueadora

Os adapters fazem conversão entre modelos duplicados:

### Modelos Android (app/data/model/)
- `Activity`
- `UserStatistics`
- `GameJoinRequest`
- `GameSummon`
- `UpcomingGame`
- `MVPVote`
- `VoteCategory`
- `GameEvent`
- `LiveGameScore`
- `Team`
- `PlayerPosition`

### Modelos KMP (shared/commonMain/domain/model/)
- `Activity`
- `UserStatistics` (nome pode variar)
- `GameJoinRequest`
- `GameSummon`
- `UpcomingGame`
- `MVPVote`
- `VoteCategory`
- `GameEvent`
- `LiveScore` (nome diferente!)
- `Team`
- `PlayerPosition`

**Ação necessária:** Task #1 deve consolidar esses modelos no `shared/commonMain` e remover as versões Android.

---

## Injeção Atual (RepositoryKoinModule.kt)

```kotlin
// Repositórios KMP (domain interfaces)
single<ActivityRepository> { ActivityRepositoryImpl(get()) }
single<StatisticsRepository> { StatisticsRepositoryImpl(get()) }
single<GameEventsRepository> { GameEventsRepositoryImpl(get()) }
single<GameExperienceRepository> { GameExperienceRepositoryImpl(get()) }
single<GameRequestRepository> { GameRequestRepositoryImpl(get(), get()) }
single<GameSummonRepository> { GameSummonRepositoryImpl(get()) }
single<GameTeamRepository> { GameTeamRepositoryImpl(get(), get()) }

// Adaptadores para UI Android (linhas 147-173)
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

## Plano de Remoção (Executar APÓS Task #1)

### Passo 1: Atualizar ViewModels
Substituir injeções de interfaces Android por interfaces KMP:

```kotlin
// ANTES
private val activityRepository: com.futebadosparcas.data.repository.ActivityRepository

// DEPOIS
private val activityRepository: com.futebadosparcas.domain.repository.ActivityRepository
```

**Arquivos a verificar:**
- `HomeViewModel.kt` (já identificado)
- Todos os ViewModels que injetam as 7 interfaces Android

**Comando de busca:**
```bash
grep -r "com.futebadosparcas.data.repository.ActivityRepository" app/src/main/java/
grep -r "com.futebadosparcas.data.repository.StatisticsRepository" app/src/main/java/
grep -r "com.futebadosparcas.data.repository.GameRequestRepository" app/src/main/java/
grep -r "com.futebadosparcas.data.repository.GameSummonRepository" app/src/main/java/
grep -r "com.futebadosparcas.data.repository.GameExperienceRepository" app/src/main/java/
grep -r "com.futebadosparcas.data.repository.GameEventsRepository" app/src/main/java/
grep -r "com.futebadosparcas.data.repository.GameTeamRepository" app/src/main/java/
```

### Passo 2: Atualizar RepositoryKoinModule.kt
Remover os 7 bindings de adapters (linhas 147-173) e os imports correspondentes (linhas 21, 23-27, 31).

```kotlin
// REMOVER estas linhas (147-173):
single<com.futebadosparcas.data.repository.ActivityRepository> {
    ActivityRepositoryAdapter(get())
}
// ... (outros 6 adapters)
```

### Passo 3: Remover interfaces Android
Deletar as 7 interfaces em `app/src/main/java/com/futebadosparcas/data/repository/`:
- `ActivityRepository.kt` (interface)
- `StatisticsRepository.kt` (interface)
- `GameRepositories.kt` (contém 5 interfaces)

**ATENÇÃO:** Manter as implementações que não são adapters:
- `GameRepositoryImpl.kt`
- `GameQueryRepositoryImpl.kt`
- `StatisticsRepositoryImpl.kt` (se for implementação real, não adapter)
- `WaitlistRepositoryImpl.kt`

### Passo 4: Remover arquivos de adapters
Deletar:
- `ActivityRepositoryAdapter.kt`
- `StatisticsRepositoryAdapter.kt`
- `GameRepositoryAdapters.kt`

### Passo 5: Remover mappers (se existirem)
Verificar se há mappers dedicados à conversão Android ↔ KMP:
- `ActivityMapper` (mencionado no adapter)
- Outros mappers relacionados

**Comando:**
```bash
find app/src/main/java -name "*Mapper.kt" -type f
```

### Passo 6: Verificar compilação
```bash
./gradlew :app:compileDebugKotlin
./gradlew :app:testDebugUnitTest
./gradlew detekt
./gradlew lint
```

---

## Checklist Final

- [ ] Task #1 completa (models consolidados no shared/commonMain)
- [ ] ViewModels atualizados para usar interfaces domain
- [ ] RepositoryKoinModule sem bindings de adapters
- [ ] Interfaces Android removidas (ActivityRepository.kt, etc)
- [ ] Arquivos de adapters deletados (3 arquivos)
- [ ] Mappers de conversão removidos (se aplicável)
- [ ] Build passando (`compileDebugKotlin`)
- [ ] Testes passando (`testDebugUnitTest`)
- [ ] Detekt sem erros
- [ ] Lint sem erros

---

## Estimativa

**Tempo:** ~2 horas após Task #1 completar
**Complexidade:** Média (muitas referências para atualizar)
**Risco:** Baixo (mudanças mecânicas e bem definidas)
