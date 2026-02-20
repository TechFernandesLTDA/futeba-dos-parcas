# Fase 2 CMP - Análise de Migração Firebase → GitLive SDK

**Data**: 2026-02-19
**Status**: IN_PROGRESS (PR #160 Fase 1 mergeado ✅, branch criada ✅)
**Branch**: `feat/cmp-phase-2-firebase` (criada 2026-02-19)

---

## Contexto

Substituir o padrão `expect/actual` do Firebase Android SDK pela GitLive Firebase Kotlin SDK 2.4.0.
Isso é necessário para que o `shared/commonMain` consiga acessar Firebase sem código Android-específico.

**Situação atual:**
```
shared/src/commonMain/  ← interface FirebaseDataSource (156 métodos)
shared/src/androidMain/ ← implementação real (5.598 linhas, Firebase Android SDK)
shared/src/iosMain/     ← stubs delegam ao Swift via IosFirebaseBridge
shared/src/wasmJsMain/  ← stubs UnsupportedOperationException
```

**Situação desejada:**
```
shared/src/commonMain/  ← FirebaseDataSource usa GitLive SDK diretamente
shared/src/androidMain/ ← inicialização Firebase (GoogleServices)
shared/src/iosMain/     ← inicialização Firebase (GoogleService-Info.plist)
shared/src/wasmJsMain/  ← inicialização Firebase (firebaseConfig JS object)
```

---

## 1. Estrutura do FirebaseDataSource

### Interface Common (671 linhas, 156 métodos)
`shared/src/commonMain/kotlin/.../platform/firebase/FirebaseDataSource.kt`

Organizada em 21 seções:

| Seção | Métodos | Tipo |
|-------|---------|------|
| Games | 10 | CRUD + Flow |
| Game Confirmations | 9 | CRUD |
| Teams | 4 | CRUD |
| Statistics | 3 | CRUD + Flow |
| Users | 10 | CRUD + batch |
| Groups (basic) | 2 | Read |
| XP Logs | 1 | Read |
| XP/Gamification | 5 | CRUD |
| Live Game | 13 | CRUD + Flow |
| Groups (advanced) | 8 | CRUD |
| Batch Operations | 1 | Write |
| Auth | 5 | State + CRUD |
| Locations | 13 | CRUD + paginated |
| Fields | 6 | CRUD + photos |
| Payments | 3 | CRUD |
| Cashbox | 10 | CRUD + queries |
| Streaks | 2 | CRUD |
| Badges | 5 | CRUD |
| Seasons | 5 | CRUD + Flow |
| Challenges | 2 | CRUD |
| Rankings | 3 | Query |
| Notifications | 12 | CRUD + batch |
| Location Audit | 2 | Write + Read |

### Implementação Android (5.598 linhas)
`shared/src/androidMain/kotlin/.../platform/firebase/FirebaseDataSource.kt`

Arquivos auxiliares:
- `CashboxFirebaseExt.kt` - operações de caixa
- `LiveGameHelpers.kt` - helpers de jogo ao vivo
- `LocationFirebaseOperations.kt` - operações de localização

---

## 2. Coleções Firestore Usadas (19 coleções)

| Coleção | Operações | Uso Principal |
|---------|-----------|---------------|
| `locations` | 26 | Gerenciamento de campos |
| `notifications` | 18 | Notificações de usuário |
| `users` | 16 | Perfis, busca |
| `fields` | 13 | Metadados de campo |
| `live_scores` | 8 | Jogo ao vivo |
| `live_player_stats` | 7 | Performance do jogador |
| `season_participation` | 6 | Rankings de liga |
| `game_events` | 6 | Log de eventos |
| `user_streaks` | 5 | Sequências |
| `user_badges` | 5 | Conquistas |
| `confirmations` | 5 | Confirmações de presença |
| `activities` | 4 | Feed de atividades |
| `seasons` | 3 | Temporadas |
| `games` | 3 | Metadados de jogo |
| `teams` | 1 | Times |
| `ranking_deltas` | 1 | Rankings periódicos |
| `challenges` | 1 | Desafios |
| `challenge_progress` | 1 | Progresso do usuário |
| `badges` | 1 | Definições de badges |

---

## 3. Top 10 Queries Mais Complexas

1. **`getLocationsPaginated()`** - Paginação cursor-based com DocumentSnapshot
2. **`getUsersByIds()`** - `whereIn` chunked (limite 10 items/query)
3. **`summonPlayers()`** - Batch update de 40-500 documentos (400 op safety margin)
4. **`getRankingByCategory()`** - Multi-field sorting com stats
5. **`deleteLocationWithFields()`** - Delete atômico em cascata (location + subcoleção)
6. **`getCashboxHistoryFiltered()`** - Date range + type filtering
7. **`getGameConfirmations()`** - Query com extração de dados aninhados
8. **`getSeasonRanking()`** - Leaderboard com limite
9. **`observeSeasonRanking()`** - Real-time leaderboard (Flow persistente)
10. **`getLivePlayerStats()`** - Real-time subcoleção query

---

## 4. Compatibilidade GitLive 2.4.0

### Módulos Disponíveis

```kotlin
// shared/build.gradle.kts
val gitLiveVersion = "2.4.0"
commonMain {
    implementation("dev.gitlive:firebase-auth:$gitLiveVersion")
    implementation("dev.gitlive:firebase-firestore:$gitLiveVersion")
    implementation("dev.gitlive:firebase-storage:$gitLiveVersion")
    implementation("dev.gitlive:firebase-functions:$gitLiveVersion")
}
```

### Matriz de Compatibilidade

| Feature | Firebase Android | GitLive 2.4.0 | Status |
|---------|------------------|---------------|--------|
| Firestore CRUD | ✅ | ✅ | 100% |
| Firestore Queries | ✅ | ✅ | 100% |
| Firestore Batch | ✅ | ✅ | Equivalente |
| Firestore Transactions | ✅ | ✅ | Equivalente |
| Real-time Listeners | ✅ | ✅ | 100% |
| Cloud Storage | ✅ | ✅ | 100% |
| Firebase Auth | ✅ | ✅ | 100% |
| Cloud Functions | ✅ | ✅ | 100% |
| FCM | ✅ | ❌ | Sem suporte KMP |
| App Check | ✅ | ⚠️ | Parcial |
| Remote Config | ✅ | ❌ | Sem suporte KMP |

### Breaking Changes API

| Área | Firebase Android SDK | GitLive KMP 2.4.0 |
|------|---------------------|-------------------|
| Serialização | Built-in toObject() | `@Serializable` + kotlinx.serialization |
| whereIn | `.whereIn("field", list)` | `.where("field").inArray(list)` |
| Batch | `firestore.batch()` | `firestore.writeBatch()` |
| Listener removal | `listener.remove()` | `subscription.unsubscribe()` |
| Timestamp | `Timestamp` | `kotlinx.datetime.Instant` |

---

## 5. O Que Fica Android-Only

### 1. Firebase Cloud Messaging (FCM)
- **Arquivo**: `app/.../service/FcmService.kt`
- **Motivo**: GitLive não tem suporte FCM KMP
- **Decisão**: Manter em `:app`, token FCM passado via `FirebaseDataSource.updateFcmToken()`

### 2. App Check
- **Arquivo**: `app/.../FutebaApplication.kt`
- **Motivo**: GitLive suporta apenas cert pinning
- **Decisão**: Manter inicialização em Android, Cloud Functions continuam enforçando

### 3. Firebase Remote Config
- **Status**: Não implementado no codebase atual
- **Decisão**: Se implementado no futuro, manter Android-only ou usar alternativa KMP

---

## 6. Riscos e Mitigações

### ALTO RISCO

| Risco | Área | Mitigação |
|-------|------|-----------|
| Batch write atomicity | 5 métodos | Testes de integração com rollback |
| Real-time Flow memory leaks | 35+ métodos | FlowHelper padronizado com cleanup |
| whereIn chunking | 2-3 métodos | Testes com 11, 20, 100+ items |
| Serialização de tipos | Todos | Testar Long/Int, Timestamp/Long, listas aninhadas |

### MÉDIO RISCO

| Risco | Área | Mitigação |
|-------|------|-----------|
| Cursor pagination | 1-2 métodos | Serialização JSON do cursor |
| Cascading deletes | 1 método | Retry logic + partial success |
| Firebase exception mapping | Todos | Wrapper em Result<T>, testar error cases |

---

## 7. Plano de Implementação

### Fases Sugeridas

#### Fase 2A: Setup + Migração Core (3-4 dias)
1. Adicionar GitLive deps em `shared/build.gradle.kts`
2. Criar `FirebaseInitializer` por plataforma (android/ios/wasmJs)
3. Migrar Auth (5 métodos simples) - validar padrão
4. Migrar CRUD básico de users (5 métodos simples)
5. Verificar compilação todos os targets

#### Fase 2B: Migração Completa Firestore (5-7 dias)
6. Migrar Games + Confirmations + Teams (23 métodos)
7. Migrar Groups + Members + Invites (10 métodos)
8. Migrar Live Game (13 métodos - incluindo real-time flows)
9. Migrar Locations + Fields (19 métodos - mais complexos)
10. Migrar Gamification (Badges, Streaks, Seasons, Challenges) (14 métodos)
11. Migrar Rankings + Statistics + Notifications (18 métodos)
12. Migrar Cashbox + Payments (13 métodos)
13. Migrar batch operations + Audit Logs (3 métodos)

#### Fase 2C: Storage + Cleanup (2-3 dias)
14. Migrar ProfilePhotoDataSource + FieldPhotoDataSource + GroupPhotoDataSource
15. Remover Firebase Android SDK de `shared/`
16. Manter Firebase Android SDK APENAS em `:app` (para FCM, AppCheck)
17. Testes finais

### Estimativa Total
- **Esforço**: 10-14 dias de desenvolvimento focado
- **Agent team**: 3 agents paralelos (auth+users, games+groups, gamification+locations)
- **Pré-requisito**: PR #160 (Fase 1 Koin) merged

---

## 8. Checklist Pré-Implementação

- [x] PR #160 (Fase 1 Koin) merged em master
- [x] Branch `feat/cmp-phase-2-firebase` criada de master atualizado
- [x] GitLive deps adicionados em `shared/build.gradle.kts` (nativeAndAndroidMain)
- [x] Build compila com GitLive deps: `shared:compileDebugKotlinAndroid` ✅
- [ ] Migrar `actual class FirebaseDataSource` de androidMain → nativeAndAndroidMain (GitLive)
- [ ] Remover `actual class` de androidMain e iosMain (consolidar em nativeAndAndroidMain)
- [ ] Atualizar Koin: `FirebaseDataSource(get(), get())` → `FirebaseDataSource()`

## 10. Mapa de API: Firebase Android SDK → GitLive 2.4.0

### Imports
```kotlin
// ANTES (androidMain)
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await

// DEPOIS (nativeAndAndroidMain)
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.firestore
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.storage.storage
```

### Construtor e Instâncias
```kotlin
// ANTES
actual class FirebaseDataSource(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
)

// DEPOIS
actual class FirebaseDataSource {
    private val firestore = Firebase.firestore
    private val auth = Firebase.auth
    private val storage = Firebase.storage
}
```

### Operações Firestore
| Firebase Android SDK | GitLive 2.4.0 |
|---------------------|---------------|
| `.get().await()` | `.get()` (suspend direto) |
| `.set(data).await()` | `.set(data)` (suspend direto) |
| `snapshot.getString("field")` | `snapshot.get<String?>("field")` |
| `snapshot.getLong("field")` | `snapshot.get<Long?>("field")` |
| `snapshot.getBoolean("field")` | `snapshot.get<Boolean?>("field")` |
| `snapshot.getDouble("field")` | `snapshot.get<Double?>("field")` |
| `snapshot.exists()` (método) | `snapshot.exists` (propriedade) |
| `firestore.batch()` | `firestore.writeBatch()` |
| `batch.commit().await()` | `batch.commit()` (suspend) |
| `FieldValue.serverTimestamp()` | `FieldValue.serverTimestamp` |
| `FieldValue.increment(n)` | `FieldValue.increment(n)` |
| `FieldValue.arrayUnion(...)` | `FieldValue.arrayUnion(...)` |
| `Query.Direction.ASCENDING` | `Direction.ASCENDING` |
| `.whereIn("field", list)` | `.where { "field" inArray list }` |
| `addSnapshotListener { s, e -> ... }` | `.snapshots()` Flow |

### Real-time Flows
```kotlin
// ANTES (callbackFlow + addSnapshotListener)
actual fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> = callbackFlow {
    val listener = firestore.collection("games")
        .limit(limit.toLong())
        .addSnapshotListener { snapshot, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            trySend(Result.success(snapshot?.documents?.mapNotNull { it.toGameOrNull() } ?: emptyList()))
        }
    awaitClose { listener.remove() }
}

// DEPOIS (GitLive snapshots Flow)
actual fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> =
    firestore.collection("games")
        .limit(limit)
        .snapshots()
        .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() }) }
        .catch { emit(Result.failure(it)) }
```

### Koin Module
```kotlin
// ANTES
single<FirebaseDataSource> {
    FirebaseDataSource(get(), get())
}

// DEPOIS
single<FirebaseDataSource> {
    FirebaseDataSource()
}
```

### Arquitetura de Sourcesets
```
commonMain/firebase/FirebaseDataSource.kt (expect class - inalterado)
nativeAndAndroidMain/firebase/FirebaseDataSource.kt (actual class - NOVO, GitLive)
wasmJsMain/firebase/FirebaseDataSource.kt (actual class - stubs, inalterado)
androidMain/firebase/FirebaseDataSource.kt (DELETAR após migração)
iosMain/firebase/FirebaseDataSource.kt (DELETAR após migração)
```

---

## 9. Arquivos a Criar/Modificar

### Modificar
- [ ] `shared/build.gradle.kts` - Adicionar GitLive deps, remover Firebase Android SDK
- [ ] `shared/src/commonMain/.../firebase/FirebaseDataSource.kt` - Usar GitLive types
- [ ] `shared/src/androidMain/.../firebase/FirebaseDataSource.kt` - Rewrite com GitLive
- [ ] `shared/src/androidMain/.../firebase/CashboxFirebaseExt.kt`
- [ ] `shared/src/androidMain/.../firebase/LiveGameHelpers.kt`
- [ ] `shared/src/androidMain/.../firebase/LocationFirebaseOperations.kt`

### Criar
- [ ] `shared/src/commonMain/.../firebase/FirebaseInitializer.kt` - expect/actual inicialização
- [ ] `shared/src/androidMain/.../firebase/FirebaseInitializerImpl.kt` - actual Android
- [ ] `shared/src/iosMain/.../firebase/FirebaseDataSource.kt` - IMPLEMENTAÇÃO REAL (não mais stub)
- [ ] `shared/src/wasmJsMain/.../firebase/FirebaseDataSource.kt` - IMPLEMENTAÇÃO REAL

### Manter Inalterados
- ✅ 16 repository implementations em `shared/src/androidMain/kotlin/.../data/`
- ✅ Domain models e interfaces
- ✅ `:app` module (FcmService, AppCheck, Koin modules)
- ✅ Cloud Functions

---

## Métricas da Migração

| Métrica | Valor |
|---------|-------|
| Métodos a migrar | 156 |
| Coleções Firestore | 19 |
| Flows real-time | 35+ |
| Batch operations | 5+ |
| Linhas de código | ~6.400 |
| Compatibilidade GitLive | 98% |
| Serviços Android-only | 3 (FCM, AppCheck, RemoteConfig) |
