# BUGFIX: Janitor de vídeos — fail-open destrutivo do Storage, paginação sem ordem e tetos sem saturação

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Backend Validation Agent
> **Data:** 2026-08-20
> **Issue:** #4068
> **Follow-up de:** #4038 (janitor, commit 1e5d0a5a) e #4045 (teto de páginas da invalidação de cache)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

O janitor `reconcileStaleProcessingGameVideos` (job agendado a cada 10 min)
trata **qualquer falha** da consulta `exists()` ao Storage como "objeto não
existe" e executa a ação irreversível de marcar o vídeo como `REJECTED`
(`STALE_PROCESSING_NO_OBJECT`). Um erro transitório do GCS (5xx, timeout,
throttling, IAM momentâneo) rejeita permanentemente vídeos que estavam sendo
processados normalmente — o vídeo some da UI com motivo factualmente errado.

Complementarmente:

- A query não filtra nem ordena por `created_at`: pega uma fatia arbitrária
  (ordem `__name__`, ids = sha256 do `storage_path`) e descarta os recentes
  **em memória**. Com ≥100 docs `PROCESSING`, stale além da 1ª página não são
  alcançados naquela execução (hardening, não defeito ativo).
- Nem o janitor nem a invalidação de cache do leaderboard logam quando batem
  no teto (`JANITOR_PAGE_LIMIT` / `SEASON_CACHE_MAX_PAGES`) — saturação é
  indistinguível de "não havia trabalho".

### 1.2 Comportamento Esperado (Correto)

1. Erro do Storage → adiar para a próxima execução com `logger.warn`; só
   rejeitar quando `exists()` retornar `false` **de forma bem-sucedida**
   (fail-closed).
2. Query filtra `created_at < cutoff` e ordena `created_at ASC` **no
   servidor**, priorizando os mais antigos, com índice composto
   `game_videos(status ASC, created_at ASC)` em `firestore.indexes.json`.
3. `logger.warn` quando `snapshot.size === JANITOR_PAGE_LIMIT` e quando o
   laço da invalidação atinge `SEASON_CACHE_MAX_PAGES`.

### 1.3 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Firebase Cloud Functions v2 (onSchedule/onDocumentWritten) |
| Arquivos | `functions/src/storage/game-videos.ts`, `functions/src/cache/leaderboard-cache.ts` |
| Frequência | Janela de instabilidade do GCS a cada 10 min |
| Impacto | Perda permanente de vídeo do usuário (irreversível); invalidação parcial silenciosa |

---

## 2. Análise de Causa Raiz

O `.catch(() => [false])` colapsa **erro** e **ausência** no mesmo valor
`false`. A distinção importa porque o caminho seguinte é destrutivo. O padrão
é o anti-pattern `silent-failure`: catch sem log que degrada para o pior
desfecho possível.

A paginação sem ordem veio do fix #4038 (filtro de idade em memória para não
exigir índice novo). O teto silencioso do cache veio do #4045: o `break` por
deadline loga, mas o `for` que estoura `SEASON_CACHE_MAX_PAGES` sai sem log.

---

## 3. Solução

### 3.1 `game-videos.ts`

```ts
let exists: boolean;
try {
  [exists] = await bucket.file(storagePath).exists();
} catch (err) {
  logger.warn("[GAME_VIDEO_JANITOR] exists() falhou; adiando reconciliação",
    {videoId: doc.id, storagePath, err});
  continue;
}
if (exists) continue;
```

Query com filtro/ordem server-side (defense-in-depth: guard de idade em
memória mantido):

```ts
.where("status", "==", "PROCESSING")
.where("created_at", "<", Timestamp.fromMillis(cutoff))
.orderBy("created_at", "asc")
.limit(JANITOR_PAGE_LIMIT)
```

Saturation log quando `snapshot.size >= JANITOR_PAGE_LIMIT`.

### 3.2 `leaderboard-cache.ts`

Flag `hitPageCap` setada na última iteração com página cheia; `logger.warn`
após o laço quando o teto é atingido (espelha o log de deadline do #4045).

### 3.3 `firestore.indexes.json`

Novo índice composto:

```json
{
  "collectionGroup": "game_videos",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "status", "order": "ASCENDING"},
    {"fieldPath": "created_at", "order": "ASCENDING"}
  ]
}
```

**Sem este índice a nova query lança `FAILED_PRECONDITION`** (modo de falha
da #4029). Deploy do índice deve acompanhar (ou preceder) o deploy das
functions.

---

## 4. Testes (Jest)

- **game-videos.test.ts**: inverter o teste que codificava o bug ("treats a
  storage lookup failure as a missing object") → agora erro transitorio NÃO
  rejeita e loga warn; novo teste de saturação da página cheia; novo teste
  do shape da query (`where created_at <`, `orderBy created_at asc`).
- **leaderboard-cache.test.ts**: novo teste — 10 páginas cheias →
  `logger.warn` "teto de 10 páginas", sem log de deadline.

---

## 5. Critérios de Aceite (da issue #4068)

- [x] Erro transitório do Storage não marca vídeo como `REJECTED` (teste com
      `exists()` rejeitando)
- [x] Página do janitor prioriza os mais antigos, com índice composto no
      `firestore.indexes.json`
- [x] `logger.warn` quando `snapshot.size === JANITOR_PAGE_LIMIT` e quando o
      laço do leaderboard-cache atinge `SEASON_CACHE_MAX_PAGES`

---

## 6. Riscos e Rollout

- **Deploy ordenado**: publicar o índice ANTES das functions (ou junto, no
  mesmo `firebase deploy`), senão o janitor falha com `FAILED_PRECONDITION`
  até o índice construir (alguns minutos).
- Docs sem `created_at` ficam invisíveis ao janitor (o filtro server-side
  exclui docs sem o campo). `createGameVideo` sempre escreve `created_at`
  (`serverTimestamp()`), e o guard em memória permanece para docs anômalos
  que porventura apareçam. Comportamento fail-closed intencional.
- Rollback: revert do commit restaura o comportamento anterior; o índice
  extra é inócuo se sobrar órfão.
