# SPEC: Game Detail — Carona discreta, confirmações, valores e Live Game

> **Status:** APPROVED
> **Autor:** Renan + Claude
> **Data:** 2026-07-20

---

## 1. Objetivo

Tornar a carona mais discreta na tela de jogo, corrigir bugs de cálculo
financeiro e de permissão de confirmação, permitir que dono + co-organizadores
confirmem jogadores, e limpar inconsistências do Live Game identificadas em
auditoria. Entrega em 6 fases, cada uma um PR independente.

## 2. Decisões normativas

1. **Carona (Fase 1)**: deixa de ser um Card visível na pilha principal da
   `GameDetailScreen` (Web). Passa a ser um ícone `DirectionsCar` no header,
   que abre um Dialog/Popover com o mesmo formulário e lista atuais. O feature
   permanece **Web-only** nesta entrega (Android não tem a feature; não será
   adicionada agora).
2. **Cálculo de preço (Fase 2)**: `totalCost / maxPlayers` é a fórmula canônica
   em todas as plataformas (já é Web + CF). Android passa a usar um helper
   compartilhado equivalente a `resolveExpectedPayment`. `dailyPrice` cru não
   é mais usado em dashboards — sempre via resolver.
3. **Owner confirma jogador (Fase 3)**: criado callable
   `confirmPlayerAsManager({ gameId, userId, position? })` que roda com Admin
   SDK, checa capacidade (`max_players`/`max_goalkeepers`), valida
   `canManageGame` (owner OU co_organizer OU admin), eleva
   `PENDING → CONFIRMED` atomicamente e grava audit log. firestore.rules
   continuam bloqueando elevação direta client-side.
4. **Cancelamento Android (Fase 4)**: `FirebaseDataSourceImpl.cancelConfirmation`
   muda de `batch.delete()` para `batch.update({ status: 'CANCELLED',
   cancelled_at, updated_at })`, espelhando o Web. Isso restaura o trigger
   `onGameVacancy` (promoção de waitlist) para cancelamentos vindos do Android.
5. **Live Game (Fases 5 e 6)**:
   - Removido código morto `app/.../data/repository/LiveGameRepository.kt` e
     `FirebaseDataSource.updateLiveScore` (writes diretos bloqueados pelas
     rules, jamais funcionaram).
   - `finishGameLifecycle` passa a chamar `isScoreConsistentFromEventStream`
     antes do commit da transação (igual ao `auto-close-past-games`).
   - Limite de 500 eventos passa a ser verificado ativamente no
     `submitLiveGameEvent` (rejeita com `resource-exhausted` ao atingir).
   - `LiveEventsScreen` (Web) checa permissão via `canManageGame` (inclui
     co_organizers e admin), não mais só `owner_id`.
   - Ícones de `ASSIST`/`SUBSTITUTION` removidos do Web (backend não suporta).
6. **Sem breaking changes de schema**: nenhum campo Firestore renomeado ou
   removido. Novos campos opcionais apenas (`cancelled_at` em confirmações).
7. **Sem retroatividade**: bugs corrigidos só afetam jogos/operações futuros.
   Não há backfill de `live_scores` ou `games.team1_score`.

## 3. Fases e escopo

### Fase 1 — Carona discreta (Web)
- Substituir `<GameRidesPanel>` inline por botão-ícone no header da
  `GameDetailScreen`.
- Mesmo formulário + lista movidos para dentro de `<Dialog>` (MUI).
- Badge com contador de caronas ativas sobre o ícone.
- Man todas as permissões atuais (`canUse = isConfirmed || canManage`).

### Fase 2 — Corrigir bugs de cálculo financeiro
- **B1**: `GameFinancialDashboard.kt:56` e `GameOwnerComponents.kt:60` usam
  `totalCost / totalPlayers`. Mudar para `totalCost / maxPlayers` (com fallback
  `dailyPrice` se `priceManualOverride`), espelhando
  `web/src/utils/gamePayment.ts`.
- **B2**: `PostGameReportScreen.kt:91-92` — extrair helper
  `resolveExpectedPayment(game)` no Android (KMP `shared/`) e usar.
- **B3**: `web/PostGameReportScreen.tsx:232-233` — somar `partialPayment` ao
  `totalCollected` (igual ao Android).
- **B4** (opcional nesta fase): documentar heurística de
  `normalizeHourlyPriceForGame`; não alterar sem dados.

### Fase 3 — Owner/co-organizador confirma jogadores
- Novo callable `confirmPlayerAsManager` em
  `functions/src/games/confirm-player-as-manager.ts`.
- Validações: auth obrigatório, AppCheck, `canManageGame`, jogo em
  `SCHEDULED|CONFIRMED`, capacidade respeitada, target confirmation existe com
  `status in [PENDING]` (ou cria se summon ainda não feito), registra
  `audit_logs/confirm_player_as_manager_{gameId}_{userId}_{managerId}`.
- Idempotente: se já `CONFIRMED`, retorna success sem reescrever.
- UI:
  - **Android**: `ConfirmationCard` ganha botão "Confirmar" para managers
    quando o jogador está `PENDING`.
  - **Web**: `ConfirmedPlayersTab` (ou novo tab `PendingPlayersTab`) botão
    "Confirmar" ao lado de cada PENDING.

### Fase 4 — Fix Android cancel presença (waitlist trigger)
- `FirebaseDataSourceImpl.cancelConfirmation` (linhas 313-331): trocar
  `batch.delete()` por `batch.update()` com `status: 'CANCELLED'`,
  `cancelled_at: FieldValue.serverTimestamp()`,
  `updated_at: FieldValue.serverTimestamp()`.
- Adicionar teste em `app/src/test/.../FirebaseDataSourceImplTest.kt` (ou
  equivalente de repository) que valida update em vez de delete.
- firestore.rules já permitem self-update para essa transição — sem mudança.

### Fase 5 — Live Game: código morto + consistência + cap
- Deletar `app/src/main/java/com/futebadosparcas/data/repository/LiveGameRepository.kt`
  (interface + impl mortos — DI usa `shared/`).
- Deletar `updateLiveScore` de `shared/.../FirebaseDataSource.kt:1345-1357`
  (método morto).
- `finishGameLifecycle` (`functions/src/games/lifecycle.ts`): chamar
  `isScoreConsistentFromEventStream` antes do commit; se inconsistente, logar
  warning mas **não bloquear** (apenas auditoria — não regredir finalização).
- `submitLiveGameEvent` (`functions/src/games/live-events.ts`): na transaction,
  contar eventos existentes; se `>= 500`, rejeitar com `resource-exhausted`
  ("Limite de 500 eventos por jogo atingido").
- Testes: `live-events.test.ts` adiciona caso de "evento 501 rejeitado";
  `lifecycle` adiciona caso de inconsistência logada.

### Fase 6 — UI Live: permissão + dead icons
- `LiveEventsScreen.tsx:178` — substituir
  `setCanManage(user.id === ownerId)` por hook `useCanManageGame(game)` (já
  existe `canManageGame` em `web/src/utils/`).
- `LiveGameScreen.tsx:758-760` — remover cases `ASSIST` e `SUBSTITUTION`
  (backend só suporta `GOAL|SAVE|YELLOW_CARD|RED_CARD`).
- (Opcional) P12 sync de placar na lista — fora desta spec, requer decisão
  separada sobre escrever em `games.team1_score` a cada evento.

## 4. Segurança / anti-regressão

- Nenhum callable novo exposto sem AppCheck + rate limit + auth check.
- `confirmPlayerAsManager` reusa helpers de capacidade do
  `confirmGamePresenceTransactional` (DRY) — não reimplementa validação.
- Auditoria: todo `confirmPlayerAsManager` gera doc em `audit_logs/`.
- Tests obrigatórios por fase antes do merge (CI gates já cobrem):
  - F2: teste de cálculo em `GameFinancialDashboard` (JUnit) +
    `PostGameReportScreen` web (Vitest).
  - F3: `functions/test/confirm-player-as-manager.test.ts` (capacidade,
    permissão, idempotência, audit) + firestore-rules-tests confirmando bloqueio
    client-side mantido.
  - F4: teste Android de update (não delete) + E2E manual de waitlist trigger.
  - F5: `live-events.test.ts` caso 500 + teste de `isScoreConsistent` em
    lifecycle.

## 5. Fora de escopo

- Carona no Android (feature ausente; requer spec separada se desejado).
- Backfill de placares históricos em `games.team1_score`.
- Mudar schema de confirmations para subcoleção.
- Multi-moeda (continua BRL).
- Refatorar `gamePricing.normalizeHourlyPriceForGame` (B4 — só documentar).

## 6. Referências

- Auditoria: feita por agentes `explore` em 2026-07-20 (carona, confirmações,
  live game).
- Padrões web: ver CLAUDE.md "Web patterns" (writeBatch, serverTimestamp,
  try/catch + showError, disabled={loading}).
- Padrões KMP: helpers compartilhados em `shared/commonMain/`.
- Regras de XP: spec `feat-2026-07-19-xp-performance-aderencia.md` —
  `WAITLIST_PROMOTED` e bônus de confirmação já processados no pipeline;
  esta spec não toca em XP.
