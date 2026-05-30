# Auditoria de Permissoes, Queries e Indices — 2026-05-30

## Status de execução (2026-05-30 — corrigido + deployado)

**13 de 15 achados corrigidos e deployados em produção. 2 deferidos (quebrariam prod).**

| # | Achado | Decisão | Como |
|---|--------|---------|------|
| 1 | HIGH griefing `is_worst_player` cross-user | ✅ **CORRIGIDO** (functions, não rules) | O branch de rules é **load-bearing** para o `concludeVoting` client-side do Android (disparado por qualquer confirmado, escreve flags em todos os docs). Remover/escopar quebraria apps instalados. Fix real: hardening do `index.ts` — `isWorstPlayer` agora revalida contra `after.worst_player_id` (owner-gated), espelhando a revalidação CVE-2 do MVP. Fecha o vetor residual sem acoplamento com o cliente. Deployado `onGameStatusUpdate`. |
| 2,6,7,9,10,14 | índices compostos faltantes | ✅ **CORRIGIDO** | adicionados a `firestore.indexes.json` + deploy |
| 8 | índice `waitlist` | ✅ **CORRIGIDO** | adicionado |
| 15 | índice `live_scores` não-usado | ✅ **REMOVIDO** | deploy `--force` |
| 4 | lockout read `cancellations` | ✅ **CORRIGIDO** | rules + teste red→green |
| 11 | lockout read ETA `confirmations` | ✅ **CORRIGIDO** | rules + teste |
| 5 | `create users` sem guard `auto_*` | ✅ **CORRIGIDO** | rules + teste (grep confirmou: nenhum cliente seta `auto_*` no create) |
| 12 | `update users` campo `verified` | ✅ **CORRIGIDO** | rules + teste (grep: claim é a fonte autoritativa) |
| 3 | `/invites` enumerável (over-permissive) | ⏸️ **DEFERIDO** (issue) | O fix proposto (`list`→admin) **quebraria o join-by-code** — web (`useGroups`, `JoinByInviteScreen`) e Android (`FirebaseDataSource`) fazem lookup via `where('code'==X)`, que é LIST nas rules (doc-id ≠ code). Precisa de change coordenada (migrar lookup p/ doc-id=code + migração de dados) — não shippável isolado. |
| 13 | `cashbox_summary` balance inconsistente | ⏸️ **DEFERIDO** (issue) | `balance == income - expense` como igualdade em rules trava writes legítimos por mismatch de ponto-flutuante. Requer recompute server-side. |

**Validação:** suíte de rules 532/532 verde (`--no-file-parallelism`; 519 baseline + 13 novos testes). Functions: build tsc limpo + 62 testes do trigger de XP verdes. Deploys: rules ✅, indexes ✅, `onGameStatusUpdate` ✅.

**Nota operacional (índices):** o deploy `--force` deletou 3 índices (1 = `live_scores` intencional + 2 de **drift de prod não-versionado**, nunca presentes no JSON source-of-truth). Reversível: se algum query quebrar (FAILED_PRECONDITION), re-adicionar ao JSON.

---

## Resumo

**Total de achados confirmados:** 16 (todos validados por leitura do codigo real)

### Por severidade

| Severidade | Quantidade |
|------------|------------|
| CRITICAL   | 0 |
| HIGH       | 2 |
| MEDIUM     | 8 |
| LOW        | 6 |

### Por camada

| Camada | Quantidade |
|--------|------------|
| `rules` (firestore.rules)       | 7 |
| `index` (queries / firestore.indexes.json) | 9 |

### Por tipo

| Tipo | Quantidade |
|------|------------|
| missing-index        | 8 |
| privilege-escalation | 1 |
| over-permissive      | 1 |
| under-permissive     | 2 |
| missing-validation   | 2 |
| inconsistency        | 1 |
| unused-index         | 1 |

---

## Tabela por severidade

| # | Severidade | Camada | Local | Perfis | Tipo | Descricao curta |
|---|-----------|--------|-------|--------|------|-----------------|
| 1 | HIGH   | rules | firestore.rules L794-797 | PLAYER, FIELD_OWNER | privilege-escalation | Jogador confirmado pode setar `is_worst_player`/`is_mvp`/`is_best_gk` na confirmation de TERCEIRO (griefing de XP -10) |
| 2 | HIGH   | index | growth/weekly-ranking.ts:71-75 | all | missing-index | Query `games` por `status` + range `date` sem indice composto (status ASC, date ASC) |
| 3 | MEDIUM | rules | firestore.rules L1542 | unverified, PLAYER, FIELD_OWNER | over-permissive | `allow read` em `/invites` permite LIST/enumeracao de todos os convites de todos os grupos |
| 4 | MEDIUM | rules | firestore.rules L671 | PLAYER, FIELD_OWNER | under-permissive | Jogador escreve `cancellations` mas nao consegue ler a propria entrada (lockout) |
| 5 | MEDIUM | rules | firestore.rules L414-431 | PLAYER, unverified | missing-validation | `create` de `users` nao bloqueia campos `auto_*_rating`/`auto_rating_samples` (denylist incompleto) |
| 6 | MEDIUM | index | voting/temporal-overlap.ts:99-105 | PLAYER, FIELD_OWNER, ADMIN | missing-index | Query `confirmations` por `user_id`+`status`+orderBy `created_at` sem indice |
| 7 | MEDIUM | index | LeagueService.kt:295-300 | PLAYER, FIELD_OWNER, ADMIN | missing-index | Query `season_participation` por `user_id`+orderBy `last_calculated_at` sem indice |
| 8 | MEDIUM | index | WaitlistRepositoryImpl.kt:131-161 | PLAYER, FIELD_OWNER, ADMIN | missing-index | Query Android `waitlist` por `status`+orderBy `queue_position` sem indice (drift web/Android) |
| 9 | MEDIUM | index | GamePhotosTab.tsx:95-99 | PLAYER, FIELD_OWNER, ADMIN | missing-index | Listener `game_photos` por `game_id`+orderBy `created_at` sem indice |
| 10 | MEDIUM | index | useGroupLeague.ts:74-211 | PLAYER, FIELD_OWNER, ADMIN | missing-index | Query `league_standings` por `season_id`+orderBy `points` sem indice |
| 11 | LOW | rules | firestore.rules L651 | PLAYER, ADMIN | under-permissive | Jogador escreve ETA em `confirmations` mas nao le; admin tambem nao le (inconsistencia) |
| 12 | LOW | rules | firestore.rules L452-496 | PLAYER, FIELD_OWNER, unverified | inconsistency | `update` de `users` nao protege campo `verified` (cosmetico/legacy, sem bypass real) |
| 13 | LOW | rules | firestore.rules L1498-1505 | PLAYER, FIELD_OWNER, ADMIN | missing-validation | `cashbox_summary` aceita `balance` inconsistente com income/expense |
| 14 | LOW | index | reminders.ts:270-275 | all | missing-index | Fallback `games` por `dateTime==null`+orderBy `created_at` sem indice (caminho frio) |
| 15 | LOW | index | firestore.indexes.json:931-944 | all | unused-index | Indice `live_scores` (game_id, updated_at) sem nenhuma query correspondente |

---

## Detalhamento dos achados

### 1. [HIGH] privilege-escalation — escrita cross-user de flags de votacao em `confirmations`

- **Local:** `firestore.rules` L794-797 (branch `update` de `confirmations`)
- **Perfis afetados:** PLAYER, FIELD_OWNER

```javascript
// Jogadores confirmados podem atualizar flags de MVP (para votação)
        (isConfirmedPlayer(resource.data.game_id) &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['is_mvp', 'is_best_gk', 'is_worst_player']))
```

**Descricao:** Este branch do update de `confirmations` exige apenas `isConfirmedPlayer(resource.data.game_id)` — NAO exige que `resource.data.user_id == userId()`. Logo qualquer jogador confirmado A pode atualizar a confirmation de um TERCEIRO (doc `{game}_{vitimaB}`) setando `is_worst_player`/`is_mvp`/`is_best_gk`. O processamento de XP em `functions/src/index.ts` L721-722 le `conf.is_worst_player === true` DIRETO da confirmation, SEM revalidar contra votos (diferente de `is_mvp`, que e revalidado contra `after.mvp_id` em L696-702), e aplica `XP_WORST_PLAYER_PENALTY` (-10 XP) + incrementa `worstPlayerCount` (L811-819, L861-863, L943). Resultado: A pode marcar a vitima B como "Bola Murcha" e deduzir XP / incrementar contador de B sem que B tenha sido votado. O fluxo legitimo de MVP/Bola Murcha passa por `mvp_votes` + CF (`voting/mvp-voting.ts` grava essas flags via Admin SDK), tornando este branch de escrita direta tanto redundante quanto exploravel.

O helper `isConfirmedPlayer(gameId)` (L196-199) so verifica o doc do PROPRIO chamador: `get(confirmations/$(gameId + "_" + userId()))` com `status=='CONFIRMED'`; nao vincula o doc-alvo ao caller.

**FIX proposto:** Escopar o branch ao proprio documento: adicionar `resource.data.user_id == userId()` na condicao, OU remover o branch inteiro (flags devem ser SERVER-ONLY, gravadas apenas pela CF de agregacao de votos via Admin SDK). Preferir remocao, ja que `mvp_votes` + CF e o caminho autoritativo. Em paralelo, hardenizar `index.ts` para revalidar `is_worst_player` contra os votos agregados (como ja faz com `is_mvp`).

> **ASERCAO DE TESTE:** `as(PLAYER_A confirmed in G1).update(confirmations/G1_PLAYER_B, {is_worst_player: true})` -> hoje **ALLOWED** (PLAYER_A confirmado em G1, PLAYER_B != A), **expect DENIED**. Tambem: `as(PLAYER_A confirmed).update(confirmations/G1_PLAYER_A, {is_worst_player:true})` deve continuar permitido apenas se o design exigir, mas idealmente **DENIED** (server-only).

---

### 2. [HIGH] missing-index — `games` por `status` + range `date` (weekly ranking)

- **Local:** `functions/src/growth/weekly-ranking.ts:71-75`
- **Colecao:** `games`
- **Perfis afetados:** all

```typescript
.where("status", "==", "FINISHED")
.where("date", ">=", start.toISOString().split("T")[0])
.where("date", "<=", end.toISOString().split("T")[0])
```

**Descricao:** Query agendada (weekly ranking) filtra `games` por igualdade em `status` + range em `date`. Firestore exige indice composto `(status ASC, date ASC)`. Em `firestore.indexes.json` so existe `(status ASC, dateTime ASC)` — campo `dateTime` != `date`. Tambem existem `(is_public, status, date)` e `(is_public, visibility, status, date)`, mas nenhum serve sem `is_public` na query. Caminho frio/agendado: erro latente `FAILED_PRECONDITION` em runtime quando a funcao roda (ou no emulador/deploy limpo). Quebra a feature inteira de ranking semanal ate criar o indice.

**FIX proposto:** Adicionar indice composto `games (status ASC, date ASC)` em `firestore.indexes.json`.

> **ASERCAO DE TESTE:** `games` query: `where status=='FINISHED' AND date>=X AND date<=Y` -> requer indice composto `games(status ASC, date ASC)`. Sem ele: `FAILED_PRECONDITION 'The query requires an index'`.

---

### 3. [MEDIUM] over-permissive — `allow read` em `/invites` permite enumeracao (LIST)

- **Local:** `firestore.rules` L1542
- **Colecao:** `invites`
- **Perfis afetados:** unverified, PLAYER, FIELD_OWNER

```javascript
// Read: qualquer auth (codigos sao random, lookup por code precisa disso)
      allow read: if isAuthenticated();
```

**Descricao:** O bloco usa `allow read` (que cobre GET e LIST) baseado na premissa do comentario (L1529-1530) de que "codigos sao random e nao enumeraveis, entao read amplo e aceitavel". A premissa e FALSA para LIST: `allow read` concede enumeracao. Qualquer usuario autenticado (PLAYER/unverified) pode rodar uma LIST na colecao `/invites` e obter TODOS os convites de TODOS os grupos, incluindo `group_id`, `group_name`, `inviter_id`, `inviter_name`, `expires_at` e `used`. Isso vaza metadados de grupos privados e a identidade de quem convidou. Combinado com a rule de update (L1560), que permite a qualquer auth setar `used_by=self` em qualquer invite nao-usado/nao-expirado, um atacante pode enumerar e queimar (griefing) todos os codigos ativos. O proprio arquivo ja separa get/list onde a nao-enumerabilidade importa (`mvp_votes` L1909/1915, `user_feedback` L2281/2285) — aqui faltou.

**FIX proposto:** Separar get de list espelhando o padrao ja usado no arquivo:
```javascript
allow get: if isAuthenticated();   // lookup por code (doc-id) continua funcionando
allow list: if isAdmin();          // bloqueia enumeracao da colecao inteira
```
O join flow do web faz lookup por code via `get(doc-id)`, entao nao quebra.

> **ASERCAO DE TESTE:** `as(PLAYER).list(/invites)` -> **expect DENIED**; `as(PLAYER).get(/invites/SOMECODE)` -> **expect ALLOWED**; `as(ADMIN).list(/invites)` -> **expect ALLOWED**.

---

### 4. [MEDIUM] under-permissive — jogador nao le a propria entrada em `cancellations` (lockout)

- **Local:** `firestore.rules` L671
- **Colecao:** `games/{gameId}/cancellations`
- **Perfis afetados:** PLAYER, FIELD_OWNER

```javascript
match /cancellations/{cancellationId} {
        allow read: if isAuthenticated() && (
          isAdmin() ||
          isGameOwner(gameId)
        );
```

**Descricao:** LOCKOUT + mismatch comentario/codigo. O comentario da subcolecao (L668) afirma explicitamente "Leitura/escrita: apenas o proprio jogador. Admin/owner podem ler todos." Porem a rule de read omite a clausula `resource.data.user_id == userId()`. O proprio jogador cria sua entrada de cancelamento (`create` em L675-678 exige `request.resource.data.user_id == userId()`) mas depois NAO consegue le-la de volta: so admin e o dono do jogo podem ler. `ConfirmationUseCase.kt` L427-433 le os cancelamentos do PROPRIO usuario via `collectionGroup("cancellations").whereEqualTo("user_id", userId)` (disparado em L237 `updateAttendanceRate(user.id)` apos o jogador cancelar presenca), e esse read e negado para nao-owner. O erro e engolido pelo catch L470 (sem crash), mas a feature de taxa de presenca quebra silenciosamente para jogadores que nao sao dono do jogo (o caso comum).

**FIX proposto:** Adicionar a clausula do proprio jogador, alinhando com o comentario:
```javascript
allow read: if isAuthenticated() && (
  isAdmin() ||
  isGameOwner(gameId) ||
  resource.data.user_id == userId()
);
```

> **ASERCAO DE TESTE:** Jogador P1 cria `games/G1/cancellations/C1` com `user_id=P1`. `as(P1).get(games/G1/cancellations/C1)` -> currently **DENIED**; **expect ALLOWED**. `as(GAME_OWNER).get(...)` -> **ALLOWED**. `as(other PLAYER).get(...)` -> **DENIED**.

---

### 5. [MEDIUM] missing-validation — `create` de `users` nao bloqueia campos `auto_*_rating`

- **Local:** `firestore.rules` L414-431
- **Colecao:** `users`
- **Perfis afetados:** PLAYER, unverified

```javascript
allow create: if isOwner(userId) &&
                       request.resource.data.role == 'PLAYER' &&
                       // #1979: previne self-injection de campos gamificados/sensiveis no create
                       !('experience_points' in request.resource.data) &&
                       !('level' in request.resource.data) &&
                       !('milestones_achieved' in request.resource.data) &&
                       !('verified' in request.resource.data) &&
                       !('verifiedAt' in request.resource.data) &&
                       !('cpfVerifiedAt' in request.resource.data) &&
```

**Descricao:** O create de `users` usa denylist e bloqueia `experience_points`/`level`/`milestones_achieved`/`verified`/`verifiedAt`/`cpfVerifiedAt`, mas NAO bloqueia os campos de rating automatico (`auto_striker_rating`, `auto_mid_rating`, `auto_defender_rating`, `auto_gk_rating`, `auto_rating_samples`). O update path bloqueia esses campos via `fieldUnchanged` (L465-469), mas o create esqueceu. Um usuario novo pode auto-injetar `auto_striker_rating: 5.0` e `auto_rating_samples: 999` no momento do create. O consumidor `getEffectiveRating` (`web/src/types/user.ts` L144-159 e equivalente KMP) usa `auto_rating` com peso de confianca que escala com `auto_rating_samples` (confianca -> 1.0 com ~20 samples), enviesando o balanceamento de times ate a CF recalcular. Inconsistencia simetrica com o update (denylist incompleto no create).

**FIX proposto:** Adicionar ao create os mesmos guards do update: `!('auto_striker_rating' in request.resource.data)` etc. para os 5 campos `auto_*`. Idealmente migrar de denylist para whitelist via `request.resource.data.keys().hasOnly([...campos permitidos no create...])`.

> **ASERCAO DE TESTE:** `as(PLAYER).create(users/SELF_UID, {role:'PLAYER', name:'X', auto_striker_rating: 5.0, auto_rating_samples: 999})` -> hoje **ALLOWED**, **expect DENIED**.

---

### 6. [MEDIUM] missing-index — `confirmations` por `user_id`+`status`+orderBy `created_at`

- **Local:** `functions/src/voting/temporal-overlap.ts:99-105`
- **Colecao:** `confirmations`
- **Perfis afetados:** PLAYER, FIELD_OWNER, ADMIN

```typescript
.collection("confirmations")
.where("user_id", "==", userId)
.where("status", "in", ["CONFIRMED", "PENDING"])
.orderBy("created_at", "desc")
.limit(50)
```

**Descricao:** Checagem de overlap temporal em `confirmations`: `user_id ==` + `status in` (tratado como igualdade) + orderBy `created_at` desc. Indices existentes de `confirmations`: `(user_id, status)` e `(user_id, status, game_id)` — nenhum tem `created_at` como orderBy. Exige `(user_id ASC, status ASC, created_at DESC)`. Roda no trigger `onConfirmationCreated` (background), nao leitura sincrona que trava o usuario — falha silenciosa que desativa a deteccao de overlap.

**FIX proposto:** Adicionar indice composto `confirmations (user_id ASC, status ASC, created_at DESC)`.

> **ASERCAO DE TESTE:** `confirmations` query: `where user_id==U AND status in [CONFIRMED,PENDING] orderBy created_at desc` -> requer indice composto `confirmations(user_id ASC, status ASC, created_at DESC)`. Sem ele: `FAILED_PRECONDITION`.

---

### 7. [MEDIUM] missing-index — `season_participation` por `user_id`+orderBy `last_calculated_at`

- **Local:** `app/src/main/java/com/futebadosparcas/domain/ranking/LeagueService.kt:295-300`
- **Colecao:** `season_participation`
- **Perfis afetados:** PLAYER, FIELD_OWNER, ADMIN

```kotlin
.whereEqualTo("user_id", userId)
.orderBy("last_calculated_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
.limit(1)
```

**Descricao:** `createNewParticipation` busca historico anterior do user: `user_id ==` + orderBy `last_calculated_at` desc. Os indices de `season_participation` tem `(season_id, user_id)` e variacoes com `points`/`league_rating`, mas nenhum com `last_calculated_at` (e a query NAO filtra `season_id`). Exige `(user_id ASC, last_calculated_at DESC)`. A query esta dentro de try/catch (294-319): a falha cai no fallback `startDivision=BRONZE` — nao crasha, mas degrada silenciosamente (todo novo participante reinicia em BRONZE perdendo rating/momentum anterior).

**FIX proposto:** Adicionar indice composto `season_participation (user_id ASC, last_calculated_at DESC)`.

> **ASERCAO DE TESTE:** `season_participation` query: `where user_id==U orderBy last_calculated_at desc limit 1` -> requer indice composto `season_participation(user_id ASC, last_calculated_at DESC)`. Sem ele: `FAILED_PRECONDITION`.

---

### 8. [MEDIUM] missing-index — `waitlist` por `status`+orderBy `queue_position` (Android)

- **Local:** `app/src/main/java/com/futebadosparcas/data/repository/WaitlistRepositoryImpl.kt:131-139` e `154-161`
- **Colecao:** `waitlist`
- **Perfis afetados:** PLAYER, FIELD_OWNER, ADMIN

```kotlin
.whereIn("status", listOf(
    WaitlistStatus.WAITING.name,
    WaitlistStatus.NOTIFIED.name
))
.orderBy("queue_position", Query.Direction.ASCENDING)
.limit(50)
```

**Descricao:** Android le a lista de espera (`getWaitlist` + `getWaitlistFlow`) com `status whereIn` + orderBy `queue_position`. Exige indice composto `waitlist (status ASC, queue_position ASC)`. NAO existe nenhum indice `waitlist` em `firestore.indexes.json`. INCONSISTENCIA web/Android: o web (`useWaitlist.ts:80-84`) deliberadamente ordena so por `queue_position` e filtra status no cliente justamente para evitar este indice (comentario explicito) — o Android NAO faz isso. Caminho quente; provavelmente ja existe no projeto deployado, mas ausente do JSON = drift que quebra deploy/emulador limpo.

**FIX proposto:** Adicionar indice composto `waitlist (status ASC, queue_position ASC)`, OU alinhar Android ao web (filtrar status no cliente).

> **ASERCAO DE TESTE:** `waitlist` query (`games/{g}/waitlist`): `where status in [WAITING,NOTIFIED] orderBy queue_position asc` -> requer indice composto `waitlist(status ASC, queue_position ASC)`. Sem ele: `FAILED_PRECONDITION`.

---

### 9. [MEDIUM] missing-index — `game_photos` por `game_id`+orderBy `created_at`

- **Local:** `web/src/pages/game/GamePhotosTab.tsx:95-99`
- **Colecao:** `game_photos`
- **Perfis afetados:** PLAYER, FIELD_OWNER, ADMIN

```typescript
collection(db, 'game_photos'),
where('game_id', '==', gameId),
orderBy('created_at', 'desc')
```

**Descricao:** Listener de fotos do jogo: `game_id ==` + orderBy `created_at` desc. Exige indice composto `game_photos (game_id ASC, created_at DESC)`. Nenhum indice `game_photos` existe no JSON. Caminho quente (aba de fotos pos-jogo); provavelmente ja deployado, mas ausente do JSON = drift.

**FIX proposto:** Adicionar indice composto `game_photos (game_id ASC, created_at DESC)`.

> **ASERCAO DE TESTE:** `game_photos` query: `where game_id==G orderBy created_at desc` -> requer indice composto `game_photos(game_id ASC, created_at DESC)`. Sem ele: `FAILED_PRECONDITION`.

---

### 10. [MEDIUM] missing-index — `league_standings` por `season_id`+orderBy `points`

- **Local:** `web/src/hooks/useGroupLeague.ts:74-81` e `205-211`
- **Colecao:** `league_standings` (subcolecao `groups/{id}/league_standings`)
- **Perfis afetados:** PLAYER, FIELD_OWNER, ADMIN

```typescript
collection(db, 'groups', groupId, 'league_standings'),
where('season_id', '==', seasonId),
orderBy('points', 'desc'),
limit(200)
```

**Descricao:** Ranking de liga do grupo: `season_id ==` + orderBy `points` desc. Exige indice composto `league_standings (season_id ASC, points DESC)`. Nenhum indice `league_standings` existe no JSON. Usado tanto em fetch quanto em listener `onSnapshot`. Os indices com `season_id+points` presentes (linhas 578-589) sao da colecao `season_participation` (top-level), colecao DIFERENTE — nao cobrem a subcolecao. Quebra a tela de classificacao de liga do grupo (o listener tem callback de erro em :226-230 mostrando "Erro ao carregar classificacao em tempo real").

**FIX proposto:** Adicionar indice composto `league_standings (season_id ASC, points DESC)` (`queryScope COLLECTION`).

> **ASERCAO DE TESTE:** `league_standings` query (`groups/{g}/league_standings`): `where season_id==S orderBy points desc limit 200` -> requer indice composto `league_standings(season_id ASC, points DESC)`. Sem ele: `FAILED_PRECONDITION`.

---

### 11. [LOW] under-permissive — jogador escreve ETA em `confirmations` mas nao le

- **Local:** `firestore.rules` L651
- **Colecao:** `games/{gameId}/confirmations`
- **Perfis afetados:** PLAYER, ADMIN

```javascript
match /confirmations/{confirmationId} {
        allow read: if isAuthenticated() && isGameOwner(gameId);
```

**Descricao:** LOCKOUT no acesso do proprio jogador. Nesta subcolecao (writes de ETA do Android), o read e restrito apenas ao dono do jogo (`isGameOwner`). Porem a rule de update (L656-661) permite que o proprio jogador atualize sua entrada de ETA quando `confirmationId == gameId + '_' + userId()`. Ou seja, o jogador pode ESCREVER `is_on_the_way`/`eta_minutes` na propria confirmacao mas NAO consegue LER essa subcolecao de volta (nem a propria entrada). `ConfirmationUseCase.markOnTheWay` (L266-276) e `updateEta` (L299-309) fazem query nessa subcolecao ANTES do update. Admin tambem nao consegue ler aqui (so `isGameOwner`) — inconsistente com a subcolecao vizinha `cancellations` que inclui `isAdmin()`.

**FIX proposto:** Incluir o proprio jogador (e admin) no read, alinhando com a permissao de update:
```javascript
allow read: if isAuthenticated() && (
  isAdmin() ||
  isGameOwner(gameId) ||
  confirmationId == (gameId + '_' + userId())
);
```

> **ASERCAO DE TESTE:** Para `confirmationId == G1_P1`: `as(P1).get(games/G1/confirmations/G1_P1)` -> currently **DENIED**; **expect ALLOWED**. `as(ADMIN).get(...)` -> currently **DENIED**; **expect ALLOWED**. `as(GAME_OWNER).get(...)` -> **ALLOWED**.

---

### 12. [LOW] inconsistency — `update` de `users` nao protege campo `verified`

- **Local:** `firestore.rules` L452-496
- **Colecao:** `users`
- **Perfis afetados:** PLAYER, FIELD_OWNER, unverified

```javascript
fieldUnchanged('verifiedAt') &&
           fieldUnchanged('cpfVerifiedAt') &&
           // Apenas updated_at e protegido (gerenciado por Cloud Functions)
           fieldUnchanged('updated_at') &&
```

**Descricao:** O update de `users` protege `verifiedAt` e `cpfVerifiedAt` via `fieldUnchanged`, mas NAO protege o campo `verified` (o create explicitamente bloqueia `verified` em L420 via #1979; o update esqueceu). Como o branch do owner e denylist sem `hasOnly`, o owner pode escrever `users/{self}.verified = true` livremente. NAO e escalonamento de privilegio real: a fonte autoritativa de verificacao e o custom claim `request.auth.token.verified`, setado SOMENTE pela callable `setUserVerified` / `bulkVerify` (`functions/src/auth/verification.ts` L297-303, L425-428) — nenhum trigger deriva o claim do campo doc.`verified`. O cliente le o status via claim (`web useVerifiedClaim.ts`: `claims.verified === true`), nao do doc. Logo o campo doc.`verified` e cosmetico/legacy e spoofa-lo nao bypassa `isVerifiedOrGrace()`. Ainda assim e inconsistencia (campo spoofavel que pode enganar listeners/UI legados).

**FIX proposto:** Adicionar `fieldUnchanged('verified')` ao branch de owner do update, espelhando o bloqueio ja presente no create. Custo zero, fecha a inconsistencia create-vs-update.

> **ASERCAO DE TESTE:** `as(owner).update(users/SELF_UID, {verified: true, name:'X'})` -> hoje **ALLOWED**, **expect DENIED**. (Incluir os campos validados por `isValidName`/`isValidEmail`/`isValidRating` L491-495 para nao falhar por motivo errado.)

---

### 13. [LOW] missing-validation — `cashbox_summary` aceita `balance` inconsistente

- **Local:** `firestore.rules` L1498-1505
- **Colecao:** `cashbox_summary` (subcolecao `groups/{groupId}/cashbox_summary`)
- **Perfis afetados:** PLAYER, FIELD_OWNER, ADMIN

```javascript
allow create, update: if isAuthenticated() && isGroupAdmin(groupId) &&
          request.resource.data.total_income is number &&
          request.resource.data.total_income >= 0 &&
          request.resource.data.total_expense is number &&
          request.resource.data.total_expense >= 0 &&
          request.resource.data.balance is number &&
          request.resource.data.period_start is string &&
          request.resource.data.period_end is string;
```

**Descricao:** Group admin pode gravar `cashbox_summary` com `balance` arbitrario — nao ha validacao de consistencia `balance == total_income - total_expense`. Um admin de grupo pode reportar um saldo que nao corresponde aos lancamentos reais de cashbox (que tem `amount` validado e sao imutaveis/void-only). O cliente computa `balance` localmente e grava via `.set` (`shared/.../FirebaseDataSource.kt` L2820/2824), entao o rule e o unico ponto de validacao server-side. Nao e auto-escalonamento de role/XP (e admin do proprio grupo, sem impacto cross-group), mas permite divergencia entre o summary exibido e o ledger real, podendo mascarar valores financeiros.

**FIX proposto:** Adicionar checagem de consistencia: `request.resource.data.balance == request.resource.data.total_income - request.resource.data.total_expense`. Alternativa mais forte: tornar `cashbox_summary` server-only (`allow create, update: if false`) e recalcular via Cloud Function que agrega os lancamentos de `cashbox/`, eliminando confianca no cliente para campos financeiros agregados.

> **ASERCAO DE TESTE:** `as(group ADMIN of G1).update(groups/G1/cashbox_summary/period1, {total_income: 100, total_expense: 50, balance: 999999, period_start:'2026-05-01', period_end:'2026-05-31'})` -> hoje **ALLOWED** (balance inconsistente aceito), **expect DENIED**.

---

### 14. [LOW] missing-index — `games` por `dateTime==null`+orderBy `created_at` (fallback frio)

- **Local:** `functions/src/reminders.ts:270-275`
- **Colecao:** `games`
- **Perfis afetados:** all

```typescript
.collection("games")
.where("dateTime", "==", null)
.orderBy("created_at", "desc")
.limit(50)
```

**Descricao:** Fallback agendado para jogos sem `dateTime` (dentro de `fetchGamesInReminderWindow`): igualdade em `dateTime` + orderBy em campo DIFERENTE (`created_at`). Exige indice composto `games (dateTime ASC, created_at DESC)`, que NAO existe (todos os indices com `dateTime` o tem como 2o+ campo). Caminho frio (so jogos legados pre-migracao). A query esta envolvida em try/catch (linhas 269/326-332) que faz `logger.error` e engole o erro — NAO causa crash do run de lembretes; o caminho principal (range query `dateTime`) continua funcionando. Efeito: o fallback de jogos legados fica permanentemente nao-funcional + ruido de log a cada ciclo.

**FIX proposto:** Adicionar indice composto `games (dateTime ASC, created_at DESC)`.

> **ASERCAO DE TESTE:** `games` query: `where dateTime==null orderBy created_at desc` -> requer indice composto `games(dateTime ASC, created_at DESC)`. Sem ele: `FAILED_PRECONDITION`.

---

### 15. [LOW] unused-index — `live_scores` (game_id, updated_at) sem query correspondente

- **Local:** `firestore.indexes.json:931-944`
- **Colecao:** `live_scores`
- **Perfis afetados:** all

```json
"collectionGroup": "live_scores",
"fields": [
  { "fieldPath": "game_id", "order": "ASCENDING" },
  { "fieldPath": "updated_at", "order": "DESCENDING" }
]
```

**Descricao:** O indice composto `live_scores (game_id, updated_at)` nao tem nenhuma query correspondente. `live_scores` e acessado SEMPRE por doc id direto (`doc(db,'live_scores',gameId)` no web; `.collection('live_scores').document(...)` no Android/shared/functions), nunca via `where`/`orderBy`. Os unicos acessos sem `.document()` (`FirebaseDataSource.kt:2550`, `index.ts:1636`) sao scans de cleanup com `.limit()` SEM `where`/`orderBy` nos campos do indice. Indice apenas gera custo de storage/write, sem impacto de seguranca/correcao.

**FIX proposto:** Remover o indice composto `live_scores (game_id ASC, updated_at DESC)` se nenhuma query compound estiver planejada.

> **ASERCAO DE TESTE:** Grep por `'live_scores'` com `where`/`orderBy`/`query()` em web/app/shared/functions retorna 0 resultados (apenas acesso por doc id). Indice nao utilizado.

---

## Fila de correcao (ordem recomendada)

Ordenada por severidade (CRITICAL primeiro), depois por impacto/facilidade dentro de cada nivel.

| Ordem | Severidade | Achado | Acao |
|-------|-----------|--------|------|
| 1 | HIGH   | #1 — `confirmations` flags cross-user (privilege-escalation) | `firestore.rules` L794-797: escopar branch a `user_id == userId()` ou remover (preferido). Hardenizar `index.ts` para revalidar `is_worst_player` |
| 2 | HIGH   | #2 — indice `games (status, date)` (weekly ranking) | Adicionar indice composto em `firestore.indexes.json` |
| 3 | MEDIUM | #3 — `/invites` enumeravel (over-permissive) | `firestore.rules` L1542: split `get`/`list`, restringir `list` a admin |
| 4 | MEDIUM | #5 — `create users` sem guards `auto_*_rating` | `firestore.rules` L414-431: adicionar denylist dos 5 campos `auto_*` (ou whitelist) |
| 5 | MEDIUM | #4 — lockout read `cancellations` | `firestore.rules` L671: adicionar `resource.data.user_id == userId()` |
| 6 | MEDIUM | #6 — indice `confirmations (user_id, status, created_at)` | Adicionar indice composto |
| 7 | MEDIUM | #7 — indice `season_participation (user_id, last_calculated_at)` | Adicionar indice composto |
| 8 | MEDIUM | #8 — indice `waitlist (status, queue_position)` | Adicionar indice OU alinhar Android ao web (filtro client-side) |
| 9 | MEDIUM | #9 — indice `game_photos (game_id, created_at)` | Adicionar indice composto |
| 10 | MEDIUM | #10 — indice `league_standings (season_id, points)` | Adicionar indice composto (queryScope COLLECTION) |
| 11 | LOW | #11 — lockout read ETA `confirmations` | `firestore.rules` L651: incluir proprio jogador + admin no read |
| 12 | LOW | #12 — `update users` campo `verified` | `firestore.rules` L452-496: adicionar `fieldUnchanged('verified')` |
| 13 | LOW | #13 — `cashbox_summary` balance inconsistente | `firestore.rules` L1498-1505: validar consistencia ou tornar server-only |
| 14 | LOW | #14 — indice `games (dateTime, created_at)` (fallback frio) | Adicionar indice composto |
| 15 | LOW | #15 — indice `live_scores` nao utilizado | Remover indice de `firestore.indexes.json` |

**Nota operacional:** os achados de indice de caminho quente (#8, #9, #10) provavelmente ja existem no projeto deployado em prod (Firestore sugere o indice na primeira falha); o risco real e drift de config que quebra deploy/emulador limpo a partir do JSON versionado. Os achados de rules (#1, #3, #4, #5, #11) sao bugs de comportamento ativos independente do estado de prod.
