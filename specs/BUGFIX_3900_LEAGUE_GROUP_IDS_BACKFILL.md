# BUGFIX #3900 — Ranking de Liga por grupo zera estatísticas da temporada corrente

| Campo | Valor |
|---|---|
| **Issue** | #3900 |
| **Status** | APPROVED |
| **Tipo** | Bugfix (regressão de produção) |
| **Camadas** | Cloud Functions + Firestore indexes + script de migração |
| **Origem** | Auditoria agendada de Cloud Functions, 2026-07-24 |
| **Regressão de** | #3879 (PR #3893) |

---

## 1. Problema

O PR #3893 trocou o filtro de grupo do diretório de Liga de `where("group_id", "==", groupId)` para `where("group_ids", "array-contains", groupId)` sem fazer backfill do campo novo. O Firestore exclui de um filtro `array-contains` todo documento que **não tem** o campo — e todo `season_participation` gravado antes do deploy só tem o escalar `group_id`.

`functions/src/game/helpers.ts:752` só passa a gravar `group_ids` (via `arrayUnion`) quando o usuário finaliza um jogo **após** o deploy.

### Mecanismo da falha silenciosa

Em `buildLeaguePlayersDirectory` (`functions/src/cache/leaderboard-cache.ts:646`) as duas metades do diretório vêm de fontes independentes:

- o roster vem de `fetchActiveGroupMemberIds(groupId)` (`:659`) — **não** foi afetado pelo #3893;
- as estatísticas vêm de `fetchLeagueParticipations` (`:652`) — devolve `[]`.

Com `participationByUser` vazio, todos os campos caem no `?? 0` das linhas 684-691. Resultado: **roster completo renderizado com pontos, jogos, vitórias, gols, assistências e MVPs zerados**, sem erro, sem empty state e sem log.

### Por que não há alerta

Antes do #3893 o mesmo caminho falhava, mas em voz alta: o `.orderBy(orderField,"desc").orderBy("user_id","asc")` exigia `(season_id, group_id, <orderField> DESC, user_id ASC)`, índice que nunca existiu — a consulta lançava `FAILED_PRECONDITION`. Os 4 índices novos com `group_ids: CONTAINS` já estão deployados, então hoje a query executa normalmente e devolve vazio. **Trocou-se falha ruidosa por falha silenciosa com dado errado.**

Estado verificado em `firestore.indexes.json`: existem os 4 índices `group_ids: CONTAINS`; do lado legado existe apenas `(season_id, group_id, points DESC)` — **sem** `user_id`, e sem nenhuma variante `by_gender`.

### Janela de dano

`partId` é `${seasonId}_${uid}` e a query filtra `season_id`, então o problema se autocorrige na virada de temporada: os docs de 2026-08 nascem com `group_ids` no primeiro jogo finalizado. Até lá:

1. todo grupo cujos membros jogaram antes do deploy exibe tabela zerada;
2. quem não voltar a jogar em julho nunca aparece correto nesta temporada;
3. as variantes `by_gender` sofrem igual, porque o filtro de grupo é o mesmo.

---

## 2. Requisitos

| # | Requisito |
|---|---|
| R1 | O diretório de Liga filtrado por grupo exibe estatísticas reais para docs legados (só `group_id`) na temporada corrente |
| R2 | Docs legados e migrados coexistem no mesmo ranking sem duplicar usuário |
| R3 | A correção não depende do timing de execução do backfill |
| R4 | O estado "há membros ativos e zero participações" deixa de ser silencioso |
| R5 | O backfill é idempotente e re-executável sem efeito colateral |

---

## 3. Decisões de design

### D1 — União das duas consultas, não fallback só-quando-vazio

A issue sugere "se `group_ids` vier vazia, repetir por `group_id`". **Rejeitado**: durante a migração um grupo fica com estado misto (quem jogou depois do deploy tem `group_ids`, quem não jogou não tem). Nesse caso a consulta nova volta **não-vazia porém parcial**, o fallback não dispara e os legados continuam zerados — que é a maior parte da base.

Adotado: executar as duas consultas sempre que `groupId` estiver presente, unir por id de documento, reordenar em memória e aplicar o limite. Custo: 2 queries em vez de 1, num caminho que já é servido por cache (`writeLeaguePlayersDirectoryCache`). Satisfaz R1, R2 e R3.

A união é removível assim que o backfill estiver concluído em produção — marcada no código com `TODO(#3900)`.

### D2 — Ordenação e limite aplicados em memória após a união

Duas consultas ordenadas independentemente não produzem um top-N global ao serem concatenadas. Cada uma busca `resultLimit` docs, a união é reordenada por `(orderField desc, user_id asc)` — mesma chave da query — e só então cortada em `resultLimit`. Como `LEAGUE_DIRECTORY_SCAN_LIMIT` é o teto de varredura do diretório e o resultado é filtrado pelo roster do grupo, o resultado é equivalente ao da query única pós-backfill.

### D3 — Índices legados versionados

A consulta legada usa a mesma dupla de `orderBy`, então exige `(season_id, group_id, <orderField> DESC, user_id ASC)` nas 4 variantes (`points` + 3 `by_gender`). Nenhuma existe. Serão adicionadas a `firestore.indexes.json`.

O índice pré-existente `(season_id, group_id, points DESC)` **não** atende, por faltar `user_id`.

### D4 — Backfill como script, não como Cloud Function

Segue o padrão de `scripts/` (mesma família de `run-migration-custom-claims.js`). Mutação de dado de produção fica sob execução explícita do responsável, não disparada por deploy.

---

## 4. Mudanças

| Arquivo | Mudança |
|---|---|
| `functions/src/cache/leaderboard-cache.ts` | `fetchLeagueParticipations`: união das consultas `group_ids`/`group_id` com dedupe, reordenação e limite (D1, D2) |
| `functions/src/cache/leaderboard-cache.ts` | `buildLeaguePlayersDirectory`: log `warn` quando `groupId` presente, roster não vazio e zero participações (R4) |
| `firestore.indexes.json` | +4 índices `(season_id, group_id, <orderField> DESC, user_id ASC)` (D3) |
| `scripts/backfill-season-participation-group-ids.js` | Backfill idempotente e paginado (R5) |
| `functions/test/leaderboard-group-ids-backfill.test.ts` | Cobertura de doc legado, doc migrado e estado misto |

---

## 5. Critérios de aceite

- [ ] Doc legado (só `group_id`) aparece no ranking filtrado por grupo com estatísticas reais
- [ ] Doc migrado (`group_ids`) continua aparecendo
- [ ] Estado misto: os dois aparecem, sem duplicar o usuário
- [ ] Log de discrepância presente quando roster > 0 e participações == 0
- [ ] Backfill idempotente: segunda execução não altera nenhum documento
- [ ] `npm run build`, `npm run lint` e `npx jest` verdes em `functions/`

---

## 6. Fora de escopo

- **Execução do backfill em produção** — exige credencial e é mutação de dado real; fica a cargo do responsável, com o script entregue e testado (ver §7).
- **#3896** (Liga por grupo em `groups/{id}/league_seasons`) — coleção, código e tela diferentes.
- Remoção da união de consultas — só depois do backfill concluído.

---

## 7. Verificação

Suíte de `functions/` (build + lint + jest). O caminho de produção depende do backfill, que **não** é executado por este PR — a união de consultas (D1) existe justamente para que a UI fique correta antes e independentemente dele.
