# BUGFIX: Temporada retroativa ativa (#3917) + archiveSeason sem catch-up (#3916)

> **Status:** `IN_PROGRESS`
> **Severidade:** `HIGH`
> **Issues:** #3917, #3916
> **Data:** 2026-07-28

---

## 1. Descrição

### #3917
`onGameFinishedGroupLeague` provisiona temporada sob demanda com `is_active: true`
incondicional. Jogo finalizado após a virada do mês cria temporada retroativa
ativa que sequestra a resolução de temporada de todos os jogos seguintes (~30 dias).

### #3916
`runArchiveSeason` deriva o mês-alvo do relógio da invocação. Se o cron das 23:59
escorrega para depois da meia-noite (jitter, cold start, retry), o portão de dia
falha e o mês NUNCA é arquivado — sem catch-up, sem callable admin, arquivo e
badge de MVP perdidos para sempre.

---

## 2. Solução

### #3917 — is_active clampado ao mês corrente

`group-league.ts:712`:
```ts
is_active: targetSeasonId === deriveFallbackSeasonId("", new Date()),
```
Jogo retroativo continua contabilizado no mês correto, mas não sequestra a
resolução ativa. Auto-cura: o próximo jogo do mês corrente provisiona a temporada
ativa certa (ganho de #3882/#3896 preservado).

### #3916 — catch-up resiliente

1. **Day-1 catch-up**: `runArchiveSeason` trata dia 1º sem cursor como retomada
   do mês anterior via `getPreviousMonthKey` (nova helper, inversa de `getNextMonthKey`).
2. **Cursor pré-persistido**: `runManagedGroupsCycle` grava `month_key` ANTES de
   `listManagedGroupIds()`. Falha transitória na listagem deixa estado que o retry
   (via `retryCount`) consegue retomar.
3. **`retryCount: 3`** em ambos `onSchedule` (startNewSeason + archiveSeason),
   alinhando com os crons irmãos do repo.

---

## 3. Critérios de aceite

### #3917
- [ ] Teste: jogo de mês passado → season provisionada com `is_active: false`
- [ ] Teste: jogo do mês corrente → `is_active: true` (não regride #3896)
- [ ] Teste: após season retroativa, jogo seguinte do mês corrente NÃO resolve para a chave retroativa

### #3916
- [ ] Teste: invocação às 00:00 do dia 1º sem cursor → arquiva o mês anterior
- [ ] Teste: falha de `listManagedGroupIds()` no último dia deixa cursor para retry
- [ ] Teste: mês já arquivado não é reprocessado (idempotência por existência)
