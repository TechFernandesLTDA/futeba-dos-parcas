# BUGFIX: Lote de issues abertas — auditoria Firebase, a11y, design system e paridade iOS (#4096–#4115)

> **Status:** `FIXED`
> **Severidade:** `HIGH` (6 issues high, 4 medium, 4 chore)
> **Autor:** Claude Code (a pedido do owner do repo)
> **Data:** 2026-09-21
> **PR:** #4118 (substitui #4117)

---

## 1. Escopo

Fecha todas as 14 issues abertas em `origin/master` `e0d1bfaa`, agrupadas por
área. Cada issue tem evidência e critérios de aceite no próprio corpo no GitHub;
esta spec registra apenas a abordagem escolhida e os arquivos tocados.

| Área | Issues | Arquivos principais |
|------|--------|---------------------|
| Functions — cobrança de quadras | #4107, #4111 | `functions/src/locations/location-management.ts`, `venue-account-shared.ts`, `scripts/backfill-venue-commercial-data.ts`, `monitoring/alerting.ts` |
| Functions — contas | #4112, #4113 | `functions/src/auth/account-merge.ts`, `account-cleanup.ts`, novo `uid-owned-collections.ts` |
| Functions — cascata de grupo | #4100 | `functions/src/index.ts` (`onGroupDeleted`), novo `functions/src/groups/group-cascade.ts` |
| Web | #4114, #4110 (leitura), #4113 (tipo) | `web/src/theme/index.ts`, `contexts/ThemeContext.tsx`, `pages/locations/manageLocationFilters.ts`, `types/group.ts` |
| Android | #4108, #4099 | `ui/components/design/AppTopBars.kt`, `ui/theme/DivisionColors.kt`, `LocalContrastLevel` |
| Design system (3 plataformas) | #4115 | `shared/design-tokens.json`, `AppMotion.kt`, `Motion.kt`, `web/src/theme/motion.ts`, `scripts/check-design-tokens-parity.js` |
| composeApp / iOS | #4096, #4098, #4109, #4097 | `ui/core/PostGameReportScreen.kt`, `ui/theme/Color.kt`, `Typography*.kt`, `compose/App.kt`, nova tela de tema |

---

## 2. Abordagem por issue

### #4107 — `billing_expires_at` nunca comparado com o relógio
- Guarda simétrica à de `billing_starts_at` no cron `processLocationBillingCycles`.
- Contrato vencido transiciona para `CANCELLED` com evento de ledger próprio,
  uma única vez; não gera novo `subscription_cycles`.
- `resolveLocationCommercialStatus` emite `contractExpired` e tira a quadra de
  `ready_for_publication_approval`.
- `resolveSubscriptionStatusAfterApprovedPayment` não devolve `ACTIVE` para
  contrato vencido.

### #4111 — `continue` silenciosos, TRIAL sem envelhecimento, defaults divergentes
- Helper único para o default de `subscription_status` ausente/inválido,
  usado pelos 4 leitores.
- Doc de execução por rodada do cron (`billing_automation_runs/{runId}`) com
  contadores **e** listas de IDs (skipped / inconsistent / expired / agedTrial).
- Alerta em `monitoring/alerting.ts` quando `inconsistentLocations > 0`.
- `trial_started_at` gravado ao entrar em TRIAL (backfill = primeira observação
  pelo cron). TRIAL com mais de `TRIAL_MAX_DAYS` (30) emite `trialExpired` em
  `commercial_issue_codes` — status permanece TRIAL (decisão de produto: sem
  transição automática, mas vira pendência visível).
- Backfill sinaliza `review.push` para `subscription_status` inválido e
  `billing_due_day` ausente.

### #4110 — `venue_account_status` sombreia `subscription_status`
- Web: `getLocationSubscriptionStatus` passa a devolver o **mais severo** entre
  status individual e status da conta. `getLocationCommercialIssues` avalia os
  dois eixos de forma independente (dois `if`).
- Backend: sem mudança — o cron continua dono de `subscription_status`; o
  status da conta permanece eixo separado, agora combinado corretamente na leitura.

### #4112 — `completeAccountMerge` não migra gamificação
- Migra/funde `statistics` (soma de contadores), `xp_logs`, `user_badges`
  (união preservando data original), `season_participation` (funde e remove a
  origem do ranking), `mvp_votes`, `activities`.
- Lista canônica de coleções por uid em `functions/src/auth/uid-owned-collections.ts`,
  compartilhada por merge e cleanup.
- `manifest` reporta contagem por coleção.

### #4113 — anonimização de `groups` é código morto (LGPD)
- `groups`: anonimiza por `owner_id`/`owner_name` (forma real do escritor),
  mantendo o ramo camelCase apenas como legado.
- `groups/{id}/members/{uid}`: anonimiza `user_name`/`user_photo_url`.
- Ramo morto `members[]` de objetos removido; `group_invites` incluída.
- Testes usam o payload real de `useGroups.ts`.

### #4113 (continuação) — índices collection-group e PII de caixa
- Índices `COLLECTION_GROUP` declarados em `firestore.indexes.json` para
  `cashbox.created_by` e `reviews.user_id` (anonimização) e `members.user_id`
  (`findUpcomingOpenGameForUser` em `gamification-nudges.ts`). Os índices de
  escopo de coleção são mantidos. Sem eles a query falha com
  `FAILED_PRECONDITION`, tratado como permanente, e a PII sobrevive.
- Query `collectionGroup("activities").where("targetUserId")` removida: nenhum
  escritor grava `targetUserId` em activities, então a query nunca casava e
  dependia de um índice inexistente.
- `player_name` em `groups/{g}/cashbox` (`player_id == uid`) e `user_name` /
  `user_photo_url` em `groups/{g}/monthly_finance_periods/{p}/payers/{uid}`
  passam a ser anonimizados. Os grupos vêm de `users/{uid}/groups`, com queries
  de escopo de coleção e sem índice novo. Limitação: grupos que o usuário já
  deixou não aparecem nessa lista.
- Não verificado: o estado dos índices em produção, porque este ambiente não
  tem credenciais do Firebase.

### #4113 (continuação 2) — PII em avaliações pós-jogo e na descrição do caixa
**Requisito:** ao excluir a conta, nome e foto do usuário não podem sobreviver
em `post_game_reputation` nem na descrição livre de lançamentos do caixa.

**Escritores confirmados:**
- `functions/src/reputation/post-game-reputation.ts:488-493` grava
  `reviewer_id`, `reviewer_name`, `reviewer_photo`, `target_user_id`,
  `target_user_name` e `target_user_photo` na coleção raiz `post_game_reputation`.
- `app/.../domain/usecase/cashbox/RecordPaymentUseCase.kt:83` usa a descrição
  padrão `"Pagamento de ${playerName}"`, gravada por `createCashboxEntry` em
  `groups/{g}/cashbox/{id}.description`.

**Design:**
- `post_game_reputation`: anonimiza `reviewer_name`/`reviewer_photo` onde
  `reviewer_id == uid` e `target_user_name`/`target_user_photo` onde
  `target_user_id == uid`. Queries de escopo de coleção paginadas, sem índice
  novo. Notas e agregados não mudam.
- Descrição do caixa, nas duas pontas:
  1. Escrita: a descrição padrão do Android deixa de conter o nome (o nome já
     vai em `player_name`).
  2. Limpeza: no mesmo update que anonimiza `player_name`, as ocorrências do
     `player_name` original como palavra inteira na `description` viram
     "Usuário removido". Nomes com menos de 3 caracteres não são substituídos,
     para não corromper texto.
- Entradas novas em `uid-owned-collections.ts`.

**Testes:** payload real dos escritores em `account-cleanup-writer-shapes.test.ts`.

### #4100 — `onGroupDeleted` sem paginação e sem `wall_posts`/`group_polls`
- Cascata extraída para `functions/src/groups/group-cascade.ts`: leitura por
  cursor (450 por página) e commit incremental, com memória limitada a uma
  página e um batch.
- `wall_posts` (subcoleção), `group_polls` e `group_poll_votes` (root) entram
  na cascata hard.
- `users/{uid}/groups/{id}` é apagado antes do doc do membro, para um retry
  após falha parcial nunca deixar a referência órfã.

### #4114 — `color-scheme` fica `light` em `body`/`#root` no dark/OLED
- `color-scheme` sai da regra incondicional e passa a ser declarado por tema
  via `html[data-resolved-theme=…]`, cobrindo `html`, `body` e `#root`.
- Landing sempre clara preservada (segue o atributo).

### #4108 — badge de notificações recorta "9+" em fontScale ≥ 1,287
- `NotificationIconWithBadge` usa o `Badge` do Material 3 num `Box` que não
  recorta, alinhado ao `IconButton`. `BadgedBox` foi descartado porque o
  `IconButton` recorta o conteúdo em 40dp e cortava o badge de dois dígitos.
- Rótulo `99+` acima do teto; contagem anunciada via `stateDescription`.
- `FutebaTopBar.kt` (deprecated, 0 call sites) removido.

### #4099 — `divisionTextColor` não é contrast-level-aware
- `LocalContrastLevel` provido pelo tema ao lado de `LocalIsDarkTheme`.
- `divisionTextColor`/`gamificationTextColor` resolvem por
  {light, dark} × {NORMAL, HIGH}; testes parametrizados nas 4 combinações.

### #4115 — `motion.easing.emphasized` idêntico a `standard`
- Opção (b): alias assumido. `emphasized` removido do token e das 3 plataformas;
  5 call sites migrados para `Standard`. Fonte da decisão em `DECISIONS.md`.
- Gate `checkMotionParity` valida nome → curva e falha em swap ou símbolo
  órfão; teste cobre o swap.

### #4096 — pódio do `PostGameReportScreen` (composeApp) com `Color.White` hardcoded
- `DynamicThemeEngine.onColorFor` promovido a `internal` e usado no pódio.
- 5 literais irmãos trocados por tokens do `colorScheme` com ≥ 3,0:1 nos dois temas.

### #4098 — `composeApp/ui/theme/Color.kt` com 5 paletas sem consumidor
- Opção (A): paletas mortas removidas.

### #4109 — 788 KB de Poppins empacotados no iOS sem uso
- iOS mantém fonte de sistema (HIG). Família Poppins construída dentro do
  `expect/actual` (`rememberPlatformFontFamily`) e `.ttf` movidos para fora do
  grafo iOS.

### #4097 — iOS sem escolha de tema
- `ThemeRepository` implementado em `iosMain` com `NSUserDefaults`, binding no
  Koin do CMP, rota + tela de tema em `commonMain`, `App.kt` coleta
  `themeConfig` (default `SYSTEM`).

---

## 3. Verificação

| Camada | Comando | Resultado |
|--------|---------|-----------|
| Functions | `npm run build && npm run lint && npx jest --no-coverage` | build e lint ok; 1875 testes passam. A única suíte vermelha (`group-wall-media-ffmpeg`) exige binário FFmpeg vendorizado ausente no sandbox |
| Web | `npx tsc --noEmit && npm run lint && npx vitest run` nas suítes tocadas | ok |
| Android | `:app:compileDebugKotlin`, `:app:detekt`, `DivisionColorsTest` + `GamificationTextColorTest` | ok (157 testes). Teste instrumentado do badge compilado, não executado (sem emulador) |
| composeApp | `:composeApp:compileDebugKotlinAndroid`, `compileNonIosMainKotlinMetadata`, `detekt` | ok. Targets iOS não compilam em Linux |
| Tokens | `node scripts/check-design-tokens-parity.js` + `node --test scripts/check-design-tokens-parity.test.js` | ok |
| Índices | `firestore-rules-tests` `indexes-contract.test.ts` | ok |
| Contratos CI | `node --test scripts/ci/*.test.js` | ok (54) |

**Deploy:** publicar `firestore.indexes.json` e aguardar READY antes de
`firebase deploy --only functions`; depois `firestore.rules`.

---

## 4. Mobile DoD

- [x] Responsividade: sem mudança de layout além do badge (auto-dimensionado)
- [x] Acessibilidade: badge legível em fontScale 2,0; contraste ≥ AA nas 4 combinações de tema; pódio iOS ≥ 4,5:1
- [x] Performance: sem recomposições extras (CompositionLocal estático)
- [x] Offline/Erros: tema iOS persiste em `NSUserDefaults`; default `SYSTEM`
