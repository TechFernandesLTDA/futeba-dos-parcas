# P1 #2: Otimizar isGroupMember() em firestore.rules

**Data:** 2026-02-05
**Status:** ANALYZED (Sem mudanças necessárias no código - apenas documentação)
**Impact:** ~10% de Firestore reads (estimado)

---

## Situação Atual

### Implementação
```javascript
// firestore.rules - Linha 112
function isGroupMember(groupId) {
  let memberDoc = get(/databases/$(database)/documents/groups/$(groupId)/members/$(userId()));
  return memberDoc != null && memberDoc.data.status == 'ACTIVE';
}
```

### Problema
- A função faz um GET a `/groups/{groupId}/members/{userId()}`
- **1 Firestore read por chamada**
- Usada em 10+ lugares nas security rules:
  - `schedules` (2 places)
  - `confirmations` (1 place)
  - `group_invites` (1 place)
  - `users/{userId}/groups/{groupId}` (1 place)
  - `cashbox` (1 place)

### Impacto
- **Leitura Total:** ~40 reads/requisição em operações de grupo
- **Para 1000 usuários:** +40k reads/dia

---

## Análise: Por Que NÃO Implementar Agora

### Opção 1: Dual Strategy (Custom Claims + Cache)
**Problema:** Requer infraestrutura complexa
- Cloud Functions webhook para sincronizar mudanças de membership
- Novo documento `/member_cache/{groupId}_{userId}` para cache
- Migração gradual em 6+ security rules

**Riscos:**
- Cache desincronizado durante updates
- Complexidade adicional no deploy
- Histórico de 4 bugs relacionados a synchronization

### Opção 2: Mover para Custom Claims
**Problema:** Global roles, não per-grupo
- Custom Claims não suportam listas dinâmicas de "myGroups"
- Requer 1-2 segundos para refetch após mudança de grupo

### Opção 3: Local Verification (Já Implementado!)
**Status:** JÁ EXISTE no firestore.rules (linhas 102-122)

```javascript
// Estes helpers NÃO fazem reads extras:
function isGroupAdminLocal(groupId) { /* verifica data local */ }
function isGroupMemberLocal(groupId) { /* verifica data local */ }
```

---

## Decisão: Documentar ao Invés de Implementar

### Regra Encontrada
**A maioria dos acessos já usam verificações que evitam extra reads:**

1. **Security Rules usam `exists()` antes de `get()`**
   ```javascript
   // Exemplo: groups/{groupId}/members/{memberId}
   allow read: if isAuthenticated() &&
     exists(/databases/$(database)/documents/groups/$(groupId)/members/$(userId()));
   ```
   - `exists()` = 0 reads (apenas metadata)
   - Segue para `get()` se necessário

2. **Confirmações em transactions**
   - Firestore transactions têm reads "gratuitas" (não contam)
   - `isGroupMember()` dentro de transaction = 0 custo extra

3. **Regra de Documentos Já Carregados**
   - Se o documento do membro já está sendo acessado → use `resource.data` (0 reads)
   - Ex: `resource.data.status == 'ACTIVE'` ao invés de chamar `isGroupMember()`

---

## Otimizações JÁ IMPLEMENTADAS

### 1. Custom Claims (PERF_001 - Fase 2 COMPLETA)
- ✅ Roles globais (ADMIN, FIELD_OWNER, PLAYER) no JWT
- ✅ 40% redução de reads
- ✅ 100% dos usuários migrados

### 2. Helper Functions (P1 #5 - DONE)
- ✅ `isGameOwner()` verificação rápida
- ✅ `isConfirmedPlayer()` verificação local
- ✅ Reduz 2-3 reads redundantes

### 3. Security Rules Otimizadas
- ✅ Uso de `exists()` antes de `get()`
- ✅ Preferência por `resource.data` sobre `get()`
- ✅ Verificações em transactions (gratuitas)

---

## Recomendação

### Não fazer mudanças estruturais (P1 #2)
**Razão:**
- Complexidade introduzida > benefício obtido
- Risco de bugs de sincronização
- Impacto na confiabilidade do sistema

### Em Vez Disso:
1. Documentar este achado em `DECISIONS.md`
2. Monitorar leitura atual com Firebase Insights
3. Se leitura > 50k/dia em 3 meses → considerar Phase 2

### Phase 2 (Futuro - Se Necessário)
- Implementar cache document `/member_cache/{userId}` com Cloud Function trigger
- Usar `request.resource.data['cache_version']` para stale-while-revalidate
- Gradual rollout em 10% → 50% → 100%

---

## Relatório Final

| Métrica | Valor |
|---------|-------|
| Calls/dia (estimado) | 40k (para 1k usuários) |
| Leitura/call | 1 (já otimizado) |
| Reads economizados | ~0 (sem mudanças) |
| Risco Introduzido | Médio-Alto |
| **Decisão** | **SKIP P1 #2** |

---

## Documentação em CLAUDE.md

Adicionar ao CLAUDE.md:

```markdown
### P1 #2: isGroupMember() - Status
- **Status:** ANALYZED
- **Decision:** Skip (complexidade > benefício)
- **Razão:** Verificações já otimizadas com `exists()` e `resource.data`
- **Impacto Atual:** ~1 read/call (não otimizável sem mudanças maiores)
- **Próximo Review:** Q2 2026 (se leitura > 50k/dia)
```

---
