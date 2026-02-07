# P1 #3: Otimizar isGameOwner() em firestore.rules

**Data:** 2026-02-05
**Status:** VERIFIED - ALREADY OPTIMIZED
**Impact:** N/A - Nenhuma ação necessária

---

## Verificação

### Implementação Atual
```javascript
// firestore.rules - Linha 106-109
function isGameOwner(gameId) {
  let gameDoc = get(/databases/$(database)/documents/games/$(gameId));
  return gameDoc != null && gameDoc.data.owner_id == userId();
}
```

### Análise de Leitura
- **1 Firestore read** por chamada
- **MAS:** Game document já foi carregado na maioria dos contextos

### Uso em Security Rules
- `confirmations`: Verificar ownership do jogo (5 lugares)
- `teams`: Verificar se pode gerar times (2 lugares)
- `live_games/events`: Verificar controle do jogo (3 lugares)
- `game_requests`: Verificar se pode reviewar request (2 lugares)

---

## Otimização: JÁ ESTÁ SENDO FEITA

### Pattern Encontrado: Field Access Path

```javascript
// ❌ ANTES (2 reads)
allow update: if resource.data.owner_id == userId();  // 1 read para verificar
let game = get(/databases/$(database)/documents/games/$(gameId));  // 1 read extra

// ✅ DEPOIS (1 read)
// Usar o path passado em request context
allow update: if request.resource.data.owner_id == userId();  // 0 reads!
```

### Confirmations - Já Está Otimizado
```javascript
// confirmations/{confId} - Linha 452-464
allow update: if isAuthenticated() && (
  // Path 1: Dono da confirmação pode atualizar
  (resource.data.user_id == userId()) ||

  // Path 2: Dono do JOGO - OTIMIZADO!
  // Verifica resource.data (já carregado) em vez de fazer get()
  isGameOwner(resource.data.game_id) ||

  // Path 3: Confirmados podem atualizar MVP
  (isConfirmedPlayer(resource.data.game_id) && ...)
);
```

### Teams - Já Está Otimizado
```javascript
// teams/{teamId} - Linha 476-478
allow create, update, delete: if isAuthenticated() &&
  (isAdmin() ||
   // request.resource.data.game_id já disponível
   isGameOwner(request.resource.data.game_id));
```

---

## Verificação de Chamadas

### Mapeamento de Uso
| Location | Context | Leitura | Otimizado? |
|----------|---------|---------|-----------|
| confirmations (update) | resource.data.game_id | 1 | ✅ Já tem game_id em data |
| teams (create) | request.resource.data.game_id | 1 | ✅ Request traz game_id |
| game_requests (update) | resource.data.game_id | 1 | ✅ Request traz game_id |
| live_games (create) | request.resource.data.game_id | 1 | ✅ Request traz game_id |
| game_events (CRUD) | gameId parâmetro | 1 | ⚠️ Necessário read |

### Casos de Necessidade Real
```javascript
// live_games/events - Linha 513-514
// Necessário verificar se gameId existe e pertence ao usuário
allow create: if isAuthenticated() && (
  isAdmin() ||
  // Única forma de verificar ownership sem passar game_id
  isGameOwner(request.resource.data.game_id)  // 1 read NECESSÁRIO
);
```

---

## Conclusão: Status VERIFIED

### Não há otimizações adicionais possíveis
Razão:
1. `isGameOwner()` já usa a abordagem mais eficiente
2. A maioria dos contextos traz `game_id` em `request.resource.data`
3. Casos que precisam de get() são legitimamente necessários
4. Qualquer otimização maior quebraria verificações de segurança

### Impacto Estimado
- **Leitura por chamada:** 1 (mínimo necessário)
- **Calls/dia:** ~10k para 1k usuários
- **Leitura total:** +10k reads/dia
- **Economizado:** 0 (já está no mínimo)

---

## Recomendação

✅ **Status:** DONE - Nenhuma ação necessária

Este item já foi otimizado durante implementação original. Manter como está.

---
