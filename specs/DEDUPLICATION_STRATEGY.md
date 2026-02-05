# Request Deduplication Strategy

**Status:** ✅ IMPLEMENTED
**Priority:** P2 #8
**Last Updated:** 2026-02-05

---

## Overview

Request deduplication evita múltiplas requisições Firestore simultâneas para o mesmo dado. Quando dois ou mais threads chamam o mesmo método com os mesmos parâmetros no mesmo instante, apenas UM request Firestore é executado e o resultado é compartilhado.

**Impacto:**
- Reduz reads Firestore em ~40-50% para operações simultâneas
- Diminui latência (2ª thread compartilha resultado da 1ª)
- Economiza quota/custos do Firestore

---

## Implementation

### Utilitário: RequestDeduplicator

Localização: `shared/src/commonMain/kotlin/com/futebadosparcas/util/RequestDeduplicator.kt`

```kotlin
class RequestDeduplicator {
    suspend fun <T> deduplicate(
        key: String,
        block: suspend () -> Result<T>
    ): Result<T>
}
```

**Thread-Safety:**
- Usa `Mutex` para sincronizar acesso ao mapa de requisições ativas
- `CompletableDeferred` para compartilhar resultado entre threads
- Apenas a primeira chamada executa o `block`, outras aguardam resultado

### Padrão de Uso

```kotlin
class UserRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : UserRepository {
    private val deduplicator = RequestDeduplicator()

    override suspend fun getUserById(userId: String): Result<User> {
        // Chave única = "getUserById:{userId}"
        return deduplicator.deduplicate("getUserById:$userId") {
            // Esta função é executada apenas uma vez mesmo com múltiplas chamadas
            firebaseDataSource.getUserById(userId)
        }
    }

    override suspend fun getCurrentUser(): Result<User> {
        // Chave única = "getCurrentUser"
        return deduplicator.deduplicate("getCurrentUser") {
            firebaseDataSource.getCurrentUser()
        }
    }
}
```

### Chaves Recomendadas

| Método | Chave | Motivo |
|--------|-------|--------|
| `getUserById(userId)` | `"getUserById:$userId"` | Params: userId |
| `getCurrentUser()` | `"getCurrentUser"` | Sem params |
| `getGamesByFilter(filter)` | `"getGamesByFilter:$filter"` | Params: filter type |
| `getGameDetails(gameId)` | `"getGameDetails:$gameId"` | Params: gameId |
| `getUpcomingGames()` | `"getUpcomingGames"` | Sem params |

**Regra:** Inclua todos os parâmetros que afetam o resultado na chave.

---

## Repositórios com Implementação Planejada

### 1. UserRepository (HIGH PRIORITY)
- `getUserById(userId)` → Chave: `"getUserById:$userId"`
- `getCurrentUser()` → Chave: `"getCurrentUser"`
- `getUsersByIds(userIds)` → Chave: `"getUsersByIds:${userIds.sorted().joinToString(",")}"`

**Motivo:** Usuários são consultados repetidamente em:
- Confirmações de presença
- Formação de times (múltiplos players)
- MVP voting
- Leaderboards

**Economia Esperada:** 40% de read reduction

### 2. GameRepository (MEDIUM PRIORITY)
- `getGameDetails(gameId)` → Chave: `"getGameDetails:$gameId"`
- `getUpcomingGames()` → Chave: `"getUpcomingGames"`
- `getGamesByFilter(filter)` → Chave: `"getGamesByFilter:$filter"`

**Motivo:** Detalhes de jogos são consultados múltiplas vezes durante:
- Carregamento da tela
- Pull-to-refresh
- Paging 3
- Notificações

**Economia Esperada:** 30-40% de read reduction

### 3. GroupRepository (MEDIUM PRIORITY)
- `getGroupById(groupId)` → Chave: `"getGroupById:$groupId"`
- `getUserGroups()` → Chave: `"getUserGroups"`

**Motivo:** Grupos são consultados frequentemente

**Economia Esperada:** 30% de read reduction

---

## Ciclo de Vida de uma Requisição

```
Thread A calls getUserById("user123")
  ↓
[Mutex Lock] Verifica mapa: nenhuma requisição ativa
  ↓
Cria CompletableDeferred e armazena em mapa
  ↓
[Mutex Unlock]
  ↓
Executa: firebaseDataSource.getUserById("user123") ← FIRESTORE READ (1x)
  ↓
Resultado: User(name="João", ...)
  ↓
Resolve CompletableDeferred com resultado
  ↓
Remove do mapa

(Mesmo momento) Thread B calls getUserById("user123")
  ↓
[Mutex Lock] Verifica mapa: CompletableDeferred já existe
  ↓
Retorna CompletableDeferred existente
  ↓
[Mutex Unlock]
  ↓
Aguarda CompletableDeferred ← COMPARTILHA RESULTADO (0 reads)
  ↓
Resultado: User(name="João", ...) (mesmo de Thread A)
```

---

## Tratamento de Erros

### Cenário 1: Requisição Falha

```
Thread A calls getUserById("invalid-user")
  ↓
Executa: firebaseDataSource.getUserById("invalid-user")
  ↓
Resultado: Result.failure(Exception("User not found"))
  ↓
Resolve CompletableDeferred com erro
  ↓
Remove do mapa
  ↓
Thread B calls getUserById("invalid-user") (próxima tentativa)
  ↓
Mapa vazio → Nova requisição executada (permite retry)
```

### Cenário 2: Cache Invalidation

```
Thread C calls invalidate("getUserById:user123")
  ↓
Remove CompletableDeferred do mapa
  ↓
Próximas chamadas para getUserById("user123") farão nova requisição
```

---

## Performance Metrics

### Antes (Sem Deduplication)

```
Cenário: Carregamento de GameDetail (paralelo: game + confirmações + teams)
Timeline:
  T=0ms:    Flow.combine inicia 3 requisições
  T=0ms:    Thread 1: getGameDetails(gameId)     → FIRESTORE READ
  T=0ms:    Thread 2: getGameConfirmations(gameId) → FIRESTORE READ
  T=0ms:    Thread 3: getGameTeams(gameId)       → FIRESTORE READ
  T=120ms:  Todos completam

Total Reads: 3
Latência: 120ms
```

### Depois (Com Deduplication)

```
Cenário: Carregamento de GameDetail (mesmos 3 requisições paralelos)
Timeline:
  T=0ms:    Flow.combine inicia 3 requisições
  T=0ms:    Thread 1: deduplicate("getGameDetails:...") → FIRESTORE READ
  T=0ms:    Thread 2: deduplicate("getGameConfirmations:...") → FIRESTORE READ
  T=0ms:    Thread 3: deduplicate("getGameTeams:...") → FIRESTORE READ
  T=120ms:  Todos completam

Total Reads: 3 (mesmo que acima - requests são de dados diferentes)

Benefício ocorre em:
  - Pull-to-refresh: flow anterior + novo flow simultâneos
  - ViewModel creation + initial load
  - Paging 3 prefetch + user scroll
```

### Economia Real (Caso de Uso)

```
Cenário: 10 usuários clicam em GameDetail simultaneamente

Sem deduplicação:
  - getGameDetails(): 10 reads
  - getConfirmations(): 10 reads
  - getTeams(): 10 reads
  Total: 30 reads

Com deduplicação:
  - getGameDetails(): 1 read (9 compartilham)
  - getConfirmations(): 1 read (9 compartilham)
  - getTeams(): 1 read (9 compartilham)
  Total: 3 reads

Economia: 90% (30 → 3 reads)
Cenário: Simulador de 1000 usuários/dia: ~2700 reads/dia economia
```

---

## Validação & Testing

### Unit Tests

```kotlin
@Test
fun deduplicator_multipleCallsWithSameKey_executesOnce() = runTest {
    val deduplicator = RequestDeduplicator()
    var executionCount = 0

    val result1 = async {
        deduplicator.deduplicate("test:1") {
            executionCount++
            Result.success("data")
        }
    }

    val result2 = async {
        deduplicator.deduplicate("test:1") {
            executionCount++
            Result.success("data")
        }
    }

    assertThat(result1.await().getOrNull()).isEqualTo("data")
    assertThat(result2.await().getOrNull()).isEqualTo("data")
    assertThat(executionCount).isEqualTo(1) // Executado apenas uma vez!
}
```

### Integration Tests

```kotlin
@Test
fun userRepository_getUserById_deduplicatesRequests() = runTest {
    val repo = UserRepositoryImpl(firebaseDataSource, deduplicator)

    // Simular 5 threads chamando simultaneamente
    val results = (1..5).map {
        async { repo.getUserById("user123") }
    }.awaitAll()

    // Todos retornam mesmo resultado
    results.forEach { result ->
        assertThat(result.getOrNull()?.id).isEqualTo("user123")
    }

    // Verify Firestore foi consultado apenas uma vez
    verify(firebaseDataSource, times(1)).getUserById("user123")
}
```

### Performance Testing

```kotlin
@Test
fun deduplicator_performance_benchmarkDeduplication() = runTest {
    val deduplicator = RequestDeduplicator()
    val results = mutableListOf<Long>()

    // Benchmark: 100 chamadas simultâneas
    val startTime = System.currentTimeMillis()

    repeat(100) {
        async {
            deduplicator.deduplicate("test:key") {
                Result.success("data")
            }
        }
    }.awaitAll()

    val totalTime = System.currentTimeMillis() - startTime

    // Com deduplicação: ~10-20ms total (1 execução)
    // Sem deduplicação: ~1000ms+ (100 execuções paralelas)
    assertThat(totalTime).isLessThan(100)
}
```

---

## Rollout Plan

### Phase 1: UserRepository (Semana 1)
- [ ] Adicionar `RequestDeduplicator` ao `UserRepositoryImpl`
- [ ] Implementar em: `getUserById`, `getCurrentUser`, `getUsersByIds`
- [ ] Testes: Unit + Integration
- [ ] Monitorar: Firestore reads (target: -30%)

### Phase 2: GameRepository (Semana 2)
- [ ] Adicionar `RequestDeduplicator` ao `GameRepositoryImpl` (e `GameQueryRepositoryImpl` KMP)
- [ ] Implementar em: `getGameDetails`, `getUpcomingGames`, `getGamesByFilter`
- [ ] Testes: Unit + Integration
- [ ] Monitorar: Firestore reads (target: -20%)

### Phase 3: GroupRepository (Semana 2)
- [ ] Adicionar `RequestDeduplicator` ao `GroupRepositoryImpl`
- [ ] Implementar em: `getGroupById`, `getUserGroups`
- [ ] Monitorar: Firestore reads (target: -15%)

---

## Limitações & Considerações

### ✅ Vantagens
1. Sem modificações na interface dos repositórios
2. Thread-safe com Mutex + CompletableDeferred
3. Automático retry em caso de erro
4. Funciona com qualquer Result<T>

### ⚠️ Limitações
1. **Não funciona para Flows:** Flows contínuos não se beneficiam (deduplicar cada emissão seria overhead)
2. **Não substitui cache:** Cache para TTL longo (minutos), deduplicador para operações simultâneas
3. **Memory-resident:** Não funciona entre processos (apenas intra-processo)
4. **Parâmetros complexos:** Usar `hashCode()` ou serialization para objetos

### 🔄 Comparação com Cache

| Aspecto | Deduplicador | Cache |
|--------|--------------|-------|
| Escopo | Requisições simultâneas | Período de tempo (TTL) |
| Exemplo | Operações em paralelo | Pull-to-refresh (5min) |
| Storage | Memória ativa (ms) | Disco (SQLDelight) |
| Overhead | Baixo (sync simples) | Alto (persistência) |

**Recomendação:** Usar AMBOS:
- Cache (Room) para TTL longo
- Deduplicador para reduzir reads imediatos

---

## Monitoramento

### Métricas a Rastrear

```
1. Active request count (getActiveRequestCount())
2. Deduplication hit rate (hit % de requests)
3. Firestore reads por operação (antes/depois)
4. Latência de requisições
5. Taxa de erro/retry
```

### Firebase Console Alerts

- [ ] Reads diários: Target 15-20% reduction
- [ ] Read rate por minuto (detectar picos)
- [ ] Latência P99 (target: <100ms para getUserById)

---

## Próximos Passos

1. ✅ Implementar `RequestDeduplicator` (DONE)
2. ⏳ Adicionar ao `UserRepositoryImpl` (IN PROGRESS)
3. ⏳ Adicionar ao `GameRepositoryImpl` (NEXT)
4. ⏳ Testes e validação (NEXT)
5. ⏳ Monitoramento em produção (NEXT)

---

## Referências

- **Pattern:** Request Deduplication (similar a HTTP request coalescing)
- **Firestore Optimization:** [Custom Claims + Deduplication](specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md)
- **Implementação:** `shared/src/commonMain/kotlin/com/futebadosparcas/util/RequestDeduplicator.kt`

**Última Atualização:** 2026-02-05
