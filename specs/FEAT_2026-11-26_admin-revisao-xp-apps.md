# FEAT: Fila de revisão de recompensas XP no Android e iOS (admin)

**Data:** 2026-11-26
**Status:** Proposta (spec de análise — NÃO implementado)
**Origem:** Issue #4629 item 8 (`INELIGIBLE_MIN_PLAYERS`) + pendência documentada: aprovação de recompensas retidas existe **somente na web** (Admin → Fila de revisão). Objetivo: levar a mesma capacidade de decisão ao Android (Compose) e iOS (CMP), reusando o backend existente sem mudanças de contrato.

---

## 1. Contexto atual

- Quando um jogo finalizado reprova no soft-gate antifraude (`validation_status === "REVIEW_REQUIRED"`), `functions/src/xp/game-validation-gate.ts` marca o jogo como `xp_reward_status: "HELD_FOR_REVIEW"` e **nenhum XP é pago** (`onGameStatusUpdate` só processa `FINISHED` ou a transição `HELD_FOR_REVIEW → ELIGIBLE` com decisão `APPROVED`).
- O item 8 do #4629 introduziu `INELIGIBLE_MIN_PLAYERS` (+ `xp_reward_hold_reasons: ["MIN_PLAYERS"]`) para jogos com menos de `MIN_PLAYERS_FOR_XP` (= 6, fonte `shared/xp-constants.json` via `constants.ts`) confirmados elegíveis — status **terminal**, sem fila de revisão.
- A única UI de decisão é `web/src/pages/admin/GameReviewQueueScreen.tsx`.
- Mobile hoje **exibe** o estado (banner informativo) mas não decide:
  - Android: `app/.../ui/games/GameDetailScreen.kt` → `GameValidationStatusCard`/`ValidationBannerUi` (inclui `isAdmin` para variar o texto do banner held, mas sem ação).
  - iOS: `composeApp/.../compose/App.kt` → `XpRewardBanner` (#4663) para `HELD_FOR_REVIEW`, `REJECTED_BY_ADMIN`, `INELIGIBLE_MIN_PLAYERS` (somente informativo).

**Esta spec não propõe NENHUMA mudança em `functions/`** — o backend já está completo, seguro e testado (`functions/test/reward-review.test.ts`). O trabalho é 100% cliente (Android + iOS) + spec de contratos.

---

## 2. Contrato exato da callable (source of truth: `functions/src/games/reward-review.ts`)

### `reviewHeldGameRewards`

- **Tipo:** Cloud Function callable v2 (`onCall`).
- **Região:** `FUNCTION_REGION` (`southamerica-east1`).
- **App Check:** `enforceAppCheck: true`, `consumeAppCheckToken: false` — apps mobile já devem enviar token App Check (Android/iOS já têm App Check configurado).

#### Request (JSON)

| Campo | Tipo | Regra |
|---|---|---|
| `gameId` | `string` | Obrigatório, trim não-vazio, ≤ 128 chars, sem `/` |
| `action` | `"APPROVE" \| "REJECT"` | Obrigatório, exatamente um dos dois valores |
| `reason` | `string` | Obrigatório, trim com 10–500 caracteres |

#### Response (JSON, sucesso)

```json
{
  "success": true,
  "gameId": "<id>",
  "action": "APPROVE" | "REJECT",
  "previousStatus": "HELD_FOR_REVIEW",
  "newStatus": "ELIGIBLE" | "REJECTED_BY_ADMIN"
}
```

#### Erros (`HttpsError` — mapear por `code` no cliente)

| `code` | Condição | Mensagem |
|---|---|---|
| `unauthenticated` | Sem auth | `"Login obrigatório."` |
| `permission-denied` | `request.auth.token.role !== "ADMIN"` (custom claim) | `"Apenas administradores podem executar esta ação."` |
| `resource-exhausted` | Rate limit: **5 req/60s por uid** (BATCH_OPERATION, prefixo `reward_review_admin`) | `"Muitas tentativas. Tente novamente em N segundos."` |
| `invalid-argument` | `gameId` inválido | `"gameId é obrigatório e deve ser uma string válida."` |
| `invalid-argument` | `action` inválido | `"Ação inválida para revisão de recompensas"` |
| `invalid-argument` | `reason` fora de 10–500 trim | `"Motivo da revisão deve ter entre 10 e 500 caracteres"` |
| `not-found` | Jogo não existe | `"Jogo não encontrado"` |
| `failed-precondition` | `game.status !== "FINISHED"` | `"A revisão só pode ocorrer em jogos finalizados"` |
| `failed-precondition` | `game.xp_reward_status !== "HELD_FOR_REVIEW"` | `"O jogo não está com recompensas retidas para revisão"` |

#### Efeitos colaterais (transação Firestore atômica)

1. `APPROVE` apenas: limpa `suspicious_overlap` em todas as `confirmations` do jogo (`suspicious_overlap: false` + `suspicious_overlap_cleared_at/_cleared_by`) — sem isso o reprocessamento re-exclui os jogadores (spec `specs/bugfix-2026-11-23-xp-retido-aprovado.md`).
2. Atualiza `games/{gameId}`: `xp_reward_status` → `ELIGIBLE|REJECTED_BY_ADMIN`, `xp_reward_review_decision` (`APPROVED|REJECTED`), `xp_reward_reviewed_at/_reviewed_by/_review_reason`, `xp_reward_review_previous_status/new_status`, `xp_processing: false`, `xp_processing_error` (null ou `"XP rejected by admin review"`).
3. **APPROVE dispara reprocessamento de XP**: a atualização do documento faz `onGameStatusUpdate` revalidar via `validateGameSecurityAndShouldProcess` (transição `HELD_FOR_REVIEW → ELIGIBLE` + `decision === "APPROVED"`) e pagar o XP, com override do soft-gate (`manualRewardApproval`). **REJECT não paga XP e é terminal.**

### Consulta da fila (client-side Firestore, sem callable)

Web usa duas queries mergeadas (paridade total exigida nos apps):

```ts
// Query 1 — fila de recompensas (requires index xp_reward_status IN [...])
query(collection(db, 'games'),
  where('xp_reward_status', 'in', ['HELD_FOR_REVIEW', 'ELIGIBLE', 'REJECTED_BY_ADMIN']),
  limit(100));
// Query 2 — auto-close em revisão
query(collection(db, 'games'), where('auto_close_review_required', '==', true), limit(100));
// Merge por id, descartar status != FINISHED/CANCELLED, ordenar por
// xp_reward_held_at ?? validation_updated_at ?? date_time (desc).
```

**Autorização da leitura:** `firestore.rules` `games.allow list` — `isAdmin()` vem primeiro (fix #4571); admin lista sem filtros de visibility/owner/grupo. `isAdmin()` = custom claim `role == 'ADMIN'` (ver §5).

---

## 3. Statuses e transições válidas

`XpRewardStatus` (web `types/game.ts`; manter sincronizado nos apps):

| Status | Significado | Ação admin disponível? |
|---|---|---|
| *(ausente)* | Jogo ainda não passou pelo gate (pré-fim) | Não |
| `HELD_FOR_REVIEW` | Soft-gate antifraude retém XP | **Sim** — APROVE ou REJECT |
| `ELIGIBLE` | Liberado (auto ou manual pós-APPROVE) | Não |
| `REJECTED_BY_ADMIN` | Rejeitado — XP nunca será pago | Não (terminal) |
| `INELIGIBLE_MIN_PLAYERS` | < 6 confirmados elegíveis — XP nunca será pago | **Não** (terminal — NÃO entra na fila) |
| `PROCESSED` | XP pago (escrito por `post-game-effects.ts`) | Não |

**Única transição iniciada por UI:** `HELD_FOR_REVIEW → ELIGIBLE` (APPROVE, dispara XP) ou `HELD_FOR_REVIEW → REJECTED_BY_ADMIN` (REJECT, terminal). A callable é o **único** caminho — nunca escrever `xp_reward_status` pelo cliente (firestore.rules já bloqueiam campos de validação/xp client-side, `hasNoGameValidationClientFields`).

---

## 4. O que cada plataforma precisa

### 4.1 Android (Compose, `:app`)

Nova tela **AdminGameReviewQueueScreen** (ex.: `app/.../ui/admin/`), espelhando a web:

1. **Acesso:** gating por `PermissionManager.isAdmin()` (lê `users/{uid}.role` do Firestore, com cache). Entrypoint: área admin existente / `AppNavGraph` rota `/admin/review` (aparecer só para admin).
2. **Lista:** as duas queries do §2 via `GameQueryRepositoryImpl`/Firestore Android (campo `xp_reward_status` e `auto_close_review_required` já são lidos por `GameRepositoryImpl`); filtros (Pendentes/Liberados/Rejeitados/Auto-close), busca por local/organizador/motivo, contadores resumo.
3. **Card por jogo:** local, data/hora, organizador, chips de status (`getRewardStatusMeta` paridade), `validationStatus`, `validationScore`, `autoCloseValidationScore`, motivos (`xp_reward_hold_reasons` fallback `validationReasons`), última decisão manual (`xpRewardReviewReviewReason`… ou seja `xpRewardReviewDecision/Reason/ReviewedAt`).
4. **Ação (somente `HELD_FOR_REVIEW`):** botões "Liberar recompensas" / "Rejeitar recompensas" → diálogo com `OutlinedTextField` justificativa (contador 10–500, validação client-side pré-chamada) → `FirebaseFunctions.getInstance(FirebaseRegions.FUNCTIONS).getHttpsCallable("reviewHeldGameRewards")` com payload `{gameId, action, reason}`. Loading no botão (`disabled` + `CircularProgressIndicator`), resultado via snackbar/toast; mapear `FirebaseFunctionsException.code` para mensagens PT-BR da tabela §2.
5. **Estados obrigatórios:** Loading (shimmer) / Erro com retry / Vazio / Sucesso (padrão do repo).
6. **Deep-link opcional:** no `GameValidationStatusCard`, se `isAdmin` e `HELD_FOR_REVIEW`, adicionar botão/ação "Revisar como admin" navegando para a fila (banner atual já diferencia admin; adicionar ação não quebra contrato).
7. **Cache de role:** invalidar `PermissionManager` cache em logout (já existe `invalidateCache()`).

### 4.2 iOS (Compose Multiplatform, `composeApp` + `shared`)

1. **Chamada da callable:** via GitLive Firebase Functions no `:shared` (padrão existente: `FirebaseGamesDataSource.httpsCallable(...)`), ex. `FirebaseGamesDataSource.reviewHeldGameRewards(gameId, action, reason)` — retorna payload tipado; mapear `FirebaseFunctionsException` (códidos análogos). iOS já tem `FirebaseFunctions` no Podfile e App Check.
2. **Tela:** `AdminGameReviewQueueScreen` CMP espelhando Android (mesmos componentes do `composeApp`, ex. reusar `XpRewardBanner`/Cards). As duas queries do §2 via `FirebaseGamesDataSource` (queries compostas `where`/`limit` já suportadas pelo GitLive).
3. **Modelo:** campos já mapeados em `shared/.../FirebaseMappingExtensions.kt` (`xpRewardStatus`) — **completar** mapeamento de `xp_reward_hold_reasons`, `xp_reward_reviewed_at/_by/_decision/_reason`, `validation_status`, `validation_score`, `auto_close_review_required` no `Game` do KMP (`shared/src/commonMain/.../domain/model/Game.kt` hoje só expõe `xp_reward_status`).
4. **Autorização:** admin global = `role == "ADMIN"` no doc do usuário (mesma fonte do Android; iOS usa `shared`, implementar helper `isCurrentUserAdmin()` no datasource comum).
5. **XpRewardBanner:** manter informativo; opcionalmente, para admin com `HELD_FOR_REVIEW`, adicionar ação de navegação para a fila.

---

## 5. Autorização (admin global)

- **Backend (única fonte real):** custom claim `request.auth.token.role === "ADMIN"` — já pronto. Nada a mudar.
- **Firestore rules:** `isAdmin()` já libera `list` de games sem filtros (fix #4571) — nada a mudar.
- **Clientes (UX gating apenas):** Android `PermissionManager` lê `users/{uid}.role`; iOS idem via shared. Gating client-side é só para esconder UI — a callable revalida sempre. **Atenção:** claim/role pode estar desatualizado após promoção (refresh token); se a callable retornar `permission-denied`, invalidar cache e re-checar antes de mostrar erro genérico.

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Aprovação acidental libera XP irreversível (APPROVE paga XP; não há "desfazer") | Confirmar dialog com resumo do jogo + justificativa obrigatória 10–500; `REJECT` é seguro (terminal). Documentar no UI que APPROVE paga XP imediatamente. |
| Dupla decisão (web + mobile simultâneos) | Transação Firestore da callable já é idempotente por estado: segunda chamada falha com `failed-precondition` ("não está retida") — tratar como refresco de lista, não erro crítico. |
| Rate limit 5/min compartilhado entre plataformas | É por uid (admin) — unlikely em uso real; mapear `resource-exhausted` com a mensagem de retry retornada. |
| `INELIGIBLE_MIN_PLAYERS` confundido com fila | Status terminal: **não** renderizar botões de decisão; exibir apenas informativo (Android/iOS banners já fazem isso). |
| App Check sem token no mobile bloqueia callable | `enforceAppCheck: true` — garantir app attestation ativo; já coberto pelo setup atual dos apps. |
| Sobreposição (`suspicious_overlap`) invisível ao admin | A callable limpa overlap no APPROVE; exibir no card (contagem de confirmações + flag) para o admin tomar decisão informada. |
| Rules drift / novo campo | Nenhuma escrita client-side de `xp_reward_*` — proibido por rules (`hasNoGameValidationClientFields`); UI só lê. |
| Reprocessamento falha pós-APPROVE (ex.: owner sumiu) | `xp_processing_error` é setado pelo gate; fila web mostra `ELIGIBLE` sem `PROCESSED` — apps devem sinalizar `ELIGIBLE && !xpProcessed` como "liberado, processamento pendente". |

## 7. Critérios de aceite (testáveis)

**Backend (regressão — sem mudanças esperadas):**
1. `npx jest reward-review.test.ts` verde: APPROVE → `ELIGIBLE` + decisão `APPROVED` + overlap limpo; REJECT → `REJECTED_BY_ADMIN`; não-admin → `permission-denied`; jogo não-held → `failed-precondition`.

**Android:**
2. Usuário `role=PLAYER` não vê rota/tela admin; chamada direta via console de teste retorna `permission-denied` e o app exibe a mensagem PT-BR.
3. Admin abre a fila: vê jogos `HELD_FOR_REVIEW` com motivos (`xp_reward_hold_reasons`), score e organizador; lista atualiza em tempo real (snapshot).
4. Approve com justificativa ≥ 10 chars → snackbar sucesso; jogo sai da fila "Pendentes" e XP é pago (verificar `xp_logs` do jogo no emulador/produção e status → `ELIGIBLE`/`PROCESSED`).
5. Reject → jogo aparece em "Rejeitados" com decisão/motivo visíveis; nenhum `xp_logs` novo.
6. Justificativa < 10 chars → botão desabilitado + contador; erro `invalid-argument` do backend mapeado.
7. Jogo `INELIGIBLE_MIN_PLAYERS` não aparece na fila de pendentes e não tem botões de decisão.
8. Segunda approvação do mesmo jogo → `failed-precondition` tratado como "já revisado" com refresco da lista.

**iOS:**
9. Mesmos critérios 2–8 via tela CMP, com callable invocada via `:shared` e payload/resposta tipados.
10. `./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64` + testes KMP dos mapeamentos novos (campos `xp_reward_*` e review) verdes.

**Cross:**
11. Decisão tomada no mobile reflete imediatamente na web e vice-versa (mesma transação Firestore).
12. `reviewHeldGameRewards` do mobile carrega App Check token (callable não falha `unauthenticated`/`permission-denied` por App Check).

## 8. Fora de escopo

- Mudanças em `functions/` (nenhuma), firestore.rules, novos indexes (as queries já têm index na web — reusar os mesmos), API de auditoria nova (auditoria já é inerente aos campos `xp_reward_review_*` + logs da callable).
- Fila de auto-close (`auto_close_review_required`) além de exibição — decisão segue o mesmo fluxo de reward review quando aplicável (paridade web).
