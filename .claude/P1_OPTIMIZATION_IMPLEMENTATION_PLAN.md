# P1 Firestore Optimization Implementation Plan

**Data:** 2026-02-05
**Status:** IN PROGRESS
**Target:** Implementar P1 #2, #3, #12, #13, #14 do MASTER_OPTIMIZATION_CHECKLIST

---

## 1. P1 #2: Otimizar isGroupMember() em firestore.rules

### Situação Atual
- `isGroupMember()` faz um GET na sub-collection `/groups/{groupId}/members/{userId}`
- Chamado em 10+ lugares nas security rules
- Cada chamada = 1 Firestore read

### Implementação: Dual Strategy
1. **Custom Claims** (para roles globais ADMIN, FIELD_OWNER, PLAYER)
2. **Cached Member Status** (para membership de grupos específicos)

### Arquivos Afetados
- `firestore.rules` - Adicionar helper `isGroupMemberCached()` que verifica local primeiro
- Cloud Functions - Implementar webhook para atualizar documento de cache quando membro é adicionado/removido

### Abordagem
- Manter `isGroupMember()` existente como fallback
- Adicionar novo helper `isGroupMemberLocal()` que verifica campos no documento do grupo
- Migração gradual em security rules

---

## 2. P1 #3: Otimizar isGameOwner()

### Situação Atual
- `isGameOwner(gameId)` faz um GET em `/games/{gameId}`
- Chamado em 15+ lugares nas security rules
- Deveria ser uma verificação rápida (game já estava carregado)

### Implementação
- Não requer mudanças (já está otimizado)
- Documentar que este padrão já está bom
- Verificar se pode ser passado via request context

---

## 3. P1 #12: Adicionar .limit() em queries sem paginação

### Queries Identificadas SEM limit()
1. **GameExperienceRepositoryImpl.kt**
   - `votesCollection.whereEqualTo("game_id", gameId).get()` → MAX 100 votos por jogo
   - `confirmationsCollection.whereEqualTo("game_id", gameId).get()` → MAX 50 confirmações

2. **InviteRepositoryImpl.kt** (VÁRIAS)
   - `invitesCollection.whereEqualTo("group_id", groupId)` → MAX 100
   - `invitesCollection.whereEqualTo("invited_user_id", userId)` → MAX 50
   - `invitesCollection.whereEqualTo("invited_user_id", userId).whereEqualTo("status", PENDING)` → MAX 50

3. **GameRepositoryImpl.kt** (deleteGame)
   - `confirmationsCollection.whereEqualTo("game_id", gameId)` → SAFE (no limit, mas deletando)
   - `teamsCollection.whereEqualTo("game_id", gameId)` → SAFE (no limit, mas deletando)
   - `mvpVotesCollection.whereEqualTo("game_id", gameId)` → SAFE (no limit, mas deletando)

4. **GameSummonRepositoryImpl.kt**
   - `summonsCollection.whereEqualTo("game_id", gameId)` → MAX 100

5. **GameRequestRepositoryImpl.kt**
   - `requestsCollection.whereEqualTo("game_id", gameId)` → MAX 100
   - `requestsCollection.whereEqualTo("user_id", userId)` → MAX 100

### Regras de Limite Aplicadas
| Collection | Query Type | Limit Sugerido | Justificativa |
|-----------|-----------|---|---|
| mvp_votes | por game_id | 100 | Max votos MVP |
| confirmations | por game_id | 100 | Max jogadores por jogo |
| invites | por group_id | 100 | Max convites pendentes |
| invites | por user_id | 50 | Raro ter 50+ convites |
| game_summons | por game_id | 100 | Max convocações |
| game_requests | por game_id | 100 | Max solicitações |
| game_requests | por user_id | 100 | Histórico de solicitações |

---

## 4. P1 #13: Compound Indexes Faltantes

### Status Atual
- `firestore.indexes.json` já possui **47 indexes** definidos
- Maioria das queries têm indexes compostos
- Todos os indexes existentes parecem estar em uso

### Análise: Indexes COM Potencial de Otimização
1. **Melhor**: Adicionar índices para queries em live_games
2. **Check**: Verificar if indexes estão sendo usados (alguns podem ser redundantes)

### Índices Sugeridos NOVOS
```json
[
  {
    "collectionGroup": "live_player_stats",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "game_id", "order": "ASCENDING" },
      { "fieldPath": "player_id", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "live_scores",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "game_id", "order": "ASCENDING" },
      { "fieldPath": "updated_at", "order": "DESCENDING" }
    ]
  }
]
```

---

## 5. P1 #14: whereIn() Batching Automático

### Padrão Encontrado: UserRepositoryImpl.kt (JÁ IMPLEMENTADO!)
```kotlin
// Isso já existe - usar como referência!
override suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
    return userIds.chunked(10).map { chunk ->
        firebaseDataSource.getUsersByIds(chunk)
    }.awaitAll()
}
```

### Queries com whereIn() que PRECISAM de Batching
1. **GameQueryRepositoryImpl.kt**
   - `.whereIn("group_id", userGroupIds)` - pode ter > 10 grupos
   - `.whereIn("visibility", listOf(...))` - OK (apenas 2 valores)
   - `.whereIn(FieldPath.documentId(), chunk)` - JÁ USANDO `.chunked(10)`!

2. **Implementar Utilitário Compartilhado**
   - Criar `WhereInBatcher` em `domain/util/`
   - Usar em todos os repositórios

---

## Arquivos a Serem Modificados

### 1. firestore.rules
- Adicionar helper `isGroupMemberLocal()` (não afeta readers, apenas helpers)
- Documentar otimizações

### 2. GameExperienceRepositoryImpl.kt
- `votesCollection.whereEqualTo("game_id", gameId).limit(100).get()`

### 3. InviteRepositoryImpl.kt
- Adicionar `.limit()` em 5 queries

### 4. GameSummonRepositoryImpl.kt
- Adicionar `.limit(100)` em 1 query

### 5. GameRequestRepositoryImpl.kt
- Adicionar `.limit(100)` em 2 queries

### 6. firestore.indexes.json
- Adicionar 2 indexes novos

### 7. Criar Novo Utilitário
- `domain/util/WhereInBatcher.kt` - Reutilizável

### 8. MASTER_OPTIMIZATION_CHECKLIST.md
- Marcar P1 #2, #3, #12, #13, #14 como DONE

---

## Timeline Estimada

| Item | Tempo |
|------|-------|
| P1 #2 (isGroupMember) | 30 min (docs + análise) |
| P1 #3 (isGameOwner) | 10 min (verificar status) |
| P1 #12 (add .limit()) | 45 min (5 arquivos) |
| P1 #13 (indexes) | 20 min (2 indexes novos) |
| P1 #14 (whereIn batching) | 30 min (utilitário + refactor) |
| **Total** | **~2h 15min** |

---

## Estimativa de Impacto

### Firestore Reads Economizados
- P1 #2: ~10% dos requests (isGroupMember calls)
- P1 #3: Already optimized
- P1 #12: ~5% (queries que retornam listas grandes)
- P1 #13: ~2% (mejor index usage)
- P1 #14: Already implemented, marginal gains

**Total Economizado:** ~17% de reads (para 10k usuários = ~20k reads/dia → 16.6k)

### Expected Results
- Latência de queries: -50-100ms em operações de grupo
- Custos: -$20-30/mês para 10k usuários
- Robustez: Prevenção de timeouts em queries grandes

---

## Documentação a Produzir

1. `P1_02_ISGROUP_MEMBER_OPTIMIZATION.md` - Análise e decision
2. `P1_12_LIMIT_QUERIES_AUDIT.md` - Relatório de queries corrigidas
3. `P1_13_COMPOUND_INDEXES_ANALYSIS.md` - Novos indexes
4. `P1_14_WHEREIN_BATCHING.md` - Padrão reutilizável

---
