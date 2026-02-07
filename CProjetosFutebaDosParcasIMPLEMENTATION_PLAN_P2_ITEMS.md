# Plano de Implementação - Itens P2 Restantes

## Itens a Implementar

### 1. P2 #2: Implementar prefetching de game details
**Arquivo:** GamesViewModel.kt
**Ação:** Adicionar método `prefetchGameDetails()` que carrega detalhes dos primeiros 3-5 jogos
**Abordagem:** Usar async/await para não bloquear UI

### 2. P2 #6: Usar Firebase Storage thumbnails (200x200)
**Status:** DOCUMENTAR - função já existe em generate-thumbnails.ts
**Ação:** Criar documento explicando como usar thumbnails no código Kotlin

### 3. P2 #11: Simplificar GameCard (reduzir composables)
**Arquivo:** GamesList.kt e GamesScreen.kt
**Ação:** 
- Extrair GameStatusBadge para componente memo
- Usar remember {} para cálculos de cores
- Consolidar Rows aninhados

### 4. P2 #23: Usar kotlinx.serialization
**Status:** Gson já em uso, documentar necessidade
**Ação:** 
- Verificar uso de Gson no projeto
- Documentar plano de migração
- Criar exemplo em um modelo

### 5. P2 #27: Implementar keep-warm em Cloud Functions
**Arquivo:** functions/src/index.ts
**Ação:** Criar Cloud Function scheduled que pinga as funções principais

---

## Timeline
1. P2 #2: GamesViewModel prefetching (15 min)
2. P2 #6: Storage thumbnail documentation (10 min)
3. P2 #11: GameCard simplification (20 min)
4. P2 #23: kotlinx.serialization analysis (15 min)
5. P2 #27: Keep-warm function (20 min)
6. Update MASTER_OPTIMIZATION_CHECKLIST.md (5 min)

Total: ~85 minutos
