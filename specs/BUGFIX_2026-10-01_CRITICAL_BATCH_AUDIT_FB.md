# BUGFIX: Batch crítico — integridade Functions, rules de games e Android DM/push (#4119, #4126, #4127, #4128, #4133, #4138, #4140, #4144, #4147)

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL`
> **Autor:** opencode (aprovado pelo product owner em 2026-10-01)
> **Data:** 2026-10-01
> **PR:** (sequência de PRs por área — ver §9)

---

## 1. Descrição dos Bugs

Nove issues de auditoria abertas em `master` `e0d1bfaa`, agrupadas por causa raiz:

| Issue | Área | Resumo |
|-------|------|--------|
| #4147 | Functions | `stripUndefinedValues` destrói `FieldValue.serverTimestamp()`, `Timestamp` e `GeoPoint` (viram `{}` / mapa) — 2/2 jogos auto-cancelados desde 07-07 com 4 carimbos corrompidos; filho de recorrência nasce com `dateTime` mapa |
| #4128 | Functions | `listManagedGroupIds` usa `collectionGroup('league_seasons').where('is_active')` sem índice COLLECTION_GROUP → `startNewSeason`/`archiveSeason` falham todo dia desde 08-01 |
| #4133 | Functions | `autoCancelLowQuorum` cancela jogo **CHEIO** (`min_players` default 6 vs `max_players` 2–5) e não avisa a waitlist; sem opt-out (critérios #1786) |
| #4144 | Functions+clients | Vaga aberta não promove waitlist: sem trigger `onDelete` de `confirmations`; cooldown de 5 min engole a 2ª vaga; Android e web (sair/remover do grupo) ainda apagam confirmações |
| #4138 | Functions+web+Android | Badges invisíveis: ambassador/mito/mvp_liga gravam só em subcoleção sem leitor; IDs divergentes web×functions×Android; Android lê catálogo `badges` raiz que ninguém escreve |
| #4126 | Rules | LIST de `/games` vaza jogos `GROUP_ONLY` e soft-deleted: `resource.data.get('visibility', null)` e `'deleted_at' in resource.data` viram default-satisfatível na avaliação de query |
| #4127 | Android | Conflito de quadra faz LIST direta em `games` (vaza doc privado ou vira double-booking silencioso) — callable `getFieldAvailability` existe mas só web migra |
| #4119 | Android | `DirectMessagesRepository.sendMessage` faz batch direto — rules exigem callable `submitDirectMessage` → DM 100% negada em prod |
| #4140 | Android | Push em background cai no launcher sem extras: `click_action: FLUTTER_NOTIFICATION_CLICK` sem intent-filter; falta `default_notification_channel_id` |

---

## 2. Análise de Causa Raiz (pesquisa realizada 2026-10-01)

### 2.1 #4147 — stripUndefinedValues
- 2 cópias idênticas: `functions/src/games/auto-close-past-games.ts:295-311` e `functions/src/games/recurrence-engine.ts:283-299`.
- `Object.entries` sobre qualquer `typeof === 'object'`: `FieldValue.serverTimestamp()` → `[]` → `{}`; `Timestamp`/`GeoPoint` → mapa `{_seconds,_nanoseconds}`.
- Consumidores: `cancelPastGameIfStillActive` (auto-close:469-473), `commonUpdate` (:523), `buildRecurringGame` (recurrence:429).

### 2.2 #4128 — temporada
- `functions/src/growth/season-cycle.ts:76-80`: query `collectionGroup('league_seasons').where('is_active','==',true).limit(2000)` sem índice collection-group em `firestore.indexes.json` (172 indexes, 11 COLLECTION_GROUP, nenhum de `league_seasons`).
- Saturação silenciosa: limites 500/2000 só logam warn (:65-91).

### 2.3 #4133 — quórum
- `functions/src/reminders.ts:1285-1287`: `minPlayers = currentGameData.min_players || AUTO_CANCEL_MIN_PLAYERS(6)`; decisão :1294-1315 ignora `max_players`.
- Nenhum cliente escreve `min_players` (web `useGames.ts` createGame, Android — 0 writes); único write = seed script.
- Cancelamento (:1337-1396) não toca waitlist.
- `autoClosePastGames.ts:335-347`: `decidePastGameClosure` sempre CANCELLED/auto_expired.

### 2.4 #4144 — waitlist
- `onGameVacancy` é `onDocumentUpdated('confirmations/{id}')` (`game-notifications.ts:513`); **não existe** `onDocumentDeleted` de confirmations no repo.
- Cooldown 5 min (:32, :583-601) trava promoção + push juntos.
- Android cancelConfirmation corrigido (update→CANCELLED) existe só no `FirebaseDataSourceImpl.kt` (KMP, morto); o Android app apaga (batch delete). Web `sair/remover do grupo` apaga confirmações.

### 2.5 #4138 — badges
- 4 locais de escrita + subcoleção `users/{uid}/badges` sem mirror em `user_badges` raiz para `ambassador_*` (`badges/ambassador-badge.ts`), `mito_rodada_*` (`growth/weekly-ranking.ts:363-390`), `mvp_liga_*` (`growth/season-cycle.ts:506-518`).
- Web `BADGE_DEFINITIONS` (gamification.ts:271-299) tem 27 IDs com case misto (`HAT_TRICK`, `PAREDAO`, `MITO`) divergentes dos gravados (`hat_trick`, `paredao`, `mito_rodada_*`).
- Android `BadgesViewModel.kt:84-96,150-153` lê catálogo da coleção raiz `badges` (nunca escrita por functions) → Empty. O catálogo estático `BadgeDefinitions.kt` (24 IDs) não é usado na tela.
- Push de badge usa o `badge_id` cru no texto ("Você desbloqueou: hat_trick!").

### 2.6 #4126 — rules
- `firestore.rules:1100-1104`: `resource.data.get('visibility', null) != 'GROUP_ONLY'` — `.get()` com default torna a condição default-satisfatível na avaliação de LIST → query sem filtro devolve jogos privados; `'deleted_at' in resource.data` idem.
- Único teste de LIST: `firestore-rules-tests/src/games.test.ts:242-247`.
- Clientes sem filtro server-side: web `useGames.ts:92-107` (GamesTab, GroupDetail), `usePrefetchHome`, `useNextGame`, `SearchPanel`, `usePublicGames` (variante map); Android `FirebaseDataSource.kt:62-88` (getUpcomingGames), `:116-144` (getConfirmedGamesForUser).
- Índices compostos com `visibility`+`deleted_at` já existem (firestore.indexes.json:2686-2712).

### 2.7 #4127 — conflito de quadra
- `GameQueryRepositoryImpl.kt:1585-1600` LIST direta; `CreateGameViewModel.kt:794` engole erro; `FieldAvailabilityService.kt:53` `getOrNull() ?: emptyList()`.
- Callable `getFieldAvailability` (functions/src/games/field-availability.ts) já existe e é usada pelo web.
- **Ordem obrigatória**: #4127 (Android) DEVE mergear junto ou antes do tighten de rules do #4126, senão double-booking silencioso.

### 2.8 #4119 — DM
- `DirectMessagesRepository.kt:99-133` batch direto; rules `firestore.rules:1032` `allow create: if false` em `/messages`; `:1022` só receipt updates no chat.
- Callable `submitDirectMessage` (functions/src/social/direct-messages.ts:409-544): payload `{chatId, text 1..1000}` → `{messageId}`; App Check em prod; rate limit 20/min.
- Padrão de callable no app existe: `createChat` (:91-97) já usa `getHttpsCallable`.

### 2.9 #4140 — push
- `FcmService.kt` só roda em foreground (data-only); em background o FCM SDK entrega a notification ao tray e o tap abre o launch intent (SplashActivity) — extras não repassados.
- `sendNotificationToUser` (`notifications/helpers.ts:617-654`): `channelId: notification.type` (não existe no app), `clickAction: FLUTTER_NOTIFICATION_CLICK` sem intent-filter.
- Manifest sem `com.google.firebase.messaging.default_notification_channel_id`.

---

## 3. Solução Proposta

### 3.1 PR-A — `fix(functions): preservar sentinels e destravar temporada (#4147, #4128)`
1. Novo util compartilhado `functions/src/utils/strip-undefined.ts`: recursa apenas objetos plain e arrays; preserva instâncias de `FieldValue`, `Timestamp`, `GeoPoint` (via `instanceof`). Trocar as 2 cópias.
2. `firestore.indexes.json`: novo index `{collectionGroup: 'league_seasons', queryScope: 'COLLECTION_GROUP', fields: [{fieldPath: 'is_active', order: 'ASCENDING'}]}`.
3. `listManagedGroupIds`: paginação com `startAfter` (páginas de 500, cap 2000 com warn CRITICAL).
4. Testes: util com sentinelas (serverTimestamp/Timestamp/GeoPoint preservados, undefined removido); testes de paginação existentes continuam passando.

### 3.2 PR-B — `fix(functions): quórum, waitlist e cancelamento (#4133, #4144)`
1. **Quórum efetivo** (`reminders.ts`): `effectiveMin = Math.min(min_players ?? 6, max_players ?? MAX)`; jogo com confirmados >= effectiveMin não cancela. `decidePastGameClosure` idem.
2. **Opt-out (#1786)**: campo `auto_cancel_enabled: false` no doc do jogo desativa o cancelamento (web expõe checkbox opcional — item de UI pequeno; default ligado).
3. **Waitlist no auto-cancel (#1786)**: ao cancelar, marcar entradas WAITING/NOTIFIED como `EXPIRED (game_cancelled)` e enviar push à waitlist; audit log `audit_logs` com reason `LOW_QUORUM`.
4. **Trigger `onDocumentDeleted('confirmations/{id}')`**: extrai o núcleo de promoção do `onGameVacancy` para helper compartilhado; no delete de confirmação CONFIRMED roda a mesma promoção.
5. **Cooldown**: promoção da waitlist deixa de ser travada pelo cooldown de 5 min; cooldown passa a valer só para o push de broadcast aos membros do grupo.
6. **Web**: sair/remover membro do grupo troca `deleteDoc` da confirmação por `updateDoc {status:'CANCELLED'}`.
7. **Android**: cancelar confirmação usa update→CANCELLED no repositório real do app (batch update, alinhado ao fix #3399 do web).

### 3.3 PR-C — `fix(badges): unificar catálogo e espelhar subcoleções (#4138)`
1. **Functions**: `ambassador-badge.ts`, `weekly-ranking.ts` (mito), `season-cycle.ts` (mvp_liga) passam a gravar também em `user_badges` raiz (mesmo padrão `{uid}_{badge_id}`) com `badge_id`, `display_name`, `type`, `earned_at`. Push de badge usa `display_name`.
2. **Web**: `BADGE_DEFINITIONS` normalizado para os IDs reais gravados (lowercase `hat_trick`, `paredao`; milestones UPPERCASE `GAMES_*`/`GOALS_*`...; novos: `poker`, `manita`, `playmaker`, `balanced_player`, `clean_sheet`, `defensive_wall`, `iron_man`, `streak_30` já existente, `veteran_*`, `winner_*`, `level_*`, `mvp_streak_3`, `mesa_oficial_*`, `onipresente`, `rei_das_quartas`, `carrasco`, `ambassador_*` genérico, prefixos dinâmicos `mito_rodada_`/`mvp_liga_`). IDs sem writer (`first_game`, `streak_3`, `mvp_50`, `goals_500`, `assists_200`, `saves_10/50`, `ARTILHEIRO_MES`, `FOMINHA`, `ORGANIZADOR_MASTER`, `INFLUENCER`, `LENDA`, `FAIXA_PRETA`) permanecem no catálogo como "em breve" (sem unlock falso).
3. **Android**: `BadgesViewModel` lê catálogo estático `BadgeDefinitions` (estendido com os IDs faltantes) + unlockeds de `user_badges` raiz (query já existe em FirebaseDataSource.kt:3033); remove leitura da coleção `badges` raiz.
4. **Backfill**: script admin `functions/src/scripts/backfill-badges-mirror.js` espelhando as badges só-em-subcoleção existentes para `user_badges` raiz (17/17 em prod).

### 3.4 PR-D — `fix(rules): restringir LIST de games + Android disponibilidade de quadra (#4126, #4127)` — **merge depois do PR-B e junto com migração dos clientes**
1. **Rules** (`/games/{gameId}`): list/get passam a usar acesso direto de campos:
   - `resource.data.deleted_at == null` (soft-deleted protegido);
   - `resource.data.visibility in ['PUBLIC_OPEN','PUBLIC_CLOSED']` OU `resource.data.owner_id == request.auth.uid` OU (`resource.data.group_id != null && isGroupMember(...)` OU admin OU convite próprio (get apenas));
   - LIST exige filtro correspondente do cliente (constraint provável).
2. **Web**: `useGames` (todas variantes), `usePrefetchHome`, `useNextGame`, `usePublicGames(map)`, `SearchPanel` ganham `where('deleted_at','==',null)` + filtro de `visibility in [...]` ou `owner_id`/`group_id` conforme o caso de uso.
3. **Android (#4127)**: `getGamesByFieldAndDate`/`checkTimeConflict` → callable `getFieldAvailability` (fieldId, startDate D-1, endDate D); overlap sobre slots sanitizados; `TimeConflict` sem `Game` (mostra "Horário ocupado (HH:mm–HH:mm)"); falha da callable mostra aviso (não engole).
4. **Android**: `getUpcomingGames` e `getConfirmedGamesForUser` ganham filtros server-side (`visibility in [...]` / `deleted_at == null`).
5. **Rules tests**: LIST sem filtro com doc GROUP_ONLY na janela → deny; doc soft-deleted na janela → deny; owner lista o próprio jogo → allow; membro lista jogos do grupo (com filtro group_id) → allow.

### 3.5 PR-E — `fix(android): DM via callable e push abre o app (#4119, #4140)`
1. **DM**: `DirectMessagesRepository.sendMessage` → `functions.getHttpsCallable("submitDirectMessage").call(mapOf("chatId" to chat.id, "text" to cleanText))`; mapeia `resource-exhausted` (retryAfter), `permission-denied` (bloqueio), `not-found`; remove o batch.
2. **Push**:
   - Manifest: `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="futeba_notifications"/>`.
   - Intent-filter `FLUTTER_NOTIFICATION_CLICK` (com `DEFAULT`) na SplashActivity + repasse dos extras (`gameId`, `notificationType`, `action`) ao `MainActivityCompose.handleIntentExtras`.
   - Functions `sendNotificationToUser`: `channelId` fixo `futeba_notifications` (canal único que o app cria), mantendo o resto.

### 3.6 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Tighten de rules quebra listas existentes | Migração de clientes no mesmo PR (PR-D); testes de rules cobrindo cada caso; deploy rules só após índices READY |
| Índice collection-group ausente em prod | Deploy de `firestore.indexes.json` e aguardar READY antes de deploy Functions (PR-A) |
| Quórum efetivo muda comportamento de jogos legados | effectiveMin = min(min_players, max_players) é monotônico — só reduz cancelamentos indevidos; testes para jogo cheio max 5 |
| Cooldown sem gate vira spam de push | Cada promoção notifica 1 pessoa nova (promotee) — não é broadcast; broadcast mantém cooldown |
| DM Android com App Check | App Android já atende App Check (play integrity) — callable exige enforceAppCheck; validar em staging/emulador |
| Backfill badges duplica docs | Id determinístico `{uid}_{badge_id}` + `set(..., {merge:true})` idempotente |

---

## 4. Verificação

### 4.1 Testes
- [ ] functions: strip-undefined com FieldValue/Timestamp/GeoPoint (PR-A)
- [ ] functions: quórum com max_players < default (jogo cheio não cancela), opt-out, waitlist no cancelamento (PR-B)
- [ ] functions: promoção via onDelete de confirmação; 2ª vaga dentro de 5 min promove (PR-B)
- [ ] functions: mirror de badges ambassador/mito/mvp_liga (PR-C)
- [ ] rules: LIST deny GROUP_ONLY/soft-deleted sem filtro; allow owner/group/public (PR-D)
- [ ] web: vitest dos hooks com filtros server-side (PR-D)
- [ ] android: unit tests dos ViewModels afetados + compileDebugKotlin (PR-E)

### 4.2 Checklist
- [ ] `npm run build && npm run lint` em functions e web
- [ ] `./gradlew :app:compileDebugKotlin` + testes Android
- [ ] Rules tests passam no emulador
- [ ] CI com 4 gates verde

---

## 5. Prevenção Futura
- [ ] Gate de paridade web/Android para caminhos "callable vs escrita direta" (lista de callables autoritativas em docs)
- [ ] Teste de rules para cada nova coleção LIST
- [ ] Lint customizado: proibir `resource.data.get(` em rules de list

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-10-01 | opencode | Spec criada a partir da auditoria (issues #4119–#4147) |
| 2026-10-01 | opencode | Aprovada pelo product owner (plano "Tudo") |