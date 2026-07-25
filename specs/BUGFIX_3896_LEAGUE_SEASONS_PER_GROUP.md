# BUGFIX #3896 — Liga por grupo nunca funciona em grupos criados por usuário

| Campo | Valor |
|---|---|
| **Issue** | #3896 |
| **Status** | APPROVED |
| **Tipo** | Bugfix |
| **Camadas** | Cloud Functions (trigger + crons) |
| **Origem** | Auditoria agendada de Cloud Functions, 2026-07-24 |

---

## 1. Problema

Os dois únicos escritores de `groups/{id}/league_seasons` — `startNewSeason` e `archiveSeason` (`functions/src/growth/season-cycle.ts`) — iteravam a coleção `official-groups`, um **catálogo curado de 11 entradas** criado por `seedOfficialGroups`. Grupo criado por usuário nunca recebia documento de temporada.

`useGroupLeague` resolve a temporada exclusivamente a partir de `league_seasons`; com a subcoleção vazia, `selectedSeason` fica `null`, a query de standings nunca roda e a aba Liga cai permanentemente no estado vazio "liga não começou" — mesmo depois de dezenas de jogos finalizados. A rota e a aba, porém, são oferecidas a **todo** grupo.

O #3882 (PR #3894) piorou o custo: o fallback de virada de mês em `onGameFinishedGroupLeague` foi desenhado para uma janela de ~61min, mas como a consulta de temporada ativa é sempre vazia para grupo não oficial, ele disparava em 100% dos jogos finalizados da maior parte da base — gravando standings sob um `season_id` sem documento correspondente (inalcançáveis pela UI) e emitindo um `logger.warn` por jogo.

## 2. Decisões de design

### D1 — Provisionar sob demanda, no ponto onde o fallback já era derivado

Opção A da issue. O grupo que de fato joga passa a ter documento de temporada, e a tela enxerga. Alternativa B (trocar a fonte dos crons para a coleção `groups` inteira) foi rejeitada: varre a base toda todo mês para provisionar temporada de grupo que talvez nunca jogue.

**Ordem de leitura/escrita:** a escrita entra na transação existente de `onGameFinishedGroupLeague`. O Firestore exige todos os `get()` antes de qualquer escrita — as leituras da transação estão em `group-league.ts:555`, `:578` e `:613`, e a primeira escrita em `:663`. O `tx.get` do documento de temporada foi posicionado logo após `:613`, ainda na fase de leitura, e o `tx.set` junto das demais escritas.

`start_date` é gravado com `serverTimestamp()` porque `useGroupLeague` ordena por esse campo: documento sem ele seria **silenciosamente excluído** da consulta, e o bug persistiria com a temporada existindo no Firestore.

### D2 — Crons cobrem grupo com temporada ativa, não só o catálogo

Sem isso o fix se autodestrói no mês seguinte: `archiveSeason` faz `continue` para grupo fora de `official-groups`, então a temporada provisionada sob demanda ficaria **ativa para sempre** e todos os meses seguintes cairiam no mês 1.

`listManagedGroupIds()` passa a unir `official-groups` (para que grupo oficial siga provisionado antes do primeiro jogo) com todo grupo que tenha temporada ativa, via `collectionGroup("league_seasons").where("is_active","==",true)` — filtro de campo único, atendido pelo índice automático do Firestore em escopo de collection group, sem novo índice a versionar.

Grupo dormente (sem temporada ativa) fica de fora de propósito: não há por que provisionar meses para quem parou de jogar, e o provisionamento sob demanda cobre o retorno.

### D3 — WARN vira INFO

Sem temporada ativa deixou de ser sinal de falha de cron: é o caminho normal do primeiro jogo de um grupo. Manter em `warn` seria alarme falso a cada jogo.

### D4 — `getMonthName` extraído para `season-naming.ts`

`group-league.ts` precisa do mesmo nome de temporada dos crons. Importar `season-cycle.ts` registraria `onSchedule` no load e obrigaria toda suíte que toca `group-league` a mockar o scheduler. Um módulo sem efeito colateral resolve.

### Fora de escopo — fuso de `deriveFallbackSeasonId`

`matchPayload.date` vem de `gameData.date`, string de data local (`YYYY-MM-DD`), não instante ISO em UTC — o `slice(0, 7)` já devolve o mês local correto. Verificado, sem mudança necessária.

## 3. Mudanças

| Arquivo | Mudança |
|---|---|
| `functions/src/group-league.ts` | Provisionamento sob demanda da temporada; WARN → INFO |
| `functions/src/growth/season-cycle.ts` | `listManagedGroupIds()` substitui as duas varreduras de `official-groups` |
| `functions/src/growth/season-naming.ts` | Novo: `getMonthName` / `buildSeasonName` |
| `functions/test/group-league-season-fallback.test.ts` | Assere o doc de temporada criado com `start_date`, e INFO no lugar de WARN |
| `functions/test/growth-season-cycle-scheduler.test.ts` | Novo caso: grupo **não** oficial coberto pelo cron; fake com `collectionGroup` |
| `functions/test/season-turnover-race.test.ts` | Fake com `collectionGroup` |

## 4. Critérios de aceite

- [ ] Grupo criado por usuário passa a ter `league_seasons/{YYYY-MM}` após o primeiro jogo finalizado
- [ ] O documento tem `start_date`, `is_active: true` e nome no mesmo formato dos crons
- [ ] `startNewSeason` rotaciona a temporada de grupo não oficial
- [ ] Deixa de haver WARN por jogo finalizado
- [ ] `npm run build`, `npm run lint` e `npx jest` verdes

## 5. Não coberto

Opção C da issue (Liga por grupo ser exclusiva de grupos oficiais) foi descartada: a rota e a aba são oferecidas a todo grupo hoje, e escondê-las seria remover funcionalidade em vez de corrigir.

Este PR **não** trata do #3900 (Liga global, `season_participation`) — coleção, código e tela diferentes.
