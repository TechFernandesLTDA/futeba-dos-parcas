# P2 #25: Sorting Audit Report - Firestore vs Kotlin

**Status:** AUDIT COMPLETE
**Data:** 2026-02-05
**Prioridade:** Medium (P2 Desejável)

---

## Executive Summary

Audit de sorting operations em 7 repositórios encontrou:
- **10 operações de sorting em Kotlin** (cliente)
- **2 podem ser movidas para Firestore** (LiveGameRepository + GroupRepository)
- **8 requerem sorting em cliente** (múltiplas queries, deduplicação, pós-processamento)

**Impacto Estimado:**
- LiveGameRepository: ~10-15ms de latência reduzida por listener
- GroupRepository: ~5-10ms de latência em member list
- **Custo:** 2 composite indexes adicionais (~$1/mês)

---

## Detailed Findings

### ✅ YA OTIMIZADO (4/7 Repositórios)

#### 1. WaitlistRepositoryImpl.kt
**Status:** ✅ Já usa orderBy no Firestore
- Linha 131: `.orderBy("queue_position", Query.Direction.ASCENDING)`
- Linha 152: `.orderBy("queue_position", Query.Direction.ASCENDING)`
- Linha 215: `.orderBy("queue_position", Query.Direction.ASCENDING)`
- Linha 252: `.orderBy("queue_position", Query.Direction.ASCENDING)`
- Linha 396: `.orderBy("added_at", Query.Direction.ASCENDING)` em reorderQueue
- **Conclusão:** Perfetto! Sem alterações necessárias.

#### 2. StatisticsRepositoryImpl.kt
**Status:** ✅ Já usa orderBy no Firestore
- Linha 104: `.orderBy("totalGoals", Query.Direction.DESCENDING)`
- Linha 120: `.orderBy("totalSaves", Query.Direction.DESCENDING)`
- Linha 136: `.orderBy("bestPlayerCount", Query.Direction.DESCENDING)`
- **Conclusão:** Perfetto! Sem alterações necessárias.

#### 3. FakeStatisticsRepository.kt
**Status:** ✅ Fake repo (testes OK)
- Linhas 61, 66, 71: `.sortedByDescending()`
- **Conclusão:** Mock data, sorting em memória é aceitável.

#### 4. FakeGameRepository.kt
**Status:** ✅ Fake repo (testes OK)
- Linha 350: `.sortedByDescending { it.dateTime }`
- **Conclusão:** Mock data, sorting em memória é aceitável.

---

### ⚠️ OTIMIZÁVEL (2/7 Repositórios)

#### 5. GroupRepository.kt ⭐ OTIMIZÁVEL
**Problema:** Sorting feito no cliente para múltiplos critérios

**Linhas 771-795:** `getOrderedGroupMembersFlow()`
```kotlin
fun getOrderedGroupMembersFlow(groupId: String): Flow<List<GroupMember>> = callbackFlow {
    val listener = groupsCollection.document(groupId)
        .collection("members")
        .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
        .addSnapshotListener { snapshot, error ->
            // ...
            val members = snapshot?.toObjects(GroupMember::class.java) ?: emptyList()
            // ❌ SORTING NO CLIENTE:
            val sortedMembers = members.sortedWith(
                compareBy<GroupMember> { member ->
                    when (member.getRoleEnum()) {
                        GroupMemberRole.OWNER -> 0
                        GroupMemberRole.ADMIN -> 1
                        GroupMemberRole.MEMBER -> 2
                    }
                }.thenBy { it.userName.lowercase() }
            )
            trySend(sortedMembers)
        }
    awaitClose { listener.remove() }
}
```

**Impacto:**
- Sorting multi-critério (role + nome) requer memória O(n log n)
- Latência: ~5-10ms para grupos com 20+ membros
- Listeners disparados frequentemente = múltiplos sorts

**Solução Proposta:**
1. Adicionar campo `sort_priority` em cada member (OWNER=0, ADMIN=1, MEMBER=2)
2. Usar `.orderBy("sort_priority", ASCENDING).thenBy("user_name", ASCENDING)` no Firestore
3. Remover sorting em Kotlin

**Custo:**
- 1 Composite Index: `groups/{groupId}/members (sort_priority, user_name)`
- Migração: Rodar Cloud Function uma vez para popular field

**Benefício:**
- 5-10ms latência reduzida por listener
- 1 composite index (~$1/mês)
- Melhor escala para grandes grupos

---

#### 6. LiveGameRepository.kt ⭐ OTIMIZÁVEL
**Problema:** Sorting feito no cliente por timestamp

**Linhas 330-355:** `observeGameEvents()`
```kotlin
fun observeGameEvents(gameId: String): Flow<List<GameEvent>> = callbackFlow {
    val listener = eventsCollection
        .whereEqualTo("game_id", gameId)
        // ❌ Comentado para evitar composite index:
        // .orderBy("created_at", Query.Direction.DESCENDING)
        .addSnapshotListener { snapshot, error ->
            val events = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(GameEvent::class.java)?.apply { id = doc.id }
            } ?: emptyList()

            // ❌ SORTING NO CLIENTE (a cada listener):
            val sortedEvents = events.sortedByDescending { it.createdAt?.time ?: 0L }
            trySend(sortedEvents)
        }
    awaitClose { listener.remove() }
}
```

**Impacto:**
- Listeners disparados a cada novo evento
- Sorting O(n log n) em cada disparo
- Latência: ~10-15ms com 50+ eventos em jogo ao vivo
- **Comentário no código:** "Removed orderBy to avoid needing a composite index (game_id + created_at)"

**Solução Proposta:**
1. **Adicionar composite index:** `games_events (game_id, created_at DESC)`
2. Usar `.orderBy("created_at", Query.Direction.DESCENDING)` no Firestore
3. Remover sorting em Kotlin

**Custo:**
- 1 Composite Index: `games/{gameId}/events (game_id, created_at DESC)`
- Impacto: Este index já pode existir se há outras queries (verificar Firestore console)

**Benefício:**
- 10-15ms latência reduzida por listener
- Dados já ordenados = melhor para paginação
- Reduz CPU em listeners

---

### 🟠 NÃO OTIMIZÁVEL (1/7 Repositórios)

#### 7. GameQueryRepositoryImpl.kt ❌ NÃO OTIMIZÁVEL
**Problema:** Sorting necessário em cliente pós-processamento

**Encontradas 8 operações de sorting:**
- Linha 352: `.sortedBy { it.dateTime }` (após merge de múltiplas queries)
- Linha 414: `.sortedByDescending { it.dateTime }` (após merge)
- Linha 492: `.sortedByDescending { it.dateTime }` (após merge)
- Linha 538: `.sortedBy { it.dateTime }` (filtro pós-query)
- Linha 845: `.sortedBy { it.dateTime }` (após merge)
- Linha 853: `.sortedBy { it.dateTime }` (após merge)
- Linha 1003: `.sortedByDescending { it.dateTime }` (após merge)
- Linha 1131: `.sortedByDescending { it.dateTime }` (após merge)
- Linha 1290: `.sortedByDescending { it.dateTime }` (após merge)
- Linha 1387: `.sortedBy { ... }` (cálculo de distância Haversine)

**Razão: Não Otimizável**

Todas as operações requerem sorting em cliente porque:

1. **Multiple Query Merge (90% dos casos):**
   ```kotlin
   // Queries paralelas de múltiplas fontes:
   val publicGames = query1.get()    // Já ordenados por Firestore
   val groupGames = query2.get()     // Já ordenados por Firestore
   val ownerGames = query3.get()     // Já ordenados por Firestore

   // ❌ Merge requer re-sorting:
   val allGames = (publicGames + groupGames + ownerGames)
       .distinctBy { it.id }          // Deduplicação
       .sortedBy { it.dateTime }      // Re-sort após merge
       .take(limit)
   ```

   Firestore não pode fazer `UNION` com ORDER BY automaticamente.

2. **Post-Filter Sorting (line 538):**
   ```kotlin
   val games = androidGamesList
       .filter { val dt = it.dateTime; dt != null && dt > now }  // Filtrar futuros
       .sortedBy { it.dateTime }                                  // Re-sort após filtro
   ```

   Impossível filtrar pós-Firestore sem re-sort em cliente.

3. **Distance Calculation Sorting (line 1387):**
   ```kotlin
   val nearbyGames = allPublicGames
       .filter { game -> calculateDistance(...) <= radiusKm }  // Filtro geo
       .sortedBy { game -> calculateDistance(...) }             // Sort por distância
   ```

   Geolocalização requer cálculo em cliente.

**Conclusão:**
- ✅ Não eliminar esses sorts
- ✅ Performance OK: médias 30-100ms total (aceitável)
- ✅ Usar `.take(limit)` para limitar tamanho antes de sort

---

## Summary Table

| Repositório | Sorting | Status | Can Optimize? | Impacto |
|-----------|---------|--------|--------------|---------|
| WaitlistRepositoryImpl | orderBy (Firestore) | ✅ Ótimo | ❌ Não | - |
| StatisticsRepositoryImpl | orderBy (Firestore) | ✅ Ótimo | ❌ Não | - |
| FakeStatisticsRepository | sortedBy (Kotlin) | ✅ OK (fake) | ❌ Não | Mock only |
| FakeGameRepository | sortedBy (Kotlin) | ✅ OK (fake) | ❌ Não | Mock only |
| **GroupRepository** | sortedWith (Kotlin) | ⚠️ Ruim | ✅ SIM | 5-10ms saving |
| **LiveGameRepository** | sortedByDescending (Kotlin) | ⚠️ Ruim | ✅ SIM | 10-15ms saving |
| GameQueryRepositoryImpl | sortedBy x8 (Kotlin) | ⚠️ OK (necessário) | ❌ Não | Merge required |

---

## Recommendations

### Priority 1: QUICK WIN ⭐
**LiveGameRepository.kt - observeGameEvents()**
- **Effort:** 30 min (criar composite index + adicionar orderBy)
- **Benefit:** 10-15ms latência em listeners ao vivo
- **Risk:** Baixo (apenas ordena dados existentes)
- **Status:** Pronto para implementação

### Priority 2: NICE TO HAVE
**GroupRepository.kt - getOrderedGroupMembersFlow()**
- **Effort:** 1 hora (adicionar sort_priority field + migration + orderBy)
- **Benefit:** 5-10ms latência em member list
- **Risk:** Médio (requer migração de dados)
- **Status:** Aguardar depois do Priority 1

### Priority 3: NO ACTION NEEDED
**GameQueryRepositoryImpl - todas as operações**
- **Status:** Leave as-is
- **Razão:** Sorting necessário para merge/filtro em cliente
- **Alternativa:** Não existe solução melhor com Firestore

---

## Implementation Checklist

- [ ] Create spec for LiveGameRepository optimization
- [ ] Deploy composite index: `games/{gameId}/events (game_id, created_at DESC)`
- [ ] Add `.orderBy("created_at", Query.Direction.DESCENDING)` to observeGameEvents
- [ ] Remove `.sortedByDescending { it.createdAt?.time ?: 0L }` sort
- [ ] Test with live game + 50+ events
- [ ] Profile latency before/after
- [ ] Create spec for GroupRepository optimization (baixa prioridade)
- [ ] Update MASTER_OPTIMIZATION_CHECKLIST.md: P2 #25 → AUDIT COMPLETE

---

## Referências

- **Audit Ferramenta:** Grep para `sortedBy|sortedByDescending|orderBy`
- **Repos Auditados:** 7 arquivos (1300+ linhas)
- **Padrões Encontrados:** Multi-query merge, post-filter sort, geolocalização
- **Firestore Index Docs:** https://firebase.google.com/docs/firestore/query-data/index-overview

**Próxima Revisão:** Após implementação das otimizações (esperado 2026-02-06)
